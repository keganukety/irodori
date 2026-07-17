# Proposed boundary gridと架空fixture検証

## Candidate grid

| boundary | candidate values | status | approval | permanent | sensitivity |
|---|---|---|---|---|---|
| body weight | 4.0 / 5.0 / 6.0 / 7.0 kg | proposed | provisional_approved | false | required |
| unfolded width | 460 / 480 / 500 / 530 mm | proposed | provisional_approved | false | required |
| folded floor footprint | 800 / 1200 / 1600 / 2200 cm² | proposed | provisional_approved | false | required |
| fold step count | 1 / 2 / 3 / 4以上 | proposed | provisional_approved | false | required |

全境界のsupporting datasetは`five_product_official_benchmark`。5商品だけでは恒久境界を決定できない。配点・実在商品のband・感度分析結果はこの工程で作らない。

## 約表記

表示値の±5%を暫定的な境界保留範囲とする。候補境界をまたぐ場合、次工程で隣接する両bandを評価する。元の公式値は書き換えず、±5%を測定誤差やメーカー公差と断定しない。

## 必須fixture検証

1. 4scenarioの開始月齢と上限月齢/体重OR条件。
2. `ineligible`が0点・最下位にならず、`unknown`がon_holdになること。
3. compact travelで本体重量・折りたたみ3辺が必須になり、機内持込を推測しないこと。
4. kg/L変換拒否。
5. weight scopeのfull/partial/unknown/not_comparable。
6. approximate ±5%が境界をまたぐと隣接band候補になること。
7. fold stepの正整数・4以上band・null/unconfirmed。
8. optional欠損が0/falseにならず、全subaxis欠損で親軸unavailableになること。
9. body weightとsemantic aliasの二重加点防止。
10. manufacturer claimと機構factがmaneuverability scoreへ昇格しないこと。
11. 実在商品成果物にscore・順位・感度分析結果がないこと。
