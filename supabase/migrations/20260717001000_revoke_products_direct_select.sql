-- anon / authenticated から products 本体への直接アクセス(PostgREST経由の
-- SELECT/INSERT/UPDATE/DELETE)を遮断する。
-- これにより anon が products.memo を直接取得できなくなる。
--
-- 公開サイトは public_products ビュー(SELECTのみ)、
-- 管理画面は list_products RPC(is_admin必須) と既存のsecurity definer RPC群を使う。
-- security definer関数(update_product_affiliate_urls等)は関数所有者権限で
-- 動作するため、このrevokeの影響を受けない。service_roleも影響を受けない。
--
-- 適用前提:
--   1. 20260717000000_public_products_view.sql が適用済みであること
--   2. フロントエンドが public_products / list_products へ切替済みであること
--
-- rollback(修正前の露出状態に戻る点に注意):
--   grant select on public.products to anon;
--   grant select on public.products to authenticated;
--
-- データ変更なし。RLS設定の変更なし。権限(grant/revoke)のみ。

begin;

revoke all on public.products from public;
revoke all on public.products from anon;
revoke all on public.products from authenticated;

commit;
