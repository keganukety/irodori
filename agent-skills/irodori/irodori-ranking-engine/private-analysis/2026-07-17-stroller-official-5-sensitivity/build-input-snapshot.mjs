import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../../../");
const benchmarkRoot = join(repoRoot, "agent-skills/irodori/benchmarks/stroller-official-5");
const manifestPath = join(benchmarkRoot, "benchmark-manifest.json");
const matrixPath = join(benchmarkRoot, "official-feature-matrix.json");
const rubricPath = join(benchmarkRoot, "rubric-proposal/train-commute-rubric-proposal.json");
const eligibilityPath = join(benchmarkRoot, "rubric-proposal/scenario-eligibility.json");
const normalizationPath = join(benchmarkRoot, "rubric-proposal/normalization-rules.json");
const outputPath = join(here, "input-snapshot.json");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function repoPath(path) {
  return relative(repoRoot, path).replaceAll("\\", "/");
}

function rawFact({ value = null, unit = null, evidenceStatus = "unconfirmed", feature = null, claimClass = "official_spec", conflict = false, layer = "raw", derivedFrom = [], unavailableReason = null }) {
  return {
    value,
    unit,
    evidence_status: evidenceStatus,
    claim_class: claimClass,
    conflict,
    comparison_layer: layer,
    normalized_feature_id: feature?.normalized_feature_id ?? null,
    evidence_claim_ids: feature?.supporting_claims ?? [],
    source_record_ids: [],
    derived_from: derivedFrom,
    unavailable_reason: unavailableReason,
  };
}

function missingFact(reason = "not_normalized_in_official_benchmark") {
  return rawFact({ unavailableReason: reason });
}

function productSegment(role) {
  return /B形|B型/.test(role) && !/AB型/.test(role)
    ? "b_type_compact"
    : "a_type_primary";
}

function comparisonFor(matrix, productId, axisId) {
  return matrix.comparison_metadata.find((item) => item.product_identity_id === productId && item.axis_id === axisId) ?? null;
}

function entryFor(matrix, productId, axisId) {
  const entry = matrix.entries.find((item) => item.product_identity_id === productId && item.axis_id === axisId);
  if (!entry) throw new Error(`matrix entry missing: ${productId}/${axisId}`);
  return entry;
}

function featureFor(features, axisId) {
  const feature = features.find((item) => item.axis_id === axisId);
  if (!feature) throw new Error(`normalized feature missing: ${axisId}`);
  return feature;
}

function factFromFeature(feature, value = feature.value, unit = feature.unit) {
  return rawFact({
    value,
    unit,
    evidenceStatus: feature.evidence_status,
    feature,
    conflict: feature.evidence_status === "conflicting",
  });
}

function attachSourceIds(facts, claimMap) {
  for (const fact of Object.values(facts)) {
    fact.source_record_ids = [...new Set(fact.evidence_claim_ids
      .map((claimId) => claimMap.get(claimId)?.source_record_id)
      .filter(Boolean))].sort();
  }
}

export function buildSnapshot() {
  const manifest = readJson(manifestPath);
  const matrix = readJson(matrixPath);
  const products = manifest.products.map((manifestProduct, index) => {
    const runRoot = resolve(repoRoot, manifestProduct.run_dir);
    const paths = {
      product_identity: join(runRoot, "product-identity.json"),
      sources: join(runRoot, "sources.json"),
      evidence_claims: join(runRoot, "evidence-claims.json"),
      normalized_features: join(runRoot, "normalized-features.json"),
    };
    const identity = readJson(paths.product_identity);
    const claims = readJson(paths.evidence_claims);
    const features = readJson(paths.normalized_features);
    const claimMap = new Map(claims.map((claim) => [claim.evidence_claim_id, claim]));
    const weight = featureFor(features, "weight_body");
    const open = featureFor(features, "size_open");
    const folded = featureFor(features, "size_folded");
    const targetAge = featureFor(features, "target_age");
    const maxLoad = featureFor(features, "max_load");
    const folding = featureFor(features, "folding_ease");
    const standing = featureFor(features, "self_standing");
    const basket = featureFor(features, "basket_capacity");
    const weightComparison = comparisonFor(matrix, manifestProduct.product_identity_id, "weight_body");

    const facts = {
      target_age_min_months: factFromFeature(targetAge, targetAge.value?.min ?? null, "month"),
      target_age_max_months: factFromFeature(targetAge, targetAge.value?.max ?? null, "month"),
      max_child_weight_kg: factFromFeature(maxLoad),
      body_weight_kg: factFromFeature(weight),
      measurement_scope: rawFact({
        value: weightComparison?.measurement_scope ?? "unknown",
        evidenceStatus: weightComparison ? "confirmed" : "unconfirmed",
        feature: weight,
      }),
      measurement_condition: rawFact({
        value: weightComparison?.measurement_condition ?? "unknown",
        evidenceStatus: weightComparison ? "confirmed" : "unconfirmed",
        feature: weight,
      }),
      approximation_status: rawFact({
        value: weightComparison?.approximation_status ?? "unknown",
        evidenceStatus: weightComparison ? "confirmed" : "unconfirmed",
        feature: weight,
      }),
      unfolded_width_mm: factFromFeature(open, open.value?.width_mm ?? null, "mm"),
      folded_width_mm: factFromFeature(folded, folded.value?.width_mm ?? null, "mm"),
      folded_depth_mm: factFromFeature(folded, folded.value?.depth_mm ?? null, "mm"),
      folded_height_mm: factFromFeature(folded, folded.value?.height_mm ?? null, "mm"),
      folded_dimension_orientation: missingFact("standing_base_orientation_not_confirmed"),
      folded_floor_footprint_cm2: rawFact({
        layer: "derived",
        derivedFrom: ["folded_width_mm", "folded_depth_mm", "folded_dimension_orientation"],
        unavailableReason: "standing_base_orientation_not_confirmed",
      }),
      one_hand_fold_explicit: factFromFeature(folding),
      one_hand_unfold_explicit: missingFact(),
      fold_step_count: missingFact("official_sequential_operations_not_normalized"),
      requires_two_hands: missingFact(),
      requires_bending: missingFact(),
      requires_seat_removal: missingFact(),
      fold_with_seat_attached: missingFact(),
      self_standing_explicit: factFromFeature(standing),
      folded_lock: missingFact(),
      carry_handle: missingFact("no_normalized_feature_bridge"),
      carry_strap: missingFact("no_normalized_feature_bridge"),
      carrying_position: missingFact("no_normalized_feature_bridge"),
      carry_assistance_level: rawFact({
        layer: "derived",
        derivedFrom: ["carry_handle", "carry_strap", "carrying_position"],
        unavailableReason: "source_raw_facts_not_normalized",
      }),
      basket_max_load_kg: basket.unit === "kg" ? factFromFeature(basket) : missingFact("manufacturer_reports_volume_not_load"),
      basket_volume_l: basket.unit === "L" ? factFromFeature(basket) : missingFact("manufacturer_reports_load_not_volume"),
    };
    attachSourceIds(facts, claimMap);

    return {
      analysis_product_id: `P${String(index + 1).padStart(2, "0")}`,
      product_identity_id: manifestProduct.product_identity_id,
      official_name: identity.official_name,
      brand_name: identity.brand_name,
      benchmark_segment: productSegment(manifestProduct.role),
      segment_basis: manifestProduct.role,
      identity_status: identity.identification_status,
      run_dir: manifestProduct.run_dir,
      artifact_paths: Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, repoPath(path)])),
      artifact_sha256: Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, sha256File(path)])),
      raw_facts: facts,
    };
  });

  return {
    snapshot_id: "snapshot-stroller-official-5-private-sensitivity-2026-07-17",
    snapshot_date: "2026-07-17",
    origin_main_commit: "6d8c2e86e1a2b45aabcfa67ba03d599789be0a45",
    status: "frozen_private_analysis_input",
    source_policy: "manufacturer_official_only",
    disclaimer: "This snapshot is an internal sensitivity-analysis input, not a product score or published ranking.",
    benchmark_artifacts: {
      benchmark_manifest: { path: repoPath(manifestPath), sha256: sha256File(manifestPath) },
      official_feature_matrix: { path: repoPath(matrixPath), sha256: sha256File(matrixPath) },
      rubric_proposal: { path: repoPath(rubricPath), sha256: sha256File(rubricPath) },
      scenario_eligibility: { path: repoPath(eligibilityPath), sha256: sha256File(eligibilityPath) },
      normalization_rules: { path: repoPath(normalizationPath), sha256: sha256File(normalizationPath) }
    },
    layer_contract: {
      raw: "official normalized feature values split without changing meaning",
      derived: "deterministic values only; unavailable when required scope/orientation inputs are absent",
      editorial: "parent-axis interpretation stays in the analysis overlay and is never written back to product data",
      editorial_composite_output: "train_fitness and one_operator_fitness are not independent score inputs"
    },
    products,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const snapshot = buildSnapshot();
  writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`wrote ${repoPath(outputPath)}`);
}
