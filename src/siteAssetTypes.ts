export const siteAssetTypes = ['hero', 'campaign', 'feature', 'diagnosis', 'category', 'article', 'brand_logo', 'brand_hero', 'icon'] as const;

export type SiteAssetType = (typeof siteAssetTypes)[number];
export type SiteAssetMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' | 'image/svg+xml';

export type SiteAsset = {
  id: string;
  asset_key: string;
  asset_type: SiteAssetType;
  title: string;
  alt_text: string;
  caption: string;
  desktop_image_url: string;
  desktop_storage_path: string;
  desktop_mime_type: SiteAssetMimeType;
  desktop_width: number;
  desktop_height: number;
  mobile_image_url: string | null;
  mobile_storage_path: string | null;
  mobile_mime_type: SiteAssetMimeType | null;
  mobile_width: number | null;
  mobile_height: number | null;
  link_url: string | null;
  display_order: number;
  is_published: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ImageMetadata = {
  file: File;
  width: number;
  height: number;
  mimeType: SiteAssetMimeType;
};

export type StoredImage = ImageMetadata & {
  storagePath: string;
  publicUrl: string;
};

export type UpdateSiteAssetResult = {
  asset: SiteAsset;
  old_desktop_storage_path: string | null;
  old_mobile_storage_path: string | null;
};
