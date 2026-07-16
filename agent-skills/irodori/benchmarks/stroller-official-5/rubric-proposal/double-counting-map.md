# 二重加点マップ

原則は「1つのraw factが最終総合点へ実質寄与するのは最大1回」である。複数raw factが1つのderived indicatorを共同で作る場合、配点は`contribution_group`の上限で一度だけ付与する。説明への再掲は`zero_contribution_only`とする。

| raw fact | 直接使用するderived indicator | 使用可能なscene axis | 最大寄与回数 | 重複調整 | 禁止される重複 |
|---|---|---|---:|---|---|
| `body_weight_kg` | `weight_burden_points` | `carry_burden` | 1 | carry weight groupだけ | portability / train fitness / one-operatorへの再加点 |
| `weight_measurement_scope` | `weight_comparability_status` | gateのみ | 0 | 配点せず比較可否だけ | scope自体への加点 |
| `weight_is_approximate` | `weight_precision_status` | gate・感度注記のみ | 0 | 境界保留に使用 | approximateを有利・不利へ加点 |
| `unfolded_width_mm` | `unfolded_width_band` | `station_space_fit` | 1 | open width groupだけ | maneuverabilityやtrain fitnessへの再加点 |
| `unfolded_depth_mm` | なし（情報） | なし | 0 | zero contribution | 推定旋回性能への利用 |
| `unfolded_height_mm` | なし（情報） | なし | 0 | zero contribution | 操作性への利用 |
| `folded_width_mm` | `folded_floor_footprint_cm2` | `station_space_fit` | 1 | footprint groupで共同使用 | volumeとfootprintの両方を同時加点 |
| `folded_depth_mm` | `folded_floor_footprint_cm2` | `station_space_fit` | 1 | footprint groupで共同使用 | volumeとfootprintの両方を同時加点 |
| `folded_height_mm` | `folded_bounding_box_volume_l` | 説明のみ | 0 | volume proxyは情報表示 | footprintに誤使用、実体積として加点 |
| `folded_dimension_orientation` | `folded_floor_footprint_cm2` | `station_space_fit` | 1 | footprint算出の前提 | 不明方向で床面積を算出 |
| `target_age_min_months` | `target_age_eligibility` | eligibility gate | 0 | 参加条件のみ | 若い月齢対応を性能点へ加点 |
| `target_age_max_months` | `target_age_eligibility` | eligibility gate | 0 | 参加条件のみ | 長期利用を電車適性へ重複加点 |
| `max_child_weight_kg` | `target_age_eligibility`の必要情報 | eligibility gate | 0 | 参加・注意情報のみ | portability等への加点 |
| `seat_direction` | `target_age_eligibility` | eligibility gate | 0 | scenario要件だけ | 両対面を走行性能へ加点 |
| `one_hand_fold_explicit` | `verified_one_hand_operation` | `folding_independence` | 1 | one-hand groupで共同使用 | one-operatorへ再加点 |
| `one_hand_unfold_explicit` | `verified_one_hand_operation` | `folding_independence` | 1 | one-hand groupで共同使用 | one-operatorへ再加点 |
| `fold_step_count` | `required_fold_actions` | `folding_independence` | 1 | fold actions groupだけ | subjective folding easeとの併用 |
| `requires_two_hands` | `verified_one_hand_operation` | `folding_independence` | 1 | one-hand groupの整合条件 | 独立ペナルティとの二重計上 |
| `requires_bending` | `required_fold_actions` | `one_operator_support` | 1 | bending groupだけ | folding independenceへ再加点 |
| `requires_seat_removal` | `required_fold_actions` | `one_operator_support` | 1 | seat removal groupだけ | folding independenceへ再加点 |
| `self_standing_explicit` | `verified_self_standing` | `folding_independence` | 1 | self-standing groupだけ | station spaceへ再加点 |
| `standing_orientation` | footprint算出補助 | gate・説明のみ | 0 | 配点はfolded dimension orientationへ集約 | 自立trueと向きを別々に加点 |
| `carry_handle` | `carry_assistance_level` | `carry_burden` | 1 | carry assistance group上限10 | body weightとは別groupだが他sceneへ再利用禁止 |
| `carry_strap` | `carry_assistance_level` | `carry_burden` | 1 | carry assistance group上限10 | handleとstrapを各10点として合算 |
| `folded_lock` | `folded_lock_support` | `one_operator_support` | 1 | folded lock groupだけ | self-standingへ再加点 |
| `fold_with_seat_attached` | `seat_attached_support` | `one_operator_support` | 1 | seat attached groupだけ | seat removalと同一事実なら代表1件に統合 |
| `basket_max_load_kg` | なし（独立表示） | なし | 0 | kgのまま表示 | L換算、単一basket score |
| `basket_volume_l` | なし（独立表示） | なし | 0 | Lのまま表示 | kg換算、単一basket score |
| `basket_dimensions` | なし（独立表示） | なし | 0 | scope付き参考情報 | volumeの代替値として無断計算 |
| `basket_access` | なし（独立表示） | editorial候補のみ | 0 | 人間承認まで無配点 | 容量点への上乗せ |
| `basket_opening` | なし（独立表示） | editorial候補のみ | 0 | 人間承認まで無配点 | 容量点への上乗せ |
| `basket_measurement_scope` | basket比較可否 | gateのみ | 0 | 比較条件の注記 | scope自体への加点 |
| `wheel_count` | `maneuverability_evidence`の機構記録 | なし | 0 | third-party測定待ち | 小回り点への直結 |
| `wheel_diameter` | `maneuverability_evidence`の機構記録 | なし | 0 | third-party測定待ち | 段差点への直結 |
| `tire_type` | `maneuverability_evidence`の機構記録 | なし | 0 | third-party測定待ち | 直進性点への直結 |
| `suspension` | `maneuverability_evidence`の機構記録 | なし | 0 | third-party測定待ち | 走行安定性点への直結 |
| `handle_height_adjustment` | なし（独立表示） | editorial候補のみ | 0 | 人間承認まで無配点 | one-operatorへの推測加点 |
| `travel_system_compatibility` | なし（独立表示） | scenario候補のみ | 0 | 対象scenarioを別途定義 | 電車適性への無条件加点 |
| `manufacturer_maneuverability_claim` | `maneuverability_evidence: unscorable` | なし | 0 | claimとして保存するだけ | 客観fact昇格、実走点への利用 |

validatorは同じ`raw_fact_id`に複数の正の配点割当または複数scene axisがある場合にFAILする。derived indicatorの説明とscene axisの双方で配点することも禁止する。
