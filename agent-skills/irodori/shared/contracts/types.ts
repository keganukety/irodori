/**
 * Machine-processable contracts derived from shared/references/data-contracts.md.
 * Keep field names aligned with the Markdown source of truth.
 */

export const CONTRACT_SCHEMA_VERSION = "0.4.0" as const;
export const CALCULATION_VERSION = "calc-train-prototype-0.2.0" as const;

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
export type SiteProductMatchStatus = "confirmed" | "probable" | "unmatched" | "unverified";
export type VariantSpecificationStatus = "confirmed_same" | "confirmed_different" | "unverified";

export const TERMS_PERMISSION_STATUSES = [
  "explicitly_permitted",
  "explicitly_prohibited",
  "not_found",
  "ambiguous",
  "not_applicable",
] as const;
export type TermsPermissionStatus = (typeof TERMS_PERMISSION_STATUSES)[number];

export const OPERATIONAL_DECISIONS = [
  "allowed_with_conditions",
  "prohibited",
  "pending_review",
  "not_adopted",
] as const;
export type OperationalDecision = (typeof OPERATIONAL_DECISIONS)[number];

export const LEGAL_REVIEW_STATUSES = [
  "not_required",
  "recommended",
  "required",
  "completed",
  "unresolved",
] as const;
export type LegalReviewStatus = (typeof LEGAL_REVIEW_STATUSES)[number];

export type AuditResult = ValidationResult;

export const SOURCE_USAGE_OPERATION_IDS = [
  "manual_read_and_structure",
  "browser_assisted_summary",
  "automated_html_acquisition",
  "scheduled_html_monitoring",
  "official_api",
  "scheduled_api_snapshot",
  "spec_cross_check",
  "editorial_theme_extraction",
  "individual_review_storage",
  "aggregate_review_summary",
  "external_ranking_metadata",
  "market_demand_snapshot",
  "minimal_quote",
  "metadata_only",
] as const;
export type SourceUsageOperationId = (typeof SOURCE_USAGE_OPERATION_IDS)[number];

export const ACQUISITION_METHODS = [
  "manual_browser",
  "ai_browser_assisted",
  "official_api",
  "licensed_feed",
  "automated_html",
  "user_provided",
  "not_acquired",
] as const;
export type AcquisitionMethod = (typeof ACQUISITION_METHODS)[number];

export const CONTENT_CAPTURE_POLICIES = [
  "metadata_only",
  "structured_facts_only",
  "structured_themes_only",
  "market_demand_metadata_only",
  "minimal_quote_allowed",
  "no_content_storage",
] as const;
export type ContentCapturePolicy = (typeof CONTENT_CAPTURE_POLICIES)[number];

export const QUOTE_POLICIES = [
  "prohibited",
  "pending_review",
  "minimal_with_review",
  "permitted_by_license",
] as const;
export type QuotePolicy = (typeof QUOTE_POLICIES)[number];

export const PII_POLICIES = ["reject_all", "redact_before_storage", "not_applicable"] as const;
export type PiiPolicy = (typeof PII_POLICIES)[number];

export const HUMAN_REVIEW_STATUSES = ["not_required", "pending", "completed", "rejected"] as const;
export type HumanReviewStatus = (typeof HUMAN_REVIEW_STATUSES)[number];

export const SOURCE_ROLES = [
  "product_identity_confirmation",
  "official_spec_cross_check",
  "third_party_measurement",
  "editorial_evaluation",
  "review_theme_source",
  "buyer_review_source",
  "external_ranking_metadata",
  "market_demand_signal",
  "external_sales_ranking_metadata",
] as const;
export type SourceRole = (typeof SOURCE_ROLES)[number];

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

export interface SourceUsageOperation {
  operation_id: SourceUsageOperationId;
  audit_result: AuditResult;
  terms_permission_status: TermsPermissionStatus;
  operational_decision: OperationalDecision;
  conditions: string[];
  prohibited_actions: string[];
  evidence_references: string[];
  legal_review_status: LegalReviewStatus;
}

export type ProhibitedContentKind =
  | "article_body"
  | "review_body"
  | "image"
  | "table"
  | "author_name"
  | "author_id"
  | "raw_html";

export interface SourceRetentionRule {
  applies_to: "price" | "availability" | "metadata" | "derived_aggregate_over_three_months";
  duration_value: number | null;
  duration_unit: "hours" | "months" | null;
  status: "confirmed" | "unresolved";
  evidence_reference: string;
}

export interface StoragePolicy {
  allowed_capture_policies: ContentCapturePolicy[];
  prohibited_content: ProhibitedContentKind[];
  pii_policy: PiiPolicy;
  retention_notes: string[];
  retention_rules: SourceRetentionRule[];
}

export interface CitationPolicy {
  quote_policy: QuotePolicy;
  attribution_required: boolean;
  human_review_required: boolean;
}

export interface AutomationPolicy {
  allowed_operations: SourceUsageOperationId[];
  prohibited_operations: SourceUsageOperationId[];
  notes: string[];
}

export interface LegalReviewRequirement {
  status: LegalReviewStatus;
  required_before_operations: SourceUsageOperationId[];
  unresolved_topics: string[];
}

export interface SourcePolicyEffectiveDate {
  policy_id: string;
  effective_date: string | null;
  note: string;
}

export interface SourceUsageAudit extends BaseContractRecord {
  audit_id: string;
  medium_id: string;
  medium_name: string;
  operator_name: string;
  official_domains: string[];
  audited_at: string;
  audit_version: string;
  terms_urls: string[];
  copyright_policy_urls: string[];
  community_guideline_urls: string[];
  robots_url: string | null;
  effective_dates: SourcePolicyEffectiveDate[];
  checked_operations: SourceUsageOperation[];
  permitted_roles: SourceRole[];
  prohibited_roles: SourceRole[];
  storage_policy: StoragePolicy;
  citation_policy: CitationPolicy;
  automation_policy: AutomationPolicy;
  terms_permission_status: TermsPermissionStatus;
  operational_decision: OperationalDecision;
  legal_review_status: LegalReviewStatus;
  legal_review_requirement: LegalReviewRequirement;
  unresolved_questions: string[];
  review_due_at: string;
  evidence_references: string[];
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

export interface ExecutionEnvironment {
  node_version: string | null;
  typescript_version: string | null;
  os: string | null;
  platform: string | null;
  arch: string | null;
  typecheck_command: string | null;
  test_command: string | null;
  test_isolation: string | null;
  calculation_version: string | null;
  definition_version: string | null;
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
  /** Required for schema_version >= 0.3.0. Optional only for 0.2.x compatibility. */
  execution_environment?: ExecutionEnvironment;
}

export interface ProductVariant {
  variant_id: string;
  color_name: string | null;
  product_code: string | null;
  specification_equivalence_status: VariantSpecificationStatus;
  supporting_claims: string[];
  notes?: string;
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
  /** Required for schema_version >= 0.3.0. Optional only for 0.2.x compatibility. */
  site_product_match_status?: SiteProductMatchStatus;
  /** Model identity contains variants; a variant product code is never a model_number. */
  variants?: ProductVariant[];
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
  /** Product/SKU code tied to a color or other variant, not a model-wide number. */
  variant_product_code_as_written?: string | null;
  model_year_as_written: string | null;
  market_as_written: Market;
  match_status: "matched" | "probable" | "unmatched";
  source_type: SourceType;
  primary_or_secondary: "primary" | "secondary";
  commercial_relation: CommercialRelation;
  external_rank_metadata: ExternalRankMetadata | null;
  acquisition_status: "acquired" | "partial" | "failed" | "skipped";
  acquisition_failure_reason: string | null;
  /** Structured provenance for directly linked assets such as manuals. */
  discovery_page_url?: string | null;
  direct_asset_url?: string | null;
  discovered_via_official_page?: boolean | null;
  /** Required for schema_version >= 0.4.0. Third-party records must use a non-null audit ID. */
  source_usage_audit_id?: string | null;
  acquisition_method?: AcquisitionMethod;
  content_capture_policy?: ContentCapturePolicy;
  quote_policy?: QuotePolicy;
  pii_policy?: PiiPolicy;
  automation_used?: boolean;
  human_review_required?: boolean;
  human_review_status?: HumanReviewStatus;
  legal_review_status?: LegalReviewStatus;
  source_role?: SourceRole;
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

export const REVIEW_SENTIMENTS = ["positive", "negative", "mixed", "neutral", "not_applicable"] as const;
export type ReviewSentiment = (typeof REVIEW_SENTIMENTS)[number];

export const SAMPLE_SIZE_STATUSES = ["known_small", "known_moderate", "known_large", "unknown"] as const;
export type SampleSizeStatus = (typeof SAMPLE_SIZE_STATUSES)[number];

export interface ReviewThemeSummary extends BaseContractRecord {
  review_theme_summary_id: string;
  product_identity_id: string;
  /** 0.2.x/0.3.x aliases retained for runtime compatibility. */
  theme?: string;
  summary_text?: string;
  representative_sources?: string[];
  conditions?: string | null;
  pii_check?: ValidationResult;
  /** schema_version >= 0.4.0 fields. */
  source_record_ids?: string[];
  theme_id?: string;
  sentiment: SentimentCounts | ReviewSentiment;
  observed_item_count?: number | null;
  deduplicated_item_count?: number | null;
  sample_size_status?: SampleSizeStatus;
  summary?: string;
  limitations?: string[];
  evidence_status: EvidenceStatus;
  human_review_status?: HumanReviewStatus;
  contains_quote?: boolean;
  contains_pii?: boolean;
  ranking_score_impact?: "none";
}

export const RAKUTEN_RANKING_PERIODS = [
  "realtime",
  "official_daily",
  "official_weekly",
  "irodori_7day_derived",
] as const;
export type RakutenRankingPeriod = (typeof RAKUTEN_RANKING_PERIODS)[number];

export const RAKUTEN_RANKING_SOURCES = [
  "rakuten_official_realtime_rank",
  "rakuten_official_daily_rank",
  "rakuten_official_weekly_rank",
  "irodori_7day_rank_presence",
  "irodori_7day_average_position",
  "irodori_7day_rank_stability",
] as const;
export type RakutenRankingSource = (typeof RAKUTEN_RANKING_SOURCES)[number];

export const RETENTION_STATUSES = [
  "current",
  "expired",
  "pending_refresh",
  "prohibited_retention",
  "unknown",
] as const;
export type RetentionStatus = (typeof RETENTION_STATUSES)[number];

export const IDENTITY_MATCH_EVIDENCE_TYPES = [
  "normalized_product_name",
  "brand",
  "model_year",
  "market",
  "model_number",
  "unique_identifier",
  "variant",
] as const;
export type IdentityMatchEvidenceType = (typeof IDENTITY_MATCH_EVIDENCE_TYPES)[number];

export interface RakutenDataExpiry {
  price_expires_at: string;
  availability_expires_at: string;
  metadata_expires_at: string;
}

export interface RakutenRetentionPolicy {
  price_availability_ttl_hours: number;
  metadata_ttl_months: number;
  derived_aggregate_over_three_months: "unresolved";
  policy_source: string;
}

export interface IdentityMatchEvidence {
  evidence_type: IdentityMatchEvidenceType;
  value: string;
}

export interface RakutenRankingSnapshot extends BaseContractRecord {
  snapshot_id: string;
  source_usage_audit_id: string;
  ranking_source: RakutenRankingSource;
  ranking_period: RakutenRankingPeriod;
  acquisition_method: AcquisitionMethod;
  genre_id: string;
  genre_name: string;
  rank: number | null;
  last_build_date: string | null;
  fetched_at: string;
  captured_at: string;
  rakuten_item_code: string;
  shop_code: string;
  item_name: string;
  item_url: string;
  price: number | null;
  availability: 0 | 1 | null;
  review_count: number | null;
  review_average: number | null;
  product_identity_id: string | null;
  model_year: number | null;
  market: Market;
  model_number: string | null;
  variant_id: string | null;
  identity_match_status: SiteProductMatchStatus;
  match_evidence: IdentityMatchEvidence[];
  data_expiry: RakutenDataExpiry;
  display_requirements: string[];
  retention_policy: RakutenRetentionPolicy;
  retention_status: RetentionStatus;
  legal_review_status: LegalReviewStatus;
  publication_status: PublicationStatus;
  source_role: "market_demand_signal" | "external_sales_ranking_metadata";
  ranking_score_impact: "none";
  /** Must remain empty; used to reject prohibited score wiring at validation time. */
  quality_score_input_fields: string[];
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
  unresolved_conflict: "hold" | "exclude_axis" | {
    required_axis: "hold";
    non_required_axis: "exclude_axis";
    critical_axis: "hold";
  };
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

export interface CriticalAxesConfig {
  axes: string[];
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
  /** Required for schema_version >= 0.3.0. Optional only for 0.2.x compatibility. */
  min_weighted_data_coverage?: MinimumCoverageConfig;
  /** Safety/compliance/target-age conflicts always hold participation. */
  critical_axes?: CriticalAxesConfig;
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
  weighted_data_coverage?: number | null;
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
  input_hash_algorithm?: "sha256" | null;
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
  observed_score: number;
  /** @deprecated Alias of observed_score for 0.2.x consumers. */
  score?: number;
  data_coverage: number;
  weighted_data_coverage: number;
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
  weighted_data_coverage: number | null;
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
  input_hash: string;
  input_hash_algorithm: "sha256";
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

export interface EditorialNote {
  topic: string;
  text: string;
  evidence_status: EvidenceStatus;
  supporting_claims: string[];
}

export interface ReviewReport extends BaseContractRecord {
  review_report_id: string;
  run_id: string;
  summary: string;
  product_summaries: ProductReviewSummary[];
  validation_summary: ValidationSummaryItem[];
  open_questions: string[];
  recommended_next_actions: string[];
  editorial_notes?: EditorialNote[];
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

export interface ExternalSourceValidationBundle {
  validation_at: string;
  source_usage_audits: SourceUsageAudit[];
  source_records: SourceRecord[];
  evidence_claims?: EvidenceClaim[];
  review_theme_summaries: ReviewThemeSummary[];
  rakuten_ranking_snapshots: RakutenRankingSnapshot[];
}

export type ContractName =
  | "run_manifest"
  | "product_identity"
  | "source_record"
  | "evidence_claim"
  | "normalized_feature"
  | "review_theme_summary"
  | "source_usage_audit"
  | "rakuten_ranking_snapshot"
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
  | SourceUsageAudit
  | RakutenRankingSnapshot
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
