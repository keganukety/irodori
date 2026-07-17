-- ============================================================
-- IRODORI 本番schema監査用 手動実行スクリプト
-- 状態: 未実行(2026-07-17時点)。Supabase SQL Editor に貼り付けて手動実行する。
-- 内容: SELECT のみ。データやスキーマを変更する文は一切含まない。
-- 対象: products ほか関連テーブル群(下記 in リスト参照)。
-- 注意: 結果を共有する際は memo 列の全文や接続情報を含めないこと。
-- ============================================================

-- [1] 列定義(型・null許可・既定値・identity)
select table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default, is_identity, identity_generation,
       character_maximum_length
from information_schema.columns
where table_schema = 'public'
  and table_name in ('products','brands','brand_aliases','product_colors',
    'product_affiliate_images','product_uploaded_images',
    'rakuten_affiliate_shop_settings','site_assets','asset_folders',
    'admin_users','product_image_backups','site_asset_import_sources')
order by table_name, ordinal_position;

-- [2] 制約一覧(PK / FK / UNIQUE / CHECK)と対象列
select tc.table_name, tc.constraint_name, tc.constraint_type, ccu.column_name
from information_schema.table_constraints tc
left join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.constraint_schema = tc.constraint_schema
where tc.table_schema = 'public'
  and tc.table_name in ('products','brands','brand_aliases','product_colors',
    'product_affiliate_images','product_uploaded_images',
    'rakuten_affiliate_shop_settings','site_assets','asset_folders',
    'admin_users','product_image_backups','site_asset_import_sources')
order by tc.table_name, tc.constraint_type, tc.constraint_name;

-- [3] CHECK制約の条件式
select tc.table_name, cc.constraint_name, cc.check_clause
from information_schema.check_constraints cc
join information_schema.table_constraints tc
  on tc.constraint_schema = cc.constraint_schema
 and tc.constraint_name  = cc.constraint_name
where tc.table_schema = 'public'
  and tc.table_name in ('products','brands','brand_aliases','product_colors',
    'product_affiliate_images','product_uploaded_images',
    'rakuten_affiliate_shop_settings','site_assets','asset_folders',
    'admin_users','product_image_backups','site_asset_import_sources')
order by tc.table_name, cc.constraint_name;

-- [4] インデックス定義
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('products','brands','brand_aliases','product_colors',
    'product_affiliate_images','product_uploaded_images',
    'rakuten_affiliate_shop_settings','site_assets','asset_folders',
    'admin_users','product_image_backups','site_asset_import_sources')
order by tablename, indexname;

-- [5] RLS有効フラグ(relrowsecurity=有効, relforcerowsecurity=強制)
select c.relname as table_name, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('products','brands','brand_aliases','product_colors',
    'product_affiliate_images','product_uploaded_images',
    'rakuten_affiliate_shop_settings','site_assets','asset_folders',
    'admin_users','product_image_backups','site_asset_import_sources')
order by c.relname;

-- [6] RLSポリシー定義(対象ロール・コマンド種別・条件式)
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('products','brands','brand_aliases','product_colors',
    'product_affiliate_images','product_uploaded_images',
    'rakuten_affiliate_shop_settings','site_assets','asset_folders',
    'admin_users','product_image_backups','site_asset_import_sources')
order by tablename, policyname;

-- [7] テーブル単位の権限(anon / authenticated / service_role / PUBLIC)
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('products','brands','brand_aliases','product_colors',
    'product_affiliate_images','product_uploaded_images',
    'rakuten_affiliate_shop_settings','site_assets','asset_folders',
    'admin_users','product_image_backups','site_asset_import_sources')
  and grantee in ('anon','authenticated','service_role','PUBLIC','public')
order by table_name, grantee, privilege_type;

-- [8] 列単位の権限(memo 列だけ絞られているか等の確認)
select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name in ('products','brands','brand_aliases','product_colors',
    'product_affiliate_images','product_uploaded_images',
    'rakuten_affiliate_shop_settings','site_assets','asset_folders',
    'admin_users','product_image_backups','site_asset_import_sources')
  and grantee in ('anon','authenticated','PUBLIC','public')
order by table_name, column_name, grantee, privilege_type;

-- [9] public スキーマの view 定義一覧
select schemaname, viewname, definition
from pg_views
where schemaname = 'public'
order by viewname;

-- [10] 関数一覧(引数・security definer 有無・volatility・ACL・言語)
select p.proname,
       pg_get_function_identity_arguments(p.oid) as identity_args,
       p.prosecdef as is_security_definer,
       p.provolatile,
       p.proacl::text as acl_text,
       l.lanname as language_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
order by p.proname;

-- [11] products を参照している view の逆引き(依存関係経由)
select distinct dep_ns.nspname as view_schema, dep_view.relname as view_name
from pg_depend d
join pg_rewrite r on r.oid = d.objid
join pg_class dep_view on dep_view.oid = r.ev_class
join pg_namespace dep_ns on dep_ns.oid = dep_view.relnamespace
join pg_class src on src.oid = d.refobjid
join pg_namespace src_ns on src_ns.oid = src.relnamespace
where src_ns.nspname = 'public'
  and src.relname = 'products'
  and dep_view.relname <> 'products'
order by view_schema, view_name;

-- [12] products をソース内で参照している関数の逆引き
select p.proname,
       pg_get_function_identity_arguments(p.oid) as identity_args,
       p.prosecdef as is_security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosrc like '%products%'
order by p.proname;

-- [13] シーケンス一覧
select sequence_schema, sequence_name, data_type, start_value, increment
from information_schema.sequences
where sequence_schema = 'public'
order by sequence_name;

-- [14] identity 列 / nextval 既定値の列(products.id の採番方式の確定)
select table_name, column_name, is_identity, identity_generation, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('products','brands','brand_aliases','product_colors',
    'product_affiliate_images','product_uploaded_images',
    'rakuten_affiliate_shop_settings','site_assets','asset_folders',
    'admin_users','product_image_backups','site_asset_import_sources')
  and (is_identity = 'YES' or column_default like 'nextval%')
order by table_name, column_name;
