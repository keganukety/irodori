/**
 * 補助ファイル: 5商品公式ベンチマーク全体の追加検証スクリプト。
 * - official-feature-matrix.jsonの再現性(build-feature-matrix.mjsの再計算と完全一致)
 * - 入力順非依存(商品順を入れ替えても同じ行集合になる)
 * - matrix→run(claim/source/feature)の参照整合性
 * - 公式ドメイン限定・第三者媒体/楽天データ不使用
 * - 実在商品のscore・順位・ranking成果物の不存在
 *
 * 実行方法(リポジトリルートから):
 *   node agent-skills/irodori/benchmarks/stroller-official-5/validate-benchmark.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildMatrix, BENCHMARK_AXES, BENCHMARK_RUNS, TRAIN_COMMUTE_PROPOSED_WEIGHTS } from "./build-feature-matrix.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const runsDir = join(here, "..", "..", "runs");
const load = (path) => JSON.parse(readFileSync(path, "utf-8"));

const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures.push(name);
};

const matrixOnDisk = load(join(here, "official-feature-matrix.json"));
const rebuilt = buildMatrix();

// 1) 再現性: 保存済みマトリクスと再計算結果が完全一致
check(
  "matrix再現性(再計算と完全一致)",
  JSON.stringify(matrixOnDisk) === JSON.stringify(rebuilt),
);

// 2) 入力順非依存: 行集合はソート済みキーで一意
const entryKey = (e) => `${e.product_identity_id}::${e.axis_id}`;
const keys = matrixOnDisk.entries.map(entryKey);
check("行キー(product×axis)が一意", new Set(keys).size === keys.length);
check(
  "行がproduct_identity_id昇順×axis定義順で並ぶ(順序決定論)",
  JSON.stringify(keys) === JSON.stringify([...matrixOnDisk.products.map((p) => p.product_identity_id)].sort()
    .flatMap((pid) => BENCHMARK_AXES.map((axis) => `${pid}::${axis}`))),
);
check("エントリ数 = 5商品 × 14軸 = 70", matrixOnDisk.entries.length === 70);

// 3) matrix→runの参照整合性
const runsByPid = new Map();
for (const { run_dir } of BENCHMARK_RUNS) {
  const identity = load(join(runsDir, run_dir, "product-identity.json"));
  runsByPid.set(identity.product_identity_id, {
    identity,
    claims: load(join(runsDir, run_dir, "evidence-claims.json")),
    features: load(join(runsDir, run_dir, "normalized-features.json")),
    sources: load(join(runsDir, run_dir, "sources.json")),
    runDir: run_dir,
  });
}
check("5商品のproduct_identity_idがrunsと一致", matrixOnDisk.products.every((p) => runsByPid.has(p.product_identity_id)) && matrixOnDisk.products.length === 5);

let refOk = true;
let valueOk = true;
for (const entry of matrixOnDisk.entries) {
  const run = runsByPid.get(entry.product_identity_id);
  if (!run) { refOk = false; continue; }
  const claimIds = new Set(run.claims.map((c) => c.evidence_claim_id));
  const sourceIds = new Set(run.sources.map((s) => s.source_record_id));
  if (!entry.supporting_claim_ids.every((id) => claimIds.has(id))) refOk = false;
  if (!entry.source_record_ids.every((id) => sourceIds.has(id))) refOk = false;
  const feature = run.features.find((f) => f.axis_id === entry.axis_id);
  if (!feature
    || JSON.stringify(feature.value) !== JSON.stringify(entry.value)
    || feature.unit !== entry.unit
    || feature.evidence_status !== entry.evidence_status
    || JSON.stringify([...feature.supporting_claims].sort()) !== JSON.stringify(entry.supporting_claim_ids)) {
    valueOk = false;
  }
}
check("matrixのclaim/source参照がrunsに実在", refOk);
check("matrixの値・単位・evidence_statusがrunのnormalized_featureと一致", valueOk);

// 4) coverage再現性(matrix内のcoverageを独立に再計算)
const round4 = (n) => Math.round(n * 10000) / 10000;
const trainAxes = Object.keys(TRAIN_COMMUTE_PROPOSED_WEIGHTS).sort();
const totalTrainWeight = trainAxes.reduce((sum, axis) => sum + TRAIN_COMMUTE_PROPOSED_WEIGHTS[axis], 0);
let coverageOk = true;
for (const cov of matrixOnDisk.coverage) {
  const confirmed = matrixOnDisk.entries
    .filter((e) => e.product_identity_id === cov.product_identity_id && e.evidence_status === "confirmed")
    .map((e) => e.axis_id);
  const confirmedTrain = trainAxes.filter((axis) => confirmed.includes(axis));
  const weighted = round4(confirmedTrain.reduce((s, a) => s + TRAIN_COMMUTE_PROPOSED_WEIGHTS[a], 0) / totalTrainWeight);
  if (cov.confirmed_axis_count_benchmark14 !== confirmed.length
    || cov.data_coverage_benchmark14 !== round4(confirmed.length / BENCHMARK_AXES.length)
    || cov.train_commute_proposed.weighted_data_coverage !== weighted
    || cov.train_commute_proposed.value_status !== "proposed") {
    coverageOk = false;
  }
}
check("coverage計算の再現性(独立再計算と一致・weightはproposed明記)", coverageOk);

// 5) 公式ドメイン限定・第三者媒体/楽天データ不使用
const OFFICIAL_HOSTS = new Set([
  "www.aprica.jp", "aprica.jp",
  "www.combi.co.jp", "combi.co.jp",
  "pigeon.info", "products.pigeon.co.jp", "support.pigeon.co.jp",
  "www.cybex-online.com", "cybex-online.com", "download.cybex-online.com",
  "transmorpher.goodbabyprod.com",
]);
const allSources = [...runsByPid.values()].flatMap((r) => r.sources);
check("全sourceが公式ドメインのみ", allSources.every((s) => OFFICIAL_HOSTS.has(new URL(s.url).hostname)));
check("全sourceがメーカー自身の発信", allSources.every((s) => s.commercial_relation === "self_published_by_maker"));
const FORBIDDEN_MEDIA = /my-?best|マイベスト|kakaku|価格\.com|たまひよ|tamahiyo|rakuten|楽天|amazon|yahoo/i;
const allRunText = [...runsByPid.values()]
  .map((r) => JSON.stringify([r.sources.map((s) => s.url), r.claims.map((c) => c.source_record_id)]))
  .join("");
check("第三者媒体・楽天・EC由来のURL/参照が存在しない", !FORBIDDEN_MEDIA.test(allRunText));
check(
  "第三者claim_class(editorial/review等)が存在しない",
  [...runsByPid.values()].every((r) => r.claims.every((c) =>
    ["official_spec", "manufacturer_claim", "manual_safety", "irodori_inference"].includes(c.claim_class))),
);

// 6) ランキング禁止
const benchFiles = readdirSync(here);
check("benchmarks配下にranking成果物ファイルがない", benchFiles.every((f) => !/^ranking|ranking_(input|result)/i.test(f)));
const matrixText = JSON.stringify(matrixOnDisk);
check(
  "matrixにobserved_score・score・rank・星・順位フィールドがない",
  !/"observed_score"|"score"|"rank"(?!ing_artifacts)|"stars"|"winner"/.test(matrixText),
);
check("matrixがranking不作成を明記", matrixOnDisk.ranking_artifacts.startsWith("none"));

// 7) 5商品共通軸の確認(coverage-report.mdの記載と整合)
const fullyCovered = matrixOnDisk.axis_coverage.filter((a) => a.confirmed_product_count === 5).map((a) => a.axis_id).sort();
check(
  "5商品すべてで確認できた軸 = weight_body/size_open/size_folded/basket_capacity/care_ease",
  JSON.stringify(fullyCovered) === JSON.stringify(["basket_capacity", "care_ease", "size_folded", "size_open", "weight_body"]),
);
const basketUnits = matrixOnDisk.axis_coverage.find((a) => a.axis_id === "basket_capacity").units_observed;
check("basket_capacityの単位不一致(kg/L)を検出・記録", JSON.stringify(basketUnits) === JSON.stringify(["L", "kg"]));

console.log(failures.length === 0 ? "\nALL BENCHMARK CHECKS PASSED" : `\n${failures.length} CHECK(S) FAILED`);
process.exit(failures.length === 0 ? 0 : 1);
