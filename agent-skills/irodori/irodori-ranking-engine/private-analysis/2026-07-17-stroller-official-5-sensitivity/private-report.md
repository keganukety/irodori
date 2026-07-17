# 非公開: proposed coverage契約・ランキング安全装置の再分析

> **内部検証専用 / publication_status: draft**
> coverage profile、閾値、required criterion、weight、境界はすべてproposed。実在商品の確定total score、順位、推奨、公開判断ではない。Supabase・管理画面・サイトUIへ接続していない。

## 1. 結論

criterion coverage、parent-axis coverage、weighted coverageを分離し、score計算、score表示可否、ranking可否を別gateにした。1 criterionだけで100点へ再正規化される値は`partial_observed_score`としてのみ保持し、`total_quality_score`は全商品・全scenarioで`null`、`total_quality_score_displayed`は`false`とした。coverage契約は順位を生成していない。

参照profileのbalancedでは、scenario eligibleなP02〜P05もすべて`eligible_but_insufficient_evidence`。P01はeligibility根拠の矛盾を保持して`eligible_with_unresolved_conflict`。scenario不適合は`ineligible_for_scenario`で、0点や最下位にしていない。

## 2. 固定入力と再現性

- snapshot: `snapshot-stroller-official-5-private-sensitivity-2026-07-17`
- snapshot SHA-256: `dc825f9d70b2236851f34bf41f09869ad51acf78dd1ac48f3bed4c89c001f493`
- source origin/main commit: `6d8c2e86e1a2b45aabcfa67ba03d599789be0a45`
- analysis config SHA-256: `2c94525cfec02291247ed28f2117a04795a8dea431d02a64a3a0b760e2ef4c06`
- coverage contract SHA-256: `2b0bc1b48179f9cc2d273862bff0ea3cf84a80336d449d1c579bdfe56a006300`
- proposed profiles SHA-256: `d7457086f5b6ed0241223fc2b78a8d17a30fbacae6bfbcd09c11d3a06342619c`
- machine-readable schema SHA-256: `7ae5e8a90026cc1f469636c6ee53c09f4b2bd887b6ee32b83d324e0147d6a944`
- snapshot verification: `pass`

同じsnapshot・config・calc versionから同じ`analysis-result.json`を生成する。source valuesは書き換えていない。

## 3. Coverage契約

- criterion: scoreable数 ÷ scenario適用criterion数。unknown/conflict/not-comparableは分母のみ、not-applicableは両方から除外。
- parent axis: 親ごとに`scoreable / partially_scoreable / unassessed / not_applicable`を出す。ratioの分母は`max(適用criterion数, proposed最低評価幅2)`で、1 criterionだけの親軸を完成扱いしない。
- weighted: scoreable weight ÷ 適用weight。weight自体がproposedなので、この値だけで可否を決めない。
- represented parent count: 1 criterion以上scoreableな親軸数。parent-axis coverageと別にgateする。

## 4. Proposed profiles

| profile | criterion min | parent min | represented parents | weighted min | unresolved conflict | required criteria |
|---|---:|---:|---:|---:|---|---|
| lenient | 0.2 | 0.25 | 3 | 0.25 | non-requiredのみ許容候補 | station_space_fit.unfolded_width |
| balanced | 0.25 | 0.25 | 3 | 0.35 | 不許容 | transport_burden.body_weight, station_space_fit.unfolded_width |
| strict | 0.5 | 0.5 | 4 | 0.5 | 不許容 | transport_burden.body_weight, station_space_fit.unfolded_width, station_space_fit.folded_floor_footprint, folding_independence.one_hand_fold, folding_independence.one_hand_unfold |

profile名・値は比較用であり、公開確定値ではない。balancedは分析上の参照profileであって承認済みdefaultではない。

## 5. 5商品のcoverage要約

| ID | 商品 | scenario | criterion | parent axis | weighted | represented | conflicts | state (balanced) | partial observed | total displayed | ranking eligible |
|---|---|---|---:|---:|---:|---:|---:|---|---:|---|---|
| P01 | Melio Carbon | a_type_primary_strict_scope | null | null | null | null | 2 | eligible_with_unresolved_conflict | null | false | false |
| P02 | カルーンエアー メッシュ AC | a_type_primary_strict_scope | 0.071429 | 0.125 | 0.125 | 1 | 0 | eligible_but_insufficient_evidence | 100 | false | false |
| P03 | スゴカル エッグショック LA | a_type_primary_strict_scope | 0.142857 | 0.15625 | 0.15625 | 2 | 0 | eligible_but_insufficient_evidence | 60 | false | false |
| P04 | Runfee RB5（ランフィ RB5） | a_type_primary_strict_scope | 0.142857 | 0.15625 | 0.15625 | 2 | 0 | eligible_but_insufficient_evidence | 40 | false | false |
| P05 | Libelle | b_type_compact_strict_scope | 0.142857 | 0.25 | 0.375 | 2 | 0 | eligible_but_insufficient_evidence | 41.666666 | false | false |

P02のpartial 100はunfolded width 1 criterionだけの再正規化値であり、total quality scoreではない。A形strictのP03/P04はmeasurement scope不一致によりbody weightを`not_comparable`として分子から除外した。P05はB形相当の比較相手がなく、全profileでranking生成不可。

## 6. Profile間の差

A形の付属品除外scope診断では次の差が出た。ただしprofileはproposedであり、順位は生成していない。

| ID | criterion | parent | weighted | represented | profile decisions | total score |
|---|---:|---:|---:|---:|---|---|
| P03 | 0.214286 | 0.28125 | 0.40625 | 3 | balanced: display=false, ranking=false; lenient: display=true, ranking=true; strict: display=false, ranking=false | null |
| P04 | 0.214286 | 0.28125 | 0.40625 | 3 | balanced: display=false, ranking=false; lenient: display=true, ranking=true; strict: display=false, ranking=false | null |

lenientだけはP03/P04の表示・ranking eligibility gateを通すが、`ranking_generated: false`を維持する。balancedはcriterion coverage 0.25未満、strictはさらに高いcoverageとrequired criteria不足で保留。profile変更でpartial scoreや3種類のcoverageは変化しない。

## 7. Baselineからの状態変化

従来baselineで`trial_scored`だったP02/P03/P04とP05は、balanced契約では`eligible_but_insufficient_evidence`へ変わった。これは低品質化ではなく、公開total scoreとrankingの保留である。P01のeligibility unknownはage evidence conflictを数値化せず保持した。scenario外商品は`ineligible_for_scenario`でcoverageを`null`にした。

## 8. 既存感度分析の再確認

同一snapshotで171パターンを再生成。比較可能状態の厳密なpairwise逆転は0件、同点遷移は2件、比較不能遷移は23件。boundary ±5%の最大partial score変動は25点、入力±1%は16.666666点、parent weight変動は1.304347点だった。weightや境界値の最適化はしていない。

coverage threshold 0.25以上の既存patternでは全eligible商品がon hold。coverage契約追加後もこの状態はlow qualityではなくinsufficient evidenceとして解釈する。

## 9. 比較不能・保留理由

- mixed A形scenario: manufacturer unspecifiedとexcluding accessoriesが混在するためbody weight criterionを`not_comparable`。
- P01: target ageの公式根拠がconflictingでscenario eligibilityを確定できない。
- 全商品: folded standing orientation未確認でfloor footprintをscoreableにできない。
- folding/carry: one-hand unfold、fold step、two-hand/bending/seat attachment/lock、carry handle/strap/levelの正規化bridge不足。
- P05: B形相当候補が1商品だけでpairwise rankingを生成できない。

## 10. 未解決rubric問題

1. 4親軸の正式weight・親内配点・coverage閾値・required criterionは未確定。
2. transport_burdenは現14 criterion定義では直接score criterionがbody weight 1件だけで、親軸最低評価幅2を満たせない。追加criterionか、親軸定義の見直しが必要。
3. band境界は入力±1%でも最大16.666666点変化し、正式採用前に連続式または境界保留設計が必要。
4. confirmed raw factから作るband/alias inferenceの正式なcalculation-state bridgeが未定義。
5. lenient/balanced/strictのどれを採用するかは未決定。今回の結果へ合わせて調整してはならない。

## 11. 未解決データ問題と次に必要な補完

1. P01 target age conflictを公式仕様・manualで解消する。
2. body weightを共通measurement scope・共通付属品条件で取得する。揃わない値は比較説明専用にする。
3. folded standing orientationを確認し、同じstanding-base定義でfootprintを導出する。
4. fold/unfold手順、step count、両手・屈曲・seat attachment・lockを公式資料から正規化する。
5. carry handle/strap/positionを商品専用例外なしのnormalizer ruleで補う。
6. B形相当benchmarkを同一scenario・同等scopeで最低1商品追加する。
7. maneuverabilityは承認済み標準化第三者実測protocolができるまで補完対象scoreにしない。

## 12. DB設計への契約引き継ぎ

将来DBはcriterion observation（applicability/evidence/comparability/reason）、3種類のcoverage、parent axis別状態、profile versionとgate結果、partial observed score、public total score、score display eligibility、ranking eligibilityを分離して保持する。unknown/conflict/ineligible/not-comparableを0やfalseで代用せず、profileの`value_status`とversion/hashを結果へ固定する。`coverage-contract.schema.json`はmigration前の参照契約であり、今回はDB変更を作成していない。

## 13. 再現コマンド

```powershell
node agent-skills/irodori/irodori-ranking-engine/private-analysis/2026-07-17-stroller-official-5-sensitivity/build-input-snapshot.mjs
node --no-warnings --experimental-strip-types agent-skills/irodori/irodori-ranking-engine/private-analysis/2026-07-17-stroller-official-5-sensitivity/run-sensitivity-analysis.mjs
node agent-skills/irodori/irodori-ranking-engine/private-analysis/2026-07-17-stroller-official-5-sensitivity/build-private-report.mjs
node --no-warnings --experimental-strip-types agent-skills/irodori/irodori-ranking-engine/scripts/validate-coverage-contract.mjs
```
