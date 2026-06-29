alter table public.products
  add column if not exists official_url text,
  add column if not exists amazon_url text,
  add column if not exists rakuten_url text,
  add column if not exists yahoo_url text,
  add column if not exists affiliate_checked_at date,
  add column if not exists affiliate_note text;

create or replace function public.update_product_affiliate_urls(
  p_product_id text,
  p_official_url text default null,
  p_amazon_url text default null,
  p_rakuten_url text default null,
  p_yahoo_url text default null,
  p_affiliate_checked_at date default null,
  p_affiliate_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  product_id_type text;
  official_url_value text := nullif(btrim(coalesce(p_official_url, '')), '');
  amazon_url_value text := nullif(btrim(coalesce(p_amazon_url, '')), '');
  rakuten_url_value text := nullif(btrim(coalesce(p_rakuten_url, '')), '');
  yahoo_url_value text := nullif(btrim(coalesce(p_yahoo_url, '')), '');
  note_value text := nullif(btrim(coalesce(p_affiliate_note, '')), '');
  updated_count integer;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if p_product_id is null or btrim(p_product_id) = '' then
    raise exception 'product id is required';
  end if;

  if official_url_value is not null and (official_url_value !~* '^https?://' or official_url_value ~* '(javascript:|<script|[<>])') then
    raise exception 'invalid official url';
  end if;
  if amazon_url_value is not null and (amazon_url_value !~* '^https?://' or amazon_url_value ~* '(javascript:|<script|[<>])') then
    raise exception 'invalid amazon url';
  end if;
  if rakuten_url_value is not null and (rakuten_url_value !~* '^https?://' or rakuten_url_value ~* '(javascript:|<script|[<>])') then
    raise exception 'invalid rakuten url';
  end if;
  if yahoo_url_value is not null and (yahoo_url_value !~* '^https?://' or yahoo_url_value ~* '(javascript:|<script|[<>])') then
    raise exception 'invalid yahoo url';
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
    'update public.products
       set official_url = $1,
           amazon_url = $2,
           rakuten_url = $3,
           yahoo_url = $4,
           affiliate_checked_at = $5,
           affiliate_note = $6
     where id = $7::%s',
    product_id_type
  )
  using
    official_url_value,
    amazon_url_value,
    rakuten_url_value,
    yahoo_url_value,
    p_affiliate_checked_at,
    note_value,
    btrim(p_product_id);

  get diagnostics updated_count = row_count;
  if updated_count = 0 then
    raise exception 'product not found';
  end if;
end;
$$;

revoke all on function public.update_product_affiliate_urls(text, text, text, text, text, date, text) from public;
grant execute on function public.update_product_affiliate_urls(text, text, text, text, text, date, text) to authenticated;
