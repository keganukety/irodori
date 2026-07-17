# アップリカ カルーンエアー メッシュ AC 公式情報調査 — 調査要約

- run_id: `run-2026-07-16-aprica-karoon-air-mesh-ac-official`
- 調査日時: 2026-07-16 14:35〜15:30 JST
- 実行: claude-code(irodori-product-research → evidence-normalizer → intelligence の順)
- 使用情報源: **アップリカ公式のみ**(日本公式商品ページ・公式ベビーカー一覧ページ・公式取説ダウンロードページ)
- ランキング処理: **未実施**(ranking_input / ranking_result / score / 順位は作成していない)
- 位置づけ: 5商品公式ベンチマーク `benchmarks/stroller-official-5` の追加商品run

## 1. identity監査結果(provisional)

| 要素 | 値 | 根拠 |
|---|---|---|
| ブランド | アップリカ | 公式商品ページ(src-krnac-001) |
| 正式商品名 | カルーンエアー メッシュ AC | 公式商品ページのタイトル・見出し |
| generation_code | AC | 公式商品名末尾。model_year / model_numberへは昇格しない |
| モデル年 | null(未確認) | アップリカはモデル年表記を用いない。世代は末尾記号(AC)と発売時期2024年9月(clm-krnac-009)で区別 |
| 対象市場 | JP(日本) | 日本公式サイト掲載・円建て価格・製品安全協会A形SG合格品表記 |
| モデル共通型番 | null(未確認) | 品番はカラー別(BE 2206924 / GR 2206925)のためvariantへ分離 |
| 確認済みvariant | ベージュBE 2206924 / グレーGR 2206925(仕様同一性unverified) | 公式商品ページ品番/JANコード欄(clm-krnac-014) |

- lifecycle_status: `current`(公式一覧に掲載。販売終了製品は`/products/discontinued/`へ分離される構造)
- 公式商品URL: https://www.aprica.jp/products/babycar/detail/reversible_lw/karoonair_mesh_ac/
- 公式取扱説明書: ダウンロードページ https://www.aprica.jp/products/manual/ の存在まで確認。**利用規約同意ゲートがあるため未取得(skipped)**。規約はPDF直接リンクを禁止しているため直接URLも保存しない

### ローカル商品ID 5との関連付け
`site_product_id: "5"`(ローカル名「カルーンエアー メッシュ AC」)を`probable`とした。名称・ブランド・重量3.9kg・税込価格37,400円が一致するが、ローカル側に型番情報がなくモデル共通型番も未確認のためconfirmedにしない。

## 2. 作成した成果物

| ファイル | 内容 | 件数 |
|---|---|---|
| product-identity.json | product_identity | 1 |
| sources.json | source_record | 3(acquired 2 / skipped 1) |
| evidence-claims.json | evidence_claim | 18(fact 18 / inference 0 / conflicting 0) |
| normalized-features.json | normalized_feature | 14(値あり11 / 未確認3) |
| review-report.json | review_report(publication_status: review_required) | 1 |

## 3. 正規化した主要スペック(すべて公式根拠)

| 軸 | 値 | 根拠source数 |
|---|---|---|
| weight_body | 3.9 kg | 1 |
| size_open | W452×D817×H1007 mm | 1 |
| size_folded | W452×D311×H959 mm | 1 |
| target_age | 生後1カ月〜36カ月 | 1 |
| max_load | 15 kg | 1 |
| basket_capacity | 耐荷重5 kg(容量Lは未確認) | 1 |
| folding_ease | **null(unconfirmed)** — 片手折りたたみの明記なし | 0 |
| self_standing | **null(unconfirmed)** — 自立可否の明記なし | 0 |
| warranty | アップリカ ベビーカー3年保証(カテゴリ共通表記) | 1 |
| care_ease | シート洗濯機洗い可(30℃弱水流・ネット使用) | 1 |
| included_accessories | **null(unconfirmed)** | 0 |
| caution | CTS非対応・指定レインカバー使用 | 1 |
| newborn_ready | false(生後1カ月から) | 1 |
| price | 37,400円(税込・メーカー希望小売価格) | 1 |

## 4. 矛盾・不明点

- 公式情報内の**矛盾は検出していない**。
- 取扱説明書は同意ゲートのため未取得。折りたたみ操作・自立・同梱物・取説警告・保証書詳細条件が未確認。
- 『片手でかるがる持ち運び(折りたたみ時に限る)』は携行に関する宣伝表現として`manufacturer_claim`に分離し、folding_ease(片手折りたたみ)の根拠にしていない。

## 5. 検証結果

- validate-run.mjs: 全チェックPASS(契約検証・参照整合性・公式ドメイン限定・score/rank不存在)
