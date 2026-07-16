import assert from "node:assert/strict";
import test from "node:test";

import { validateProductIdentity } from "../../../../shared/contracts/validators.ts";
import {
  calculateFictionalPoints,
  compareMeasurementScope,
  convertUnit,
  deriveIndicators,
  detectDoubleCounting,
  evaluateFictionalCandidate,
  evaluateScenarioEligibility,
  materializeFixtureCase,
  trainCommuteRubric,
  validateBasketSeparation,
  validateFixtureIsolation,
  validateNoRealScoringArtifacts,
  validateProposalBundle,
} from "../validate-rubric-proposal.mjs";

const clone = (value) => structuredClone(value);
const candidate = (caseId) => materializeFixtureCase(caseId).candidate;

test("scenario eligibility accepts a complete fictional primary stroller", () => {
  assert.equal(evaluateScenarioEligibility(candidate("eligible_primary_1m"), "primary_from_1_month").status, "eligible");
});

test("an age range that starts too late is ineligible", () => {
  assert.equal(evaluateScenarioEligibility(candidate("ineligible_primary_age"), "primary_from_1_month").status, "ineligible");
});

test("unknown target age remains unknown and on hold", () => {
  const eligibility = evaluateScenarioEligibility(candidate("unknown_target_age"), "primary_from_1_month");
  assert.equal(eligibility.status, "unknown");
  assert.equal(eligibility.disposition, "on_hold");
});

test("ineligible is not converted to zero points or last place", () => {
  const result = evaluateFictionalCandidate(candidate("ineligible_primary_age"), "primary_from_1_month");
  assert.equal(result.total_points, null);
  assert.equal(result.excluded_without_zero, true);
  assert.equal(result.rank_generated, false);
  assert.equal(Object.hasOwn(result, "rank"), false);
});

test("A-type and B-type use separate scenario age gates", () => {
  const bType = candidate("b_type_second_stroller");
  assert.equal(evaluateScenarioEligibility(bType, "primary_from_1_month").status, "ineligible");
  assert.equal(evaluateScenarioEligibility(bType, "second_stroller_from_7_months").status, "eligible");
});

test("basket kg and L conversion is rejected", () => {
  assert.equal(convertUnit(5, "kg", "L"), null);
  assert.equal(convertUnit(20, "L", "kg"), null);
});

test("basket mixed units remain separate and cannot form one capacity score", () => {
  const validation = validateBasketSeparation(candidate("eligible_primary_1m"));
  assert.equal(validation.result, "pass");
  assert.equal(validation.mass_kg, 5);
  assert.equal(validation.volume_l, 20);
  assert.equal(validation.single_score_allowed, false);
  assert.equal(validation.cross_unit_conversion, null);
});

test("weight measurement scope is required and validated", () => {
  const item = candidate("eligible_primary_1m");
  delete item.raw_facts.weight_measurement_scope;
  assert.equal(evaluateScenarioEligibility(item, "primary_from_1_month").status, "unknown");
});

test("different known weight scopes are partial rather than fully comparable", () => {
  assert.equal(compareMeasurementScope(candidate("eligible_primary_1m"), candidate("different_weight_scope")), "partial");
});

test("unspecified weight scope makes comparability unknown", () => {
  const item = candidate("eligible_primary_1m");
  item.raw_facts.weight_measurement_scope.value = "manufacturer_stated_unspecified";
  assert.equal(compareMeasurementScope(candidate("eligible_primary_1m"), item), "unknown");
});

test("unconfirmed one-hand fold remains unknown rather than false", () => {
  const item = candidate("eligible_primary_1m");
  item.raw_facts.one_hand_fold_explicit.value = null;
  item.raw_facts.one_hand_fold_explicit.evidence_status = "unconfirmed";
  assert.equal(deriveIndicators(item).verified_one_hand_operation, "unknown");
});

test("unconfirmed self-standing remains unknown rather than false", () => {
  const item = candidate("missing_optional_self_standing");
  assert.equal(deriveIndicators(item).verified_self_standing, "unknown");
});

function generationIdentity() {
  return {
    schema_version: "0.4.0", record_id: "pid-fictional-generation", created_at: "2026-07-17T00:00:00+09:00", updated_at: "2026-07-17T00:00:00+09:00",
    product_identity_id: "pid-fictional-generation", official_name: "架空ベビーカー 世代記号", brand_name: "架空ブランド", manufacturer_name: null,
    model_number: null, model_year: null, generation_code: "GX", market: "JP", lifecycle_status: "current", predecessor_of: null, successor_of: null,
    variant_of: null, variant_axis: null, category: "ベビーカー", official_url: "https://example.invalid/fictional-strollers/generation",
    identification_status: "provisional", identification_evidence: [], unconfirmed_fields: ["model_number", "model_year"], site_product_id: null,
    site_product_match_status: "unverified", variants: []
  };
}

test("generation_code is not promoted to model_year", () => {
  const identity = generationIdentity();
  assert.equal(validateProductIdentity(identity).result, "pass");
  assert.equal(identity.model_year, null);
  assert.equal(identity.generation_code, "GX");
});

test("generation_code is not promoted to model_number", () => {
  const identity = generationIdentity();
  assert.equal(validateProductIdentity(identity).result, "pass");
  assert.equal(identity.model_number, null);
  assert.equal(identity.generation_code, "GX");
});

test("manufacturer claim is not promoted to an objective scoring fact", () => {
  const item = candidate("eligible_primary_1m");
  assert.equal(item.raw_facts.manufacturer_maneuverability_claim.claim_class, "manufacturer_claim");
  assert.equal(deriveIndicators(item).maneuverability_evidence.manufacturer_claim_excluded, true);
});

test("maneuverability cannot be scored from an official promotional claim alone", () => {
  const result = evaluateFictionalCandidate(candidate("eligible_primary_1m"), "primary_from_1_month");
  assert.ok(result.excluded_inputs.includes("manufacturer_maneuverability_claim"));
  assert.equal(Object.hasOwn(result.component_points, "maneuverability"), false);
});

test("double counting is detected for a repeated raw fact", () => {
  const rubric = clone(trainCommuteRubric);
  rubric.scoring_rules.raw_fact_allocations.push({
    raw_fact_id: "body_weight_kg", derived_indicator_id: "duplicate_weight", scene_axis_id: "station_space_fit",
    contribution_group: "duplicate", maximum_points: 5, max_contribution_count: 1
  });
  const validation = detectDoubleCounting(rubric);
  assert.equal(validation.result, "fail");
  assert.equal(validation.violations[0].raw_fact_id, "body_weight_kg");
});

test("missing a required axis produces on_hold", () => {
  const result = evaluateFictionalCandidate(candidate("missing_required_fold_dimension"), "primary_from_1_month");
  assert.equal(result.calculation_status, "on_hold");
  assert.equal(result.total_points, null);
});

test("missing an optional axis does not immediately disqualify", () => {
  const result = evaluateFictionalCandidate(candidate("missing_optional_self_standing"), "primary_from_1_month");
  assert.equal(result.eligibility.status, "eligible");
  assert.equal(result.calculation_status, "calculated_partial");
  assert.ok(result.missing_optional_axes.includes("self_standing_explicit"));
});

test("a required conflict produces unknown and on_hold", () => {
  const result = evaluateFictionalCandidate(candidate("required_conflict"), "primary_from_1_month");
  assert.equal(result.eligibility.status, "unknown");
  assert.equal(result.calculation_status, "on_hold");
});

test("an optional conflict excludes only that optional component", () => {
  const item = candidate("eligible_primary_1m");
  item.raw_facts.self_standing_explicit.value = null;
  item.raw_facts.self_standing_explicit.evidence_status = "conflicting";
  item.raw_facts.self_standing_explicit.conflict = true;
  const result = evaluateFictionalCandidate(item, "primary_from_1_month");
  assert.equal(result.eligibility.status, "eligible");
  assert.equal(result.calculation_status, "calculated_partial");
  assert.equal(result.component_points.self_standing, null);
});

test("rubric status and every scenario status remain proposed", () => {
  assert.equal(trainCommuteRubric.status, "proposed");
  assert.equal(trainCommuteRubric.human_approval_required, true);
});

test("real five-product runs contain no score or ranking artifacts", () => {
  const validation = validateNoRealScoringArtifacts();
  assert.equal(validation.result, "pass", JSON.stringify(validation.issues));
  assert.ok(validation.inspected_file_count > 5);
});

test("folded bounding box is explicitly not actual occupied volume", () => {
  const derived = deriveIndicators(candidate("eligible_primary_1m"));
  assert.equal(derived.folded_bounding_box_volume_l.value, 96);
  assert.equal(derived.folded_bounding_box_volume_l.is_actual_occupied_volume, false);
  assert.match(derived.folded_bounding_box_volume_l.label, /bounding-box/);
});

test("fictional boundary calculations are deterministic", () => {
  const item = candidate("eligible_primary_1m");
  assert.deepEqual(calculateFictionalPoints(item), calculateFictionalPoints(clone(item)));
  assert.equal(calculateFictionalPoints(item).total_points, 97);
});

test("fixtures use only fictional names and example.invalid", () => {
  assert.equal(validateFixtureIsolation().result, "pass");
});

test("the complete proposal bundle passes runtime validation", () => {
  const report = validateProposalBundle();
  assert.equal(report.result, "pass", JSON.stringify(report.checks, null, 2));
});
