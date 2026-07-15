/**
 * 補助ファイル(契約上の理由): 本runの成果物に対する10契約の実行時検証と
 * 参照整合性チェックを再現可能にするための検証スクリプト。
 * shared/contracts/validators.ts のバリデーターをそのまま使用する(独自再実装をしない)。
 *
 * 実行方法(リポジトリルートから):
 *   node agent-skills/irodori/runs/2026-07-15-cybex-melio-carbon-2026-official/validate-run.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateEvidenceClaim,
  validateNormalizedFeature,
  validateProductIdentity,
  validateReviewReport,
  validateRunManifest,
  validateSourceRecord,
} from "../../shared/contracts/validators.ts";

const here = dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(readFileSync(join(here, name), "utf-8"));

const manifest = load("run-manifest.json");
const identity = load("product-identity.json");
const sources = load("sources.json");
const claims = load("evidence-claims.json");
const features = load("normalized-features.json");
const report = load("review-report.json");

const failures = [];
const check = (name, result, detail = "") => {
  const ok = result === true || result === "pass";
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures.push(name);
};
const contract = (name, reportValue) => {
  check(name, reportValue.result, reportValue.issues.map((i) => `${i.path}: ${i.message}`).join("; "));
};

// 1) 契約の実行時検証(本runに存在する6契約。ranking系3契約とreview_theme_summaryは本runでは意図的に不作成)
contract("run_manifest", validateRunManifest(manifest));
contract("product_identity", validateProductIdentity(identity));
sources.forEach((s, i) => contract(`source_record[${i}] ${s.source_record_id}`, validateSourceRecord(s)));
claims.forEach((c, i) => contract(`evidence_claim[${i}] ${c.evidence_claim_id}`, validateEvidenceClaim(c)));
features.forEach((f, i) => contract(`normalized_feature[${i}] ${f.normalized_feature_id}`, validateNormalizedFeature(f)));
contract("review_report", validateReviewReport(report));

// 2) 参照整合性
const sourceIds = new Set(sources.map((s) => s.source_record_id));
const claimIds = new Set(claims.map((c) => c.evidence_claim_id));
const claimById = new Map(claims.map((c) => [c.evidence_claim_id, c]));

check("claim→source 参照", claims.every((c) => sourceIds.has(c.source_record_id)));
check("claim→identity 参照", claims.every((c) => c.product_identity_id === identity.product_identity_id));
check("source→identity 参照", sources.every((s) => s.target_product === null || s.target_product === identity.product_identity_id));
check("identity.identification_evidence→source 参照", identity.identification_evidence.every((id) => sourceIds.has(id)));
check(
  "variant.product_codeとmodel_numberを分離",
  identity.model_number === null
    && identity.variants.length === 1
    && identity.variants[0].product_code === "526000803"
    && identity.variants[0].product_code !== identity.model_number,
);
check(
  "variant.supporting_claims→claim 参照",
  identity.variants.every((variant) => variant.supporting_claims.every((id) => claimIds.has(id))),
);
check(
  "site_product_id関連付け状態",
  identity.site_product_id === "4" && identity.site_product_match_status === "probable",
);
check(
  "feature→claim 参照 + axis整合",
  features.every((f) =>
    f.supporting_claims.every((id) => {
      const c = claimById.get(id);
      return c && c.product_identity_id === f.product_identity_id && (c.axis_id === null || c.axis_id === f.axis_id);
    }),
  ),
);
check(
  "inferenceにderived_fromがあり実在claimを指す",
  claims.every((c) => c.fact_or_inference !== "inference"
    || (c.derived_from.length > 0 && c.derived_from.every((id) => claimIds.has(id)))),
);
check(
  "conflict参照の相互整合",
  claims.every((c) => c.conflict_with.every((id) => {
    const other = claimById.get(id);
    return other && other.conflict_with.includes(c.evidence_claim_id);
  })),
);
check(
  "conflictingステータスのclaimはconflict_with必須",
  claims.every((c) => c.evidence_status !== "conflicting" || c.conflict_with.length > 0),
);

// 3) 不明値の表現(0・空文字への変換禁止)
const noEmptyString = (obj) =>
  JSON.stringify(obj, (key, v) => (typeof v === "string" && v.trim() === "" ? "__EMPTY__" : v)).includes("__EMPTY__") === false;
check("不明値が空文字に変換されていない", [manifest, identity, ...sources, ...claims, ...features, report].every(noEmptyString));
check(
  "value=nullのfeatureはunconfirmed欠損または根拠付きconflicting",
  features.every((f) => f.value !== null
    || (f.evidence_status === "unconfirmed" && f.supporting_claims.length === 0 && f.independent_source_count === 0)
    || (f.evidence_status === "conflicting" && f.supporting_claims.length >= 2 && f.independent_source_count >= 1)),
);

// 4) 情報源ポリシー(公式ドメイン限定)
const OFFICIAL_HOSTS = [
  "www.cybex-online.com",
  "cybex-online.com",
  "download.cybex-online.com",
  "transmorpher.goodbabyprod.com", // 公式ダウンロードセンターが直接リンクする配信基盤
];
check("URLが公式ドメインのみ", sources.every((s) => OFFICIAL_HOSTS.includes(new URL(s.url).hostname)));
check("公式以外のsource_typeが入っていない", sources.every((s) => ["official_product_page", "official_spec_sheet", "official_manual", "official_news"].includes(s.source_type)));
check("全sourceがメーカー自身の発信として記録", sources.every((s) => s.commercial_relation === "self_published_by_maker"));
const manual = sources.find((source) => source.source_type === "official_manual");
check(
  "PDF公式到達経路を構造化保存",
  manual
    && manual.match_status === "probable"
    && manual.discovery_page_url === "https://download.cybex-online.com/products/melio-2026"
    && manual.direct_asset_url === manual.url
    && manual.discovered_via_official_page === true,
);
check(
  "included_accessoriesへ語彙統一",
  claims.every((claim) => claim.axis_id !== "included_items")
    && features.every((feature) => feature.axis_id !== "included_items")
    && claims.some((claim) => claim.axis_id === "included_accessories")
    && features.some((feature) => feature.axis_id === "included_accessories"),
);
check(
  "新生児対応の公式表記3claimとconflicting featureを保持",
  ["clm-melio26-004", "clm-melio26-012", "clm-melio26-014"].every(
    (id) => claimById.get(id)?.evidence_status === "conflicting",
  )
    && features.find((feature) => feature.axis_id === "newborn_ready")?.evidence_status === "conflicting"
    && features.find((feature) => feature.axis_id === "newborn_ready")?.value === null,
);

// 5) ランキング禁止(実在商品にscore・順位を作らない)
const runFiles = readdirSync(here);
check("ranking_input / ranking_result ファイルが存在しない", runFiles.every((f) => !/ranking/i.test(f)));
const allText = JSON.stringify([manifest, identity, sources, claims, features]);
check("observed_score・score・rankフィールドが存在しない", !/"observed_score"|"score"|"rank"|"ranking_result_id"|"ranking_input_id"/.test(allText));
check("review_reportのpublication_statusがdraft/review_required", ["draft", "review_required"].includes(report.publication_status));
check(
  "独立監査20項目を記録し全件pass",
  report.validation_summary.length === 20
    && report.validation_summary.every((item) => /^audit_[0-9]{2}_/.test(item.check_name) && item.result === "pass"),
);
check(
  "安全側の要約をeditorial_noteへ分離",
  report.editorial_notes?.length === 1
    && report.editorial_notes[0].evidence_status === "conflicting"
    && report.editorial_notes[0].supporting_claims.every((id) => claimIds.has(id)),
);

console.log(failures.length === 0 ? "\nALL CHECKS PASSED" : `\n${failures.length} CHECK(S) FAILED`);
process.exit(failures.length === 0 ? 0 : 1);
