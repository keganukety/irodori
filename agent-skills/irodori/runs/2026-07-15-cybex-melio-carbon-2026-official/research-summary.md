# CYBEX Melio Carbon 2026 公式情報パイロット調査 — 調査要約

- run_id: `run-2026-07-15-cybex-melio-carbon-2026-official`
- 調査日時: 2026-07-15 15:34〜16:20 JST
- 実行: claude-code(irodori-product-research → evidence-normalizer → intelligence の順)
- 使用情報源: **CYBEX公式のみ**(日本公式サイト・公式ダウンロードセンター・日本向け公式取扱説明書)
- ランキング処理: **未実施**(ranking_input / ranking_result / score / 順位は作成していない)

## 1. identity監査結果(provisional)

| 要素 | 値 | 根拠 |
|---|---|---|
| ブランド | CYBEX | 公式商品ページ(src-melio26-001)・公式サイト全体 |
| 正式商品名 | Melio Carbon | 公式商品ページh1・ページタイトル(src-melio26-001) |
| モデル年 | 2026 | 公式ダウンロードセンター表記「Melio Carbon (2026)」(src-melio26-002、商品ページから直接リンク)。公式一覧で「Melio Carbon (2025)」と別商品として併載(src-melio26-004) |
| 対象市場 | JP(日本) | 日本公式ストアフロント(Sites-cybex-jp-Site)掲載、ダウンロードセンターに「日本 / Japan」バージョン、日本語取説(保証は日本国内のみ有効) |
| モデル共通型番 | null(未確認) | Cinnamon Yellowの商品コードをモデル型番から分離 |
| 確認済みvariant | Cinnamon Yellow / product_code 526000803 / 仕様同一性unverified | 公式商品ページの商品コード欄(src-melio26-001, clm-melio26-009) |

- lifecycle_status: `current`(公式JP一覧にNewバッジ付きで掲載)
- 公式商品URL: https://www.cybex-online.com/en/jp/p/st-go-melio-carbon-6.html
- 公式取扱説明書: discovery_page_url https://download.cybex-online.com/products/melio-2026 の日本向けrevision a(2026-02-06〜)から直接リンクされるPDF。direct_asset_urlは`src-melio26-003`へ保存し、`discovered_via_official_page: true`を保持

### 確認できなかったidentity項目
- manufacturer_name(製造者法人名) — 未確認(取説発行者はCTP JAPAN LIMITED)
- モデル全体に共通する型番、他カラーの商品コード、色違い間の仕様同一性
- 2025年モデルとの「後継」関係の公式明言(公式表記からのinferenceとして`clm-melio26-024`に記録。2025年identityレコード未作成のため`successor_of`はnull)

### ローカル商品ID 4との関連付け
`site_product_id: "4"` は維持し、`site_product_match_status: probable`とした。名称・ブランド・重量・モデル年の一致はあるが、モデル共通型番が未確認のため同一性をconfirmedにはしない。

## 2. 作成した成果物

| ファイル | 内容 | 件数 |
|---|---|---|
| product-identity.json | product_identity | 1 |
| sources.json | source_record | 4 |
| evidence-claims.json | evidence_claim | 26(fact 25 / inference 1 / conflicting 5、矛盾グループは1) |
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
| target_age | 候補値: 生後1ヶ月〜約36ヶ月(未解決矛盾のためevidence_status: conflicting) | 2 |
| max_load | 15 kg | 2 |
| basket_capacity | 耐荷重5 kg(公式は容量Lを非公表) | 2 |
| folding_ease | 片手折りたたみ可(boolean) | 1 |
| self_standing | 自立可(セルフスタンドモード時のみ) | 1 |
| warranty | 正規販売店購入日から2年間(日本国内のみ) | 1 |
| care_ease | ファブリックカバー30°C洗濯機洗い可 | 1 |
| included_accessories | フレーム・シートユニット・バスケット・バンパーバー・サンキャノピー・Newborn Nest・ユーザーガイド | 1 |
| caution | 規定重量(15kg/5kg/0.5kg)超過禁止 | 1 |
| newborn_ready | **null(conflicting)** — 相反する3claimを保持 | 2 |
| price | **null(unconfirmed)** — 公式ページに価格表示なし | 0 |

## 4. 矛盾・不明点

- **矛盾(conflicting)**: 公式商品ページの商品説明「from birth」(`clm-melio26-012`)は、同ページ仕様欄「From 1 month」(`clm-melio26-004`)および日本語取説の生後1ヶ月開始(`clm-melio26-014`)と矛盾。3claim、target_age、newborn_readyをconflictingとして保持し、安全側の人間向け要約だけをreview_report.editorial_notesへ分離した。
- 取説表題は「メリオ」でカーボン・年式の明記なし(match_status: probable、公式DCの直接リンクを紐付け根拠とする)。
- 公開日・更新日が確認できないページはnullとし、現在日で捏造していない。

## 5. editorial評価・ランキングについて

- 走行性・電車移動適性・ワンオペ適性などの主観的ordinal得点は**作成していない**(固定ルーブリック未承認のため0〜100点変換も未実施)。
- 宣伝的表現は`manufacturer_claim`として記録(例: from birth表現)。
- 1商品のみのためランキングは作成せず、`ranking_input` / `ranking_result` / score / 順位は存在しない。

## 6. 検証結果

- validate-run.mjs: 全チェックPASS(契約検証・参照整合性・公式到達経路・observed_score/score/rank不存在)
- `tsc -p agent-skills/irodori/tsconfig.json`: エラーなし
- 架空fixtureテスト(`node --test`): 既存15件 + 新規17件、計32 pass / 0 fail

## 7. 次段階(第三者レビュー・口コミ)へ進める状態か

公式source/claim基盤と監査契約は第三者レビュー工程へ引き渡せる。ただし、モデル共通型番と他カラー仕様同一性は未確認、取説matchはprobable、新生児対応はconflictingのまま。第三者レビュー・口コミの取得前に外部媒体の利用規約と引用運用の確認が必要。
