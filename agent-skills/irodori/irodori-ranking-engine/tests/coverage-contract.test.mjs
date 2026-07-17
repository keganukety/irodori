import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  calculateCoverageMetrics,
  evaluateCandidateCoverage,
  finalizeScenarioRankingEligibility,
  validateCoverageConfiguration,
} from "../scripts/coverage-contract.ts";

const here = dirname(fileURLToPath(import.meta.url));
const engineRoot = join(here, "..");
const contract = JSON.parse(readFileSync(join(engineRoot, "config/coverage-contract.proposed.json"), "utf8"));
const profileSet = JSON.parse(readFileSync(join(engineRoot, "config/coverage-profiles.proposed.json"), "utf8"));

const parentWeights = {
  transport_burden: 0.25,
  station_space_fit: 0.25,
  folding_independence: 0.25,
  carry_assistance: 0.25,
};

function criterion(criterionId, parentAxisId, evidenceState, options = {}) {
  return {
    criterion_id: criterionId,
    parent_axis_id: parentAxisId,
    weight: options.weight ?? parentWeights[parentAxisId] / 2,
    applicability: options.applicability ?? "applicable",
    evidence_state: evidenceState,
    reason_codes: options.reason_codes ?? [],
  };
}

function sparseCriteria() {
  return [
    criterion("transport_burden.body_weight", "transport_burden", "unknown", { reason_codes: ["scope_unknown"] }),
    criterion("transport_burden.secondary", "transport_burden", "unknown"),
    criterion("station_space_fit.unfolded_width", "station_space_fit", "scoreable"),
    criterion("station_space_fit.folded_floor_footprint", "station_space_fit", "unknown"),
    criterion("folding_independence.one_hand_fold", "folding_independence", "scoreable"),
    criterion("folding_independence.one_hand_unfold", "folding_independence", "unknown"),
    criterion("carry_assistance.handle", "carry_assistance", "scoreable"),
    criterion("carry_assistance.strap", "carry_assistance", "unknown"),
  ];
}

function candidate(overrides = {}) {
  return {
    candidate_id: "fictional-candidate-a",
    scenario_id: "fictional-a-scenario",
    benchmark_segment: "fictional-a-segment",
    scenario_eligibility: "eligible",
    scenario_reason_codes: [],
    eligibility_unresolved_conflict_count: 0,
    partial_observed_score: 88,
    criteria: sparseCriteria(),
    ...overrides,
  };
}

function profile(assessment, profileId) {
  return assessment.profile_assessments.find((item) => item.profile_id === profileId);
}

test("proposed coverage contract and all three profiles validate", () => {
  assert.deepEqual(validateCoverageConfiguration(contract, profileSet), { result: "pass", issues: [] });
  assert.deepEqual(profileSet.profiles.map((item) => item.profile_id), ["lenient", "balanced", "strict"]);
  assert.equal(profileSet.profiles.every((item) => item.value_status === "proposed"), true);
});

test("one criterion can produce a partial observation but never a public total score", () => {
  const one = sparseCriteria().map((item, index) => ({ ...item, evidence_state: index === 2 ? "scoreable" : "unknown" }));
  const assessment = evaluateCandidateCoverage(candidate({ criteria: one, partial_observed_score: 100 }), contract, profileSet);
  assert.equal(assessment.partial_observed_score, 100);
  assert.equal(assessment.total_quality_score, null);
  assert.equal(assessment.total_quality_score_displayed, false);
  assert.equal(assessment.profile_assessments.every((item) => item.score_display_eligibility === false), true);
});

test("insufficient coverage is evidence insufficiency and not a low-quality score", () => {
  const one = sparseCriteria().map((item, index) => ({ ...item, evidence_state: index === 2 ? "scoreable" : "unknown" }));
  const assessment = evaluateCandidateCoverage(candidate({ criteria: one, partial_observed_score: 100 }), contract, profileSet);
  assert.equal(profile(assessment, "balanced").score_state, "eligible_but_insufficient_evidence");
  assert.equal(assessment.partial_observed_score, 100);
  assert.equal(assessment.total_quality_score, null);
});

test("scenario ineligibility stays null and never becomes zero or last place", () => {
  const assessment = evaluateCandidateCoverage(candidate({
    scenario_eligibility: "not_applicable",
    scenario_reason_codes: ["benchmark_segment_not_applicable"],
    partial_observed_score: null,
  }), contract, profileSet);
  assert.equal(assessment.metrics, null);
  assert.equal(assessment.partial_observed_score, null);
  assert.equal(profile(assessment, "balanced").score_state, "ineligible_for_scenario");
});

test("unresolved conflicts remain counted state and are never coerced to false or zero", () => {
  const conflicted = sparseCriteria();
  conflicted[0] = { ...conflicted[0], evidence_state: "unresolved_conflict", reason_codes: ["official_sources_disagree"] };
  const assessment = evaluateCandidateCoverage(candidate({
    criteria: conflicted,
    eligibility_unresolved_conflict_count: 1,
  }), contract, profileSet);
  assert.equal(assessment.metrics.unresolved_conflict_count, 2);
  assert.equal(profile(assessment, "balanced").score_state, "eligible_with_unresolved_conflict");
  assert.equal(profile(assessment, "balanced").gate_results.conflict_policy, false);
  assert.notEqual(assessment.metrics.unresolved_conflict_count, false);
});

test("unknown applicable criterion stays in denominator and out of numerator", () => {
  const metrics = calculateCoverageMetrics(sparseCriteria(), contract.parent_axes);
  assert.equal(metrics.criterion_coverage.applicable_criterion_count, 8);
  assert.equal(metrics.criterion_coverage.scoreable_criterion_count, 3);
  assert.equal(metrics.criterion_coverage.value, 0.375);
});

test("applicability exclusion is removed from both coverage sides and is not missing", () => {
  const criteria = sparseCriteria();
  criteria[7] = { ...criteria[7], applicability: "not_applicable", evidence_state: "unknown", reason_codes: ["scenario_exclusion"] };
  const metrics = calculateCoverageMetrics(criteria, contract.parent_axes);
  assert.equal(metrics.criterion_coverage.applicable_criterion_count, 7);
  assert.equal(metrics.criterion_coverage.scoreable_criterion_count, 3);
  assert.equal(metrics.criterion_coverage.value, 0.428571);
});

test("criterion coverage is deterministic regardless of input order", () => {
  const forward = calculateCoverageMetrics(sparseCriteria(), contract.parent_axes);
  const reverse = calculateCoverageMetrics([...sparseCriteria()].reverse(), contract.parent_axes);
  assert.deepEqual(forward.criterion_coverage, reverse.criterion_coverage);
});

test("parent-axis coverage is deterministic and a single criterion cannot complete an axis", () => {
  const criteria = sparseCriteria();
  criteria[1] = { ...criteria[1], applicability: "not_applicable", evidence_state: "unknown" };
  criteria[0] = { ...criteria[0], evidence_state: "scoreable" };
  const forward = calculateCoverageMetrics(criteria, contract.parent_axes);
  const reverse = calculateCoverageMetrics([...criteria].reverse(), [...contract.parent_axes].reverse());
  assert.deepEqual(forward.parent_axis_coverage, reverse.parent_axis_coverage);
  const transport = forward.parent_axis_coverage.axes.find((item) => item.parent_axis_id === "transport_burden");
  assert.equal(transport.applicable_criterion_count, 1);
  assert.equal(transport.state, "partially_scoreable");
  assert.equal(transport.coverage_ratio, 0.5);
  assert.ok(transport.reason_codes.includes("parent_definition_below_minimum_evidence_breadth"));
});

test("weighted coverage is deterministic and separate from count coverage", () => {
  const criteria = sparseCriteria().map((item, index) => ({ ...item, weight: index === 2 ? 0.5 : 0.5 / 7 }));
  const forward = calculateCoverageMetrics(criteria, contract.parent_axes);
  const reverse = calculateCoverageMetrics([...criteria].reverse(), contract.parent_axes);
  assert.equal(forward.criterion_coverage.value, 0.375);
  assert.equal(forward.weighted_coverage.value, 0.642857);
  assert.deepEqual(forward.weighted_coverage, reverse.weighted_coverage);
});

test("changing profiles never rewrites the partial observed score or coverage", () => {
  const assessment = evaluateCandidateCoverage(candidate(), contract, profileSet);
  assert.equal(assessment.partial_observed_score, 88);
  assert.equal(assessment.metrics.criterion_coverage.value, 0.375);
  assert.equal(new Set(assessment.profile_assessments.map(() => assessment.partial_observed_score)).size, 1);
});

test("profiles control display and ranking gates only", () => {
  const assessment = evaluateCandidateCoverage(candidate(), contract, profileSet);
  assert.equal(profile(assessment, "lenient").score_display_eligibility, true);
  assert.equal(profile(assessment, "balanced").score_display_eligibility, false);
  assert.equal(profile(assessment, "strict").score_display_eligibility, false);
  assert.equal(assessment.total_quality_score, null);
});

test("popularity and commerce inputs are prohibited and absent from coverage observations", () => {
  const prohibited = new Set(contract.prohibited_quality_inputs);
  for (const id of ["review_count", "external_ranking", "rakuten_ranking", "affiliate_rate", "market_demand_signal"]) {
    assert.equal(prohibited.has(id), true);
  }
  assert.equal(sparseCriteria().some((item) => prohibited.has(item.criterion_id)), false);
});

test("A-type and B-type segments cannot be finalized as one ranking cohort", () => {
  const assessment = evaluateCandidateCoverage(candidate(), contract, profileSet);
  const lenient = profile(assessment, "lenient");
  const result = finalizeScenarioRankingEligibility([
    { candidate_id: "a", scenario_id: "a-scenario", benchmark_segment: "a-type", profile_assessment: lenient },
    { candidate_id: "b", scenario_id: "b-scenario", benchmark_segment: "b-type", profile_assessment: lenient },
  ], profileSet.profiles.find((item) => item.profile_id === "lenient"));
  assert.equal(result.ranking_generation_eligible, false);
  assert.ok(result.reason_codes.includes("mixed_scenario_or_benchmark_segment"));
});

test("basket kg and L remain prohibited separate facts and never enter coverage", () => {
  assert.equal(contract.prohibited_quality_inputs.includes("basket_max_load_kg"), true);
  assert.equal(contract.prohibited_quality_inputs.includes("basket_volume_l"), true);
  assert.equal(sparseCriteria().some((item) => item.criterion_id.includes("basket")), false);
});

test("measurement-scope mismatch is not scoreable and remains a comparison blocker", () => {
  const criteria = sparseCriteria();
  criteria[0] = {
    ...criteria[0],
    evidence_state: "not_comparable",
    reason_codes: ["measurement_scope_mismatch"],
  };
  const assessment = evaluateCandidateCoverage(candidate({ criteria }), contract, profileSet);
  assert.equal(assessment.metrics.criterion_coverage.scoreable_criterion_count, 3);
  assert.ok(assessment.metrics.comparison_blockers.includes("transport_burden.body_weight:measurement_scope_mismatch"));
  assert.equal(profile(assessment, "lenient").ranking_candidate_eligibility, false);
});

test("all-applicable comparison blockers yield not_comparable rather than zero", () => {
  const criteria = sparseCriteria().map((item) => ({
    ...item,
    evidence_state: "not_comparable",
    reason_codes: ["measurement_scope_mismatch"],
  }));
  const assessment = evaluateCandidateCoverage(candidate({ criteria, partial_observed_score: null }), contract, profileSet);
  assert.equal(profile(assessment, "balanced").score_state, "not_comparable");
  assert.equal(assessment.partial_observed_score, null);
  assert.equal(assessment.total_quality_score, null);
});

test("analysis errors remain explicit and coverage is never replaced with zero", () => {
  const duplicate = sparseCriteria();
  duplicate.push({ ...duplicate[0] });
  const assessment = evaluateCandidateCoverage(candidate({ criteria: duplicate }), contract, profileSet);
  assert.equal(assessment.metrics, null);
  assert.ok(assessment.analysis_errors.some((item) => item.includes("duplicate criterion_id")));
  assert.equal(assessment.profile_assessments.every((item) => item.score_state === "analysis_error"), true);
});

test("one eligible product is insufficient for ranking generation", () => {
  const assessment = evaluateCandidateCoverage(candidate(), contract, profileSet);
  const lenientProfile = profileSet.profiles.find((item) => item.profile_id === "lenient");
  const result = finalizeScenarioRankingEligibility([
    {
      candidate_id: assessment.candidate_id,
      scenario_id: assessment.scenario_id,
      benchmark_segment: assessment.benchmark_segment,
      profile_assessment: profile(assessment, "lenient"),
    },
  ], lenientProfile);
  assert.equal(result.eligible_candidate_count, 1);
  assert.equal(result.ranking_generation_eligible, false);
  assert.ok(result.reason_codes.includes("insufficient_eligible_candidate_count"));
});

test("same input produces byte-equivalent deterministic assessment objects", () => {
  const first = evaluateCandidateCoverage(candidate(), contract, profileSet);
  const second = evaluateCandidateCoverage(structuredClone(candidate()), structuredClone(contract), structuredClone(profileSet));
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});
