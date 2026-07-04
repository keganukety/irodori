create or replace function public.update_product_affiliate_urls(
  p_product_id text,
  p_product_name text default null,
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
  product_name_value text := nullif(btrim(coalesce(p_product_name, '')), '');
  official_url_value text := nullif(btrim(coalesce(p_official_url, '')), '');
  amazon_url_value text := nullif(btrim(coalesce(p_amazon_url, '')), '');
  rakuten_url_value text := nullif(btrim(coalesce(p_rakuten_url, '')), '');
  yahoo_url_value text := nullif(btrim(coalesce(p_yahoo_url, '')), '');
  note_value text := nullif(btrim(coalesce(p_affiliate_note, '')), '');
  set_assignments text[];
  update_sql text;
  updated_count integer;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;

  if p_product_id is null or btrim(p_product_id) = '' then
    raise exception 'product id is required';
  end if;

  if product_name_value is not null and product_name_value ~* '(<script|javascript:)' then
    raise exception 'invalid product name';
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

  set_assignments := array[
    'official_url = $2',
    'amazon_url = $3',
    'rakuten_url = $4',
    'yahoo_url = $5',
    'affiliate_checked_at = $6',
    'affiliate_note = $7'
  ];

  if product_name_value is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'name'
  ) then
    set_assignments := array_append(set_assignments, 'name = $8');
  end if;
  if product_name_value is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'product_name'
  ) then
    set_assignments := array_append(set_assignments, 'product_name = $8');
  end if;
  if product_name_value is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'title'
  ) then
    set_assignments := array_append(set_assignments, 'title = $8');
  end if;

  update_sql := format(
    'update public.products set %s where id = $1::%s',
    array_to_string(set_assignments, ', '),
    product_id_type
  );

  execute update_sql
  using
    btrim(p_product_id),
    official_url_value,
    amazon_url_value,
    rakuten_url_value,
    yahoo_url_value,
    p_affiliate_checked_at,
    note_value,
    product_name_value;

  get diagnostics updated_count = row_count;
  if updated_count = 0 then
    raise exception 'product not found';
  end if;
end;
$$;

revoke all on function public.update_product_affiliate_urls(text, text, text, text, text, text, date, text) from public;
grant execute on function public.update_product_affiliate_urls(text, text, text, text, text, text, date, text) to authenticated;
