-- Rakuten shop learning, explicit setting updates, and deterministic media ordering.
-- This migration does not delete or rename existing columns or media rows.

alter table public.rakuten_affiliate_shop_settings
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists sample_affiliate_url text,
  add column if not exists sample_item_url text;

update public.rakuten_affiliate_shop_settings
set id = gen_random_uuid()
where id is null;

alter table public.rakuten_affiliate_shop_settings
  alter column id set default gen_random_uuid(),
  alter column id set not null;

create unique index if not exists rakuten_affiliate_shop_settings_id_uidx
on public.rakuten_affiliate_shop_settings (id);

create or replace function public.prevent_duplicate_product_affiliate_media_urls()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.product_affiliate_images existing
    where existing.product_id = new.product_id
      and existing.id is distinct from new.id
      and (
        (new.image_url is not null and existing.image_url = new.image_url)
        or (new.affiliate_url is not null and existing.affiliate_url = new.affiliate_url)
      )
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_duplicate_product_affiliate_media_urls
on public.product_affiliate_images;
create trigger prevent_duplicate_product_affiliate_media_urls
before insert or update of image_url, affiliate_url, product_id
on public.product_affiliate_images
for each row execute function public.prevent_duplicate_product_affiliate_media_urls();

create or replace function public.update_rakuten_affiliate_shop_setting(
  p_shop_key text,
  p_me_id text,
  p_affiliate_path text,
  p_sample_affiliate_url text,
  p_sample_item_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_shop_key !~ '^[A-Za-z0-9_-]+$'
     or p_me_id !~ '^[A-Za-z0-9_-]+$'
     or p_affiliate_path !~ '^[A-Za-z0-9.]+/$'
     or p_sample_affiliate_url !~ '^https://hb\.afl\.rakuten\.co\.jp/ichiba/'
     or p_sample_item_url !~ '^https://item\.rakuten\.co\.jp/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/$' then
    raise exception 'invalid Rakuten affiliate shop setting';
  end if;

  perform set_config('irodori.allow_rakuten_setting_update', 'true', true);
  update public.rakuten_affiliate_shop_settings
  set me_id = p_me_id,
      affiliate_path = p_affiliate_path,
      sample_affiliate_url = p_sample_affiliate_url,
      sample_item_url = p_sample_item_url,
      updated_at = now()
  where shop_key = p_shop_key;

  if not found then raise exception 'shop setting not found'; end if;
end;
$$;

revoke all on function public.update_rakuten_affiliate_shop_setting(text, text, text, text, text) from public;
grant execute on function public.update_rakuten_affiliate_shop_setting(text, text, text, text, text) to authenticated;

create or replace function public.guard_rakuten_affiliate_shop_setting_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.me_id, new.affiliate_path) is distinct from (old.me_id, old.affiliate_path)
     and coalesce(current_setting('irodori.allow_rakuten_setting_update', true), '') <> 'true' then
    new.me_id := old.me_id;
    new.affiliate_path := old.affiliate_path;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_rakuten_affiliate_shop_setting_update
on public.rakuten_affiliate_shop_settings;
create trigger guard_rakuten_affiliate_shop_setting_update
before update on public.rakuten_affiliate_shop_settings
for each row execute function public.guard_rakuten_affiliate_shop_setting_update();

create or replace function public.normalize_product_affiliate_media_order(p_product_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  with ordered as (
    select id,
           row_number() over (
             order by coalesce(sort_order, display_order, 2147483647), created_at, id
           )::integer as next_order
    from public.product_affiliate_images
    where product_id::text = p_product_id
  )
  update public.product_affiliate_images target
  set display_order = ordered.next_order,
      sort_order = ordered.next_order
  from ordered
  where target.id = ordered.id;
end;
$$;

create or replace function public.normalize_product_uploaded_image_order(p_product_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  with ordered as (
    select id,
           row_number() over (
             order by coalesce(display_order, 2147483647), created_at, id
           )::integer as next_order
    from public.product_uploaded_images
    where product_id::text = p_product_id
  )
  update public.product_uploaded_images target
  set display_order = ordered.next_order
  from ordered
  where target.id = ordered.id;
end;
$$;

create or replace function public.reorder_product_affiliate_media(
  p_product_id text,
  p_ordered_ids text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_count integer;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select count(*) into expected_count
  from public.product_affiliate_images
  where product_id::text = p_product_id;

  if coalesce(array_length(p_ordered_ids, 1), 0) <> expected_count
     or exists (
       select 1
       from unnest(p_ordered_ids) requested(id)
       left join public.product_affiliate_images image
         on image.id::text = requested.id and image.product_id::text = p_product_id
       where image.id is null
     ) then
    raise exception 'ordered media list does not match the product';
  end if;

  with requested as (
    select id, ordinality::integer as next_order
    from unnest(p_ordered_ids) with ordinality as value(id, ordinality)
  )
  update public.product_affiliate_images target
  set display_order = requested.next_order,
      sort_order = requested.next_order
  from requested
  where target.id::text = requested.id
    and target.product_id::text = p_product_id;
end;
$$;

revoke all on function public.normalize_product_affiliate_media_order(text) from public;
revoke all on function public.normalize_product_uploaded_image_order(text) from public;
revoke all on function public.reorder_product_affiliate_media(text, text[]) from public;
grant execute on function public.normalize_product_affiliate_media_order(text) to authenticated;
grant execute on function public.normalize_product_uploaded_image_order(text) to authenticated;
grant execute on function public.reorder_product_affiliate_media(text, text[]) to authenticated;

-- Repair pre-existing duplicates once, without changing relative order.
with ordered as (
  select id,
         row_number() over (
           partition by product_id
           order by coalesce(sort_order, display_order, 2147483647), created_at, id
         )::integer as next_order
  from public.product_affiliate_images
)
update public.product_affiliate_images target
set display_order = ordered.next_order,
    sort_order = ordered.next_order
from ordered
where target.id = ordered.id;

with ordered as (
  select id,
         row_number() over (
           partition by product_id
           order by coalesce(display_order, 2147483647), created_at, id
         )::integer as next_order
  from public.product_uploaded_images
)
update public.product_uploaded_images target
set display_order = ordered.next_order
from ordered
where target.id = ordered.id;

-- The bulk importer learns only a previously unknown shop automatically.
-- Updating a learned path is intentionally performed by the explicit RPC above.
create or replace function public.remember_rakuten_affiliate_shop_setting(
  p_shop_key text,
  p_me_id text,
  p_affiliate_path text,
  p_sample_affiliate_url text,
  p_sample_item_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_shop_key !~ '^[A-Za-z0-9_-]+$'
     or p_me_id !~ '^[A-Za-z0-9_-]+$'
     or p_affiliate_path !~ '^[A-Za-z0-9.]+/$' then
    raise exception 'invalid Rakuten affiliate shop setting';
  end if;
  insert into public.rakuten_affiliate_shop_settings (
    shop_key, me_id, affiliate_path, sample_affiliate_url, sample_item_url
  ) values (
    p_shop_key, p_me_id, p_affiliate_path, p_sample_affiliate_url, p_sample_item_url
  ) on conflict (shop_key) do update set
    sample_affiliate_url = coalesce(rakuten_affiliate_shop_settings.sample_affiliate_url, excluded.sample_affiliate_url),
    sample_item_url = coalesce(rakuten_affiliate_shop_settings.sample_item_url, excluded.sample_item_url);
end;
$$;

revoke all on function public.remember_rakuten_affiliate_shop_setting(text, text, text, text, text) from public;
grant execute on function public.remember_rakuten_affiliate_shop_setting(text, text, text, text, text) to authenticated;
