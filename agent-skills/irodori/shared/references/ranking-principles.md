# ranking-principles — ランキング原則(正本)

区分ラベル: **[C] = Confirmed Principle / [P] = Proposed Default / [O] = Open Decision / [U] = Unverified**

## 1. 入力に関する原則 [C]

- ランキングの入力は、正規化済みの `normalized_feature` と `review_theme_summary` のみ。
  生の記事・生の口コミ・他媒体の順位を直接入力しない。
- 現行モデルのみを母集団とする(`lifecycle_status: current`)。旧モデル・海外仕様を混在させない。
- 他媒体の順位・星・受賞は得点化しない(→ `source-policy.md` §4 の禁止列挙)。
- 商業条件(アフィリエイト報酬率・広告金額・在庫状況・販売店都合)を得点へ反映しない。
  `commercial_relation` は証拠の独立性判断のメタデータとしてのみ使う。

## 2. observed_score / coverage / confidence の分離 [C]

| 指標 | 定義 | 計算主体 |
|---|---|---|
| `observed_score` | 確認済みかつscore可能な軸だけの重み付き得点を、その軸のweight合計で正規化する | 決定論的処理 |
| `data_coverage` | ランキング定義が参照する軸のうち、`confirmed` な値を持つ軸の割合 | 決定論的処理 |
| `weighted_data_coverage` | 使用可能な軸のweight合計 ÷ 定義の全軸weight合計 | 決定論的処理 |
| `confidence` | 結果の確からしさ。第2段階の式はproposed | 決定論的処理 |

- 未確認(`unconfirmed`)の軸を0点として算入しない [C]。
- `score` は `observed_score` のdeprecated aliasとし、新規の正本フィールドには使わない [C]。
- `data_coverage` または `weighted_data_coverage` が各最低充足率(未確定 [O])未満の商品は、順位を与えず
  「評価保留(insufficient_data)」として分離する。**不当に低い順位も高い順位も与えない** [C]。
- 第2段階の試験式 [P] `confidence-proposed-v1`:
  `0.40 × data_coverage + 0.25 × 独立ソース充足 + 0.20 × 一次情報比率
  + 0.15 × claim reliability`。各成分は0〜1へ正規化する。
- 上記は架空fixtureで設計を検証する仮値。coverageやconfidenceをobserved_scoreへ加算・乗算しない [C]。

矛盾軸の参加判定 [C](方針) / [P](設定値):

- 必須軸の未解決矛盾は商品全体を `on_hold`。
- 非必須軸の未解決矛盾はその軸だけを計算から除外し、除外後に両coverageを再計算する。
- 安全・適合・対象年齢等、`critical_axes` に指定した重要事項の未解決矛盾は常に `on_hold`。
- `critical_axes`、両coverage閾値は `ranking_definition` に置き、試験値は `proposed` とする。

## 3. AIと決定論的処理の分担 [C]

同じ入力・同じ設定・同じ `calc_version` なら同じ結果になること。

| 処理 | 担当 |
|---|---|
| 候補の抽出・分類・短い要約・矛盾候補の提示 | AI(スキル実行者)が担当してよい |
| 数値と単位の変換 | 決定論的処理 |
| 入力検証(validation_result の付与) | 決定論的処理 |
| 重複排除の確定 | 決定論的処理(AIは候補提示まで) |
| 重み付き得点(observed_score) | 決定論的処理 |
| データ充足率(data_coverage) | 決定論的処理 |
| 重み付き充足率(weighted_data_coverage) | 決定論的処理 |
| confidence | 決定論的処理 |
| 順位付け・同点処理 | 決定論的処理 |
| 感度分析 | 決定論的処理 |
| 計算バージョン管理 | 決定論的処理 |

第2段階では `irodori-ranking-engine/scripts/ranking-engine.ts` に決定論的試作を実装した。
使用対象は架空fixtureに限定し、AIまたは試作コードが実在商品の順位を出すことを禁止する [C]。

## 4. 重みと設定の管理 [C](構造) / [O](値)

- 重み・軸別 `scoring_rule`・2種類の最低充足率・必須項目・重要事項軸・証拠方針・同点規則・
  confidence設定・感度分析幅は `ranking_definition` に外出しする。
  スキル本文・コードへのハードコード禁止。
- 各設定値には `value_status: proposed | confirmed` を付け、**提案値(Proposed Default)と
  確定値を区別できる構造**にする。ユーザーが確定するまで `proposed` のまま扱い、
  `proposed` のみの定義で作った結果は `publication_status: draft` を超えられない。
- 総合ランキングとシーン別ランキングは、同じ `normalized_feature` に異なる重みベクトルを
  適用する構造とする(データの二重管理をしない)。

## 5. 同点処理・感度分析 [C](必要性) / [P](第2段階の試験値)

- 試験規則 [P]: 同observed_scoreは同順位とする。confidenceとcoverageは順位差に使わない。
  表示順だけ `product_identity_id` 昇順で固定し、IDを得点や順位差に使わない。
- 感度分析の試験幅 [P]: 各軸のweightを個別に ±0.05 変動させ、順位が入れ替わる商品ペアを
  `sensitivity_notes` として出力する。「僅差」の可視化が目的。

## 6. 説明可能性 [C]

`ranking_result` の各エントリは、次を含まなければ完成と見なさない:

1. 軸ごとの得点内訳(`per_axis_breakdown`)
2. 各軸の値が依拠する `normalized_feature` → `evidence_claim` → `source_record` への参照
   (**順位から出典まで遡れること**)
3. 順位の理由(重み上位の軸と値。テンプレートに沿った短文)
4. 得意な条件・苦手な条件
5. 未確認項目の一覧
6. 使用した `ranking_definition` のIDと版、`calc_version`、`run_id`
7. 除外・評価保留となった商品の理由一覧

## 7. 禁止事項(ランキング全般) [C]

- AIによる自由な順位決定(「総合的に判断して1位」)
- 未確認項目の0点化
- 他媒体順位の平均・合算・換算
- 掲載回数だけでの加点、転載の重複カウント
- 情報量が多い商品ほど有利になる設計(軸ごとの加点上限を固定する)
- 商業条件のスコア反映
- `products.rank_no` への書き込み(既存サイトの手動順位。本スキル群からは変更しない)
- 実在商品のランキング決定(identity・調査契約・設定値が人間確認されるまで禁止)

## 8. SHA-256入力ハッシュとcanonicalization [C]

- `node:crypto` のSHA-256を使い、結果へ `input_hash` と
  `input_hash_algorithm: "sha256"` を保存する。ランダム値やFNV系ハッシュは使わない。
- objectのkeyはコード単位の昇順。文字列はUnicode正規化せずJSON文字列として保持し、
  booleanは`true/false`、nullは`null`、有限numberはJSON数値、`-0`は`0`とする。
  `NaN` / `Infinity` / `undefined` / bigint / function / symbol は入力拒否する。
- 次の意味上順序なしの配列をcanonical JSON表現で安定ソートする:
  candidate products(`candidates`, `product_identities`) / `source_records` /
  `evidence_claims` / `normalized_features` / `review_theme_summaries` / `axis_weights`。
  参照ID配列(`feature_refs`等)も安定ソートする。
- `tie_breaker_rules.ordered_rules`、工程順(`steps`)、状態履歴(`status_history`)等、
  順序に意味がある配列は入力順を保持する。
- hash計算時は既存の `input_hash` / `input_hash_algorithm` をnullとして除外し、
  同じ意味・同じ設定・同じ計算版なら配列入力順に関係なく同じhashにする。
