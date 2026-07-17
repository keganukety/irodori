# Decision log

## Proposed operational decisions — provisional approved

1. 実在5商品は比較可能性、eligibility候補、measurement scopeまでとし、score・順位・星・勝者・おすすめ認定・感度分析結果を作らない。
2. 4scenarioは`primary_from_1_month`、`primary_from_6_months`、`second_stroller_from_7_months`、`compact_travel_from_7_months`を維持する。newborn useとseat方向は参加必須条件にしない。
3. 上限参加条件は36か月以上または15kg以上。月齢不適合は`ineligible`、情報不足は`unknown` / `on_hold`とし、0点・最下位にしない。
4. `portability`は`transport_burden` / `carry_assistance`へ分割して独立入力を廃止する。
5. `train_fitness`と`one_operator_fitness`は`editorial_composite_output`とし、raw inputにしない。後者へbody weightを再加点しない。
6. `maneuverability`は第三者標準化実測まで`unscored`。機構factとmanufacturer claimを分離する。
7. 初期親軸を`transport_burden`、`station_space_fit`、`folding_independence`、`carry_assistance`に限定する。配点は未定義。
8. basket kg/L、maneuverability、suspension、タイヤ、review sentiment、外部順位、楽天順位、manufacturer claimを初期scoreから除外する。
9. 境界候補をweight 4/5/6/7kg、width 460/480/500/530mm、footprint 800/1200/1600/2200cm²、fold step 1/2/3/4以上とする。すべてproposedかつ非恒久。
10. 約表記は元値を維持し、次工程の境界保留幅として暫定±5%を使う。誤差・公差とは呼ばない。
11. fold stepは公式手順上の機構状態変更操作だけを数える`proposed_definition`とする。不明はnull/unconfirmed。
12. 重量scopeはsame known/same stated conditionをfull、unspecified同士・一部不明・approximateをpartial、込み対除外・最軽量対標準をnot_comparable、判別不能をunknownとする。
13. optional欠損は0/falseにせずcoverageを下げる。全subaxis欠損の親軸はunavailable。required欠損はon_hold。coverage閾値は未採用。
14. RB5 / LA / ACは公式商品名由来の`generation_code`であり、`model_year` / `model_number`へ昇格しない。
15. アップリカ・ピジョン取説の同意gateはAIが越えず、Known limitationとして保持する。
16. maneuverability将来試験候補を180度旋回、スラローム、段差、直進偏位、荷重・路面・タイヤ・操作者/手順統一として記録する。

すべて`status: proposed`または`human_approval_status: provisional_approved`であり、最終ランキング確定値ではない。

## Rejected

- 5商品の分布だけから恒久境界を決める。
- score配点をこの工程で確定する。
- 欠損やscenario不適合を0点・false・最下位へ変換する。
- folded bounding-box volumeを実占有体積と呼ぶ。
- kgとLを相互換算する。
- タイヤ、サスペンション、メーカー訴求から小回り・段差・直進性を断定する。
- 規約同意gateを自動操作する。

## Remaining undecided

- 4親軸の配点・合成式。
- proposed boundary gridを使った実在5商品の感度分析結果。
- coverage閾値とpartial比較を最終ランキングへ含める承認条件。
- maneuverability第三者試験の具体的な幅、間隔、高さ、距離、荷重、反復回数。
- アップリカ・ピジョン取説の人間取得と提供。
- ローカルproductsとの差異の修正。
