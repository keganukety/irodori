# ピジョン Runfee RB5(ランフィ RB5) 公式情報調査 — 調査要約

- run_id: `run-2026-07-16-pigeon-runfee-rb5-official`
- 調査日時: 2026-07-16 14:30〜16:15 JST
- 実行: claude-code(irodori-product-research → evidence-normalizer → intelligence の順)
- 使用情報源: **ピジョン公式のみ**(pigeon.infoブランドページ・ピジョン株式会社商品情報ページ・公式一覧ページ・公式サポート取説ページ)
- ランキング処理: **未実施**(ranking_input / ranking_result / score / 順位は作成していない)
- 位置づけ: 5商品公式ベンチマーク `benchmarks/stroller-official-5` の追加商品run

## 1. identity監査結果(provisional)

| 要素 | 値 | 根拠 |
|---|---|---|
| ブランド | ピジョン | 公式ブランドページ(src-rnf5-001) |
| 製造者 | ピジョン株式会社 | 商品情報サイト(products.pigeon.co.jp)の運営表記(src-rnf5-002) |
| 正式商品名 | Runfee RB5（ランフィ RB5） | 商品情報ページタイトル・一覧ページ |
| generation_code | **RB5** | 公式商品名に含まれる世代識別記号。model_year / model_numberへは昇格しない |
| モデル年 | null(未確認) | ピジョンはモデル年表記を用いず世代記号(RB5)で区別 |
| 対象市場 | JP(日本) | 日本公式サイト掲載・円建て価格・安全基準A形表記 |
| モデル共通型番 | null(未確認) | RB5はgeneration_codeとして分離し、型番とはみなさない |
| 確認済みvariant | キャメル 1042807 / ストーングレー 1042808(仕様同一性unverified) | 商品情報ページの商品コード欄 |

- lifecycle_status: `current`(公式一覧に掲載。販売終了品は【販売終了】表記で区別される)
- 公式商品URL: https://pigeon.info/stroller/runfee/
- 公式取扱説明書: https://support.pigeon.co.jp/manual/download-100.html の存在まで確認。**『同意してダウンロード』ゲートがあるため未取得(skipped)**
- model_number / model_yearが未確認のため`provisional`を維持

### ローカルproductsとの関連付け
ローカルproductsにランフィの登録候補が存在しないため、`site_product_id: null` / `site_product_match_status: "unmatched"`。

## 2. 作成した成果物

| ファイル | 内容 | 件数 |
|---|---|---|
| product-identity.json | product_identity | 1 |
| sources.json | source_record | 5(acquired 4 / skipped 1) |
| evidence-claims.json | evidence_claim | 19(fact 19 / inference 0 / conflicting 0) |
| normalized-features.json | normalized_feature | 14(値あり9 / 未確認5) |
| review-report.json | review_report(publication_status: review_required) | 1 |

## 3. 正規化した主要スペック(すべて公式根拠)

| 軸 | 値 | 根拠source数 |
|---|---|---|
| weight_body | 5.9 kg(ハグットシート除く) | 2 |
| size_open | W516×D890×H1030 mm(背面位最大。対面位W525×D1050はclaim保持) | 1 |
| size_folded | W516×D380×H1030 mm(H820-1030の最大値) | 1 |
| target_age | 生後1ヵ月〜36ヵ月 | 1 |
| max_load | **null(unconfirmed)** — 体重上限の明記なし(A形からの推定はしない) | 0 |
| basket_capacity | **25 L(容量表記)** — 他社は耐荷重kg表記のため定義差あり | 1 |
| folding_ease | true(『折りたたみは片手で1秒、ワンアクション』) | 1 |
| self_standing | **null(unconfirmed)** | 0 |
| warranty | **null(unconfirmed)** | 0 |
| care_ease | 洗濯機で丸洗い可 | 1 |
| included_accessories | **null(unconfirmed)** (ハグットシート付属は示唆のみのため保存しない) | 0 |
| caution | **null(unconfirmed)** — 取説未取得 | 0 |
| newborn_ready | false(生後1ヵ月から) | 1 |
| price | 67,100円(税込) | 1 |

## 4. 矛盾・不明点

- 公式情報内の**矛盾は検出していない**。展開時サイズの背面位/対面位は使用状態の違いであり、両方をclaimとして保持した。
- グッドデザイン賞受賞表記は`external_rank_metadata`にのみ保持(得点化しない)。
- 『2024年6月ピジョン調べ(n=528)』等の調査系比較表現は保存していない。

## 5. 検証結果

- validate-run.mjs: 全チェックPASS(契約検証・参照整合性・公式ドメイン限定・score/rank不存在)
