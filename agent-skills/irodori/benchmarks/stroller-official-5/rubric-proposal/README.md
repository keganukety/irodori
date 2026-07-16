# 電車移動向け比較ルーブリック提案

このディレクトリは、5商品公式情報ベンチマークから得た課題を固定ルールへ変換するための**提案**である。実在5商品へ得点、順位、星、勝者、おすすめ認定を付けない。計算処理は`fixtures/fictional-strollers.json`にある架空名と`example.invalid`だけに適用する。

`status: proposed`の境界・配点・scenarioは人間承認前の試験値である。5商品の分布を恒久的な閾値の根拠にしていない。

## 成果物

- `axis-classification.json`: 全フィールドのraw / derived / editorial層と旧主観軸の扱い。
- `scenario-eligibility.json`: 4 scenarioの参加条件と4つのeligibility状態。
- `normalization-rules.json`: 単位、測定scope、精度、矛盾、同意ゲートの固定規則。
- `train-commute-rubric-proposal.json`: 架空fixture専用の提案配点、欠損・矛盾・二重加点方針。
- `double-counting-map.md`: raw factごとの唯一の寄与先と禁止重複。
- `boundary-cases.md`: 境界値メタデータと架空fixtureの検証ケース。
- `decision-log.md`: 採用・不採用・未決定事項。
- `validate-rubric-proposal.mjs`: eligibility、派生、scope、単位、二重加点、実在得点不存在の実行時検証。
- `fixtures/fictional-strollers.json`: 架空商品だけの入力。
- `tests/rubric-proposal.test.mjs`: 27件の新規テスト。

## 三層構造

### Layer 1: raw facts

メーカー日本公式sourceが直接明示した値だけを置く。値、単位、測定条件、精度、claim class、evidence status、矛盾を保持する。記載なしは`null` / `unconfirmed`であり、`false`や0ではない。

主な群は次のとおり。

- 重量: `body_weight_kg`, `weight_measurement_scope`, `weight_is_approximate`
- 寸法: 展開・折りたたみの各辺、`folded_dimension_orientation`
- 対象: 対象月齢下限・上限、最大体重、シート向き
- 折りたたみ: 片手fold/unfold、手数、両手、屈曲、シート脱着、自立、向き、carry補助、lock、seat装着状態
- バスケット: kg、L、寸法、access、opening、測定scopeを別フィールド
- 走行機構: wheel count/diameter、tire、suspension。実走性能とはしない
- メーカー訴求: `manufacturer_maneuverability_claim`として保存できるが、客観factや配点入力へ昇格しない

### Layer 2: deterministic derived indicators

固定式だけを使い、人間の印象を入れない。

- `folded_bounding_box_volume_l = width_mm × depth_mm × height_mm ÷ 1,000,000`
- `folded_floor_footprint_cm2 = 明示された床面2辺の積 ÷ 100`
- `verified_one_hand_operation`: foldとunfoldがともに明示trueの場合だけtrue。片方不明はunknown
- `verified_self_standing`: 明示値を保持し、記載なしはunknown
- `carry_assistance_level`: handle / strapの明示組合せ。欠損があればunknown
- `required_fold_actions`: 明示step countと追加操作フラグを別々に保持し、勝手に合算しない
- `target_age_eligibility`: scenario必要条件への決定論的判定
- `specification_completeness`: 性能ではなく確認済み情報の充足率

折りたたみ外接直方体は形状の凹凸を含む**bounding-box proxy**であり、実占有体積ではない。

### Layer 3: editorial or scene suitability

`train_transport_burden`、`station_space_fit`、`folding_independence`、`one_operator_support`、`maneuverability_evidence`、`train_commute_suitability`は利用場面への編集判断である。固定ルーブリック検証と人間承認前には生成しない。今回、実在5商品には生成していない。

## Scenario eligibility

| scenario | 月齢窓（proposed） | newborn | シート向き | 不適合・不明の扱い |
|---|---:|---|---|---|
| `primary_from_1_month` | 1–36か月 | 必須 | 対面または両対面 | 不適合はrank対象外。不明はon_hold |
| `primary_from_6_months` | 6–36か月 | 不要 | 指定なし | 同上 |
| `second_stroller_from_7_months` | 7–36か月 | 不要 | 背面または両対面 | 同上 |
| `compact_travel_from_7_months` | 7–48か月 | 不要 | 背面または両対面 | 同上 |

状態は`eligible` / `ineligible` / `unknown` / `not_applicable`を区別する。`ineligible`を0点や最下位へ変換しない。`unknown`はon_holdであり、欠損を悪い性能とみなさない。

A形・B形のラベル自体は配点しない。利用開始月齢と必要期間をscenario gateにすることで、1か月から必要な商品と7か月からのセカンド用途を同じ参加集合へ無条件に並べない。

## バスケット

`basket_max_load_kg`と`basket_volume_l`は異なる物理量である。kg↔L変換、密度仮定、異なる試験条件の同一視、kg/L混在の単一順位化をvalidatorが拒否する。寸法、access、opening、測定scopeも別フィールドであり、現時点では情報表示だけで総合点へ寄与しない。

## 本体重量

重量には`frame_and_seat` / `excluding_accessories` / `including_standard_accessories` / `manufacturer_stated_unspecified` / `unknown`のscopeを持たせる。同じ既知scopeだけが`full`、異なる既知scopeは`partial`、unspecifiedまたはunknownを含む比較は`unknown`である。

除外付属品が異なる商品、両対面状態の条件が異なる商品、最軽量構成だけの商品を完全比較しない。「約」は`approximate_as_stated`として保持し、精密な境界値とみなさない。

## 折りたたみ

旧`folding_ease`はdeprecateする。片手で閉じることと開くことを分離し、メーカーが該当操作を明示した場合だけtrueにする。動画の印象、説明画像、機構名から推測しない。自立、屈曲、シート脱着、lock、carry handle/strapも記載なしをfalseにしない。

## 主観4軸とmaneuverability

- `portability`: `split_into_subaxes`
- `train_fitness`: `editorial_only`
- `maneuverability`: `requires_third_party_measurement`
- `one_operator_fitness`: `split_into_subaxes`

シングルタイヤ、オート4輪、タイヤ径、サスペンションは公式機構factとして保存できる。メーカーの「押しやすい」はmanufacturer claimである。小回り、段差、直進性を比較するには、標準化した第三者の旋回半径、段差通過、直進保持等の実測が必要であり、今回の配点から除外した。

## 架空fixtureの計算

提案配点はcarry 30、station space 25、folding independence 30、one-operator support 15の合計100点枠だが、出力は`fictional_fixture_points_only`であり実在商品へ適用できない。scenario不適合・必須欠損・必須矛盾の場合は計算しない。任意欠損は0点化せず当該groupを除外し、`calculated_partial`と確認可能最大点を併記する。順位やordinal outputは生成しない。

## 実行

```powershell
node agent-skills/irodori/benchmarks/stroller-official-5/rubric-proposal/validate-rubric-proposal.mjs
node --no-warnings --experimental-strip-types --test --test-isolation=none agent-skills/irodori/benchmarks/stroller-official-5/rubric-proposal/tests/rubric-proposal.test.mjs
```

## 同意ゲート

アップリカ・ピジョンの取扱説明書利用規約への同意をAIが行わない。`skipped_terms_acceptance_required`、`user_provided_manual_pending`、`human_download_required`のいずれかで止め、人間が正式取得して提供するまで取説由来軸を推測しない。

## 次工程の条件

実在5商品の感度分析へ進む前に、人間がscenario月齢窓、数値境界、配点、必須／任意軸、約表記の境界処理、第三者走行試験プロトコル、手数の数え方、許容measurement scopeを承認する必要がある。承認前に実在商品へ得点や順位を生成してはならない。
