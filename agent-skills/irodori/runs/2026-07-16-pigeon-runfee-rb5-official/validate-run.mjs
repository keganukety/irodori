/**
 * 補助ファイル(契約上の理由): 本runの成果物に対する契約の実行時検証と
 * 参照整合性チェックを再現可能にするための検証スクリプト。
 * shared/contracts/validators.ts のバリデーターをそのまま使用する(独自再実装をしない)。
 *
 * 実行方法(リポジトリルートから):
 *   node agent-skills/irodori/runs/2026-07-16-pigeon-runfee-rb5-official/validate-run.mjs
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

// 1) 契約の実行時検証
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
  "generation_code RB5をmodel_number/model_yearへ昇格しない",
  identity.model_number === null
    && identity.model_year === null
    && identity.generation_code === "RB5"
    && identity.official_name.includes(identity.generation_code)
    && identity.variants.length === 2
    && identity.variants.every((v) => v.product_code !== identity.generation_code),
);
check(
  "variant.supporting_claims→claim 参照",
  identity.variants.every((variant) => variant.supporting_claims.every((id) => claimIds.has(id))),
);
check(
  "site_product関連付け状態(ローカル候補なし)",
  identity.site_product_id === null && identity.site_product_match_status === "unmatched",
);
check(
  "model_year未確認でprovisionalを維持",
  identity.model_year === null
    && identity.identification_status === "provisional"
    && identity.unconfirmed_fields.includes("model_year"),
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
check("research段階のinference claimが存在しない", claims.every((c) => c.fact_or_inference === "fact"));
check(
  "conflict参照の相互整合",
  claims.every((c) => c.conflict_with.every((id) => {
    const other = claimById.get(id);
    return other && other.conflict_with.includes(c.evidence_claim_id);
  })),
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
check(
  "max_loadを安全基準A形から推定していない",
  features.find((f) => f.axis_id === "max_load")?.value === null,
);

// 4) 情報源ポリシー(公式ドメイン限定)
const OFFICIAL_HOSTS = ["pigeon.info", "products.pigeon.co.jp", "support.pigeon.co.jp"];
check("URLが公式ドメインのみ", sources.every((s) => OFFICIAL_HOSTS.includes(new URL(s.url).hostname)));
check(
  "公式発信のみ(第三者媒体sourceが存在しない)",
  sources.every((s) => s.commercial_relation === "self_published_by_maker"),
);
const skippedManualGate = sources.find((s) => s.acquisition_status === "skipped");
check(
  "取説同意ゲートをskipped+理由付きで記録",
  Boolean(skippedManualGate)
    && skippedManualGate.manual_gate_status === "skipped_terms_acceptance_required"
    && typeof skippedManualGate.acquisition_failure_reason === "string"
    && skippedManualGate.acquisition_failure_reason.length > 0
    && skippedManualGate.direct_asset_url === null,
);
check(
  "official_manual(直接PDF)sourceを作っていない(未取得のため)",
  sources.every((s) => s.source_type !== "official_manual"),
);
check(
  "受賞情報はexternal_rank_metadataのみでaxisへ未接続",
  claims.every((c) => !/グッドデザイン/.test(c.value_raw))
    && sources.some((s) => s.external_rank_metadata !== null && /グッドデザイン/.test(s.external_rank_metadata.rank_label)),
);
check(
  "included_accessories語彙(deprecated aliasなし)",
  claims.every((c) => c.axis_id !== "included_items") && features.every((f) => f.axis_id !== "included_items"),
);

// 5) ランキング禁止(実在商品にscore・順位を作らない)
const runFiles = readdirSync(here);
check("ranking_input / ranking_result ファイルが存在しない", runFiles.every((f) => !/ranking/i.test(f)));
const allText = JSON.stringify([manifest, identity, sources, claims, features]);
check("observed_score・score・rankフィールドが存在しない", !/"observed_score"|"score"|"rank"|"ranking_result_id"|"ranking_input_id"/.test(allText));
check("review_reportのpublication_statusがdraft/review_required", ["draft", "review_required"].includes(report.publication_status));

console.log(failures.length === 0 ? "\nALL CHECKS PASSED" : `\n${failures.length} CHECK(S) FAILED`);
process.exit(failures.length === 0 ? 0 : 1);
