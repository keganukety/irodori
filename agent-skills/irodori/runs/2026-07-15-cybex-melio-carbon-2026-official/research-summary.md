# CYBEX Melio Carbon 2026 公式情報パイロット調査 — 調査要約

- run_id: `run-2026-07-15-cybex-melio-carbon-2026-official`
- 調査日時: 2026-07-15 15:34〜16:20 JST
- 実行: claude-code(irodori-product-research → evidence-normalizer → intelligence の順)
- 使用情報源: **CYBEX公式のみ**(日本公式サイト・公式ダウンロードセンター・日本向け公式取扱説明書)
- ランキング処理: **未実施**(ranking_input / ranking_result / score / 順位は作成していない)

## 1. identity確定結果(identified)

| 要素 | 値 | 根拠 |
|---|---|---|
| ブランド | CYBEX | 公式商品ページ(src-melio26-001)・公式サイト全体 |
| 正式商品名 | Melio Carbon | 公式商品ページh1・ページタイトル(src-melio26-001) |
| モデル年 | 2026 | 公式ダウンロードセンター表記「Melio Carbon (2026)」(src-melio26-002、商品ページから直接リンク)。公式一覧で「Melio Carbon (2025)」と別商品として併載(src-melio26-004) |
| 対象市場 | JP(日本) | 日本公式ストアフロント(Sites-cybex-jp-Site)掲載、ダウンロードセンターに「日本 / Japan」バージョン、日本語取説(保証は日本国内のみ有効) |
| 型番 | 526000803(Cinnamon Yellow) | 公式商品ページの「商品コード」欄(src-melio26-001) |

- lifecycle_status: `current`(公式JP一覧にNewバッジ付きで掲載)
- 公式商品URL: https://www.cybex-online.com/en/jp/p/st-go-melio-carbon-6.html
- 公式取扱説明書: 公式ダウンロードセンター https://download.cybex-online.com/products/melio-2026 の日本向けrevision a(2026-02-06〜)からリンクされるPDF(64ページ・日本語・Feb. 2026 ver. 1.0・CTP JAPAN LIMITED発行)

### 確認できなかったidentity項目
- manufacturer_name(製造者法人名) — 未確認(取説発行者はCTP JAPAN LIMITED)
- 他カラーの商品コード、色違い間の仕様同一性(variant整理は未実施)
- 2025年モデルとの「後継」関係の公式明言(公式表記からのinferenceとして`clm-melio26-024`に記録。2025年identityレコード未作成のため`successor_of`はnull)

### ローカル商品ID 4との関連付け
`site_product_id: "4"` を関連付けた。根拠: ローカル候補(メリオ カーボン 2026 / サイベックス / 5.9kg)と公式確定identity(Melio Carbon / CYBEX / 2026 / JP / 5.9kg)の全点一致。最終確定は人間レビューを要する。

## 2. 作成した成果物

| ファイル | 内容 | 件数 |
|---|---|---|
| product-identity.json | product_identity | 1 |
| sources.json | source_record | 4 |
| evidence-claims.json | evidence_claim | 24(fact 23 / inference 1 / conflicting 1) |
| normalized-features.json | normalized_feature | 14(値あり12 / 未確認2) |
| review-report.json | review_report(publication_status: review_required) | 1 |
| run-manifest.json | run_manifest | 1 |
| validate-run.mjs | 補助: 契約検証・参照整合性・情報源ポリシーの機械チェック | — |

## 3. 正規化した主要スペック(すべて公式根拠)

| 軸 | 値 | 根拠source数 |
|---|---|---|
| weight_body | 5.9 kg | 1 |
| size_open | W490 × D910 × H1070 mm(D820-910 / H965-1070の最大値。全範囲はclaimに保持) | 1 |
| size_folded | W490 × D590 × H290 mm(most compact) | 1 |
| target_age | 生後1ヶ月〜約36ヶ月(取説上限は体重15kg到達まで) | 2 |
| max_load | 15 kg | 2 |
| basket_capacity | 耐荷重5 kg(公式は容量Lを非公表) | 2 |
| folding_ease | 片手折りたたみ可(boolean) | 1 |
| self_standing | 自立可(セルフスタンドモード時のみ) | 1 |
| warranty | 正規販売店購入日から2年間(日本国内のみ) | 1 |
| care_ease | ファブリックカバー30°C洗濯機洗い可 | 1 |
| included_items | フレーム・シートユニット・バスケット・バンパーバー・サンキャノピー・Newborn Nest・ユーザーガイド | 1 |
| caution | 規定重量(15kg/5kg/0.5kg)超過禁止 | 1 |
| newborn_ready | **null(unconfirmed)** — 矛盾未解決 | 0 |
| price | **null(unconfirmed)** — 公式ページに価格表示なし | 0 |

## 4. 矛盾・不明点

- **矛盾(conflicting)**: 公式商品ページの商品説明「You can use this stroller from birth with the included Newborn Nest」(`clm-melio26-012`)は、同ページ仕様欄「From 1 month」(`clm-melio26-004`)および日本語取説「新生児期(生後28日)を過ぎた生後1ヶ月から」(`clm-melio26-014`)と開始時期が矛盾。source-policyの優先順位に従い取説・仕様欄を上位採用し、矛盾は相互参照付きで保持。
- 取説表題は「メリオ」でカーボン・年式の明記なし(match_status: probable、公式DCの直接リンクを紐付け根拠とする)。
- 公開日・更新日が確認できないページはnullとし、現在日で捏造していない。

## 5. editorial評価・ランキングについて

- 走行性・電車移動適性・ワンオペ適性などの主観的ordinal得点は**作成していない**(固定ルーブリック未承認のため0〜100点変換も未実施)。
- 宣伝的表現は`manufacturer_claim`として記録(例: from birth表現)。
- 1商品のみのためランキングは作成せず、`ranking_input` / `ranking_result` / score / 順位は存在しない。

## 6. 検証結果

- validate-run.mjs: 全チェックPASS(契約検証・参照整合性・公式ドメイン限定・score/rank不存在)
- `tsc -p agent-skills/irodori/tsconfig.json`: エラーなし
- 架空fixtureテスト(`node --test`): 15 pass / 0 fail

## 7. 次段階(第三者レビュー・口コミ)へ進める状態か

identity・公式スペック基盤は整った。ただし次へ進む前に、(1) 人間によるidentity・site_product_id関連付けの確認、(2) from birth矛盾の扱いの確認、(3) 外部媒体の利用規約確認(Open Decision #19)が必要。
