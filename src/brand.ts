import './styles.css';
import './brand.css';
import { mountCommonHeader } from './shared-ui';
import { supabase } from './lib/supabase';
import type { Brand, Product, ProductColor } from './types';

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
  is_primary: boolean | null;
  display_order: number | null;
};

type ProductImagePair = {
  primary: string;
  secondary: string;
};

const appElement = document.querySelector<HTMLDivElement>('#brand-app');
if (!appElement) throw new Error('#brand-app was not found.');
const app: HTMLDivElement = appElement;

mountCommonHeader('other');
void renderBrandPage();

async function renderBrandPage(): Promise<void> {
  const slug = new URLSearchParams(window.location.search).get('slug')?.trim().toLowerCase() ?? '';
  if (!slug) {
    renderEmpty('ブランドが指定されていません。');
    return;
  }

  app.innerHTML = '<main class="brand-page"><p class="brand-state">ブランド情報を読み込んでいます。</p></main>';

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

  const products = (productsResult.data ?? []) as Product[];
  const [imageMap, colorMap] = await Promise.all([loadProductImages(products), loadProductColors(products)]);
  updateMetadata(brand);

  app.innerHTML = `
    <main class="brand-page">
      <nav class="brand-breadcrumb" aria-label="パンくず"><a href="/">トップ</a><span>/</span><span>${escapeHtml(brand.display_name)}</span></nav>
      ${renderBrandOverview(brand, logo)}
      ${renderBrandVisual(brand, hero)}

      <section class="brand-products" aria-labelledby="brand-products-title">
        <div class="brand-section-heading section-heading-pair"><p class="brand-eyebrow">COLLECTION</p><h2 id="brand-products-title">商品ラインナップ</h2></div>
        ${products.length > 0 ? `<div class="brand-product-grid iro-product-grid">${products.map((product) => renderProductCard(product, brand.display_name, imageMap, colorMap)).join('')}</div>` : '<div class="brand-empty">このブランドの商品は現在準備中です。</div>'}
      </section>
      ${renderVideo(brand.youtube_url)}
    </main>
  `;
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
    ? [`brand_${brand.slug}_logo`, `${brand.slug}_logo`, `brand-${brand.slug}-logo`, `${brand.slug}-logo`, brand.slug]
    : [`brand_${brand.slug}_hero`, `${brand.slug}_hero`, `brand-${brand.slug}-hero`, `${brand.slug}-hero`];
  return assets.find((asset) => candidates.includes(asset.asset_key)) ?? null;
}

function renderBrandOverview(brand: Brand, logo: BrandAsset | null): string {
  const description = brand.description || brand.short_description || 'ブランド紹介は準備中です。';
  const hasLogo = Boolean(logo?.desktop_image_url);
  return `
    <section class="brand-overview" aria-labelledby="brand-page-title">
      <div class="brand-overview__logo">
        ${hasLogo ? `<img src="${escapeAttr(logo?.desktop_image_url)}" alt="${escapeAttr(logo?.alt_text || `${brand.display_name} ロゴ`)}">` : `<span>${escapeHtml(brand.display_name)}</span>`}
      </div>
      <div class="brand-overview__copy">
        <h1 id="brand-page-title" class="${hasLogo ? 'visually-hidden' : ''}">${escapeHtml(brand.display_name)}</h1>
        <p>${formatMultiline(description)}</p>
      </div>
    </section>`;
}

function renderBrandVisual(brand: Brand, hero: BrandAsset | null): string {
  if (!hero?.desktop_image_url) return '';
  const heroPcImage = hero.desktop_image_url;
  const heroSpImage = hero.mobile_image_url || heroPcImage;
  return `
    <section class="brand-visual" aria-label="${escapeAttr(`${brand.display_name} ブランドイメージ`)}">
      <picture class="brand-visual__media">
        <source media="(max-width: 640px)" srcset="${escapeAttr(heroSpImage)}">
        <img src="${escapeAttr(heroPcImage)}" alt="${escapeAttr(hero.alt_text || `${brand.display_name} ブランドイメージ`)}" width="${hero.desktop_width}" height="${hero.desktop_height}">
      </picture>
    </section>`;
}

async function loadProductImages(products: Product[]): Promise<Map<string, ProductImagePair>> {
  const map = new Map<string, ProductImagePair>();
  if (products.length === 0) return map;
  const { data, error } = await supabase
    .from('product_affiliate_images')
    .select('product_id, rakuten_image_html, is_primary, display_order')
    .eq('media_type', 'image')
    .in('product_id', products.map((product) => product.id))
    .order('display_order', { ascending: true });
  if (error) {
    console.error('Failed to load brand product images:', error);
    return map;
  }
  const grouped = new Map<string, ProductImage[]>();
  for (const image of (data ?? []) as ProductImage[]) {
    const key = String(image.product_id);
    grouped.set(key, [...(grouped.get(key) ?? []), image]);
  }
  grouped.forEach((images, productId) => {
    const sorted = [...images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || Number(a.display_order) - Number(b.display_order));
    const primary = extractImageSrc(sorted[0]?.rakuten_image_html ?? '');
    const secondary = sorted
      .slice(1)
      .map((image) => extractImageSrc(image.rakuten_image_html ?? ''))
      .find((src) => src && src !== primary) ?? '';
    if (primary) map.set(productId, { primary, secondary });
  });
  return map;
}

async function loadProductColors(products: Product[]): Promise<Map<string, ProductColor[]>> {
  const map = new Map<string, ProductColor[]>();
  if (products.length === 0) return map;
  const { data, error } = await supabase
    .from('product_colors')
    .select('*')
    .in('product_id', products.map((product) => product.id))
    .order('display_order', { ascending: true });
  if (error) {
    console.error('Failed to load brand product colors:', error);
    return map;
  }
  for (const color of (data ?? []) as ProductColor[]) {
    const key = String(color.product_id);
    map.set(key, [...(map.get(key) ?? []), color]);
  }
  return map;
}

function renderProductCard(product: Product, brandDisplayName: string, imageMap: Map<string, ProductImagePair>, colorMap: Map<string, ProductColor[]>): string {
  const id = String(product.id);
  const name = getText(product.name, `商品ID ${id}`);
  const imagePair = imageMap.get(id);
  const fallbackImage = getText(product.image_url, '');
  const colors = colorMap.get(id) ?? [];
  const brandName = getText(product.brand, brandDisplayName);
  return `
    <article class="brand-product-card iro-product-item">
      <a class="brand-product-card__image iro-product-media" href="/product.html?id=${encodeURIComponent(id)}">
        ${
          imagePair?.primary
            ? `
              <span class="image-hover-stack ${imagePair.secondary ? 'has-hover-image' : ''}">
                <img class="image-main" src="${escapeAttr(imagePair.primary)}" alt="${escapeAttr(name)}" loading="lazy">
                ${imagePair.secondary ? `<img class="image-secondary" src="${escapeAttr(imagePair.secondary)}" alt="" loading="lazy" aria-hidden="true">` : ''}
              </span>
            `
            : fallbackImage
              ? `<img src="${escapeAttr(fallbackImage)}" alt="${escapeAttr(name)}" loading="lazy">`
              : '<span>画像準備中</span>'
        }
      </a>
      <div class="brand-product-card__body iro-product-content">
        ${brandName ? `<p class="brand-product-card__category">${escapeHtml(brandName)}</p>` : ''}
        <h3><a href="/product.html?id=${encodeURIComponent(id)}">${escapeHtml(name)}</a></h3>
        <p class="brand-product-card__price">${escapeHtml(formatPrice(product.price_yen))}</p>
        ${colors.length > 0 ? `<div class="brand-product-card__colors color-swatches" aria-label="カラー">${colors.slice(0, 6).map((color) => `<span style="--swatch:${escapeAttr(color.swatch_hex)}" title="${escapeAttr(color.name)}"></span>`).join('')}</div>` : ''}
      </div>
    </article>
  `;
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
  app.innerHTML = `<main class="brand-page"><section class="brand-empty brand-empty--page"><h1>ブランド</h1><p>${escapeHtml(message)}</p><a href="/products.html">商品一覧を見る</a></section></main>`;
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

function formatMultiline(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
