# CYBEX Libelle 2026 公式情報調査 — 調査要約

- run_id: `run-2026-07-16-cybex-libelle-2026-official`
- 調査日時: 2026-07-16 14:35〜16:45 JST
- 実行: claude-code(irodori-product-research → evidence-normalizer → intelligence の順)
- 使用情報源: **CYBEX公式のみ**(日本公式サイト・公式ダウンロードセンター・日本向け公式取扱説明書)
- ランキング処理: **未実施**(ranking_input / ranking_result / score / 順位は作成していない)
- 位置づけ: 5商品公式ベンチマーク `benchmarks/stroller-official-5` の追加商品run(既存Melioパイロットと同一手法)

## 1. identity監査結果(provisional)

| 要素 | 値 | 根拠 |
|---|---|---|
| ブランド | CYBEX | 公式商品ページ(src-lib26-001) |
| 正式商品名 | Libelle | 公式商品ページタイトル |
| モデル年 | 2026 | 公式ダウンロードセンター表記「Libelle (2026)」(src-lib26-002)。公式一覧で「Libelle (2025)」と別商品として併載(src-lib26-004) |
| 対象市場 | JP(日本) | 日本公式ストアフロント掲載、ダウンロードセンターに「日本 / Japan」バージョン、日本語取説(保証は日本国内) |
| モデル共通型番 | null(未確認) | Cinnamon Yellowの商品コードをモデル型番から分離 |
| 確認済みvariant | Cinnamon Yellow / product_code 526001009 / 仕様同一性unverified | 公式商品ページの商品コード欄(clm-lib26-009) |

- lifecycle_status: `current`(公式JP一覧にNewバッジ付きで掲載・2025年モデルと併売表示)
- 公式商品URL: https://www.cybex-online.com/en/jp/p/st-go-libelle-6.html
- 公式取扱説明書: discovery_page_url https://download.cybex-online.com/products/libelle-2026 の日本向けrevision a(2026-02-06〜)から直接リンクされるPDF(54ページ・表題『LIBELLE リベル 取扱説明書』)。取得済み。`match_status: probable`(年式の明記なし)

### ローカル商品ID 7との関連付け
`site_product_id: "7"`(ローカル名「リベル 2026」)を`probable`とした。名称・ブランド・タイプ(B型)・対象月齢(6ヵ月〜4歳・22kg)は一致するが、**ローカル重量6.3kgと公式仕様6kgが一致しない**。ローカル価格29,975円は公式ページで確認できない(identity-reviewに記録)。

## 2. 作成した成果物

| ファイル | 内容 | 件数 |
|---|---|---|
| product-identity.json | product_identity | 1 |
| sources.json | source_record | 4(すべてacquired) |
| evidence-claims.json | evidence_claim | 26(fact 25 / inference 1 / conflicting 0) |
| normalized-features.json | normalized_feature | 14(値あり11 / 未確認3) |
| review-report.json | review_report(publication_status: review_required) | 1 |

## 3. 正規化した主要スペック(すべて公式根拠)

| 軸 | 値 | 根拠source数 |
|---|---|---|
| weight_body | 6 kg | 1 |
| size_open | W520×D710×H1020 mm | 1 |
| size_folded | W320×D200×H480 mm | 1 |
| target_age | 生後6ヶ月〜約48ヶ月(取説上限は22kg到達まで) | 2 |
| max_load | 22 kg | 2 |
| basket_capacity | 耐荷重5 kg(容量Lは非公表) | 2 |
| folding_ease | **null(unconfirmed)** — 片手折りたたみの明記なし | 0 |
| self_standing | **null(unconfirmed)** | 0 |
| warranty | 正規販売店購入日から2年間(日本国内) | 1 |
| care_ease | ファブリックカバー30°C洗濯機洗い可 | 1 |
| included_accessories | フレーム・シートユニット・バスケット・サンキャノピー・ユーザーガイド | 1 |
| caution | 規定重量(22kg/5kg)超過禁止・2人乗車禁止 | 1 |
| newborn_ready | false(生後6ヶ月・一人すわりから) | 1 |
| price | **null(unconfirmed)** — 公式ページに価格表示なし | 0 |

## 4. 矛盾・不明点

- 公式情報内の**矛盾は検出していない**。公式ページ『approx. 4 years』と取説『22kgに達するまで』は上限の表現方法の違いであり、開始月齢6ヶ月は一致。
- 『hand luggage compatible(機内持ち込み対応)』は宣伝的表現として`manufacturer_claim`に分離。
- one-pull harnessの『片手で』はハーネス装着操作であり、folding_ease(片手折りたたみ)の根拠にしていない。
- モデル年2026とLibelle (2025)の関係は`irodori_inference`(clm-lib26-026)としてのみ導出(公式の後継明言は未確認)。

## 5. 検証結果

- validate-run.mjs: 全チェックPASS(契約検証・参照整合性・PDF公式到達経路・公式ドメイン限定・score/rank不存在)
