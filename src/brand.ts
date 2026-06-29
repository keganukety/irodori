import './styles.css';
import './brand.css';
import { applyFadeUpAnimations, mountCommonHeader, normalizeProductDisplayName } from './shared-ui';
import { supabase } from './lib/supabase';
import type { Brand, Product, ProductUploadedImage } from './types';

type BrandAsset = {
  asset_key: string;
  asset_type: string;
  title: string;
  desktop_image_url: string;
  desktop_width: number;
  desktop_height: number;
  mobile_image_url: string;
  mobile_width: number;
  mobile_height: number;
  alt_text: string;
};

type ProductImage = {
  product_id: string | number;
  rakuten_image_html: string | null;
  role?: string | null;
  is_primary: boolean | null;
  display_order: number | null;
  sort_order?: number | null;
  image_url?: string | null;
};

type ProductImagePair = {
  primary: string;
  secondary: string;
  showcase: string;
};

type ShowcaseProduct = {
  product: Product;
  image: string;
};

const productShortNames: Record<string, string> = {
  'cybex-laya-carrier': 'LAYA',
  'laya-carrier': 'LAYA',
  'pallas-g3': 'PALLAS',
  'melio-carbon-2026': 'MELIO',
  'melio-carbon': 'MELIO',
  'sirona-gi-i-size': 'SIRONA',
};

const productNavButtonNames: Record<string, string> = {
  'cybex-laya-carrier': 'レイヤ キャリア',
  'laya-carrier': 'レイヤ キャリア',
  'pallas-g3': 'パラス G3',
  'melio-carbon-2026': 'メリオ カーボン',
  'melio-carbon': 'メリオ カーボン',
  'sirona-gi-i-size': 'シローナ Gi i-Size',
};

const productCatchCopies: Record<string, string> = {
  'cybex-laya-carrier': '軽やかに、毎日の抱っこを美しく。',
  'laya-carrier': '軽やかに、毎日の抱っこを美しく。',
  'pallas-g3': '成長に寄り添うロングユース設計。',
  'melio-carbon-2026': '都市の移動を軽やかにする一台。',
  'melio-carbon': '都市の移動を軽やかにする一台。',
  'sirona-gi-i-size': '新生児から使える安心の回転式シート。',
};

const appElement = document.querySelector<HTMLDivElement>('#brand-app');
if (!appElement) throw new Error('#brand-app was not found.');
const app: HTMLDivElement = appElement;

mountCommonHeader('other');
void renderBrandPage();

async function renderBrandPage(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const slug = (params.get('slug') || params.get('brand') || '').trim().toLowerCase();
  if (!slug) {
    renderEmpty('ブランドが指定されていません。');
    return;
  }

  app.innerHTML = '<main class="brand-showcase"><p class="brand-state">ブランド情報を読み込んでいます。</p></main>';

  const { data, error } = await supabase.from('brands').select('*').eq('slug', slug).maybeSingle();
  if (error) {
    console.error('Failed to load brand:', error);
    renderEmpty('ブランド情報は準備中です。');
    return;
  }

  const brand = data as Brand | null;
  if (!brand) {
    renderEmpty('ブランド情報はまだ登録されていません。');
    return;
  }

  const [productsResult, logo, hero] = await Promise.all([
    supabase.from('products').select('*').eq('brand_id', brand.id).order('rank_no', { ascending: true, nullsFirst: false }),
    loadBrandAsset(brand, 'logo'),
    loadBrandAsset(brand, 'hero'),
  ]);

  if (productsResult.error) console.error('Failed to load brand products:', productsResult.error);

  const products = ((productsResult.data ?? []) as Product[]).slice(0, 4);
  const imageMap = await loadProductImages(products);
  const showcaseProducts = products.map((product) => ({
    product,
    image: getProductImage(product, imageMap),
  }));
  const heroImage = getBrandHeroImage(hero, showcaseProducts);
  updateMetadata(brand);

  app.innerHTML = `
    <main class="brand-showcase">
      <nav class="brand-breadcrumb brand-showcase__breadcrumb" aria-label="パンくず"><a href="/">トップ</a><span>/</span><span>${escapeHtml(brand.display_name)}</span></nav>
      ${renderShowcaseHero(brand, logo, heroImage)}
      ${showcaseProducts.length > 0 ? renderAnchorNav(showcaseProducts) : '<div class="brand-empty">このブランドの商品は現在準備中です。</div>'}
      ${showcaseProducts.map(({ product, image }) => renderShowcaseProduct(product, brand.display_name, image)).join('')}
      ${showcaseProducts.length > 0 ? renderFinalAction(brand) : ''}
      ${renderVideo(brand.youtube_url)}
    </main>
  `;
  applyFadeUpAnimations(app);
}

async function loadBrandAsset(brand: Brand, kind: 'logo' | 'hero'): Promise<BrandAsset | null> {
  const assetType = kind === 'logo' ? 'brand_logo' : 'brand_hero';
  const explicitKey = kind === 'logo' ? brand.logo_asset_key : brand.hero_asset_key;
  const { data, error } = await supabase.rpc('get_published_site_assets', {
    p_asset_type: assetType,
    p_asset_key: explicitKey || null,
  });
  if (error) {
    console.error(`Failed to load brand ${kind} asset:`, error);
    return null;
  }

  const assets = (data ?? []) as BrandAsset[];
  if (explicitKey) return assets[0] ?? null;

  const candidates = kind === 'logo'
    ? [`brand_logo_${brand.slug}`, `brand_${brand.slug}_logo`, `${brand.slug}_logo`, `brand-${brand.slug}-logo`, `${brand.slug}-logo`, brand.slug]
    : [`brand_hero_${brand.slug}`, `brand_${brand.slug}_hero`, `${brand.slug}_hero`, `brand-${brand.slug}-hero`, `${brand.slug}-hero`];
  const normalizedBrandName = brand.display_name.toLowerCase();
  return assets.find((asset) => candidates.includes(asset.asset_key))
    ?? assets.find((asset) => asset.asset_key.includes(brand.slug))
    ?? assets.find((asset) => `${asset.title} ${asset.alt_text}`.toLowerCase().includes(normalizedBrandName))
    ?? null;
}

function renderShowcaseHero(brand: Brand, logo: BrandAsset | null, heroImage: string): string {
  const description = brand.description || brand.short_description || 'ブランド紹介は準備中です。';
  const hasLogo = Boolean(logo?.desktop_image_url);
  return `
    <section class="brand-showcase-hero" aria-labelledby="brand-page-title">
      <div class="brand-hero-photo">
        ${heroImage ? `<img src="${escapeAttr(heroImage)}" alt="${escapeAttr(logo?.alt_text || `${brand.display_name} ブランドイメージ`)}">` : `<span>${escapeHtml(brand.display_name)}</span>`}
      </div>
      <div class="brand-hero-copy">
        ${hasLogo ? `<img class="brand-hero-logo" src="${escapeAttr(logo?.desktop_image_url)}" alt="${escapeAttr(logo?.alt_text || `${brand.display_name} ロゴ`)}">` : ''}
        <h1 id="brand-page-title" class="${hasLogo ? 'visually-hidden' : 'brand-hero-text-logo'}">${escapeHtml(brand.display_name)}</h1>
        ${description ? `<p class="brand-hero-description">${formatMultiline(description)}</p>` : ''}
      </div>
    </section>`;
}

function renderAnchorNav(items: ShowcaseProduct[]): string {
  return `
    <section class="brand-anchor-nav" aria-label="商品シリーズ">
      <div class="brand-showcase-container">
        <div class="brand-anchor-grid">
          ${items.map(({ product, image }) => renderAnchorCard(product, image)).join('')}
        </div>
      </div>
    </section>`;
}

function renderAnchorCard(product: Product, image: string): string {
  const title = getProductShortName(product);
  const buttonLabel = getProductNavButtonName(product);
  const productId = getProductAnchorId(product);
  return `
    <a class="brand-anchor-card" href="#${escapeAttr(productId)}"${image ? ` style="--bg:url('${escapeAttr(image)}')"` : ''}>
      <span class="brand-anchor-card-inner">
        <span class="brand-anchor-title">${escapeHtml(title)}</span>
        <span class="brand-anchor-button">${escapeHtml(buttonLabel)} ▼</span>
      </span>
    </a>`;
}

function renderShowcaseProduct(product: Product, brandDisplayName: string, image: string): string {
  const id = String(product.id);
  const name = getProductName(product);
  const subtitle = getProductSubtitle(product, name);
  const description = getProductDescription(product);
  const rows = getSpecRows(product, name);
  return `
    <section class="brand-feature-heading" aria-labelledby="${escapeAttr(getProductAnchorId(product))}-heading">
      <div class="brand-showcase-container">
        <h2 id="${escapeAttr(getProductAnchorId(product))}-heading">${escapeHtml(getFeatureHeading(product, name))}</h2>
      </div>
    </section>
    <section class="brand-product-feature" id="${escapeAttr(getProductAnchorId(product))}">
      <div class="brand-showcase-container">
        <div class="brand-product-layout">
          <div class="brand-product-media">
            ${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(name)}" loading="lazy">` : `<span>${escapeHtml(name)}</span>`}
          </div>
          <div class="brand-product-copy">
            <p class="brand-product-maker">${escapeHtml(getText(product.brand, brandDisplayName))}</p>
            <h3>${escapeHtml(name)}</h3>
            ${subtitle ? `<p class="brand-product-subtitle">${escapeHtml(subtitle)}</p>` : ''}
            <p class="brand-product-price">${escapeHtml(formatPrice(product.price_yen))}</p>
            ${description ? `<p class="brand-product-description">${formatMultiline(description)}</p>` : ''}
            ${rows.length > 0 ? renderSpecTable(rows) : ''}
          </div>
        </div>
      </div>
    </section>
    <section class="brand-related-actions">
      <a class="brand-outline-button" href="/product.html?id=${encodeURIComponent(id)}">${escapeHtml(name)}の詳細を見る ▶</a>
    </section>
  `;
}

function renderSpecTable(rows: Array<[string, string]>): string {
  return `
    <table class="brand-product-specs">
      <tbody>
        ${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}
      </tbody>
    </table>`;
}

function renderFinalAction(brand: Brand): string {
  return `
    <section class="brand-related-actions brand-related-actions--final">
      <a class="brand-final-button" href="/products.html?brand=${encodeURIComponent(brand.slug)}">${escapeHtml(brand.display_name)}の商品一覧を見る ▶</a>
    </section>`;
}

async function loadProductImages(products: Product[]): Promise<Map<string, ProductImagePair>> {
  const map = new Map<string, ProductImagePair>();
  if (products.length === 0) return map;
  const productIds = products.map((product) => product.id);
  const [uploadedResult, affiliateResult] = await Promise.all([
    supabase
      .from('product_uploaded_images')
      .select('product_id, public_url, role, is_primary, display_order')
      .in('product_id', productIds)
      .order('display_order', { ascending: true }),
    supabase
    .from('product_affiliate_images')
      .select('product_id, rakuten_image_html, image_url, role, is_primary, display_order, sort_order')
    .eq('media_type', 'image')
      .in('product_id', productIds)
      .order('display_order', { ascending: true }),
  ]);
  if (uploadedResult.error) console.error('Failed to load brand uploaded product images:', uploadedResult.error);
  if (affiliateResult.error) console.error('Failed to load brand affiliate product images:', affiliateResult.error);
  if (uploadedResult.error && affiliateResult.error) {
    return map;
  }

  const uploadedGrouped = new Map<string, ProductUploadedImage[]>();
  for (const image of (uploadedResult.data ?? []) as ProductUploadedImage[]) {
    const key = String(image.product_id);
    uploadedGrouped.set(key, [...(uploadedGrouped.get(key) ?? []), image]);
  }

  const affiliateGrouped = new Map<string, ProductImage[]>();
  for (const image of (affiliateResult.data ?? []) as ProductImage[]) {
    const key = String(image.product_id);
    affiliateGrouped.set(key, [...(affiliateGrouped.get(key) ?? []), image]);
  }

  for (const product of products) {
    const productId = String(product.id);
    const uploadedImages = [...(uploadedGrouped.get(productId) ?? [])].sort(sortUploadedImages);
    const affiliateImages = [...(affiliateGrouped.get(productId) ?? [])].sort(sortAffiliateImages);
    const primary = uploadedImages.find((image) => image.role === 'main')?.public_url
      || uploadedImages[0]?.public_url
      || getAffiliateImageSrc(affiliateImages.find((image) => image.role === 'main' || image.is_primary))
      || getAffiliateImageSrc(affiliateImages[0])
      || getText(product.image_url, '');
    const secondary = uploadedImages.map((image) => image.public_url).find((src) => src && src !== primary)
      || affiliateImages.map(getAffiliateImageSrc).find((src) => src && src !== primary)
      || '';
    const showcase = secondary || primary || getText(product.image_url, '');
    if (primary || showcase) map.set(productId, { primary, secondary, showcase });
  }

  return map;
}

function sortUploadedImages(a: ProductUploadedImage, b: ProductUploadedImage): number {
  return Number(b.role === 'main') - Number(a.role === 'main')
    || Number(b.is_primary) - Number(a.is_primary)
    || Number(a.display_order ?? 999) - Number(b.display_order ?? 999);
}

function sortAffiliateImages(a: ProductImage, b: ProductImage): number {
  return Number(b.role === 'main') - Number(a.role === 'main')
    || Number(b.is_primary) - Number(a.is_primary)
    || Number(a.sort_order ?? a.display_order ?? 999) - Number(b.sort_order ?? b.display_order ?? 999);
}

function getAffiliateImageSrc(image: ProductImage | undefined): string {
  if (!image) return '';
  return getText(image.image_url, '') || extractImageSrc(image.rakuten_image_html ?? '');
}

function getProductImage(product: Product, imageMap: Map<string, ProductImagePair>): string {
  const imagePair = imageMap.get(String(product.id));
  return imagePair?.showcase || imagePair?.primary || getText(product.image_url, '');
}

function getBrandHeroImage(hero: BrandAsset | null, products: ShowcaseProduct[]): string {
  return hero?.desktop_image_url || products.find((item) => item.image)?.image || '';
}

function getProductAnchorId(product: Product): string {
  return `brand-product-${slugify(getText(product.slug, '') || String(product.id))}`;
}

function getProductName(product: Product): string {
  const fallback = getFirstText(product, ['name', 'product_name', 'title', 'model_name']) || `商品ID ${String(product.id)}`;
  return normalizeProductDisplayName(product, fallback) || fallback;
}

function getProductSubtitle(product: Product, name: string): string {
  const subtitle = getFirstText(product, ['subtitle', 'sub_name', 'japanese_name', 'product_name_ja', 'series_name']);
  return subtitle && subtitle !== name ? subtitle : '';
}

function getProductShortName(product: Product): string {
  const mapped = getMappedProductText(product, productShortNames);
  if (mapped) return mapped;
  const name = getProductName(product);
  const normalized = normalizeProductKey(name);
  if (normalized.includes('laya')) return 'LAYA';
  if (normalized.includes('pallas') || name.includes('パラス')) return 'PALLAS';
  if (normalized.includes('melio') || name.includes('メリオ')) return 'MELIO';
  if (normalized.includes('sirona') || name.includes('シローナ')) return 'SIRONA';
  return name.split(/\s|　/).filter(Boolean)[0]?.toUpperCase() || name;
}

function getProductNavButtonName(product: Product): string {
  const mapped = getMappedProductText(product, productNavButtonNames);
  if (mapped) return mapped;
  return getProductSubtitle(product, getProductName(product)) || getProductName(product);
}

function getProductDescription(product: Product): string {
  const description = getFirstText(product, [
    'description',
    'short_description',
    'product_description',
    'feature_description',
    'summary',
    'caption',
    'memo',
  ]);
  return description.length > 160 ? `${description.slice(0, 157)}...` : description;
}

function getFeatureHeading(product: Product, name: string): string {
  return getMappedProductText(product, productCatchCopies)
    || getFirstText(product, ['feature_heading', 'catch_copy', 'catchphrase', 'headline'])
    || `${name}を毎日の暮らしに。`;
}

function getSpecRows(product: Product, name: string): Array<[string, string]> {
  return [
    ['商品名', name],
    ['タイプ', getFirstText(product, ['type', 'product_type'])],
    ['対象月齢', getFirstText(product, ['target_age', 'age_range', 'age'])],
    ['重量', weightLabel(product.weight_kg ?? product.weight)],
    ['適応体重', getFirstText(product, ['applicable_weight', 'weight_capacity', 'age_weight_limit', 'load_capacity', 'max_load', 'max_weight'])],
    ['製品サイズ', getFirstText(product, ['product_size', 'size', 'dimensions', 'product_dimensions'])],
    ['収納サイズ', getFirstText(product, ['folded_size', 'folding_size', 'storage_position'])],
    ['バスケット容量', getFirstText(product, ['basket_capacity', 'shopping_basket', 'basket'])],
    ['付属品', getFirstText(product, ['accessories', 'included_items'])],
    ['保証', getFirstText(product, ['warranty', 'guarantee'])],
  ].filter((row): row is [string, string] => Boolean(row[1]));
}

function renderVideo(value: string | null): string {
  const embedUrl = getYouTubeEmbedUrl(value);
  if (!embedUrl) return '';
  return `<section class="brand-video"><div class="section-heading-pair"><p class="brand-eyebrow">MOVIE</p><h2>ブランドムービー</h2></div><div class="brand-video__frame"><iframe src="${escapeAttr(embedUrl)}" title="ブランドムービー" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></section>`;
}

function getYouTubeEmbedUrl(value: string | null): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    let id = '';
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
    else if (url.hostname.endsWith('youtube.com') || url.hostname.endsWith('youtube-nocookie.com')) id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] ?? '';
    return /^[A-Za-z0-9_-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : '';
  } catch {
    return '';
  }
}

function renderEmpty(message: string): void {
  app.innerHTML = `<main class="brand-showcase"><section class="brand-empty brand-empty--page"><h1>ブランド</h1><p>${escapeHtml(message)}</p><a href="/products.html">商品一覧を見る</a></section></main>`;
}

function updateMetadata(brand: Brand): void {
  document.title = replacePublicSiteName(brand.seo_title || `${brand.display_name} | iLy.`);
  const description = brand.seo_description || brand.short_description;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (meta && description) meta.content = replacePublicSiteName(description);

  document.querySelectorAll<HTMLMetaElement>('meta[property="og:site_name"]').forEach((element) => {
    element.content = 'iLy.';
  });
  document.querySelectorAll<HTMLMetaElement>('meta[property="og:title"], meta[name="twitter:title"]').forEach((element) => {
    element.content = document.title;
  });
}

function replacePublicSiteName(value: string): string {
  return value.replace(/IRODORI/g, 'iLy.');
}

function extractImageSrc(html: string): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.querySelector('img')?.getAttribute('src') ?? '';
}

function formatPrice(value: unknown): string {
  const number = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(number) && number > 0 ? `¥${Math.round(number).toLocaleString('ja-JP')}（税込）` : '価格未登録';
}

function getText(value: unknown, fallback: string): string {
  return value === null || value === undefined || String(value).trim() === '' ? fallback : String(value).trim();
}

function getFirstText(product: Product, keys: string[]): string {
  for (const key of keys) {
    const value = product[key];
    if (Array.isArray(value)) {
      const joined = value.map((item) => String(item).trim()).filter(Boolean).join(' / ');
      if (joined) return joined;
    } else if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function weightLabel(value: unknown): string {
  if (value === null || value === undefined || String(value).trim() === '') return '';
  const text = String(value).trim();
  const number = Number(text.replace(/[^\d.]/g, ''));
  if (Number.isFinite(number) && number > 0 && !/[a-zA-Z㎏kgＫＧ]/.test(text)) return `${number}kg`;
  return text;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}

function getMappedProductText(product: Product, map: Record<string, string>): string {
  const candidates = getProductKeyCandidates(product);
  for (const key of candidates) {
    if (map[key]) return map[key];
  }
  return '';
}

function getProductKeyCandidates(product: Product): string[] {
  const values = [
    getText(product.slug, ''),
    getText(product.product_slug, ''),
    getText(product.asset_key, ''),
    getProductName(product),
  ];
  return Array.from(new Set(values.flatMap((value) => {
    const normalized = normalizeProductKey(value);
    return [normalized, slugify(value)].filter(Boolean);
  })));
}

function normalizeProductKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatMultiline(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
