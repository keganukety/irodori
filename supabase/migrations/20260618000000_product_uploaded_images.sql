-- =========================================================
-- IRODORI BABY
-- Self-created product image upload
-- Supabase Storage + admin-only RPC
-- =========================================================
--
-- Purpose:
--   - Keep existing product_affiliate_images untouched.
--   - Store self-created JPG/PNG/WebP files in product-images.
--   - Sync the selected primary image to products.image_url.
--   - Preserve and restore the original products.image_url.
--
-- Review in a development project before production use.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- Storage bucket
-- Public delivery, admin-only management.
-- 5 MB, JPEG / PNG / WebP only.
-- ---------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
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

-- ---------------------------------------------------------
-- Tables
-- products.id type is discovered dynamically.
-- ---------------------------------------------------------

do $$
declare
  product_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
  into product_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'products'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped;

  if product_id_type is null then
    raise exception 'public.products.id was not found';
  end if;

  execute format($create_images$
    create table if not exists public.product_uploaded_images (
      id uuid primary key default gen_random_uuid(),
      product_id %s not null references public.products(id) on delete cascade,
      storage_bucket text not null default 'product-images'
        check (storage_bucket = 'product-images'),
      storage_path text not null unique,
      public_url text not null,
      role text not null default 'detail'
        check (role in ('main', 'color', 'detail', 'folded', 'usage')),
      alt_text text not null default '',
      caption text not null default '',
      is_primary boolean not null default false,
      display_order integer not null default 1
        check (display_order >= 1),
      original_filename text,
      mime_type text not null
        check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
      file_size_bytes bigint not null
        check (file_size_bytes > 0 and file_size_bytes <= 5242880),
      created_by uuid references auth.users(id) on delete set null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  $create_images$, product_id_type);

  execute format($create_backups$
    create table if not exists public.product_image_backups (
      product_id %s primary key references public.products(id) on delete cascade,
      original_image_url text,
      created_at timestamptz not null default now()
    );
  $create_backups$, product_id_type);
end $$;

create unique index if not exists product_uploaded_images_one_primary_per_product
on public.product_uploaded_images (product_id)
where is_primary = true;

create index if not exists product_uploaded_images_product_order_idx
on public.product_uploaded_images (product_id, is_primary desc, display_order, created_at);

create index if not exists product_uploaded_images_created_by_idx
on public.product_uploaded_images (created_by);

-- ---------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------

create or replace function public.touch_product_uploaded_images_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_product_uploaded_images_updated_at
on public.product_uploaded_images;

create trigger touch_product_uploaded_images_updated_at
before update on public.product_uploaded_images
for each row
execute function public.touch_product_uploaded_images_updated_at();

-- ---------------------------------------------------------
-- Table RLS and privileges
-- Public read; writes only through admin RPC.
-- ---------------------------------------------------------

alter table public.product_uploaded_images enable row level security;
alter table public.product_image_backups enable row level security;

revoke all on public.product_uploaded_images from anon;
revoke all on public.product_uploaded_images from authenticated;
grant select on public.product_uploaded_images to anon;
grant select on public.product_uploaded_images to authenticated;

revoke all on public.product_image_backups from anon;
revoke all on public.product_image_backups from authenticated;

drop policy if exists "Public can read product uploaded images"
on public.product_uploaded_images;

create policy "Public can read product uploaded images"
on public.product_uploaded_images
for select
to anon, authenticated
using (true);

-- No public policy for product_image_backups.

-- ---------------------------------------------------------
-- Storage RLS
-- A public bucket allows public asset delivery by URL.
-- Object management remains admin-only.
-- ---------------------------------------------------------

drop policy if exists "Admins can read product image objects"
on storage.objects;

create policy "Admins can read product image objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_admin()
);

drop policy if exists "Admins can upload product image objects"
on storage.objects;

create policy "Admins can upload product image objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_admin()
  and name !~ '(^/|(^|/)\.\.(/|$))'
);

drop policy if exists "Admins can update product image objects"
on storage.objects;

create policy "Admins can update product image objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_admin()
)
with check (
  bucket_id = 'product-images'
  and public.is_admin()
  and name !~ '(^/|(^|/)\.\.(/|$))'
);

drop policy if exists "Admins can delete product image objects"
on storage.objects;

create policy "Admins can delete product image objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_admin()
);

-- ---------------------------------------------------------
-- Helper validation
-- ---------------------------------------------------------

create or replace function public.validate_product_uploaded_image_input(
  p_storage_bucket text,
  p_storage_path text,
  p_public_url text,
  p_role text,
  p_display_order integer,
  p_mime_type text,
  p_file_size_bytes bigint
)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
  if p_storage_bucket <> 'product-images' then
    raise exception 'invalid storage bucket';
  end if;

  if p_storage_path is null
     or length(btrim(p_storage_path)) = 0
     or p_storage_path ~ '(^/|(^|/)\.\.(/|$))' then
    raise exception 'invalid storage path';
  end if;

  if p_public_url is null
     or position('/storage/v1/object/public/product-images/' in p_public_url) = 0 then
    raise exception 'invalid public url';
  end if;

  if p_role not in ('main', 'color', 'detail', 'folded', 'usage') then
    raise exception 'invalid role';
  end if;

  if p_display_order < 1 then
    raise exception 'display_order must be greater than or equal to 1';
  end if;

  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'unsupported mime type';
  end if;

  if p_file_size_bytes <= 0 or p_file_size_bytes > 5242880 then
    raise exception 'file size must be between 1 byte and 5 MB';
  end if;
end;
$$;

revoke all on function public.validate_product_uploaded_image_input(
  text, text, text, text, integer, text, bigint
) from public;

-- ---------------------------------------------------------
-- RPC: create uploaded image
-- ---------------------------------------------------------

create or replace function public.create_product_uploaded_image(
  p_product_id text,
  p_storage_bucket text,
  p_storage_path text,
  p_public_url text,
  p_role text default 'detail',
  p_alt_text text default '',
  p_caption text default '',
  p_is_primary boolean default false,
  p_display_order integer default 1,
  p_original_filename text default null,
  p_mime_type text default 'image/jpeg',
  p_file_size_bytes bigint default 1
)
returns public.product_uploaded_images
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  product_id_type text;
  product_exists boolean;
  current_image_url text;
  inserted_row public.product_uploaded_images;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  perform public.validate_product_uploaded_image_input(
    p_storage_bucket,
    p_storage_path,
    p_public_url,
    p_role,
    p_display_order,
    p_mime_type,
    p_file_size_bytes
  );

  select format_type(a.atttypid, a.atttypmod)
  into product_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'products'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped;

  if product_id_type is null then
    raise exception 'public.products.id was not found';
  end if;

  execute format(
    'select exists (
       select 1 from public.products where id = $1::%s
     )',
    product_id_type
  )
  into product_exists
  using p_product_id;

  if not product_exists then
    raise exception 'product not found';
  end if;

  if p_is_primary then
    execute format(
      'select image_url
       from public.products
       where id = $1::%s',
      product_id_type
    )
    into current_image_url
    using p_product_id;

    execute format(
      'insert into public.product_image_backups
         (product_id, original_image_url)
       values
         ($1::%s, $2)
       on conflict (product_id) do nothing',
      product_id_type
    )
    using p_product_id, current_image_url;

    execute format(
      'update public.product_uploaded_images
       set is_primary = false
       where product_id = $1::%s',
      product_id_type
    )
    using p_product_id;
  end if;

  execute format(
    'insert into public.product_uploaded_images (
       product_id,
       storage_bucket,
       storage_path,
       public_url,
       role,
       alt_text,
       caption,
       is_primary,
       display_order,
       original_filename,
       mime_type,
       file_size_bytes,
       created_by
     )
     values (
       $1::%s,
       $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
       auth.uid()
     )
     returning *',
    product_id_type
  )
  into inserted_row
  using
    p_product_id,
    p_storage_bucket,
    p_storage_path,
    p_public_url,
    p_role,
    coalesce(p_alt_text, ''),
    coalesce(p_caption, ''),
    p_is_primary,
    p_display_order,
    p_original_filename,
    p_mime_type,
    p_file_size_bytes;

  if p_is_primary then
    execute format(
      'update public.products
       set image_url = $2
       where id = $1::%s',
      product_id_type
    )
    using p_product_id, p_public_url;
  end if;

  return inserted_row;
end;
$$;

-- ---------------------------------------------------------
-- RPC: set uploaded image as primary
-- ---------------------------------------------------------

create or replace function public.set_product_uploaded_image_primary(
  p_image_id uuid
)
returns public.product_uploaded_images
language plpgsql
security definer
set search_path = public
as $$
declare
  product_id_type text;
  target_row public.product_uploaded_images;
  current_image_url text;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select *
  into target_row
  from public.product_uploaded_images
  where id = p_image_id;

  if target_row.id is null then
    raise exception 'image not found';
  end if;

  select format_type(a.atttypid, a.atttypmod)
  into product_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'products'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped;

  execute format(
    'select image_url
     from public.products
     where id = $1::%s',
    product_id_type
  )
  into current_image_url
  using target_row.product_id::text;

  execute format(
    'insert into public.product_image_backups
       (product_id, original_image_url)
     values
       ($1::%s, $2)
     on conflict (product_id) do nothing',
    product_id_type
  )
  using target_row.product_id::text, current_image_url;

  update public.product_uploaded_images
  set is_primary = false
  where product_id::text = target_row.product_id::text;

  update public.product_uploaded_images
  set is_primary = true
  where id = p_image_id
  returning * into target_row;

  execute format(
    'update public.products
     set image_url = $2
     where id = $1::%s',
    product_id_type
  )
  using target_row.product_id::text, target_row.public_url;

  return target_row;
end;
$$;

-- ---------------------------------------------------------
-- RPC: update metadata only
-- ---------------------------------------------------------

create or replace function public.update_product_uploaded_image_metadata(
  p_image_id uuid,
  p_role text,
  p_alt_text text,
  p_caption text,
  p_display_order integer
)
returns public.product_uploaded_images
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.product_uploaded_images;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if p_role not in ('main', 'color', 'detail', 'folded', 'usage') then
    raise exception 'invalid role';
  end if;

  if p_display_order < 1 then
    raise exception 'display_order must be greater than or equal to 1';
  end if;

  update public.product_uploaded_images
  set
    role = p_role,
    alt_text = coalesce(p_alt_text, ''),
    caption = coalesce(p_caption, ''),
    display_order = p_display_order
  where id = p_image_id
  returning * into updated_row;

  if updated_row.id is null then
    raise exception 'image not found';
  end if;

  return updated_row;
end;
$$;

-- ---------------------------------------------------------
-- RPC: delete DB row and return Storage object.
-- The browser removes the returned object after the RPC succeeds.
-- If the deleted image was primary, choose the next one.
-- If no uploaded images remain, restore the original image_url.
-- ---------------------------------------------------------

create or replace function public.delete_product_uploaded_image(
  p_image_id uuid
)
returns table (
  storage_bucket text,
  storage_path text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  product_id_type text;
  target_row public.product_uploaded_images;
  next_row public.product_uploaded_images;
  backup_url text;
  remaining_count integer;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  select *
  into target_row
  from public.product_uploaded_images
  where id = p_image_id;

  if target_row.id is null then
    raise exception 'image not found';
  end if;

  select format_type(a.atttypid, a.atttypmod)
  into product_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'products'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped;

  delete from public.product_uploaded_images
  where id = p_image_id;

  select count(*)
  into remaining_count
  from public.product_uploaded_images
  where product_id::text = target_row.product_id::text;

  if remaining_count = 0 then
    select original_image_url
    into backup_url
    from public.product_image_backups
    where product_id::text = target_row.product_id::text;

    if found then
      execute format(
        'update public.products
         set image_url = $2
         where id = $1::%s',
        product_id_type
      )
      using target_row.product_id::text, backup_url;

      delete from public.product_image_backups
      where product_id::text = target_row.product_id::text;
    end if;
  elsif target_row.is_primary then
    select *
    into next_row
    from public.product_uploaded_images
    where product_id::text = target_row.product_id::text
    order by display_order asc, created_at asc
    limit 1;

    if next_row.id is not null then
      update public.product_uploaded_images
      set is_primary = true
      where id = next_row.id;

      execute format(
        'update public.products
         set image_url = $2
         where id = $1::%s',
        product_id_type
      )
      using target_row.product_id::text, next_row.public_url;
    end if;
  end if;

  storage_bucket := target_row.storage_bucket;
  storage_path := target_row.storage_path;
  return next;
end;
$$;

-- ---------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------

revoke all on function public.create_product_uploaded_image(
  text, text, text, text, text, text, text, boolean, integer, text, text, bigint
) from public;

revoke all on function public.set_product_uploaded_image_primary(uuid)
from public;

revoke all on function public.update_product_uploaded_image_metadata(
  uuid, text, text, text, integer
) from public;

revoke all on function public.delete_product_uploaded_image(uuid)
from public;

grant execute on function public.create_product_uploaded_image(
  text, text, text, text, text, text, text, boolean, integer, text, text, bigint
) to authenticated;

grant execute on function public.set_product_uploaded_image_primary(uuid)
to authenticated;

grant execute on function public.update_product_uploaded_image_metadata(
  uuid, text, text, text, integer
) to authenticated;

grant execute on function public.delete_product_uploaded_image(uuid)
to authenticated;

-- ---------------------------------------------------------
-- Verification queries (run manually after migration)
-- ---------------------------------------------------------
--
-- select id, name, public, file_size_limit, allowed_mime_types
-- from storage.buckets
-- where id = 'product-images';
--
-- select *
-- from public.product_uploaded_images
-- order by created_at desc;
--
-- select *
-- from public.product_image_backups;
--
-- select policyname, schemaname, tablename, roles, cmd
-- from pg_policies
-- where (schemaname = 'storage' and tablename = 'objects')
--    or (schemaname = 'public' and tablename in (
--      'product_uploaded_images',
--      'product_image_backups'
--    ))
-- order by schemaname, tablename, policyname;
