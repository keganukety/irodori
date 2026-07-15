import {
  CALCULATION_VERSION,
  CONTRACT_SCHEMA_VERSION,
  type EvidenceClaim,
  type NormalizedFeature,
  type NormalizedValue,
  type ProductIdentity,
  type RankingDefinition,
  type RankingExecutionBundle,
  type RankingInput,
  type ReviewReport,
  type ReviewThemeSummary,
  type RunManifest,
  type SourceRecord,
} from "../../shared/contracts/types.ts";

const DATE = "2026-07-15";
const TIMESTAMP = "2026-07-15T00:00:00+09:00";
const CATEGORY = "ベビーカー";
const CURRENT_PRODUCT_IDS = [
  "pid-fictional-trainlight-a",
  "pid-fictional-railrunner-b",
  "pid-fictional-datamist-c",
  "pid-fictional-conflict-d",
  "pid-fictional-twinscore-e",
] as const;

type FixtureProductId = (typeof CURRENT_PRODUCT_IDS)[number] | "pid-fictional-trainlight-a-2024-overseas";
type AxisValues = Record<string, {
  value: NormalizedValue | null;
  unit: string | null;
  value_kind: NormalizedFeature["value_kind"];
}>;

function common(recordId: string) {
  return {
    schema_version: CONTRACT_SCHEMA_VERSION,
    record_id: recordId,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
  };
}

function makeSource(
  productId: FixtureProductId,
  suffix: string,
  sourceType: SourceRecord["source_type"],
  primaryOrSecondary: SourceRecord["primary_or_secondary"],
  commercialRelation: SourceRecord["commercial_relation"],
  externalRank = false,
): SourceRecord {
  const sourceId = "src-" + productId.replace("pid-fictional-", "") + "-" + suffix;
  const productCode = productId.replace("pid-fictional-", "");
  return {
    ...common(sourceId),
    source_record_id: sourceId,
    media_name: suffix === "official" ? "架空メーカー公式資料" : "架空検証メディア",
    page_title: "架空fixture資料 " + productCode + " " + suffix,
    url: "https://example.invalid/irodori-fixture/" + productCode + "/" + suffix,
    published_date: "2026-01-15",
    updated_date: null,
    accessed_date: DATE,
    date_kind_note: null,
    target_product: productId,
    product_name_as_written: productCode,
    model_number_as_written: "FIC-" + productCode.toUpperCase(),
    model_year_as_written: productId.includes("2024") ? "2024" : "2026",
    market_as_written: productId.includes("overseas") ? "overseas" : "JP",
    match_status: "matched",
    source_type: sourceType,
    primary_or_secondary: primaryOrSecondary,
    commercial_relation: commercialRelation,
    external_rank_metadata: externalRank
      ? {
          rank_label: "架空媒体の架空順位",
          rank_value: 1,
          scale_note: "fixture専用。IRODORI得点へ入力しない",
        }
      : null,
    acquisition_status: "acquired",
    acquisition_failure_reason: null,
    notes: "架空fixture。実在する媒体・商品・評価ではない。",
  };
}

const productSpecs: Array<{
  id: FixtureProductId;
  officialName: string;
  brandName: string;
  modelNumber: string;
  modelYear: number;
  market: ProductIdentity["market"];
  lifecycle: ProductIdentity["lifecycle_status"];
}> = [
  {
    id: "pid-fictional-trainlight-a",
    officialName: "架空ベビーカー トレインライト A 2026",
    brandName: "架空ブランド あおぞら",
    modelNumber: "FIC-TLA-26-JP",
    modelYear: 2026,
    market: "JP",
    lifecycle: "current",
  },
  {
    id: "pid-fictional-railrunner-b",
    officialName: "架空ベビーカー レールランナー B 2026",
    brandName: "架空ブランド こもれび",
    modelNumber: "FIC-RRB-26-JP",
    modelYear: 2026,
    market: "JP",
    lifecycle: "current",
  },
  {
    id: "pid-fictional-datamist-c",
    officialName: "架空ベビーカー データミスト C 2026",
    brandName: "架空ブランド しずく",
    modelNumber: "FIC-DMC-26-JP",
    modelYear: 2026,
    market: "JP",
    lifecycle: "current",
  },
  {
    id: "pid-fictional-conflict-d",
    officialName: "架空ベビーカー コンフリクト D 2026",
    brandName: "架空ブランド つむぎ",
    modelNumber: "FIC-CFD-26-JP",
    modelYear: 2026,
    market: "JP",
    lifecycle: "current",
  },
  {
    id: "pid-fictional-twinscore-e",
    officialName: "架空ベビーカー ツインスコア E 2026",
    brandName: "架空ブランド ひかり",
    modelNumber: "FIC-TSE-26-JP",
    modelYear: 2026,
    market: "JP",
    lifecycle: "current",
  },
  {
    id: "pid-fictional-trainlight-a-2024-overseas",
    officialName: "架空ベビーカー トレインライト A 2024 海外仕様",
    brandName: "架空ブランド あおぞら",
    modelNumber: "FIC-TLA-24-OS",
    modelYear: 2024,
    market: "overseas",
    lifecycle: "discontinued",
  },
];

const baseSources: SourceRecord[] = productSpecs.flatMap((product) => [
  makeSource(
    product.id,
    "official",
    "official_spec_sheet",
    "primary",
    "self_published_by_maker",
  ),
  makeSource(
    product.id,
    "editorial",
    "editorial_test_media",
    "secondary",
    "none_declared",
  ),
]);

export const fictionalProductIdentities: ProductIdentity[] = productSpecs.map((product) => ({
  ...common(product.id),
  product_identity_id: product.id,
  official_name: product.officialName,
  brand_name: product.brandName,
  manufacturer_name: null,
  model_number: product.modelNumber,
  model_year: product.modelYear,
  market: product.market,
  lifecycle_status: product.lifecycle,
  predecessor_of: null,
  successor_of: null,
  variant_of: product.id.includes("2024") ? "pid-fictional-trainlight-a" : null,
  variant_axis: product.id.includes("2024") ? "market" : null,
  category: CATEGORY,
  official_url: "https://example.invalid/irodori-fixture/products/" + product.id,
  identification_status: "identified",
  identification_evidence: ["src-" + product.id.replace("pid-fictional-", "") + "-official"],
  unconfirmed_fields: [],
  site_product_id: null,
  notes: "名称・ブランド・型番を含むすべてが架空。",
}));

const fullA: AxisValues = {
  weight_body: { value: 4.8, unit: "kg", value_kind: "numeric" },
  size_open: { value: { width_mm: 450, depth_mm: 850, height_mm: 1020 }, unit: "mm", value_kind: "dimensions" },
  size_folded: { value: { width_mm: 450, depth_mm: 250, height_mm: 540 }, unit: "mm", value_kind: "dimensions" },
  folding_ease: { value: "high", unit: null, value_kind: "ordinal" },
  self_standing: { value: true, unit: null, value_kind: "boolean" },
  portability: { value: "high", unit: null, value_kind: "ordinal" },
  train_fitness: { value: "high", unit: null, value_kind: "ordinal" },
  maneuverability: { value: "medium", unit: null, value_kind: "ordinal" },
  basket_capacity: { value: 10, unit: "L", value_kind: "numeric" },
  one_operator_fitness: { value: "high", unit: null, value_kind: "ordinal" },
};

const fullB: AxisValues = {
  weight_body: { value: 7.8, unit: "kg", value_kind: "numeric" },
  size_open: { value: { width_mm: 459, depth_mm: 910, height_mm: 1050 }, unit: "mm", value_kind: "dimensions" },
  size_folded: { value: { width_mm: 470, depth_mm: 260, height_mm: 575 }, unit: "mm", value_kind: "dimensions" },
  folding_ease: { value: "high", unit: null, value_kind: "ordinal" },
  self_standing: { value: true, unit: null, value_kind: "boolean" },
  portability: { value: "medium", unit: null, value_kind: "ordinal" },
  train_fitness: { value: "high", unit: null, value_kind: "ordinal" },
  maneuverability: { value: "very_high", unit: null, value_kind: "ordinal" },
  basket_capacity: { value: 35, unit: "L", value_kind: "numeric" },
  one_operator_fitness: { value: "high", unit: null, value_kind: "ordinal" },
};

const missingC: AxisValues = {
  weight_body: { value: 5.3, unit: "kg", value_kind: "numeric" },
  size_open: { value: { width_mm: 455, depth_mm: 870, height_mm: 1010 }, unit: "mm", value_kind: "dimensions" },
  size_folded: { value: null, unit: null, value_kind: "dimensions" },
  folding_ease: { value: "medium", unit: null, value_kind: "ordinal" },
  self_standing: { value: true, unit: null, value_kind: "boolean" },
  portability: { value: null, unit: null, value_kind: "ordinal" },
  train_fitness: { value: "medium", unit: null, value_kind: "ordinal" },
  maneuverability: { value: null, unit: null, value_kind: "ordinal" },
  basket_capacity: { value: null, unit: null, value_kind: "numeric" },
  one_operator_fitness: { value: null, unit: null, value_kind: "ordinal" },
};

const fullD: AxisValues = {
  weight_body: { value: 5.6, unit: "kg", value_kind: "numeric" },
  size_open: { value: { width_mm: 470, depth_mm: 880, height_mm: 1030 }, unit: "mm", value_kind: "dimensions" },
  size_folded: { value: { width_mm: 470, depth_mm: 270, height_mm: 570 }, unit: "mm", value_kind: "dimensions" },
  folding_ease: { value: "high", unit: null, value_kind: "ordinal" },
  self_standing: { value: true, unit: null, value_kind: "boolean" },
  portability: { value: "high", unit: null, value_kind: "ordinal" },
  train_fitness: { value: "high", unit: null, value_kind: "ordinal" },
  maneuverability: { value: "high", unit: null, value_kind: "ordinal" },
  basket_capacity: { value: 25, unit: "L", value_kind: "numeric" },
  one_operator_fitness: { value: "high", unit: null, value_kind: "ordinal" },
};

const productAxisValues: Record<(typeof CURRENT_PRODUCT_IDS)[number], AxisValues> = {
  "pid-fictional-trainlight-a": fullA,
  "pid-fictional-railrunner-b": fullB,
  "pid-fictional-datamist-c": missingC,
  "pid-fictional-conflict-d": fullD,
  "pid-fictional-twinscore-e": fullA,
};

const officialAxes = new Set(["weight_body", "size_open", "size_folded", "self_standing", "basket_capacity"]);

function makeClaim(
  productId: FixtureProductId,
  axisId: string,
  axisValue: AxisValues[string],
  overrides: Partial<EvidenceClaim> = {},
): EvidenceClaim {
  const shortId = productId.replace("pid-fictional-", "");
  const sourceSuffix = officialAxes.has(axisId) ? "official" : "editorial";
  const claimId = "clm-" + shortId + "-" + axisId;
  return {
    ...common(claimId),
    evidence_claim_id: claimId,
    source_record_id: "src-" + shortId + "-" + sourceSuffix,
    product_identity_id: productId,
    claim_kind: officialAxes.has(axisId) ? "spec" : "editorial_rating",
    axis_id: axisId,
    value_raw: "架空fixture値 " + axisId,
    quote: false,
    value_normalized: axisValue.value,
    unit: axisValue.unit,
    measurement_condition: officialAxes.has(axisId) ? null : "架空の固定試験条件",
    claim_class: officialAxes.has(axisId) ? "official_spec" : "editorial_opinion",
    fact_or_inference: "fact",
    derived_from: [],
    evidence_status: "confirmed",
    conflict_with: [],
    duplicate_of: null,
    duplicate_candidate_of: [],
    reliability: {
      level: officialAxes.has(axisId) ? "high" : "medium",
      reason: "架空fixture内の固定された根拠品質",
    },
    notes: "架空fixture claim。",
    ...overrides,
  };
}

function makeFeature(
  productId: FixtureProductId,
  axisId: string,
  axisValue: AxisValues[string],
  claimIds: string[],
  overrides: Partial<NormalizedFeature> = {},
): NormalizedFeature {
  const shortId = productId.replace("pid-fictional-", "");
  const featureId = "nf-" + shortId + "-" + axisId;
  const missing = axisValue.value === null;
  return {
    ...common(featureId),
    normalized_feature_id: featureId,
    product_identity_id: productId,
    axis_id: axisId,
    value: axisValue.value,
    unit: axisValue.unit,
    value_kind: axisValue.value_kind,
    supporting_claims: missing ? [] : claimIds,
    evidence_status: missing ? "unconfirmed" : "confirmed",
    fact_or_inference: "fact",
    normalization_notes: missing ? "ローカルfixture上で未確認" : "fixture生成時に共通単位へ固定",
    independent_source_count: missing ? 0 : 1,
    notes: "架空fixture normalized feature。",
    ...overrides,
  };
}

const claims: EvidenceClaim[] = [];
const features: NormalizedFeature[] = [];

for (const productId of CURRENT_PRODUCT_IDS) {
  const axes = productAxisValues[productId];
  for (const axisId of Object.keys(axes).sort()) {
    const axisValue = axes[axisId];
    if (axisValue.value === null) {
      features.push(makeFeature(productId, axisId, axisValue, []));
      continue;
    }
    const claim = makeClaim(productId, axisId, axisValue);
    claims.push(claim);
    features.push(makeFeature(productId, axisId, axisValue, [claim.evidence_claim_id]));
  }
}

const duplicateSource = makeSource(
  "pid-fictional-trainlight-a",
  "retailer-copy",
  "retailer_page",
  "secondary",
  "affiliate",
  true,
);
const originalWeightClaimId = "clm-trainlight-a-weight_body";
const duplicateWeightClaim = makeClaim(
  "pid-fictional-trainlight-a",
  "weight_body",
  fullA.weight_body,
  {
    record_id: "clm-trainlight-a-weight-copy",
    evidence_claim_id: "clm-trainlight-a-weight-copy",
    source_record_id: duplicateSource.source_record_id,
    duplicate_of: originalWeightClaimId,
    reliability: { level: "low", reason: "公式値の転載fixture" },
  },
);
claims.push(duplicateWeightClaim);
const weightFeature = features.find((feature) =>
  feature.product_identity_id === "pid-fictional-trainlight-a" && feature.axis_id === "weight_body",
)!;
weightFeature.supporting_claims = [...weightFeature.supporting_claims, duplicateWeightClaim.evidence_claim_id];
weightFeature.normalization_notes = "公式fixture値を採用。affiliate転載claimはduplicate_ofにより独立証拠へ数えない";

const conflictProduct = "pid-fictional-conflict-d";
const conflictAxis = "train_fitness";
const conflictOriginal = claims.find((claim) =>
  claim.product_identity_id === conflictProduct && claim.axis_id === conflictAxis,
)!;
const conflictSource = makeSource(
  conflictProduct,
  "independent-conflict",
  "independent_review",
  "secondary",
  "none_declared",
);
const conflictOther = makeClaim(
  conflictProduct,
  conflictAxis,
  { value: "low", unit: null, value_kind: "ordinal" },
  {
    record_id: "clm-conflict-d-train_fitness-opposed",
    evidence_claim_id: "clm-conflict-d-train_fitness-opposed",
    source_record_id: conflictSource.source_record_id,
    value_raw: "架空fixture値 train_fitness 低評価",
    value_normalized: "low",
    evidence_status: "conflicting",
    conflict_with: [conflictOriginal.evidence_claim_id],
  },
);
conflictOriginal.evidence_status = "conflicting";
conflictOriginal.conflict_with = [conflictOther.evidence_claim_id];
claims.push(conflictOther);
const conflictFeature = features.find((feature) =>
  feature.product_identity_id === conflictProduct && feature.axis_id === conflictAxis,
)!;
conflictFeature.evidence_status = "conflicting";
conflictFeature.supporting_claims = [conflictOriginal.evidence_claim_id, conflictOther.evidence_claim_id];
conflictFeature.independent_source_count = 2;
conflictFeature.normalization_notes = "架空の相反証拠を未解決のまま保持";

const oldProductId = "pid-fictional-trainlight-a-2024-overseas";
const oldWeightValue = { value: 3.2, unit: "kg", value_kind: "numeric" } as const;
const oldWeightClaim = makeClaim(oldProductId, "weight_body", oldWeightValue);
const oldWeightFeature = makeFeature(
  oldProductId,
  "weight_body",
  oldWeightValue,
  [oldWeightClaim.evidence_claim_id],
);
claims.push(oldWeightClaim);
features.push(oldWeightFeature);

export const fictionalSourceRecords: SourceRecord[] = [
  ...baseSources,
  duplicateSource,
  conflictSource,
].sort((a, b) => a.source_record_id.localeCompare(b.source_record_id));

export const fictionalEvidenceClaims: EvidenceClaim[] = claims
  .sort((a, b) => a.evidence_claim_id.localeCompare(b.evidence_claim_id));

export const fictionalNormalizedFeatures: NormalizedFeature[] = features
  .sort((a, b) => a.normalized_feature_id.localeCompare(b.normalized_feature_id));

export const fictionalReviewThemeSummaries: ReviewThemeSummary[] = CURRENT_PRODUCT_IDS.map((productId, index) => {
  const shortId = productId.replace("pid-fictional-", "");
  const reviewId = "rts-" + shortId;
  return {
    ...common(reviewId),
    review_theme_summary_id: reviewId,
    product_identity_id: productId,
    theme: "train_commute",
    sentiment: {
      positive_count: 5 + index,
      negative_count: index,
      neutral_count: 2,
    },
    summary_text: "架空口コミの傾向を検証するための短いfixture要約。",
    representative_sources: ["src-" + shortId + "-editorial"],
    conditions: null,
    pii_check: "pass",
    evidence_status: "confirmed",
    notes: "実在口コミを含まない。",
  };
});

const ordinalPoints = {
  very_low: 0,
  low: 25,
  medium: 50,
  high: 75,
  very_high: 100,
} as const;

export const trainCommuteProposedDefinition: RankingDefinition = {
  ...common("rdef-fictional-stroller-train"),
  ranking_definition_id: "rdef-fictional-stroller-train",
  definition_version: "0.2.0",
  name: "電車移動向けランキング（架空fixture・試験設定）",
  scope: "scene",
  scene_tag: "train_commute",
  category: CATEGORY,
  axis_weights: [
    {
      axis_id: "weight_body",
      weight: 0.17,
      value_status: "proposed",
      scoring_rule: { kind: "numeric", direction: "lower_better", best: 4, worst: 10, unit: "kg" },
    },
    {
      axis_id: "size_open",
      weight: 0.13,
      value_status: "proposed",
      scoring_rule: {
        kind: "dimensions",
        metric: "width_mm",
        direction: "lower_better",
        best: 420,
        worst: 600,
        unit: "mm",
      },
    },
    {
      axis_id: "size_folded",
      weight: 0.12,
      value_status: "proposed",
      scoring_rule: {
        kind: "dimensions",
        metric: "volume_mm3",
        direction: "lower_better",
        best: 35_000_000,
        worst: 120_000_000,
        unit: "mm3",
      },
    },
    {
      axis_id: "folding_ease",
      weight: 0.13,
      value_status: "proposed",
      scoring_rule: { kind: "ordinal", points: ordinalPoints },
    },
    {
      axis_id: "self_standing",
      weight: 0.08,
      value_status: "proposed",
      scoring_rule: { kind: "boolean", preferred_value: true },
    },
    {
      axis_id: "portability",
      weight: 0.10,
      value_status: "proposed",
      scoring_rule: { kind: "ordinal", points: ordinalPoints },
    },
    {
      axis_id: "train_fitness",
      weight: 0.10,
      value_status: "proposed",
      scoring_rule: { kind: "ordinal", points: ordinalPoints },
    },
    {
      axis_id: "maneuverability",
      weight: 0.06,
      value_status: "proposed",
      scoring_rule: { kind: "ordinal", points: ordinalPoints },
    },
    {
      axis_id: "basket_capacity",
      weight: 0.05,
      value_status: "proposed",
      scoring_rule: { kind: "numeric", direction: "higher_better", best: 35, worst: 10, unit: "L" },
    },
    {
      axis_id: "one_operator_fitness",
      weight: 0.06,
      value_status: "proposed",
      scoring_rule: { kind: "ordinal", points: ordinalPoints },
    },
  ],
  required_axes: {
    axes: ["weight_body", "size_open", "folding_ease"],
    value_status: "proposed",
  },
  min_data_coverage: { value: 0.7, value_status: "proposed" },
  disqualification_rules: [
    {
      rule: "require_current_lifecycle",
      reason_template: "現行モデルではないため対象外",
      value_status: "confirmed",
    },
    {
      rule: "require_identified_product",
      reason_template: "identity未確定のため対象外",
      value_status: "confirmed",
    },
    {
      rule: "require_market_match",
      expected_market: "JP",
      reason_template: "対象市場がJPではないため対象外",
      value_status: "confirmed",
    },
  ],
  tie_breaker_rules: {
    ordered_rules: ["tie_allowed", "product_identity_id_asc"],
    value_status: "proposed",
  },
  evidence_policy: {
    accepted_statuses: ["confirmed"],
    unresolved_conflict: "hold",
    outdated: "exclude_axis",
    duplicate_handling: "representative_only",
    value_status: "proposed",
  },
  missing_data_policy: {
    below_min_coverage: "hold",
    missing_axis: "exclude_from_score",
    value_status: "proposed",
  },
  confidence_formula_ref: "confidence-proposed-v1",
  confidence_config: {
    formula_id: "confidence-proposed-v1",
    data_coverage_weight: 0.4,
    source_independence_weight: 0.25,
    primary_source_weight: 0.2,
    reliability_weight: 0.15,
    independent_sources_target_per_axis: 2,
    value_status: "proposed",
  },
  sensitivity_config: {
    weight_delta: 0.05,
    value_status: "proposed",
  },
  freshness_rule: null,
  calc_version: CALCULATION_VERSION,
  publication_status: "draft",
  notes: "すべて設計検証用の仮値。安全基準、他媒体順位、商業条件は得点軸に含めない。",
};

export const fictionalRankingInput: RankingInput = {
  ...common("rin-fictional-train-001"),
  ranking_input_id: "rin-fictional-train-001",
  ranking_definition_id: trainCommuteProposedDefinition.ranking_definition_id,
  definition_version: trainCommuteProposedDefinition.definition_version,
  run_id: "run-fictional-ranking-001",
  snapshot_date: DATE,
  candidates: CURRENT_PRODUCT_IDS.map((productId) => ({
    product_identity_id: productId,
    feature_refs: fictionalNormalizedFeatures
      .filter((feature) => feature.product_identity_id === productId)
      .map((feature) => feature.normalized_feature_id),
    review_refs: ["rts-" + productId.replace("pid-fictional-", "")],
    data_coverage: null,
  })),
  excluded: [],
  input_hash: null,
  notes: "架空fixtureだけを含む入力。",
};

export const fictionalRunManifest: RunManifest = {
  ...common("runm-fictional-ranking-001"),
  run_id: "run-fictional-ranking-001",
  purpose: "架空ベビーカーfixtureで決定論的ランキング処理を検証する",
  executed_by: "codex",
  started_at: TIMESTAMP,
  finished_at: TIMESTAMP,
  target_products: [...CURRENT_PRODUCT_IDS],
  steps: [
    {
      skill_name: "irodori-ranking-engine",
      started_at: TIMESTAMP,
      finished_at: TIMESTAMP,
      result: "pass",
    },
  ],
  config_refs: {
    ranking_definition_id: trainCommuteProposedDefinition.ranking_definition_id,
    ranking_definition_version: trainCommuteProposedDefinition.definition_version,
    calc_version: CALCULATION_VERSION,
    terminology_version: "0.2.0",
    contracts_version: CONTRACT_SCHEMA_VERSION,
  },
  stop_reason: null,
  artifacts: [
    "irodori-ranking-engine/fixtures/fictional-train-commute.ts",
  ],
  notes: "実在商品を含まない。",
};

export const fictionalReviewReport: ReviewReport = {
  ...common("rrep-fictional-ranking-001"),
  review_report_id: "rrep-fictional-ranking-001",
  run_id: fictionalRunManifest.run_id,
  summary: "架空商品だけを用いてデータ契約と決定論的ランキングを検証した。",
  product_summaries: CURRENT_PRODUCT_IDS.map((productId) => ({
    product_identity_id: productId,
    identification_status: "identified",
    source_count: fictionalSourceRecords.filter((source) => source.target_product === productId).length,
    claim_count: fictionalEvidenceClaims.filter((claim) => claim.product_identity_id === productId).length,
    unconfirmed_axes: fictionalNormalizedFeatures
      .filter((feature) => feature.product_identity_id === productId && feature.value === null)
      .map((feature) => feature.axis_id),
    conflicts: fictionalEvidenceClaims.filter(
      (claim) => claim.product_identity_id === productId && claim.evidence_status === "conflicting",
    ).length,
  })),
  validation_summary: [
    {
      check_name: "fictional_data_only",
      result: "pass",
      detail: "全商品名・ブランド名・URLに架空fixtureであることを明示",
    },
  ],
  open_questions: [
    "試験重み、最低data_coverage、confidence式、感度幅はproposedのまま",
  ],
  recommended_next_actions: [
    "ユーザー判断後にパイロット調査計画を確定する",
  ],
  publication_status: "review_required",
  notes: "公開用レポートではない。",
};

export const fictionalRankingBundle: RankingExecutionBundle = {
  definition: trainCommuteProposedDefinition,
  input: fictionalRankingInput,
  product_identities: fictionalProductIdentities,
  source_records: fictionalSourceRecords,
  evidence_claims: fictionalEvidenceClaims,
  normalized_features: fictionalNormalizedFeatures,
  review_theme_summaries: fictionalReviewThemeSummaries,
};

export const isolatedOldMarketFeatureId = oldWeightFeature.normalized_feature_id;
