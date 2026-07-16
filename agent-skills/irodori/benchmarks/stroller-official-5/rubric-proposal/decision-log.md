# Decision log

## 採用した判断

1. 実在5商品は監査・軸分類・比較可能性・eligibility候補までとし、pointsと順位を作らない。
2. 年齢scenario gateを配点より先に評価する。ineligibleは0点・最下位ではなく対象外、unknownはon_hold。
3. A形/B形ラベルを直接配点せず、1 / 6 / 7か月開始のscenarioで参加集合を分ける。
4. raw / derived / editorialの三層を分離し、Layer 3は固定ルーブリックと人間承認を要求する。
5. kgとLを相互変換せず、basketを6フィールドへ分解し、単一score軸を不採用とする。
6. 重量scope同一だけをfull、異なる既知scopeをpartial、unspecified/unknownをunknownとする。
7. `folding_ease`を廃止候補とし、片手fold/unfold、手数、両手、屈曲、seat脱着、自立、向き、carry補助、lockへ分解する。
8. 記載なしのbooleanをfalseにしない。
9. bounding-box volumeを実占有体積と呼ばない。
10. `portability`と`one_operator_fitness`をsubaxisへ分解し、`train_fitness`をeditorial限定とする。
11. maneuverabilityは公式機構とmanufacturer claimを保存するが、第三者標準化実測なしでは得点化しない。
12. raw factの正の寄与先を1つに固定し、説明への再掲は0寄与とする。
13. `generation_code`を後方互換な任意identityフィールドとして追加し、`model_year` / `model_number`へ自動昇格しない。
14. 取説同意操作をAIが行わず、同意・人間取得待ち状態を保持する。

## 不採用

- 既存10軸fixtureの主観値を実在5商品へ適用すること。
- 5商品の最小・最大値から永久的な境界を作ること。
- 欠損を0点にすること。
- eligibility不適合を最下位へ置くこと。
- manufacturer claim、タイヤ形式、サスペンションだけで実走性能を断定すること。
- kgとLの密度仮定。
- local商品ID、Supabase、価格、重量のDB修正。

## 保留中の人間判断

- 4 scenarioの上限月齢とnewborn定義。
- body weight、width、footprint、fold actionsの候補境界と感度幅。
- 100点枠のcomponent配点。
- optional欠損時に部分pointsを表示可能とするか、全体をon_holdにするか。
- 「約」表記が境界に接するときの保留幅。
- fold step countの標準化手順。
- 許容する重量measurement scopeと標準付属品の定義。
- maneuverability第三者試験の装置、路面、荷重、操作者、反復回数。
- アップリカ・ピジョン取説の人間取得と提供。
- `Runfee RB5`既存identityの`model_number`を別工程で`generation_code`へ移すか。

## 変更しない事項

スゴカルLAのローカル価格差、Libelleのローカル重量差、Runfeeのローカル商品未登録、`site_product_id`、Supabaseデータは`identity-review.md`に保持し、今回変更しない。
