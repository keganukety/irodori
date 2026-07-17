# 監査後セキュリティ修正追補（2026-07-17）

本書は、同ディレクトリの[本番Supabase schema監査](README.md)後に実施された
`products.memo`公開露出の修正と、修正後の確認状態を記録する追補である。
元の監査本文、probe結果、sanitized schema snapshotは修正前時点の証拠として保持し、
現在状態に合わせた書き換えは行っていない。

## 1. 監査時点のConfirmed事実

監査時点では、次の状態を本番へのread-only probeとリポジトリの静的確認でConfirmedとして記録した。

- `products`本体はanonから直接取得でき、公開行に対する行制限は確認できなかった。
- 管理用内部カラム`products.memo`はanonから取得でき、70/70行が非nullだった。
- 公開商品取得コードに`products.select('*')`があり、レスポンスへ`memo`が含まれていた。
- `product.ts`には注意事項への`memo` fallback、`brand.ts`には商品説明への無条件の`memo` fallbackがあった。

これらは誤検知や将来リスクではなく、**監査時点でConfirmedだった過去事実**である。

## 2. 修正内容

修正は公開境界の追加と直接権限の遮断を分けた二段階で実施された。

### Stage 1 — PR #14

[PR #14](https://github.com/keganukety/irodori/pull/14)で次を追加・変更した。

- 公開可能な34カラムを明示した`public.public_products` viewを追加し、`memo`、
  `spec_source_url`、`spec_checked_date`、`affiliate_checked_at`、`affiliate_note`を公開境界から除外した。
- `public.is_admin()`を必須とする管理者用`public.list_products()` RPCを追加した。
- 公開商品取得を`products`本体から`public_products`へ切り替えた。
- `product.ts`と`brand.ts`の`memo` fallbackを削除した。
- 管理画面の商品一覧取得を`list_products()`へ切り替えた。
- 公開商品境界のregression testを追加した。

Stage 1 squash merge commit: `efd5b1ab99530923440f6fd1fc1edf6cee7ab216`

### Stage 2 — PR #15

[PR #15](https://github.com/keganukety/irodori/pull/15)で、`public`、`anon`、`authenticated`から
`products`本体への直接アクセス権をrevokeした。公開サイトは`public_products`、管理画面は
`list_products()`を使うStage 1の境界を維持している。

Stage 2 squash merge commit: `14f3dac7083b2ea32b21bc61dc1865574a62254c`

## 3. 修正後の確認状態

二段階リリース後の本番境界とmainは次の状態まで確認済みである。

| 確認項目 | 結果 |
|---|---|
| anonによる`products`本体の直接取得 | **401**。直接SELECT不可 |
| anonによる`public_products`の公開カラム取得 | **200**。公開商品取得可 |
| `public_products`への`memo`指定 | `memo`列はviewに存在せず、取得不可 |
| `list_products()` | `authenticated`への実行権に加え、関数内の`is_admin()`で管理者境界を強制 |
| 公開ページの取得先 | `products`本体を直接参照せず、`public_products`を使用 |
| `product.ts` / `brand.ts` | `memo` fallbackなし |

したがって、監査でConfirmedとなった`memo`の公開露出問題は現在 **Remediated** である。

## 4. migration履歴

修正に対応するmigrationは次の2件である。

- `20260717000000_public_products_view.sql`
- `20260717001000_revoke_products_direct_select.sql`

確認時点で、両migrationはLocal/Remote双方に各1件の`applied`として記録され、全17件の履歴が一致していた。
すでに整合していたため`migration repair`は実行していない。SQLの再適用、重複記録、履歴の書き換えも行っていない。

## 5. 残存リスクと再監査条件

- 現在は`products`の全公開行を`public_products`経由で表示する方針を維持している。
  商品ごとの行レベル公開条件が必要になった場合は別途設計する必要がある。
- `list_products()`の管理者境界は`public.is_admin()`の正しさに依存する。
- 他テーブルの`select('*')`は、将来内部カラムが追加されたときに同種の露出を起こし得る。
  公開境界では明示的なカラムallowlistを維持する。
- `memo`の内容自体は削除していない。公開経路と直接権限を遮断した修正である。
- `public_products` viewまたは`SECURITY DEFINER` RPCの定義・権限・所有者・`search_path`を変更するときは、
  anon/authenticated/adminの各境界を再監査する。
- `public_products`へ新しいカラムを追加するときは、公開可否を個別に確認し、内部カラムを暗黙に追加しない。

## 6. 本追補の作業範囲

本追補は監査成果物と修正済み状態の対応関係を記録する文書であり、本番DB変更、migration適用、
schema変更、商品データ変更、管理画面変更、公開UI変更を行わない。
