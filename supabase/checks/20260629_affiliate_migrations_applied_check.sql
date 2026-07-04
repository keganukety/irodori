-- Run this in Supabase SQL Editor before repairing migration history.
-- It is read-only and does not change site_assets or any existing table.

with expected_product_columns(column_name, expected_type) as (
  values
    ('official_url', 'text'),
    ('amazon_url', 'text'),
    ('rakuten_url', 'text'),
    ('yahoo_url', 'text'),
    ('affiliate_checked_at', 'date'),
    ('affiliate_note', 'text')
),
product_column_status as (
  select
    expected_product_columns.column_name,
    expected_product_columns.expected_type,
    columns.data_type as actual_type,
    columns.column_name is not null as exists_in_db
  from expected_product_columns
  left join information_schema.columns as columns
    on columns.table_schema = 'public'
   and columns.table_name = 'products'
   and columns.column_name = expected_product_columns.column_name
),
expected_functions(signature, identity_arguments) as (
  values
    (
      'update_product_affiliate_urls_7_args',
      'p_product_id text, p_official_url text, p_amazon_url text, p_rakuten_url text, p_yahoo_url text, p_affiliate_checked_at date, p_affiliate_note text'
    ),
    (
      'update_product_affiliate_urls_8_args',
      'p_product_id text, p_product_name text, p_official_url text, p_amazon_url text, p_rakuten_url text, p_yahoo_url text, p_affiliate_checked_at date, p_affiliate_note text'
    )
),
function_status as (
  select
    expected_functions.signature,
    expected_functions.identity_arguments,
    routines.oid is not null as exists_in_db,
    case
      when routines.oid is null then false
      else has_function_privilege(
        'authenticated',
        routines.oid,
        'EXECUTE'
      )
    end as authenticated_can_execute
  from expected_functions
  left join (
    select pg_proc.oid, pg_proc.proname
    from pg_proc
    join pg_namespace
      on pg_namespace.oid = pg_proc.pronamespace
     and pg_namespace.nspname = 'public'
  ) as routines
    on routines.proname = 'update_product_affiliate_urls'
   and pg_get_function_identity_arguments(routines.oid) = expected_functions.identity_arguments
),
migration_history_status as (
  select
    target.version,
    exists (
      select 1
      from supabase_migrations.schema_migrations as migrations
      where migrations.version = target.version
    ) as exists_in_remote_history
  from (
    values
      ('20260629'),
      ('20260629000000'),
      ('20260629000100'),
      ('20260705000000')
  ) as target(version)
)
select
  'product_column' as check_type,
  column_name as object_name,
  expected_type,
  actual_type,
  exists_in_db,
  null::boolean as authenticated_can_execute,
  null::boolean as exists_in_remote_history
from product_column_status

union all

select
  'function' as check_type,
  signature as object_name,
  identity_arguments as expected_type,
  null as actual_type,
  exists_in_db,
  authenticated_can_execute,
  null::boolean as exists_in_remote_history
from function_status

union all

select
  'migration_history' as check_type,
  version as object_name,
  null as expected_type,
  null as actual_type,
  null::boolean as exists_in_db,
  null::boolean as authenticated_can_execute,
  exists_in_remote_history
from migration_history_status

order by check_type, object_name;
