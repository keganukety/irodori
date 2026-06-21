-- Correct existing product rows in place and add only verified/identified colors.
-- Existing product IDs, rank_no values, images, affiliate links, and legacy brand text are preserved.

-- Rename the existing Combi row without replacing its ID.
update public.products
set name = 'auto N second QC',
    brand = 'Combi',
    category = 'ベビーカー',
    product_type = 'B型・セカンドベビーカー',
    target_age = '生後6カ月〜48カ月頃まで',
    applicable_weight = '体重22kg以下',
    weight_kg = 5.9,
    product_size = '開：W400×D885×H1050〜1095mm',
    folded_size = '閉：W400×D220〜340×H560mm',
    memo = concat_ws(E'\n', nullif(memo, ''), '発売日：2026/4/17'),
    spec_checked_date = date '2026-06-21'
where lower(btrim(name)) = lower('auto N second BQ');

-- Replace only the lower-ranked duplicate Karoon row. rank_no and ID are not updated.
with duplicate_rows as (
  select id,
         row_number() over (order by rank_no asc nulls last, id) as duplicate_position
  from public.products
  where regexp_replace(name, '[[:space:]　]+', '', 'g') in (
    'カルーンエアメッシュAC',
    'カルーンエアーメッシュAC'
  )
), lower_duplicate as (
  select id from duplicate_rows where duplicate_position = 2
)
update public.products product
set brand = 'サイベックス',
    brand_id = (select id from public.brands where slug = 'cybex' limit 1),
    name = 'ミオス',
    category = 'ベビーカー',
    product_type = 'A型・両対面式',
    target_age = '生後1カ月頃〜4歳頃まで',
    weight_kg = 10.2,
    product_size = 'W500×D840〜920×H1080mm',
    folded_size = 'W500×D300×H650mm',
    applicable_weight = '22kgまで',
    load_capacity = '22kgまで',
    official_url = 'https://www.cybex-online.com/ja/jp/p/st-go-mios-3.html',
    spec_source_url = 'https://www.cybex-online.com/ja/jp/p/st-go-mios-3.html',
    spec_checked_date = date '2026-06-21',
    memo = concat_ws(E'\n', nullif(product.memo, ''), '正式商品名候補：ミオス スタイル')
from lower_duplicate
where product.id = lower_duplicate.id;

-- Repair the Bingle label in stored text as well as preventing CSS truncation.
update public.products
set product_type = 'B型・シングルタイヤ'
where regexp_replace(name, '[[:space:]　]+', '', 'g') ilike '%ビングルBB6%';

-- products.feature_tags has existed as text in the current project, but this
-- conditional also keeps the migration safe in environments that use text[].
do $$
declare feature_tags_type text;
begin
  select udt_name into feature_tags_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'products' and column_name = 'feature_tags';

  if feature_tags_type = '_text' then
    update public.products
    set feature_tags = array['A型', '両対面', 'コンパクト', '4輪サスペンション']
    where regexp_replace(name, '[[:space:]　]+', '', 'g') in ('ミオス', 'ミオススタイル');
    update public.products
    set feature_tags = array_replace(feature_tags, 'B型・シングルタ', 'B型・シングルタイヤ')
    where regexp_replace(name, '[[:space:]　]+', '', 'g') ilike '%ビングルBB6%';
  elsif feature_tags_type = 'text' then
    update public.products
    set feature_tags = 'A型, 両対面, コンパクト, 4輪サスペンション'
    where regexp_replace(name, '[[:space:]　]+', '', 'g') in ('ミオス', 'ミオススタイル');
    update public.products
    set feature_tags = replace(coalesce(feature_tags, ''), 'B型・シングルタ', 'B型・シングルタイヤ')
    where regexp_replace(name, '[[:space:]　]+', '', 'g') ilike '%ビングルBB6%';
  end if;
end;
$$;

-- Colors supplied for the official auto N second QC product page.
insert into public.product_colors (
  product_id, name, color_family, swatch_hex, display_order, is_default
)
select product.id, color.name, color.color_family, color.swatch_hex, color.display_order,
       color.is_default and not exists (
         select 1 from public.product_colors default_color
         where default_color.product_id = product.id and default_color.is_default
       )
from public.products product
cross join (values
  ('ウォームグレージュ', 'ベージュ', '#B7AA9D', 1, true),
  ('ディープグリーン', 'グリーン', '#314B43', 2, false),
  ('アイスグレー', 'グレー', '#C9CFD0', 3, false)
) as color(name, color_family, swatch_hex, display_order, is_default)
where lower(btrim(product.name)) = lower('auto N second QC')
  and not exists (
    select 1 from public.product_colors existing
    where existing.product_id = product.id and lower(existing.name) = lower(color.name)
  );

-- Current MIOS fabric color names. Swatches are UI approximations; names are the stored product choices.
insert into public.product_colors (
  product_id, name, color_family, swatch_hex, display_order, is_default
)
select product.id, color.name, color.color_family, color.swatch_hex, color.display_order,
       color.is_default and not exists (
         select 1 from public.product_colors default_color
         where default_color.product_id = product.id and default_color.is_default
       )
from public.products product
cross join (values
  ('セピアブラック', 'ブラック', '#292827', 1, true),
  ('ミラージュグレー', 'グレー', '#A7A5A0', 2, false),
  ('コージーベージュ', 'ベージュ', '#C7B9A5', 3, false),
  ('リーフグリーン', 'グリーン', '#6F7867', 4, false)
) as color(name, color_family, swatch_hex, display_order, is_default)
where regexp_replace(product.name, '[[:space:]　]+', '', 'g') in ('ミオス', 'ミオススタイル')
  and lower(product.brand) in (lower('サイベックス'), lower('CYBEX'))
  and not exists (
    select 1 from public.product_colors existing
    where existing.product_id = product.id and lower(existing.name) = lower(color.name)
  );

-- Bingle BB6 colors are intentionally not guessed here. Add them after the current
-- official page can be verified; this keeps product_colors authoritative.
