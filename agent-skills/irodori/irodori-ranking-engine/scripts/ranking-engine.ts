import {
  type AxisScoringRule,
  type AxisWeight,
  type EvidenceClaim,
  type NormalizedFeature,
  type NormalizedValue,
  type PerAxisBreakdown,
  type ProductIdentity,
  type RankingDefinition,
  type RankingDisposition,
  type RankingEntry,
  type RankingExecutionBundle,
  type RankingResult,
  type SensitivityNote,
  type SourceRecord,
  type ValidationReport,
} from "../../shared/contracts/types.ts";
import { validateRankingExecutionBundle } from "../../shared/contracts/validators.ts";

const ROUND_DIGITS = 6;
const RELIABILITY_POINTS = { high: 1, medium: 0.65, low: 0.3 } as const;

export interface SelectedEvidence {
  claims: EvidenceClaim[];
  claim_ids: string[];
  sources: SourceRecord[];
  source_ids: string[];
}

export interface CandidateAxisContext {
  axis: AxisWeight;
  feature: NormalizedFeature | null;
  evidence: SelectedEvidence;
  usable: boolean;
  unresolved_conflict: boolean;
  outdated: boolean;
}

export interface CandidateMetrics {
  data_coverage: number;
  confidence: number;
  contexts: CandidateAxisContext[];
  unconfirmed_axes: string[];
}

interface CandidateEvaluation {
  kind: "ranked" | "on_hold" | "excluded";
  entry?: RankingEntry;
  disposition?: RankingDisposition;
}

export class RankingInputValidationError extends Error {
  readonly validation: ValidationReport<RankingExecutionBundle>;

  constructor(validation: ValidationReport<RankingExecutionBundle>) {
    const details = validation.issues
      .map((issue) => issue.path + ": " + issue.message)
      .join("\n");
    super("ranking input validation failed\n" + details);
    this.name = "RankingInputValidationError";
    this.validation = validation;
  }
}

function round(value: number, digits = ROUND_DIGITS): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function compareString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort(compareString);
}

export function validateRankingInput(
  bundle: unknown,
): ValidationReport<RankingExecutionBundle> {
  return validateRankingExecutionBundle(bundle);
}

const UNIT_FACTORS: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  g: { g: 1, kg: 0.001 },
  kg: { g: 1000, kg: 1 },
  mm: { mm: 1, cm: 0.1, m: 0.001 },
  cm: { mm: 10, cm: 1, m: 0.01 },
  m: { mm: 1000, cm: 100, m: 1 },
  mL: { mL: 1, L: 0.001 },
  L: { mL: 1000, L: 1 },
};

/**
 * Return null when conversion is unavailable. Missing values never become zero.
 */
export function normalizeNumericValue(
  value: number | null,
  fromUnit: string | null,
  toUnit: string,
): number | null {
  if (value === null || !Number.isFinite(value) || fromUnit === null) return null;
  const factor = UNIT_FACTORS[fromUnit]?.[toUnit];
  return factor === undefined ? null : round(value * factor, 9);
}

function dimensionsMetric(value: NormalizedValue, rule: Extract<AxisScoringRule, { kind: "dimensions" }>): number | null {
  if (typeof value !== "object" || value === null || !("width_mm" in value)) return null;
  const dimensions = value as { width_mm: number | null; depth_mm: number | null; height_mm: number | null };
  if (rule.metric === "width_mm") return dimensions.width_mm;
  if (rule.metric === "depth_mm") return dimensions.depth_mm;
  if (rule.metric === "height_mm") return dimensions.height_mm;
  const available = [dimensions.width_mm, dimensions.depth_mm, dimensions.height_mm]
    .filter((dimension): dimension is number => typeof dimension === "number" && Number.isFinite(dimension));
  if (rule.metric === "max_dimension_mm") {
    return available.length === 3 ? Math.max(...available) : null;
  }
  if (rule.metric === "volume_mm3") {
    return available.length === 3
      ? dimensions.width_mm! * dimensions.depth_mm! * dimensions.height_mm!
      : null;
  }
  return null;
}

function numericScore(value: number, direction: "lower_better" | "higher_better", best: number, worst: number): number {
  const score = direction === "lower_better"
    ? ((worst - value) / (worst - best)) * 100
    : ((value - worst) / (best - worst)) * 100;
  return round(clamp(score, 0, 100));
}

/**
 * Convert a confirmed feature value into a 0..100 axis score.
 * null means unscoreable, not zero performance.
 */
export function scoreAxisValue(feature: NormalizedFeature, rule: AxisScoringRule): number | null {
  if (feature.value === null) return null;
  if (rule.kind === "numeric") {
    if (typeof feature.value !== "number") return null;
    const normalized = normalizeNumericValue(feature.value, feature.unit, rule.unit);
    return normalized === null
      ? null
      : numericScore(normalized, rule.direction, rule.best, rule.worst);
  }
  if (rule.kind === "dimensions") {
    const metric = dimensionsMetric(feature.value, rule);
    return metric === null
      ? null
      : numericScore(metric, rule.direction, rule.best, rule.worst);
  }
  if (rule.kind === "boolean") {
    return typeof feature.value === "boolean"
      ? feature.value === rule.preferred_value ? 100 : 0
      : null;
  }
  if (rule.kind === "ordinal") {
    if (typeof feature.value !== "string") return null;
    const points = rule.points[feature.value as keyof typeof rule.points];
    return typeof points === "number" ? round(points) : null;
  }
  return null;
}

/**
 * Remove duplicate claims deterministically. Claims marked duplicate_of never
 * contribute a second independent source, regardless of input order.
 */
export function deduplicateEvidence(
  feature: NormalizedFeature,
  allClaims: EvidenceClaim[],
  allSources: SourceRecord[],
): SelectedEvidence {
  const claimMap = new Map(allClaims.map((claim) => [claim.evidence_claim_id, claim]));
  const sourceMap = new Map(allSources.map((source) => [source.source_record_id, source]));
  const claims = sortedUnique(feature.supporting_claims)
    .map((claimId) => claimMap.get(claimId))
    .filter((claim): claim is EvidenceClaim => claim !== undefined)
    .filter((claim) => claim.duplicate_of === null)
    .sort((a, b) => compareString(a.evidence_claim_id, b.evidence_claim_id));
  const sourceIds = sortedUnique(claims.map((claim) => claim.source_record_id));
  const sources = sourceIds
    .map((sourceId) => sourceMap.get(sourceId))
    .filter((source): source is SourceRecord => source !== undefined)
    .sort((a, b) => compareString(a.source_record_id, b.source_record_id));
  return {
    claims,
    claim_ids: claims.map((claim) => claim.evidence_claim_id),
    sources,
    source_ids: sources.map((source) => source.source_record_id),
  };
}

function createFeatureMap(
  candidateFeatureIds: string[],
  features: NormalizedFeature[],
): Map<string, NormalizedFeature> {
  const featureIdSet = new Set(candidateFeatureIds);
  const selected = features
    .filter((feature) => featureIdSet.has(feature.normalized_feature_id))
    .sort((a, b) => compareString(a.normalized_feature_id, b.normalized_feature_id));
  const result = new Map<string, NormalizedFeature>();
  for (const feature of selected) {
    if (result.has(feature.axis_id)) {
      throw new Error("candidate has multiple normalized features for axis " + feature.axis_id);
    }
    result.set(feature.axis_id, feature);
  }
  return result;
}

function unresolvedConflict(feature: NormalizedFeature, evidence: SelectedEvidence): boolean {
  return feature.evidence_status === "conflicting"
    || evidence.claims.some((claim) => claim.evidence_status === "conflicting" || claim.conflict_with.length > 0);
}

export function buildCandidateAxisContexts(
  definition: RankingDefinition,
  featureRefs: string[],
  allFeatures: NormalizedFeature[],
  allClaims: EvidenceClaim[],
  allSources: SourceRecord[],
): CandidateAxisContext[] {
  const features = createFeatureMap(featureRefs, allFeatures);
  return [...definition.axis_weights]
    .sort((a, b) => compareString(a.axis_id, b.axis_id))
    .map((axis) => {
      const feature = features.get(axis.axis_id) ?? null;
      const evidence = feature === null
        ? { claims: [], claim_ids: [], sources: [], source_ids: [] }
        : deduplicateEvidence(feature, allClaims, allSources);
      const conflict = feature !== null && unresolvedConflict(feature, evidence);
      const outdated = feature?.evidence_status === "outdated"
        || evidence.claims.some((claim) => claim.evidence_status === "outdated");
      const accepted = feature !== null
        && definition.evidence_policy.accepted_statuses.includes(feature.evidence_status);
      const scoreable = feature !== null && scoreAxisValue(feature, axis.scoring_rule) !== null;
      const traceable = evidence.claims.length > 0 && evidence.sources.length > 0;
      return {
        axis,
        feature,
        evidence,
        usable: accepted && scoreable && traceable && !conflict && !outdated,
        unresolved_conflict: conflict,
        outdated,
      };
    });
}

export function calculateDataCoverage(contexts: CandidateAxisContext[]): number {
  if (contexts.length === 0) return 0;
  return round(contexts.filter((context) => context.usable).length / contexts.length);
}

function average(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Proposed confidence formula. This value gates/qualifies results and never
 * contributes to product score.
 */
export function calculateConfidence(
  definition: RankingDefinition,
  contexts: CandidateAxisContext[],
  dataCoverage: number,
): number {
  const usable = contexts.filter((context) => context.usable);
  const target = definition.confidence_config.independent_sources_target_per_axis;
  const sourceIndependence = average(
    usable.map((context) => clamp(context.evidence.source_ids.length / target, 0, 1)),
  );
  const primaryRatio = average(
    usable.map((context) => context.evidence.sources.some((source) => source.primary_or_secondary === "primary") ? 1 : 0),
  );
  const reliability = average(
    usable.map((context) => average(
      context.evidence.claims.map((claim) => RELIABILITY_POINTS[claim.reliability.level]),
    )),
  );
  const config = definition.confidence_config;
  return round(
    dataCoverage * config.data_coverage_weight
      + sourceIndependence * config.source_independence_weight
      + primaryRatio * config.primary_source_weight
      + reliability * config.reliability_weight,
  );
}

export function calculateCandidateMetrics(
  definition: RankingDefinition,
  featureRefs: string[],
  allFeatures: NormalizedFeature[],
  allClaims: EvidenceClaim[],
  allSources: SourceRecord[],
): CandidateMetrics {
  const contexts = buildCandidateAxisContexts(
    definition,
    featureRefs,
    allFeatures,
    allClaims,
    allSources,
  );
  const dataCoverage = calculateDataCoverage(contexts);
  const confidence = calculateConfidence(definition, contexts, dataCoverage);
  return {
    data_coverage: dataCoverage,
    confidence,
    contexts,
    unconfirmed_axes: contexts.filter((context) => !context.usable).map((context) => context.axis.axis_id),
  };
}

function disqualificationReasons(product: ProductIdentity, definition: RankingDefinition): string[] {
  const reasons: string[] = [];
  for (const rule of definition.disqualification_rules) {
    if (rule.rule === "require_current_lifecycle" && product.lifecycle_status !== "current") {
      reasons.push(rule.reason_template);
    }
    if (rule.rule === "require_identified_product" && product.identification_status !== "identified") {
      reasons.push(rule.reason_template);
    }
    if (rule.rule === "require_market_match" && product.market !== rule.expected_market) {
      reasons.push(rule.reason_template);
    }
  }
  return sortedUnique(reasons);
}

export function calculateWeightedScore(contexts: CandidateAxisContext[]): {
  score: number | null;
  breakdown: PerAxisBreakdown[];
} {
  const scored = contexts
    .filter((context) => context.usable && context.feature !== null)
    .map((context) => ({
      context,
      axisScore: scoreAxisValue(context.feature!, context.axis.scoring_rule),
    }))
    .filter((item): item is { context: CandidateAxisContext & { feature: NormalizedFeature }; axisScore: number } =>
      item.axisScore !== null,
    );
  const weightTotal = scored.reduce((sum, item) => sum + item.context.axis.weight, 0);
  if (scored.length === 0 || weightTotal <= 0) return { score: null, breakdown: [] };

  const breakdown = scored
    .map(({ context, axisScore }) => {
      const normalizedWeight = context.axis.weight / weightTotal;
      return {
        axis_id: context.axis.axis_id,
        normalized_feature_id: context.feature.normalized_feature_id,
        value: context.feature.value!,
        raw_axis_score: round(axisScore),
        normalized_weight: round(normalizedWeight),
        weighted_score: round(axisScore * normalizedWeight),
        evidence_status: context.feature.evidence_status,
        evidence_claim_ids: context.evidence.claim_ids,
        source_record_ids: context.evidence.source_ids,
      } satisfies PerAxisBreakdown;
    })
    .sort((a, b) => compareString(a.axis_id, b.axis_id));
  return {
    score: round(breakdown.reduce((sum, item) => sum + item.weighted_score, 0)),
    breakdown,
  };
}

function createReasonText(breakdown: PerAxisBreakdown[]): string {
  const leading = [...breakdown]
    .sort((a, b) => b.weighted_score - a.weighted_score || compareString(a.axis_id, b.axis_id))
    .slice(0, 2)
    .map((item) => item.axis_id);
  return leading.length === 0
    ? "評価可能な軸がありません。"
    : "試験設定では " + leading.join("、") + " の寄与が大きい結果です。";
}

function onHoldReason(metrics: CandidateMetrics, definition: RankingDefinition): { code: string; reason: string } | null {
  const conflicts = metrics.contexts
    .filter((context) => context.unresolved_conflict)
    .map((context) => context.axis.axis_id);
  if (conflicts.length > 0 && definition.evidence_policy.unresolved_conflict === "hold") {
    return { code: "unresolved_conflict", reason: "未解決の矛盾: " + conflicts.join(", ") };
  }
  const outdated = metrics.contexts.filter((context) => context.outdated).map((context) => context.axis.axis_id);
  if (outdated.length > 0 && definition.evidence_policy.outdated === "hold") {
    return { code: "outdated_evidence", reason: "古い証拠の再確認が必要: " + outdated.join(", ") };
  }
  const missingRequired = definition.required_axes.axes.filter((axisId) =>
    !metrics.contexts.some((context) => context.axis.axis_id === axisId && context.usable),
  );
  if (missingRequired.length > 0) {
    return { code: "required_axis_missing", reason: "必須軸が未確認: " + missingRequired.join(", ") };
  }
  if (metrics.data_coverage < definition.min_data_coverage.value) {
    return {
      code: definition.missing_data_policy.below_min_coverage === "reference"
        ? "reference_only"
        : "insufficient_data",
      reason: "data_coverage " + metrics.data_coverage + " が試験閾値 "
        + definition.min_data_coverage.value + " 未満",
    };
  }
  return null;
}

function evaluateCandidate(
  product: ProductIdentity,
  featureRefs: string[],
  definition: RankingDefinition,
  bundle: RankingExecutionBundle,
): CandidateEvaluation {
  const disqualifications = disqualificationReasons(product, definition);
  if (disqualifications.length > 0) {
    return {
      kind: "excluded",
      disposition: {
        product_identity_id: product.product_identity_id,
        reason: disqualifications.join(" / "),
        reason_code: "disqualified",
        data_coverage: null,
        confidence: null,
      },
    };
  }

  const metrics = calculateCandidateMetrics(
    definition,
    featureRefs,
    bundle.normalized_features,
    bundle.evidence_claims,
    bundle.source_records,
  );
  const hold = onHoldReason(metrics, definition);
  if (hold !== null) {
    return {
      kind: "on_hold",
      disposition: {
        product_identity_id: product.product_identity_id,
        reason: hold.reason,
        reason_code: hold.code,
        data_coverage: metrics.data_coverage,
        confidence: metrics.confidence,
      },
    };
  }

  const weighted = calculateWeightedScore(metrics.contexts);
  if (weighted.score === null) {
    return {
      kind: "on_hold",
      disposition: {
        product_identity_id: product.product_identity_id,
        reason: "評価可能な軸がありません",
        reason_code: "no_scoreable_axes",
        data_coverage: metrics.data_coverage,
        confidence: metrics.confidence,
      },
    };
  }

  return {
    kind: "ranked",
    entry: {
      rank: 0,
      product_identity_id: product.product_identity_id,
      score: weighted.score,
      data_coverage: metrics.data_coverage,
      confidence: metrics.confidence,
      per_axis_breakdown: weighted.breakdown,
      reason_text: createReasonText(weighted.breakdown),
      strengths: weighted.breakdown.filter((axis) => axis.raw_axis_score >= 75).map((axis) => axis.axis_id),
      cautions: weighted.breakdown.filter((axis) => axis.raw_axis_score <= 40).map((axis) => axis.axis_id),
      unconfirmed_axes: metrics.unconfirmed_axes,
      tie_note: null,
    },
  };
}

function compareForRank(a: RankingEntry, b: RankingEntry, definition: RankingDefinition): number {
  const scoreDifference = round(b.score - a.score);
  if (scoreDifference !== 0) return scoreDifference;
  for (const rule of definition.tie_breaker_rules.ordered_rules) {
    if (rule === "data_coverage_desc") {
      const difference = round(b.data_coverage - a.data_coverage);
      if (difference !== 0) return difference;
    } else if (rule === "confidence_desc") {
      const difference = round(b.confidence - a.confidence);
      if (difference !== 0) return difference;
    } else if (rule === "tie_allowed") {
      return 0;
    }
  }
  return 0;
}

/**
 * Stable competition ranking. Equal entries receive the same rank; product ID
 * is used only for deterministic display order and never as a product score.
 */
export function assignStableRanks(entries: RankingEntry[], definition: RankingDefinition): RankingEntry[] {
  const sorted = [...entries].sort((a, b) =>
    compareForRank(a, b, definition) || compareString(a.product_identity_id, b.product_identity_id),
  );
  const ranked = sorted.map((entry, index) => {
    const previous = index > 0 ? sorted[index - 1] : null;
    const tied = previous !== null && compareForRank(previous, entry, definition) === 0;
    const rank = tied ? 0 : index + 1;
    return { ...entry, rank };
  });
  for (let index = 0; index < ranked.length; index += 1) {
    if (ranked[index].rank === 0) ranked[index].rank = ranked[index - 1].rank;
  }
  const rankCounts = new Map<number, number>();
  for (const entry of ranked) rankCounts.set(entry.rank, (rankCounts.get(entry.rank) ?? 0) + 1);
  return ranked.map((entry) => ({
    ...entry,
    tie_note: (rankCounts.get(entry.rank) ?? 0) > 1
      ? "同点規則により同順位。表示順はproduct_identity_id昇順"
      : null,
  }));
}

function canonicalize(value: unknown, parentKey = ""): unknown {
  if (Array.isArray(value)) {
    const canonical = value.map((item) => canonicalize(item, parentKey));
    if (parentKey === "ordered_rules") return canonical;
    return canonical.sort((a, b) => compareString(JSON.stringify(a), JSON.stringify(b)));
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort(compareString)) {
      result[key] = canonicalize(source[key], key);
    }
    return result;
  }
  return value;
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function computeInputHash(bundle: RankingExecutionBundle): string {
  const snapshot = {
    definition: bundle.definition,
    input: { ...bundle.input, input_hash: null },
    product_identities: bundle.product_identities,
    source_records: bundle.source_records,
    evidence_claims: bundle.evidence_claims,
    normalized_features: bundle.normalized_features,
    review_theme_summaries: bundle.review_theme_summaries,
  };
  return "fnv1a32-" + fnv1a32(JSON.stringify(canonicalize(snapshot)));
}

function generatedTimestamp(snapshotDate: string): string {
  return snapshotDate + "T00:00:00+09:00";
}

function calculateCore(bundle: RankingExecutionBundle): RankingResult {
  const productMap = new Map(bundle.product_identities.map((product) => [product.product_identity_id, product]));
  const ranked: RankingEntry[] = [];
  const onHold: RankingDisposition[] = [];
  const excluded: RankingDisposition[] = bundle.input.excluded.map((item) => ({
    product_identity_id: item.product_identity_id,
    reason: item.exclusion_reason,
    reason_code: "input_excluded",
    data_coverage: null,
    confidence: null,
  }));

  const candidates = [...bundle.input.candidates]
    .sort((a, b) => compareString(a.product_identity_id, b.product_identity_id));
  for (const candidate of candidates) {
    const product = productMap.get(candidate.product_identity_id);
    if (!product) continue;
    const evaluation = evaluateCandidate(
      product,
      candidate.feature_refs,
      bundle.definition,
      bundle,
    );
    if (evaluation.entry) ranked.push(evaluation.entry);
    if (evaluation.disposition && evaluation.kind === "on_hold") onHold.push(evaluation.disposition);
    if (evaluation.disposition && evaluation.kind === "excluded") excluded.push(evaluation.disposition);
  }

  const inputHash = computeInputHash(bundle);
  const timestamp = generatedTimestamp(bundle.input.snapshot_date);
  return {
    schema_version: bundle.definition.schema_version,
    record_id: "rres-" + inputHash.slice("fnv1a32-".length),
    ranking_result_id: "rres-" + inputHash.slice("fnv1a32-".length),
    ranking_input_id: bundle.input.ranking_input_id,
    ranking_definition_id: bundle.definition.ranking_definition_id,
    definition_version: bundle.definition.definition_version,
    calc_version: bundle.definition.calc_version,
    run_id: bundle.input.run_id,
    generated_at: timestamp,
    entries: assignStableRanks(ranked, bundle.definition),
    on_hold: onHold.sort((a, b) => compareString(a.product_identity_id, b.product_identity_id)),
    excluded: excluded.sort((a, b) => compareString(a.product_identity_id, b.product_identity_id)),
    sensitivity_notes: [],
    publication_status: "draft",
    created_at: timestamp,
    updated_at: timestamp,
    notes: "架空fixtureによる決定論的試作。実在商品の順位ではない。",
  };
}

function pairwiseRelations(entries: RankingEntry[]): Map<string, string> {
  const result = new Map<string, string>();
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const a = entries[left];
      const b = entries[right];
      const ids = [a.product_identity_id, b.product_identity_id].sort(compareString);
      const aRank = entries.find((entry) => entry.product_identity_id === ids[0])!.rank;
      const bRank = entries.find((entry) => entry.product_identity_id === ids[1])!.rank;
      result.set(ids.join("|"), aRank === bRank ? "tie" : aRank < bRank ? ids[0] + ">" + ids[1] : ids[1] + ">" + ids[0]);
    }
  }
  return result;
}

export function analyzeSensitivity(
  bundle: RankingExecutionBundle,
  baseline: RankingResult,
): SensitivityNote[] {
  const delta = bundle.definition.sensitivity_config.weight_delta;
  if (delta === null || baseline.entries.length < 2) return [];
  const baselineRelations = pairwiseRelations(baseline.entries);
  const notes: SensitivityNote[] = [];

  for (const axis of [...bundle.definition.axis_weights].sort((a, b) => compareString(a.axis_id, b.axis_id))) {
    for (const direction of ["increase", "decrease"] as const) {
      const variedWeight = direction === "increase"
        ? axis.weight + delta
        : Math.max(0.000001, axis.weight - delta);
      const variedDefinition: RankingDefinition = {
        ...bundle.definition,
        axis_weights: bundle.definition.axis_weights.map((candidateAxis) =>
          candidateAxis.axis_id === axis.axis_id
            ? { ...candidateAxis, weight: variedWeight }
            : candidateAxis,
        ),
        sensitivity_config: { ...bundle.definition.sensitivity_config, weight_delta: null },
      };
      const varied = calculateCore({ ...bundle, definition: variedDefinition });
      const variedRelations = pairwiseRelations(varied.entries);
      for (const pair of [...baselineRelations.keys()].sort(compareString)) {
        const baselineOrder = baselineRelations.get(pair)!;
        const variedOrder = variedRelations.get(pair);
        if (variedOrder !== undefined && baselineOrder !== variedOrder) {
          const [productA, productB] = pair.split("|");
          notes.push({
            product_a: productA,
            product_b: productB,
            axis_id: axis.axis_id,
            weight_delta: delta,
            direction,
            baseline_order: baselineOrder,
            varied_order: variedOrder,
          });
        }
      }
    }
  }
  return notes.sort((a, b) =>
    compareString(a.axis_id, b.axis_id)
      || compareString(a.direction, b.direction)
      || compareString(a.product_a, b.product_a)
      || compareString(a.product_b, b.product_b),
  );
}

/**
 * Main pure calculation entry point. No AI, random value, wall clock, network,
 * file system, database, external rank, or commercial term is consulted.
 */
export function calculateRankingResult(bundle: RankingExecutionBundle): RankingResult {
  const validation = validateRankingInput(bundle);
  if (validation.result === "fail") throw new RankingInputValidationError(validation);
  const baseline = calculateCore(bundle);
  return {
    ...baseline,
    sensitivity_notes: analyzeSensitivity(bundle, baseline),
  };
}
