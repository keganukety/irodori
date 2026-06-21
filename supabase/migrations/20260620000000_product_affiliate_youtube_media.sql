-- Add YouTube media support without changing existing affiliate image behavior.
-- Apply this migration in Supabase before deploying the matching frontend code.

alter table public.product_affiliate_images
  add column if not exists media_type text;

alter table public.product_affiliate_images
  add column if not exists youtube_url text;

alter table public.product_affiliate_images
  add column if not exists youtube_video_id text;

alter table public.product_affiliate_images
  add column if not exists thumbnail_url text;

alter table public.product_affiliate_images
  add column if not exists sort_order integer;

update public.product_affiliate_images
set media_type = 'image'
where media_type is null;

update public.product_affiliate_images
set sort_order = coalesce(display_order, 1)
where sort_order is null;

alter table public.product_affiliate_images
  alter column media_type set default 'image',
  alter column media_type set not null,
  alter column sort_order set default 1,
  alter column sort_order set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.product_affiliate_images'::regclass
      and conname = 'product_affiliate_images_media_type_check'
  ) then
    alter table public.product_affiliate_images
      add constraint product_affiliate_images_media_type_check
      check (media_type in ('image', 'youtube'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.product_affiliate_images'::regclass
      and conname = 'product_affiliate_images_youtube_video_id_check'
  ) then
    alter table public.product_affiliate_images
      add constraint product_affiliate_images_youtube_video_id_check
      check (
        media_type <> 'youtube'
        or (
          youtube_video_id is not null
          and youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.product_affiliate_images'::regclass
      and conname = 'product_affiliate_images_sort_order_check'
  ) then
    alter table public.product_affiliate_images
      add constraint product_affiliate_images_sort_order_check
      check (sort_order >= 1);
  end if;
end
$$;

create index if not exists product_affiliate_images_product_media_order_idx
on public.product_affiliate_images (product_id, media_type, sort_order, created_at);

-- Keep the new sort_order compatible with the existing display_order RPCs.
create or replace function public.sync_product_affiliate_media_sort_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.sort_order := coalesce(new.display_order, new.sort_order, 1);
  elsif new.display_order is distinct from old.display_order then
    new.sort_order := new.display_order;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_product_affiliate_media_sort_order
on public.product_affiliate_images;

create trigger sync_product_affiliate_media_sort_order
before insert or update of display_order
on public.product_affiliate_images
for each row
execute function public.sync_product_affiliate_media_sort_order();

create or replace function public.create_product_youtube_media(
  p_product_id text,
  p_youtube_url text,
  p_youtube_video_id text,
  p_role text default 'detail',
  p_display_order integer default 1
)
returns public.product_affiliate_images
language plpgsql
security definer
set search_path = public
as $$
declare
  product_id_type text;
  product_exists boolean;
  inserted_row public.product_affiliate_images;
  normalized_url text := btrim(coalesce(p_youtube_url, ''));
  normalized_video_id text := btrim(coalesce(p_youtube_video_id, ''));
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

  if normalized_video_id !~ '^[A-Za-z0-9_-]{11}$' then
    raise exception 'invalid YouTube video id';
  end if;

  if normalized_url !~* '^https://(www\.)?youtube\.com/(watch\?v=|shorts/|embed/)'
     and normalized_url !~* '^https://youtu\.be/' then
    raise exception 'unsupported YouTube URL';
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

  execute format(
    'insert into public.product_affiliate_images (
       product_id, mall, role, rakuten_image_html, is_primary, display_order,
       media_type, youtube_url, youtube_video_id, thumbnail_url, sort_order
     ) values (
       $1::%s, ''rakuten'', $2, '''', false, $3,
       ''youtube'', $4, $5, $6, $3
     ) returning *',
    product_id_type
  )
  into inserted_row
  using
    p_product_id,
    p_role,
    p_display_order,
    normalized_url,
    normalized_video_id,
    'https://i.ytimg.com/vi/' || normalized_video_id || '/hqdefault.jpg';

  return inserted_row;
end;
$$;

revoke all on function public.create_product_youtube_media(
  text, text, text, text, integer
) from public;

grant execute on function public.create_product_youtube_media(
  text, text, text, text, integer
) to authenticated;

comment on column public.product_affiliate_images.media_type is
  'image for existing affiliate images, youtube for product-detail gallery videos.';

comment on column public.product_affiliate_images.youtube_video_id is
  'Validated YouTube video id. Frontend embeds only through youtube-nocookie.com.';
