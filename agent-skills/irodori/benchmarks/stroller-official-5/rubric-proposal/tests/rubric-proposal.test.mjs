import assert from "node:assert/strict";
import test from "node:test";

import { validateProductIdentity } from "../../../../shared/contracts/validators.ts";
import {
  axisClassification,
  compareMeasurementScope,
  convertUnit,
  deriveIndicators,
  detectDoubleCounting,
  evaluateApproximateBoundary,
  evaluateFictionalCandidate,
  evaluateScenarioEligibility,
  materializeFixtureCase,
  normalizationRules,
  scenarioEligibility,
  trainCommuteRubric,
  validateBasketSeparation,
  validateFixtureIsolation,
  validateFoldStepObservation,
  validateNoHighConfidenceSecrets,
  validateNoRealScoringArtifacts,
  validateProposalBundle,
} from "../validate-rubric-proposal.mjs";

const clone = (value) => structuredClone(value);
const candidate = (caseId = "eligible_primary_1m") => materializeFixtureCase(caseId).candidate;

test("primary_from_1_month accepts a complete candidate", () => {
  assert.equal(evaluateScenarioEligibility(candidate(), "primary_from_1_month").status, "eligible");
});

test("primary_from_6_months accepts a product starting by six months", () => {
  assert.equal(evaluateScenarioEligibility(candidate(), "primary_from_6_months").status, "eligible");
});

test("second_stroller_from_7_months does not require parent-facing", () => {
  assert.equal(evaluateScenarioEligibility(candidate("b_type_second_stroller"), "second_stroller_from_7_months").status, "eligible");
});

test("compact_travel_from_7_months accepts confirmed folded dimensions and weight", () => {
  assert.equal(evaluateScenarioEligibility(candidate(), "compact_travel_from_7_months").status, "eligible");
});

test("a start age above the scenario limit is ineligible", () => {
  assert.equal(evaluateScenarioEligibility(candidate("ineligible_primary_age"), "primary_from_1_month").status, "ineligible");
});

test("confirmed 15kg upper coverage can substitute for unknown end month", () => {
  assert.equal(evaluateScenarioEligibility(candidate("weight_covers_unknown_end_age"), "primary_from_6_months").status, "eligible");
});

test("unknown required age evidence remains unknown and on hold", () => {
  const result = evaluateScenarioEligibility(candidate("unknown_target_age"), "primary_from_1_month");
  assert.equal(result.status, "unknown");
  assert.equal(result.participation_status, "on_hold");
});

test("missing compact folded dimension remains unknown and on hold", () => {
  const result = evaluateScenarioEligibility(candidate("compact_missing_fold_dimension"), "compact_travel_from_7_months");
  assert.equal(result.status, "unknown");
  assert.ok(result.missing_required_inputs.includes("folded_depth_mm"));
});

test("a required conflict remains unknown", () => {
  assert.equal(evaluateScenarioEligibility(candidate("required_age_conflict"), "primary_from_1_month").status, "unknown");
});

test("ineligible output has neither zero points nor rank", () => {
  const result = evaluateFictionalCandidate(candidate("ineligible_primary_age"), "primary_from_1_month");
  assert.equal(result.excluded_without_zero_or_last_place, true);
  for (const key of ["score", "total_points", "rank", "ordinal_score"]) assert.equal(Object.hasOwn(result, key), false);
});

test("basket kg and L conversion is rejected", () => {
  assert.equal(convertUnit(5, "kg", "L"), null);
  assert.equal(convertUnit(20, "L", "kg"), null);
});

test("basket mass and volume remain separate", () => {
  const result = validateBasketSeparation(candidate());
  assert.equal(result.result, "pass");
  assert.equal(result.mass_kg, 5);
  assert.equal(result.volume_l, 20);
  assert.equal(result.single_score_allowed, false);
});

test("same known weight scope and condition are fully comparable", () => {
  assert.equal(compareMeasurementScope(candidate(), clone(candidate())), "full");
});

test("different known non-opposed weight scopes are partial", () => {
  assert.equal(compareMeasurementScope(candidate(), candidate("different_weight_scope")), "partial");
});

test("two manufacturer-stated unspecified scopes are partial", () => {
  const a = candidate();
  const b = candidate();
  a.raw_facts.measurement_scope.value = "manufacturer_stated_unspecified";
  b.raw_facts.measurement_scope.value = "manufacturer_stated_unspecified";
  assert.equal(compareMeasurementScope(a, b), "partial");
});

test("known scope versus unspecified scope is unknown", () => {
  const item = candidate();
  item.raw_facts.measurement_scope.value = "manufacturer_stated_unspecified";
  assert.equal(compareMeasurementScope(candidate(), item), "unknown");
});

test("included accessories versus excluded accessories is not comparable", () => {
  const included = candidate();
  const excluded = candidate();
  included.raw_facts.measurement_scope.value = "including_standard_accessories";
  excluded.raw_facts.measurement_scope.value = "excluding_accessories";
  assert.equal(compareMeasurementScope(included, excluded), "not_comparable");
});

test("lightest configuration versus standard configuration is not comparable", () => {
  const lightest = candidate();
  lightest.raw_facts.weight_configuration.value = "lightest";
  assert.equal(compareMeasurementScope(lightest, candidate()), "not_comparable");
});

test("approximate weight keeps same-scope comparison partial", () => {
  const approximate = candidate();
  approximate.raw_facts.approximation_status.value = "approximate";
  assert.equal(compareMeasurementScope(approximate, candidate()), "partial");
});

test("unconfirmed one-hand operations remain unknown rather than false", () => {
  assert.equal(deriveIndicators(candidate("unknown_fold_booleans")).verified_one_hand_operation, "unknown");
});

test("unconfirmed self-standing remains unknown rather than false", () => {
  assert.equal(deriveIndicators(candidate("missing_optional_self_standing")).verified_self_standing, "unknown");
});

test("folded bounding-box volume is a reference, not occupied volume", () => {
  const result = deriveIndicators(candidate()).folded_bounding_box_volume_l;
  assert.equal(result.value, 96);
  assert.equal(result.is_actual_occupied_volume, false);
  assert.match(result.label, /bounding-box/);
});

test("folded floor footprint requires the confirmed standing base", () => {
  assert.equal(deriveIndicators(candidate()).folded_floor_footprint_cm2.value, 1600);
});

test("approximate values crossing a boundary return adjacent bands", () => {
  const result = evaluateApproximateBoundary(5, [4, 5, 6, 7], "approximate");
  assert.equal(result.status, "boundary_hold_adjacent_bands");
  assert.deepEqual(result.candidate_band_indexes, [1, 2]);
});

test("exact values use one candidate band", () => {
  assert.deepEqual(evaluateApproximateBoundary(5, [4, 5, 6, 7], "exact").candidate_band_indexes, [1]);
});

test("the plus-minus five percent interval is not called error or tolerance", () => {
  const result = evaluateApproximateBoundary(5, [4, 5, 6, 7], "approximate");
  assert.equal(result.interval_is_measurement_error_or_tolerance, false);
  assert.equal(result.permanent_rule, false);
});

test("confirmed positive integer fold step is valid", () => {
  assert.equal(validateFoldStepObservation(candidate()).result, "pass");
});

test("four or more fold steps share the proposed 4_or_more band", () => {
  const item = candidate();
  item.raw_facts.fold_step_count.value = 5;
  assert.equal(validateFoldStepObservation(item).fold_step_band, "4_or_more");
});

test("unclear fold step remains null and unconfirmed", () => {
  const item = candidate();
  item.raw_facts.fold_step_count.value = null;
  item.raw_facts.fold_step_count.evidence_status = "unconfirmed";
  const result = validateFoldStepObservation(item);
  assert.equal(result.result, "pass");
  assert.equal(result.fold_step_count, null);
});

test("negative fold step is rejected", () => {
  const item = candidate();
  item.raw_facts.fold_step_count.value = -1;
  assert.equal(validateFoldStepObservation(item).result, "fail");
});

function generationIdentity() {
  return {
    schema_version: "0.4.0", record_id: "pid-fictional-generation", created_at: "2026-07-17T00:00:00+09:00", updated_at: "2026-07-17T00:00:00+09:00",
    product_identity_id: "pid-fictional-generation", official_name: "架空ベビーカー GX", brand_name: "架空ブランド", manufacturer_name: null,
    model_number: null, model_year: null, generation_code: "GX", market: "JP", lifecycle_status: "current", predecessor_of: null, successor_of: null,
    variant_of: null, variant_axis: null, category: "ベビーカー", official_url: "https://example.invalid/fictional-strollers/generation",
    identification_status: "provisional", identification_evidence: [], unconfirmed_fields: ["model_number", "model_year"], site_product_id: null,
    site_product_match_status: "unverified", variants: [],
  };
}

test("generation_code remains separate from model_year and model_number", () => {
  const identity = generationIdentity();
  assert.equal(validateProductIdentity(identity).result, "pass");
  assert.equal(identity.model_year, null);
  assert.equal(identity.model_number, null);
  assert.equal(identity.generation_code, "GX");
});

test("manufacturer maneuverability claim remains excluded and unscored", () => {
  const result = deriveIndicators(candidate()).maneuverability_evidence;
  assert.equal(result.manufacturer_claim_excluded, true);
  assert.equal(result.status, "unscored");
});

test("eligible fictional evaluation remains descriptive without point allocation", () => {
  const result = evaluateFictionalCandidate(candidate(), "primary_from_1_month");
  assert.equal(result.evaluation_status, "descriptive_axes_only");
  assert.equal(result.point_allocation_applied, false);
  assert.equal(Object.hasOwn(result, "score"), false);
  assert.equal(Object.hasOwn(result, "total_points"), false);
});

test("the current contribution contract has no double counting", () => {
  assert.equal(detectDoubleCounting().result, "pass");
});

test("body weight assigned to a second axis is detected", () => {
  const rubric = clone(trainCommuteRubric);
  rubric.raw_fact_contribution_contract.push({
    raw_fact_id: "body_weight_kg", positive_contribution_axis: "station_space_fit", maximum_positive_contribution_axes: 1,
  });
  assert.equal(detectDoubleCounting(rubric).result, "fail");
});

test("semantic aliases must share one contribution group", () => {
  const rubric = clone(trainCommuteRubric);
  rubric.raw_fact_contribution_contract.find((item) => item.raw_fact_id === "fold_with_seat_attached").contribution_group = "duplicate_group";
  assert.equal(detectDoubleCounting(rubric).result, "fail");
});

test("an optional missing subaxis lowers coverage without disqualification", () => {
  const result = evaluateFictionalCandidate(candidate("missing_optional_self_standing"), "primary_from_1_month");
  assert.equal(result.eligibility.status, "eligible");
  assert.equal(result.parent_axis_coverage.folding_independence.status, "available_partial");
});

test("a parent axis with every optional subaxis missing becomes unavailable", () => {
  const item = candidate();
  for (const key of ["carry_handle", "carry_strap", "carrying_position"]) {
    item.raw_facts[key].value = null;
    item.raw_facts[key].evidence_status = "unconfirmed";
  }
  const result = evaluateFictionalCandidate(item, "primary_from_1_month");
  assert.equal(result.parent_axis_coverage.carry_assistance.status, "unavailable");
});

test("all four subjective axes have the required final classification", () => {
  const actual = Object.fromEntries(axisClassification.subjective_axis_classification.map((item) => [item.axis_id, item.classification]));
  assert.deepEqual(actual, {
    portability: "split_into_subaxes",
    train_fitness: "editorial_composite_output",
    maneuverability: "requires_third_party_measurement",
    one_operator_fitness: "editorial_composite_output",
  });
});

test("all four scenario windows are proposed and provisionally approved", () => {
  assert.equal(scenarioEligibility.scenarios.length, 4);
  assert.ok(scenarioEligibility.scenarios.every((item) => item.status === "proposed" && item.human_approval_status === "provisional_approved"));
});

test("all four boundary grids match the human decision", () => {
  assert.deepEqual(trainCommuteRubric.boundary_grid.find((item) => item.boundary_id === "body_weight_kg").candidate_values, [4,5,6,7]);
  assert.deepEqual(trainCommuteRubric.boundary_grid.find((item) => item.boundary_id === "unfolded_width_mm").candidate_values, [460,480,500,530]);
  assert.deepEqual(trainCommuteRubric.boundary_grid.find((item) => item.boundary_id === "folded_floor_footprint_cm2").candidate_values, [800,1200,1600,2200]);
  assert.deepEqual(trainCommuteRubric.boundary_grid.find((item) => item.boundary_id === "fold_step_count").candidate_values, [1,2,3,{minimum:4,label:"4_or_more"}]);
});

test("approximate rule remains proposed and non-permanent", () => {
  assert.equal(normalizationRules.approximate_boundary_rule.provisional_hold_percent, 5);
  assert.equal(normalizationRules.approximate_boundary_rule.permanent_rule, false);
});

test("compact travel never infers airline carry-on eligibility", () => {
  const scenario = scenarioEligibility.scenarios.find((item) => item.scenario_id === "compact_travel_from_7_months");
  assert.equal(scenario.airline_carry_on_inference_allowed, false);
  assert.equal(scenario.airline_specific_rule_check_required, true);
});

test("real five-product artifacts contain no score or ranking outputs", () => {
  const result = validateNoRealScoringArtifacts();
  assert.equal(result.result, "pass", JSON.stringify(result.issues));
  assert.ok(result.inspected_file_count > 5);
});

test("proposal-wide high-confidence secret scan passes", () => {
  assert.equal(validateNoHighConfidenceSecrets().result, "pass");
});

test("fixtures use only fictional names and example.invalid", () => {
  assert.equal(validateFixtureIsolation().result, "pass");
});

test("the complete proposal bundle passes runtime validation", () => {
  const report = validateProposalBundle();
  assert.equal(report.result, "pass", JSON.stringify(report.checks, null, 2));
});
