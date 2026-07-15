/**
 * Machine-processable contracts derived from shared/references/data-contracts.md.
 * Keep field names aligned with the Markdown source of truth.
 */

export const CONTRACT_SCHEMA_VERSION = "0.2.0" as const;
export const CALCULATION_VERSION = "calc-train-prototype-0.1.0" as const;

export const EVIDENCE_STATUSES = [
  "confirmed",
  "unconfirmed",
  "conflicting",
  "outdated",
  "not_applicable",
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const VALIDATION_RESULTS = ["pass", "fail", "unknown", "not_applicable"] as const;
export type ValidationResult = (typeof VALIDATION_RESULTS)[number];

export const PUBLICATION_STATUSES = [
  "draft",
  "review_required",
  "approved",
  "rejected",
  "published",
] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export type ValueStatus = "proposed" | "confirmed";
export type FactOrInference = "fact" | "inference";
export type Market = "JP" | "overseas" | "unknown";
export type LifecycleStatus = "current" | "discontinued" | "unknown";
export type IdentificationStatus = "identified" | "provisional" | "unidentified";

export interface StatusHistoryEntry {
  field: string;
  from: string | null;
  to: string | null;
  changed_at: string;
  reason: string;
}

export interface BaseContractRecord {
  schema_version: string;
  record_id: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  status_history?: StatusHistoryEntry[];
}

export interface RunStep {
  skill_name: string;
  started_at: string;
  finished_at: string | null;
  result: ValidationResult;
}

export interface RunConfigRefs {
  ranking_definition_id: string | null;
  ranking_definition_version: string | null;
  calc_version: string | null;
  terminology_version: string;
  contracts_version: string;
}

export interface RunManifest extends BaseContractRecord {
  run_id: string;
  purpose: string;
  executed_by: "claude-code" | "codex" | "human";
  started_at: string;
  finished_at: string | null;
  target_products: string[];
  steps: RunStep[];
  config_refs: RunConfigRefs;
  stop_reason: string | null;
  artifacts: string[];
}

export interface ProductIdentity extends BaseContractRecord {
  product_identity_id: string;
  official_name: string;
  brand_name: string;
  manufacturer_name: string | null;
  model_number: string | null;
  model_year: number | null;
  market: Market;
  lifecycle_status: LifecycleStatus;
  predecessor_of: string | null;
  successor_of: string | null;
  variant_of: string | null;
  variant_axis: "color" | "spec" | "market" | null;
  category: string;
  official_url: string | null;
  identification_status: IdentificationStatus;
  identification_evidence: string[];
  unconfirmed_fields: string[];
  site_product_id: string | null;
}

export const SOURCE_TYPES = [
  "official_product_page",
  "official_spec_sheet",
  "official_manual",
  "official_news",
  "editorial_test_media",
  "aggregate_review_site",
  "parenting_media",
  "independent_review",
  "buyer_review",
  "user_testimonial",
  "retailer_page",
  "other",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const COMMERCIAL_RELATIONS = [
  "none_declared",
  "affiliate",
  "sponsored",
  "provided_sample",
  "advertiser_relation",
  "self_published_by_maker",
  "unknown",
] as const;
export type CommercialRelation = (typeof COMMERCIAL_RELATIONS)[number];

export interface ExternalRankMetadata {
  rank_label: string;
  rank_value: number | null;
  scale_note: string;
}

export interface SourceRecord extends BaseContractRecord {
  source_record_id: string;
  media_name: string;
  page_title: string;
  url: string;
  published_date: string | null;
  updated_date: string | null;
  accessed_date: string;
  date_kind_note: string | null;
  target_product: string | null;
  product_name_as_written: string;
  model_number_as_written: string | null;
  model_year_as_written: string | null;
  market_as_written: Market;
  match_status: "matched" | "probable" | "unmatched";
  source_type: SourceType;
  primary_or_secondary: "primary" | "secondary";
  commercial_relation: CommercialRelation;
  external_rank_metadata: ExternalRankMetadata | null;
  acquisition_status: "acquired" | "partial" | "failed" | "skipped";
  acquisition_failure_reason: string | null;
}

export const CLAIM_CLASSES = [
  "official_spec",
  "manufacturer_claim",
  "manual_safety",
  "third_party_measured",
  "editorial_opinion",
  "review_aggregate",
  "user_testimonial",
  "irodori_inference",
  "unknown",
] as const;
export type ClaimClass = (typeof CLAIM_CLASSES)[number];

export interface DimensionsValue {
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
}

export interface RangeValue {
  min: number | null;
  max: number | null;
}

export type OrdinalValue = "very_low" | "low" | "medium" | "high" | "very_high";
export type NormalizedValue = number | boolean | string | DimensionsValue | RangeValue;

export interface Reliability {
  level: "high" | "medium" | "low";
  reason: string;
}

export interface EvidenceClaim extends BaseContractRecord {
  evidence_claim_id: string;
  source_record_id: string;
  product_identity_id: string;
  claim_kind: "spec" | "measurement" | "editorial_rating" | "review_trend" | "safety_note" | "other";
  axis_id: string | null;
  value_raw: string;
  quote: boolean;
  value_normalized: NormalizedValue | null;
  unit: string | null;
  measurement_condition: string | null;
  claim_class: ClaimClass;
  fact_or_inference: FactOrInference;
  derived_from: string[];
  evidence_status: EvidenceStatus;
  conflict_with: string[];
  duplicate_of: string | null;
  duplicate_candidate_of: string[];
  reliability: Reliability;
}

export interface NormalizedFeature extends BaseContractRecord {
  normalized_feature_id: string;
  product_identity_id: string;
  axis_id: string;
  value: NormalizedValue | null;
  unit: string | null;
  value_kind: "numeric" | "boolean" | "ordinal" | "text" | "dimensions";
  supporting_claims: string[];
  evidence_status: EvidenceStatus;
  fact_or_inference: FactOrInference;
  normalization_notes: string | null;
  independent_source_count: number;
}

export interface SentimentCounts {
  positive_count: number | null;
  negative_count: number | null;
  neutral_count: number | null;
}

export interface ReviewThemeSummary extends BaseContractRecord {
  review_theme_summary_id: string;
  product_identity_id: string;
  theme: string;
  sentiment: SentimentCounts;
  summary_text: string;
  representative_sources: string[];
  conditions: string | null;
  pii_check: ValidationResult;
  evidence_status: EvidenceStatus;
}

export type NumericDirection = "lower_better" | "higher_better";

export type AxisScoringRule =
  | {
      kind: "numeric";
      direction: NumericDirection;
      best: number;
      worst: number;
      unit: string;
    }
  | {
      kind: "dimensions";
      metric: "width_mm" | "depth_mm" | "height_mm" | "volume_mm3" | "max_dimension_mm";
      direction: NumericDirection;
      best: number;
      worst: number;
      unit: "mm" | "mm3";
    }
  | {
      kind: "boolean";
      preferred_value: boolean;
    }
  | {
      kind: "ordinal";
      points: Record<OrdinalValue, number>;
    };

export interface AxisWeight {
  axis_id: string;
  weight: number;
  value_status: ValueStatus;
  scoring_rule: AxisScoringRule;
}

export interface RequiredAxesConfig {
  axes: string[];
  value_status: ValueStatus;
}

export interface MinimumCoverageConfig {
  value: number;
  value_status: ValueStatus;
}

export interface DisqualificationRule {
  rule: "require_current_lifecycle" | "require_identified_product" | "require_market_match";
  expected_market?: Market;
  reason_template: string;
  value_status: ValueStatus;
}

export interface TieBreakerRules {
  ordered_rules: Array<"data_coverage_desc" | "confidence_desc" | "tie_allowed" | "product_identity_id_asc">;
  value_status: ValueStatus;
}

export interface EvidencePolicy {
  accepted_statuses: EvidenceStatus[];
  unresolved_conflict: "hold" | "exclude_axis";
  outdated: "hold" | "exclude_axis";
  duplicate_handling: "representative_only";
  value_status: ValueStatus;
}

export interface MissingDataPolicy {
  below_min_coverage: "hold" | "reference";
  missing_axis: "exclude_from_score";
  value_status: ValueStatus;
}

export interface ConfidenceConfig {
  formula_id: "confidence-proposed-v1";
  data_coverage_weight: number;
  source_independence_weight: number;
  primary_source_weight: number;
  reliability_weight: number;
  independent_sources_target_per_axis: number;
  value_status: ValueStatus;
}

export interface SensitivityConfig {
  weight_delta: number | null;
  value_status: ValueStatus;
}

export interface FreshnessRule {
  max_age_days: number;
  value_status: ValueStatus;
}

export interface RankingDefinition extends BaseContractRecord {
  ranking_definition_id: string;
  definition_version: string;
  name: string;
  scope: "overall" | "scene";
  scene_tag: string | null;
  category: string;
  axis_weights: AxisWeight[];
  required_axes: RequiredAxesConfig;
  min_data_coverage: MinimumCoverageConfig;
  disqualification_rules: DisqualificationRule[];
  tie_breaker_rules: TieBreakerRules;
  evidence_policy: EvidencePolicy;
  missing_data_policy: MissingDataPolicy;
  confidence_formula_ref: string;
  confidence_config: ConfidenceConfig;
  sensitivity_config: SensitivityConfig;
  freshness_rule: FreshnessRule | null;
  calc_version: string;
  publication_status: PublicationStatus;
}

export interface RankingCandidate {
  product_identity_id: string;
  feature_refs: string[];
  review_refs: string[];
  data_coverage: number | null;
}

export interface RankingExclusion {
  product_identity_id: string;
  exclusion_reason: string;
}

export interface RankingInput extends BaseContractRecord {
  ranking_input_id: string;
  ranking_definition_id: string;
  definition_version: string;
  run_id: string;
  snapshot_date: string;
  candidates: RankingCandidate[];
  excluded: RankingExclusion[];
  input_hash: string | null;
}

export interface PerAxisBreakdown {
  axis_id: string;
  normalized_feature_id: string;
  value: NormalizedValue;
  raw_axis_score: number;
  normalized_weight: number;
  weighted_score: number;
  evidence_status: EvidenceStatus;
  evidence_claim_ids: string[];
  source_record_ids: string[];
}

export interface RankingEntry {
  rank: number;
  product_identity_id: string;
  score: number;
  data_coverage: number;
  confidence: number;
  per_axis_breakdown: PerAxisBreakdown[];
  reason_text: string;
  strengths: string[];
  cautions: string[];
  unconfirmed_axes: string[];
  tie_note: string | null;
}

export interface RankingDisposition {
  product_identity_id: string;
  reason: string;
  reason_code: string;
  data_coverage: number | null;
  confidence: number | null;
}

export interface SensitivityNote {
  product_a: string;
  product_b: string;
  axis_id: string;
  weight_delta: number;
  direction: "increase" | "decrease";
  baseline_order: string;
  varied_order: string;
}

export interface RankingResult extends BaseContractRecord {
  ranking_result_id: string;
  ranking_input_id: string;
  ranking_definition_id: string;
  definition_version: string;
  calc_version: string;
  run_id: string;
  generated_at: string;
  entries: RankingEntry[];
  on_hold: RankingDisposition[];
  excluded: RankingDisposition[];
  sensitivity_notes: SensitivityNote[];
  publication_status: PublicationStatus;
}

export interface ProductReviewSummary {
  product_identity_id: string;
  identification_status: IdentificationStatus;
  source_count: number;
  claim_count: number;
  unconfirmed_axes: string[];
  conflicts: number;
}

export interface ValidationSummaryItem {
  check_name: string;
  result: ValidationResult;
  detail: string;
}

export interface ReviewReport extends BaseContractRecord {
  review_report_id: string;
  run_id: string;
  summary: string;
  product_summaries: ProductReviewSummary[];
  validation_summary: ValidationSummaryItem[];
  open_questions: string[];
  recommended_next_actions: string[];
  publication_status: PublicationStatus;
}

export interface RankingExecutionBundle {
  definition: RankingDefinition;
  input: RankingInput;
  product_identities: ProductIdentity[];
  source_records: SourceRecord[];
  evidence_claims: EvidenceClaim[];
  normalized_features: NormalizedFeature[];
  review_theme_summaries: ReviewThemeSummary[];
}

export type ContractName =
  | "run_manifest"
  | "product_identity"
  | "source_record"
  | "evidence_claim"
  | "normalized_feature"
  | "review_theme_summary"
  | "ranking_definition"
  | "ranking_input"
  | "ranking_result"
  | "review_report";

export type ContractRecord =
  | RunManifest
  | ProductIdentity
  | SourceRecord
  | EvidenceClaim
  | NormalizedFeature
  | ReviewThemeSummary
  | RankingDefinition
  | RankingInput
  | RankingResult
  | ReviewReport;

export interface ValidationIssue {
  path: string;
  result: Exclude<ValidationResult, "pass" | "not_applicable">;
  code: string;
  message: string;
  needed?: string;
}

export interface ValidationReport<T> {
  result: ValidationResult;
  issues: ValidationIssue[];
  value?: T;
}
