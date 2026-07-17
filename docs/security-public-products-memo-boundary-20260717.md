# products.memo 匿名公開露出の遮断(公開商品取得境界の新設)

- 日付: 2026-07-17
- 種別: セキュリティ修正(緊急)
- 対象: 公開サイトの商品取得経路 / Supabase権限 / 管理画面の商品取得
- 状態: ローカルcommitのみ。本番migration適用・push・PR・merge・デプロイは未実施。

## 1. 漏出原因

本番schema read-only監査(ローカルcommit `414ca45`)で以下が確認された。

1. `products`(39カラム)は anon ロールから全70行SELECT可能で、管理用カラム
   `products.memo` も 70/70件取得できた(カラムコメント上、memoは管理用・
   caution_notesが公開用)。
2. 公開サイトの商品取得9か所すべてが anon クライアントで
   `from('products').select('*')` を実行しており、memoを含む全カラムが
   ブラウザへ配信されていた。
3. 画面表示にも到達経路があった。
   - `src/product.ts`: 商品仕様「注意事項」が `precautions → notes → memo` の
     順でフォールバックし、単語フィルタ(`isManagementMemo`)を通過したmemoを表示。
   - `src/brand.ts`: 商品説明が `description → … → memo` へフォールバックし、
     こちらは内容フィルタなしでmemoをそのまま表示。
4. memoを除外する公開view・RPCは存在しなかった。

つまり「PostgREST権限(anonがproducts本体を読める)」と「フロントエンドの
`select('*')`+memoフォールバック」の二重の問題。

## 2. 修正後の公開取得境界

### 新設オブジェクト

| オブジェクト | 種別 | 役割 |
| --- | --- | --- |
| `public.public_products` | view | 公開可能34カラムの明示allowlist。公開サイトの唯一の商品取得先 |
| `public.list_products()` | RPC (security definer) | 管理画面用。`is_admin()`必須で、memoを含む全カラムを返す |

`public_products` の除外カラム(公開境界に入れない内部カラム):

- `memo`(管理用メモ・今回の漏出対象)
- `spec_source_url` / `spec_checked_date`(仕様調査の運用情報)
- `affiliate_checked_at` / `affiliate_note`(アフィリエイト運用情報)

ビューは `select *` を使わず34カラムを明示列挙する。行フィルタは行わない
(商品カタログは全行公開が現行仕様。行制御と列露出制御は分離して設計し、
今回は列露出のみを変更)。ビューへの権限はSELECTのみで、ビュー経由の更新は
できない。

### フロントエンド

- 公開取得の起点を `src/lib/publicProducts.ts` に集約。
  - `PUBLIC_PRODUCT_COLUMNS`(34カラムallowlist、migrationと一致することを
    テストで担保)
  - `PublicProduct` 型(内部カラムは `never` 型で保持不可)
  - `selectPublicProducts()`(`from('public_products').select(明示カラム)`)
- 公開6ファイル(home / main(products一覧) / product(詳細+おすすめ) /
  brand / compare / stroller-guide)の products 取得7クエリをすべて
  `selectPublicProducts()` へ切替。`from('products')` と products への
  `select('*')` は公開コードから消滅。
- memoフォールバック削除:
  - `product.ts` 注意事項: `caution_notes` のみ使用。空なら行ごと非表示。
  - `brand.ts` 商品説明: 公開説明カラム候補のみ。該当なしなら説明非表示。
  - memoを単語フィルタして公開する方式は採用しない(内部文章は内容に
    かかわらず公開境界に入れない)。
- 管理画面(`admin.ts` / `affiliateAdmin.ts`)は `supabase.rpc('list_products')`
  へ切替。管理商品型は `AdminProduct`(memo等を保持)として公開型と分離。

## 3. anon / authenticated / admin の権限設計

| ロール | products本体 | public_products | list_products() |
| --- | --- | --- | --- |
| anon | 不可(revoke) | SELECTのみ | 不可(execute revoke) |
| authenticated(非管理者) | 不可(revoke) | SELECTのみ | 実行は可能だが `is_admin()` で例外になりデータは返らない |
| authenticated(管理者) | 直接は不可 | SELECT可 | 全カラム(memo含む)取得可 |
| service_role / definer RPC | 従来どおり | - | - |

- authenticated 全体へ products本体(memo)を公開し続ける案は不採用。
  非管理者のauthenticatedユーザーが存在した場合にmemoが読める残存リスクを
  避けるため、既存の `public.is_admin()` 判定を使う管理専用RPC境界とした。
- 既存のsecurity definer RPC(`update_product_affiliate_urls`、
  affiliate画像系RPC等)は関数所有者権限で動くため、revokeの影響を受けない。
- RLSは変更しない(現行ポリシー状態が監査で未確定のため、確定的に効く
  grant/revokeのみで遮断)。

## 4. memoが公開されない理由(多層防御)

1. DB権限: anon/authenticatedはproducts本体をSELECTできない(migration 2)。
2. 公開境界: `public_products` ビューにmemoカラム自体が存在しない。
3. コード: 公開コードに `from('products')`・`select('*')`・memo参照が無い。
4. 型: `PublicProduct` はmemoを `never` 型で拒否。allowlistへの混入は
   コンパイルエラー。
5. テスト: `tests/public-product-boundary.test.mjs`(21件)が上記1〜4の
   静的contractを検証し、再混入をCI/ローカルで検出。

## 5. Migration適用順(本番適用時の手順)

適用は次の順で行うこと。順序を守ることで公開サイトの取得停止期間を作らない。

1. `20260717000000_public_products_view.sql` を適用
   (ビュー+RPC作成のみ。既存動作へ影響なし)。
2. 本ブランチのフロントエンドをデプロイ
   (公開: public_products / 管理: list_products へ切替)。
3. 動作確認(下記「本番適用後の確認手順」の1〜3)。
4. `20260717001000_revoke_products_direct_select.sql` を適用
   (products本体への直接SELECT遮断。ここでmemoのanon露出が閉じる)。
5. 最終確認(下記4〜6)。

旧フロントエンドが残った状態で手順4を先に実行すると、公開サイトの商品表示が
revoke時点で失敗する(セキュリティ優先で先に閉じる判断をする場合のみ許容)。

## 6. 本番適用後の確認手順

anon keyでのREST確認(読み取りのみ):

1. `GET /rest/v1/public_products?select=id,name&limit=1` → 200で返る。
2. `GET /rest/v1/public_products?select=memo` → 400(カラム不存在)。
3. 公開サイト各ページ(TOP・一覧・詳細・比較・ブランド・ガイド)で商品表示を確認。
4. `GET /rest/v1/products?select=memo&limit=1`(anon) → 401/403(permission denied)。
5. 管理画面にログインし、商品一覧・画像管理・affiliate管理の表示/保存を確認。
6. 非管理者のテストユーザーで `POST /rest/v1/rpc/list_products` が
   `admin only` エラーになることを確認(存在する場合)。

## 7. Rollback

- 手順4のrollback(直接SELECT復活。修正前の露出状態に戻る点に注意):
  ```sql
  grant select on public.products to anon;
  grant select on public.products to authenticated;
  ```
- 手順1のrollback:
  ```sql
  drop function if exists public.list_products();
  drop view if exists public.public_products;
  ```
- フロントエンドは直前デプロイへロールバック(旧コードはproducts本体を
  参照するため、DB側も先にgrantを戻す必要がある)。

## 8. 残存リスク

1. **適用前は露出継続**: 本修正はローカルcommitのみ。migration 2を本番へ
   適用するまで、anonによるmemo取得は引き続き可能(コード修正だけでは
   REST直叩きを防げない)。早期適用を推奨。
2. **products以外のselect('*')**: brands / product_colors /
   product_affiliate_images / product_uploaded_images は引き続き
   `select('*')`。現時点で内部カラムは確認されていないが、これらに内部
   カラムを追加する場合は同様のallowlist化が必要。
3. **RLS未整備**: productsの行レベル制御は未変更(全行公開仕様)。将来
   非公開商品を持つ場合は、grantではなくビュー定義+RLSでの行制御が必要。
4. **is_admin()への依存**: `list_products()` は既存の `public.is_admin()` の
   正しさに依存する(既存管理RPC群と同一の依存)。
5. **ビューはRLSバイパス**: `public_products` は定義者権限ビューのため、
   将来productsへRLSポリシーを追加してもビュー経由の読み取りには効かない。
   その際はビュー定義自体に公開条件を書くこと。
6. **seed/過去データ**: memoの内容自体は変更していない(要件どおり)。
   memo内に公開不可情報が含まれる前提の運用を継続すること。
