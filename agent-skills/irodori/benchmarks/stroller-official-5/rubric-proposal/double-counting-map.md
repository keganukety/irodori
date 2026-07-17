# 二重加点防止map

配点は未定義だが、将来の正の寄与先を1 raw factにつき最大1親軸へ固定する。

| raw fact | 将来の正の寄与候補 | 他の扱い | 禁止 |
|---|---|---|---|
| `body_weight_kg` | `transport_burden`のみ | one-operator等では説明再掲のみ | 他親軸への再加点 |
| `measurement_scope` / `approximation_status` | なし | comparability gate | scope自体への加点 |
| `carry_handle` / `carry_strap` | `carry_assistance` | `transport_burden`ではcontextのみ | 2親軸での正の寄与 |
| `unfolded_width_mm` | `station_space_fit` | — | maneuverabilityへの推測利用 |
| folded width/depth | `station_space_fit`のfootprint group | 1つの派生値を共同構成 | volumeとfootprintの二重加点 |
| `folded_height_mm` | なし | bounding-box参考値 | 実占有体積として加点 |
| one-hand fold/unfold / requires two hands | `folding_independence`のone-hand group | 整合条件 | 個別の重複加点 |
| `requires_seat_removal` / `fold_with_seat_attached` | `folding_independence`の同一group | semantic aliasとして代表1件 | 2件分の加点 |
| wheel/tire/suspension | なし | 機構fact | maneuverability score |
| manufacturer claim | なし | claimとして保存 | objective fact昇格 |
| basket kg/L | なし | 単位別説明 | 換算・単一score |

`train_fitness`と`one_operator_fitness`はeditorial composite outputであり、親軸結果の合成時にraw factの新しい正の寄与を追加しない。validatorはraw factの複数親軸割当、semantic aliasの別group化、body weightの`transport_burden`以外への割当をFAILにする。
