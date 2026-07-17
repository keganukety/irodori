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
