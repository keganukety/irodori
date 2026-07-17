-- 公開商品ビュー(public_products)と管理者用商品一覧RPC(list_products)を新設する。
-- 目的: products.memo などの内部管理カラムが匿名(anon)へ露出しない公開取得境界を作る。
--
-- このmigrationは追加のみで、products本体の行・カラム・データ・RLSは一切変更しない。
-- products本体への直接SELECT権限の遮断は次のmigration
-- (20260717001000_revoke_products_direct_select.sql)で行う。
-- ビュー作成 → フロントエンド切替 → 直接SELECT遮断 の順に適用することで、
-- 適用途中に公開サイトが商品を取得できなくなる期間を作らない。
--
-- rollback:
--   drop function if exists public.list_products();
--   drop view if exists public.public_products;

begin;

-- 1. 公開可能カラムのallowlistだけを持つ公開ビュー。
--    以下の内部管理カラムは公開境界に含めない:
--      memo(管理用メモ) / spec_source_url / spec_checked_date /
--      affiliate_checked_at / affiliate_note
--    select * は使わず、公開可否を確認済みのカラムだけを明示する。
create or replace view public.public_products as
select
  id,
  created_at,
  updated_at,
  name,
  brand,
  category,
  price_yen,
  price_tax_type,
  official_url,
  amazon_url,
  rakuten_url,
  yahoo_url,
  product_type,
  target_age,
  weight_kg,
  feature_tags,
  rank_no,
  image_url,
  maker_logo_url,
  award_label,
  is_recommended,
  availability_status,
  availability_note,
  product_size,
  folded_size,
  applicable_weight,
  load_capacity,
  basket_capacity,
  included_accessories,
  warranty,
  manufacturer_country,
  caution_notes,
  model_number,
  brand_id
from public.products;

comment on view public.public_products is
  '公開サイト用の商品ビュー。memo等の内部管理カラムを除外した公開カラムallowlist。公開サイトはproducts本体ではなくこのビューだけを参照する。';

-- 新規オブジェクトに付与されるdefault privilegeを一旦すべて外し、
-- 公開境界にはSELECTだけを許可する(ビュー経由の更新は許可しない)。
revoke all on public.public_products from public;
revoke all on public.public_products from anon;
revoke all on public.public_products from authenticated;

grant select on public.public_products to anon, authenticated;

-- 2. 管理画面用の商品一覧RPC。products本体の全カラム(memoを含む)を返すが、
--    public.is_admin() を満たす管理者だけが実行できる。
--    authenticatedであっても管理者以外には商品データ(memoを含む)を返さない。
create or replace function public.list_products()
returns setof public.products
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return query
  select *
  from public.products
  order by id;
end;
$$;

comment on function public.list_products() is
  '管理画面専用の商品一覧RPC。is_admin()必須。memoを含む全カラムを返すため公開境界では使用しない。';

revoke all on function public.list_products() from public;
revoke all on function public.list_products() from anon;
grant execute on function public.list_products() to authenticated;

commit;
