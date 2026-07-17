# terminology — 用語と評価軸の定義(正本)

irodoriスキル群で使う用語の定義。各SKILL.mdはこの定義を再定義せず参照する。
区分ラベル: **[C] = Confirmed Principle / [P] = Proposed Default / [O] = Open Decision / [U] = Unverified**

## 1. 基本用語

| 用語 | 定義 | 区分 |
|---|---|---|
| 商品同定 (product identification) | 情報が「どの商品・どのモデル年・どの市場仕様」のものかを確定する作業。全工程の最初に行う | [C] |
| `product_identity` | ブランド + 正式商品名 + モデル年 + 対象市場 + 型番で同定する商品モデル。仕様同一の色違いはvariant | [C] |
| `source_record` | 情報源1つ(1ページ・1文書)につき1レコード。「どこから得たか」を表す | [C] |
| `evidence_claim` | 1つの情報源から抽出した個別の主張(1仕様・1測定値・1評価・1口コミ傾向)。1つの `source_record` から複数作れる | [C] |
| `normalized_feature` | 商品×評価軸ごとに正規化された値。複数の `evidence_claim` に支えられる | [C] |
| `review_theme_summary` | 口コミをテーマ別に肯定/否定/中立で整理した短い構造化要約 | [C] |
| `source_usage_audit` | 第三者媒体について、規約上の許諾・運用判断・法務確認・内部監査結果を操作単位で分離した記録 | [C] |
| `rakuten_ranking_snapshot` | 楽天店舗商品listingの順位・価格等を時点とTTL付きで保持する市場需要メタデータ。品質評価ではない | [C] |
| `market_demand_signal` | 売上人気・需要の鮮度を説明・調査優先順位に使うsource_role。品質scoreへ接続しない | [C] |
| `external_sales_ranking_metadata` | 外部販売ランキングの参考メタデータ。IRODORI順位・品質scoreと分離する | [C] |
| 正規化 (normalization) | 単位・表記・名称を共通形式に揃えること。値の意味を変えないこと | [C] |
| 決定論的処理 | 同じ入力・同じ設定・同じ計算バージョンで必ず同じ結果を返す処理。AIの自由判断を含まない | [C] |
| 計算バージョン (`calc_version`) | ランキング計算ロジックの版。結果の再現に必要 | [C] |
| 実行ID (`run_id`) | 一連の調査〜ランキング処理1回分の識別子。`run_manifest` に記録 | [C] |

## 2. 情報の性質(claim_class)

確認済み事実と推論を同じフィールドに入れない [C]。分類の許容値:

| 値 | 意味 |
|---|---|
| `official_spec` | メーカー公式仕様(公式サイト・カタログの仕様欄) |
| `manufacturer_claim` | メーカーの主張・宣伝表現(「業界最軽量」等。事実へ格上げしない) |
| `manual_safety` | 取扱説明書・安全情報由来の記載 |
| `third_party_measured` | 第三者による実測値(測定条件を併記) |
| `editorial_opinion` | 編集部評価・レビュアーの意見 |
| `review_aggregate` | 購入者口コミの傾向(集約。個別本文は保存しない) |
| `user_testimonial` | 一般利用者の体験談(購入確認なし) |
| `irodori_inference` | IRODORIによる推論(確認済み事実からの導出。必ずこのラベルを付ける) |
| `unknown` | 性質を判定できない(不明・未確認) |

区分: 分類体系の存在は [C]、値の名称・過不足は [P]。

## 3. 状態の用語

3系統を混同しない [C]。詳細は `status-model.md` を正本とする。

- `evidence_status`: `confirmed / unconfirmed / conflicting / outdated / not_applicable` — 証拠の確からしさ
- `validation_result`: `pass / fail / unknown / not_applicable` — 機械的検証の結果
- `publication_status`: `draft / review_required / approved / rejected / published` — 公開ワークフロー上の位置
- `terms_permission_status`: 規約上の明示許諾・禁止・不明の状態
- `operational_decision`: IRODORIがその利用方式を採用するかの判断
- `legal_review_status`: 法務確認の要否・完了状態
- `audit_result`: IRODORI内部監査基準への適合。`pass`でも法的許可・明示許諾・自動取得許可を意味しない

## 4. スコア関連の用語(分離必須)

| 用語 | 定義 | してはならないこと | 区分 |
|---|---|---|---|
| `observed_score` | 確認済みかつscore可能な軸の重み付き得点合計を、その軸のweight合計で割った観測済み範囲の得点 | 未確認軸を0点として算入する | [C] |
| `score` | `observed_score` のdeprecated alias。新規成果物では正本にしない | 別の値として保持する | [C] |
| `data_coverage` | 定義軸数のうち確認済みかつscore可能な軸数の割合 | observed_scoreと混ぜる | [C] |
| `weighted_data_coverage` | 確認済みかつscore可能な軸のweight合計 ÷ 全定義軸のweight合計 | observed_scoreへ加算・乗算する | [C] |
| `confidence` | 結果の確からしさ。第2段階は `confidence-proposed-v1` を試作 | AIの主観で付与する / observed_scoreへ加算する | [C](分離) / [P](式) |
| `partial_observed_score` | 実在商品の非公開coverage分析で、観測済みcriterionだけを再正規化した内部試算値。`observed_score`の用途限定名 | 公開total score・確定品質scoreとして表示する | [C](分離) / [P](名称) |
| `criterion_coverage` | scenario適用criterionのうちscoreableなcriterionの件数比 | unknown/conflict/not-comparableを分母から落とす | [C](分離) / [P](詳細契約) |
| `parent_axis_coverage` | 親軸別のscoreable幅を最低評価幅込みで算出した比率と状態 | 1 criterionだけで親軸全体を十分評価済みとする | [C](分離) / [P](式・最低幅) |
| `total_quality_score` | 確定coverage profileと正式rubricを満たした将来の公開品質score用予約名 | proposed profileやpartial scoreから生成する | [P](予約名) |
| `score_display_eligibility` | coverage/evidence/profile条件に基づくscore表示gate。公開workflow承認とは別 | trueをpublication_status approvedへ自動変換する | [C](分離) / [P](条件) |
| `ranking_eligibility` | 個別gateと同一scenario内候補数を満たすranking参加可否 | falseの商品を0点・最下位に置く | [C](分離) / [P](条件) |

## 5. 評価軸(axis)の初期候補 [P]

正規化と重み付けの対象となる軸のID候補。**この一覧は初期案であり、追加・統合・削除は
`data-contracts.md` のバージョン管理に従う。** ベビーカーを想定した候補(他カテゴリは未定 [O]):

| axis_id | 表示名 | 値の型(案) |
|---|---|---|
| `weight_body` | 本体重量 | number (kg) |
| `size_open` | 使用時サイズ | 構造化寸法 (W/D/H mm) |
| `size_folded` | 折りたたみ時サイズ | 構造化寸法 (W/D/H mm) |
| `target_age` | 対象月齢 | 範囲 (月) |
| `max_load` | 対応体重・耐荷重 | number (kg) |
| `price` | 価格 | number (円, 税込/税別を併記) |
| `maneuverability` | 走行性・操作性・小回り | 評価傾向(ordinal) |
| `step_handling` | 段差の越えやすさ | 評価傾向(ordinal) |
| `vibration` | 振動の少なさ | 評価傾向(ordinal) |
| `folding_ease` | 折りたたみやすさ・片手操作 | 評価傾向(ordinal) + boolean(片手可) |
| `self_standing` | 自立性 | boolean |
| `portability` | 持ち運びやすさ | 評価傾向(ordinal) |
| `car_loading` | 車への積みやすさ | 評価傾向(ordinal) |
| `train_fitness` | 電車移動適性(改札幅含む) | 評価傾向(ordinal) |
| `one_operator_fitness` | ワンオペ適性 | 評価傾向(ordinal) |
| `basket_capacity` | バスケット容量 | number (L) または text |
| `newborn_ready` | 新生児対応 | boolean + 条件 |
| `seat_comfort` | シートの快適性・通気性 | 評価傾向(ordinal) |
| `care_ease` | お手入れのしやすさ(洗濯可否) | boolean + 評価傾向 |
| `included_accessories` | 同梱付属品 | text / string[] |
| `warranty` | 保証 | text(期間・条件) |
| `caution` | 注意点 | text |

シーン(利用場面)タグの初期候補 [P]: `one_operator`(ワンオペ) / `apartment`(マンション) /
`kei_car`(軽自動車) / `train_commute`(電車移動) / `travel`(旅行) / `newborn`(新生児期) /
`narrow_store`(狭い店舗) / `summer`(夏の使用)。
既存の診断計画 `docs/product-diagnosis-plan.md` の条件語彙と将来対応付ける想定 [P]。

## 6. 禁止用語・表現 [C]

- 完了判定できない抽象表現をスキル指示・成果物に書かない(例:「よく調べる」「最適にランキングする」「いい感じに」)。
- 他媒体の評価ラベル(「◯◯ベストバイ」等)をIRODORI独自評価として使わない。
- 「業界最軽量」等の宣伝表現を、`manufacturer_claim` ラベルなしで事実として書かない。
- 件数根拠なしに「多くの口コミ」「多数の利用者」「よく言われている」「圧倒的に好評」
  「口コミで人気」「高評価が多い」「売れ筋」「大人気」「今一番売れている」を使わない。
- 楽天順位・星・口コミ件数から「品質が高い」「おすすめ」へ自動変換しない。

互換規則 [C]: 旧 `included_items` は `included_accessories` のdeprecated aliasとして読み取り可能だが、
新規成果物は必ず `included_accessories` を出力する。
