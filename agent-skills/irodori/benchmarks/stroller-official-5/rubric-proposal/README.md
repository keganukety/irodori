# 電車移動向け比較ルーブリック提案

このディレクトリは、5商品公式ベンチマークを根拠にした次工程向けの**提案契約**である。`status: proposed`、`human_approval_status: provisional_approved`であり、恒久境界・配点・実在商品の得点・順位・感度分析結果は確定していない。実在5商品へ適用できるのは、比較可能性、scenario eligibility候補、measurement scopeまでである。

## 4つの主観軸の分類

| 旧軸 | 分類 | 最終扱い |
|---|---|---|
| `portability` | `split_into_subaxes` | `transport_burden`と`carry_assistance`へ分割し、独立入力は廃止 |
| `train_fitness` | `editorial_composite_output` | `station_space_fit`、`transport_burden`、`folding_independence`、`carry_assistance`から作る結果。raw input禁止 |
| `maneuverability` | `requires_third_party_measurement` | 公式機構factだけでは`unscored` |
| `one_operator_fitness` | `editorial_composite_output` | `folding_independence`と`carry_assistance`から作る結果。body weightの再加点禁止 |

## 初期比較の4親軸

- `transport_burden`: `body_weight_kg`、`measurement_scope`、`approximation_status`、carry handle/strap。重量値が直接正の寄与候補になるのはこの親軸だけ。carry factはここではcontextであり、正の寄与候補は`carry_assistance`へ集約する。
- `station_space_fit`: 展開幅、折りたたみ3辺、立置き床面外接矩形。外接直方体体積は参考値で、実占有体積ではない。
- `folding_independence`: 片手fold/unfold、明示操作数、両手・屈曲・seat脱着、自立、lock、seat装着状態。
- `carry_assistance`: handle、strap、carrying position、明示factからのassistance level。

バスケット、maneuverability、suspension、タイヤ数・径、review sentiment、外部順位、楽天順位、manufacturer marketing claimは初期score入力から除外する。basketのkg/Lは換算しない。配点自体はこの工程で定義しない。

## Scenario eligibility

| scenario | 対象窓 | 開始条件 | 上限条件 | 追加条件 |
|---|---:|---|---|---|
| `primary_from_1_month` | 1–36か月 | 1か月以下 | 36か月以上または15kg以上 | newborn不要、seat方向不問 |
| `primary_from_6_months` | 6–36か月 | 6か月以下 | 36か月以上または15kg以上 | newborn不要 |
| `second_stroller_from_7_months` | 7–36か月 | 7か月以下 | 36か月以上または15kg以上 | 対面機能不要 |
| `compact_travel_from_7_months` | 7–36か月 | 7か月以下 | 36か月以上または15kg以上 | 本体重量と折りたたみ3辺を確認。機内持込は推測せず航空会社規定を別確認 |

月齢条件を満たさない場合は`ineligible`であり0点・最下位にしない。必要情報不足は`unknown` / `participation_status: on_hold`とする。

## Proposed boundary grid

| boundary | candidate values |
|---|---|
| body weight | 4.0 / 5.0 / 6.0 / 7.0 kg |
| unfolded width | 460 / 480 / 500 / 530 mm |
| folded floor footprint | 800 / 1200 / 1600 / 2200 cm² |
| fold step count | 1 / 2 / 3 / 4以上 |

各境界は`status: proposed`、`permanent_threshold: false`、`sensitivity_test_required: true`、`human_approval_status: provisional_approved`、`supporting_dataset: five_product_official_benchmark`である。5商品だけでは恒久境界を決定できない。

## 「約」表記

公式値は書き換えない。感度分析準備の暫定規則として表示値の±5%を境界保留範囲とし、候補境界をまたぐときは隣接する両bandを次工程で評価する。これは測定誤差やメーカー公差ではなく、恒久規則でもない。

## Fold stepの暫定定義

`fold_step_count`は、取扱説明書または公式説明で、折りたたみ機構の状態を変えるため順番に必要と明示された操作数である。商品へ近づく、子どもを降ろす、荷物を出す、ブレーキをかける、折りたたみ後に持ち上げて運ぶ操作は数えない。公式説明で同時操作と明示されたものは1操作、順番に行う操作は別操作とする。不明瞭なら`fold_step_count: null` / `evidence_status: unconfirmed`で、動画の印象から補わない。定義状態は`proposed_definition` / `provisional_approved`である。

## Weight scope

同じ既知scopeまたは同じ測定条件は`full`。unspecified同士、付属品範囲が一部不明、approximateを含む場合は`partial`。付属品込み対除外、最軽量構成対標準構成は`not_comparable`。測定対象が判別できなければ`unknown`である。`partial`は次工程の感度分析候補にできるが、確定ランキングには人間承認が必要であり、`full`へ自動昇格しない。

## Optional欠損

optional欠損は0点・false・推測値にしない。coverageを下げ、確認できるsubaxisだけで説明する。親軸の全subaxisが欠損なら親軸は`unavailable`。required欠損は`participation_status: on_hold`。coverage閾値は未採用である。

## Identityと取説同意ゲート

公式商品名を根拠に、Runfee RB5=`RB5`、スゴカル エッグショック LA=`LA`、カルーンエアー メッシュ AC=`AC`を`generation_code`として保持する。`model_year` / `model_number`には昇格しない。

アップリカとピジョンの取説同意操作はAIが行わない。`skipped_terms_acceptance_required`、`human_download_required`、`user_provided_manual_pending`のいずれかで保持する。この不足はKnown limitationであり、今回のPRを妨げる重大FAILではない。

## Maneuverability

シングルタイヤ、オート4輪、タイヤ径、サスペンション、車輪数、メーカーの押しやすさ訴求は実走性能の得点根拠にしない。将来試験候補は、規定幅での180度旋回、一定間隔のスラローム、一定高さの段差通過、一定距離の直進偏位、一定荷重、同一路面、同じタイヤ状態、同じ操作者または操作手順である。試験条件が確定するまで`unscored`とする。

## 検証

```powershell
node agent-skills/irodori/benchmarks/stroller-official-5/rubric-proposal/validate-rubric-proposal.mjs
node --test --test-isolation=none agent-skills/irodori/benchmarks/stroller-official-5/rubric-proposal/tests/rubric-proposal.test.mjs
```

validatorは4軸分類、4scenario、boundary metadata、約±5%、fold step、weight scope、optional欠損、generation_code、同意gate、将来試験条件、二重加点、実在商品score・順位不存在、秘密情報を検証する。
