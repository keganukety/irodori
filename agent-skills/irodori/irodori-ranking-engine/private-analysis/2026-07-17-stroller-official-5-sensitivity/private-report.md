# 非公開: 実在5商品ランキング感度分析

> **内部検証専用 / publication_status: draft**
> 本文と機械可読結果は、実在商品の確定score、公開順位、おすすめ、販売判断ではない。配点・境界・coverage条件はすべて`proposed`の分析仮定であり、正本商品データへ書き戻していない。

## 1. 分析目的

現行の4親軸proposalと決定論的ranking engineへ実在5商品の公式ベンチマークを接続したとき、weight、境界、coverage、欠損、criterion除外が非公開試算へ与える影響を確認した。目的は勝者を決めることではなく、公開設計へ進む前の不安定要因とデータ不足を特定することである。

## 2. 使用した入力スナップショット

正本は`input-snapshot.json`。`origin/main`の`6d8c2e86e1a2b45aabcfa67ba03d599789be0a45`にある5 run、benchmark matrix、rubric proposal、eligibility、normalization rulesのSHA-256を固定した。`build-input-snapshot.mjs`で再生成し、全fingerprint一致をテストする。

| 分析ID | 対象商品 | 分離segment | 重要な入力状態 |
|---|---|---|---|
| P01 | CYBEX Melio Carbon 2026 | A形相当・1か月開始 | `target_age`がconflictingのためeligibility unknown |
| P02 | アップリカ カルーンエアー メッシュ AC | A形相当・1か月開始 | 重量scopeはmanufacturer unspecified、fold操作情報が不足 |
| P03 | コンビ スゴカル エッグショック LA | A形相当・1か月開始 | 重量は付属品除外scope、自立のみ確認 |
| P04 | ピジョン Runfee RB5 | A形相当・1か月開始 | 重量は付属品除外scope、片手foldのみ確認 |
| P05 | CYBEX Libelle 2026 | B形相当・compact | 比較相手が1商品だけ、fold操作情報が不足 |

source→evidence claim→normalized featureのIDを各raw factへ保持した。折りたたみ設置面の向きが確認できないため`folded_floor_footprint_cm2`は全商品nullのままとした。basketはkgとLを別fieldに固定し、換算していない。

## 3. 対象scenario

- `a_type_primary_strict_scope`: `primary_from_1_month`をgateにし、A形相当segmentだけを対象とする。異なる重量scopeが混在するためbody weightは全候補で非採点。
- `a_type_excluding_accessories_scope_diagnostic`: A形相当のうち`excluding_accessories`だけを分離した重量criterion診断。scopeは同名でも除外付属品が商品ごとに異なるためpartial比較であり、確定比較ではない。
- `b_type_compact_strict_scope`: `compact_travel_from_7_months`をgateにし、B形相当segmentだけを対象とする。A形相当商品は`not_applicable`。

P01のrequired age factはconflictingなので`on_hold`、0点や最下位にはしていない。A形相当とB形相当は同じtrial listへ混在させていない。

## 4. Baseline条件

現行proposalは`allocation_status: not_defined`であり、4親軸weight、親内配点、coverage閾値、合成式が存在しない。そのため正本を変更せず、次の分析専用overlayを置いた。

- 4親軸を各0.25、親内のcriterionを等分。全値は`proposed_analysis_only`。
- baseline coverage閾値は未採用状態を表す0。
- confirmed raw factから作るband/aliasは`irodori_inference`としてrawと分離。契約上、推論をconfirmedへ昇格しない。
- unknown/conflicting/scope不適合はderived featureを作らず、score計算から除外。
- `observed_score`、criterion/parent/weighted coverage、confidenceは分離。confidenceはscoreへ非寄与。
- `train_fitness`と`one_operator_fitness`はeditorial compositeのまま独立加点しない。

このbaselineは低coverage時の挙動を見るためのtrialであり、有効な順位表ではない。

## 5. 試した感度パターン

各scenarioで57パターン、合計171パターンを同一snapshotから決定論的に実行した。

- parent weight: 各親軸を個別に相対±5%、±10%。合計weightは1へ再正規化。
- boundary: body weight、unfolded width、folded footprint、fold stepのproposed gridを個別に±5%。
- coverage: criterion coverageとweighted coverageを同時に0.25 / 0.50 / 0.75 / 1.00へ設定。
- criterion除外: 4親軸を1つずつ除外。
- 関連群除外: transport+carry、station+folding。
- 欠損: 14 criterionを1つずつunknown相当として除外。0やfalseには変換しない。
- 小入力変化: 数値raw factを元データ非書換えのまま試算時だけ±1%。

## 6. 順位安定性

weight ±5/10%、boundary ±5%、数値入力±1%の範囲では、両商品が採点可能な状態を保ったペアに**厳密な順序逆転は0件**だった。ただし、これは現在の設計が十分安定という意味ではない。

- A形strictのP03/P04は、比較可能な51パターン中49パターンでbaseline関係を維持し、2パターンで同点へ移行した。
- A形strictでは19件、重量scope cohortでは4件、baselineペアがcoverage不足またはcriterion不足で比較不能へ移行した。
- B形相当は1商品だけなので、pairwise順位安定性は`not_applicable`。
- weight感度の最大score変化は1.30点で順位関係は不変。ただし重量scopeを安全に使える比較群がP03/P04だけで、検証力は弱い。

したがって「weightに対する局所順位は安定」だが、「coverageとcriterion存在性に対する比較成立性は不安定」が適切な結論である。

## 7. 商品ペアの順位逆転

厳密なpairwise逆転は0件。同点遷移は2件で、どちらもA形strictのP03/P04に発生した。

1. `exclude_parent.station_space_fit`
2. `missing.station_space_fit.unfolded_width`

いずれもstation widthの差が消え、残るfolding factが各1件ずつ同点扱いになった。結果を自然に見せるためのweight/threshold調整は行っていない。

## 8. Criterion別寄与

baselineのcriterion coverageは0.07〜0.21、parent coverageは0.25〜0.75だった。欠損軸を除外して観測済み軸だけで再正規化するため、寄与が次のように集中した。

- A形strictのP02はscore可能criterionがunfolded width 1件だけで、寄与率100%。
- A形strictのP03/P04はunfolded widthの正規化weightが各80%。
- 重量scope cohortのP03/P04はbody weightの正規化weightが各約62%。
- B形相当P05はbody weightの正規化weightが約67%。

特定criterionが総合結果を支配している。これはweight設定の問題というより、親内欠損が多い状態でobserved範囲へ再正規化することによる。現coverageでtotal scoreを公開解釈してはならない。

## 9. Coverage・欠損の影響

0.25以上のcoverage trialでは、全scenarioで全eligible商品が`on_hold`となりtrial entryは0件だった。criterion count coverageが最大でも0.21であるためで、低品質判定ではない。

閾値なしbaselineでは逆に、1〜3 criterionだけでも100点満点へ再正規化される。このため情報不足の商品が不当に低くなるのではなく、少数の確認済みcriterionだけで高く見えるリスクが確認された。coverageが順位差に直接加点された事実はないが、閾値を採用すると比較成立/保留を全面的に決める。

主な欠損はfolded standing orientation、one-hand unfold、fold step、two-hand/bending/seat attachment/lock、carry handle/strap/positionの正規化bridgeである。Aprica/Pigeonの取説同意gateは突破せず、欠損のまま保持した。

## 10. 境界値の影響

順位逆転はなかったが、bandの不連続は大きい。

- unfolded width境界を±5%すると、個別trial scoreは最大25点変化。
- body weight境界を±5%すると、個別trial scoreは最大16.67点変化。
- body weightが境界上のP05では、入力を+1%しただけでtrial scoreが16.67点低下。
- 5商品の多くがbody weightまたはunfolded widthの候補境界±5%内にある。

±5%は測定誤差やメーカー公差を意味しない。現在の段階bandは、順位が同じでもscore差を過度に不連続に見せるため、公開点数へ使う前に連続式、隣接band併記、または境界保留表示を比較検討すべきである。

## 11. 二重加点・eligibility・scope

- 現行`detectDoubleCounting`はpass。分析configも1 raw fact→1 positive contribution groupで一意。
- folded width/depthはfootprintの導出候補としてだけ保持し、個別点とfootprint点を重ねていない。orientation不足のため今回はfootprint自体を採点していない。
- body weightはtransportだけ、folding factsはfoldingだけに寄与。editorial compositesは独立加点しない。
- compact scenarioではbody weightとfolded 3辺の**存在**がeligibility required inputだが、eligibilityは値の良し悪しを加点しない。eligible後のbody weight criterionとは役割が分離されている。
- mixed A形scenarioではmanufacturer unspecifiedとexcluding accessoriesを混ぜず、weightを全候補で非採点。scope cohortもpartial診断と明記した。
- basket kg/L、maneuverability、外部順位、楽天人気、review数、affiliate条件はscore graphに存在しない。

二重加点の実装上のFAILは見つからなかった。最大のscope問題は、比較可能な重量群が少なく、現データだけではtransport weightの一般的な安定性を検証できないことである。

## 12. Rubric由来の問題

1. 4親軸の配点・親内配点・coverage閾値・合成式が未定義で、実在入力だけから一意なbaselineを作れない。
2. 段階bandは小さな境界変更や1%入力変化で16.67〜25点の不連続を生む。
3. coverageの分母を親軸、subaxis、raw factのどれにするか未定義。今回の14 criterion分母は分析仮定。
4. 欠損除外後の再正規化に最低親軸coverage条件がないため、1 criterionだけのtotal scoreが成立する。
5. confirmed raw factからの決定論bandは`inference`だが、現契約ではinferenceをconfirmedにできない。raw evidence statusとcalculation statusを分ける正式bridge契約が必要。
6. B形相当が1商品だけで、scenario内pairwise安定性を検証できない。

## 13. 商品データ・evidence由来の問題

1. P01はtarget ageの公式表現がconflictingで、A形scenario eligibilityがunknown。
2. weight measurement scopeが2群に分かれ、さらに付属品除外群も除外対象が同一とは限らない。
3. folded dimensionsのstanding orientationが未確認で、floor footprintを安全に導出できない。
4. folding/carry subaxisのnormalized featureが不足。axis null claimが一部あっても、商品専用の手作業mappingは追加していない。
5. Aprica/Pigeonのmanual gate由来欠損は人間が適法に資料を取得・提供するまで未確認。
6. maneuverabilityを採点できる標準化第三者実測は存在しない。

## 14. Evidence不足による未確定事項と次フェーズへの推奨

未確定:

- 現行4親軸の正式weight、親内配点、coverage分母・閾値。
- scope別body weightをどこまでpartial比較へ許容するか。
- folded standing orientationとfold step/carry facts。
- B形相当scenarioの比較母集団。
- band不連続を許容するか、連続scoreへ変えるか。

推奨順:

1. 公開順位ではなく、まずcoverage契約を「criterion count」「parent coverage」「weighted coverage」の3つに分け、最低parent coverageをproposedで設計する。
2. 人間提供manualまたは公式テキストでfold/carryのraw factsを補い、商品専用例外なしのnormalizer bridgeを追加する。
3. weight scopeを共通測定条件または同scope cohortへ揃える。揃わない場合はtransportを説明専用にする。
4. boundary周辺の連続式/隣接band保留を架空fixtureで先に比較し、5商品結果に合わせて閾値を調整しない。
5. B形相当の公式benchmarkを複数追加してからpairwise感度を再実行する。
6. 配点案を人間がproposedとして明示した後、このsnapshotとscriptで再実行する。公開判断・Supabase・UI接続は別フェーズとする。

## 再現コマンド

```powershell
node agent-skills/irodori/irodori-ranking-engine/private-analysis/2026-07-17-stroller-official-5-sensitivity/build-input-snapshot.mjs
node --no-warnings --experimental-strip-types agent-skills/irodori/irodori-ranking-engine/private-analysis/2026-07-17-stroller-official-5-sensitivity/run-sensitivity-analysis.mjs
node --no-warnings --experimental-strip-types --test --test-isolation=none agent-skills/irodori/irodori-ranking-engine/private-analysis/2026-07-17-stroller-official-5-sensitivity/tests/sensitivity-analysis.test.mjs
```
