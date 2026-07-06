-- Admin-only RPC to create a new site asset folder.
-- asset_folders has RLS enabled with grants revoked from authenticated,
-- so inserts must go through this security definer function.
-- The existing 20260706000000_asset_folders.sql migration is not modified.

begin;

create or replace function public.create_site_asset_folder(
  p_name text,
  p_slug text
)
returns public.asset_folders
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_row public.asset_folders;
  normalized_name text := btrim(coalesce(p_name, ''));
  normalized_slug text := lower(btrim(coalesce(p_slug, '')));
  next_sort integer;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if length(normalized_name) = 0 then
    raise exception 'folder name required';
  end if;

  -- Fall back to a safe timestamp-based slug when none could be generated
  -- from the (possibly non-ASCII) folder name.
  if length(normalized_slug) = 0 then
    normalized_slug := 'folder-' || to_char(now(), 'YYYYMMDD-HH24MISS');
  end if;

  if normalized_slug !~ '^[a-z0-9][a-z0-9_-]*$' then
    raise exception 'invalid folder slug';
  end if;

  if exists (select 1 from public.asset_folders where slug = normalized_slug) then
    raise exception 'folder slug already exists';
  end if;

  select coalesce(max(sort_order), 0) + 10
  into next_sort
  from public.asset_folders;

  insert into public.asset_folders (slug, name, description, sort_order)
  values (normalized_slug, normalized_name, '', next_sort)
  returning * into inserted_row;

  return inserted_row;
end;
$$;

revoke all on function public.create_site_asset_folder(text, text) from public;
grant execute on function public.create_site_asset_folder(text, text) to authenticated;

commit;
