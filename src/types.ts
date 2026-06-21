export type ImageRole = 'main' | 'color' | 'detail' | 'folded' | 'usage';
export type ProductMediaType = 'image' | 'youtube';
export type UploadedImageRole = ImageRole;
export type UploadedImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export type Product = {
  id: string | number;
  name?: string | null;
  [key: string]: unknown;
};

export type Brand = {
  id: string;
  slug: string;
  display_name: string;
  short_description: string;
  description: string;
  official_url: string | null;
  logo_asset_key: string | null;
  hero_asset_key: string | null;
  youtube_url: string | null;
  seo_title: string;
  seo_description: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type BrandAlias = {
  brand_id: string;
  alias: string;
  created_at: string;
};

export type ProductColor = {
  id: string;
  product_id: string | number;
  name: string;
  color_family: string;
  swatch_hex: string;
  display_order: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductAffiliateImage = {
  id: string;
  product_id: string | number;
  mall: string;
  role: ImageRole;
  rakuten_image_html: string;
  is_primary: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  media_type: ProductMediaType;
  youtube_url: string | null;
  youtube_video_id: string | null;
  thumbnail_url: string | null;
  sort_order: number;
  image_url?: string | null;
  affiliate_url?: string | null;
  source_type?: string | null;
  rakuten_item_url?: string | null;
  rakuten_me_id?: string | null;
  rakuten_item_id?: string | null;
  rakuten_shop_key?: string | null;
  rakuten_affiliate_path?: string | null;
  rakuten_image_size?: string | null;
};

export type ProductUploadedImage = {
  id: string;
  product_id: string | number;
  storage_bucket: 'product-images';
  storage_path: string;
  public_url: string;
  role: UploadedImageRole;
  alt_text: string;
  caption: string;
  is_primary: boolean;
  display_order: number;
  original_filename: string | null;
  mime_type: UploadedImageMimeType;
  file_size_bytes: number;
  created_at: string;
  updated_at: string;
};
