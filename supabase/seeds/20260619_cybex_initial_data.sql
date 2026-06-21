-- CYBEX initial data for brand-page verification.
-- Prerequisite: apply 20260619000000_brands_and_product_colors.sql first.
-- This file is intentionally outside supabase/migrations and is not auto-applied.
-- The swatch colours are UI approximations, not manufacturer-provided colour codes.

begin;

insert into public.brands (
  slug,
  display_name,
  short_description,
  description,
  official_url,
  logo_asset_key,
  youtube_url,
  seo_title,
  seo_description,
  is_published
)
values (
  'cybex',
  'CYBEX',
  '洗練されたデザインと機能性を追求する、ドイツ発のベビー用品ブランド。',
  'CYBEXは、安全性・デザイン・機能性を大切にしながら、家族の移動を快適にするベビーカー、チャイルドシート、抱っこ紐などを展開しています。',
  'https://cybex-japan.com/',
  null,
  null,
  'CYBEX（サイベックス）の商品一覧 | IRODORI',
  'CYBEX（サイベックス）のブランド紹介と、ベビーカー・チャイルドシート・抱っこ紐の商品一覧です。',
  true
)
on conflict (slug) do update
set
  display_name = excluded.display_name,
  short_description = excluded.short_description,
  description = excluded.description,
  official_url = excluded.official_url,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  is_published = excluded.is_published;

-- Refuse to reuse an alias that already belongs to a different brand.
do $$
begin
  if exists (
    select 1
    from public.brand_aliases as aliases
    join public.brands as brands on brands.id = aliases.brand_id
    where lower(btrim(aliases.alias)) in ('サイベックス', 'cybex')
      and brands.slug <> 'cybex'
  ) then
    raise exception 'A CYBEX alias is already assigned to another brand';
  end if;
end $$;

-- CYBEX and cybex intentionally normalize to the same alias. The normalized
-- unique index stores one of them, while case-insensitive matching covers both.
insert into public.brand_aliases (brand_id, alias)
select brands.id, aliases.alias
from public.brands as brands
cross join (
  values
    ('サイベックス'),
    ('CYBEX'),
    ('cybex')
) as aliases(alias)
where brands.slug = 'cybex'
on conflict do nothing;

-- Only fill unassigned products. Existing manual brand_id values are preserved.
update public.products as products
set brand_id = brands.id
from public.brands as brands
where brands.slug = 'cybex'
  and products.brand_id is null
  and exists (
    select 1
    from public.brand_aliases as aliases
    where aliases.brand_id = brands.id
      and lower(btrim(aliases.alias)) = lower(btrim(products.brand))
  );

-- Guard against silently attaching colours to the wrong or renamed product.
do $$
declare
  matching_products integer;
begin
  select count(*)
  into matching_products
  from public.products as products
  join public.brands as brands on brands.id = products.brand_id
  where brands.slug = 'cybex'
    and products.name = 'メリオ カーボン 2026';

  if matching_products <> 1 then
    raise exception 'Expected exactly one CYBEX product named メリオ カーボン 2026, found %', matching_products;
  end if;
end $$;

insert into public.product_colors (
  product_id,
  name,
  color_family,
  swatch_hex,
  display_order,
  is_default
)
select
  products.id,
  colors.name,
  colors.color_family,
  colors.swatch_hex,
  colors.display_order,
  colors.is_default
from public.products as products
join public.brands as brands on brands.id = products.brand_id
cross join (
  values
    ('マジックブラックJP2',    'black', '#2B2B2B', 1, true),
    ('ストーミーブルーJP2',    'navy',  '#4F6475', 2, false),
    ('アーモンドベージュJP2',  'beige', '#D8C4A8', 3, false),
    ('モスグリーンJP2',        'green', '#707763', 4, false),
    ('チョコレートブラウンJP2','brown', '#6B4A3A', 5, false)
) as colors(name, color_family, swatch_hex, display_order, is_default)
where brands.slug = 'cybex'
  and products.name = 'メリオ カーボン 2026'
on conflict do nothing;

commit;

