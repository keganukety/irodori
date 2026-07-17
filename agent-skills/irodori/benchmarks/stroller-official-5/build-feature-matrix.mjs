/**
 * 補助ファイル: 5商品公式ベンチマークのofficial-feature-matrix.jsonを
 * 各runの成果物から決定論的に生成するスクリプト。
 * 同じ入力なら同じ出力になる(生成順・入力順に依存しない)。
 * scoreや順位は一切計算しない。coverage(データ充足率)のみ算出する。
 *
 * 実行方法(リポジトリルートから):
 *   node agent-skills/irodori/benchmarks/stroller-official-5/build-feature-matrix.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const runsDir = join(here, "..", "..", "runs");

/** ベンチマークで比較する評価軸(terminology.md §5の既存語彙のみ。新規軸は作らない) */
export const BENCHMARK_AXES = [
  "weight_body",
  "size_open",
  "size_folded",
  "target_age",
  "max_load",
  "basket_capacity",
  "folding_ease",
  "self_standing",
  "warranty",
  "care_ease",
  "included_accessories",
  "caution",
  "newborn_ready",
  "price",
];

export const NUMERIC_COMPARISON_AXES = [
  "weight_body",
  "size_open",
  "size_folded",
  "target_age",
  "max_load",
  "basket_capacity",
  "price",
];

export const MEASUREMENT_SCOPES = [
  "frame_and_seat",
  "excluding_accessories",
  "including_standard_accessories",
  "manufacturer_stated_unspecified",
  "unknown",
  "not_applicable",
];

export const APPROXIMATION_STATUSES = ["exact", "approximate", "range", "unknown"];
export const COMPARABILITY_STATUSES = ["full", "partial", "unknown", "not_comparable"];

/** 対象5商品のrunディレクトリ(product_identity_id昇順で保持) */
export const BENCHMARK_RUNS = [
  { run_dir: "2026-07-16-aprica-karoon-air-mesh-ac-official" },
  { run_dir: "2026-07-16-combi-sugocal-eggshock-la-official" },
  { run_dir: "2026-07-16-cybex-libelle-2026-official" },
  { run_dir: "2026-07-15-cybex-melio-carbon-2026-official" },
  { run_dir: "2026-07-16-pigeon-runfee-rb5-official" },
];

/**
 * 電車移動向けランキング定義の提案weight(fixtures/fictional-train-commute.tsのProposed Default)。
 * 全値が試験値(proposed)であり確定値ではない。scoreには使わずweighted coverage算出のみに使う。
 */
export const BASELINE_TRAIN_COMMUTE_COVERAGE_WEIGHTS = {
  weight_body: 0.17,
  size_open: 0.13,
  size_folded: 0.12,
  folding_ease: 0.13,
  self_standing: 0.08,
  portability: 0.10,
  train_fitness: 0.10,
  maneuverability: 0.06,
  basket_capacity: 0.05,
  one_operator_fitness: 0.06,
};

const load = (dir, name) => JSON.parse(readFileSync(join(runsDir, dir, name), "utf-8"));

function measurementMetadata(identity, feature, supportingClaims) {
  const sourceText = supportingClaims
    .flatMap((claim) => [claim.value_raw, claim.notes, claim.measurement_condition])
    .filter((value) => typeof value === "string" && value.length > 0)
    .join(" / ");
  const statedConditions = [...new Set(supportingClaims
    .map((claim) => claim.measurement_condition)
    .filter((value) => typeof value === "string" && value.length > 0))];
  const measurementCondition = statedConditions.length > 0 ? statedConditions.join(" / ") : "unknown";
  const hasApproximation = /approx\.|約|頃|ころ|目安/i.test(sourceText);
  const hasRange = /\d\s*(?:-|–|〜|～)\s*\d/.test(sourceText);
  const approximationStatus = feature.value === null || feature.evidence_status === "unconfirmed"
    ? "unknown"
    : hasApproximation
      ? "approximate"
      : hasRange
        ? "range"
        : "exact";

  let measurementScope = "not_applicable";
  let comparabilityStatus = "full";
  let comparabilityReason = "公式値の単位と対象が明示され、近似・範囲表記を含まない";

  if (feature.value === null || ["unconfirmed", "conflicting"].includes(feature.evidence_status)) {
    comparabilityStatus = "unknown";
    comparabilityReason = "値が未確認または未解決矛盾を含むため比較可否を確定できない";
  } else if (feature.axis_id === "weight_body") {
    measurementScope = /除く|excluding/i.test(sourceText)
      ? "excluding_accessories"
      : "manufacturer_stated_unspecified";
    if (measurementScope === "manufacturer_stated_unspecified") {
      comparabilityStatus = "unknown";
      comparabilityReason = "メーカー公式値だが付属品を含む測定対象が明示されていない";
    } else {
      comparabilityStatus = "partial";
      comparabilityReason = "除外付属品が明示されるが、商品ごとに除外対象が異なるため部分比較に限る";
    }
  } else if (feature.axis_id === "basket_capacity") {
    comparabilityStatus = "not_comparable";
    comparabilityReason = "5商品内で耐荷重kgと容量Lが混在し、相互換算しない";
  } else if (feature.axis_id === "price") {
    comparabilityStatus = "partial";
    comparabilityReason = "メーカー希望小売価格・公式ストア価格・税込価格の表示種別が異なる";
  } else if (["size_open", "size_folded"].includes(feature.axis_id) && measurementCondition === "unknown") {
    comparabilityStatus = "unknown";
    comparabilityReason = "展開・折りたたみ状態以外の測定条件が公式sourceで明示されていない";
  } else if (approximationStatus !== "exact") {
    comparabilityStatus = "partial";
    comparabilityReason = approximationStatus === "approximate"
      ? "公式値に約・頃・目安表記を含むため部分比較に限る"
      : "公式値が可変範囲を含むため単一条件の完全比較には使わない";
  }

  return {
    comparison_metadata_id: `cmp-${identity.product_identity_id}-${feature.axis_id}`,
    product_identity_id: identity.product_identity_id,
    axis_id: feature.axis_id,
    measurement_scope: measurementScope,
    measurement_condition: measurementCondition,
    approximation_status: approximationStatus,
    comparability_status: comparabilityStatus,
    comparability_reason: comparabilityReason,
  };
}

export function buildMatrix() {
  const products = BENCHMARK_RUNS.map(({ run_dir }) => {
    const identity = load(run_dir, "product-identity.json");
    const claims = load(run_dir, "evidence-claims.json");
    const features = load(run_dir, "normalized-features.json");
    return { run_dir, identity, claims, features };
  }).sort((a, b) => a.identity.product_identity_id.localeCompare(b.identity.product_identity_id));

  const entries = [];
  const comparisonMetadata = [];
  for (const { run_dir, identity, claims, features } of products) {
    const claimById = new Map(claims.map((c) => [c.evidence_claim_id, c]));
    for (const axisId of BENCHMARK_AXES) {
      const feature = features.find((f) => f.axis_id === axisId);
      if (!feature) {
        throw new Error(`missing normalized_feature: ${identity.product_identity_id} / ${axisId}`);
      }
      const supportingClaimIds = [...feature.supporting_claims].sort();
      const sourceRecordIds = [...new Set(supportingClaimIds.map((id) => {
        const claim = claimById.get(id);
        if (!claim) throw new Error(`missing claim ${id} in ${run_dir}`);
        return claim.source_record_id;
      }))].sort();
      const supportingClaims = supportingClaimIds.map((id) => claimById.get(id));
      entries.push({
        product_identity_id: identity.product_identity_id,
        axis_id: axisId,
        value: feature.value,
        unit: feature.unit,
        value_kind: feature.value_kind,
        evidence_status: feature.evidence_status,
        supporting_claim_ids: supportingClaimIds,
        source_record_ids: sourceRecordIds,
        match_status: identity.site_product_match_status,
        human_review_status: "pending",
      });
      if (NUMERIC_COMPARISON_AXES.includes(axisId)) {
        comparisonMetadata.push(measurementMetadata(identity, feature, supportingClaims));
      }
    }
  }

  const trainAxes = Object.keys(BASELINE_TRAIN_COMMUTE_COVERAGE_WEIGHTS).sort();
  const totalTrainWeight = trainAxes.reduce((sum, axis) => sum + BASELINE_TRAIN_COMMUTE_COVERAGE_WEIGHTS[axis], 0);
  const round4 = (n) => Math.round(n * 10000) / 10000;

  const coverage = products.map(({ identity }) => {
    const pid = identity.product_identity_id;
    const confirmedAxes = entries
      .filter((e) => e.product_identity_id === pid && e.evidence_status === "confirmed")
      .map((e) => e.axis_id)
      .sort();
    const confirmedTrainAxes = trainAxes.filter((axis) => confirmedAxes.includes(axis));
    const confirmedTrainWeight = confirmedTrainAxes.reduce((sum, axis) => sum + BASELINE_TRAIN_COMMUTE_COVERAGE_WEIGHTS[axis], 0);
    return {
      product_identity_id: pid,
      confirmed_axis_count_benchmark14: confirmedAxes.length,
      data_coverage_benchmark14: round4(confirmedAxes.length / BENCHMARK_AXES.length),
      confirmed_axes_benchmark14: confirmedAxes,
      baseline_train_commute_coverage: {
        value_status: "baseline_diagnostic_not_operational",
        note: "c1646c9以前の10軸coverage診断を履歴として保持。現在の4親軸ルーブリック、配点、coverage閾値ではない",
        point_allocation: false,
        coverage_threshold_adopted: false,
        confirmed_axis_count_10: confirmedTrainAxes.length,
        data_coverage_10: round4(confirmedTrainAxes.length / trainAxes.length),
        legacy_weighted_data_coverage: round4(confirmedTrainWeight / totalTrainWeight),
        confirmed_axes: confirmedTrainAxes,
      },
    };
  });

  const axisCoverage = BENCHMARK_AXES.map((axisId) => {
    const axisEntries = entries.filter((e) => e.axis_id === axisId);
    const byStatus = {};
    for (const e of axisEntries) byStatus[e.evidence_status] = (byStatus[e.evidence_status] ?? 0) + 1;
    const units = [...new Set(axisEntries.filter((e) => e.unit !== null).map((e) => e.unit))].sort();
    return {
      axis_id: axisId,
      confirmed_product_count: axisEntries.filter((e) => e.evidence_status === "confirmed").length,
      status_breakdown: byStatus,
      units_observed: units,
    };
  });

  return {
    schema_note: "official-feature-matrixは12契約の外側にあるベンチマーク集計ビュー。行の値はrunsのnormalized_feature/claim/sourceをそのまま参照し、独自の値を持たない。scoreや順位は含まない。",
    benchmark_id: "stroller-official-5",
    generated_by: "build-feature-matrix.mjs",
    generated_at: "2026-07-16T17:30:00+09:00",
    axis_ids: BENCHMARK_AXES,
    products: products.map(({ run_dir, identity }) => ({
      product_identity_id: identity.product_identity_id,
      official_name: identity.official_name,
      brand_name: identity.brand_name,
      model_year: identity.model_year,
      generation_code: identity.generation_code ?? null,
      market: identity.market,
      identification_status: identity.identification_status,
      site_product_id: identity.site_product_id,
      site_product_match_status: identity.site_product_match_status,
      run_dir: `agent-skills/irodori/runs/${run_dir}`,
    })),
    entries,
    measurement_metadata_schema: {
      applies_to_axes: NUMERIC_COMPARISON_AXES,
      measurement_scope_values: MEASUREMENT_SCOPES,
      approximation_status_values: APPROXIMATION_STATUSES,
      comparability_status_values: COMPARABILITY_STATUSES,
      unknown_rule: "公式sourceに測定対象または条件の記載がなければunknownのまま保持する",
    },
    comparison_metadata: comparisonMetadata,
    coverage,
    axis_coverage: axisCoverage,
    ranking_artifacts: "none (ranking_input / ranking_result / observed_score / score / 順位は作成しない)",
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const matrix = buildMatrix();
  writeFileSync(join(here, "official-feature-matrix.json"), JSON.stringify(matrix, null, 2) + "\n", "utf-8");
  console.log(`official-feature-matrix.json generated: ${matrix.entries.length} entries / ${matrix.products.length} products`);
}
