# Supabase・商品管理構造 差異監査（2026-07-17）

ランキング基盤の正本（`agent-skills/irodori/`）を将来Supabase・管理画面・公開サイトへ接続する前に、
正本データモデルと現行のDB・型・商品管理フローの差異を監査した記録。

- 監査基点commit: `6d8c2e86e1a2b45aabcfa67ba03d599789be0a45`（監査時点の`origin/main`最新と一致）
- 本監査は**調査・分析のみ**。migration・schema変更・型変更・商品データ修正・管理画面修正・サイトUI修正は一切行っていない。
- 表現区分はリポジトリ共通ルールに従う: **[C] Confirmed** / **[P] Proposed（提案）** / **[O] Open Decision** / **[U] Unverified（未確認）**。
- 配置理由: `source-audits/` は外部媒体の利用監査専用、`runs/` は商品調査run専用、`benchmarks/` はベンチマーク成果物専用であり、
  内部DB構造監査の置き場が存在しなかったため、日付ディレクトリ慣例に合わせて `audits/<date>-<topic>/` を最小新設した。

---

## 1. 監査概要

正本は「出典へ戻れる証拠モデル」（identity → source → claim → normalized feature → ranking入力）を
12契約・schema 0.4.0 として持つ。一方、現行Supabaseは「公開表示用の1商品1行モデル」であり、
**証拠・出典・単位・measurement scope・unknown/false/0の区別・variant同定・conflictを保持する構造がほぼ存在しない**。

最重要の構造的事実は次の3点。

1. **`public.products` テーブル本体を作成するmigrationがリポジトリに存在しない**（先在テーブル。型・制約・RLS・anon権限がコードから検証不能）[C]
2. **仕様カラム追加SQL（`supabase/product-specifications-migration.sql`）が `supabase/migrations/` 外に置かれ、適用状態が確定できない** [C]（適用済みか否かは [U]）
3. **正本の証拠モデル（source_record / evidence_claim / normalized_feature / conflict / coverage / confidence）に対応するテーブルが一切ない** [C]

結論: 既存productsテーブルへ正本フィールドを「書き足す」接続は、measurement scope・単位・unknownの区別を
確実に失う。**ランキング用データは別系統テーブル群として新設し、`site_product_match_status` 経由で
既存productsと疎結合に対応付ける**のが、既存データを壊さない唯一の段階移行経路である（→ §18）。

## 2. 調査対象と対象外

**対象**: `agent-skills/irodori/`（shared/contracts, shared/references, runs/5商品, benchmarks/stroller-official-5, irodori-ranking-engine）、
`supabase/`（migrations 15件・seeds 3件・checks・product-specifications-migration.sql）、
`src/`（types.ts, product.ts, compare.ts, main.ts, home.ts, brand.ts, admin.ts, affiliateAdmin.ts, data/fallback-products.ts）、`docs/` の関連文書。

**対象外**: 外部サイト再調査（実施せず）、Supabase本番インスタンスの実データ（**本番値は未確認**）、
アセット管理（site_assets等。商品データ境界の確認のみ）、score計算・順位作成（禁止事項）。
Codex感度分析（`codex/irodori-ranking-sensitivity`）はブランチが`origin/main`と同一commit・未コミット変更なしのため**照合対象が存在しない**（→ §20）。

## 3. 正本のデータモデル（サブエージェントA監査の要約）

- 正本の階層: 人間向け正本 = `shared/references/*.md`、機械正本 = `shared/contracts/types.ts` + `validators.ts`、
  決定論的計算 = `irodori-ranking-engine/`。`CONTRACT_SCHEMA_VERSION = "0.4.0"`、`CALCULATION_VERSION = "calc-train-prototype-0.2.0"`（types.ts:6-7）。
- **ProductIdentity**（types.ts:289-314）: `pid-<slug>`。brand + 正式商品名 + model_year + market + model_number で同定。
  `model_year: number|null`（推測禁止）、`identification_status`（identified/provisional/unidentified）、
  `unconfirmed_fields[]`（null項目の明示列挙を強制、validators.ts:464-469）、
  `site_product_match_status` + `site_product_id`（既存サイト商品との対応、0.3.0+必須）、
  `variants[]`（ProductVariant: variant_id / color_name / product_code / specification_equivalence_status / supporting_claims[]）。
  variant_code≠model_number の検証あり（validators.ts:444-446）。
- **SourceRecord**（types.ts:349-389）: 1情報源1レコード・URL必須。日付3種（published/updated/accessed）+ date_kind_note。
  `source_type`（official_spec〜unknown の12値）、`commercial_relation`、`external_rank_metadata`（得点化禁止）、
  0.4.0+で取得・著作権・PII・法務メタデータ必須。本文転載フィールドは保存禁止（validators.ts:695-702）。
- **EvidenceClaim**（types.ts:423-442）: 1 source→n claim。`value_raw` / `value_normalized` / `unit` / `measurement_condition` /
  `claim_class`（official_spec/manufacturer_claim/manual_safety/third_party_measured/editorial_opinion/…/irodori_inference/unknown）/
  `fact_or_inference`（inferenceは`derived_from[]`必須）/ `evidence_status` / `conflict_with[]` / `duplicate_of` / `reliability`。
- **NormalizedFeature**（types.ts:444-456）: 商品×軸で1件。`value(null可)` / `unit`（数値・寸法は必須、寸法はmm固定）/
  `value_kind` / `supporting_claims[]` / `evidence_status` / `independent_source_count` / `normalization_notes`。
  未確認軸 = value:null + unconfirmed + claims:[] + count:0、矛盾軸 = value:null + conflicting + claims≥2（validators.ts:827-858）。
- **評価軸**（terminology.md §5）: `weight_body` / `size_open` / `size_folded`（W/D/H mm構造化）/ `target_age`（月の範囲）/
  `max_load`(kg) / `price`(円) / `basket_capacity`（**number(L) または text**）/ ordinal軸（maneuverability, folding_ease等）/ boolean軸（self_standing等）。
  別名は `canonicalizeAxisId` で解決（例 included_items→included_accessories、validators.ts:97-99）。
- **ranking入力境界**: `RankingExecutionBundle`（definition + input + identities + sources + claims + features + review_summaries、types.ts:839-847）。
  未確認軸は0点化せず除外し評価済みweightで再正規化（observed_score）。`data_coverage`（軸数）と `weighted_data_coverage`（weight）を分離。
  `input_hash`（SHA-256）で入力から出典まで遡れる。
- **popularity分離**: `RakutenRankingSnapshot` は `ranking_score_impact:"none"` 固定・`quality_score_input_fields:[]`（空必須）で、
  RankingExecutionBundle に**含まれない**（別バンドル `ExternalSourceValidationBundle`）。構造的に品質scoreと分離済み [C]。
- **正本に存在しない概念（重要）**: (a) **A形/B形の構造化フィールド**（claimテキストと安全基準claimのみ。軸一覧にも無い）、
  (b) **missing reason の専用enum**（value:null + evidence_status + normalization_notes自由文 + identity側unconfirmed_fields[]で表現）、
  (c) measurement scope の統制語彙（`measurement_condition`は自由文字列、scope詳細は`normalization_notes`に散在）。
  これらをDB設計時にどう扱うかは正本側拡張の**提案**として §19 に記載。

## 4. 現在のSupabaseモデル（サブエージェントB監査の要約）

- **`products`**: 先在テーブル（作成migrationなし）。migration/seed/TSから確認できたカラム:
  `id`（型は環境依存で動的検出設計 [U]）、`name/brand/category/product_type/target_age/applicable_weight/product_size/folded_size`（text）、
  `weight_kg`（数値）、`load_capacity`（text、値例 '22kgまで'）、`price_yen`、`rank_no`（nullable数値・editorial手動順位）、
  `memo`（text・管理メモ）、`spec_source_url` / `official_url`（text）、`spec_checked_date`（date）、
  `feature_tags`（**text/text[]どちらか環境依存** — 20260621110000:56-78）、`brand_id`（uuid FK→brands, on delete set null）、
  affiliate 6カラム（20260629000000）、`image_url`。
- **`product-specifications-migration.sql`**（migrations/外・適用状態 [U]）: `product_size/folded_size/applicable_weight/load_capacity/basket_capacity/included_accessories/warranty/manufacturer_country/caution_notes/model_number` の10カラム（全てtext・nullable・default無し）を追加する内容。
  ただし `20260621110000` が `product_size` 等を既に前提としてupdateしており、**一部カラムは別経路で先在または手動先行適用**（[U]・推測）。
  `supabase/checks/` はaffiliate系のみ検証し、この10カラムは非対象。
- **`brands` / `brand_aliases` / `product_colors`**: migrationで正式管理（20260619000000）。product_colorsは
  名前・swatch・表示順・is_defaultのみの**表示用**で、product_code・仕様同等性を持たない。
- **`product_affiliate_images` / `rakuten_affiliate_shop_settings`**: 楽天由来データ（画像・リンク・shop設定）を隔離。
  売上・レビュー数等の自動人気指標カラムは確認範囲に存在しない [C]。
- **TypeScript型**: `src/types.ts:6-10` の `Product` は `{ id, name?, [key: string]: unknown }` の緩い型。
  `product.ts` / `compare.ts` / `main.ts` / `home.ts` が各々ローカルProduct型を再定義し、
  1表示項目に複数カラム別名を許容（例: 耐荷重 ← load_capacity / max_weight_kg / load_capacity_kg / max_load / max_weight、product.ts:507-543）。
- **管理画面**: products本体への書込みは `update_product_affiliate_urls` RPC（affiliate 7項目+商品名）のみ（affiliateAdmin.ts:383-391）。
  **仕様カラム（サイズ・重量・月齢・耐荷重・バスケット・付属品・保証・品番）を編集できるUIは存在しない** [C]。SQL直書き運用。
- **公開取得**: RPCではなく `select('*')` 直接取得（main.ts:259, product.ts:171, compare.ts:99, home.ts:300-305）。
  productsのRLS・anon権限はmigration外のため**列制限の有無が検証不能**（`memo`等の管理メモがanonへ到達し得る）[U]。

## 5. 現行データフロー

```text
管理画面(affiliate項目のみ) / SQL直書き(仕様・seed)
  → TypeScript緩い型（インデックスシグネチャ）
  → 保存時変換: 空文字→null(affiliate RPCのみ)。仕様カラムはvalidation無し
  → Supabase products 1行
  → select('*')（RPC境界なし・列制限不明）
  → 各ページのローカルProduct型（別名カラム探索）
  → 表示変換: kg後付け(appendUnitIfNeeded)・cm補完・boolean→「可/不可」・
    空/『不明』/『未登録』/『要確認』含みは非表示(isPresentSpecValue, isManagementMemo)
```

各境界で失われるもの [C]:

| 境界 | 失われる情報 |
|---|---|
| 入力→保存 | unit（textへ埋め込み任せ）、measurement scope、source（1URL1日付のみ）、evidence、conflict、variant、model year（name埋め込み）、raw/normalized区別 |
| 保存→取得 | なし（select * だが、そもそも保存されていない） |
| 取得→表示 | null と「非該当」の区別（非表示化）、単位の由来（自動付与）、boolean null/false区別（「不可」断定）、注意事項の「要確認」含み文（丸ごと非表示） |
| 表示 | spec_source_url / spec_checked_date は未参照 = 出典・鮮度が利用者に見えない |

## 6. 正本とSupabaseのフィールド対応表

凡例 — 対応状態: **EM**=Exact match / **NM**=Name mismatch only / **TM**=Type mismatch / **UM**=Unit mismatch /
**SM**=Scope mismatch / **VM**=Variant mismatch / **PS**=Partial support / **ET**=Stored as editorial text /
**MS**=Missing in Supabase / **PX**=Present in Supabase but absent from evidence model / **UK**=Unknown due to insufficient repository evidence / **NA**=Not applicable。
管理画面入力先「—」= 入力UIなし（SQL直書きのみ）。公開取得先は全て `select('*')` 経由。

### 6.1 Identity / Variant

| 正本フィールド | 正本の型 | nullable/missingの意味 | unit | scope | Supabase保存先 | DB型 | 管理画面 | 公開取得 | 対応 | 損失リスク | ranking影響 | 推奨対応 | 優先度 | 根拠 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| product_identity_id (`pid-<slug>`) | string | 不可 | — | — | products.id（意味論なし） | 環境依存 [U] | — | 全ページ | PS+UK | identity粒度（年式・市場）がidに無い | score対象の取り違え | identityテーブル新設+site_product_id対応 | **P0** | types.ts:289 / 20260629000000:53-62 |
| official_name / brand_name | string | 不可 | — | — | name(+product_name/title併存) / brand + brand_id | text / uuid FK | affiliate RPCのみ(name系3列同時書込) | 全ページ | PS | name系3列の不整合 | identity照合の曖昧化 | 正本→表示名の単方向同期 | P1 | 20260629000100:76-93 |
| manufacturer_name | string\|null | null=未確認(unconfirmed_fields記載) | — | — | なし（brandと未分離） | — | — | — | MS | 発売元/製造元の区別喪失 | 小 | identityテーブルで保持 | P2 | types.ts:292 |
| model_number | string\|null | null+unconfirmed_fields | — | — | products.model_number（適用状態[U]） | text | — | product.ts:543 | PS+UK | **variantのproduct_codeが品番へ混入**（正本は5商品全てmodel_number=null） | variant取り違え | 品番とvariant codeを別カラムで管理 | **P0** | validators.ts:444-446 / spec-migration:15 |
| model_year | number\|null | null=未確認（推測禁止） | 年 | — | なし（name「…2026」埋め込みのみ） | — | — | — | ET | 年式改定時に別商品と区別不能 | 年式違いを同一score対象化 | identityテーブルの専用カラム | **P1** | types.ts:295 / seed cybex |
| generation_code (AC/LA/RB5) | string\|null | null | — | — | なし（name埋め込み） | — | — | — | ET | model_yearへの誤昇格 | 世代混同 | identityで分離保持 | P1 | product-identity-rules.md §4 |
| market (JP/overseas/unknown) | enum | unknownが正値 | — | — | なし | — | — | — | MS | 海外仕様値の混入検出不能 | 別市場値でscore汚染 | identityで保持 | P1 | types.ts:299 |
| lifecycle_status | enum | unknownが正値 | — | — | なし（fallbackにavailability_statusの残骸のみ） | — | — | — | MS | 廃番品の順位掲載 | 中 | identityで保持 | P2 | fallback-products.ts |
| identification_status / unconfirmed_fields[] | enum / string[] | — | — | — | なし | — | — | — | MS | 同定確度が消える | provisional商品の確定score化 | identityで保持・publication gate化 | **P1** | validators.ts:452-469 |
| ProductVariant (color/product_code/spec_equivalence) | object[] | 空配列可 | — | — | product_colors（名前・swatch・表示順のみ） | uuid/text | admin.ts色管理 | product.ts | **VM** | product_code・仕様同等性(unverified含む)が保持不能 | **色違い≠仕様同一の未検証variantを同一score扱い** | variantテーブル拡張or新設（equivalence_status必須） | **P0** | types.ts:280-287 / 20260619000000:89-116 |
| category | string | 不可 | — | — | products.category / product_type | text | — | 全ページ | PS | slugがmain.tsハードコード（Open Decision #4） | scenario分類の基盤不安定 | slug管理方式の決定 | P2 | types.ts:304 |
| A形/B形 | **正本に構造化フィールドなし**（claimテキストのみ） | — | — | 安全基準 | なし | — | — | — | MS（両側） | A/B判定が再現不能 | **scenario分離（絶対条件）が実装不能** | 正本へ分類軸を追加提案+claim裏付け必須 | **P1** | terminology.md §5（軸一覧に無し）/ 各run evidence-claims |

### 6.2 Source / Evidence

| 正本フィールド | 正本の型 | nullable/missing | unit | scope | Supabase保存先 | DB型 | 管理画面 | 公開取得 | 対応 | 損失リスク | ranking影響 | 推奨対応 | 優先度 | 根拠 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SourceRecord（1情報源1レコード・URL必須） | object | target_product null=隔離 | — | — | products.spec_source_url（1商品1URL） | text | — | 未表示 | **TM/PS** | **n出典→1URLへ縮退。出典へ戻れない** | 順位→出典遡及（ranking-principles §6）が不能 | source_recordsテーブル新設 | **P0** | types.ts:349 / spec運用 |
| 日付3種+date_kind / accessed_date | date×3 | 不明日付はnull+note | — | — | spec_checked_date（1個・意味未分化） | date | — | 未表示 | PS | published/accessed混同 | 鮮度評価不能 | source_recordsで保持 | P1 | types.ts:354-357 |
| source_type(12値) / commercial_relation / reliability | enum | unknownが正値 | — | — | なし | — | — | — | MS | 公式/宣伝/実測/推論の区別喪失 | manufacturer_claimの事実昇格 | claims/sourcesテーブル | **P0** | source-policy.md |
| EvidenceClaim（value_raw/value_normalized/claim_class/fact_or_inference/derived_from） | object | value_normalized null可 | claim毎 | measurement_condition | なし | — | — | — | **MS** | raw値と正規化値の系譜が消える | evidence trace不能=score根拠喪失 | evidence_claimsテーブル新設 | **P0** | types.ts:423-442 |
| conflict_with[] / duplicate_of | string[] | conflictingは1件以上必須 | — | — | なし | — | — | — | MS | 未解決conflictを保持できず片方が勝つ | Melio新生児対応が暗黙確定される | claimsテーブル+feature status | **P1** | types.ts:437-440 |
| external_rank_metadata / SourceUsageAudit | object | — | — | — | なし | — | — | — | MS | （現状混入も無いため実害小） | 得点化禁止の検証根拠 | 第三者媒体接続時に新設 | P2 | types.ts / source-audits |

### 6.3 Normalized Feature（物理仕様）

| 正本フィールド | 正本の型 | nullable/missing | unit | scope | Supabase保存先 | DB型 | 管理画面 | 公開取得 | 対応 | 損失リスク | ranking影響 | 推奨対応 | 優先度 | 根拠 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| weight_body | number\|null | null=未確認（0にしない） | kg | 付属品除く等をnotesに保持 | products.weight_kg | numeric | — | product.ts:530(kg後付け) | **SM** | 「ダッコシート除く4.6kg」「ハグットシート除く5.9kg」のscope喪失 | **scope違いの重量を同列比較** | feature行にscope列を分離保持 | **P0** | runs combi/pigeon / 20260621110000:11 |
| size_open (Dimensions W/D/H mm固定) | 構造化寸法 | null=未確認 | mm | 背面/対面・範囲最大等 | products.product_size | text自由記述 | — | product.ts:507- | **TM+UM+SM** | 数値・単位(cm混在)・測定順序・向きが自由文字列化 | 改札幅等の数値比較が不能 | 構造化(W/D/H+scope)で別テーブル | **P0** | terminology.md §5 / spec-migration:6 |
| size_folded | 同上 | 同上 | mm | 3方向折り等 | products.folded_size | text | — | product.ts | **TM+UM+SM** | 同上 | 同上 | 同上 | **P0** | 同上 |
| basket_capacity | **number(L)またはtext** | null=未確認 | **kg(耐荷重)とL(容量)が商品により異なる** | 耐荷重/容量の区別 | products.basket_capacity（単一text・適用状態[U]） | text | — | product.ts:535 / compare.ts:368 | **UM** | **4商品=5kg耐荷重、Runfee=25L容量が同一列・同一比較行に並ぶ** | kg/L混同（絶対条件違反）・換算誘発 | 値+unit+scope種別(load/volume)を別カラム保持・換算禁止 | **P0** | 各run nf-*-basket_capacity / normalization_notes |
| target_age (Range{min,max}月) | Range | null=未確認 | month | 条件付き範囲（Newborn Nest等） | products.target_age | text | — | product.ts:533 | TM | 複数範囲・条件が1文字列へ | conflict保持不能（Melio） | 範囲構造+条件を別保持 | **P1** | types.ts Range / runs melio |
| max_load / applicable_weight | number\|null | null=未確認（推定禁止: Runfee） | kg | 体重上限vs積載の区別 | products.load_capacity / applicable_weight | text | — | product.ts:531「耐荷重」表示 | **SM** | seedでは子の体重上限を「耐荷重」ラベル表示（意味ズレ） | 軸の意味取り違え | 語彙を正本max_load定義へ統一 | **P1** | hipseat seed / terminology §5 |
| price | number\|null | null=未確認 | 円(税込/税別併記) | 時点 | products.price_yen | numeric | — | formatPrice | PS | 0/null/取得失敗が「価格未登録」へ縮退。税区分・時点なし | 価格軸のunknown/0混同 | 時点付きprice保持 | P1 | product.ts:956-961 |
| boolean軸 (newborn_ready/self_standing) | boolean\|null | **null(未確認)とfalse(確認済み非対応)を区別** | — | — | features jsonb 内boolean | jsonb | — | 「可/不可」変換 | **TM** | **null→表示スキップ、false→「不可」だがDB上はnull/false/未設定の3状態が2状態へ** | unknown→false変換（絶対条件違反） | evidence_status付きfeature行 | **P0** | product.ts:574 / runs newborn_ready |
| ordinal軸 (maneuverability等) | ordinal | 第三者実測まで採点しない | — | 測定条件必須 | なし | — | — | — | MS | — | 早期採点の誘惑 | 第三者実測導入まで作らない | P3 | terminology §5 |
| evidence_status / independent_source_count / normalization_notes | enum/int/string | unconfirmed/conflictingが正値 | — | — | なし | — | — | — | **MS** | **「値がない」=null/空文字のみで、未確認/矛盾/非該当が区別不能** | unknown・false・0の混同（絶対条件違反） | feature行に必須列化 | **P0** | validators.ts:827-858 |
| included_accessories | 軸あり(included_items別名) | null=未確認 | — | — | products.included_accessories（適用状態[U]） | text | — | product.ts | PS | 個数・種別が自由文字列 | 小 | 現状維持可（editorial寄り） | P2 | validators.ts:97-99 / spec-migration:11 |
| warranty / manufacturer_country / caution_notes | **正本の評価軸に存在しない** | — | — | — | products該当カラム（適用状態[U]） | text | — | product.ts | **PX** | caution_notesへ調査メモ混入（§9） | raw/editorial混在 | 公開editorial専用と明記・調査メモ分離 | P1 | spec-migration:23-25 / hipseat seed |

### 6.4 Coverage / Confidence / Conflict / Ranking / Popularity

| 正本フィールド | 正本の型 | nullable/missing | Supabase保存先 | 管理画面 | 公開取得 | 対応 | 損失リスク | ranking影響 | 推奨対応 | 優先度 | 根拠 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| data_coverage / weighted_data_coverage | number 0-1 | 未算出=レコード無し | なし | — | — | MS | — | coverage閾値(proposed 0.7/0.75)の判定不能 | ranking_result系テーブルで保持 | **P1** | types.ts:759-760 |
| confidence (confidence-proposed-v1) | number 0-1 | 同上 | なし | — | — | MS | — | 確度表示不能 | 同上 | **P1** | types.ts:664-672 |
| conflict（feature単位の未解決保持） | status+相互参照 | value:null+conflicting | なし | — | — | MS | 片側値の暗黙採用 | Melio target_age/newborn_readyの誤確定 | claims+features新設で自然解決 | **P1** | evidence-model.md §4 |
| scenario eligibility / scene_tag | RankingDefinition.scope | — | なし（stroller-guideハードコード） | — | — | MS | A形/B形scenario分離が再現不能 | 不適合=0点化の誘発（絶対条件違反） | definition保存時にeligibilityを構造化 | **P1** | types.ts:693-694 / rubric-proposal |
| RankingDefinition/Input/Result + input_hash | 12契約 | proposedのまま | なし | — | — | MS | — | 再現性(SHA-256遡及)の保存先なし | ranking系テーブル新設（接続後段） | P1 | types.ts:689-847 |
| products.rank_no | （正本に対応なし・editorial手動順位） | nullable | products.rank_no | — | home.ts:303「ランキング1位」表示 | **PX** | **editorial順位と将来のquality scoreの混同** | quality/popularity/editorialの3系統が1列に見える | rank_noは当面変更禁止(Open Decision #15)・新score系と並走分離 | **P1** | 20260621110000:19-22 / home.ts:1201 |
| RakutenRankingSnapshot / market_demand_signal | 別バンドル隔離 | TTL付き | product_affiliate_images（画像・リンクのみ。人気指標カラムなし） | admin.ts | product.ts | NA〜PS | feature_tags『売れ筋』等のタグ・コピーにテキストレベル混在 | 品質scoreへの混入経路は現状なし [C] | snapshot導入時は専用テーブル+TTL | P2 | 20260621000000 / hipseat:150-151 |
| editorial（catch_copy/summary/editorial_notes） | ReviewReport.editorial_notes等で分離 | — | catch_copy/summary/memo/caution_notes | — | product.ts | PS | §9のとおりraw混在 | raw/derived/editorial混在（絶対条件違反） | editorial専用カラムの純化 | **P0**(混在解消) | hipseat seed |

## 7. 5商品ごとの差異（現行Supabaseへ保存した場合に失われるもの）

**共通の前提**: 本番DBの実レコードはリポジトリから確認できないため、seed・migration・コード・fallbackのみを根拠とする。**本番値は未確認** [U]。
5商品とも正本では `identification_status: provisional`・`model_number: null`（型番はvariantのproduct_codeのみ）。
確定score・順位は正本側にも存在しない（設計どおり）。

| 確認項目 | Melio Carbon 2026 | カルーンエアー AC | スゴカル LA | Runfee RB5 | Libelle 2026 |
|---|---|---|---|---|---|
| site対応 | id"4" probable | id"5" probable | id"3" probable | **unmatched（対応行なしの可能性）** | id"7" probable |
| identity一意性 | name「メリオ カーボン 2026」頼み | 世代AC がname埋め込み | 世代LA がname埋め込み | 行自体が無い可能性 | name「リベル 2026」頼み |
| model year | **name埋め込みのみ**（2026） | null（ACを年式と誤認する危険） | null（同左） | null | name埋め込みのみ（2026） |
| A形/B形 | 分類claim無し(2-in-1)→保存先なし | A形(SG合格)→保存先なし | A型(取説)→保存先なし | A形(両対面)→保存先なし | B型→保存先なし |
| variant | 1色(unverified)→product_colorsでは同等性unverifiedを表現不能 | 2色(unverified)同左 | 3色(unverified)同左 | 2色(unverified)同左 | 1色(unverified)同左 |
| 重量scope | 5.9kg(条件記載なし)→weight_kgで可だがscope列なし | 3.9kg単一値→可 | **4.6kg「ダッコシート除く」→scope喪失** | **5.9kg「ハグットシート除く本体」→scope喪失** | 6kg。**ローカル6.3kgと不一致（identity-review記録・本番値未確認）** |
| 展開/収納size | 範囲最大採用の注記が消える | 452×817×1007等→text化で順序・単位喪失 | 可変範囲の注記が消える | **背面位/対面位の区別が消える** | 3方向折り320×200×480→text化 |
| basket | 5kg耐荷重→text列でLと同列化 | 5kg耐荷重→同左 | 5kg耐荷重→同左 | **25L容量→kg列と同一比較行「バスケット容量」に並ぶ（compare.ts:368）** | 5kg耐荷重→同左 |
| 対象月齢・体重 | **target_age {1,36} conflicting → text化で矛盾が消え確定値に見える** | {1,36}→text化 | {1,36}→text化 | {1,36}。**max_load null（推定禁止）→ 空文字/0化の危険** | {6,48}・22kg→text化 |
| source別claim | 4 source・26 claim→spec_source_url 1本へ縮退 | 縮退 | 縮退 | 2 source重量→独立ソース数消失 | 縮退 |
| conflict保持 | **newborn_ready null+conflicting → features booleanではnull/false区別不能。「from birth」vs「1か月から」が暗黙解決される** | なし | 価格48,000 vs ローカル32,000の不一致（未解決のまま保持する場所なし） | なし | 重量6 vs 6.3の不一致（同左） |
| confidence/coverage | 未算出（設計どおり）だが将来の保存先なし | 同左 | 同左 | 同左 | 同左 |
| unknown保持 | price null→「価格未登録」（0・取得失敗と同表示） | folding_ease null→非表示 | 同左 | max_load null→非表示（欠損理由消失） | price null→「価格未登録」 |

## 8. identity・variant問題

1. **identityテーブル不在**: products.id は表示用の連番/任意IDで、brand+name+model_year+market+model_number の同定粒度を持たない。
   Runfee は site unmatched であり、**現行productsに行が無いまま接続すると誰かが手で行を作る＝identity管理外の商品行が発生**する。
2. **model_year のname埋め込み**: 「メリオ カーボン 2026」。2027年モデル登場時に同名更新か別行かの規則がなく、
   正本の「年式違いは別identity」を再現できない。
3. **variant**: product_colors は色名とswatchのみ。正本の `product_code`（例 Cinnamon Yellow `526000803`）、
   `specification_equivalence_status`（5商品全色 unverified）を保持できず、**「仕様同一と未検証の色違い」を区別なく同一商品として扱う**。
   また products.model_number カラムへvariantのproduct_codeが入力される事故を防ぐ制約がない（正本はvariant_code≠model_numberを検証する）。
4. **brand**: brands/brand_aliases は良好（35ブランド・別名正規化unique index）。正本のbrand_name照合に転用可能 [C]。

## 9. raw・derived・editorial問題

- `memo`: seedが `source_note + spec_note`（調査メモ=raw系譜情報）を結合格納し、かつ product.ts:539 が
  `memo` を公開「注意事項」候補に含む。**管理メモと公開editorialが同一カラム・同一表示経路**。
- `caution_notes`: comment上は「公開用」だが、seedでは source_note（「公式で価格・仕様確認。価格は2026-06-27確認時点」）を格納。
- `features` jsonb: 構造化キー（washable等）と自由記述注記（weight_note, load_test_note「試験34kgクリア。表示は推奨15kg」）が混在。
  後者は **raw値をeditorial判断で上書きした記録**であり、正本なら claim(third_party相当)+editorial_notes に分離すべき情報。
- `rank_no`: editorial手動順位。正本の観点では editorial値だが、公開側で「ランキング1位」と表示され、
  将来のquality scoreと同じ「順位」の顔をする（§16）。
- 正本側は claim_class / fact_or_inference / derived_from / editorial_notes で三層を構造分離しており、
  **混在は専らSupabase/seed側の問題** [C]。

## 10. unit・measurement scope問題

- **basket**: 正本は「4商品=耐荷重kg / Runfee=容量25L」を unit フィールドと normalization_notes で区別し、
  換算せず比較不能性を明示。Supabaseは `basket_capacity` 単一text列で、compare.ts の「バスケット容量」行に
  '5kg' と '25L' が同列表示される（単位が文字列に残るのが唯一の防壁）。**数値化した瞬間に混同が確定する**。
- **重量**: weight_kg は数値のみ。スゴカル「ダッコシート除く」、Runfee「ハグットシート除く本体」のscopeを持てない。
  表示側 `appendUnitIfNeeded` は数値に無条件で「kg」を付ける。
- **寸法**: 正本はmm固定のW/D/H構造化+測定条件（背面位/対面位、範囲最大採用）。Supabaseはtext自由記述で、
  cm/mm・記載順・向きが商品ごとに揺れても検出できない。
- **耐荷重の意味ズレ**: seedは子の適応体重上限を load_capacity に格納し「耐荷重」ラベルで表示。
  正本 `max_load`（対応体重・耐荷重）と `applicable_weight` の語彙統一が必要。

## 11. unknown・false・0問題

| 状態 | 正本の表現 | 現行Supabase+表示での帰結 |
|---|---|---|
| 未確認(unknown) | value:null + evidence_status:unconfirmed + claims:[] + count:0 + notes理由 | null/空文字 → 行ごと非表示 or「価格未登録」。**理由・状態が消える** |
| 確認済み非対応(false) | value:false + confirmed（例 newborn_ready） | features jsonb boolean →「不可」表示。**未設定(null)との区別はDB上曖昧** |
| 数量ゼロ(0) | 正本では不明を0にしない（0の実例なし） | price 0 →「価格未登録」＝**0とnullが同一表示** |
| 矛盾(conflicting) | value:null + conflicting + claims≥2 | 表現不能。**いずれかの値が入り確定値に見える** |
| 管理上の要確認 | evidence_status + 人間レビュー | 注意事項に「要確認」を含むと isManagementMemo で**丸ごと非表示＝「注意事項なし」に見える** |

## 12. source・evidence問題

- 正本: 1情報源1 source_record（URL必須・日付3種・source_type 12値・商業的関係・取得/著作権/PIIメタデータ）、
  1 source→n evidence_claim、claim→normalized_feature の supporting_claims 遡及、SHA-256 input_hash。
- Supabase: `spec_source_url`（1商品1URL）+ `spec_checked_date`（意味未分化の1日付）のみ。**公開表示にも未使用**。
- 帰結: Runfee重量の「独立2ソース確認」、Melioの「manufacturer_claim vs manual_safety」の区別、
  claimからの出典遡及がすべて保存不能。ranking-principles §6「順位から出典まで遡れること」が
  現行構造のままでは**接続した時点で違反確定**。

## 13. coverage・confidence・conflict問題

- coverage 2種（軸数/weight）・confidence は未算出（実在商品のranking入力を作らない方針のため）だが、
  **将来算出しても保存先が存在しない**。閾値（proposed 0.7 / 0.75）判定・「充足率不足で圏外」の再現に必須。
- conflict は feature status として保持する設計（value:null + conflicting）。現行productsは1値1列のため、
  未解決conflict（Melio新生児対応、Combi価格差、Libelle重量差）を**未解決のまま**置く場所がない。
- 公式値とローカルproducts値の既知不一致（Combi 48,000 vs 32,000円、Libelle 6 vs 6.3kg）は
  identity-review.md に記録済み。**本番値の実測確認と、どちらを表示するかの解決手続きが未定義** [U]。

## 14. 管理画面の入出力問題

- 仕様カラムの入力UIが存在しない（affiliate項目と画像・色・表示順のみ）。仕様はSQL直書き運用で、
  **単位・scope・出典の検証なしに任意textが入る**。
- `update_product_affiliate_urls` は name/product_name/title 3列同時上書き。identity管理と無関係に表示名が変わる。
- reviewerが証拠（claim・source・conflict）を確認するUIは存在しない（evidenceモデル自体が無いため当然）。
- 欠損・矛盾の警告表示なし。admin.ts は products を `select('*')` で読むだけで、仕様の欠損を検出しない。
- **管理画面経由でランキング対象データを編集する経路は現状ゼロ**であり、これは接続前の安全性としてはむしろ好都合
  （誤入力経路がない）。接続時に「表示用products編集」と「evidence review」を別UIに分けるべき（§18）。

## 15. 公開RPC・表示側の問題

- 商品取得はRPCなしの `select('*')`。productsのRLS/anon列制限はmigration外で検証不能 [U]。
  **memo（管理メモ）・spec_source_url等がanonに到達している可能性**があり、接続前に実DBで要確認。
- 比較画面（compare.ts:321-370）は単位・scope・欠損理由を表示しない。バスケット行はkg/L混在表示。
- 欠損は非表示化され、「データなし」と「非該当」が利用者から区別できない。
- spec_checked_date / spec_source_url 未表示＝methodology・鮮度・出典の開示なし（P3）。
- boolean features は「可/不可」の2値表示で、unknownの表示語彙がない。

## 16. ranking接続時のリスク

1. **F系（接続問題）**: score入力に必要な evidence_status / unit / scope / independent_source_count / conflict が
   productsから取得不能 → 現行productsを直接 RankingExecutionBundle の材料にすることは**不可能**（やれば絶対条件違反を量産）。
2. **quality/popularity/editorial混同**: rank_no（editorial）・「売れ筋」タグ・catch_copyの人気訴求文と、
   将来のquality scoreが同一テーブル・同一画面に並ぶ。楽天由来テーブルは分離済みだが、
   **表示層での3系統ラベル分離（quality / popularity / commerce）が未設計**。
3. **fallback-products.ts**: stroller-guideのみで使うハードコード商品データ（レガシーカラム含む）。
   接続後にDB値と食い違う「第3の正」になる危険。
4. **products.id型不明**: id型（text/integer）が環境依存扱いのままでは、identity↔products対応テーブルのFKが張れない。
5. **同意ページ由来データ**: アップリカ・ピジョンの取説はAI自動取得禁止（絶対条件）。取得手続きのメタデータ
   （acquisition_method / human_review）はSupabase側に置き場がなく、source_records新設時に必須。

## 17. P0〜P3優先度一覧

**P0（接続前に必須 — これを解決せず接続すると誤ったscore・絶対条件違反が発生）**

| # | 問題 | 分類 | 根拠 |
|---|---|---|---|
| P0-1 | basket_capacity 単一text列にkg(耐荷重)とL(容量)が混在し得る。数値化・換算の誘発 | B/C | spec-migration:10 / compare.ts:368 / 各run |
| P0-2 | measurement scope（重量の付属品除く、寸法の向き・順序）を保存する構造がない | B | weight_kg / product_size text |
| P0-3 | unknown・false・0 の区別が消える（evidence_status不在、null/空文字/0の同一視、boolean「可/不可」強制、「要確認」自動非表示） | B/C/E | validators.ts:827-858 / product.ts:574,821-830 |
| P0-4 | source・evidence追跡不能（1商品1URL、claimテーブル不在、順位→出典遡及の設計要件と矛盾） | B | spec_source_url / ranking-principles §6 |
| P0-5 | raw・derived・editorial混在（memo=調査メモ+公開注意事項、caution_notesへsource_note流入、features jsonbに判断メモ） | A/C | hipseat seed / product.ts:539 |
| P0-6 | variant取り違え（product_colorsに仕様同等性・product_codeなし、variant code→model_number混入を防げない） | B/D | 20260619000000:89-116 / validators.ts:444-446 |
| P0-7 | products本体（型・制約・RLS・anon権限）がバージョン管理外で検証不能。spec 10カラムの適用状態不明 | B | migrations全15件 / spec-migration |

**P1（ランキングDB設計前に必要）**

| # | 問題 | 分類 |
|---|---|---|
| P1-1 | coverage 2種・confidence の保存先がない | B/F |
| P1-2 | conflict を未解決のまま保持できない（Melio新生児対応、価格・重量の既知不一致含む） | B |
| P1-3 | scenario eligibility（A形/B形分離を含む）の保存・再現先がない。A/B分類は正本側にも構造化フィールドがない | B+正本拡張 |
| P1-4 | model year・generation・market・identification_status を安全に管理できない（name埋め込み） | A/B |
| P1-5 | target_age の範囲・条件付き複数範囲を保持できない | B/C |
| P1-6 | rank_no（editorial順位）と将来のquality scoreの並走・分離方針が未定（Open Decision #15） | F |
| P1-7 | max_load/applicable_weight/load_capacity の語彙不統一（体重上限vs積載の意味ズレ） | A/C |
| P1-8 | 日付3種（published/updated/accessed）の未分化、price の税区分・時点情報なし | B |

**P2（管理画面実装前に必要）**

- P2-1 仕様データの入力・確認UIが不在（SQL直書き運用）— D
- P2-2 reviewerが証拠・出典・conflictを確認するUIがない — D
- P2-3 欠損・矛盾・coverage不足の警告表示がない — D
- P2-4 name/product_name/title 3列同時上書きとidentityの不整合 — D
- P2-5 カテゴリslugのハードコード（main.ts categoryToQuery、Open Decision #4）— B/E

**P3（公開UI前に必要）**

- P3-1 methodology・出典・spec_checked_date（更新日）の表示 — E
- P3-2 scope・欠損理由の表示（「データなし」と「非該当」の区別、unknownの表示語彙）— E
- P3-3 quality / popularity / commerce の分離表示（rank_no表示の再定義含む）— E/F
- P3-4 比較画面での単位明示（バスケット行のkg/L注記）— E
- P3-5 maneuverability等ordinal軸は第三者実測導入まで非表示維持 — E

## 18. 推奨する修正順序（設計レベル。migrationコードは作らない）

1. **実DBの実態確認（P0-7）**: information_schemaでproductsの全カラム・型・default、RLS/grant、spec 10カラムの適用有無を確認し、
   結果をリポジトリに記録（スキーマスナップショットのバージョン管理開始）。既存データへの影響なし・即時可能。
2. **接続方針の確定**: 既存productsを「公開表示用（editorial+commerce）」として凍結的に維持し、
   ランキング用データは**別系統の新テーブル群**（product_identities / product_variants / source_records / evidence_claims /
   normalized_features、＋後段でranking_definitions/inputs/results）として追加。
   - 対応付けは正本の `site_product_match_status` + `site_product_id` をそのまま採用（Runfee=unmatchedも表現可能）。
   - 既存データ無変更・完全additive・backward compatible。段階移行可。
   - 正本のJSON成果物（runs/）をそのまま投入できる形（正本の型=DB設計の出発点）にする。
   - 代替案（productsへカラム追加で対応）は、scope/unit/status/複数source を1行に持てず P0-1〜P0-6 を解決できないため**非推奨**。
3. **editorial純化（P0-5）**: memo=管理用・caution_notes=公開用の運用を実データで是正（調査メモはsource_records側へ移す方針決定）。
   表示側の memo フォールバック（product.ts:539）廃止の是非を決める。
4. **variant/identity整備（P0-6, P1-4）**: 新identityテーブル導入後、model_year/market/generation/identification_statusを移し、
   products.name は表示名専用へ。
5. **ranking系テーブル（P1-1〜P1-3）**: definition/input/result と input_hash、coverage/confidence、scenario eligibility。
   境界値・配点・coverage閾値は**proposedのまま**保存できる形（definition_versionで管理）。
6. **管理画面（P2）**: 「表示用products編集」と「evidence review（claim承認・conflict解決・欠損警告）」を別UIで設計。
7. **公開UI（P3）**: RPC境界の導入（列制限・anon安全化）、scope/欠損/更新日/3系統分離表示。

## 19. migration前に決める必要がある事項

1. products.id の型確定と、identity対応テーブルのFK方式（Open Decision #4/#15と関連）。
2. Supabaseへ保存する正本範囲（source_record全部か要約か — Open Decision #14）。取説由来claimの取得手続きメタデータの扱い含む。
3. `rank_no` の将来（並走・置換・廃止 — Open Decision #15。当面変更禁止を維持）。
4. A形/B形の構造化: **正本側への分類フィールド追加が先**（提案: claim裏付け必須のclassification軸。推測での付与禁止）。DB側はそれに追従。
5. missing reason の語彙統制: 現状は normalization_notes 自由文。DB化するならenum化の要否を正本側で決める（提案）。
6. measurement scope の表現: measurement_condition 自由文のままDBへ持つか、統制語彙（例: excludes_accessory / rear_facing / max_of_range）を導入するか（提案）。
7. basket の軸設計: `basket_capacity`(L) と `basket_max_load`(kg) を別軸に分離するか、単一軸+unit種別で持つか（換算禁止は両案で維持）。
8. product-specifications-migration.sql の正式な処遇（migrations/への編入 or 廃止。適用状態確認が先）。
9. 公開RPC境界の導入是非（select('*')継続か、列制限付きRPC/viewへ移行か）。anonへのmemo露出確認が先。
10. fallback-products.ts の扱い（DB接続後の廃止 or stroller-guide専用として明示隔離）。
11. 既知の値不一致（Combi価格、Libelle重量）の解決手続き（本番値確認→conflictとして記録→人間判断）。

## 20. 未確認事項（Unverified）

1. **本番Supabaseの実データ・実スキーマ全容**（products全カラム・型・default・RLS・grant・行数・5商品の実レコード値）。
2. product-specifications-migration.sql の適用有無（basket_capacity/warranty等6カラムの存在）。
3. products.id の実型（text/integer）。feature_tags の実型（text/text[]）。
4. anonロールが実際にmemo等へアクセス可能か。
5. Codex感度分析: `codex/irodori-ranking-sensitivity` は`origin/main`と同一commit・作業ツリーcleanで、
   **感度分析の成果物はリポジトリに存在しない**。後日成果物が出た際に照合すべき点:
   (a) weight±0.05変動でのcoverage閾値0.7/0.75近傍の商品出入り、(b) conflict軸（Melio target_age/newborn_ready）を
   除外扱いにした場合のscore感度、(c) basket軸をkg/L分離した場合の軸数変化がdata_coverageへ与える影響、
   (d) 必須項目（本体重量・使用時横幅・折りたたみ操作）欠損時の圏外判定の安定性。
6. validators.ts の1061行以降（ranking_input/result・bundle参照整合性検証の詳細）は型定義とSKILL記述からの把握であり、
   実装詳細の一部は未読（サブエージェントA報告に明記）。
7. アップリカ・ピジョン取説の同意ページ経由取得の運用手続き（本監査では外部サイトへ一切アクセスしていない）。

---

### 監査実施メタデータ

- 実施日: 2026-07-17 / 実施ブランチ: `claude/irodori-supabase-gap-audit-5d45a8`
- 手法: サブエージェントA（正本構造監査）+ サブエージェントB（Supabase・管理フロー監査）+ 親エージェントによる統合・スポット再検証
  （product-specifications-migration.sql 全文、compare.ts/product.ts のbasket参照、5商品runのbasket実値、terminology.md軸一覧を親が直接再確認）。
- 本監査でコード・DB・UI・商品データ・正本は一切変更していない。追加したのは本レポート1ファイルのみ。
