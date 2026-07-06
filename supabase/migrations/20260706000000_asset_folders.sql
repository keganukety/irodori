-- Add optional folders for organizing site_assets in the admin UI.
-- Existing assets keep folder_id = null and are treated as uncategorized by the app.

begin;

create table if not exists public.asset_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  slug text not null unique
    check (
      slug = lower(btrim(slug))
      and slug ~ '^[a-z0-9][a-z0-9_-]*$'
    ),
  description text not null default '',
  sort_order integer not null default 100 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists asset_folders_sort_order_idx
on public.asset_folders (sort_order, name);

alter table public.asset_folders enable row level security;

revoke all on public.asset_folders from anon;
revoke all on public.asset_folders from authenticated;

create or replace function public.touch_asset_folders_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_asset_folders_updated_at on public.asset_folders;
create trigger touch_asset_folders_updated_at
before update on public.asset_folders
for each row
execute function public.touch_asset_folders_updated_at();

alter table public.site_assets
  add column if not exists folder_id uuid references public.asset_folders(id) on delete set null;

create index if not exists site_assets_folder_id_idx
on public.site_assets (folder_id);

insert into public.asset_folders (slug, name, description, sort_order)
values
  ('stroller', 'ベビーカー', 'ベビーカー関連の素材', 10),
  ('baby-carrier', '抱っこ紐', '抱っこ紐関連の素材', 20),
  ('child-seat', 'チャイルドシート', 'チャイルドシート関連の素材', 30),
  ('hipseat', 'ヒップシート', 'ヒップシート関連の素材', 40),
  ('brand-assets', 'ブランド素材', 'ブランドロゴやブランドヒーロー素材', 50),
  ('top-assets', 'TOP素材', 'トップページやメイン導線の素材', 60),
  ('article-assets', '記事素材', '記事内や記事アイキャッチの素材', 70)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

create or replace function public.list_site_asset_folders()
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  sort_order integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  return query
  select
    folders.id,
    folders.name,
    folders.slug,
    folders.description,
    folders.sort_order,
    folders.created_at,
    folders.updated_at
  from public.asset_folders as folders
  order by folders.sort_order, folders.name;
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
    asset_key, asset_type, title, alt_text, caption,
    desktop_image_url, desktop_storage_path, desktop_mime_type,
    desktop_width, desktop_height,
    mobile_image_url, mobile_storage_path, mobile_mime_type,
    mobile_width, mobile_height,
    link_url, display_order, is_published, starts_at, ends_at, folder_id, created_by
  ) values (
    normalized_asset_key, p_asset_type, coalesce(p_title, ''), coalesce(p_alt_text, ''), coalesce(p_caption, ''),
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

revoke all on function public.touch_asset_folders_updated_at() from public;
revoke all on function public.list_site_asset_folders() from public;
revoke all on function public.create_site_asset(
  text, text, text, text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, boolean,
  timestamptz, timestamptz, uuid
) from public;
revoke all on function public.update_site_asset(
  uuid, text, text, text, text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, boolean,
  timestamptz, timestamptz, uuid
) from public;

grant execute on function public.list_site_asset_folders() to authenticated;
grant execute on function public.create_site_asset(
  text, text, text, text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, boolean,
  timestamptz, timestamptz, uuid
) to authenticated;
grant execute on function public.update_site_asset(
  uuid, text, text, text, text, text, text, text, text, integer, integer,
  text, text, text, integer, integer, text, integer, boolean,
  timestamptz, timestamptz, uuid
) to authenticated;

commit;
