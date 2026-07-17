import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { detectDoubleCounting, convertUnit } from "../../../../benchmarks/stroller-official-5/rubric-proposal/validate-rubric-proposal.mjs";
import { buildSnapshot } from "../build-input-snapshot.mjs";
import { buildAnalysis, buildDefinition, verifySnapshot } from "../run-sensitivity-analysis.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const analysisRoot = join(here, "..");
const config = JSON.parse(readFileSync(join(analysisRoot, "analysis-config.json"), "utf8"));
const snapshot = JSON.parse(readFileSync(join(analysisRoot, "input-snapshot.json"), "utf8"));
const committedResult = JSON.parse(readFileSync(join(analysisRoot, "analysis-result.json"), "utf8"));
const rubric = JSON.parse(readFileSync(join(analysisRoot, "../../../benchmarks/stroller-official-5/rubric-proposal/train-commute-rubric-proposal.json"), "utf8"));

function baseline(analysis, scenario) {
  return analysis.pattern_results.find((item) => item.scenario === scenario && item.pattern_id === "baseline");
}

function coverageResult(analysis, scenario, productAnalysisId) {
  return analysis.coverage_analysis.results.find((item) =>
    item.scenario_id === scenario && item.product_analysis_id === productAnalysisId);
}

test("the frozen snapshot is reproducible from the official benchmark artifacts", () => {
  assert.deepEqual(buildSnapshot(), snapshot);
  assert.equal(verifySnapshot(snapshot).result, "pass");
});

test("the complete private analysis is deterministic and matches the committed result", () => {
  const first = buildAnalysis();
  const second = buildAnalysis();
  assert.deepEqual(first, second);
  assert.deepEqual(first, committedResult);
});

test("A-type and B-type scenario candidate sets are disjoint", () => {
  const a = baseline(committedResult, "a_type_primary_strict_scope");
  const b = baseline(committedResult, "b_type_compact_strict_scope");
  const aEligible = new Set(a.eligibility.filter((item) => item.eligibility === "eligible").map((item) => item.product_analysis_id));
  const bEligible = new Set(b.eligibility.filter((item) => item.eligibility === "eligible").map((item) => item.product_analysis_id));
  assert.equal([...aEligible].some((id) => bEligible.has(id)), false);
  assert.equal(a.eligibility.find((item) => item.product_analysis_id === "P05").eligibility, "not_applicable");
  assert.equal(b.eligibility.filter((item) => item.product_analysis_id !== "P05").every((item) => item.eligibility === "not_applicable"), true);
});

test("eligibility unknown remains on hold and never becomes score zero or last place", () => {
  const a = baseline(committedResult, "a_type_primary_strict_scope");
  const unknown = a.eligibility.find((item) => item.product_analysis_id === "P01");
  assert.equal(unknown.eligibility, "unknown");
  assert.equal(unknown.participation_status, "on_hold");
  assert.equal(a.entries.some((entry) => entry.product_analysis_id === "P01"), false);
  const hold = a.on_hold.find((entry) => entry.product_analysis_id === "P01");
  assert.equal(hold.quality_interpretation, "not_low_quality");
  assert.equal("total_score" in hold, false);
});

test("unknown booleans remain null and are not coerced to false or zero", () => {
  const p02 = snapshot.products.find((product) => product.analysis_product_id === "P02");
  const p04 = snapshot.products.find((product) => product.analysis_product_id === "P04");
  assert.equal(p02.raw_facts.one_hand_fold_explicit.value, null);
  assert.equal(p02.raw_facts.one_hand_fold_explicit.evidence_status, "unconfirmed");
  assert.equal(p04.raw_facts.self_standing_explicit.value, null);
  assert.equal(p04.raw_facts.self_standing_explicit.evidence_status, "unconfirmed");
});

test("only analysis-derived inferences backed by confirmed raw facts are scoreable", () => {
  for (const pattern of committedResult.pattern_results) {
    for (const entry of pattern.entries) {
      const product = snapshot.products.find((item) => item.analysis_product_id === entry.product_analysis_id);
      for (const criterion of entry.criterion_scores) {
        const raw = product.raw_facts[criterion.raw_fact_id];
        assert.equal(raw.evidence_status, "confirmed");
        assert.equal(raw.conflict, false);
        assert.notEqual(raw.value, null);
        assert.ok(criterion.derived_inference_claim_ids.every((id) => id.startsWith("clm-private-")));
        assert.deepEqual(criterion.raw_evidence_claim_ids, raw.evidence_claim_ids);
      }
    }
  }
  assert.equal(committedResult.safeguards.unconfirmed_scoring_limited_to_analysis_derived_features_from_confirmed_raw, true);
});

test("basket kg and L stay separate and never enter the quality criteria", () => {
  const kgFacts = snapshot.products.filter((product) => product.raw_facts.basket_max_load_kg.value !== null);
  const litreFacts = snapshot.products.filter((product) => product.raw_facts.basket_volume_l.value !== null);
  assert.ok(kgFacts.length > 0);
  assert.ok(litreFacts.length > 0);
  assert.equal(convertUnit(5, "kg", "L"), null);
  assert.equal(convertUnit(25, "L", "kg"), null);
  assert.equal(config.criteria.some((criterion) => criterion.raw_fact_id.startsWith("basket_")), false);
});

test("measurement scope blocks weight in the mixed A-type scenario", () => {
  const strict = baseline(committedResult, "a_type_primary_strict_scope");
  assert.equal(strict.entries.every((entry) => entry.criterion_scores.every((item) => item.criterion_id !== "transport_burden.body_weight")), true);
  assert.equal(strict.entries.every((entry) => entry.missing_criteria.some((item) => item.criterion_id === "transport_burden.body_weight" && item.reason === "measurement_scope_not_comparable_in_scenario")), true);

  const cohort = baseline(committedResult, "a_type_excluding_accessories_scope_diagnostic");
  assert.equal(cohort.entries.length, 2);
  assert.equal(cohort.entries.every((entry) => entry.criterion_scores.some((item) => item.criterion_id === "transport_burden.body_weight")), true);
  const cohortIds = new Set(cohort.entries.map((entry) => entry.product_analysis_id));
  assert.deepEqual([...cohortIds].sort(), ["P03", "P04"]);
});

test("folded footprint is not derived without confirmed standing orientation", () => {
  for (const product of snapshot.products) {
    assert.equal(product.raw_facts.folded_dimension_orientation.value, null);
    assert.equal(product.raw_facts.folded_floor_footprint_cm2.value, null);
    assert.equal(product.raw_facts.folded_floor_footprint_cm2.unavailable_reason, "standing_base_orientation_not_confirmed");
  }
  assert.equal(committedResult.pattern_results.every((pattern) => pattern.entries.every((entry) =>
    entry.criterion_scores.every((item) => item.criterion_id !== "station_space_fit.folded_floor_footprint"))), true);
});

test("maneuverability, popularity, reviews, external rank, and commercial signals are not score inputs", () => {
  const criterionText = JSON.stringify(config.criteria);
  for (const prohibited of config.prohibited_quality_inputs) {
    assert.equal(criterionText.includes(`\"raw_fact_id\":\"${prohibited}\"`), false, prohibited);
  }
  assert.equal(committedResult.safeguards.maneuverability_scored, false);
  assert.equal(committedResult.safeguards.external_or_popularity_signal_scored, false);
});

test("parent weight variation changes weights only and keeps total weight one", () => {
  const scenario = config.analysis_scenarios[0];
  const baselineDefinition = buildDefinition(config, rubric, scenario, { pattern_id: "baseline" });
  const variedDefinition = buildDefinition(config, rubric, scenario, {
    pattern_id: "weight-test",
    weight_parent: "station_space_fit",
    direction: "increase",
    delta: 0.05,
  });
  const total = variedDefinition.axis_weights.reduce((sum, axis) => sum + axis.weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  assert.deepEqual(
    variedDefinition.axis_weights.map((axis) => [axis.axis_id, axis.scoring_rule]),
    baselineDefinition.axis_weights.map((axis) => [axis.axis_id, axis.scoring_rule]),
  );
  assert.notDeepEqual(
    variedDefinition.axis_weights.map((axis) => axis.weight),
    baselineDefinition.axis_weights.map((axis) => axis.weight),
  );
});

test("coverage thresholds create on-hold states, never low-quality scores", () => {
  const coveragePatterns = committedResult.pattern_results.filter((pattern) => pattern.pattern_kind === "coverage");
  assert.ok(coveragePatterns.length > 0);
  for (const pattern of coveragePatterns) {
    assert.equal(pattern.entries.length, 0);
    assert.ok(pattern.on_hold.length > 0);
    assert.equal(pattern.on_hold.every((item) => item.quality_interpretation === "not_low_quality"), true);
    assert.equal(pattern.on_hold.every((item) => !("total_score" in item)), true);
  }
});

test("double-counting controls and raw/derived/editorial layers remain explicit", () => {
  assert.equal(detectDoubleCounting().result, "pass");
  const rawFacts = config.criteria.map((criterion) => criterion.raw_fact_id);
  assert.equal(new Set(rawFacts).size, rawFacts.length);
  assert.deepEqual(Object.keys(snapshot.layer_contract), ["raw", "derived", "editorial", "editorial_composite_output"]);
  assert.equal(config.criteria.some((criterion) => ["train_fitness", "one_operator_fitness"].includes(criterion.raw_fact_id)), false);
});

test("strict pair inversions are separated from ties and incomparability", () => {
  assert.equal(committedResult.stability_summary.reduce((sum, item) => sum + item.total_reversals, 0), 0);
  assert.equal(committedResult.stability_summary.reduce((sum, item) => sum + item.total_tie_transitions, 0), 2);
  assert.ok(committedResult.stability_summary.reduce((sum, item) => sum + item.total_incomparable_transitions, 0) > 0);
});

test("all outputs remain draft private trials and source values are not rewritten", () => {
  assert.equal(committedResult.private_non_public, true);
  assert.equal(committedResult.publication_status, "draft");
  assert.equal(committedResult.status, "proposed_analysis_only");
  assert.equal(committedResult.safeguards.source_values_rewritten, false);
  assert.equal(committedResult.pattern_results.every((pattern) => pattern.calculation_status !== "published"), true);
});

test("coverage contract separates criterion, parent-axis, and weighted coverage", () => {
  const p03 = coverageResult(committedResult, "a_type_excluding_accessories_scope_diagnostic", "P03");
  assert.equal(p03.criterion_coverage.value, 0.214286);
  assert.equal(p03.parent_axis_coverage.value, 0.28125);
  assert.equal(p03.weighted_coverage.value, 0.40625);
  assert.equal(p03.represented_parent_count, 3);
  assert.notEqual(p03.criterion_coverage.value, p03.parent_axis_coverage.value);
  assert.notEqual(p03.parent_axis_coverage.value, p03.weighted_coverage.value);
});

test("the one-criterion 100-point trial is only a partial observed score", () => {
  const p02 = coverageResult(committedResult, "a_type_primary_strict_scope", "P02");
  assert.equal(p02.criterion_coverage.scoreable_criterion_count, 1);
  assert.equal(p02.partial_observed_score, 100);
  assert.equal(p02.total_quality_score, null);
  assert.equal(p02.total_quality_score_displayed, false);
  assert.equal(p02.profile_assessments.every((item) => item.score_display_eligibility === false), true);
  assert.equal(committedResult.pattern_results.every((pattern) => pattern.entries.every((entry) =>
    "partial_observed_score" in entry && !("total_score" in entry))), true);
});

test("balanced reference profile changes trial_scored to insufficient evidence, not low quality", () => {
  for (const id of ["P02", "P03", "P04"]) {
    const item = coverageResult(committedResult, "a_type_primary_strict_scope", id);
    assert.equal(item.baseline_state_change.from, "trial_scored");
    assert.equal(item.baseline_state_change.to, "eligible_but_insufficient_evidence");
    assert.equal(item.score_state, "eligible_but_insufficient_evidence");
  }
});

test("eligibility conflicts and scenario incompatibility remain distinct states", () => {
  const conflict = coverageResult(committedResult, "a_type_primary_strict_scope", "P01");
  const incompatible = coverageResult(committedResult, "a_type_primary_strict_scope", "P05");
  assert.equal(conflict.unresolved_conflict_count, 2);
  assert.equal(conflict.score_state, "eligible_with_unresolved_conflict");
  assert.equal(incompatible.unresolved_conflict_count, 0);
  assert.equal(incompatible.score_state, "ineligible_for_scenario");
  assert.equal(incompatible.partial_observed_score, null);
});

test("proposed profile differences affect eligibility but never generate rankings or totals", () => {
  const p03 = coverageResult(committedResult, "a_type_excluding_accessories_scope_diagnostic", "P03");
  const lenient = p03.profile_assessments.find((item) => item.profile_id === "lenient");
  const balanced = p03.profile_assessments.find((item) => item.profile_id === "balanced");
  const strict = p03.profile_assessments.find((item) => item.profile_id === "strict");
  assert.equal(lenient.score_display_eligibility, true);
  assert.equal(lenient.ranking_eligibility, true);
  assert.equal(balanced.score_display_eligibility, false);
  assert.equal(strict.score_display_eligibility, false);
  assert.equal(p03.total_quality_score, null);
  assert.equal(committedResult.coverage_analysis.ranking_generated, false);
  assert.equal(committedResult.coverage_analysis.total_quality_scores_generated, false);
});

test("single-product B scenario never becomes ranking eligible", () => {
  const p05 = coverageResult(committedResult, "b_type_compact_strict_scope", "P05");
  assert.equal(p05.ranking_eligibility, false);
  const summaries = committedResult.coverage_analysis.scenario_profile_summary.filter((item) =>
    item.scenario_id === "b_type_compact_strict_scope");
  assert.equal(summaries.every((item) => item.ranking_generation_eligible === false), true);
  assert.equal(summaries.every((item) => item.ranking_generated === false), true);
});

test("measurement-scope mismatch stays a named non-comparable criterion reason", () => {
  const p03 = coverageResult(committedResult, "a_type_primary_strict_scope", "P03");
  const weight = p03.criterion_observations.find((item) => item.criterion_id === "transport_burden.body_weight");
  assert.equal(weight.evidence_state, "not_comparable");
  assert.deepEqual(weight.reason_codes, ["measurement_scope_not_comparable_in_scenario"]);
  assert.ok(p03.comparison_blockers.includes("transport_burden.body_weight:measurement_scope_not_comparable_in_scenario"));
});

test("coverage result keeps all profiles proposed and all publication safeguards closed", () => {
  assert.equal(committedResult.coverage_contract.status, "proposed");
  assert.equal(committedResult.coverage_contract.publication_status, "draft");
  assert.equal(committedResult.safeguards.coverage_profiles_remain_proposed, true);
  assert.equal(committedResult.safeguards.partial_score_public_total_separated, true);
  assert.equal(committedResult.safeguards.score_display_eligibility_separate, true);
  assert.equal(committedResult.safeguards.ranking_eligibility_separate, true);
  assert.equal(committedResult.safeguards.total_quality_scores_generated, false);
  assert.equal(committedResult.safeguards.rankings_generated_by_coverage_contract, false);
});
