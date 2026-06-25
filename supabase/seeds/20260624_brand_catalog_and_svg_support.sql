-- Brand catalog seed and SVG support for site_assets.
-- Safe to run more than once. This is intentionally a seed/manual SQL, not a migration.

begin;

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']::text[]
where id = 'site-assets';

alter table public.site_assets
  drop constraint if exists site_assets_asset_type_check,
  drop constraint if exists site_assets_desktop_mime_type_check,
  drop constraint if exists site_assets_mobile_mime_type_check;

alter table public.site_assets
  add constraint site_assets_asset_type_check
    check (asset_type in (
      'hero', 'campaign', 'feature', 'diagnosis', 'category', 'article',
      'brand_logo', 'brand_hero', 'icon'
    )),
  add constraint site_assets_desktop_mime_type_check
    check (desktop_mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml')),
  add constraint site_assets_mobile_mime_type_check
    check (mobile_mime_type is null or mobile_mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'));

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
    raise exception 'invalid desktop image url';
  end if;

  if p_desktop_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml') then
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

    if p_mobile_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml') then
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

insert into public.brands (slug, display_name, short_description, description, is_published)
values
  ('cybex', 'CYBEX', '', '', true),
  ('aprica', 'Aprica', '', '', true),
  ('combi', 'Combi', '', '', true),
  ('pigeon', 'pigeon', '', '', true),
  ('joie', 'Joie', '', '', true),
  ('nuna', 'nuna', '', '', true),
  ('bugaboo', 'Bugaboo', '', '', true),
  ('airbuggy', 'AIRBUGGY', '', '', true),
  ('richell', 'Richell', '', '', true),
  ('graco', 'GRACO', '', '', true),
  ('katoji', 'KATOJI', '', '', true),
  ('babyzen-yoyo', 'Babyzen / YOYO', '', '', true),
  ('inglesina', 'Inglesina', '', '', true),
  ('silver-cross', 'Silver Cross', '', '', true),
  ('uppababy', 'UPPAbaby', '', '', true),
  ('ergobaby', 'Ergobaby', '', '', true),
  ('babybjorn', 'BABYBJÖRN', '', '', true),
  ('napnap', 'napnap', '', '', true),
  ('polban', 'POLBAN', '', '', true),
  ('pognae', 'POGNAE', '', '', true),
  ('hugoo', 'HUGoo', '', '', true),
  ('konny', 'Konny', '', '', true),
  ('kerata', 'kerätä', '', '', true),
  ('angelette', 'angelette', '', '', true),
  ('lillebaby', 'LÍLLÉbaby', '', '', true),
  ('tushbaby', 'TushBaby', '', '', true),
  ('britax-romer', 'Britax Römer', '', '', true),
  ('leaman', 'LEAMAN', '', '', true),
  ('ailebebe', 'AILEBEBE', '', '', true),
  ('maxi-cosi', 'Maxi-Cosi', '', '', true),
  ('recaro-kids', 'RECARO Kids', '', '', true),
  ('child-guard', 'Child Guard', '', '', true),
  ('baby-and-me', 'BABY&Me', '', '', true),
  ('telasbaby', 'TeLasbaby', '', '', true),
  ('ily', 'iLy.', '', '', true)
on conflict (slug) do update
set
  display_name = excluded.display_name,
  is_published = true;

with alias_values(brand_slug, alias) as (
  values
    ('cybex', 'cybex'), ('cybex', 'CYBEX'), ('cybex', 'サイベックス'),
    ('aprica', 'aprica'), ('aprica', 'Aprica'), ('aprica', 'アップリカ'),
    ('combi', 'combi'), ('combi', 'Combi'), ('combi', 'コンビ'),
    ('ergobaby', 'ergobaby'), ('ergobaby', 'Ergobaby'), ('ergobaby', 'エルゴベビー'),
    ('babybjorn', 'babybjorn'), ('babybjorn', 'BABYBJÖRN'), ('babybjorn', 'BabyBjorn'), ('babybjorn', 'ベビービョルン'),
    ('joie', 'joie'), ('joie', 'Joie'), ('joie', 'ジョイー'),
    ('nuna', 'nuna'), ('nuna', 'ヌナ'),
    ('airbuggy', 'airbuggy'), ('airbuggy', 'AIRBUGGY'), ('airbuggy', 'エアバギー'),
    ('bugaboo', 'bugaboo'), ('bugaboo', 'Bugaboo'), ('bugaboo', 'バガブー'),
    ('pigeon', 'pigeon'), ('pigeon', 'ピジョン'),
    ('katoji', 'katoji'), ('katoji', 'KATOJI'), ('katoji', 'カトージ'),
    ('polban', 'polban'), ('polban', 'POLBAN'), ('polban', 'ポルバン'),
    ('pognae', 'pognae'), ('pognae', 'POGNAE'), ('pognae', 'ポグネー'),
    ('napnap', 'napnap'), ('napnap', 'ナップナップ'),
    ('konny', 'konny'), ('konny', 'Konny'), ('konny', 'コニー'),
    ('maxi-cosi', 'maxi-cosi'), ('maxi-cosi', 'Maxi-Cosi'), ('maxi-cosi', 'マキシコシ'),
    ('ailebebe', 'ailebebe'), ('ailebebe', 'AILEBEBE'), ('ailebebe', 'エールベベ'),
    ('leaman', 'leaman'), ('leaman', 'LEAMAN'), ('leaman', 'リーマン'),
    ('britax-romer', 'britax-romer'), ('britax-romer', 'Britax Römer'), ('britax-romer', 'ブリタックスレーマー'),
    ('richell', 'richell'), ('richell', 'Richell'), ('richell', 'リッチェル'),
    ('graco', 'graco'), ('graco', 'GRACO'), ('graco', 'グレコ'),
    ('uppababy', 'uppababy'), ('uppababy', 'UPPAbaby'),
    ('silver-cross', 'silver-cross'), ('silver-cross', 'Silver Cross'), ('silver-cross', 'シルバークロス'),
    ('babyzen-yoyo', 'babyzen-yoyo'), ('babyzen-yoyo', 'Babyzen / YOYO'), ('babyzen-yoyo', 'YOYO'), ('babyzen-yoyo', 'ベビーゼン'),
    ('inglesina', 'inglesina'), ('inglesina', 'Inglesina'), ('inglesina', 'イングリッシーナ'),
    ('hugoo', 'hugoo'), ('hugoo', 'HUGoo'), ('hugoo', 'ハグー'),
    ('kerata', 'kerata'), ('kerata', 'kerätä'), ('kerata', 'ケラッタ'),
    ('angelette', 'angelette'), ('angelette', 'アンジェレッテ'),
    ('lillebaby', 'lillebaby'), ('lillebaby', 'LÍLLÉbaby'), ('lillebaby', 'LILLEbaby'), ('lillebaby', 'リルベビー'),
    ('tushbaby', 'tushbaby'), ('tushbaby', 'TushBaby'), ('tushbaby', 'タッシュベビー'),
    ('recaro-kids', 'recaro-kids'), ('recaro-kids', 'RECARO Kids'), ('recaro-kids', 'レカロキッズ'),
    ('child-guard', 'child-guard'), ('child-guard', 'Child Guard'), ('child-guard', 'チャイルドガード'),
    ('baby-and-me', 'baby-and-me'), ('baby-and-me', 'BABY&Me'), ('baby-and-me', 'ベビーアンドミー'),
    ('telasbaby', 'telasbaby'), ('telasbaby', 'TeLasbaby'), ('telasbaby', 'テラスベビー'),
    ('ily', 'ily'), ('ily', 'iLy.'), ('ily', 'iLy'), ('ily', 'IRODORI')
),
deduped_alias_values as (
  select distinct on (lower(btrim(alias)))
    brand_slug,
    alias
  from alias_values
  order by lower(btrim(alias)), brand_slug, alias
)
insert into public.brand_aliases (brand_id, alias)
select
  brands.id as brand_id,
  deduped_alias_values.alias
from deduped_alias_values
join public.brands as brands
  on brands.slug = deduped_alias_values.brand_slug
where not exists (
  select 1
  from public.brand_aliases as existing
  where lower(btrim(existing.alias)) = lower(btrim(deduped_alias_values.alias))
);

update public.products as products
set brand_id = aliases.brand_id
from public.brand_aliases as aliases
where products.brand_id is null
  and products.brand is not null
  and lower(btrim(products.brand)) = lower(btrim(aliases.alias));

commit;
