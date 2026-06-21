-- =========================================================
-- Site-wide asset management
-- Independent from products and product_uploaded_images.
-- =========================================================

create extension if not exists pgcrypto;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'site-assets',
  'site-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.site_assets (
  id uuid primary key default gen_random_uuid(),
  asset_key text not null unique
    check (
      asset_key = lower(btrim(asset_key))
      and asset_key ~ '^[a-z0-9][a-z0-9_-]*$'
    ),
  asset_type text not null
    check (asset_type in (
      'hero',
      'campaign',
      'feature',
      'diagnosis',
      'category',
      'article',
      'brand_logo'
    )),
  title text not null default '',
  alt_text text not null default '',
  caption text not null default '',
  desktop_image_url text not null,
  desktop_storage_path text not null unique,
  desktop_mime_type text not null
    check (desktop_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  desktop_width integer not null check (desktop_width > 0),
  desktop_height integer not null check (desktop_height > 0),
  mobile_image_url text,
  mobile_storage_path text unique,
  mobile_mime_type text
    check (mobile_mime_type is null or mobile_mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  mobile_width integer check (mobile_width is null or mobile_width > 0),
  mobile_height integer check (mobile_height is null or mobile_height > 0),
  link_url text,
  display_order integer not null default 1 check (display_order >= 1),
  is_published boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at),
  check (
    (
      mobile_image_url is null
      and mobile_storage_path is null
      and mobile_mime_type is null
      and mobile_width is null
      and mobile_height is null
    )
    or
    (
      mobile_image_url is not null
      and mobile_storage_path is not null
      and mobile_mime_type is not null
      and mobile_width is not null
      and mobile_height is not null
    )
  )
);

create index if not exists site_assets_public_order_idx
on public.site_assets (asset_type, is_published, display_order, created_at);

create index if not exists site_assets_publication_period_idx
on public.site_assets (starts_at, ends_at);

create or replace function public.touch_site_assets_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_site_assets_updated_at on public.site_assets;

create trigger touch_site_assets_updated_at
before update on public.site_assets
for each row
execute function public.touch_site_assets_updated_at();

alter table public.site_assets enable row level security;

revoke all on public.site_assets from anon;
revoke all on public.site_assets from authenticated;

-- No table policies are created. Reading and writing both go through RPCs.

drop policy if exists "Admins can read site asset objects" on storage.objects;
create policy "Admins can read site asset objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'site-assets'
  and public.is_admin()
);

drop policy if exists "Admins can upload site asset objects" on storage.objects;
create policy "Admins can upload site asset objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'site-assets'
  and public.is_admin()
  and name !~ '(^/|(^|/)\.\.(/|$))'
);

drop policy if exists "Admins can update site asset objects" on storage.objects;
create policy "Admins can update site asset objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'site-assets'
  and public.is_admin()
)
with check (
  bucket_id = 'site-assets'
  and public.is_admin()
  and name !~ '(^/|(^|/)\.\.(/|$))'
);

drop policy if exists "Admins can delete site asset objects" on storage.objects;
create policy "Admins can delete site asset objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'site-assets'
  and public.is_admin()
);

create or replace function public.validate_site_asset_input(
  p_asset_key text,
  p_asset_type text,
  p_desktop_image_url text,
  p_desktop_storage_path text,
  p_desktop_mime_type text,
  p_desktop_width integer,
  p_desktop_height integer,
  p_mobile_image_url text,
  p_mobile_storage_path text,
  p_mobile_mime_type text,
  p_mobile_width integer,
  p_mobile_height integer,
  p_link_url text,
  p_display_order integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  has_any_mobile_value boolean;
  has_all_mobile_values boolean;
  normalized_link text;
begin
  if p_asset_key is null
     or p_asset_key <> lower(btrim(p_asset_key))
     or p_asset_key !~ '^[a-z0-9][a-z0-9_-]*$' then
    raise exception 'asset_key must contain only lowercase letters, numbers, underscores, and hyphens';
  end if;

  if p_asset_type not in (
    'hero', 'campaign', 'feature', 'diagnosis', 'category', 'article', 'brand_logo'
  ) then
    raise exception 'invalid asset_type';
  end if;

  if p_desktop_storage_path is null
     or length(btrim(p_desktop_storage_path)) = 0
     or p_desktop_storage_path ~ '(^/|(^|/)\.\.(/|$))' then
    raise exception 'invalid desktop storage path';
  end if;

  if p_desktop_image_url is null
     or position('/storage/v1/object/public/site-assets/' in p_desktop_image_url) = 0 then
    raise exception 'invalid desktop image url';
  end if;

  if p_desktop_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'unsupported desktop mime type';
  end if;

  if p_desktop_width <= 0 or p_desktop_height <= 0 then
    raise exception 'desktop image dimensions must be positive';
  end if;

  has_any_mobile_value :=
    p_mobile_image_url is not null
    or p_mobile_storage_path is not null
    or p_mobile_mime_type is not null
    or p_mobile_width is not null
    or p_mobile_height is not null;

  has_all_mobile_values :=
    p_mobile_image_url is not null
    and p_mobile_storage_path is not null
    and p_mobile_mime_type is not null
    and p_mobile_width is not null
    and p_mobile_height is not null;

  if has_any_mobile_value and not has_all_mobile_values then
    raise exception 'mobile image metadata must be supplied together';
  end if;

  if has_all_mobile_values then
    if length(btrim(p_mobile_storage_path)) = 0
       or p_mobile_storage_path ~ '(^/|(^|/)\.\.(/|$))' then
      raise exception 'invalid mobile storage path';
    end if;

    if position('/storage/v1/object/public/site-assets/' in p_mobile_image_url) = 0 then
      raise exception 'invalid mobile image url';
    end if;

    if p_mobile_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
      raise exception 'unsupported mobile mime type';
    end if;

    if p_mobile_width <= 0 or p_mobile_height <= 0 then
      raise exception 'mobile image dimensions must be positive';
    end if;
  end if;

  normalized_link := nullif(btrim(coalesce(p_link_url, '')), '');
  if normalized_link is not null
     and not (
       normalized_link ~ '^/($|[^/])'
       or normalized_link ~* '^https?://'
     ) then
    raise exception 'link_url must be an internal path or an http/https URL';
  end if;

  if normalized_link ~* '^(javascript|data|vbscript):' then
    raise exception 'unsafe link_url scheme';
  end if;

  if p_display_order < 1 then
    raise exception 'display_order must be greater than or equal to 1';
  end if;

  if p_starts_at is not null and p_ends_at is not null and p_ends_at < p_starts_at then
    raise exception 'ends_at must be greater than or equal to starts_at';
  end if;
end;
$$;

revoke all on function public.validate_site_asset_input(
  text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, timestamptz, timestamptz
) from public;

create or replace function public.list_site_assets()
returns setof public.site_assets
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
  from public.site_assets
  order by asset_type, display_order, created_at;
end;
$$;

create or replace function public.get_published_site_assets(
  p_asset_type text default null,
  p_asset_key text default null
)
returns table (
  id uuid,
  asset_key text,
  asset_type text,
  title text,
  alt_text text,
  caption text,
  desktop_image_url text,
  desktop_width integer,
  desktop_height integer,
  mobile_image_url text,
  mobile_width integer,
  mobile_height integer,
  link_url text,
  display_order integer,
  starts_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    assets.id,
    assets.asset_key,
    assets.asset_type,
    assets.title,
    assets.alt_text,
    assets.caption,
    assets.desktop_image_url,
    assets.desktop_width,
    assets.desktop_height,
    coalesce(assets.mobile_image_url, assets.desktop_image_url) as mobile_image_url,
    coalesce(assets.mobile_width, assets.desktop_width) as mobile_width,
    coalesce(assets.mobile_height, assets.desktop_height) as mobile_height,
    assets.link_url,
    assets.display_order,
    assets.starts_at,
    assets.ends_at,
    assets.updated_at
  from public.site_assets as assets
  where assets.is_published = true
    and (assets.starts_at is null or assets.starts_at <= now())
    and (assets.ends_at is null or assets.ends_at >= now())
    and (p_asset_type is null or assets.asset_type = p_asset_type)
    and (p_asset_key is null or assets.asset_key = lower(btrim(p_asset_key)))
  order by assets.display_order, assets.created_at;
$$;

create or replace function public.create_site_asset(
  p_asset_key text,
  p_asset_type text,
  p_title text,
  p_alt_text text,
  p_caption text,
  p_desktop_image_url text,
  p_desktop_storage_path text,
  p_desktop_mime_type text,
  p_desktop_width integer,
  p_desktop_height integer,
  p_mobile_image_url text,
  p_mobile_storage_path text,
  p_mobile_mime_type text,
  p_mobile_width integer,
  p_mobile_height integer,
  p_link_url text,
  p_display_order integer,
  p_is_published boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns public.site_assets
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_row public.site_assets;
  normalized_asset_key text := lower(btrim(p_asset_key));
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  perform public.validate_site_asset_input(
    normalized_asset_key, p_asset_type,
    p_desktop_image_url, p_desktop_storage_path, p_desktop_mime_type,
    p_desktop_width, p_desktop_height,
    p_mobile_image_url, p_mobile_storage_path, p_mobile_mime_type,
    p_mobile_width, p_mobile_height,
    p_link_url, p_display_order, p_starts_at, p_ends_at
  );

  insert into public.site_assets (
    asset_key, asset_type, title, alt_text, caption,
    desktop_image_url, desktop_storage_path, desktop_mime_type,
    desktop_width, desktop_height,
    mobile_image_url, mobile_storage_path, mobile_mime_type,
    mobile_width, mobile_height,
    link_url, display_order, is_published, starts_at, ends_at, created_by
  ) values (
    normalized_asset_key, p_asset_type, coalesce(p_title, ''), coalesce(p_alt_text, ''), coalesce(p_caption, ''),
    p_desktop_image_url, p_desktop_storage_path, p_desktop_mime_type,
    p_desktop_width, p_desktop_height,
    p_mobile_image_url, p_mobile_storage_path, p_mobile_mime_type,
    p_mobile_width, p_mobile_height,
    nullif(btrim(coalesce(p_link_url, '')), ''),
    p_display_order, coalesce(p_is_published, false), p_starts_at, p_ends_at, auth.uid()
  )
  returning * into inserted_row;

  return inserted_row;
end;
$$;

create or replace function public.update_site_asset(
  p_asset_id uuid,
  p_asset_key text,
  p_asset_type text,
  p_title text,
  p_alt_text text,
  p_caption text,
  p_desktop_image_url text,
  p_desktop_storage_path text,
  p_desktop_mime_type text,
  p_desktop_width integer,
  p_desktop_height integer,
  p_mobile_image_url text,
  p_mobile_storage_path text,
  p_mobile_mime_type text,
  p_mobile_width integer,
  p_mobile_height integer,
  p_link_url text,
  p_display_order integer,
  p_is_published boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.site_assets;
  updated_row public.site_assets;
  normalized_asset_key text := lower(btrim(p_asset_key));
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select *
  into current_row
  from public.site_assets
  where id = p_asset_id
  for update;

  if current_row.id is null then
    raise exception 'site asset not found';
  end if;

  perform public.validate_site_asset_input(
    normalized_asset_key, p_asset_type,
    p_desktop_image_url, p_desktop_storage_path, p_desktop_mime_type,
    p_desktop_width, p_desktop_height,
    p_mobile_image_url, p_mobile_storage_path, p_mobile_mime_type,
    p_mobile_width, p_mobile_height,
    p_link_url, p_display_order, p_starts_at, p_ends_at
  );

  update public.site_assets
  set
    asset_key = normalized_asset_key,
    asset_type = p_asset_type,
    title = coalesce(p_title, ''),
    alt_text = coalesce(p_alt_text, ''),
    caption = coalesce(p_caption, ''),
    desktop_image_url = p_desktop_image_url,
    desktop_storage_path = p_desktop_storage_path,
    desktop_mime_type = p_desktop_mime_type,
    desktop_width = p_desktop_width,
    desktop_height = p_desktop_height,
    mobile_image_url = p_mobile_image_url,
    mobile_storage_path = p_mobile_storage_path,
    mobile_mime_type = p_mobile_mime_type,
    mobile_width = p_mobile_width,
    mobile_height = p_mobile_height,
    link_url = nullif(btrim(coalesce(p_link_url, '')), ''),
    display_order = p_display_order,
    is_published = coalesce(p_is_published, false),
    starts_at = p_starts_at,
    ends_at = p_ends_at
  where id = p_asset_id
  returning * into updated_row;

  return jsonb_build_object(
    'asset', to_jsonb(updated_row),
    'old_desktop_storage_path',
    case
      when current_row.desktop_storage_path is distinct from updated_row.desktop_storage_path
      then current_row.desktop_storage_path
      else null
    end,
    'old_mobile_storage_path',
    case
      when current_row.mobile_storage_path is distinct from updated_row.mobile_storage_path
      then current_row.mobile_storage_path
      else null
    end
  );
end;
$$;

create or replace function public.delete_site_asset(
  p_asset_id uuid
)
returns table (
  desktop_storage_path text,
  mobile_storage_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_row public.site_assets;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select *
  into target_row
  from public.site_assets
  where id = p_asset_id
  for update;

  if target_row.id is null then
    raise exception 'site asset not found';
  end if;

  delete from public.site_assets where id = p_asset_id;

  desktop_storage_path := target_row.desktop_storage_path;
  mobile_storage_path := target_row.mobile_storage_path;
  return next;
end;
$$;

revoke all on function public.list_site_assets() from public;
revoke all on function public.get_published_site_assets(text, text) from public;
revoke all on function public.create_site_asset(
  text, text, text, text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, boolean, timestamptz, timestamptz
) from public;
revoke all on function public.update_site_asset(
  uuid, text, text, text, text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, boolean, timestamptz, timestamptz
) from public;
revoke all on function public.delete_site_asset(uuid) from public;

grant execute on function public.list_site_assets() to authenticated;
grant execute on function public.get_published_site_assets(text, text) to anon, authenticated;
grant execute on function public.create_site_asset(
  text, text, text, text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, boolean, timestamptz, timestamptz
) to authenticated;
grant execute on function public.update_site_asset(
  uuid, text, text, text, text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, boolean, timestamptz, timestamptz
) to authenticated;
grant execute on function public.delete_site_asset(uuid) to authenticated;

-- Example public reads:
-- select * from public.get_published_site_assets('hero', null);
-- select * from public.get_published_site_assets(null, 'home_main_hero');
