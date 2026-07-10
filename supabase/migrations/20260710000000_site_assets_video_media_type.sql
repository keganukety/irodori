-- Extend site_assets so the same asset workflow can manage uploaded videos.
-- Existing records stay media_type = 'image'; existing RPC argument lists are preserved.

begin;

update storage.buckets
set
  file_size_limit = 31457280,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/svg+xml',
    'video/mp4',
    'video/webm'
  ]::text[]
where id = 'site-assets';

alter table public.site_assets
  add column if not exists media_type text not null default 'image';

update public.site_assets
set media_type = 'image'
where media_type is null;

alter table public.site_assets
  drop constraint if exists site_assets_asset_type_check,
  drop constraint if exists site_assets_desktop_mime_type_check,
  drop constraint if exists site_assets_mobile_mime_type_check,
  drop constraint if exists site_assets_media_type_check,
  drop constraint if exists site_assets_media_mime_type_check;

alter table public.site_assets
  add constraint site_assets_asset_type_check
    check (asset_type in (
      'hero', 'campaign', 'feature', 'diagnosis', 'category', 'article',
      'brand_logo', 'brand_hero', 'icon'
    )),
  add constraint site_assets_media_type_check
    check (media_type in ('image', 'video')),
  add constraint site_assets_desktop_mime_type_check
    check (desktop_mime_type in (
      'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml',
      'video/mp4', 'video/webm'
    )),
  add constraint site_assets_mobile_mime_type_check
    check (mobile_mime_type is null or mobile_mime_type in (
      'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml',
      'video/mp4', 'video/webm'
    )),
  add constraint site_assets_media_mime_type_check
    check (
      (
        media_type = 'image'
        and desktop_mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml')
        and (mobile_mime_type is null or mobile_mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'))
      )
      or
      (
        media_type = 'video'
        and desktop_mime_type in ('video/mp4', 'video/webm')
        and (mobile_mime_type is null or mobile_mime_type in ('video/mp4', 'video/webm'))
      )
    );

comment on column public.site_assets.media_type is
  'Primary media kind for this site asset. Existing desktop_image_url/mobile_image_url columns store the public media URL for both images and videos.';

create or replace function public.infer_site_asset_media_type(
  p_mime_type text
)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_mime_type in ('video/mp4', 'video/webm') then 'video'
    when p_mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml') then 'image'
    else null
  end;
$$;

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
  desktop_media_type text := public.infer_site_asset_media_type(p_desktop_mime_type);
  mobile_media_type text := public.infer_site_asset_media_type(p_mobile_mime_type);
begin
  if p_asset_key is null
     or p_asset_key <> lower(btrim(p_asset_key))
     or p_asset_key !~ '^[a-z0-9][a-z0-9_-]*$' then
    raise exception 'asset_key must contain only lowercase letters, numbers, underscores, and hyphens';
  end if;

  if p_asset_type not in (
    'hero', 'campaign', 'feature', 'diagnosis', 'category', 'article',
    'brand_logo', 'brand_hero', 'icon'
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
    raise exception 'invalid desktop media url';
  end if;

  if desktop_media_type is null then
    raise exception 'unsupported desktop mime type';
  end if;

  if p_desktop_width <= 0 or p_desktop_height <= 0 then
    raise exception 'desktop media dimensions must be positive';
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
    raise exception 'mobile media metadata must be supplied together';
  end if;

  if has_all_mobile_values then
    if length(btrim(p_mobile_storage_path)) = 0
       or p_mobile_storage_path ~ '(^/|(^|/)\.\.(/|$))' then
      raise exception 'invalid mobile storage path';
    end if;

    if position('/storage/v1/object/public/site-assets/' in p_mobile_image_url) = 0 then
      raise exception 'invalid mobile media url';
    end if;

    if mobile_media_type is null then
      raise exception 'unsupported mobile mime type';
    end if;

    if mobile_media_type <> desktop_media_type then
      raise exception 'desktop and mobile media types must match';
    end if;

    if p_mobile_width <= 0 or p_mobile_height <= 0 then
      raise exception 'mobile media dimensions must be positive';
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

drop function if exists public.get_published_site_assets(text, text);

create or replace function public.get_published_site_assets(
  p_asset_type text default null,
  p_asset_key text default null
)
returns table (
  id uuid,
  asset_key text,
  asset_type text,
  media_type text,
  title text,
  alt_text text,
  caption text,
  desktop_image_url text,
  desktop_mime_type text,
  desktop_width integer,
  desktop_height integer,
  mobile_image_url text,
  mobile_mime_type text,
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
    assets.media_type,
    assets.title,
    assets.alt_text,
    assets.caption,
    assets.desktop_image_url,
    assets.desktop_mime_type,
    assets.desktop_width,
    assets.desktop_height,
    coalesce(assets.mobile_image_url, assets.desktop_image_url) as mobile_image_url,
    coalesce(assets.mobile_mime_type, assets.desktop_mime_type) as mobile_mime_type,
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
  p_ends_at timestamptz,
  p_folder_id uuid
)
returns public.site_assets
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_row public.site_assets;
  normalized_asset_key text := lower(btrim(p_asset_key));
  inferred_media_type text := public.infer_site_asset_media_type(p_desktop_mime_type);
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if p_folder_id is not null and not exists (
    select 1 from public.asset_folders where id = p_folder_id
  ) then
    raise exception 'asset folder not found';
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
    asset_key, asset_type, media_type, title, alt_text, caption,
    desktop_image_url, desktop_storage_path, desktop_mime_type,
    desktop_width, desktop_height,
    mobile_image_url, mobile_storage_path, mobile_mime_type,
    mobile_width, mobile_height,
    link_url, display_order, is_published, starts_at, ends_at, folder_id, created_by
  ) values (
    normalized_asset_key, p_asset_type, inferred_media_type, coalesce(p_title, ''), coalesce(p_alt_text, ''), coalesce(p_caption, ''),
    p_desktop_image_url, p_desktop_storage_path, p_desktop_mime_type,
    p_desktop_width, p_desktop_height,
    p_mobile_image_url, p_mobile_storage_path, p_mobile_mime_type,
    p_mobile_width, p_mobile_height,
    nullif(btrim(coalesce(p_link_url, '')), ''),
    p_display_order, coalesce(p_is_published, false), p_starts_at, p_ends_at, p_folder_id, auth.uid()
  )
  returning * into inserted_row;

  return inserted_row;
end;
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
begin
  return public.create_site_asset(
    p_asset_key, p_asset_type, p_title, p_alt_text, p_caption,
    p_desktop_image_url, p_desktop_storage_path, p_desktop_mime_type,
    p_desktop_width, p_desktop_height,
    p_mobile_image_url, p_mobile_storage_path, p_mobile_mime_type,
    p_mobile_width, p_mobile_height,
    p_link_url, p_display_order, p_is_published, p_starts_at, p_ends_at,
    null::uuid
  );
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
  p_ends_at timestamptz,
  p_folder_id uuid
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
  inferred_media_type text := public.infer_site_asset_media_type(p_desktop_mime_type);
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if p_folder_id is not null and not exists (
    select 1 from public.asset_folders where id = p_folder_id
  ) then
    raise exception 'asset folder not found';
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
    media_type = inferred_media_type,
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
    ends_at = p_ends_at,
    folder_id = p_folder_id
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
  existing_folder_id uuid;
begin
  select folder_id
  into existing_folder_id
  from public.site_assets
  where id = p_asset_id;

  return public.update_site_asset(
    p_asset_id, p_asset_key, p_asset_type, p_title, p_alt_text, p_caption,
    p_desktop_image_url, p_desktop_storage_path, p_desktop_mime_type,
    p_desktop_width, p_desktop_height,
    p_mobile_image_url, p_mobile_storage_path, p_mobile_mime_type,
    p_mobile_width, p_mobile_height,
    p_link_url, p_display_order, p_is_published, p_starts_at, p_ends_at,
    existing_folder_id
  );
end;
$$;

revoke all on function public.infer_site_asset_media_type(text) from public;
revoke all on function public.validate_site_asset_input(
  text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, timestamptz, timestamptz
) from public;
revoke all on function public.get_published_site_assets(text, text) from public;
revoke all on function public.create_site_asset(
  text, text, text, text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, boolean, timestamptz, timestamptz
) from public;
revoke all on function public.create_site_asset(
  text, text, text, text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, boolean,
  timestamptz, timestamptz, uuid
) from public;
revoke all on function public.update_site_asset(
  uuid, text, text, text, text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, boolean, timestamptz, timestamptz
) from public;
revoke all on function public.update_site_asset(
  uuid, text, text, text, text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, boolean,
  timestamptz, timestamptz, uuid
) from public;

grant execute on function public.get_published_site_assets(text, text) to anon, authenticated;
grant execute on function public.create_site_asset(
  text, text, text, text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, boolean, timestamptz, timestamptz
) to authenticated;
grant execute on function public.create_site_asset(
  text, text, text, text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, boolean,
  timestamptz, timestamptz, uuid
) to authenticated;
grant execute on function public.update_site_asset(
  uuid, text, text, text, text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, boolean, timestamptz, timestamptz
) to authenticated;
grant execute on function public.update_site_asset(
  uuid, text, text, text, text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, boolean,
  timestamptz, timestamptz, uuid
) to authenticated;

commit;
