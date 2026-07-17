# proposed coverage契約

この契約はランキング公開条件の分析案であり、閾値・配点・境界・required criterionはすべて
`proposed`である。実在商品の確定score、順位、推奨を作らず、DB・管理画面・サイトUIへ接続しない。

## 1. 3種類のcoverage

### Criterion coverage

`scoreableなcriterion数 ÷ scenarioで適用対象のcriterion数`とする。

- `scoreable`: 分母・分子に入れる。
- `unknown`: 適用対象なので分母だけに入れる。0点・falseへ変換しない。
- `unresolved_conflict`: 分母だけに入れ、矛盾件数と双方の根拠を保持する。
- `not_comparable`: 分母だけに入れ、scope・単位・測定条件等の理由を保持する。
- `not_applicable`: scenarioの適用除外なので分母・分子の両方から除外する。missingにしない。
- `analysis_error`: 数値を0にせず、coverageを`null`にして処理異常として分離する。

### Parent-axis coverage

親軸ごとに次を計算する。

`parent coverage ratio = scoreable criterion数 ÷ max(適用criterion数, 親軸の最低評価幅)`

状態は`scoreable / partially_scoreable / unassessed / not_applicable`。全適用criterionがscoreableでも、
最低評価幅に満たない親軸は`partially_scoreable`のままとする。現profileの最低評価幅は各親軸2件の
proposed値であり、親軸内に1criterionしか定義されていないことを「軸全体の評価完了」と誤認しない。

商品全体の`parent_axis_coverage`は、適用親軸のratioの算術平均。1件以上scoreableな親軸数を
`represented_parent_count`、`scoreable`状態の親軸数を`fully_scoreable_parent_count`として別に出す。

### Weighted coverage

`scoreable criterionのweight合計 ÷ 適用criterionのweight合計`とする。weightは引き続き
`proposed`で、weighted coverageだけを採点可否の唯一条件にしない。profile判定ではcriterion、
parent、represented parent、weighted、required criterion、conflictを独立gateとして確認する。

## 2. score state

次の状態を保持し、0点や最下位へ変換しない。

- `scoreable`: 選択profileの全gateを満たす。
- `eligible_but_insufficient_evidence`: scenario候補だがcoverage、required criterion、またはeligibility証拠が不足。
- `eligible_with_unresolved_conflict`: 適用候補だが未解決矛盾がある。profileが非required矛盾を許容しても状態自体は保持する。
- `ineligible_for_scenario`: scenarioまたはsegmentに不適合。scoreは`null`。
- `not_comparable`: 適用対象だがscope・単位・測定条件が比較不能で、scoreable criterionがない。
- `analysis_error`: 契約違反・重複ID・非有限weight等の処理異常。品質評価へ変換しない。

優先順位は`analysis_error → ineligible → conflict → not_comparable → insufficient → scoreable`。

## 3. scoreと公開gateの分離

- `partial_observed_score`: scoreableな観測範囲だけを再正規化した内部分析値。total scoreではない。
- `total_quality_score`: 確定coverage profileと正式rubricがない間は生成せず`null`。
- `score_display_eligibility`: proposed profileを仮適用した表示gateの結果。公開許可ではない。
- `ranking_candidate_eligibility`: 個別商品のranking参加gate。
- `ranking_eligibility`: 同一scenario・同一segment内の最低候補数も満たす最終gate。
- `ranking_generation_eligible`: scenario単位のgate。非公開分析ではtrueでも順位を生成しない。

profile変更はcoverage、criterion score、`partial_observed_score`を書き換えず、表示・ranking可否だけを
変更する。1criterionのpartial scoreは保持できるが、全profileで公開total scoreにはならない。

## 4. scenario・比較安全装置

- A形相当・B形相当segmentを同じranking cohortへ混在させない。
- scenario不適合を0点・false・最下位へ変換しない。
- basket kgとLを換算せず、coverage criterionへ含めない。
- measurement scope不一致はcriterionを`not_comparable`にし、scoreableへ昇格しない。
- maneuverability、外部媒体順位、楽天順位、口コミ件数、人気、affiliateその他商業条件を
  criterion coverage、weighted coverage、品質scoreへ含めない。
- B形相当のように候補が1商品だけならranking生成不可。coverageとpartial scoreの内部診断だけを許す。

## 5. proposed profiles

`config/coverage-profiles.proposed.json`の`lenient / balanced / strict`を比較する。profile名・閾値・
required criterion・conflict許容は分析案であり、公開確定値ではない。`balanced`は比較用の参照profileで
あって承認済みdefaultではない。

## 6. 将来DBへの引き継ぎ

`contracts/coverage-contract.schema.json`を将来のmigration設計用の機械可読契約とする。
現段階ではmigrationを作らず、Supabaseへ書き込まない。将来もcriterion observation、coverage metrics、
profile decision、公開workflow statusを別レコードまたは別column群として保持し、partial scoreを
public total score columnへ流用しない。
