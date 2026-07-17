# 本番Supabase schema監査 追補レポート（2026-07-17）

第1検証フェーズの差異監査（`../2026-07-17-supabase-gap/README.md`、以下「元監査」）で
**[U] Unverified** とされていた本番Supabaseの実態を、read-onlyで確認した追補記録。

- 元監査は履歴保持のため**一切変更しない**（追補方式。`audits/<date>-<topic>/` 慣例に従い本ディレクトリを新設）。
- 基点commit: `fe9a531942f805f14a8f5f6f0960a17ece72ad67`（実施時点の `origin/main` 最新）
- 実施ブランチ: `claude/irodori-production-schema-audit-ae5eb6`（専用worktree）
- 表現区分: **[C] Confirmed** / **[P] Proposed** / **[O] Open Decision** / **[U] Unverified**。

## 0. 実施条件（遵守事項）

- **read-onlyのみ**: 本番へはPostgREST REST APIの **GET / HEAD のみ**。POST/PATCH/PUT/DELETE・RPC呼び出し・
  DDL/DML・migration適用・seed実行・dashboard変更は一切行っていない。**本番は無変更** [C]。
- API key・JWT・接続URL・project refは成果物・レポートに一切含めない（sanitized）。
- memo等の内部メモは全文を転載せず、露出可否・件数・文字数・キーワード有無のみ記録。
- 取得はスキーマmetadataと対象5商品（+同名ヒットの姉妹モデル1件）の必要最小限の列のみ。
- 外部サイト調査・取説同意操作・確定score/順位の作成は行っていない。

## 1. 接続手段と成否

| 手段 | 結果 |
|---|---|
| PostgREST REST API（anonキー / service_roleキー、GET/HEADのみ） | **接続成功**。実測の主手段 |
| OpenAPIルート `GET /rest/v1/`（anon） | **401**（このプロジェクトはOpenAPIをservice_role限定に設定）→ anon視点はテーブル毎の実測プローブで代替 |
| OpenAPIルート（service） | 200。全スキーマ取得 → `schema-snapshot.sanitized.json` |
| Supabase CLI（DB直結） | **未試行**。access token・DB passwordが手元になく、login/link等の状態変更コマンドは禁止事項のため実行しない |
| psql直結 | 不可（クライアント未導入・接続情報なし） |

REST到達不能なmetadata（RLSポリシー定義・grants正式一覧・check制約・index・view/function定義・id採番方式・
anon実行可能RPC）は **未実行のSELECT専用スクリプト** [read-only-audit.sql](read-only-audit.sql) として同梱した。
実行済み（REST実測）と未実行（SQL script）の区別は [production-probe-results.md](production-probe-results.md) に明記。

## 2. products 実DDL概要（sanitized・service OpenAPI由来）[C]

- **39カラム**。全列一覧は `schema-snapshot.sanitized.json` / `production-probe-results.md` 参照。
- **id = bigint・PK**（uuidではない）。NOT NULLは **id / name / category のみ**（他36列は全てnullable）。
  採番方式（identity/sequence）は [U]（SQL script [1][14]）。
- **仕様10カラムはすべて適用済み**: product_size / folded_size / applicable_weight / load_capacity /
  basket_capacity / included_accessories / warranty / manufacturer_country / caution_notes / model_number（全text）。
  元監査で「migrations/外・適用状態[U]」だった `product-specifications-migration.sql` は**本番適用済み**と確定。
- **feature_tags = text（単一文字列）**。text[]ではない。実値はカンマ+スペース区切り（例: `A型, 軽量`）。
- カラムコメントに「**memoは管理用、caution_notesは公開用**」「manufacturer_countryはメーカー所在国。製造国ではない」と
  明記されている（運用意図は定義済みだが、後述のとおりmemoは公開到達している）。
- その他: weight_kg numeric / price_yen integer / rank_no integer / spec_checked_date date /
  updated_at timestamptz default now() / brand_id uuid FK→brands.id / affiliate系6列 /
  **元監査に未記載の列**: award_label, is_recommended(bool), price_tax_type, availability_status, availability_note,
  maker_logo_url, affiliate_checked_at, affiliate_note, created_at。
- `product_name` / `title` 列は**存在しない**（nameのみ）。`update_product_affiliate_urls` RPCは
  両列の存在を動的確認して書く防御的実装のため、本番では実質name 1列更新。
- 年式専用カラムなし（nameに「2026」を含む商品のみ）。model_year・market・A/B構造化分類は不在
  （product_typeにフリーテキスト「A型・両対面」等はある。§5）。

## 3. RLS・grants・memo露出監査

### 3.1 行レベル（anon vs service 件数実測）[C]

| テーブル | anon | service | 判定 |
|---|---|---|---|
| products | **70** | 70 | **行制限なし（全行公開）** |
| brands / brand_aliases / product_colors | 42 / 93 / 12 | 同左 | 行制限なし |
| product_affiliate_images | 582 | 582 | 行制限なし |
| product_uploaded_images | 0 | 0 | 行なし（grantあり） |
| rakuten_affiliate_shop_settings | **0** | 10 | grantありだが**RLSで全行不可視**（保護は機能） |
| site_assets / asset_folders / admin_users / product_image_backups / site_asset_import_sources | 401 (42501) | 221 / 12 / 1 / 0 / 41 | **anonへのSELECT grant自体なし** |

→ 保護は不均一: rakuten設定・asset系・admin_usersは保護済み、**productsは全行・全列がanonに開放**されている。

### 3.2 列レベル・memo露出 [C]

- **products.memo（管理用内部メモ）はanonキーで全70行読み取り可能。70/70件が非null。**
- 対象5商品+姉妹モデルのmemoは全件に内部語「未確認」を含む（チェック語: 要確認/調査/確認時点/TODO/未確認/仮。
  全文は非転載。文字数・詳細は probe-results Probe 3–4）。caution_notes非nullは26/70件。
- リポジトリ側の到達経路（サブエージェントB確認）:
  1. 公開9箇所すべて `select('*')`（main.ts:259, product.ts:171,177, compare.ts:99, home.ts:301, brand.ts:99,
     stroller-guide.ts:632, admin.ts:258, affiliateAdmin.ts:173）→ レスポンスにmemoが常に含まれる。
  2. **表示到達1（既知）**: product.ts:539 が memo を「注意事項」候補（第3順位）に採用。
     product.ts:828-830 `isManagementMemo`（/未確認|要確認|ランキング|調査|source/i）は**部分フィルタ**で、
     一致しない管理メモは表示に漏れ得る。
  3. **表示到達2（新発見）**: brand.ts:356-366 `getProductDescription` が説明系カラム空時のフォールバック最終候補に
     memoを使用し、**こちらはフィルタなし**（160字切詰のみ）。
- **結論: 「RLSは行だけでなく列の露出を防げているか」→ 防げていない**。行制限なし+列grant全開+select('*')の三重で、
  memoは（a）APIレスポンスとして常時、（b）条件次第で画面表示にも露出する。
  公開view/RPCによるmemo除外は**存在しない**（RPC 32個はasset/affiliate管理系のみ。§4）。
- 現状の実害緩和要因: 全70件のmemoが「未確認」を含むため、product.ts経路では isManagementMemo で表示除外される。
  ただしbrand.ts経路とAPIレスポンス露出には効かない。

### 3.3 RPC・view [C/U]

- service視点のRPCは32個（is_admin / get_published_site_assets / update_product_affiliate_urls /
  asset・画像・rakuten系のCRUD。全署名は snapshot 参照）。**productsを読み取る公開RPCは存在しない**。
- OpenAPI上、viewは存在しない（12オブジェクトすべてPK付きtable）。pg_views での正式確認は未実行 [U]。
- anonが実行可能なRPCの確定は未実施（POSTが必要なため。SQL script [10] proaclで確認可能）[U]。
- migration内のgrant設計（B確認）: 関数は全てsecurity definer + `revoke from public` + authenticated限定
  （anon付与は get_published_site_assets のみ）。products本体へのRLS/policy/grantを定義するmigrationは**存在しない**
  = productsの権限は手動管理 [C]。

## 4. 対象5商品のDB差分表（本番実測 vs 正本runs/）

本番=REST実測（service、指定列のみ）。正本=`agent-skills/irodori/runs/` の product-identity.json / normalized-features.json。
**5商品すべて本番に行が存在** [C]。特筆: 元監査で「対応行なしの可能性」とされた **Runfee RB5 は id=14 として存在**
（name「Runfee RB5 / Runfeeシリーズ」。カタカナ「ランフィ」では0件ヒット）。「%カルーン%」は2件ヒットし、
正本調査対象外の姉妹モデル **カルーンエアー AD（id=28）** も存在（identity照合時の取り違え注意）。

| 項目 | メリオ カーボン 2026 (id=4) | スゴカル LA (id=3) | カルーンエアー AC (id=5) | Runfee RB5 (id=14) | リベル 2026 (id=7) |
|---|---|---|---|---|---|
| 正本site対応の検証 | probable "4" → **一致** | probable "3" → **一致** | probable "5" → **一致** | **unmatched → 行あり（正本要更新）** | probable "7" → **一致** |
| 本体重量 | 本番5.9 = 正本5.9 | 本番4.6 = 正本4.6（**「ダッコシート除く」scopeは本番に無し**） | 本番3.9 = 正本3.9 | 本番5.9 = 正本5.9（**「ハグットシート除く」scope無し**） | **本番6.3 ≠ 正本6.0**（既知不一致が本番でも継続。未解決のまま6.3が確定表示） |
| basket | **本番: basket_capacity「約38L」+ load_capacity「ショッピングバスケット5kgまで」/ 正本: 5kg耐荷重のみ。38Lは正本に無い出典不明値** | 本番null（正本5kg） | 本番: load_capacity「バスケット5kgまで」= 正本5kg | **本番null（正本25L）** | 本番null（正本5kg） |
| target_age | 本番「生後1ヵ月～3歳頃まで(体重15kgまで)」— **正本のconflicting（from birth vs 1ヶ月）が片側確定文言に**。体重上限が月齢欄に混入 | 本番「1カ月～36カ月(15kg以下)」= 正本{1,36} | 同左 | 本番「1ヵ月～36ヵ月」= 正本{1,36} | 本番「6ヵ月頃～4歳頃(22kg)」= 正本{6,48}+22kg |
| max_load系 | applicable_weight「15kgまで」= 正本15 | 「15kg以下」= 正本15 | 同左 | **null = 正本null（unconfirmed。推定禁止が保たれている）** | 「22kgまで」= 正本22 |
| 展開size | 本番W490×D820~910×H965~1070 ≒ 正本490×910×1070（**範囲最大採用の注記なし・W/D/H text**） | **本番null（正本486×835×1048あり=本番が欠損）** | 本番W452×D817×H1007 = 正本一致 | 本番は背面位/対面位を併記（正本516×890×1030は背面位相当） | 本番W520×D710×H1020 = 正本一致 |
| 収納size | 本番W490×D540×H690 ≠ **正本490×590×290（D/H不一致。要再確認）** | **本番null（正本486×425×1012）** | 本番W452×D311×H959 ≒ 正本452×311×959 | 本番W516×D380×H820~1030（正本516×380×1030） | 本番W320×D200×H480 = 正本一致 |
| model_number | null = 正本null | null = 正本null | **本番「2206924 / 2206925」= 正本のvariant product_code 2色分が品番欄に混入（P0-6の実害が既に発生）** | **本番「1042807」= variant code（同上）** | null = 正本null |
| model_year | name埋め込み「2026」のみ（専用列なし） | 正本null・本番も情報なし | 同左（世代ACはname内） | 同左（RB5はname内） | name埋め込み「2026」のみ |
| price_yen | 74,800（正本price null=未確認） | **32,000（公式48,000との既知不一致が本番でも継続）** | 37,400 | 61,000 | 29,975（正本null） |
| rank_no | 3 | 2 | 4 | 13 | 6 |
| variant | 本番product_colors対応なし確認は未実施。正本1色unverified | 正本3色unverified | 正本2色unverified（本番はmodel_number欄に2色分のcode） | 正本2色unverified | 正本1色unverified |
| memo | 非null72字「未確認」含む | 非null108字「未確認」含む | 非null82字「未確認」含む | 非null117字「未確認」含む | 非null90字「未確認」含む |
| 鮮度 | spec_checked_date=2026-06-12・updated_at=2026-06-14（**5商品+ADすべて同一値=一括更新。source毎の鮮度ではない**） | 同左 | 同左 | 同左 | 同左 |

## 5. 元監査の分類（Confirmed / Refuted / Partially confirmed / Still unknown / Newly discovered）

### Confirmed（元監査の主張・懸念が実測で裏付けられた）

1. products本体のRLS/grant/policyはmigration管理外（migrationに定義ゼロ+本番で全行全列anon開放）。
2. memoがanonへ到達し得る [U] → **露出確定**（全70行・70/70非null。§3.2）。
3. 公開取得はRPCなし・`select('*')` 直読み（9箇所、列制限なし）。memoを除外する公開view/RPCは不在。
4. 仕様カラムを編集できる管理UIは不在（products書込RPCはaffiliate系のみ。サーバーサイドfunctionsもproducts非接触・service role不使用）。
5. 任意SQL実行RPCは定義・使用ともに不在。
6. products.idの動的型検出設計（migration内 pg_attribute / information_schema 2方式）。
7. fallback-products.ts は stroller-guide.ts:639 のDB失敗時フォールバック専用。
8. categoryToQuery等のカテゴリハードコード（現行位置 main.ts:924-926）。
9. 既知の値不一致は本番でも未解決のまま: コンビ価格 本番32,000 vs 公式48,000 / リベル重量 本番6.3 vs 正本6.0。
10. site対応推定4件（Melio=4, スゴカル=3, カルーンAC=5, リベル=7）はすべて一致。
11. 楽天由来テーブルに売上・レビュー数等の自動人気指標カラムなし（snapshot列一覧で確認）。
12. 元監査[U]だった3点はいずれも確定: **products.id=bigint / 仕様10カラム=全適用済み / feature_tags=text単一**。

### Refuted（元監査の記述が本番実態と異なる）

1. **「Runfeeは対応行なしの可能性（unmatched）」→ 行は存在**（id=14「Runfee RB5 / Runfeeシリーズ」）。
   正本 product-identity.json の site_product_match_status=unmatched / site_product_id=null は**要更新**
   （本監査では正本を変更していない。是正は別作業）。
2. **「name/product_name/title 3列併存・3列同時上書き」→ 本番にproduct_name/title列は存在しない**。
   RPCは列存在を動的確認する防御的実装で、実質name 1列のみ更新（不整合リスクは現状発生しない）。

### Partially confirmed

1. 「A形/B形の保存先なし」→ 構造化フィールドは確かに無いが、**product_typeにフリーテキスト分類
   （「A型・両対面」「AB型寄り・両対面」「B型・コンパクト」等）が既に存在**（出典・裏付けなし）。
   scenario eligibilityの入力には使えない点は元監査の結論どおり（decision-matrix D-13）。
2. 「RLSの列制限が検証不能」→ 行制限なし・列露出ありは実測確定。ただし**RLSポリシー定義そのもの
   （relrowsecurityフラグ・policy有無）は未確認**（行制限なし=RLS無効かpermissive policyかは未区別。SQL script [5][6]）。
3. 「20260621110000がproduct_size等を前提としてupdate=一部カラム先行適用の疑い」→ 10カラム全適用は確定したが、
   **適用経路・時期**（spec-migration手動実行か別経路か）は特定できず。

### Still unknown（未実行SQL scriptで確認可能）

1. RLSポリシー定義（pg_policies・relrowsecurity/relforcerowsecurity の正式値）— script [5][6]。
2. table/column grantsの正式一覧（特にmemo列に列grant差があるか）— script [7][8]。
3. check制約・index・unique制約の実態 — script [2][3][4]。
4. products.idの採番方式（identity/sequence）— script [1][13][14]。
5. view定義の正式確認・productsを参照するview/functionの逆引き — script [9][11][12]。
6. anonが実行可能なRPCの確定（proacl）— script [10]。
7. 元監査§20-5〜7（Codex感度分析成果物・validators詳細・取説取得運用）は本監査の対象外のまま。

### Newly discovered（元監査に無い新事実）

1. **memoの表示到達経路がもう1つ**: brand.ts:356-366 の説明フォールバック（フィルタなし・160字切詰）。
2. **model_number汚染が既に発生**: カルーンAC「2206924 / 2206925」（2色分のvariant code連記）、
   Runfee「1042807」（variant code）。P0-6のリスクが実害化済み。
3. **Melio basket_capacity「約38L」**: 正本（5kg耐荷重のみ）に無い出典不明の容量値が本番に存在。
   出典遡及不能の実例であり、kg/L 2軸分離（decision-matrix D-10）の必要性を補強。
4. products実カラムは39列で、元監査未記載の9列（award_label, is_recommended, price_tax_type,
   availability_status/note, maker_logo_url, affiliate_checked_at, affiliate_note, created_at）が存在。
5. OpenAPIルートはanonに401（service_role限定設定）— スキーマ自体の露出は防がれている。
6. 姉妹モデル「カルーンエアー AD」（id=28, model_number=2189465）が存在。AC/ADのname類似により
   identity照合時の取り違えリスクあり。
7. spec_checked_dateが全行2026-06-12で均一（一括更新運用。source毎の鮮度情報ではない）。
8. NOT NULLはid/name/categoryのみで、仕様列は全てnullable・default/check制約なし（OpenAPI上）。
9. 保護の不均一: rakuten_affiliate_shop_settingsはRLSでanon 0行、asset系・admin_usersはgrantなしで保護済み。
   **productsだけが全開**。
10. target_age文字列に体重上限が混入（「(体重15kgまで)」等）— 軸混在の実例。
11. スゴカル LA は本番で product_size / folded_size / load_capacity / basket_capacity が **null**
    （正本には値がある=本番が正本より欠損している商品が存在）。
12. メリオの折りたたみ寸法が本番W490×D540×H690 vs 正本490×590×290で不一致（新規の要確認conflict）。

## 6. 設計判断への反映

- **migration前decision matrix（15項目）**: [decision-matrix.md](decision-matrix.md)
  — 本番実測（id=bigint・memo露出確定・basket実態・product_typeフリーテキスト分類）を反映済み。
- **schema比較（products拡張案A vs 別系統案B）**: [proposed-schema-comparison.md](proposed-schema-comparison.md)
  — 推奨は案B。Codex coverage契約（criterion/parent/weighted coverage・score state・eligibility）の
  格納余地を ranking_result / ranking_criterion_result の専用列+jsonb受け皿で確保。

## 7. 成果物一覧

| ファイル | 内容 |
|---|---|
| [README.md](README.md)（本書） | 追補レポート・Confirmed/Refuted分類・5商品差分表・RLS/memo露出監査 |
| [schema-snapshot.sanitized.json](schema-snapshot.sanitized.json) | service OpenAPI由来のsanitizedスキーマスナップショット（key/URL/refなし） |
| [production-probe-results.md](production-probe-results.md) | 実行した全probe（GET/HEAD）の記録・実測値・実行/未実行の区別 |
| [read-only-audit.sql](read-only-audit.sql) | **未実行**。SQL Editor手動実行用のSELECT専用スクリプト（Still unknown 1〜6の確認用） |
| [decision-matrix.md](decision-matrix.md) | migration前の意思決定15項目（推奨・代替案・BC・移行・影響・未決） |
| [proposed-schema-comparison.md](proposed-schema-comparison.md) | 案A/案B比較・疑似DDL・Codex契約受け皿 |

## 8. 実施メタデータ

- 実施日: 2026-07-17 / worktree: `agent-skills-ranking-research-26e457` / branch: `claude/irodori-production-schema-audit-ae5eb6`
- 体制: サブエージェントA（本番REST実測+SQL script作成）+ サブエージェントB（リポジトリ側query/RPC/adminフロー検証）
  + 親（検収・統合・decision matrix・schema比較）。同一ファイル・同一SQLの重複調査なし。
- 本監査で本番DB・管理画面・公開UI・正本（runs/・contracts）・元監査は一切変更していない。
  追加は本ディレクトリ配下の6ファイルのみ。push・PR・mergeは行わない（ローカルcommitのみ）。
