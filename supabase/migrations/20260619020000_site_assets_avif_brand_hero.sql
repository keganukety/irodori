-- Extend site asset management with AVIF and dedicated brand hero assets.
-- Existing asset rows, RPC signatures, auth checks and storage policies are preserved.

begin;

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
where id = 'site-assets';

alter table public.site_assets
  drop constraint if exists site_assets_asset_type_check,
  drop constraint if exists site_assets_desktop_mime_type_check,
  drop constraint if exists site_assets_mobile_mime_type_check;

alter table public.site_assets
  add constraint site_assets_asset_type_check
    check (asset_type in (
      'hero', 'campaign', 'feature', 'diagnosis', 'category', 'article',
      'brand_logo', 'brand_hero'
    )),
  add constraint site_assets_desktop_mime_type_check
    check (desktop_mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
  add constraint site_assets_mobile_mime_type_check
    check (mobile_mime_type is null or mobile_mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif'));

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
    'hero', 'campaign', 'feature', 'diagnosis', 'category', 'article',
    'brand_logo', 'brand_hero'
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

  if p_desktop_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/avif') then
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

    if p_mobile_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/avif') then
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

create or replace function public.link_brand_site_asset(
  p_brand_id uuid,
  p_asset_type text,
  p_asset_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if p_asset_type not in ('brand_logo', 'brand_hero') then
    raise exception 'invalid brand asset type';
  end if;

  if not exists (
    select 1
    from public.site_assets
    where asset_key = p_asset_key
      and asset_type = p_asset_type
  ) then
    raise exception 'matching site asset not found';
  end if;

  if p_asset_type = 'brand_logo' then
    execute 'update public.brands set logo_asset_key = $1 where id = $2'
      using p_asset_key, p_brand_id;
  else
    if not exists (
      select 1
      from pg_attribute
      where attrelid = 'public.brands'::regclass
        and attname = 'hero_asset_key'
        and attnum > 0
        and not attisdropped
    ) then
      raise exception 'hero_asset_key is not applied';
    end if;
    execute 'update public.brands set hero_asset_key = $1 where id = $2'
      using p_asset_key, p_brand_id;
  end if;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'brand not found';
  end if;
end;
$$;

revoke all on function public.link_brand_site_asset(uuid, text, text) from public;
grant execute on function public.link_brand_site_asset(uuid, text, text) to authenticated;

commit;

