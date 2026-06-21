-- Store parsed Rakuten affiliate values and support safe bulk registration.
-- Existing HTML/image/YouTube columns and RPCs are preserved.

alter table public.product_affiliate_images add column if not exists image_url text;
alter table public.product_affiliate_images add column if not exists affiliate_url text;
alter table public.product_affiliate_images add column if not exists source_type text;
alter table public.product_affiliate_images add column if not exists rakuten_item_url text;
alter table public.product_affiliate_images add column if not exists rakuten_me_id text;
alter table public.product_affiliate_images add column if not exists rakuten_item_id text;
alter table public.product_affiliate_images add column if not exists rakuten_shop_key text;
alter table public.product_affiliate_images add column if not exists rakuten_affiliate_path text;
alter table public.product_affiliate_images add column if not exists rakuten_image_size text;

-- Populate URL columns for existing Rakuten HTML rows so duplicate checks also
-- cover images that were registered before this migration.
update public.product_affiliate_images
set image_url = replace(
  substring(rakuten_image_html from $re$<img[^>]*src=["']([^"']+)["']$re$),
  '&amp;', '&'
)
where media_type = 'image'
  and image_url is null
  and rakuten_image_html is not null;

update public.product_affiliate_images
set affiliate_url = replace(
  substring(rakuten_image_html from $re$<a[^>]*href=["']([^"']+)["']$re$),
  '&amp;', '&'
)
where media_type = 'image'
  and affiliate_url is null
  and rakuten_image_html is not null;

create index if not exists product_affiliate_images_image_url_idx
on public.product_affiliate_images (product_id, image_url)
where image_url is not null;

create index if not exists product_affiliate_images_affiliate_url_idx
on public.product_affiliate_images (product_id, affiliate_url)
where affiliate_url is not null;

create table if not exists public.rakuten_affiliate_shop_settings (
  shop_key text primary key,
  me_id text not null,
  affiliate_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rakuten_affiliate_shop_settings_shop_key_check
    check (shop_key ~ '^[A-Za-z0-9_-]+$'),
  constraint rakuten_affiliate_shop_settings_me_id_check
    check (me_id ~ '^[A-Za-z0-9_-]+$'),
  constraint rakuten_affiliate_shop_settings_path_check
    check (affiliate_path ~ '^[A-Za-z0-9.]+/$')
);

alter table public.rakuten_affiliate_shop_settings enable row level security;

drop policy if exists "Admins can view Rakuten affiliate settings"
on public.rakuten_affiliate_shop_settings;
create policy "Admins can view Rakuten affiliate settings"
on public.rakuten_affiliate_shop_settings for select
to authenticated using (public.is_admin());

drop policy if exists "Admins can insert Rakuten affiliate settings"
on public.rakuten_affiliate_shop_settings;
create policy "Admins can insert Rakuten affiliate settings"
on public.rakuten_affiliate_shop_settings for insert
to authenticated with check (public.is_admin());

drop policy if exists "Admins can update Rakuten affiliate settings"
on public.rakuten_affiliate_shop_settings;
create policy "Admins can update Rakuten affiliate settings"
on public.rakuten_affiliate_shop_settings for update
to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.create_rakuten_affiliate_images_bulk(
  p_product_id text,
  p_items jsonb,
  p_role text default 'main'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  product_id_type text;
  product_exists boolean;
  item jsonb;
  affiliate_url_value text;
  image_url_value text;
  item_url_value text;
  me_id_value text;
  item_id_value text;
  shop_key_value text;
  affiliate_path_value text;
  image_size_value text;
  display_order_value integer;
  safe_html text;
  inserted_count integer := 0;
  skipped_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  if p_role not in ('main', 'color', 'detail', 'folded', 'usage') then
    raise exception 'invalid role';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'at least one parsed image is required';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'a maximum of 30 images can be registered at once';
  end if;

  select format_type(a.atttypid, a.atttypmod)
  into product_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'products'
    and a.attname = 'id' and a.attnum > 0 and not a.attisdropped;
  if product_id_type is null then raise exception 'public.products.id was not found'; end if;

  execute format('select exists (select 1 from public.products where id = $1::%s)', product_id_type)
  into product_exists using p_product_id;
  if not product_exists then raise exception 'product not found'; end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    affiliate_url_value := btrim(coalesce(item->>'affiliate_url', ''));
    image_url_value := btrim(coalesce(item->>'image_url', ''));
    item_url_value := btrim(coalesce(item->>'rakuten_item_url', ''));
    me_id_value := btrim(coalesce(item->>'me_id', ''));
    item_id_value := btrim(coalesce(item->>'item_id', ''));
    shop_key_value := btrim(coalesce(item->>'shop_key', ''));
    affiliate_path_value := btrim(coalesce(item->>'affiliate_path', ''));
    image_size_value := btrim(coalesce(item->>'image_size', ''));
    display_order_value := greatest(coalesce((item->>'display_order')::integer, 1), 1);

    if affiliate_url_value !~ '^https://hb\.afl\.rakuten\.co\.jp/ichiba/'
       or image_url_value !~ '^https://hbb\.afl\.rakuten\.co\.jp/hgb/'
       or item_url_value !~ '^https://item\.rakuten\.co\.jp/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/$'
       or affiliate_url_value ~ '["<>]'
       or image_url_value ~ '["<>]'
       or me_id_value !~ '^[A-Za-z0-9_-]+$'
       or item_id_value !~ '^[A-Za-z0-9_-]+$'
       or shop_key_value !~ '^[A-Za-z0-9_-]+$'
       or affiliate_path_value !~ '^[A-Za-z0-9.]+/$' then
      raise exception 'invalid Rakuten affiliate item';
    end if;

    if exists (
      select 1 from public.product_affiliate_images pai
      where pai.product_id::text = p_product_id
        and pai.image_url = image_url_value
    ) then
      skipped_count := skipped_count + 1;
      continue;
    end if;

    safe_html := '<a href="' || replace(affiliate_url_value, '&', '&amp;') ||
      '" target="_blank" rel="nofollow sponsored noopener"><img src="' ||
      replace(image_url_value, '&', '&amp;') || '" alt=""></a>';

    execute format(
      'insert into public.product_affiliate_images (
         product_id, mall, role, rakuten_image_html, is_primary, display_order, sort_order,
         media_type, source_type, image_url, affiliate_url, rakuten_item_url,
         rakuten_me_id, rakuten_item_id, rakuten_shop_key, rakuten_affiliate_path, rakuten_image_size
       ) values (
         $1::%s, ''rakuten'', $2, $3, false, $4, $4,
         ''image'', ''rakuten_affiliate'', $5, $6, $7, $8, $9, $10, $11, $12
       )',
      product_id_type
    ) using p_product_id, p_role, safe_html, display_order_value,
      image_url_value, affiliate_url_value, item_url_value, me_id_value,
      item_id_value, shop_key_value, affiliate_path_value, image_size_value;

    insert into public.rakuten_affiliate_shop_settings (shop_key, me_id, affiliate_path)
    values (shop_key_value, me_id_value, affiliate_path_value)
    on conflict (shop_key) do update set
      me_id = excluded.me_id,
      affiliate_path = excluded.affiliate_path,
      updated_at = now();

    inserted_count := inserted_count + 1;
  end loop;

  return jsonb_build_object('inserted', inserted_count, 'skipped', skipped_count);
end;
$$;

revoke all on function public.create_rakuten_affiliate_images_bulk(text, jsonb, text) from public;
grant execute on function public.create_rakuten_affiliate_images_bulk(text, jsonb, text) to authenticated;
