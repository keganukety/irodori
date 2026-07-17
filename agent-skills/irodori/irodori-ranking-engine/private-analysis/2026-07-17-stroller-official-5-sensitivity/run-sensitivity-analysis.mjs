import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  calculateCandidateMetrics,
  calculateObservedScore,
  calculateRankingResult,
} from "../../scripts/ranking-engine.ts";
import {
  evaluateCandidateCoverage,
  finalizeScenarioRankingEligibility,
  validateCoverageConfiguration,
} from "../../scripts/coverage-contract.ts";
import { evaluateScenarioEligibility } from "../../../benchmarks/stroller-official-5/rubric-proposal/validate-rubric-proposal.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../../../");
const configPath = join(here, "analysis-config.json");
const snapshotPath = join(here, "input-snapshot.json");
const outputPath = join(here, "analysis-result.json");
const fixedTimestamp = "2026-07-17T00:00:00+09:00";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256File(path) {
  return sha256Bytes(readFileSync(path));
}

function round(value, digits = 6) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function compareString(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort(compareString);
}

function verifyFingerprint(path, expected) {
  const actual = sha256File(resolve(repoRoot, path));
  return { path, expected, actual, result: actual === expected ? "pass" : "fail" };
}

export function verifySnapshot(snapshot = readJson(snapshotPath)) {
  const checks = [];
  for (const artifact of Object.values(snapshot.benchmark_artifacts)) {
    checks.push(verifyFingerprint(artifact.path, artifact.sha256));
  }
  for (const product of snapshot.products) {
    for (const [key, path] of Object.entries(product.artifact_paths)) {
      checks.push(verifyFingerprint(path, product.artifact_sha256[key]));
    }
  }
  return {
    result: checks.every((check) => check.result === "pass") ? "pass" : "fail",
    checks,
  };
}

function loadRuntimeRecords(snapshot) {
  const identities = [];
  const sources = [];
  const claims = [];
  for (const product of snapshot.products) {
    identities.push(readJson(resolve(repoRoot, product.artifact_paths.product_identity)));
    sources.push(...readJson(resolve(repoRoot, product.artifact_paths.sources)));
    claims.push(...readJson(resolve(repoRoot, product.artifact_paths.evidence_claims)));
  }
  return { identities, sources, claims };
}

function factUsable(fact) {
  return fact !== null
    && fact.value !== null
    && fact.value !== undefined
    && fact.evidence_status === "confirmed"
    && fact.conflict !== true
    && ["official_spec", "manual_safety", "third_party_measured"].includes(fact.claim_class);
}

function eligibilityCandidate(product) {
  return {
    fixture_only: false,
    category: "stroller",
    raw_facts: product.raw_facts,
  };
}

export function evaluateAnalysisEligibility(product, scenario) {
  if (product.benchmark_segment !== scenario.benchmark_segment) {
    return {
      status: "not_applicable",
      disposition: "exclude_without_evaluation",
      participation_status: "not_applicable",
      reasons: ["benchmark_segment_not_applicable"],
      missing_required_inputs: [],
    };
  }
  if (scenario.weight_scope_filter
    && product.raw_facts.measurement_scope.value !== scenario.weight_scope_filter) {
    return {
      status: "not_applicable",
      disposition: "exclude_without_evaluation",
      participation_status: "not_applicable",
      reasons: ["measurement_scope_cohort_not_applicable"],
      missing_required_inputs: [],
    };
  }
  return evaluateScenarioEligibility(eligibilityCandidate(product), scenario.eligibility_scenario_id);
}

function boundaryNumbers(candidateValues) {
  return candidateValues.map((value) => typeof value === "number" ? value : value.minimum);
}

function boundaryMap(rubric) {
  return Object.fromEntries(rubric.boundary_grid.map((item) => [item.boundary_id, boundaryNumbers(item.candidate_values)]));
}

function bandForLowerBetter(value, boundaries) {
  if (value <= boundaries[0]) return "very_high";
  if (value <= boundaries[1]) return "high";
  if (value <= boundaries[2]) return "medium";
  if (value <= boundaries[3]) return "low";
  return "very_low";
}

function scoreRule(criterion, config) {
  if (criterion.rule_kind === "boolean") {
    return { kind: "boolean", preferred_value: criterion.preferred_value };
  }
  return { kind: "ordinal", points: config.score_policy.band_points };
}

function normalizeParentWeights(weights) {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, round(value / total, 12)]));
}

function patternParentWeights(config, pattern) {
  const weights = { ...config.allocation_assumption.parent_weights };
  if (pattern.weight_parent) {
    const factor = pattern.direction === "increase" ? 1 + pattern.delta : 1 - pattern.delta;
    weights[pattern.weight_parent] *= factor;
  }
  for (const parent of pattern.excluded_parents ?? []) delete weights[parent];
  return normalizeParentWeights(weights);
}

export function buildDefinition(config, rubric, scenario, pattern) {
  const parentWeights = patternParentWeights(config, pattern);
  const activeCriteria = config.criteria.filter((criterion) => parentWeights[criterion.parent_axis] !== undefined);
  const childrenPerParent = new Map();
  for (const criterion of activeCriteria) {
    childrenPerParent.set(criterion.parent_axis, (childrenPerParent.get(criterion.parent_axis) ?? 0) + 1);
  }
  const axisWeights = activeCriteria.map((criterion) => ({
    axis_id: criterion.criterion_id,
    weight: round(parentWeights[criterion.parent_axis] / childrenPerParent.get(criterion.parent_axis), 12),
    value_status: "proposed",
    scoring_rule: scoreRule(criterion, config),
  }));
  const threshold = pattern.coverage_threshold ?? config.score_policy.baseline_coverage_threshold;
  return {
    schema_version: "0.4.0",
    record_id: `rdef-${scenario.scenario_id}-${pattern.pattern_id}`,
    ranking_definition_id: `rdef-${scenario.scenario_id}-${pattern.pattern_id}`,
    definition_version: "0.1.0",
    name: `非公開感度試算 ${scenario.scenario_id} ${pattern.pattern_id}`,
    scope: "scene",
    scene_tag: scenario.scenario_id,
    category: "ベビーカー",
    axis_weights: axisWeights,
    required_axes: { axes: [], value_status: "proposed" },
    min_data_coverage: { value: threshold, value_status: "proposed" },
    min_weighted_data_coverage: { value: threshold, value_status: "proposed" },
    critical_axes: { axes: [], value_status: "proposed" },
    disqualification_rules: [
      { rule: "require_current_lifecycle", reason_template: "現行品ではないため対象外", value_status: "confirmed" },
      { rule: "require_market_match", expected_market: "JP", reason_template: "対象市場がJPではないため対象外", value_status: "confirmed" }
    ],
    tie_breaker_rules: { ordered_rules: ["tie_allowed", "product_identity_id_asc"], value_status: "proposed" },
    evidence_policy: {
      accepted_statuses: ["confirmed", "unconfirmed"],
      unresolved_conflict: { required_axis: "hold", non_required_axis: "exclude_axis", critical_axis: "hold" },
      outdated: "exclude_axis",
      duplicate_handling: "representative_only",
      value_status: "proposed"
    },
    missing_data_policy: { below_min_coverage: "hold", missing_axis: "exclude_from_score", value_status: "proposed" },
    confidence_formula_ref: "confidence-proposed-v1",
    confidence_config: {
      formula_id: "confidence-proposed-v1",
      data_coverage_weight: 0.4,
      source_independence_weight: 0.25,
      primary_source_weight: 0.2,
      reliability_weight: 0.15,
      independent_sources_target_per_axis: 2,
      value_status: "proposed"
    },
    sensitivity_config: { weight_delta: null, value_status: "proposed" },
    freshness_rule: null,
    calc_version: config.engine_calc_version,
    publication_status: "draft",
    created_at: fixedTimestamp,
    updated_at: fixedTimestamp,
    notes: `Current rubric allocation is undefined; equal-weight private overlay. Source rubric ${rubric.rubric_id}.`,
  };
}

function adjustedBoundaries(baseBoundaries, pattern) {
  const result = structuredClone(baseBoundaries);
  if (pattern.boundary_id) {
    const factor = pattern.direction === "increase" ? 1 + pattern.delta : 1 - pattern.delta;
    result[pattern.boundary_id] = result[pattern.boundary_id].map((value) => round(value * factor, 6));
  }
  return result;
}

function adjustedRawValue(factId, value, pattern) {
  if (pattern.nudged_raw_fact_id !== factId || typeof value !== "number") return value;
  const factor = pattern.direction === "increase" ? 1 + pattern.delta : 1 - pattern.delta;
  return round(value * factor, 9);
}

function weightAllowed(product, eligibleProducts, scenario) {
  if (scenario.weight_scope_policy === "allow_partial_same_scope") return true;
  if (scenario.weight_scope_policy === "single_product_diagnostic") return eligibleProducts.length === 1;
  const scopes = uniqueSorted(eligibleProducts.map((item) => item.raw_facts.measurement_scope.value));
  return scopes.length === 1 && scopes[0] !== "unknown";
}

function derivedInferenceClaims(product, criterion, value, fact, runtimeClaims, snapshotDate) {
  const runtimeClaimMap = new Map(runtimeClaims.map((claim) => [claim.evidence_claim_id, claim]));
  const suffix = criterion.criterion_id.replaceAll(".", "-");
  return fact.evidence_claim_ids.map((claimId, index) => {
    const original = runtimeClaimMap.get(claimId);
    if (!original) throw new Error(`snapshot claim reference missing at runtime: ${claimId}`);
    const derivedId = `clm-private-${product.analysis_product_id}-${suffix}-${index + 1}`;
    return {
      schema_version: "0.4.0",
      record_id: derivedId,
      evidence_claim_id: derivedId,
      source_record_id: original.source_record_id,
      product_identity_id: product.product_identity_id,
      claim_kind: "other",
      axis_id: criterion.criterion_id,
      value_raw: `analysis-only deterministic derivation from ${claimId}`,
      quote: false,
      value_normalized: value,
      unit: null,
      measurement_condition: "private sensitivity overlay; source value unchanged",
      claim_class: "irodori_inference",
      fact_or_inference: "inference",
      derived_from: [claimId],
      evidence_status: "unconfirmed",
      conflict_with: [],
      duplicate_of: null,
      duplicate_candidate_of: [],
      reliability: original.reliability,
      created_at: `${snapshotDate}T00:00:00+09:00`,
      updated_at: `${snapshotDate}T00:00:00+09:00`,
      notes: `Internal analysis bridge for ${criterion.raw_fact_id}; not a new product fact.`,
    };
  });
}

function derivedFeature(product, criterion, value, inferenceClaims, snapshotDate) {
  const fact = product.raw_facts[criterion.raw_fact_id];
  const suffix = criterion.criterion_id.replaceAll(".", "-");
  return {
    schema_version: "0.4.0",
    record_id: `nf-private-${product.analysis_product_id}-${suffix}`,
    normalized_feature_id: `nf-private-${product.analysis_product_id}-${suffix}`,
    product_identity_id: product.product_identity_id,
    axis_id: criterion.criterion_id,
    value,
    unit: null,
    value_kind: typeof value === "boolean" ? "boolean" : "ordinal",
    supporting_claims: inferenceClaims.map((claim) => claim.evidence_claim_id),
    evidence_status: "unconfirmed",
    fact_or_inference: "inference",
    normalization_notes: `Private analysis-only band/alias derived from ${criterion.raw_fact_id}; source values are unchanged.`,
    independent_source_count: Math.max(1, new Set(inferenceClaims.map((claim) => claim.source_record_id)).size),
    created_at: `${snapshotDate}T00:00:00+09:00`,
    updated_at: `${snapshotDate}T00:00:00+09:00`,
  };
}

function buildDerivedFeatures(config, rubric, scenario, pattern, eligibleProducts, runtimeClaims) {
  const boundaries = adjustedBoundaries(boundaryMap(rubric), pattern);
  const features = [];
  const claims = [];
  const omissions = new Map();
  for (const product of eligibleProducts) {
    const productOmissions = {};
    for (const criterion of config.criteria) {
      if ((pattern.excluded_parents ?? []).includes(criterion.parent_axis)) continue;
      if (pattern.missing_criterion_id === criterion.criterion_id) {
        productOmissions[criterion.criterion_id] = "analysis_missingness_removal";
        continue;
      }
      const fact = product.raw_facts[criterion.raw_fact_id];
      if (!factUsable(fact)) {
        productOmissions[criterion.criterion_id] = fact?.unavailable_reason ?? `evidence_status_${fact?.evidence_status ?? "missing"}`;
        continue;
      }
      if (criterion.raw_fact_id === "body_weight_kg" && !weightAllowed(product, eligibleProducts, scenario)) {
        productOmissions[criterion.criterion_id] = "measurement_scope_not_comparable_in_scenario";
        continue;
      }
      const rawValue = adjustedRawValue(criterion.raw_fact_id, fact.value, pattern);
      const value = criterion.rule_kind === "ordinal_lower_better"
        ? bandForLowerBetter(rawValue, boundaries[criterion.boundary_id])
        : rawValue;
      const inferenceClaims = derivedInferenceClaims(product, criterion, value, fact, runtimeClaims, config.snapshot_date);
      claims.push(...inferenceClaims);
      features.push(derivedFeature(product, criterion, value, inferenceClaims, config.snapshot_date));
    }
    omissions.set(product.product_identity_id, productOmissions);
  }
  return { features, claims, omissions, boundaries };
}

function buildBundle(config, snapshot, rubric, scenario, pattern, runtime) {
  const eligibility = snapshot.products.map((product) => ({
    product,
    result: evaluateAnalysisEligibility(product, scenario),
  }));
  const eligibleProducts = eligibility.filter((item) => item.result.status === "eligible").map((item) => item.product);
  const definition = buildDefinition(config, rubric, scenario, pattern);
  const derived = buildDerivedFeatures(config, rubric, scenario, pattern, eligibleProducts, runtime.claims);
  const featureIdsByProduct = new Map();
  for (const feature of derived.features) {
    const ids = featureIdsByProduct.get(feature.product_identity_id) ?? [];
    ids.push(feature.normalized_feature_id);
    featureIdsByProduct.set(feature.product_identity_id, ids);
  }
  const input = {
    schema_version: "0.4.0",
    record_id: `rin-${scenario.scenario_id}-${pattern.pattern_id}`,
    ranking_input_id: `rin-${scenario.scenario_id}-${pattern.pattern_id}`,
    ranking_definition_id: definition.ranking_definition_id,
    definition_version: definition.definition_version,
    run_id: config.analysis_id,
    snapshot_date: snapshot.snapshot_date,
    candidates: eligibleProducts.map((product) => ({
      product_identity_id: product.product_identity_id,
      feature_refs: (featureIdsByProduct.get(product.product_identity_id) ?? []).sort(compareString),
      review_refs: [],
      data_coverage: null,
      weighted_data_coverage: null,
    })),
    excluded: eligibility
      .filter((item) => item.result.status === "ineligible")
      .map((item) => ({ product_identity_id: item.product.product_identity_id, exclusion_reason: item.result.reasons.join(",") })),
    input_hash: null,
    input_hash_algorithm: "sha256",
    created_at: fixedTimestamp,
    updated_at: fixedTimestamp,
  };
  return {
    eligibility,
    derived,
    bundle: {
      definition,
      input,
      product_identities: runtime.identities,
      source_records: runtime.sources,
      evidence_claims: [...runtime.claims, ...derived.claims],
      normalized_features: derived.features,
      review_theme_summaries: [],
    },
  };
}

function createPatternSuite(config, rubric) {
  const patterns = [{ pattern_id: "baseline", kind: "baseline", changes: {} }];
  for (const parent of Object.keys(config.allocation_assumption.parent_weights)) {
    for (const delta of config.sensitivity_patterns.relative_parent_weight_deltas) {
      for (const direction of ["decrease", "increase"]) {
        patterns.push({
          pattern_id: `weight.${parent}.${direction}.${delta}`,
          kind: "weight",
          weight_parent: parent,
          direction,
          delta,
          changes: { parent_axis: parent, direction, relative_delta: delta, total_weight_normalized_to: 1 },
        });
      }
    }
  }
  for (const boundary of rubric.boundary_grid) {
    for (const direction of ["decrease", "increase"]) {
      patterns.push({
        pattern_id: `boundary.${boundary.boundary_id}.${direction}.0.05`,
        kind: "boundary",
        boundary_id: boundary.boundary_id,
        direction,
        delta: config.sensitivity_patterns.boundary_shift_fraction,
        changes: { boundary_id: boundary.boundary_id, direction, relative_delta: config.sensitivity_patterns.boundary_shift_fraction },
      });
    }
  }
  for (const threshold of config.sensitivity_patterns.coverage_thresholds) {
    patterns.push({
      pattern_id: `coverage.${threshold}`,
      kind: "coverage",
      coverage_threshold: threshold,
      changes: { min_data_coverage: threshold, min_weighted_data_coverage: threshold, value_status: "proposed" },
    });
  }
  for (const parent of Object.keys(config.allocation_assumption.parent_weights)) {
    patterns.push({
      pattern_id: `exclude_parent.${parent}`,
      kind: "criterion_exclusion",
      excluded_parents: [parent],
      changes: { excluded_parent_axes: [parent] },
    });
  }
  for (const related of config.sensitivity_patterns.related_parent_exclusions) {
    patterns.push({
      pattern_id: related.pattern_id,
      kind: "related_criterion_exclusion",
      excluded_parents: related.parent_axes,
      changes: { excluded_parent_axes: related.parent_axes },
    });
  }
  for (const criterion of config.criteria) {
    patterns.push({
      pattern_id: `missing.${criterion.criterion_id}`,
      kind: "missingness",
      missing_criterion_id: criterion.criterion_id,
      changes: { removed_as_unknown_not_zero: criterion.criterion_id },
    });
  }
  for (const criterion of config.criteria.filter((item) => item.rule_kind === "ordinal_lower_better")) {
    for (const direction of ["decrease", "increase"]) {
      patterns.push({
        pattern_id: `input_nudge.${criterion.raw_fact_id}.${direction}.0.01`,
        kind: "input_nudge",
        nudged_raw_fact_id: criterion.raw_fact_id,
        direction,
        delta: config.sensitivity_patterns.numeric_input_nudge_fraction,
        changes: { raw_fact_id: criterion.raw_fact_id, direction, relative_delta: config.sensitivity_patterns.numeric_input_nudge_fraction, source_rewritten: false },
      });
    }
  }
  return patterns;
}

function parentForCriterion(config, criterionId) {
  return config.criteria.find((criterion) => criterion.criterion_id === criterionId)?.parent_axis ?? "unknown";
}

function parentContributions(config, breakdown) {
  const result = {};
  for (const item of breakdown) {
    const parent = parentForCriterion(config, item.axis_id);
    result[parent] = round((result[parent] ?? 0) + item.weighted_score);
  }
  return result;
}

function entryOutput(config, snapshot, definition, entry, omissions) {
  const product = snapshot.products.find((item) => item.product_identity_id === entry.product_identity_id);
  const activeParents = uniqueSorted(definition.axis_weights.map((axis) => parentForCriterion(config, axis.axis_id)));
  const coveredParents = uniqueSorted(entry.per_axis_breakdown.map((axis) => parentForCriterion(config, axis.axis_id)));
  return {
    product_analysis_id: product.analysis_product_id,
    eligibility: "eligible",
    evaluation_status: "trial_scored",
    trial_rank: entry.rank,
    criterion_scores: entry.per_axis_breakdown.map((axis) => {
      const criterion = config.criteria.find((item) => item.criterion_id === axis.axis_id);
      const rawFact = product.raw_facts[criterion.raw_fact_id];
      return {
        criterion_id: axis.axis_id,
        parent_axis: criterion.parent_axis,
        raw_fact_id: criterion.raw_fact_id,
        raw_normalized_feature_id: rawFact.normalized_feature_id,
        raw_evidence_claim_ids: rawFact.evidence_claim_ids,
        derived_inference_claim_ids: axis.evidence_claim_ids,
        raw_axis_score: axis.raw_axis_score,
        normalized_weight: axis.normalized_weight,
        contribution: axis.weighted_score,
        source_record_ids: axis.source_record_ids,
      };
    }),
    parent_axis_contributions: parentContributions(config, entry.per_axis_breakdown),
    partial_observed_score: entry.observed_score,
    legacy_engine_coverage: {
      criterion_count: entry.data_coverage,
      represented_parent_presence: activeParents.length === 0 ? 0 : round(coveredParents.length / activeParents.length),
      weighted: entry.weighted_data_coverage,
    },
    confidence: entry.confidence,
    missing_criteria: definition.axis_weights
      .map((axis) => axis.axis_id)
      .filter((axisId) => !entry.per_axis_breakdown.some((item) => item.axis_id === axisId))
      .map((criterionId) => ({ criterion_id: criterionId, reason: omissions[criterionId] ?? "unavailable" })),
    baseline_partial_score_delta: null,
    baseline_rank_change: null,
  };
}

function pairRelations(entries) {
  const relations = new Map();
  const sortedIds = entries.map((entry) => entry.product_analysis_id).sort(compareString);
  for (let left = 0; left < sortedIds.length; left += 1) {
    for (let right = left + 1; right < sortedIds.length; right += 1) {
      const a = entries.find((entry) => entry.product_analysis_id === sortedIds[left]);
      const b = entries.find((entry) => entry.product_analysis_id === sortedIds[right]);
      relations.set(`${a.product_analysis_id}|${b.product_analysis_id}`,
        a.trial_rank === b.trial_rank ? "tie" : a.trial_rank < b.trial_rank ? `${a.product_analysis_id}>${b.product_analysis_id}` : `${b.product_analysis_id}>${a.product_analysis_id}`);
    }
  }
  return relations;
}

function runPattern(config, snapshot, rubric, scenario, pattern, runtime) {
  const built = buildBundle(config, snapshot, rubric, scenario, pattern, runtime);
  const result = calculateRankingResult(built.bundle);
  const entries = result.entries.map((entry) => entryOutput(
    config,
    snapshot,
    built.bundle.definition,
    entry,
    built.derived.omissions.get(entry.product_identity_id) ?? {},
  ));
  const eligibility = built.eligibility.map(({ product, result: eligibilityResult }) => ({
    product_analysis_id: product.analysis_product_id,
    eligibility: eligibilityResult.status,
    participation_status: eligibilityResult.participation_status,
    reasons: eligibilityResult.reasons,
    missing_required_inputs: eligibilityResult.missing_required_inputs,
  }));
  const productIdToAnalysis = new Map(snapshot.products.map((product) => [product.product_identity_id, product.analysis_product_id]));
  const onHold = [
    ...built.eligibility
      .filter((item) => item.result.status === "unknown")
      .map((item) => ({
        product_analysis_id: item.product.analysis_product_id,
        reason_code: "scenario_eligibility_unknown",
        reason: item.result.reasons.join(","),
      legacy_engine_coverage: null,
        confidence: null,
        quality_interpretation: "not_low_quality",
      })),
    ...result.on_hold.map((item) => ({
      product_analysis_id: productIdToAnalysis.get(item.product_identity_id),
      reason_code: item.reason_code,
      reason: item.reason,
      legacy_engine_coverage: { criterion_count: item.data_coverage, weighted: item.weighted_data_coverage },
      confidence: item.confidence,
      quality_interpretation: "not_low_quality",
    })),
  ];
  return {
    scenario: scenario.scenario_id,
    eligibility_scenario: scenario.eligibility_scenario_id,
    pattern_id: pattern.pattern_id,
    pattern_kind: pattern.kind,
    rubric_version: config.rubric_version,
    changes: pattern.changes,
    parent_weights: patternParentWeights(config, pattern),
    boundaries: built.derived.boundaries,
    coverage_condition: {
      min_data_coverage: built.bundle.definition.min_data_coverage.value,
      min_weighted_data_coverage: built.bundle.definition.min_weighted_data_coverage.value,
      value_status: "proposed",
    },
    eligibility,
    entries,
    on_hold: onHold,
    excluded: eligibility.filter((item) => item.eligibility === "ineligible"),
    not_applicable: eligibility.filter((item) => item.eligibility === "not_applicable"),
    pairwise_reversals: [],
    pairwise_tie_transitions: [],
    pairwise_incomparable_transitions: [],
    primary_change_cause: null,
    engine_input_hash: result.input_hash,
    calculation_status: entries.length > 0 ? "private_trial_only" : "no_comparable_scored_entries",
  };
}

function compareWithBaseline(patternResult, baseline) {
  const baselineEntries = new Map(baseline.entries.map((entry) => [entry.product_analysis_id, entry]));
  const currentEntries = new Map(patternResult.entries.map((entry) => [entry.product_analysis_id, entry]));
  for (const entry of patternResult.entries) {
    const base = baselineEntries.get(entry.product_analysis_id);
    if (base) {
      entry.baseline_partial_score_delta = round(entry.partial_observed_score - base.partial_observed_score);
      entry.baseline_rank_change = entry.trial_rank - base.trial_rank;
    }
  }
  const baselineRelations = pairRelations(baseline.entries);
  const currentRelations = pairRelations(patternResult.entries);
  for (const [pair, relation] of baselineRelations) {
    if (!currentRelations.has(pair)) {
      patternResult.pairwise_incomparable_transitions.push({ pair: pair.split("|"), baseline_order: relation, varied_order: "incomparable_or_on_hold" });
    } else if (currentRelations.get(pair) !== relation) {
      const varied = currentRelations.get(pair);
      const change = { pair: pair.split("|"), baseline_order: relation, varied_order: varied };
      if (relation === "tie" || varied === "tie") patternResult.pairwise_tie_transitions.push(change);
      else patternResult.pairwise_reversals.push(change);
    }
  }
  if (patternResult.pairwise_reversals.length > 0
    || patternResult.pairwise_tie_transitions.length > 0
    || patternResult.pairwise_incomparable_transitions.length > 0) {
    patternResult.primary_change_cause = patternResult.changes;
  }
}

function boundaryAudit(config, snapshot, rubric) {
  const boundaries = boundaryMap(rubric);
  return snapshot.products.map((product) => ({
    product_analysis_id: product.analysis_product_id,
    checks: config.criteria
      .filter((criterion) => criterion.boundary_id)
      .map((criterion) => {
        const value = product.raw_facts[criterion.raw_fact_id]?.value;
        if (typeof value !== "number") {
          return { criterion_id: criterion.criterion_id, value: null, unit: product.raw_facts[criterion.raw_fact_id]?.unit ?? null, status: "not_evaluable_missing", nearest_boundary: null, within_five_percent: null };
        }
        const candidates = boundaries[criterion.boundary_id];
        const nearest = [...candidates].sort((a, b) => Math.abs(value - a) - Math.abs(value - b))[0];
        return {
          criterion_id: criterion.criterion_id,
          value,
          unit: product.raw_facts[criterion.raw_fact_id].unit,
          status: "diagnostic_only",
          nearest_boundary: nearest,
          distance: round(value - nearest),
          within_five_percent: value * 0.95 <= nearest && nearest <= value * 1.05,
          interpretation: "not_measurement_error_or_manufacturer_tolerance",
        };
      }),
  }));
}

function stabilitySummary(scenario, results) {
  const baseline = results.find((result) => result.pattern_id === "baseline");
  const baselineRelations = pairRelations(baseline.entries);
  const pairStats = [...baselineRelations].map(([pair, relation]) => {
    let comparable = 0;
    let unchanged = 0;
    let reversed = 0;
    let tieTransitions = 0;
    let incomparable = 0;
    for (const result of results.filter((item) => item.pattern_id !== "baseline")) {
      const current = pairRelations(result.entries);
      if (!current.has(pair)) {
        incomparable += 1;
      } else {
        comparable += 1;
        const varied = current.get(pair);
        if (varied === relation) unchanged += 1;
        else if (varied === "tie" || relation === "tie") tieTransitions += 1;
        else reversed += 1;
      }
    }
    return {
      pair: pair.split("|"),
      baseline_order: relation,
      comparable_pattern_count: comparable,
      unchanged_count: unchanged,
      reversal_count: reversed,
      tie_transition_count: tieTransitions,
      relation_change_count: reversed + tieTransitions,
      incomparable_transition_count: incomparable,
      stability_rate_when_comparable: comparable === 0 ? null : round(unchanged / comparable),
    };
  });
  return {
    scenario: scenario.scenario_id,
    baseline_trial_entry_count: baseline.entries.length,
    evaluated_pattern_count: results.length,
    pairwise_stability: pairStats,
    total_reversals: pairStats.reduce((sum, item) => sum + item.reversal_count, 0),
    total_tie_transitions: pairStats.reduce((sum, item) => sum + item.tie_transition_count, 0),
    total_incomparable_transitions: pairStats.reduce((sum, item) => sum + item.incomparable_transition_count, 0),
    unstable_pattern_ids: results
      .filter((result) => result.pairwise_reversals.length > 0
        || result.pairwise_tie_transitions.length > 0
        || result.pairwise_incomparable_transitions.length > 0)
      .map((result) => result.pattern_id),
    coverage_hold_patterns: results
      .filter((result) => result.pattern_kind === "coverage")
      .map((result) => ({ pattern_id: result.pattern_id, on_hold_count: result.on_hold.length, trial_entry_count: result.entries.length })),
  };
}

function partialObservedScore(built, product) {
  const candidate = built.bundle.input.candidates.find((item) => item.product_identity_id === product.product_identity_id);
  if (!candidate) return null;
  const metrics = calculateCandidateMetrics(
    built.bundle.definition,
    candidate.feature_refs,
    built.bundle.normalized_features,
    built.bundle.evidence_claims,
    built.bundle.source_records,
  );
  return calculateObservedScore(metrics.contexts).observed_score;
}

function criterionEvidenceState(fact, omissionReason, scoreable) {
  if (scoreable) return "scoreable";
  if (fact?.evidence_status === "conflicting" || fact?.conflict === true) return "unresolved_conflict";
  if (omissionReason === "measurement_scope_not_comparable_in_scenario"
    || omissionReason?.includes("measurement_scope_mismatch")) return "not_comparable";
  return "unknown";
}

function coverageCriterionObservations(config, built, product, eligibilityResult) {
  const weightMap = new Map(built.bundle.definition.axis_weights.map((axis) => [axis.axis_id, axis.weight]));
  const scoreableIds = new Set(built.derived.features
    .filter((feature) => feature.product_identity_id === product.product_identity_id)
    .map((feature) => feature.axis_id));
  const omissions = built.derived.omissions.get(product.product_identity_id) ?? {};
  return config.criteria.map((criterion) => {
    const fact = product.raw_facts[criterion.raw_fact_id];
    const scenarioApplicable = !["ineligible", "not_applicable"].includes(eligibilityResult.status);
    const omissionReason = omissions[criterion.criterion_id]
      ?? fact?.unavailable_reason
      ?? (fact?.evidence_status ? `evidence_status_${fact.evidence_status}` : "raw_fact_missing");
    const scoreable = scenarioApplicable && scoreableIds.has(criterion.criterion_id);
    return {
      criterion_id: criterion.criterion_id,
      parent_axis_id: criterion.parent_axis,
      weight: weightMap.get(criterion.criterion_id),
      applicability: scenarioApplicable ? "applicable" : "not_applicable",
      evidence_state: criterionEvidenceState(fact, omissionReason, scoreable),
      reason_codes: scoreable ? [] : [omissionReason],
    };
  });
}

function eligibilityConflictCount(product) {
  const eligibilityFactIds = ["target_age_min_months", "target_age_max_months", "max_child_weight_kg"];
  return eligibilityFactIds.filter((factId) => {
    const fact = product.raw_facts[factId];
    return fact?.conflict === true || fact?.evidence_status === "conflicting";
  }).length;
}

function legacyBaselineState(baseline, productAnalysisId) {
  if (baseline.entries.some((entry) => entry.product_analysis_id === productAnalysisId)) return "trial_scored";
  const eligibility = baseline.eligibility.find((item) => item.product_analysis_id === productAnalysisId);
  if (eligibility?.eligibility === "not_applicable" || eligibility?.eligibility === "ineligible") return "not_applicable";
  if (baseline.on_hold.some((item) => item.product_analysis_id === productAnalysisId)) return "on_hold";
  return "not_evaluated";
}

function buildCoverageAnalysis(config, snapshot, rubric, runtime, contract, profileSet, patternResults) {
  const validation = validateCoverageConfiguration(contract, profileSet);
  if (validation.result !== "pass") {
    throw new Error(`coverage configuration invalid: ${JSON.stringify(validation.issues)}`);
  }
  const results = [];
  const scenarioProfileSummary = [];
  for (const scenario of config.analysis_scenarios) {
    const pattern = { pattern_id: "baseline", kind: "baseline", changes: {} };
    const built = buildBundle(config, snapshot, rubric, scenario, pattern, runtime);
    const baseline = patternResults.find((item) => item.scenario === scenario.scenario_id && item.pattern_id === "baseline");
    const eligibilityMap = new Map(built.eligibility.map((item) => [item.product.product_identity_id, item.result]));
    const assessmentInputs = snapshot.products.map((product) => {
      const eligibility = eligibilityMap.get(product.product_identity_id);
      return {
        candidate_id: product.analysis_product_id,
        scenario_id: scenario.scenario_id,
        benchmark_segment: product.benchmark_segment,
        scenario_eligibility: eligibility.status,
        scenario_reason_codes: eligibility.reasons,
        eligibility_unresolved_conflict_count: ["eligible", "unknown"].includes(eligibility.status)
          ? eligibilityConflictCount(product)
          : 0,
        partial_observed_score: eligibility.status === "eligible" ? partialObservedScore(built, product) : null,
        criteria: coverageCriterionObservations(config, built, product, eligibility),
      };
    });
    const assessments = assessmentInputs.map((input) => evaluateCandidateCoverage(input, contract, profileSet));
    for (const profile of profileSet.profiles) {
      const participating = assessments
        .filter((assessment) => assessment.profile_assessments
          .find((item) => item.profile_id === profile.profile_id)?.score_state !== "ineligible_for_scenario")
        .map((assessment) => ({
          candidate_id: assessment.candidate_id,
          scenario_id: assessment.scenario_id,
          benchmark_segment: assessment.benchmark_segment,
          profile_assessment: assessment.profile_assessments.find((item) => item.profile_id === profile.profile_id),
        }));
      const finalized = finalizeScenarioRankingEligibility(participating, profile);
      for (const assessment of assessments) {
        const profileAssessment = assessment.profile_assessments.find((item) => item.profile_id === profile.profile_id);
        const candidateResult = finalized.candidate_results.find((item) => item.candidate_id === assessment.candidate_id);
        profileAssessment.ranking_eligibility = candidateResult?.ranking_eligibility ?? false;
        if (candidateResult && !candidateResult.ranking_eligibility) {
          profileAssessment.reason_codes = uniqueSorted([...profileAssessment.reason_codes, ...candidateResult.reason_codes]);
        }
      }
      scenarioProfileSummary.push({
        scenario_id: scenario.scenario_id,
        profile_id: profile.profile_id,
        value_status: "proposed",
        score_display_eligible_count: assessments.filter((assessment) => assessment.profile_assessments
          .find((item) => item.profile_id === profile.profile_id)?.score_display_eligibility).length,
        ranking_candidate_eligible_count: finalized.eligible_candidate_count,
        ranking_eligible_count: finalized.candidate_results.filter((item) => item.ranking_eligibility).length,
        minimum_eligible_candidate_count: finalized.minimum_eligible_candidate_count,
        ranking_generation_eligible: finalized.ranking_generation_eligible,
        ranking_generated: false,
        reason_codes: finalized.reason_codes,
      });
    }
    for (const [index, assessment] of assessments.entries()) {
      const input = assessmentInputs[index];
      const reference = assessment.profile_assessments.find((item) => item.profile_id === config.coverage_reference_profile_id);
      const metrics = assessment.metrics;
      results.push({
        product_analysis_id: assessment.candidate_id,
        scenario_id: assessment.scenario_id,
        benchmark_segment: assessment.benchmark_segment,
        scenario_eligibility: input.scenario_eligibility,
        scenario_reason_codes: input.scenario_reason_codes,
        criterion_observations: assessment.criterion_observations,
        criterion_coverage: metrics?.criterion_coverage ?? null,
        parent_axis_coverage: metrics?.parent_axis_coverage ?? null,
        weighted_coverage: metrics?.weighted_coverage ?? null,
        represented_parent_count: metrics?.parent_axis_coverage.represented_parent_count ?? null,
        unresolved_conflict_count: metrics?.unresolved_conflict_count ?? input.eligibility_unresolved_conflict_count,
        comparison_blockers: metrics?.comparison_blockers ?? [],
        score_state: reference.score_state,
        reference_profile_id: config.coverage_reference_profile_id,
        partial_observed_score: assessment.partial_observed_score,
        total_quality_score: null,
        total_quality_score_display_eligibility: reference.score_display_eligibility,
        total_quality_score_displayed: false,
        ranking_eligibility: reference.ranking_eligibility,
        ranking_generated: false,
        baseline_state_change: {
          from: legacyBaselineState(baseline, assessment.candidate_id),
          to: reference.score_state,
          reason_codes: reference.reason_codes,
        },
        analysis_errors: assessment.analysis_errors,
        profile_assessments: assessment.profile_assessments,
      });
    }
  }
  return {
    reference_profile_id: config.coverage_reference_profile_id,
    profile_value_status: "proposed",
    ranking_generated: false,
    total_quality_scores_generated: false,
    results,
    scenario_profile_summary: scenarioProfileSummary,
  };
}

export function buildAnalysis() {
  const config = readJson(configPath);
  const snapshot = readJson(snapshotPath);
  const verification = verifySnapshot(snapshot);
  if (verification.result !== "pass") throw new Error(`snapshot fingerprint mismatch: ${JSON.stringify(verification.checks.filter((item) => item.result === "fail"))}`);
  const rubric = readJson(resolve(repoRoot, config.rubric_ref));
  const coverageContract = readJson(resolve(repoRoot, config.coverage_contract_ref));
  const coverageProfiles = readJson(resolve(repoRoot, config.coverage_profiles_ref));
  const runtime = loadRuntimeRecords(snapshot);
  const patterns = createPatternSuite(config, rubric);
  const patternResults = [];
  const summaries = [];
  for (const scenario of config.analysis_scenarios) {
    const results = patterns.map((pattern) => runPattern(config, snapshot, rubric, scenario, pattern, runtime));
    const baseline = results.find((result) => result.pattern_id === "baseline");
    for (const result of results) compareWithBaseline(result, baseline);
    patternResults.push(...results);
    summaries.push(stabilitySummary(scenario, results));
  }
  const coverageAnalysis = buildCoverageAnalysis(
    config,
    snapshot,
    rubric,
    runtime,
    coverageContract,
    coverageProfiles,
    patternResults,
  );
  return {
    analysis_id: config.analysis_id,
    generated_at: fixedTimestamp,
    status: config.status,
    publication_status: "draft",
    private_non_public: true,
    disclaimer: config.output_disclaimer,
    snapshot_id: snapshot.snapshot_id,
    snapshot_sha256: sha256File(snapshotPath),
    config_sha256: sha256File(configPath),
    rubric_id: rubric.rubric_id,
    rubric_version: config.rubric_version,
    engine_calc_version: config.engine_calc_version,
    coverage_contract: {
      contract_id: coverageContract.contract_id,
      status: coverageContract.status,
      publication_status: coverageContract.publication_status,
      contract_ref: config.coverage_contract_ref,
      contract_sha256: sha256File(resolve(repoRoot, config.coverage_contract_ref)),
      profile_set_id: coverageProfiles.profile_set_id,
      profiles_ref: config.coverage_profiles_ref,
      profiles_sha256: sha256File(resolve(repoRoot, config.coverage_profiles_ref)),
      schema_ref: config.coverage_schema_ref,
      schema_sha256: sha256File(resolve(repoRoot, config.coverage_schema_ref)),
    },
    snapshot_verification: verification,
    proposed_settings: {
      allocation: config.allocation_assumption,
      score_policy: config.score_policy,
      sensitivity_patterns: config.sensitivity_patterns,
      coverage_profiles: coverageProfiles.profiles,
    },
    scenarios: config.analysis_scenarios.map((scenario) => ({
      scenario_id: scenario.scenario_id,
      eligibility_scenario_id: scenario.eligibility_scenario_id,
      benchmark_segment: scenario.benchmark_segment,
      weight_scope_policy: scenario.weight_scope_policy,
      purpose: scenario.purpose,
    })),
    boundary_proximity_audit: boundaryAudit(config, snapshot, rubric),
    stability_summary: summaries,
    coverage_analysis: coverageAnalysis,
    pattern_results: patternResults,
    safeguards: {
      scenario_segments_disjoint: true,
      ineligible_zero_scored: false,
      unknown_zero_or_false_coercion: false,
      basket_cross_unit_conversion: false,
      measurement_scope_gate_applied: true,
      maneuverability_scored: false,
      external_or_popularity_signal_scored: false,
      editorial_composite_double_scored: false,
      unconfirmed_scoring_limited_to_analysis_derived_features_from_confirmed_raw: true,
      source_values_rewritten: false,
      coverage_contract_applied: true,
      criterion_parent_and_weighted_coverage_separated: true,
      parent_single_criterion_complete_allowed: false,
      partial_score_public_total_separated: true,
      score_display_eligibility_separate: true,
      ranking_eligibility_separate: true,
      total_quality_scores_generated: false,
      rankings_generated_by_coverage_contract: false,
      coverage_profiles_remain_proposed: true,
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const analysis = buildAnalysis();
  writeFileSync(outputPath, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
  console.log(`wrote ${outputPath}`);
  console.log(JSON.stringify(analysis.stability_summary, null, 2));
}
