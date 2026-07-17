import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const resultPath = join(here, "analysis-result.json");
const snapshotPath = join(here, "input-snapshot.json");
const outputPath = join(here, "private-report.md");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function metric(value) {
  return value === null || value === undefined ? "null" : String(value);
}

function profileDecision(item) {
  return `${item.profile_id}: display=${item.score_display_eligibility}, ranking=${item.ranking_eligibility}`;
}

function maxAbsoluteDelta(result, patternKind) {
  return Math.max(0, ...result.pattern_results
    .filter((pattern) => pattern.pattern_kind === patternKind)
    .flatMap((pattern) => pattern.entries)
    .map((entry) => Math.abs(entry.baseline_partial_score_delta ?? 0)));
}

function primaryCoverageRows(result) {
  const primaryScenario = {
    P01: "a_type_primary_strict_scope",
    P02: "a_type_primary_strict_scope",
    P03: "a_type_primary_strict_scope",
    P04: "a_type_primary_strict_scope",
    P05: "b_type_compact_strict_scope",
  };
  return result.coverage_analysis.results.filter((item) => primaryScenario[item.product_analysis_id] === item.scenario_id);
}

export function renderPrivateReport(result = readJson(resultPath), snapshot = readJson(snapshotPath)) {
  const products = new Map(snapshot.products.map((product) => [product.analysis_product_id, product]));
  const primaryRows = primaryCoverageRows(result);
  const diagnosticRows = result.coverage_analysis.results.filter((item) =>
    item.scenario_id === "a_type_excluding_accessories_scope_diagnostic"
      && item.scenario_eligibility === "eligible");
  const reversals = result.stability_summary.reduce((sum, item) => sum + item.total_reversals, 0);
  const ties = result.stability_summary.reduce((sum, item) => sum + item.total_tie_transitions, 0);
  const incomparables = result.stability_summary.reduce((sum, item) => sum + item.total_incomparable_transitions, 0);
  const lines = [];
  lines.push("# 非公開: proposed coverage契約・ランキング安全装置の再分析");
  lines.push("");
  lines.push("> **内部検証専用 / publication_status: draft**");
  lines.push("> coverage profile、閾値、required criterion、weight、境界はすべてproposed。実在商品の確定total score、順位、推奨、公開判断ではない。Supabase・管理画面・サイトUIへ接続していない。");
  lines.push("");
  lines.push("## 1. 結論");
  lines.push("");
  lines.push("criterion coverage、parent-axis coverage、weighted coverageを分離し、score計算、score表示可否、ranking可否を別gateにした。1 criterionだけで100点へ再正規化される値は`partial_observed_score`としてのみ保持し、`total_quality_score`は全商品・全scenarioで`null`、`total_quality_score_displayed`は`false`とした。coverage契約は順位を生成していない。");
  lines.push("");
  lines.push("参照profileのbalancedでは、scenario eligibleなP02〜P05もすべて`eligible_but_insufficient_evidence`。P01はeligibility根拠の矛盾を保持して`eligible_with_unresolved_conflict`。scenario不適合は`ineligible_for_scenario`で、0点や最下位にしていない。");
  lines.push("");
  lines.push("## 2. 固定入力と再現性");
  lines.push("");
  lines.push(`- snapshot: \`${result.snapshot_id}\``);
  lines.push(`- snapshot SHA-256: \`${result.snapshot_sha256}\``);
  lines.push(`- source origin/main commit: \`${snapshot.origin_main_commit}\``);
  lines.push(`- analysis config SHA-256: \`${result.config_sha256}\``);
  lines.push(`- coverage contract SHA-256: \`${result.coverage_contract.contract_sha256}\``);
  lines.push(`- proposed profiles SHA-256: \`${result.coverage_contract.profiles_sha256}\``);
  lines.push(`- machine-readable schema SHA-256: \`${result.coverage_contract.schema_sha256}\``);
  lines.push(`- snapshot verification: \`${result.snapshot_verification.result}\``);
  lines.push("");
  lines.push("同じsnapshot・config・calc versionから同じ`analysis-result.json`を生成する。source valuesは書き換えていない。");
  lines.push("");
  lines.push("## 3. Coverage契約");
  lines.push("");
  lines.push("- criterion: scoreable数 ÷ scenario適用criterion数。unknown/conflict/not-comparableは分母のみ、not-applicableは両方から除外。");
  lines.push("- parent axis: 親ごとに`scoreable / partially_scoreable / unassessed / not_applicable`を出す。ratioの分母は`max(適用criterion数, proposed最低評価幅2)`で、1 criterionだけの親軸を完成扱いしない。");
  lines.push("- weighted: scoreable weight ÷ 適用weight。weight自体がproposedなので、この値だけで可否を決めない。");
  lines.push("- represented parent count: 1 criterion以上scoreableな親軸数。parent-axis coverageと別にgateする。");
  lines.push("");
  lines.push("## 4. Proposed profiles");
  lines.push("");
  lines.push("| profile | criterion min | parent min | represented parents | weighted min | unresolved conflict | required criteria |");
  lines.push("|---|---:|---:|---:|---:|---|---|");
  for (const profile of result.proposed_settings.coverage_profiles) {
    lines.push(`| ${profile.profile_id} | ${profile.minimum_criterion_coverage} | ${profile.minimum_parent_axis_coverage} | ${profile.minimum_represented_parent_count} | ${profile.minimum_weighted_coverage} | ${profile.allow_unresolved_conflicts ? "non-requiredのみ許容候補" : "不許容"} | ${profile.required_criterion_ids.join(", ")} |`);
  }
  lines.push("");
  lines.push("profile名・値は比較用であり、公開確定値ではない。balancedは分析上の参照profileであって承認済みdefaultではない。");
  lines.push("");
  lines.push("## 5. 5商品のcoverage要約");
  lines.push("");
  lines.push("| ID | 商品 | scenario | criterion | parent axis | weighted | represented | conflicts | state (balanced) | partial observed | total displayed | ranking eligible |");
  lines.push("|---|---|---|---:|---:|---:|---:|---:|---|---:|---|---|");
  for (const item of primaryRows) {
    const product = products.get(item.product_analysis_id);
    lines.push(`| ${item.product_analysis_id} | ${product.official_name} | ${item.scenario_id} | ${metric(item.criterion_coverage?.value)} | ${metric(item.parent_axis_coverage?.value)} | ${metric(item.weighted_coverage?.value)} | ${metric(item.represented_parent_count)} | ${item.unresolved_conflict_count} | ${item.score_state} | ${metric(item.partial_observed_score)} | ${item.total_quality_score_displayed} | ${item.ranking_eligibility} |`);
  }
  lines.push("");
  lines.push("P02のpartial 100はunfolded width 1 criterionだけの再正規化値であり、total quality scoreではない。A形strictのP03/P04はmeasurement scope不一致によりbody weightを`not_comparable`として分子から除外した。P05はB形相当の比較相手がなく、全profileでranking生成不可。");
  lines.push("");
  lines.push("## 6. Profile間の差");
  lines.push("");
  lines.push("A形の付属品除外scope診断では次の差が出た。ただしprofileはproposedであり、順位は生成していない。");
  lines.push("");
  lines.push("| ID | criterion | parent | weighted | represented | profile decisions | total score |");
  lines.push("|---|---:|---:|---:|---:|---|---|");
  for (const item of diagnosticRows) {
    lines.push(`| ${item.product_analysis_id} | ${item.criterion_coverage.value} | ${item.parent_axis_coverage.value} | ${item.weighted_coverage.value} | ${item.represented_parent_count} | ${item.profile_assessments.map(profileDecision).join("; ")} | null |`);
  }
  lines.push("");
  lines.push("lenientだけはP03/P04の表示・ranking eligibility gateを通すが、`ranking_generated: false`を維持する。balancedはcriterion coverage 0.25未満、strictはさらに高いcoverageとrequired criteria不足で保留。profile変更でpartial scoreや3種類のcoverageは変化しない。");
  lines.push("");
  lines.push("## 7. Baselineからの状態変化");
  lines.push("");
  lines.push("従来baselineで`trial_scored`だったP02/P03/P04とP05は、balanced契約では`eligible_but_insufficient_evidence`へ変わった。これは低品質化ではなく、公開total scoreとrankingの保留である。P01のeligibility unknownはage evidence conflictを数値化せず保持した。scenario外商品は`ineligible_for_scenario`でcoverageを`null`にした。");
  lines.push("");
  lines.push("## 8. 既存感度分析の再確認");
  lines.push("");
  lines.push(`同一snapshotで171パターンを再生成。比較可能状態の厳密なpairwise逆転は${reversals}件、同点遷移は${ties}件、比較不能遷移は${incomparables}件。boundary ±5%の最大partial score変動は${maxAbsoluteDelta(result, "boundary")}点、入力±1%は${maxAbsoluteDelta(result, "input_nudge")}点、parent weight変動は${maxAbsoluteDelta(result, "weight")}点だった。weightや境界値の最適化はしていない。`);
  lines.push("");
  lines.push("coverage threshold 0.25以上の既存patternでは全eligible商品がon hold。coverage契約追加後もこの状態はlow qualityではなくinsufficient evidenceとして解釈する。");
  lines.push("");
  lines.push("## 9. 比較不能・保留理由");
  lines.push("");
  lines.push("- mixed A形scenario: manufacturer unspecifiedとexcluding accessoriesが混在するためbody weight criterionを`not_comparable`。");
  lines.push("- P01: target ageの公式根拠がconflictingでscenario eligibilityを確定できない。");
  lines.push("- 全商品: folded standing orientation未確認でfloor footprintをscoreableにできない。");
  lines.push("- folding/carry: one-hand unfold、fold step、two-hand/bending/seat attachment/lock、carry handle/strap/levelの正規化bridge不足。");
  lines.push("- P05: B形相当候補が1商品だけでpairwise rankingを生成できない。");
  lines.push("");
  lines.push("## 10. 未解決rubric問題");
  lines.push("");
  lines.push("1. 4親軸の正式weight・親内配点・coverage閾値・required criterionは未確定。");
  lines.push("2. transport_burdenは現14 criterion定義では直接score criterionがbody weight 1件だけで、親軸最低評価幅2を満たせない。追加criterionか、親軸定義の見直しが必要。");
  lines.push("3. band境界は入力±1%でも最大16.666666点変化し、正式採用前に連続式または境界保留設計が必要。");
  lines.push("4. confirmed raw factから作るband/alias inferenceの正式なcalculation-state bridgeが未定義。");
  lines.push("5. lenient/balanced/strictのどれを採用するかは未決定。今回の結果へ合わせて調整してはならない。");
  lines.push("");
  lines.push("## 11. 未解決データ問題と次に必要な補完");
  lines.push("");
  lines.push("1. P01 target age conflictを公式仕様・manualで解消する。");
  lines.push("2. body weightを共通measurement scope・共通付属品条件で取得する。揃わない値は比較説明専用にする。");
  lines.push("3. folded standing orientationを確認し、同じstanding-base定義でfootprintを導出する。");
  lines.push("4. fold/unfold手順、step count、両手・屈曲・seat attachment・lockを公式資料から正規化する。");
  lines.push("5. carry handle/strap/positionを商品専用例外なしのnormalizer ruleで補う。");
  lines.push("6. B形相当benchmarkを同一scenario・同等scopeで最低1商品追加する。");
  lines.push("7. maneuverabilityは承認済み標準化第三者実測protocolができるまで補完対象scoreにしない。");
  lines.push("");
  lines.push("## 12. DB設計への契約引き継ぎ");
  lines.push("");
  lines.push("将来DBはcriterion observation（applicability/evidence/comparability/reason）、3種類のcoverage、parent axis別状態、profile versionとgate結果、partial observed score、public total score、score display eligibility、ranking eligibilityを分離して保持する。unknown/conflict/ineligible/not-comparableを0やfalseで代用せず、profileの`value_status`とversion/hashを結果へ固定する。`coverage-contract.schema.json`はmigration前の参照契約であり、今回はDB変更を作成していない。");
  lines.push("");
  lines.push("## 13. 再現コマンド");
  lines.push("");
  lines.push("```powershell");
  lines.push("node agent-skills/irodori/irodori-ranking-engine/private-analysis/2026-07-17-stroller-official-5-sensitivity/build-input-snapshot.mjs");
  lines.push("node --no-warnings --experimental-strip-types agent-skills/irodori/irodori-ranking-engine/private-analysis/2026-07-17-stroller-official-5-sensitivity/run-sensitivity-analysis.mjs");
  lines.push("node agent-skills/irodori/irodori-ranking-engine/private-analysis/2026-07-17-stroller-official-5-sensitivity/build-private-report.mjs");
  lines.push("node --no-warnings --experimental-strip-types agent-skills/irodori/irodori-ranking-engine/scripts/validate-coverage-contract.mjs");
  lines.push("```");
  return `${lines.join("\n")}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(outputPath, renderPrivateReport(), "utf8");
  console.log(`wrote ${outputPath}`);
}
