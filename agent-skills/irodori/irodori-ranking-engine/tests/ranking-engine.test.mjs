import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeSensitivity,
  calculateCandidateMetrics,
  calculateObservedScore,
  calculateRankingResult,
  computeInputHash,
  normalizeNumericValue,
  validateRankingInput,
} from "../scripts/ranking-engine.ts";
import {
  fictionalEvidenceClaims,
  fictionalNormalizedFeatures,
  fictionalProductIdentities,
  fictionalRankingBundle,
  fictionalRankingInput,
  fictionalReviewReport,
  fictionalReviewThemeSummaries,
  fictionalRunManifest,
  fictionalSourceRecords,
  isolatedOldMarketFeatureId,
  trainCommuteProposedDefinition,
} from "../fixtures/fictional-train-commute.ts";
import {
  validateEvidenceClaim,
  validateNormalizedFeature,
  validateProductIdentity,
  validateRankingDefinition,
  validateRankingInput as validateRankingInputContract,
  validateRankingResult,
  validateReviewReport,
  validateReviewThemeSummary,
  validateRunManifest,
  validateSourceRecord,
  canonicalizeAxisId,
} from "../../shared/contracts/validators.ts";

const A = "pid-fictional-trainlight-a";
const B = "pid-fictional-railrunner-b";
const C = "pid-fictional-datamist-c";
const D = "pid-fictional-conflict-d";
const E = "pid-fictional-twinscore-e";

function clone(value) {
  return structuredClone(value);
}

function entry(result, productId) {
  const found = result.entries.find((candidate) => candidate.product_identity_id === productId);
  assert.ok(found, "expected ranked entry for " + productId);
  return found;
}

function metricsFor(bundle, productId) {
  const candidate = bundle.input.candidates.find((item) => item.product_identity_id === productId);
  assert.ok(candidate, "expected candidate for " + productId);
  return calculateCandidateMetrics(
    bundle.definition,
    candidate.feature_refs,
    bundle.normalized_features,
    bundle.evidence_claims,
    bundle.source_records,
  );
}

test("all original ten contract validators accept the fictional contract set and generated result", () => {
  assert.equal(validateRunManifest(fictionalRunManifest).result, "pass");
  for (const product of fictionalProductIdentities) {
    assert.equal(validateProductIdentity(product).result, "pass");
  }
  for (const source of fictionalSourceRecords) {
    assert.equal(validateSourceRecord(source).result, "pass");
  }
  for (const claim of fictionalEvidenceClaims) {
    assert.equal(validateEvidenceClaim(claim).result, "pass");
  }
  for (const feature of fictionalNormalizedFeatures) {
    assert.equal(validateNormalizedFeature(feature).result, "pass");
  }
  for (const review of fictionalReviewThemeSummaries) {
    assert.equal(validateReviewThemeSummary(review).result, "pass");
  }
  assert.equal(validateRankingDefinition(trainCommuteProposedDefinition).result, "pass");
  assert.equal(validateRankingInputContract(fictionalRankingInput).result, "pass");
  assert.equal(validateReviewReport(fictionalReviewReport).result, "pass");
  const result = calculateRankingResult(clone(fictionalRankingBundle));
  assert.equal(validateRankingResult(result).result, "pass");
});

test("same input and versions produce byte-equivalent ranking results", () => {
  const first = calculateRankingResult(clone(fictionalRankingBundle));
  const second = calculateRankingResult(clone(fictionalRankingBundle));
  assert.deepEqual(second, first);
});

test("candidate, feature, source, claim, and review input order do not change output", () => {
  const baselineBundle = clone(fictionalRankingBundle);
  const reordered = clone(fictionalRankingBundle);
  reordered.input.candidates.reverse();
  for (const candidate of reordered.input.candidates) {
    candidate.feature_refs.reverse();
    candidate.review_refs.reverse();
  }
  reordered.product_identities.reverse();
  reordered.source_records.reverse();
  reordered.evidence_claims.reverse();
  reordered.normalized_features.reverse();
  reordered.review_theme_summaries.reverse();
  assert.equal(computeInputHash(reordered), computeInputHash(baselineBundle));
  assert.deepEqual(calculateRankingResult(reordered), calculateRankingResult(baselineBundle));
});

test("missing values remain unconfirmed and do not become zero-score axes", () => {
  const result = calculateRankingResult(clone(fictionalRankingBundle));
  assert.equal(result.entries.some((candidate) => candidate.product_identity_id === C), false);
  const held = result.on_hold.find((candidate) => candidate.product_identity_id === C);
  assert.ok(held);
  assert.equal(held.reason_code, "insufficient_data");
  assert.equal(held.data_coverage, 0.5);
  const missingFeatures = fictionalNormalizedFeatures.filter(
    (feature) => feature.product_identity_id === C && feature.value === null,
  );
  assert.ok(missingFeatures.length > 0);
  assert.ok(missingFeatures.every((feature) =>
    feature.evidence_status === "unconfirmed"
      && feature.supporting_claims.length === 0
      && feature.independent_source_count === 0,
  ));
});

test("duplicate evidence does not add score or confidence", () => {
  const baseline = calculateRankingResult(clone(fictionalRankingBundle));
  const withoutDuplicate = clone(fictionalRankingBundle);
  const duplicateClaimId = "clm-trainlight-a-weight-copy";
  const duplicateSourceId = "src-trainlight-a-retailer-copy";
  withoutDuplicate.evidence_claims = withoutDuplicate.evidence_claims
    .filter((claim) => claim.evidence_claim_id !== duplicateClaimId);
  withoutDuplicate.source_records = withoutDuplicate.source_records
    .filter((source) => source.source_record_id !== duplicateSourceId);
  const weightFeature = withoutDuplicate.normalized_features.find(
    (feature) => feature.product_identity_id === A && feature.axis_id === "weight_body",
  );
  weightFeature.supporting_claims = weightFeature.supporting_claims
    .filter((claimId) => claimId !== duplicateClaimId);
  const recalculated = calculateRankingResult(withoutDuplicate);
  assert.deepEqual(
    {
      score: entry(recalculated, A).score,
      confidence: entry(recalculated, A).confidence,
      breakdown: entry(recalculated, A).per_axis_breakdown,
    },
    {
      score: entry(baseline, A).score,
      confidence: entry(baseline, A).confidence,
      breakdown: entry(baseline, A).per_axis_breakdown,
    },
  );
});

test("old-model overseas feature cannot be mixed into the current JP identity", () => {
  const mixed = clone(fictionalRankingBundle);
  const currentCandidate = mixed.input.candidates.find((candidate) => candidate.product_identity_id === A);
  currentCandidate.feature_refs.push(isolatedOldMarketFeatureId);
  const validation = validateRankingInput(mixed);
  assert.equal(validation.result, "fail");
  assert.ok(validation.issues.some((issue) => issue.code === "identity.cross_product_feature"));
  assert.throws(() => calculateRankingResult(mixed), /ranking input validation failed/);
});

test("unresolved conflict is held separately instead of being ranked last", () => {
  const result = calculateRankingResult(clone(fictionalRankingBundle));
  assert.equal(result.entries.some((candidate) => candidate.product_identity_id === D), false);
  const held = result.on_hold.find((candidate) => candidate.product_identity_id === D);
  assert.ok(held);
  assert.equal(held.reason_code, "unresolved_conflict");
});

test("insufficient data is held separately instead of being ranked last", () => {
  const result = calculateRankingResult(clone(fictionalRankingBundle));
  const held = result.on_hold.find((candidate) => candidate.product_identity_id === C);
  assert.ok(held);
  assert.equal(held.reason_code, "insufficient_data");
  assert.equal(result.entries.at(-1)?.product_identity_id === C, false);
});

test("ties receive the same rank with a stable identity order", () => {
  const result = calculateRankingResult(clone(fictionalRankingBundle));
  const a = entry(result, A);
  const e = entry(result, E);
  assert.equal(a.score, e.score);
  assert.equal(a.data_coverage, e.data_coverage);
  assert.equal(a.confidence, e.confidence);
  assert.equal(a.rank, e.rank);
  const tied = result.entries.filter((candidate) => candidate.rank === a.rank);
  assert.deepEqual(
    tied.map((candidate) => candidate.product_identity_id),
    [...tied.map((candidate) => candidate.product_identity_id)].sort(),
  );
  assert.ok(a.tie_note);
  assert.ok(e.tie_note);
});

test("commercial relations and external media ranks never alter product score", () => {
  const baseline = calculateRankingResult(clone(fictionalRankingBundle));
  const altered = clone(fictionalRankingBundle);
  for (const source of altered.source_records.filter((candidate) => candidate.target_product === A)) {
    source.commercial_relation = "sponsored";
    source.external_rank_metadata = {
      rank_label: "架空媒体で1位",
      rank_value: 999,
      scale_note: "得点化禁止のテスト値",
    };
  }
  const recalculated = calculateRankingResult(altered);
  assert.equal(entry(recalculated, A).score, entry(baseline, A).score);
  assert.equal(entry(recalculated, A).confidence, entry(baseline, A).confidence);
  assert.equal(
    altered.definition.axis_weights.some((axis) =>
      axis.axis_id.includes("commercial") || axis.axis_id.includes("external_rank"),
    ),
    false,
  );
});

test("confidence configuration never contributes to product score", () => {
  const baseline = calculateRankingResult(clone(fictionalRankingBundle));
  const altered = clone(fictionalRankingBundle);
  altered.definition.confidence_config = {
    ...altered.definition.confidence_config,
    data_coverage_weight: 1,
    source_independence_weight: 0,
    primary_source_weight: 0,
    reliability_weight: 0,
  };
  const recalculated = calculateRankingResult(altered);
  assert.equal(entry(recalculated, A).score, entry(baseline, A).score);
  assert.equal(entry(recalculated, B).score, entry(baseline, B).score);
});

test("calculation and configuration versions remain in the result", () => {
  const result = calculateRankingResult(clone(fictionalRankingBundle));
  assert.equal(result.calc_version, trainCommuteProposedDefinition.calc_version);
  assert.equal(result.definition_version, trainCommuteProposedDefinition.definition_version);
  assert.equal(result.ranking_definition_id, trainCommuteProposedDefinition.ranking_definition_id);
});

test("every scored axis traces back to retained claims and source records", () => {
  const result = calculateRankingResult(clone(fictionalRankingBundle));
  const claimIds = new Set(fictionalEvidenceClaims.map((claim) => claim.evidence_claim_id));
  const sourceIds = new Set(fictionalSourceRecords.map((source) => source.source_record_id));
  for (const ranked of result.entries) {
    for (const axis of ranked.per_axis_breakdown) {
      assert.ok(axis.evidence_claim_ids.length > 0);
      assert.ok(axis.source_record_ids.length > 0);
      assert.ok(axis.evidence_claim_ids.every((claimId) => claimIds.has(claimId)));
      assert.ok(axis.source_record_ids.every((sourceId) => sourceIds.has(sourceId)));
    }
  }
  const aWeight = entry(result, A).per_axis_breakdown.find((axis) => axis.axis_id === "weight_body");
  assert.deepEqual(aWeight.evidence_claim_ids, ["clm-trainlight-a-weight_body"]);
  assert.deepEqual(aWeight.source_record_ids, ["src-trainlight-a-official"]);
});

test("small proposed weight changes detect ranking instability", () => {
  const bundle = clone(fictionalRankingBundle);
  const baseline = calculateRankingResult(bundle);
  const notes = analyzeSensitivity(bundle, { ...baseline, sensitivity_notes: [] });
  assert.ok(notes.length > 0);
  assert.ok(notes.some((note) => note.axis_id === "basket_capacity"));
});

test("unit normalization is deterministic and unavailable conversions return null", () => {
  assert.equal(normalizeNumericValue(4800, "g", "kg"), 4.8);
  assert.equal(normalizeNumericValue(45, "cm", "mm"), 450);
  assert.equal(normalizeNumericValue(null, "kg", "kg"), null);
  assert.equal(normalizeNumericValue(5, null, "kg"), null);
  assert.equal(normalizeNumericValue(5, "kg", "L"), null);
});

test("missing a high-weight axis reduces weighted coverage more than axis-count coverage", () => {
  const bundle = clone(fictionalRankingBundle);
  const candidate = bundle.input.candidates.find((item) => item.product_identity_id === A);
  candidate.feature_refs = candidate.feature_refs.filter((id) => !id.endsWith("-weight_body"));
  const metrics = metricsFor(bundle, A);
  assert.equal(metrics.data_coverage, 0.9);
  assert.equal(metrics.weighted_data_coverage, 0.83);
});

test("missing a light-weight axis is distinguished from missing a high-weight axis", () => {
  const importantMissing = clone(fictionalRankingBundle);
  const lightMissing = clone(fictionalRankingBundle);
  importantMissing.input.candidates.find((item) => item.product_identity_id === A).feature_refs =
    importantMissing.input.candidates.find((item) => item.product_identity_id === A).feature_refs
      .filter((id) => !id.endsWith("-weight_body"));
  lightMissing.input.candidates.find((item) => item.product_identity_id === A).feature_refs =
    lightMissing.input.candidates.find((item) => item.product_identity_id === A).feature_refs
      .filter((id) => !id.endsWith("-basket_capacity"));
  const important = metricsFor(importantMissing, A);
  const light = metricsFor(lightMissing, A);
  assert.equal(important.data_coverage, light.data_coverage);
  assert.ok(important.weighted_data_coverage < light.weighted_data_coverage);
  assert.equal(light.weighted_data_coverage, 0.95);
});

test("observed score renormalizes over observed axes instead of zero-filling a missing axis", () => {
  const bundle = clone(fictionalRankingBundle);
  const candidate = bundle.input.candidates.find((item) => item.product_identity_id === A);
  candidate.feature_refs = candidate.feature_refs.filter((id) => !id.endsWith("-weight_body"));
  const metrics = metricsFor(bundle, A);
  const observed = calculateObservedScore(metrics.contexts);
  assert.ok(observed.observed_score !== null);
  assert.equal(observed.breakdown.some((axis) => axis.axis_id === "weight_body"), false);
  assert.ok(observed.observed_score > observed.observed_score * metrics.weighted_data_coverage);
});

test("high observed score cannot bypass insufficient ordinary coverage", () => {
  const bundle = clone(fictionalRankingBundle);
  const candidate = bundle.input.candidates.find((item) => item.product_identity_id === A);
  candidate.feature_refs = candidate.feature_refs.filter((id) => !id.endsWith("-basket_capacity"));
  const observed = calculateObservedScore(metricsFor(bundle, A).contexts).observed_score;
  assert.ok(observed !== null && observed > 50);
  bundle.definition.min_data_coverage.value = 0.95;
  const result = calculateRankingResult(bundle);
  assert.equal(result.entries.some((item) => item.product_identity_id === A), false);
  assert.equal(result.on_hold.find((item) => item.product_identity_id === A)?.reason_code, "insufficient_data");
});

test("weighted coverage threshold holds a candidate even when ordinary coverage passes", () => {
  const bundle = clone(fictionalRankingBundle);
  const candidate = bundle.input.candidates.find((item) => item.product_identity_id === A);
  candidate.feature_refs = candidate.feature_refs.filter((id) => !id.endsWith("-weight_body"));
  bundle.definition.required_axes.axes = ["size_open", "folding_ease"];
  bundle.definition.min_weighted_data_coverage.value = 0.9;
  const metrics = metricsFor(bundle, A);
  assert.ok(metrics.data_coverage >= bundle.definition.min_data_coverage.value);
  assert.ok(metrics.weighted_data_coverage < bundle.definition.min_weighted_data_coverage.value);
  const result = calculateRankingResult(bundle);
  assert.equal(result.on_hold.find((item) => item.product_identity_id === A)?.reason_code, "insufficient_weighted_data");
});

test("confidence changes do not alter observed score", () => {
  const baseline = calculateRankingResult(clone(fictionalRankingBundle));
  const altered = clone(fictionalRankingBundle);
  altered.definition.confidence_config = {
    ...altered.definition.confidence_config,
    data_coverage_weight: 1,
    source_independence_weight: 0,
    primary_source_weight: 0,
    reliability_weight: 0,
  };
  const recalculated = calculateRankingResult(altered);
  assert.equal(entry(recalculated, A).observed_score, entry(baseline, A).observed_score);
  assert.notEqual(entry(recalculated, A).confidence, entry(baseline, A).confidence);
});

test("an unresolved conflict on a required axis places the product on hold", () => {
  const result = calculateRankingResult(clone(fictionalRankingBundle));
  const held = result.on_hold.find((item) => item.product_identity_id === D);
  assert.ok(held);
  assert.equal(held.reason_code, "unresolved_conflict");
  assert.match(held.reason, /必須軸/);
});

test("an unresolved conflict on a non-required axis excludes only that axis", () => {
  const bundle = clone(fictionalRankingBundle);
  bundle.definition.required_axes.axes = ["weight_body", "size_open"];
  const result = calculateRankingResult(bundle);
  const ranked = entry(result, D);
  assert.equal(ranked.per_axis_breakdown.some((axis) => axis.axis_id === "folding_ease"), false);
  assert.equal(ranked.data_coverage, 0.9);
});

test("coverage is rechecked after a non-required conflicting axis is excluded", () => {
  const bundle = clone(fictionalRankingBundle);
  bundle.definition.required_axes.axes = ["weight_body", "size_open"];
  bundle.definition.min_weighted_data_coverage.value = 0.9;
  const result = calculateRankingResult(bundle);
  assert.equal(result.entries.some((item) => item.product_identity_id === D), false);
  assert.equal(result.on_hold.find((item) => item.product_identity_id === D)?.reason_code, "insufficient_weighted_data");
});

test("SHA-256 is repeatable and recorded in the ranking result", () => {
  const first = computeInputHash(clone(fictionalRankingBundle));
  const second = computeInputHash(clone(fictionalRankingBundle));
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{64}$/);
  const result = calculateRankingResult(clone(fictionalRankingBundle));
  assert.equal(result.input_hash, first);
  assert.equal(result.input_hash_algorithm, "sha256");
});

test("SHA-256 canonicalization ignores declared unordered array order", () => {
  const baseline = clone(fictionalRankingBundle);
  const reordered = clone(fictionalRankingBundle);
  reordered.input.candidates.reverse();
  reordered.definition.axis_weights.reverse();
  reordered.source_records.reverse();
  reordered.evidence_claims.reverse();
  reordered.normalized_features.reverse();
  reordered.review_theme_summaries.reverse();
  assert.equal(computeInputHash(reordered), computeInputHash(baseline));
});

test("SHA-256 changes when a semantic input value changes", () => {
  const baseline = clone(fictionalRankingBundle);
  const altered = clone(fictionalRankingBundle);
  altered.normalized_features.find((feature) =>
    feature.product_identity_id === A && feature.axis_id === "weight_body"
  ).value = 4.9;
  assert.notEqual(computeInputHash(altered), computeInputHash(baseline));
});

test("execution environment and calculation versions remain in the run manifest", () => {
  assert.equal(validateRunManifest(fictionalRunManifest).result, "pass");
  assert.equal(fictionalRunManifest.execution_environment.node_version, "v24.16.0");
  assert.equal(fictionalRunManifest.execution_environment.typescript_version, "5.9.3");
  assert.equal(fictionalRunManifest.execution_environment.test_isolation, "none");
  assert.equal(fictionalRunManifest.execution_environment.calculation_version, trainCommuteProposedDefinition.calc_version);
  assert.equal(fictionalRunManifest.execution_environment.definition_version, trainCommuteProposedDefinition.definition_version);
});

test("variant product code remains distinct from the model-wide model number", () => {
  const product = clone(fictionalProductIdentities.find((item) => item.product_identity_id === A));
  product.variants = [{
    variant_id: "var-fictional-a-yellow",
    color_name: "架空イエロー",
    product_code: "FIC-COLOR-YELLOW",
    specification_equivalence_status: "unverified",
    supporting_claims: ["clm-trainlight-a-weight_body"],
  }];
  assert.equal(validateProductIdentity(product).result, "pass");
  product.model_number = "FIC-COLOR-YELLOW";
  const invalid = validateProductIdentity(product);
  assert.equal(invalid.result, "fail");
  assert.ok(invalid.issues.some((issue) => issue.code === "identity.variant_code_as_model"));
});

test("site_product_match_status accepts probable and rejects invalid linkage states", () => {
  const product = clone(fictionalProductIdentities.find((item) => item.product_identity_id === A));
  product.site_product_id = "4";
  product.site_product_match_status = "probable";
  assert.equal(validateProductIdentity(product).result, "pass");
  product.site_product_id = null;
  assert.equal(validateProductIdentity(product).result, "fail");
});

test("official manual validation requires the official discovery route and direct asset URL", () => {
  const source = clone(fictionalSourceRecords[0]);
  source.source_type = "official_manual";
  source.url = "https://assets.example.invalid/manual.pdf";
  source.discovery_page_url = "https://example.invalid/official-download-center/product";
  source.direct_asset_url = source.url;
  source.discovered_via_official_page = true;
  assert.equal(validateSourceRecord(source).result, "pass");
  delete source.discovery_page_url;
  const invalid = validateSourceRecord(source);
  assert.equal(invalid.result, "fail");
  assert.ok(invalid.issues.some((issue) => issue.code === "manual.discovery_required"));
});

test("included_items remains a deprecated alias of included_accessories", () => {
  assert.equal(canonicalizeAxisId("included_items"), "included_accessories");
  assert.equal(canonicalizeAxisId("included_accessories"), "included_accessories");
  const claim = clone(fictionalEvidenceClaims[0]);
  claim.axis_id = "included_items";
  assert.equal(validateEvidenceClaim(claim).result, "pass");
  const feature = clone(fictionalNormalizedFeatures[0]);
  feature.axis_id = "included_items";
  assert.equal(validateNormalizedFeature(feature).result, "pass");
});
