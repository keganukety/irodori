# 境界値と架空fixture検証

## Proposed boundaries

すべて人間承認前の候補であり、5商品の分布から恒久化していない。

| boundary | proposed boundary | rationale | supporting dataset | sensitivity concern | human approval | affected scenarios |
|---|---|---|---|---|---|---|
| body weight | ≤5.5kg / ≤7.5kg / >7.5kg | 境界包含と離散変化を試す | `fictional_boundary_fixture_v1_only` | 約表記と境界直近で点が変わる | pending | 全4scenario |
| unfolded width | ≤480mm / ≤520mm / >520mm | 幅bandの計算を試す | `fictional_boundary_fixture_v1_only` | 実駅・改札・車両を代表しない | pending | 全4scenario |
| folded footprint | ≤1600cm² / ≤2400cm² / >2400cm² | 立置き床面外接矩形を試す | `fictional_boundary_fixture_v1_only` | 不規則形状の実占有面積ではない | pending | 全4scenario |
| fold actions | ≤1 / ≤2 / >2 actions | 明示手数の包含を試す | `fictional_boundary_fixture_v1_only` | メーカー間の数え方が未標準化 | pending | compact travel以外の3scenario |
| age windows | 1–36 / 6–36 / 7–36 / 7–48か月 | A/B形を無条件に同列化しない | scenario design assumption | 約上限や用途期間で参加可否が変わる | pending | 対応scenario |

## 必須検証ケース

| # | ケース | 固定ルール | 期待結果 |
|---:|---|---|---|
| 1 | 対象月齢条件を満たす | 月齢窓、newborn、seat、必須軸を先に判定 | `eligible`、架空points計算可 |
| 2 | 対象月齢不足 | 下限がscenario開始月齢より遅い | `ineligible`、計算しない |
| 3 | 対象月齢不明 | null / unconfirmed | `unknown`、`on_hold` |
| 4 | A形とB形 | 1か月scenarioと7か月scenarioを別gate | B形相当fixtureは前者ineligible、後者eligible |
| 5 | kgとL | 次元横断換算表を持たない | `convertUnit`はnull |
| 6 | 重量scope差 | 異なる既知scope | `partial` |
| 7 | one-hand記載なし | 明示true以外はtrueにしない | `unknown`、falseにしない |
| 8 | self-standing記載なし | 明示値を要求 | `unknown`、falseにしない |
| 9 | folded bounding box | 3辺積を外接直方体proxyとして算出 | `is_actual_occupied_volume: false` |
| 10 | raw fact重複 | 正の割当が最大1回を超える | validator FAIL |
| 11 | 必須軸欠損 | scenario required axisがnull | `unknown` / `on_hold`、0点にしない |
| 12 | optional軸欠損 | optional groupだけ除外 | eligibleのまま`calculated_partial` |
| 13 | conflict | required/critical conflict | `on_hold`; optionalならaxis除外 |
| 14 | maneuverability宣伝だけ | manufacturer claimは非客観 | 配点なし、第三者実測待ち |
| 15 | manufacturer claim昇格 | claim classを確認 | objective inputから除外 |
| 16 | 実在商品 | fixture flagとdomain gate | 評価関数が拒否、runの得点キー不存在 |

## 感度の読み方

境界の±1単位、約表記、scope差、orientation不明によって、架空fixtureのpointsや計算可否がどの程度変わるかだけを確認する。実在5商品へ適用して順位変動を出すことは今回の範囲外である。
