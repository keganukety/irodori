-- Brand pages and structured product colours.
-- Additive only: existing product, image, asset, auth, RLS and RPC objects are not replaced.

begin;

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug = lower(btrim(slug)) and slug ~ '^[a-z0-9][a-z0-9-]*$'),
  display_name text not null check (btrim(display_name) <> ''),
  short_description text not null default '',
  description text not null default '',
  official_url text,
  logo_asset_key text references public.site_assets(asset_key) on update cascade on delete set null,
  youtube_url text,
  seo_title text not null default '',
  seo_description text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (official_url is null or official_url ~ '^https?://'),
  check (youtube_url is null or youtube_url ~ '^https?://')
);

create table if not exists public.brand_aliases (
  brand_id uuid not null references public.brands(id) on delete cascade,
  alias text not null check (btrim(alias) <> ''),
  created_at timestamptz not null default now(),
  primary key (brand_id, alias)
);

create unique index if not exists brand_aliases_normalized_alias_uidx
on public.brand_aliases (lower(btrim(alias)));

create index if not exists brand_aliases_brand_id_idx
on public.brand_aliases (brand_id);

alter table public.products
  add column if not exists brand_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_brand_id_fkey'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_brand_id_fkey
      foreign key (brand_id) references public.brands(id)
      on update cascade on delete set null;
  end if;
end $$;

create index if not exists products_brand_id_idx
on public.products (brand_id);

-- Safe and repeatable backfill. Existing products.brand remains the display fallback.
-- Run this UPDATE alone after adding or changing aliases.
update public.products as products
set brand_id = aliases.brand_id
from public.brand_aliases as aliases
where products.brand_id is null
  and products.brand is not null
  and lower(btrim(products.brand)) = lower(btrim(aliases.alias));

-- products.id can differ between projects, so discover its real type just as the
-- existing product_uploaded_images migration does.
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

  execute format($create_product_colors$
    create table if not exists public.product_colors (
      id uuid primary key default gen_random_uuid(),
      product_id %s not null references public.products(id) on delete cascade,
      name text not null check (name = btrim(name) and name <> ''),
      color_family text not null default ''
        check (color_family = lower(btrim(color_family))),
      swatch_hex text not null check (swatch_hex ~ '^#[0-9A-Fa-f]{6}$'),
      display_order integer not null default 1 check (display_order >= 1),
      is_default boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  $create_product_colors$, product_id_type);
end $$;

create index if not exists product_colors_product_id_idx
on public.product_colors (product_id, display_order, created_at);

create unique index if not exists product_colors_normalized_name_uidx
on public.product_colors (product_id, lower(name));

create index if not exists product_colors_family_idx
on public.product_colors (color_family, product_id);

create unique index if not exists product_colors_one_default_per_product_uidx
on public.product_colors (product_id)
where is_default = true;

create or replace function public.touch_catalog_content_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_brands_updated_at on public.brands;
create trigger touch_brands_updated_at
before update on public.brands
for each row execute function public.touch_catalog_content_updated_at();

drop trigger if exists touch_product_colors_updated_at on public.product_colors;
create trigger touch_product_colors_updated_at
before update on public.product_colors
for each row execute function public.touch_catalog_content_updated_at();

alter table public.brands enable row level security;
alter table public.brand_aliases enable row level security;
alter table public.product_colors enable row level security;

revoke all on public.brands from anon, authenticated;
revoke all on public.brand_aliases from anon, authenticated;
revoke all on public.product_colors from anon, authenticated;

grant select on public.brands to anon, authenticated;
grant select on public.brand_aliases to anon, authenticated;
grant select on public.product_colors to anon, authenticated;

drop policy if exists "Public can read published brands" on public.brands;
create policy "Public can read published brands"
on public.brands for select to anon, authenticated
using (is_published = true);

drop policy if exists "Public can read aliases for published brands" on public.brand_aliases;
create policy "Public can read aliases for published brands"
on public.brand_aliases for select to anon, authenticated
using (exists (
  select 1 from public.brands
  where brands.id = brand_aliases.brand_id
    and brands.is_published = true
));

drop policy if exists "Public can read product colors" on public.product_colors;
create policy "Public can read product colors"
on public.product_colors for select to anon, authenticated
using (true);

-- No INSERT/UPDATE/DELETE grants or policies are added. Catalog management can be
-- exposed later through the project's existing authenticated admin/RPC pattern.

commit;
