# 本番Supabase read-only監査 プローブ結果

- 実行日時: 2026-07-17 16:40〜16:48 (+09:00)
- 実行方法: Node v24 スクリプト(scratchpad)から PostgREST REST API へ **GET / HEAD のみ**。POST/PATCH/PUT/DELETE・RPC呼び出し・DDL/DML は一切実行していない。
- 接続先: `https://<redacted>/rest/v1/`(project ref・API key・JWTは本ファイルに含めない)
- ロール: `anon`(VITE_SUPABASE_ANON_KEY)/ `service`(SUPABASE_SERVICE_ROLE_KEY、RLSバイパス)
- 本ファイルは sanitize 済み。memo等の内部メモは全文を転載せず、非null・文字数・キーワード有無のみ記録。

## 実行済み(REST)と未実行(SQL)の区別

- **実行済み**: 本ファイルに記載の GET/HEAD プローブすべて。
- **未実行**: `read-only-audit.sql`(同ディレクトリ)。information_schema / pg_catalog 系メタデータ(RLSポリシー定義・check制約・index・grants詳細・view定義・function定義)は REST から到達不能のため、ユーザーが Supabase SQL Editor で手動実行する用の SELECT のみのスクリプトとして未実行のまま同梱。
- Supabase CLI(`npx supabase`)によるDB直結は access token / DB password が手元に無いため**試行せず**(login/link等の状態変更コマンドは禁止事項のため実行しない方針)。

## Probe 1: OpenAPI スキーマ取得

| # | Method | Path | Role | 結果 |
|---|--------|------|------|------|
| 1 | GET | `/rest/v1/` | anon | **401** `{"message":"Invalid API key","hint":"Only the `service_role` API key can be used for this endpoint."}` — このプロジェクトはOpenAPIルートをservice_role限定に設定している。anon視点のOpenAPIは取得不能。 |
| 2 | GET | `/rest/v1/` | service | **200**(102,704 bytes)→ `schema-snapshot.sanitized.json` に格納 |

service視点で見えたテーブル/ビュー(12): products, brands, brand_aliases, product_colors, product_affiliate_images, product_uploaded_images, rakuten_affiliate_shop_settings, site_assets, asset_folders, admin_users, product_image_backups, site_asset_import_sources。RPCは32個(一覧はsnapshot参照)。viewらしき定義はOpenAPI上に無し(全てPK付きtable)。

## Probe 2: 行数比較(RLS行制限の実測)

HEAD `{table}?select=*` + `Prefer: count=exact`(Range: 0-0)。

| テーブル | anon件数 | service件数 | 判定 |
|---|---|---|---|
| products | **70** | 70 | 行制限なし(全行公開) |
| brands | 42 | 42 | 行制限なし |
| brand_aliases | 93 | 93 | 行制限なし |
| product_colors | 12 | 12 | 行制限なし |
| product_affiliate_images | 582 | 582 | 行制限なし |
| product_uploaded_images | 0 | 0 | 行なし(判定不能だがgrantあり) |
| rakuten_affiliate_shop_settings | **0** | **10** | grantあり(200)だが**RLSで全行不可視** |
| site_assets | 401 | 221 | anonは**SELECT grant自体なし** |
| asset_folders | 401 | 12 | anonはgrantなし |
| admin_users | 401(42501 permission denied) | 1 | anonはgrantなし |
| product_image_backups | 401 | 0 | anonはgrantなし |
| site_asset_import_sources | 401 | 41 | anonはgrantなし |

※401時のPostgRESTエラー例(admin_users): `code 42501, "permission denied for table admin_users"` — RLSではなくtable grant欠如による拒否。

## Probe 3: memo露出(anon)

| # | Method | Path | Role | 結果 |
|---|--------|------|------|------|
| 1 | GET | `products?select=id,memo&limit=3` | anon | **200 — memoはanonに返る(露出)**。3行とも非null(文字数: id7=90字, id32=49字, id47=35字)。値の全文は記録しない。 |
| 2 | HEAD | `products?select=id&memo=not.is.null` + count | anon | **70/70件 memo非null**。フィルタも通る=列への読み取り権あり。 |
| 3 | HEAD | 同上 | service | 70/70件(一致) |
| 4 | HEAD | `products?select=id&caution_notes=not.is.null` + count | service | 26/70件 |

**結論: products.memo(管理用内部メモ)は anon キーで全70行分読み取り可能。** 対象5商品のmemoにはいずれも「未確認」という語が含まれる(下記)。公開列caution_notesとの分離(列レベルgrantまたはpublic view化)は未実施とみられる。

## Probe 4: 対象5商品の実値(service, GET, 指定列のみ)

検索: `name=ilike`(%メリオ%カーボン% / %カルーン% / %スゴカル% / %ランフィ% / %Runfee% / RB5(name・model_number) / %リベル%)。

- 「%ランフィ%」は **0件**(カタカナ名の行は存在しない)。「%Runfee%」および「RB5」で id=14 がヒット。**Runfee RB5 の行は存在する**(name: `Runfee RB5 / Runfeeシリーズ`)。
- 「%カルーン%」は2件(メッシュ AC と AD)。

| 列 | id=4 メリオ カーボン 2026 | id=3 スゴカル エッグショック LA | id=5 カルーンエアー メッシュ AC | id=28 カルーンエアー AD | id=14 Runfee RB5 / Runfeeシリーズ | id=7 リベル 2026 |
|---|---|---|---|---|---|---|
| brand | サイベックス | コンビ | アップリカ | アップリカ | ピジョン | サイベックス |
| category | ベビーカー | ベビーカー | ベビーカー | ベビーカー | ベビーカー | ベビーカー |
| product_type | AB型寄り・両対面 | A型・両対面 | A型・軽量 | A型・軽量 | A型・シングルタイヤ | B型・コンパクト |
| target_age | 生後1ヵ月～3歳頃まで(体重15kgまで) | 生後1カ月～36カ月頃まで(体重15kg以下) | 生後1カ月～36カ月(体重15kg以下) | 生後1カ月～36カ月(体重15kg以下) | 生後1ヵ月～36ヵ月まで | 腰のすわった生後6ヵ月頃～4歳頃まで(体重22kgまで) |
| weight_kg | 5.9 | 4.6 | 3.9 | 3.9 | 5.9 | 6.3 |
| product_size | W490×D820～910×H965～1070mm | **null** | W452×D817×H1007mm | W455×D815×H1035mm | 背面位:W516×D870～890×H933～1030mm/対面位:W525×D953～1050×H885～1000mm | W520×D710×H1020mm |
| folded_size | W490×D540×H690mm | **null** | W452×D311×H959mm | W455×D305×H962mm | W516×D380×H820～1030mm | W320×D200×H480mm |
| applicable_weight | 15kgまで | 15kg以下 | 15kg以下 | 15kg以下 | **null** | 22kgまで |
| load_capacity | ショッピングバスケット5kgまで | **null** | バスケット5kgまで | **null** | **null** | **null** |
| basket_capacity | 約38L | **null** | **null** | **null** | **null** | **null** |
| price_yen | 74800 | 32000 | 37400 | 37400 | 61000 | 29975 |
| rank_no | 3 | 2 | 4 | 27 | 13 | 6 |
| model_number | **null** | **null** | 2206924 / 2206925 | 2189465 | 1042807 | **null** |
| spec_source_url | cybex-japan.com/products/melio-carbon-2026 | combi.co.jp/store/baby/stroller/sugocal_ss/ | aprica.jp/…/karoonair_mesh_ac/ | aprica.jp/…/karoonair_ad/ | products.pigeon.co.jp/item/index-2706.html | cybex-japan.com/products/libelle-2026 |
| spec_checked_date | 2026-06-12 | 2026-06-12 | 2026-06-12 | 2026-06-12 | 2026-06-12 | 2026-06-12 |
| updated_at | 2026-06-14 | 2026-06-14 | 2026-06-14 | 2026-06-14 | 2026-06-14 | 2026-06-14 |
| feature_tags | `AB型寄り, 両対面, 軽量, コンパクト` | `A型, 両対面` | `A型, 軽量` | `A型, 軽量` | `A型, シングルタイヤ` | `B型, コンパクト` |

年式情報: nameに「2026」を含むのはメリオ カーボン・リベルのみ。年式専用カラムは存在しない。

### memo / caution_notes メタデータ(全文は転載しない)

| id | memo非null | memo文字数 | 内部メモらしき語 | caution_notes非null(文字数) |
|---|---|---|---|---|
| 3 スゴカル | ○ | 108 | 「未確認」含む | ✕ (0) |
| 4 メリオ カーボン | ○ | 72 | 「未確認」含む | ✕ (0) |
| 5 カルーンエアー メッシュ AC | ○ | 82 | 「未確認」含む | ✕ (0) |
| 7 リベル | ○ | 90 | 「未確認」含む | ✕ (0) |
| 14 Runfee RB5 | ○ | 117 | 「未確認」含む | ✕ (0) |
| 28 カルーンエアー AD | ○ | 83 | 「未確認」含む | ○ (20字) |

チェックした語: 要確認 / 調査 / 確認時点 / TODO / 未確認 / 仮 — 6行すべてで「未確認」のみヒット。

## Probe 5: その他

| Method | Path | Role | 結果 |
|---|---|---|---|
| GET | `products?select=id,name&limit=1` | anon | 200(データ返却、公開読み取り正常) |
| GET | `admin_users?select=user_id&limit=1` | anon | 401 / 42501 permission denied |
| GET | `rakuten_affiliate_shop_settings?select=shop_key&limit=1` | anon | 200だが `[]`(grantあり・RLSで0行) |

## スキーマ確定事項(service OpenAPIより)

- **products.id = bigint**(integer/format bigint)。uuidではない。PK。identity/sequenceの別はSQL未実行のため未確認。
- **feature_tags = text(単一文字列)**。text[]ではない。実値はカンマ+スペース区切り(例: `A型, 軽量`)。
- **仕様10カラムはすべて存在**: product_size, folded_size, applicable_weight, load_capacity, basket_capacity, included_accessories, warranty, manufacturer_country, caution_notes, model_number(全てtext、コメント「公開用の商品仕様: …」付き。manufacturer_countryは「メーカー所在国。製造国ではない」、caution_notesは「memoは管理用、caution_notesは公開用」と明記)。
- **memoカラム存在**(text)。anonのOpenAPIは取得不能だが、実測でanonから読み取り可能(上記Probe 3)。
- affiliate系: amazon_url / rakuten_url / yahoo_url / official_url / affiliate_checked_at(date) / affiliate_note(text)。
- rank_no: integer / weight_kg: numeric / price_yen: integer / spec_source_url: text / spec_checked_date: date / updated_at: timestamptz(default now())。
- その他products列: created_at, brand(text), brand_id(uuid FK→brands.id), image_url, maker_logo_url, award_label, is_recommended(bool default false), price_tax_type, availability_status, availability_note。NOT NULL(required)は id, name, category のみ。
- RPC 32個の名称・引数は `schema-snapshot.sanitized.json` 参照。anonからどのRPCが実行可能かは**未確認**(確認にはPOSTが必要なため本監査では実施せず。`read-only-audit.sql` の pg_proc.proacl クエリで確認可能)。

## 未確認事項(SQL Editor手動実行が必要 → read-only-audit.sql)

1. RLSポリシー定義(pg_policies)・relrowsecurity/relforcerowsecurity の正式値(行数比較からの推定のみ)。
2. table/column grants の正式一覧(role_table_grants / column_privileges)。
3. check制約・index・sequence/identity・view定義・functionのSECURITY DEFINER有無とproacl。
4. products.id の採番方式(identity か sequence default か)。
5. anon が実行可能な RPC の確定。
