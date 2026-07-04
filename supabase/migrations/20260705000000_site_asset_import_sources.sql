-- Track source URLs imported through the Chrome extension.
-- site_assets itself remains unchanged; this table only supports duplicate warnings.

begin;

create table if not exists public.site_asset_import_sources (
  id uuid primary key default gen_random_uuid(),
  site_asset_id uuid not null references public.site_assets(id) on delete cascade,
  source_url text not null check (source_url ~* '^https?://'),
  source_url_hash text not null check (source_url_hash ~ '^[a-f0-9]{64}$'),
  source_page_url text check (source_page_url is null or source_page_url ~* '^https?://'),
  imported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists site_asset_import_sources_source_url_hash_idx
on public.site_asset_import_sources (source_url_hash, created_at desc);

create index if not exists site_asset_import_sources_site_asset_id_idx
on public.site_asset_import_sources (site_asset_id);

alter table public.site_asset_import_sources enable row level security;

revoke all on public.site_asset_import_sources from anon;
revoke all on public.site_asset_import_sources from authenticated;

create or replace function public.find_site_asset_import_source(
  p_source_url_hash text
)
returns table (
  asset_id uuid,
  asset_key text,
  asset_type text,
  title text,
  desktop_image_url text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if p_source_url_hash is null or p_source_url_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid source url hash';
  end if;

  return query
  select
    assets.id as asset_id,
    assets.asset_key,
    assets.asset_type,
    assets.title,
    assets.desktop_image_url,
    sources.created_at
  from public.site_asset_import_sources as sources
  join public.site_assets as assets
    on assets.id = sources.site_asset_id
  where sources.source_url_hash = p_source_url_hash
  order by sources.created_at desc
  limit 5;
end;
$$;

create or replace function public.record_site_asset_import_source(
  p_site_asset_id uuid,
  p_source_url text,
  p_source_url_hash text,
  p_source_page_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if not exists (
    select 1
    from public.site_assets
    where id = p_site_asset_id
  ) then
    raise exception 'site asset not found';
  end if;

  if p_source_url is null or p_source_url !~* '^https?://' then
    raise exception 'invalid source url';
  end if;

  if p_source_url_hash is null or p_source_url_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid source url hash';
  end if;

  if p_source_page_url is not null and p_source_page_url !~* '^https?://' then
    raise exception 'invalid source page url';
  end if;

  insert into public.site_asset_import_sources (
    site_asset_id,
    source_url,
    source_url_hash,
    source_page_url,
    imported_by
  ) values (
    p_site_asset_id,
    p_source_url,
    p_source_url_hash,
    nullif(btrim(coalesce(p_source_page_url, '')), ''),
    auth.uid()
  );
end;
$$;

revoke all on function public.find_site_asset_import_source(text) from public;
revoke all on function public.record_site_asset_import_source(uuid, text, text, text) from public;

grant execute on function public.find_site_asset_import_source(text) to authenticated;
grant execute on function public.record_site_asset_import_source(uuid, text, text, text) to authenticated;

commit;
