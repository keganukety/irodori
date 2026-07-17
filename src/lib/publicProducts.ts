import { supabase } from './supabase';

/**
 * 公開商品ビュー名。公開サイトはproducts本体ではなくこのビューだけを参照する。
 * ビュー定義: supabase/migrations/20260717000000_public_products_view.sql
 */
export const PUBLIC_PRODUCTS_VIEW = 'public_products';

/**
 * 公開可能カラムのallowlist。
 * supabase/migrations/20260717000000_public_products_view.sql のビュー定義と
 * 同期させること(tests/public-product-boundary.test.mjs が両者の一致を検証する)。
 * memo / spec_source_url / spec_checked_date / affiliate_checked_at /
 * affiliate_note などの内部管理カラムは追加しないこと。
 */
export const PUBLIC_PRODUCT_COLUMNS = [
  'id',
  'created_at',
  'updated_at',
  'name',
  'brand',
  'category',
  'price_yen',
  'price_tax_type',
  'official_url',
  'amazon_url',
  'rakuten_url',
  'yahoo_url',
  'product_type',
  'target_age',
  'weight_kg',
  'feature_tags',
  'rank_no',
  'image_url',
  'maker_logo_url',
  'award_label',
  'is_recommended',
  'availability_status',
  'availability_note',
  'product_size',
  'folded_size',
  'applicable_weight',
  'load_capacity',
  'basket_capacity',
  'included_accessories',
  'warranty',
  'manufacturer_country',
  'caution_notes',
  'model_number',
  'brand_id',
] as const;

export const PUBLIC_PRODUCT_SELECT = PUBLIC_PRODUCT_COLUMNS.join(', ');

export type PublicProductColumn = (typeof PUBLIC_PRODUCT_COLUMNS)[number];

type InternalProductColumn =
  | 'memo'
  | 'spec_source_url'
  | 'spec_checked_date'
  | 'affiliate_checked_at'
  | 'affiliate_note';

// 内部管理カラムがallowlistへ混入した場合はコンパイルエラーになる。
type InternalColumnsExcluded =
  Extract<PublicProductColumn, InternalProductColumn> extends never ? true : never;
const internalColumnsExcluded: InternalColumnsExcluded = true;
void internalColumnsExcluded;

/**
 * 公開商品型。公開ビューのカラムだけを表し、内部管理カラムは型レベルで持てない。
 */
export type PublicProduct = {
  id: string | number;
  created_at?: string | null;
  updated_at?: string | null;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  price_yen?: number | string | null;
  price_tax_type?: string | null;
  official_url?: string | null;
  amazon_url?: string | null;
  rakuten_url?: string | null;
  yahoo_url?: string | null;
  product_type?: string | null;
  target_age?: string | null;
  weight_kg?: number | string | null;
  feature_tags?: string[] | string | null;
  rank_no?: number | string | null;
  image_url?: string | null;
  maker_logo_url?: string | null;
  award_label?: string | null;
  is_recommended?: boolean | null;
  availability_status?: string | null;
  availability_note?: string | null;
  product_size?: string | null;
  folded_size?: string | null;
  applicable_weight?: string | null;
  load_capacity?: string | null;
  basket_capacity?: string | null;
  included_accessories?: string | null;
  warranty?: string | null;
  manufacturer_country?: string | null;
  caution_notes?: string | null;
  model_number?: string | null;
  brand_id?: string | null;
  // 内部管理カラムは公開境界に存在しない(型レベルでも保持できない)。
  memo?: never;
  spec_source_url?: never;
  spec_checked_date?: never;
  affiliate_checked_at?: never;
  affiliate_note?: never;
  [key: string]: unknown;
};

/**
 * 公開商品取得の起点。必ず公開ビュー+明示カラムで取得する。
 * 返り値はPostgRESTビルダーなので .eq() / .order() / .limit() 等を連結できる。
 */
export function selectPublicProducts() {
  // select文字列が動的なためsupabase-jsは行型を推論できない。公開商品型を明示する。
  return supabase.from(PUBLIC_PRODUCTS_VIEW).select<string, PublicProduct>(PUBLIC_PRODUCT_SELECT);
}
