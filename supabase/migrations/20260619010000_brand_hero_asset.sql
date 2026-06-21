-- Optional brand hero linkage.
-- Hero image URLs remain in site_assets; brands stores only the reusable asset key.
-- Apply after 20260619000000_brands_and_product_colors.sql.

begin;

alter table public.brands
  add column if not exists hero_asset_key text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'brands_hero_asset_key_fkey'
      and conrelid = 'public.brands'::regclass
  ) then
    alter table public.brands
      add constraint brands_hero_asset_key_fkey
      foreign key (hero_asset_key)
      references public.site_assets(asset_key)
      on update cascade
      on delete set null;
  end if;
end $$;

create index if not exists brands_hero_asset_key_idx
on public.brands (hero_asset_key)
where hero_asset_key is not null;

comment on column public.brands.hero_asset_key is
  'Brand hero site_assets.asset_key. desktop_image_url is the PC hero and mobile_image_url is the SP hero.';

commit;

