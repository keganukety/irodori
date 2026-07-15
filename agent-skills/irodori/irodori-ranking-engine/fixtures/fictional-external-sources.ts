import {
  CONTRACT_SCHEMA_VERSION,
  type ExternalSourceValidationBundle,
  type RakutenRankingSnapshot,
  type ReviewThemeSummary,
  type SourceRecord,
  type SourceUsageAudit,
  type SourceUsageOperation,
  type SourceUsageOperationId,
} from "../../shared/contracts/types.ts";

const CREATED_AT = "2026-07-15T00:00:00Z";
const ACCESSED_DATE = "2026-07-15";

function common(recordId: string) {
  return {
    schema_version: CONTRACT_SCHEMA_VERSION,
    record_id: recordId,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
  };
}

function operation(
  operationId: SourceUsageOperationId,
  operationalDecision: SourceUsageOperation["operational_decision"],
  auditResult: SourceUsageOperation["audit_result"],
  termsPermissionStatus: SourceUsageOperation["terms_permission_status"],
  legalReviewStatus: SourceUsageOperation["legal_review_status"],
): SourceUsageOperation {
  return {
    operation_id: operationId,
    audit_result: auditResult,
    terms_permission_status: termsPermissionStatus,
    operational_decision: operationalDecision,
    conditions: operationalDecision === "allowed_with_conditions" ? ["架空ライセンス条件を遵守"] : [],
    prohibited_actions: operationalDecision === "prohibited" ? ["架空規約で禁止"] : [],
    evidence_references: ["https://example.invalid/policy/" + operationId],
    legal_review_status: legalReviewStatus,
  };
}

function baseAudit(
  auditId: string,
  mediumId: string,
  checkedOperations: SourceUsageOperation[],
  roles: SourceUsageAudit["permitted_roles"],
  options: {
    operationalDecision?: SourceUsageAudit["operational_decision"];
    legalReviewStatus?: SourceUsageAudit["legal_review_status"];
    allowedOperations?: SourceUsageOperationId[];
    allowedCapturePolicies?: SourceUsageAudit["storage_policy"]["allowed_capture_policies"];
    retentionRules?: SourceUsageAudit["storage_policy"]["retention_rules"];
  } = {},
): SourceUsageAudit {
  const operationalDecision = options.operationalDecision ?? "allowed_with_conditions";
  const legalReviewStatus = options.legalReviewStatus ?? "completed";
  return {
    ...common(auditId),
    audit_id: auditId,
    medium_id: mediumId,
    medium_name: "架空媒体 " + mediumId,
    operator_name: "架空運営者",
    official_domains: ["example.invalid"],
    audited_at: CREATED_AT,
    audit_version: "1.0.0",
    terms_urls: ["https://example.invalid/policy/terms"],
    copyright_policy_urls: ["https://example.invalid/policy/copyright"],
    community_guideline_urls: [],
    robots_url: "https://example.invalid/robots.txt",
    effective_dates: [{ policy_id: "fictional_terms", effective_date: null, note: "架空fixture" }],
    checked_operations: checkedOperations,
    permitted_roles: roles,
    prohibited_roles: ["buyer_review_source"],
    storage_policy: {
      allowed_capture_policies: options.allowedCapturePolicies ?? ["metadata_only", "no_content_storage"],
      prohibited_content: ["article_body", "review_body", "image", "table", "author_name", "author_id", "raw_html"],
      pii_policy: "reject_all",
      retention_notes: ["架空fixtureの構造検証用"],
      retention_rules: options.retentionRules ?? [],
    },
    citation_policy: {
      quote_policy: "prohibited",
      attribution_required: true,
      human_review_required: true,
    },
    automation_policy: {
      allowed_operations: options.allowedOperations ?? [],
      prohibited_operations: ["automated_html_acquisition", "scheduled_html_monitoring"],
      notes: ["架空fixture"],
    },
    terms_permission_status: "explicitly_permitted",
    operational_decision: operationalDecision,
    legal_review_status: legalReviewStatus,
    legal_review_requirement: {
      status: legalReviewStatus,
      required_before_operations: legalReviewStatus === "required" ? ["official_api"] : [],
      unresolved_topics: legalReviewStatus === "required" ? ["架空の法務確認事項"] : [],
    },
    unresolved_questions: legalReviewStatus === "required" ? ["架空の未解決事項"] : [],
    review_due_at: "2026-10-15",
    evidence_references: ["https://example.invalid/policy/audit-evidence"],
    notes: "実在媒体ではない契約検証専用fixture。",
  };
}

export const fictionalEditorialAudit = baseAudit(
  "source-audit-fictional-editorial",
  "fictional-editorial-medium",
  [
    operation("manual_read_and_structure", "allowed_with_conditions", "pass", "explicitly_permitted", "completed"),
    operation("browser_assisted_summary", "allowed_with_conditions", "pass", "explicitly_permitted", "completed"),
    operation("automated_html_acquisition", "prohibited", "fail", "explicitly_prohibited", "not_required"),
    operation("scheduled_html_monitoring", "prohibited", "fail", "explicitly_prohibited", "not_required"),
    operation("editorial_theme_extraction", "allowed_with_conditions", "pass", "explicitly_permitted", "completed"),
    operation("individual_review_storage", "prohibited", "fail", "explicitly_prohibited", "not_required"),
    operation("aggregate_review_summary", "allowed_with_conditions", "pass", "explicitly_permitted", "completed"),
    operation("minimal_quote", "prohibited", "fail", "explicitly_prohibited", "not_required"),
    operation("metadata_only", "allowed_with_conditions", "pass", "explicitly_permitted", "completed"),
  ],
  ["editorial_evaluation", "review_theme_source"],
  { allowedCapturePolicies: ["metadata_only", "structured_themes_only", "no_content_storage"] },
);

export const fictionalDemandAudit = baseAudit(
  "source-audit-fictional-demand",
  "fictional-demand-medium",
  [
    operation("manual_read_and_structure", "allowed_with_conditions", "pass", "explicitly_permitted", "completed"),
    operation("official_api", "allowed_with_conditions", "pass", "explicitly_permitted", "completed"),
    operation("scheduled_api_snapshot", "allowed_with_conditions", "pass", "explicitly_permitted", "completed"),
    operation("automated_html_acquisition", "prohibited", "fail", "explicitly_prohibited", "not_required"),
    operation("scheduled_html_monitoring", "prohibited", "fail", "explicitly_prohibited", "not_required"),
    operation("external_ranking_metadata", "allowed_with_conditions", "pass", "explicitly_permitted", "completed"),
    operation("market_demand_snapshot", "allowed_with_conditions", "pass", "explicitly_permitted", "completed"),
    operation("metadata_only", "allowed_with_conditions", "pass", "explicitly_permitted", "completed"),
  ],
  ["market_demand_signal", "external_sales_ranking_metadata"],
  {
    allowedOperations: ["official_api", "scheduled_api_snapshot"],
    allowedCapturePolicies: ["metadata_only", "market_demand_metadata_only", "no_content_storage"],
    retentionRules: [
      { applies_to: "price", duration_value: 24, duration_unit: "hours", status: "confirmed", evidence_reference: "https://example.invalid/policy/retention" },
      { applies_to: "availability", duration_value: 24, duration_unit: "hours", status: "confirmed", evidence_reference: "https://example.invalid/policy/retention" },
      { applies_to: "metadata", duration_value: 3, duration_unit: "months", status: "confirmed", evidence_reference: "https://example.invalid/policy/retention" },
      { applies_to: "derived_aggregate_over_three_months", duration_value: null, duration_unit: null, status: "unresolved", evidence_reference: "https://example.invalid/policy/retention" },
    ],
  },
);

export const fictionalPendingDemandAudit = baseAudit(
  "source-audit-fictional-demand-pending",
  "fictional-demand-medium-pending",
  [
    operation("official_api", "pending_review", "pass", "explicitly_permitted", "required"),
    operation("automated_html_acquisition", "prohibited", "fail", "explicitly_prohibited", "not_required"),
    operation("scheduled_html_monitoring", "prohibited", "fail", "explicitly_prohibited", "not_required"),
  ],
  ["market_demand_signal", "external_sales_ranking_metadata"],
  {
    operationalDecision: "pending_review",
    legalReviewStatus: "required",
    allowedOperations: ["official_api"],
    allowedCapturePolicies: ["market_demand_metadata_only", "metadata_only"],
  },
);

function sourceRecord(
  sourceId: string,
  capturePolicy: SourceRecord["content_capture_policy"],
  sourceRole: SourceRecord["source_role"],
): SourceRecord {
  return {
    ...common(sourceId),
    source_record_id: sourceId,
    media_name: "架空第三者媒体",
    page_title: "架空の検証用ページ",
    url: "https://example.invalid/articles/" + sourceId,
    published_date: null,
    updated_date: null,
    accessed_date: ACCESSED_DATE,
    date_kind_note: "架空fixtureのため日付情報なし",
    target_product: "pid-fictional-external-a",
    product_name_as_written: "架空ベビーカー 外部検証 A",
    model_number_as_written: "FIC-EXT-A-26-JP",
    model_year_as_written: "2026",
    market_as_written: "JP",
    match_status: "matched",
    source_type: "editorial_test_media",
    primary_or_secondary: "secondary",
    commercial_relation: "none_declared",
    external_rank_metadata: null,
    acquisition_status: "acquired",
    acquisition_failure_reason: null,
    source_usage_audit_id: fictionalEditorialAudit.audit_id,
    acquisition_method: "manual_browser",
    content_capture_policy: capturePolicy,
    quote_policy: "prohibited",
    pii_policy: "reject_all",
    automation_used: false,
    human_review_required: true,
    human_review_status: "completed",
    legal_review_status: "completed",
    source_role: sourceRole,
    notes: "example.invalidだけを使う架空fixture。",
  };
}

export const fictionalMetadataOnlySource = sourceRecord(
  "src-fictional-metadata-only",
  "metadata_only",
  "editorial_evaluation",
);

export const fictionalStructuredThemeSource = sourceRecord(
  "src-fictional-structured-theme",
  "structured_themes_only",
  "review_theme_source",
);

export const fictionalUnknownCountTheme: ReviewThemeSummary = {
  ...common("rts-fictional-unknown-count"),
  review_theme_summary_id: "rts-fictional-unknown-count",
  product_identity_id: "pid-fictional-external-a",
  source_record_ids: [fictionalStructuredThemeSource.source_record_id],
  theme_id: "fictional_train_handling",
  sentiment: "mixed",
  observed_item_count: null,
  deduplicated_item_count: null,
  sample_size_status: "unknown",
  summary: "架空の構造化テーマ。件数は確認できていない。",
  limitations: ["件数不明", "実在口コミを含まない"],
  evidence_status: "unconfirmed",
  human_review_status: "completed",
  contains_quote: false,
  contains_pii: false,
  ranking_score_impact: "none",
  notes: "実在する記事・口コミを含まない。",
};

export const fictionalSmallCountTheme: ReviewThemeSummary = {
  ...common("rts-fictional-small-count"),
  review_theme_summary_id: "rts-fictional-small-count",
  product_identity_id: "pid-fictional-external-a",
  source_record_ids: [fictionalStructuredThemeSource.source_record_id],
  theme_id: "fictional_fold_operation",
  sentiment: "positive",
  observed_item_count: 3,
  deduplicated_item_count: 2,
  sample_size_status: "known_small",
  summary: "架空の少数サンプルでは折りたたみ操作への肯定的記述があった。",
  limitations: ["少数サンプル", "一般化不可", "実在口コミを含まない"],
  evidence_status: "confirmed",
  human_review_status: "completed",
  contains_quote: false,
  contains_pii: false,
  ranking_score_impact: "none",
  notes: "実在する記事・口コミを含まない。",
};

function snapshot(
  snapshotId: string,
  shopCode: string,
  itemCode: string,
  overrides: Partial<RakutenRankingSnapshot> = {},
): RakutenRankingSnapshot {
  return {
    ...common(snapshotId),
    snapshot_id: snapshotId,
    source_usage_audit_id: fictionalDemandAudit.audit_id,
    ranking_source: "rakuten_official_realtime_rank",
    ranking_period: "realtime",
    acquisition_method: "official_api",
    genre_id: "fictional-genre",
    genre_name: "架空ベビー用品",
    rank: 7,
    last_build_date: "2026-07-15T00:00:00Z",
    fetched_at: CREATED_AT,
    captured_at: CREATED_AT,
    rakuten_item_code: itemCode,
    shop_code: shopCode,
    item_name: "架空ベビーカー 市場検証 A",
    item_url: "https://example.invalid/listings/" + shopCode + "/" + itemCode,
    price: 12345,
    availability: 1,
    review_count: 12,
    review_average: 4.2,
    product_identity_id: "pid-fictional-external-a",
    model_year: 2026,
    market: "JP",
    model_number: "FIC-EXT-A-26-JP",
    variant_id: "variant-fictional-blue",
    identity_match_status: "confirmed",
    match_evidence: [
      { evidence_type: "normalized_product_name", value: "架空ベビーカー 市場検証 A" },
      { evidence_type: "brand", value: "架空ブランド" },
      { evidence_type: "model_year", value: "2026" },
      { evidence_type: "market", value: "JP" },
      { evidence_type: "model_number", value: "FIC-EXT-A-26-JP" },
      { evidence_type: "variant", value: "variant-fictional-blue" },
    ],
    data_expiry: {
      price_expires_at: "2026-07-16T00:00:00Z",
      availability_expires_at: "2026-07-16T00:00:00Z",
      metadata_expires_at: "2026-10-15T00:00:00Z",
    },
    display_requirements: ["架空クレジット", "架空取得日時", "架空商品リンク"],
    retention_policy: {
      price_availability_ttl_hours: 24,
      metadata_ttl_months: 3,
      derived_aggregate_over_three_months: "unresolved",
      policy_source: "source-audit-fictional-demand",
    },
    retention_status: "current",
    legal_review_status: "completed",
    publication_status: "review_required",
    source_role: "market_demand_signal",
    ranking_score_impact: "none",
    quality_score_input_fields: [],
    notes: "実在する楽天商品・店舗・順位ではない。API呼び出しなし。",
    ...overrides,
  };
}

export const fictionalValidApiSnapshot = snapshot(
  "rakuten-snapshot-fictional-shop-a",
  "fictional-shop-a",
  "fictional-shop-a:fictional-item-a",
);

export const fictionalSecondShopSnapshot = snapshot(
  "rakuten-snapshot-fictional-shop-b",
  "fictional-shop-b",
  "fictional-shop-b:fictional-item-a",
);

export const fictionalOfficialWeeklyWebSnapshot = snapshot(
  "rakuten-snapshot-fictional-weekly-web",
  "fictional-shop-a",
  "fictional-shop-a:fictional-item-a-weekly",
  {
    ranking_source: "rakuten_official_weekly_rank",
    ranking_period: "official_weekly",
    acquisition_method: "manual_browser",
  },
);

export const fictionalIrodoriDerivedSnapshot = snapshot(
  "rakuten-snapshot-fictional-irodori-7day",
  "fictional-shop-a",
  "fictional-shop-a:fictional-item-a-derived",
  {
    ranking_source: "irodori_7day_average_position",
    ranking_period: "irodori_7day_derived",
    acquisition_method: "not_acquired",
  },
);

export const fictionalPendingPublicationSnapshot = snapshot(
  "rakuten-snapshot-fictional-pending-publication",
  "fictional-shop-pending",
  "fictional-shop-pending:fictional-item-a",
  {
    source_usage_audit_id: fictionalPendingDemandAudit.audit_id,
    legal_review_status: "required",
    publication_status: "published",
  },
);

export const fictionalExternalSourceBundle: ExternalSourceValidationBundle = {
  validation_at: "2026-07-15T12:00:00Z",
  source_usage_audits: [fictionalEditorialAudit, fictionalDemandAudit, fictionalPendingDemandAudit],
  source_records: [fictionalMetadataOnlySource, fictionalStructuredThemeSource],
  review_theme_summaries: [fictionalUnknownCountTheme, fictionalSmallCountTheme],
  rakuten_ranking_snapshots: [
    fictionalValidApiSnapshot,
    fictionalSecondShopSnapshot,
    fictionalOfficialWeeklyWebSnapshot,
    fictionalIrodoriDerivedSnapshot,
  ],
};

export function cloneFixture<T>(value: T): T {
  return structuredClone(value);
}
