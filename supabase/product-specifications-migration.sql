-- Product specification columns for public display.
-- This file only adds columns to public.products.
-- It does not change existing columns, product_affiliate_images, RLS, auth, or RPCs.

alter table public.products
  add column if not exists product_size text,
  add column if not exists folded_size text,
  add column if not exists applicable_weight text,
  add column if not exists load_capacity text,
  add column if not exists basket_capacity text,
  add column if not exists included_accessories text,
  add column if not exists warranty text,
  add column if not exists manufacturer_country text,
  add column if not exists caution_notes text,
  add column if not exists model_number text;

comment on column public.products.product_size is '公開用の商品仕様: 製品サイズ';
comment on column public.products.folded_size is '公開用の商品仕様: 収納サイズ';
comment on column public.products.applicable_weight is '公開用の商品仕様: 適応体重';
comment on column public.products.load_capacity is '公開用の商品仕様: 耐荷重';
comment on column public.products.basket_capacity is '公開用の商品仕様: バスケット容量';
comment on column public.products.included_accessories is '公開用の商品仕様: 付属品';
comment on column public.products.warranty is '公開用の商品仕様: 保証';
comment on column public.products.manufacturer_country is '公開用の商品仕様: メーカー所在国。製造国ではない。';
comment on column public.products.caution_notes is '公開用の商品仕様: 注意事項。memoは管理用、caution_notesは公開用。';
comment on column public.products.model_number is '公開用の商品仕様: 品番';

-- Confirmation SQL:
-- select
--   column_name,
--   data_type,
--   col_description(format('%s.%s', table_schema, table_name)::regclass::oid, ordinal_position) as column_comment
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'products'
--   and column_name in (
--     'product_size',
--     'folded_size',
--     'applicable_weight',
--     'load_capacity',
--     'basket_capacity',
--     'included_accessories',
--     'warranty',
--     'manufacturer_country',
--     'caution_notes',
--     'model_number'
--   )
-- order by ordinal_position;
