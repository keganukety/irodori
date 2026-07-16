# コンビ スゴカル エッグショック LA 公式情報調査 — 調査要約

- run_id: `run-2026-07-16-combi-sugocal-eggshock-la-official`
- 調査日時: 2026-07-16 14:45〜15:50 JST
- 実行: claude-code(irodori-product-research → evidence-normalizer → intelligence の順)
- 使用情報源: **コンビ公式のみ**(公式ブランドストア商品ページ・公式取説ダウンロードページ・公式取扱説明書PDF)
- ランキング処理: **未実施**(ranking_input / ranking_result / score / 順位は作成していない)
- 位置づけ: 5商品公式ベンチマーク `benchmarks/stroller-official-5` の追加商品run

## 1. identity監査結果(provisional)

| 要素 | 値 | 根拠 |
|---|---|---|
| ブランド | コンビ | 公式ブランドストア(src-sgcla-001) |
| 正式商品名 | スゴカル エッグショック LA | 公式ストアページタイトル・見出し |
| モデル年 | null(未確認) | コンビはモデル年表記を用いない。世代は末尾記号(LA)と発売日2024/7/19(clm-sgcla-008)で区別 |
| 対象市場 | JP(日本) | 日本公式ストア掲載・円建て価格・安全基準A型(取説表紙) |
| モデル共通型番 | null(未確認) | 商品コードはカラー別(119376/119377/119767)。取説DLページの『型式: LA』は公式定義未確認のため昇格させない |
| 確認済みvariant | BE 119376 / DG 119377 / GL 119767(仕様同一性unverified) | 公式ストア基本情報欄(clm-sgcla-009) |

- lifecycle_status: `current`(公式ブランドストアで販売中。DGカラーは確認時点で完売表示)
- 公式商品URL: https://www.combi.co.jp/store/stroller/sugocalfa/g/g119376/
- 公式取扱説明書: https://www.combi.co.jp/soudan/after/manual_cp/babycar.html から直接リンクされるPDF(同意ゲートなし)。取得済み。表題は『スゴカル エッグショック』のみのため`match_status: probable`

### ローカル商品ID 3との関連付け
`site_product_id: "3"`(ローカル名「スゴカル エッグショック LA」)を`probable`とした。名称・ブランド・重量4.6kgは一致するが、**ローカル価格32,000円と公式ストア価格48,000円が一致しない**(identity-reviewに記録)。

## 2. 作成した成果物

| ファイル | 内容 | 件数 |
|---|---|---|
| product-identity.json | product_identity | 1 |
| sources.json | source_record | 3(すべてacquired) |
| evidence-claims.json | evidence_claim | 24(fact 24 / inference 0 / conflicting 0) |
| normalized-features.json | normalized_feature | 14(値あり13 / 未確認1) |
| review-report.json | review_report(publication_status: review_required) | 1 |

## 3. 正規化した主要スペック(すべて公式根拠)

| 軸 | 値 | 根拠source数 |
|---|---|---|
| weight_body | 4.6 kg(ダッコシート除く) | 1 |
| size_open | W486×D835×H1048 mm(D725-835/H991-1048の最大値) | 1 |
| size_folded | W486×D425×H1012 mm | 1 |
| target_age | 生後1ヵ月〜36ヵ月ころ | 2 |
| max_load | 15 kg(目安) | 2 |
| basket_capacity | 耐荷重5 kg(容量Lは未確認) | 1 |
| folding_ease | **null(unconfirmed)** — ワンタッチ開閉表記はあるが片手可否の明記なし | 0 |
| self_standing | true(折りたたみ後・キャスター向き条件付き) | 1 |
| warranty | お買い上げ日より1年間(標準使用期間5年) | 1 |
| care_ease | 着脱シート等洗濯可(中性洗剤推奨) | 1 |
| included_accessories | 本体・取説・保証書・ヘッドサポート・頭部用エッグショックパッド・おしりサポート | 1 |
| caution | 連続使用2時間以内(座位1時間以内) | 1 |
| newborn_ready | false(生後1ヵ月から。取説に1ヵ月の定義あり) | 1 |
| price | 48,000円(税込・公式ストア価格) | 1 |

## 4. 矛盾・不明点

- 公式情報内の**矛盾は検出していない**。
- 取説表題にLA・年式の明記なし(match_status: probable。取説DLページの型式LA紐付けを根拠に保持)。
- 『オート4キャス最軽量』は比較条件が本ページ未記載のため`manufacturer_claim`(reliability: low)として分離。
- 公式ストアページのユーザーレビュー/スタッフレビューは本文・投稿者情報・星・件数とも**一切保存していない**。

## 5. 検証結果

- validate-run.mjs: 全チェックPASS(契約検証・参照整合性・PDF公式到達経路・公式ドメイン限定・score/rank不存在)
