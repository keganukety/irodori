-- Hipseat category and 10 recommended products.
-- Safe to run more than once. The products insert only uses columns that exist
-- in public.products, so this seed can follow the current lightweight catalog schema.

begin;

do $$
begin
  if to_regclass('public.brands') is not null then
    insert into public.brands (slug, display_name, short_description, description, is_published)
    values
      ('pomulu', 'POMULU', '', '', true),
      ('gooseket', 'Gooseket', '', '', true),
      ('bornboon', 'BORNBOON', '', '', true),
      ('hugoo', 'Hugoo', '', '', true),
      ('polban', 'POLBAN', '', '', true),
      ('coperta', 'コペルタ', '', '', true),
      ('mamaito', 'ママイト', '', '', true),
      ('sweet-mommy', 'SWEET MOMMY', '', '', true),
      ('konny', 'Konny', '', '', true),
      ('kerata', 'ケラッタ', '', '', true)
    on conflict (slug) do update
    set
      display_name = excluded.display_name,
      is_published = true;

    if to_regclass('public.brand_aliases') is not null then
      with alias_values(brand_slug, alias) as (
        values
          ('pomulu', 'POMULU'), ('pomulu', 'REALIZE'),
          ('gooseket', 'Gooseket'),
          ('bornboon', 'BORNBOON'), ('bornboon', 'orivance'), ('bornboon', 'Colulu'),
          ('hugoo', 'Hugoo'), ('hugoo', 'GRIT'),
          ('polban', 'POLBAN'), ('polban', 'ラッキー工業'),
          ('coperta', 'コペルタ'), ('coperta', 'Coperta'),
          ('mamaito', 'ママイト'), ('mamaito', 'DAKKOLT'),
          ('sweet-mommy', 'SWEET MOMMY'),
          ('konny', 'Konny'),
          ('kerata', 'ケラッタ'), ('kerata', 'kerata')
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
        brands.id,
        deduped_alias_values.alias
      from deduped_alias_values
      join public.brands as brands
        on brands.slug = deduped_alias_values.brand_slug
      where not exists (
        select 1
        from public.brand_aliases as existing
        where lower(btrim(existing.alias)) = lower(btrim(deduped_alias_values.alias))
      );
    end if;
  end if;
end $$;

do $$
declare
  product_row record;
  product_id_type text;
  product_data jsonb;
  product_brand_id text;
  existing_product_id text;
  insert_columns text[];
  quoted_columns text;
  update_assignments text;
  has_slug_column boolean;
  has_product_slug_column boolean;
  has_name_column boolean;
  has_category_column boolean;
  has_brand_id_column boolean;
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

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'slug'
  ) into has_slug_column;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'product_slug'
  ) into has_product_slug_column;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'name'
  ) into has_name_column;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'category'
  ) into has_category_column;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'brand_id'
  ) into has_brand_id_column;

  for product_row in
    select *
    from (values
      ('pomulu-2way-hipseat', 'pomulu', jsonb_build_object(
        'slug', 'pomulu-2way-hipseat',
        'product_slug', 'pomulu-2way-hipseat',
        'name', 'POMULU 2WAYヒップシート',
        'product_name', 'POMULU 2WAYヒップシート',
        'title', 'POMULU 2WAYヒップシート',
        'brand', 'POMULU',
        'category', 'ヒップシート',
        'product_type', 'hipseat',
        'type', 'バッグ型・2WAY',
        'rank_no', 1,
        'price_yen', null,
        'image_url', null,
        'target_age', null,
        'weight_kg', null,
        'load_capacity', null,
        'feature_tags', 'バッグ型,収納あり,売れ筋,ワンオペ、お出かけ',
        'catch_copy', 'いま売れているバッグ型ヒップシート。収納力と抱っこ補助を両立したい人に。',
        'summary', 'ショルダーバッグのように使える2WAYタイプのヒップシート。荷物をまとめながら、抱っこをサポートできるのが魅力。ベビーカー外出のサブ抱っこ紐や、歩き始めの子との短時間抱っこに向いています。',
        'source_note', 'Amazon商品ページでベストセラー表示を確認。ただし順位・価格は変動するため要定期確認。',
        'spec_note', '詳細スペックは公式確認後に補完。',
        'memo', 'source_note: Amazon商品ページでベストセラー表示を確認。ただし順位・価格は変動するため要定期確認。' || E'\n' || 'spec_note: 詳細スペックは公式確認後に補完。',
        'is_recommended', true
      )),
      ('gooseket-365', 'gooseket', jsonb_build_object(
        'slug', 'gooseket-365',
        'product_slug', 'gooseket-365',
        'name', 'グスケット365 抱っこ紐',
        'product_name', 'グスケット365 抱っこ紐',
        'title', 'グスケット365 抱っこ紐',
        'brand', 'Gooseket',
        'category', 'ヒップシート',
        'product_type', 'hipseat',
        'type', '肩掛けタイプ',
        'rank_no', 2,
        'price_yen', null,
        'image_url', null,
        'target_age', null,
        'weight_kg', null,
        'load_capacity', null,
        'feature_tags', '軽量,肩掛け,コンパクト,セカンド抱っこ紐,旅行',
        'catch_copy', '軽くて持ち歩きやすい、肩掛けタイプの定番ヒップシート。',
        'summary', 'コンパクトに持ち歩きやすい肩掛けタイプ。長時間抱っこよりも、歩いたり抱っこしたりをくり返す時期のサポートに向いています。ベビーカーや車移動のサブとしても使いやすい商品です。',
        'source_note', 'my-best掲載上位商品として確認。最新順位・価格は変動するため要確認。',
        'spec_note', '対象月齢・耐荷重・重量は公式確認後に補完。',
        'memo', 'source_note: my-best掲載上位商品として確認。最新順位・価格は変動するため要確認。' || E'\n' || 'spec_note: 対象月齢・耐荷重・重量は公式確認後に補完。',
        'is_recommended', true
      )),
      ('bornboon-2way-hipseat', 'bornboon', jsonb_build_object(
        'slug', 'bornboon-2way-hipseat',
        'product_slug', 'bornboon-2way-hipseat',
        'name', 'BORNBOON 2way ヒップシート',
        'product_name', 'BORNBOON 2way ヒップシート',
        'title', 'BORNBOON 2way ヒップシート',
        'brand', 'BORNBOON',
        'category', 'ヒップシート',
        'product_type', 'hipseat',
        'type', 'バッグ型・2WAY',
        'rank_no', 3,
        'price_yen', null,
        'image_url', null,
        'target_age', null,
        'weight_kg', null,
        'load_capacity', null,
        'feature_tags', 'バッグ型,収納あり,2WAY,おしゃれ,お出かけ',
        'catch_copy', 'バッグ感覚で使える、収納力重視の2WAYヒップシート。',
        'summary', 'バッグ型で、荷物と抱っこサポートをまとめたい人に向いたヒップシート。普段の外出や保育園送迎など、荷物を減らしたいシーンと相性がよいです。',
        'source_note', '比較サイト掲載商品として確認。価格・仕様は要公式確認。',
        'spec_note', '詳細スペックは公式確認後に補完。',
        'memo', 'source_note: 比較サイト掲載商品として確認。価格・仕様は要公式確認。' || E'\n' || 'spec_note: 詳細スペックは公式確認後に補完。',
        'is_recommended', true
      )),
      ('hugoo-hipseat', 'hugoo', jsonb_build_object(
        'slug', 'hugoo-hipseat',
        'product_slug', 'hugoo-hipseat',
        'name', 'Hugoo ヒップシート',
        'product_name', 'Hugoo ヒップシート',
        'title', 'Hugoo ヒップシート',
        'brand', 'Hugoo',
        'category', 'ヒップシート',
        'product_type', 'hipseat',
        'type', 'バッグ型',
        'rank_no', 4,
        'price_yen', null,
        'image_url', null,
        'target_age', null,
        'weight_kg', null,
        'load_capacity', null,
        'feature_tags', 'バッグ型,収納あり,おしゃれ,お出かけ,ワンオペ',
        'catch_copy', '見た目と収納力を両立した、バッグ型ヒップシート。',
        'summary', 'ショルダーバッグのような見た目で使いやすいヒップシート。育児用品感が出すぎにくく、普段着に合わせやすいデザインが魅力です。近所のお出かけや旅行時のサブ抱っこにも向いています。',
        'source_note', 'ママリ掲載商品として確認。仕様・価格は要公式確認。',
        'spec_note', '詳細スペックは公式確認後に補完。',
        'memo', 'source_note: ママリ掲載商品として確認。仕様・価格は要公式確認。' || E'\n' || 'spec_note: 詳細スペックは公式確認後に補完。',
        'is_recommended', true
      )),
      ('polban-more-p0650', 'polban', jsonb_build_object(
        'slug', 'polban-more-p0650',
        'product_slug', 'polban-more-p0650',
        'name', 'POLBAN MORE P0650',
        'product_name', 'POLBAN MORE P0650',
        'title', 'POLBAN MORE P0650',
        'brand', 'POLBAN',
        'category', 'ヒップシート',
        'product_type', 'hipseat',
        'type', '腰ベルト型',
        'rank_no', 5,
        'price_yen', null,
        'image_url', null,
        'target_age', null,
        'weight_kg', null,
        'load_capacity', null,
        'feature_tags', '腰ベルト,安定感,国内ブランド,長めの抱っこ,お出かけ',
        'catch_copy', '国内抱っこひもメーカーの安心感がある、腰ベルト型ヒップシート。',
        'summary', '腰ベルトで支えるタイプのヒップシート。肩掛けタイプよりも安定感を重視したい人に向いています。短時間だけでなく、少し長めに抱っこするシーンにも使いやすい候補です。',
        'source_note', 'ママリ・比較サイト掲載商品として確認。最新価格・詳細仕様は要公式確認。',
        'spec_note', '詳細スペックは公式確認後に補完。',
        'memo', 'source_note: ママリ・比較サイト掲載商品として確認。最新価格・詳細仕様は要公式確認。' || E'\n' || 'spec_note: 詳細スペックは公式確認後に補完。',
        'is_recommended', true
      )),
      ('coperta-hipseat', 'coperta', jsonb_build_object(
        'slug', 'coperta-hipseat',
        'product_slug', 'coperta-hipseat',
        'name', 'コペルタ ヒップシート',
        'product_name', 'コペルタ ヒップシート',
        'title', 'コペルタ ヒップシート',
        'brand', 'コペルタ',
        'category', 'ヒップシート',
        'product_type', 'hipseat',
        'type', '腰ベルト型',
        'rank_no', 6,
        'price_yen', null,
        'image_url', null,
        'target_age', null,
        'weight_kg', null,
        'load_capacity', null,
        'feature_tags', 'コスパ,腰ベルト,安定感,低価格,はじめて',
        'catch_copy', '価格を抑えて試しやすい、コスパ重視のヒップシート。',
        'summary', 'できるだけ価格を抑えてヒップシートを試したい人向け。腰や肩で支えるタイプなら、短時間のお出かけや家の中での抱っこ補助にも使いやすいです。',
        'source_note', '比較サイト・Amazon商品掲載を確認。価格は変動するため要確認。',
        'spec_note', '詳細スペックは公式確認後に補完。',
        'memo', 'source_note: 比較サイト・Amazon商品掲載を確認。価格は変動するため要確認。' || E'\n' || 'spec_note: 詳細スペックは公式確認後に補完。',
        'is_recommended', true
      )),
      ('dakkolt', 'mamaito', jsonb_build_object(
        'slug', 'dakkolt',
        'product_slug', 'dakkolt',
        'name', 'DAKKOLT',
        'product_name', 'DAKKOLT',
        'title', 'DAKKOLT',
        'brand', 'ママイト',
        'category', 'ヒップシート',
        'product_type', 'hipseat',
        'type', '肩掛けタイプ',
        'rank_no', 7,
        'price_yen', null,
        'image_url', null,
        'target_age', null,
        'weight_kg', null,
        'load_capacity', null,
        'feature_tags', '超軽量,日本製,肩掛け,コンパクト,持ち歩き',
        'catch_copy', 'とにかく軽く持ち歩きたい人向けの日本製コンパクトタイプ。',
        'summary', '軽さと携帯性を重視した肩掛けタイプ。長時間の抱っこより、短時間の抱っこ補助や外出先での「念のため」に向いています。荷物を増やしたくない人におすすめしやすい商品です。',
        'source_note', '比較サイト掲載商品として確認。詳細仕様・価格は要公式確認。',
        'spec_note', '詳細スペックは公式確認後に補完。',
        'memo', 'source_note: 比較サイト掲載商品として確認。詳細仕様・価格は要公式確認。' || E'\n' || 'spec_note: 詳細スペックは公式確認後に補完。',
        'is_recommended', true
      )),
      ('sweetmommy-ags-hipseat', 'sweet-mommy', jsonb_build_object(
        'slug', 'sweetmommy-ags-hipseat',
        'product_slug', 'sweetmommy-ags-hipseat',
        'name', '無重力 AGS ヒップシート',
        'product_name', '無重力 AGS ヒップシート',
        'title', '無重力 AGS ヒップシート',
        'brand', 'SWEET MOMMY',
        'category', 'ヒップシート',
        'product_type', 'hipseat',
        'type', '3WAY・高機能',
        'rank_no', 8,
        'price_yen', null,
        'image_url', null,
        'target_age', null,
        'weight_kg', null,
        'load_capacity', null,
        'feature_tags', '高機能,肩負担軽減,3WAY,プレミアム,お出かけ',
        'catch_copy', '肩への負担を抑えたい人に向いた、高機能ヒップシート。',
        'summary', '肩や体への負担を抑える機能を重視したヒップシート。価格はやや高めでも、抱っこ時のラクさや機能性を優先したい人に向いています。',
        'source_note', '比較サイト掲載商品として確認。機能名・価格・仕様は公式確認後に補完。',
        'spec_note', '詳細スペックは公式確認後に補完。',
        'memo', 'source_note: 比較サイト掲載商品として確認。機能名・価格・仕様は公式確認後に補完。' || E'\n' || 'spec_note: 詳細スペックは公式確認後に補完。',
        'is_recommended', true
      )),
      ('konny-hipseat', 'konny', jsonb_build_object(
        'slug', 'konny-hipseat',
        'product_slug', 'konny-hipseat',
        'name', 'Konny 安心ヒップシート',
        'product_name', 'Konny 安心ヒップシート',
        'title', 'Konny 安心ヒップシート',
        'brand', 'Konny',
        'category', 'ヒップシート',
        'product_type', 'hipseat',
        'type', '肩掛けタイプ',
        'rank_no', 9,
        'price_yen', null,
        'image_url', null,
        'target_age', null,
        'weight_kg', null,
        'load_capacity', null,
        'feature_tags', '肩掛け,腰ベルトなし,コンパクト,軽量,セカンド抱っこ紐',
        'catch_copy', '腰ベルトなしで使いやすい、シンプルな肩掛けヒップシート。',
        'summary', '腰ベルトを使わず、肩掛けで抱っこをサポートするタイプ。装着がシンプルで、短時間抱っこやベビーカー外出のサブに向いています。',
        'source_note', 'ママリ掲載商品として確認。公式仕様は要確認。',
        'spec_note', '詳細スペックは公式確認後に補完。',
        'memo', 'source_note: ママリ掲載商品として確認。公式仕様は要確認。' || E'\n' || 'spec_note: 詳細スペックは公式確認後に補完。',
        'is_recommended', true
      )),
      ('kerata-hipgo-dial-hipseat', 'kerata', jsonb_build_object(
        'slug', 'kerata-hipgo-dial-hipseat',
        'product_slug', 'kerata-hipgo-dial-hipseat',
        'name', 'HipGo ダイヤルヒップシート',
        'product_name', 'HipGo ダイヤルヒップシート',
        'title', 'HipGo ダイヤルヒップシート',
        'brand', 'ケラッタ',
        'category', 'ヒップシート',
        'product_type', 'hipseat',
        'type', '腰ベルト型',
        'rank_no', 10,
        'price_yen', null,
        'image_url', null,
        'target_age', null,
        'weight_kg', null,
        'load_capacity', null,
        'feature_tags', 'ダイヤル調整,腰ベルト,コスパ,安定感,はじめて',
        'catch_copy', 'ダイヤル調整でフィット感を整えやすい、低価格帯のヒップシート。',
        'summary', 'ダイヤル調整で体に合わせやすいヒップシート。価格を抑えつつ、腰ベルト型の安定感を試したい人に向いています。',
        'source_note', 'ママリ掲載商品として確認。対象月齢・耐荷重・価格は公式確認後に補完。',
        'spec_note', '詳細スペックは公式確認後に補完。',
        'memo', 'source_note: ママリ掲載商品として確認。対象月齢・耐荷重・価格は公式確認後に補完。' || E'\n' || 'spec_note: 詳細スペックは公式確認後に補完。',
        'is_recommended', true
      ))
    ) as products(slug, brand_slug, data)
  loop
    product_data := product_row.data;

    if has_brand_id_column and to_regclass('public.brands') is not null then
      select brands.id::text
      into product_brand_id
      from public.brands as brands
      where brands.slug = product_row.brand_slug
      limit 1;

      if product_brand_id is not null then
        product_data := product_data || jsonb_build_object('brand_id', product_brand_id);
      end if;
    end if;

    existing_product_id := null;

    if has_slug_column then
      execute 'select id::text from public.products where slug = $1 limit 1'
      into existing_product_id
      using product_row.slug;
    end if;

    if existing_product_id is null and has_product_slug_column then
      execute 'select id::text from public.products where product_slug = $1 limit 1'
      into existing_product_id
      using product_row.slug;
    end if;

    if existing_product_id is null and has_name_column and has_category_column then
      execute 'select id::text from public.products where lower(btrim(name)) = lower(btrim($1)) and lower(btrim(category)) = lower(btrim($2)) limit 1'
      into existing_product_id
      using product_data ->> 'name', product_data ->> 'category';
    end if;

    select array_agg(cols.column_name order by cols.ordinal_position)
    into insert_columns
    from information_schema.columns as cols
    join jsonb_object_keys(product_data) as data_keys(key)
      on data_keys.key = cols.column_name
    where cols.table_schema = 'public'
      and cols.table_name = 'products'
      and cols.is_generated = 'NEVER'
      and cols.column_name not in ('id', 'created_at', 'updated_at');

    if insert_columns is null or array_length(insert_columns, 1) is null then
      raise exception 'No compatible public.products columns were found for %', product_row.slug;
    end if;

    quoted_columns := array_to_string(ARRAY(select format('%I', col) from unnest(insert_columns) as col), ', ');
    update_assignments := array_to_string(ARRAY(select format('%1$I = source.%1$I', col) from unnest(insert_columns) as col), ', ');

    if existing_product_id is not null then
      execute format(
        'update public.products as products set %s from (select %s from jsonb_populate_record(null::public.products, $1)) as source where products.id = $2::%s',
        update_assignments,
        quoted_columns,
        product_id_type
      )
      using product_data, existing_product_id;
    else
      execute format(
        'insert into public.products (%s) select %s from jsonb_populate_record(null::public.products, $1) as source',
        quoted_columns,
        quoted_columns
      )
      using product_data;
    end if;
  end loop;

  if has_brand_id_column and to_regclass('public.brand_aliases') is not null then
    update public.products as products
    set brand_id = aliases.brand_id
    from public.brand_aliases as aliases
    where products.brand_id is null
      and products.brand is not null
      and lower(btrim(products.brand)) = lower(btrim(aliases.alias));
  end if;
end $$;

commit;
