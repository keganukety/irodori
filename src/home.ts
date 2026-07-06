import './home.css';
import { mountBackToTop } from './back-to-top';
import {
  applyFadeUpAnimations,
  mountCommonHeader,
  normalizeProductDisplayBrand,
  normalizeProductDisplayName,
} from './shared-ui';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import { setupProductQuickView } from './product-quick-view';
import type { Brand, Product as SharedProduct, ProductColor } from './types';

type Product = {
  id: string | number;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  price_yen?: string | number | null;
  feature_tags?: string[] | string | null;
  target_age?: string | null;
  weight_kg?: string | number | null;
  rank_no?: string | number | null;
  product_type?: string | null;
  brand_id?: string | null;
  [key: string]: unknown;
};

type ProductImage = {
  product_id: string | number;
  rakuten_image_html?: string | null;
  image_url?: string | null;
  is_primary?: boolean | null;
  display_order?: number | null;
  sort_order?: number | null;
};

type HomeProduct = Product & {
  imageSrc?: string;
  hoverImageSrc?: string;
  categoryImageSrc?: string;
};

type Category = {
  label: string;
  patterns: RegExp[];
};

type CategoryCard = {
  label: string;
  href: string;
  imageSrc?: string;
};

type BrandCard = {
  brand: string;
  count: number;
  slug?: string;
  logoAssetKey?: string | null;
};

type HomeSiteAsset = {
  asset_key: string;
  asset_type?: string;
  title: string;
  alt_text: string;
  desktop_image_url: string;
  desktop_width: number;
  desktop_height: number;
  mobile_image_url?: string | null;
  mobile_width?: number | null;
  mobile_height?: number | null;
  link_url: string | null;
  display_order: number;
  sort_order?: number;
  caption?: string | null;
};

type HomeMainHeroAsset = HomeSiteAsset & {
  mobile_image_url: string;
  mobile_width: number;
  mobile_height: number;
};

type HomeState = {
  activeCategory: string;
  productsByCategory: Map<string, HomeProduct[]>;
  categoryCards: CategoryCard[];
  brands: BrandCard[];
  mainHeroes: HomeMainHeroAsset[];
  siteAssetsByKey: Map<string, HomeSiteAsset>;
  hasLoaded: boolean;
  loadError: string | null;
};

type HomeLoadResult = {
  productsByCategory: Map<string, HomeProduct[]>;
  categoryCards: CategoryCard[];
  brands: BrandCard[];
};

const appElement = document.querySelector<HTMLDivElement>('#home-app');

if (!appElement) {
  throw new Error('#home-app が見つかりません。');
}

const app: HTMLDivElement = appElement;

document.body.classList.add('home-body');
mountBackToTop();
mountCommonHeader('home');

const categories: Category[] = [
  { label: 'ベビーカー', patterns: [/ベビーカー/, /stroller/i, /babycar/i] },
  { label: '抱っこ紐', patterns: [/抱っこ紐/, /抱っこひも/, /baby carrier/i, /carrier/i] },
  { label: 'チャイルドシート', patterns: [/チャイルドシート/, /car seat/i, /carseat/i] },
  { label: 'ヒップシート', patterns: [/ヒップシート/, /hipseat/i, /hip seat/i] },
];

const initialState: HomeState = {
  activeCategory: categories[0].label,
  productsByCategory: new Map(categories.map((category) => [category.label, []])),
  categoryCards: getDefaultCategoryCards(),
  brands: [],
  mainHeroes: [],
  siteAssetsByKey: new Map(),
  hasLoaded: false,
  loadError: null,
};

let currentHomeState = initialState;
let homeEventsBound = false;
let homeHeroTimer: number | null = null;
let currentHomeHeroIndex = 0;
let homeColorsByProductId = new Map<string, ProductColor[]>();
let homeBrandsById = new Map<string, Brand>();
let selectedHomeHeroAssetKey: string | null = null;

const categoryAssetCandidates: Record<string, string[]> = {
  ベビーカー: ['category_stroller', 'category_babycar', 'category_baby_car'],
  抱っこ紐: ['category_carrier', 'category_baby_carrier', 'category_babycarrier'],
  チャイルドシート: ['category_child_seat', 'category_carseat', 'category_car_seat'],
  ヒップシート: ['category_hipseat', 'category_hip_seat'],
};

const homeLogoAssetCandidates = [
  'site_logo',
  'site_logo_ily',
  'ily_logo',
  'logo_ily',
  'brand_logo_ily',
  'brand_logo_ily2',
  'brand_ily_logo',
  'icon_ily',
];

const SHOPPING_LINKS = [
  {
    key: 'rakuten',
    label: '楽天',
    assetKey: 'icon_stroller_rakuten',
    href: 'https://a.r10.to/hP6MNu',
  },
  {
    key: 'amazon',
    label: 'Amazon',
    assetKey: 'icon_stroller_amazon',
    href: 'https://amzn.to/43VvT3g',
  },
  {
    key: 'yahoo',
    label: 'Yahoo',
    assetKey: 'icon_stroller_yahoo',
    href: 'https://yahoo.jp/V3Bud7',
  },
] as const;

const defaultHomeHeroCopies = [
  {
    title: '愛ある ひ',
    lines: ['「あなたがいてうれしい」', 'その笑顔のために、', '私たちのガイドはある。'],
  },
  {
    title: '選ぶ時間も、',
    lines: ['家族の記憶になる。', '迷いをほどいて、', '暮らしに合うひとつへ。'],
  },
  {
    title: '小さくて、',
    lines: ['おおきな毎日に、', '楽しくなるたからもの', '見つけよう。'],
  },
] as const;
const defaultHomeHeroCopy = defaultHomeHeroCopies[0];
const homeHeroLastAssetKeyStorageKey = 'ily_last_home_hero_asset_key';
const homeHeroLastCopyStorageKey = 'ily_last_home_hero_copy_key';

void initializeHome();

async function initializeHome(): Promise<void> {
  renderShell(initialState);

  const [state, siteAssets] = await Promise.all([loadHomeState(), loadHomeSiteAssets()]);
  const siteAssetsByKey = new Map(siteAssets.map((asset) => [asset.asset_key, asset]));
  renderShell({
    ...state,
    siteAssetsByKey,
    mainHeroes: getHomeMainHeroes(siteAssets),
    categoryCards: getCategoryCards(state.productsByCategory, siteAssetsByKey),
  });
}

async function loadHomeSiteAssets(): Promise<HomeSiteAsset[]> {
  if (!isSupabaseConfigured) {
    if (import.meta.env.DEV) {
      console.warn('TOP素材を取得できません: Supabaseが設定されていません。');
    }
    return [];
  }

  try {
    const { data, error } = await supabase.rpc('get_published_site_assets', {
      p_asset_type: null,
      p_asset_key: null,
    });

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? (data as HomeSiteAsset[]) : [];
  } catch (error) {
    console.error('TOP素材の取得に失敗しました。', error);
    return [];
  }
}

function getHomeMainHeroes(publicAssets: HomeSiteAsset[]): HomeMainHeroAsset[] {
  const heroAssets = publicAssets
    .filter(isHomeMainHeroAsset)
    .filter((asset) => isSafeImageUrl(asset.desktop_image_url))
    .map((asset) => ({
      ...asset,
      mobile_image_url: isSafeImageUrl(asset.mobile_image_url)
        ? asset.mobile_image_url
        : asset.desktop_image_url,
      mobile_width: getPositiveDimension(asset.mobile_width, asset.desktop_width),
      mobile_height: getPositiveDimension(asset.mobile_height, asset.desktop_height),
      link_url: getSafeAssetLink(asset.link_url),
    }))
    .sort((a, b) => getHeroSortOrder(a) - getHeroSortOrder(b) || a.asset_key.localeCompare(b.asset_key));

  if (heroAssets.length === 0) {
    if (import.meta.env.DEV) {
      console.warn(
        'home_main_heroで始まる素材は公開RPCの結果にありません。is_published、starts_at、ends_atを確認してください。',
        { returnedAssetKeys: publicAssets.map((item) => item.asset_key) },
      );
    }
    return [];
  }

  const legacyKeys = heroAssets
    .map((asset) => asset.asset_key)
    .filter((assetKey) => /^home_main_hero\d+$/.test(assetKey));
  if (import.meta.env.DEV && legacyKeys.length > 0) {
    console.warn('メインバナーの連番キーは home_main_hero_2 の形式を推奨します。', { legacyKeys });
  }

  return heroAssets;
}

function isHomeMainHeroAsset(asset: HomeSiteAsset): boolean {
  const assetKey = asset.asset_key.toLowerCase();
  const assetType = String(asset.asset_type ?? '').toLowerCase();
  return assetKey.startsWith('home_main_hero')
    || assetKey.startsWith('home_hero')
    || assetKey.startsWith('top_hero')
    || assetKey.startsWith('main_hero')
    || assetType === 'home_hero'
    || assetType === 'top_hero';
}

async function loadHomeState(): Promise<HomeState> {
  const emptyState: HomeState = {
    ...initialState,
    productsByCategory: new Map(categories.map((category) => [category.label, []])),
    siteAssetsByKey: new Map(),
    hasLoaded: true,
    loadError: null,
  };

  if (!isSupabaseConfigured) {
    console.error('Supabaseの公開接続設定がありません。VITE_SUPABASE_URLとVITE_SUPABASE_ANON_KEYを確認してください。');
    return {
      ...emptyState,
      loadError: '商品データを読み込めません。サイトの接続設定を確認してください。',
    };
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('rank_no', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .limit(240);

    if (error) {
      throw error;
    }

    const products = Array.isArray(data) ? (data as Product[]) : [];
    const { productsByCategory, categoryCards, brands } = await buildHomeLoadResult(products);

    return {
      activeCategory: categories[0].label,
      productsByCategory,
      categoryCards,
      brands,
      mainHeroes: [],
      siteAssetsByKey: new Map(),
      hasLoaded: true,
      loadError: null,
    };
  } catch (error) {
    console.error('トップページの商品取得に失敗しました。', error);
    return {
      ...emptyState,
      loadError: '商品データの読み込みに失敗しました。時間をおいて再度お試しください。',
    };
  }
}

async function buildHomeLoadResult(products: Product[]): Promise<HomeLoadResult> {
  const productsByCategory = groupProductsByCategory(products);
  const imageProducts = Array.from(productsByCategory.values()).flat();
  const [imagePairs, colorsResult, brandsResult] = await Promise.all([
    loadProductImages(imageProducts),
    supabase.from('product_colors').select('*').order('display_order', { ascending: true }),
    supabase.from('brands').select('*').eq('is_published', true),
  ]);
  if (colorsResult.error) console.info('商品カラーはmigration適用後に表示されます。', colorsResult.error.message);
  if (brandsResult.error) console.info('ブランドページ導線はmigration適用後に有効になります。', brandsResult.error.message);
  homeColorsByProductId = groupColors((colorsResult.data ?? []) as ProductColor[]);
  homeBrandsById = new Map(((brandsResult.data ?? []) as Brand[]).map((brand) => [brand.id, brand]));
  const enhancedProductsByCategory = new Map<string, HomeProduct[]>();

  productsByCategory.forEach((categoryProducts, category) => {
    enhancedProductsByCategory.set(
      category,
      categoryProducts.map((product) => ({
        ...product,
        imageSrc: imagePairs.get(String(product.id))?.primary,
        hoverImageSrc: imagePairs.get(String(product.id))?.secondary,
        categoryImageSrc: imagePairs.get(String(product.id))?.category,
      })),
    );
  });

  return {
    productsByCategory: enhancedProductsByCategory,
    categoryCards: getCategoryCards(enhancedProductsByCategory),
    brands: getPopularBrands(products),
  };
}

async function loadProductImages(products: Product[]): Promise<Map<string, { primary?: string; secondary?: string; category?: string }>> {
  const imagePairs = new Map<string, { primary?: string; secondary?: string; category?: string }>();
  const productIds = products.map((product) => product.id);

  if (productIds.length === 0) {
    return imagePairs;
  }

  try {
    const { data, error } = await supabase
      .from('product_affiliate_images')
      .select('product_id, rakuten_image_html, image_url, is_primary, display_order, sort_order')
      .eq('media_type', 'image')
      .in('product_id', productIds)
      .order('display_order', { ascending: true });

    if (error) {
      throw error;
    }

    const images = Array.isArray(data) ? (data as ProductImage[]) : [];
    const groupedImages = new Map<string, ProductImage[]>();

    images.forEach((image) => {
      const productId = String(image.product_id);
      const list = groupedImages.get(productId) ?? [];
      list.push(image);
      groupedImages.set(productId, list);
    });

    groupedImages.forEach((imagesForProduct, productId) => {
      const sortedImages = [...imagesForProduct].sort(
        (a, b) => getProductImageOrder(a) - getProductImageOrder(b),
      );
      const primaryImage = sortedImages.find((image) => image.is_primary) ?? sortedImages[0];
      const primary = getProductImageSrc(primaryImage);
      const secondary = sortedImages
        .filter((image) => image !== primaryImage)
        .map(getProductImageSrc)
        .find((src) => src && src !== primary);

      const categoryImage = sortedImages.find((image) => getProductImageOrder(image) === 2)
        ?? sortedImages.find((image) => getProductImageOrder(image) === 1);
      imagePairs.set(productId, {
        primary,
        secondary,
        category: getProductImageSrc(categoryImage),
      });
    });
  } catch (error) {
    console.error('トップページの商品画像取得に失敗しました。', error);
    throw error;
  }

  return imagePairs;
}

function renderShell(state: HomeState): void {
  currentHomeState = state;

  app.innerHTML = `
    <main class="home-page">
      ${renderHomeFixedHero(state)}
      <div class="home-hero-spacer" aria-hidden="true"></div>

      <div class="home-content-surface">
        ${renderHomeMarquee()}

        ${renderPickupSection(state)}

        ${renderSearchSection(state)}

        <section class="home-section home-recommended-section" aria-labelledby="category-products-title">
          <div class="home-section__header">
          <div>
            <p class="home-eyebrow">Recommended items</p>
            <h2 class="home-section-heading section-title" id="category-products-title">おすすめのアイテム</h2>
          </div>
          </div>
          ${renderCategoryProducts(state)}
        </section>

        ${renderHomeMessageSection(state)}

        <section class="home-section home-brand-section" aria-labelledby="popular-brands-title">
          <div class="home-section__header">
            <div>
              <p class="home-eyebrow">Brand</p>
              <h2 id="popular-brands-title">取り扱いブランド</h2>
            </div>
          </div>
          ${renderBrandCards(state.brands, state.siteAssetsByKey)}
        </section>

        ${renderShoppingSection(state.siteAssetsByKey)}

        ${renderHomeFooter()}
      </div>
    </main>
  `;

  bindHomeEvents();
  bindHomeHeroCarousel();
  updateHomeHeaderLogo(state.siteAssetsByKey);
  const visibleProducts = Array.from(state.productsByCategory.values()).flat();
  setupProductQuickView({
    products: visibleProducts as SharedProduct[],
    imageByProductId: new Map(visibleProducts.map((product) => [String(product.id), product.imageSrc ?? '']).filter((entry): entry is [string, string] => Boolean(entry[1]))),
    colorsByProductId: homeColorsByProductId,
    brandsById: homeBrandsById,
  });
  applyFadeUpAnimations(app);
}

// TOPの見出し帯に、控えめな横ループの装飾テキストを添える（装飾のみ・aria-hidden）。
function renderHomeMarquee(): string {
  const phrase = 'Love the baby, love the family.';
  const unit = `<span class="home-marquee__item">${escapeHtml(phrase)}</span><span class="home-marquee__dot">·</span>`;
  const group = `<div class="home-marquee__group">${unit.repeat(6)}</div>`;
  return `
    <div class="home-marquee" aria-hidden="true">
      <div class="home-marquee__track">
        ${group}
        ${group}
      </div>
    </div>
  `;
}

function renderHomeSectionHeading(english: string, japanese: string): string {
  return `
    <div class="home-section__header home-section__header--centered">
      <p class="home-eyebrow">${escapeHtml(english)}</p>
      <h2 class="home-section-heading section-title">${escapeHtml(japanese)}</h2>
    </div>
  `;
}

function renderHomeFixedHero(state: HomeState): string {
  const heroMedia = getHomeFixedHeroMedia(state);
  const heroCopy = heroMedia?.copy ?? defaultHomeHeroCopy;
  const image = heroMedia
    ? `
      <picture class="home-fixed-hero__media">
        <source media="(max-width: 640px)" srcset="${escapeAttr(heroMedia.mobileSrc)}">
        <img
          src="${escapeAttr(heroMedia.desktopSrc)}"
          alt="${escapeAttr(heroMedia.alt)}"
          loading="eager"
          fetchpriority="high"
          decoding="async"
        >
      </picture>
    `
    : '<div class="home-fixed-hero__media is-empty" aria-hidden="true"></div>';

  return `
    <section class="home-fixed-hero" aria-labelledby="home-fixed-hero-title">
      ${image}
      <div class="home-fixed-hero__overlay" aria-hidden="true"></div>
      <div class="home-fixed-hero__text">
        <h1 class="home-fixed-hero__title" id="home-fixed-hero-title">${escapeHtml(heroCopy.title)}</h1>
        <p class="home-fixed-hero__lead">${heroCopy.lines.map((line) => escapeHtml(line)).join('<br>')}</p>
      </div>
      <p class="home-fixed-hero__vertical vertical-text">赤ちゃんとの毎日を、少し軽く、少し心地よく。</p>
      <p class="home-fixed-hero__copy">Love The Baby, Love The Family.</p>
    </section>
  `;
}

function renderHomeMessageSection(state: HomeState): string {
  const imageSrc = getHomeMessageImage(state);

  return `
    <section class="home-message-section">
      ${
        imageSrc
          ? `
            <div class="home-message__image reveal-wrapper">
              <img class="reveal-img" src="${escapeAttr(imageSrc)}" alt="iLy.のおすすめ育児用品" loading="lazy">
            </div>
          `
          : ''
      }
      <div class="home-message__content">
        <div class="home-message__body">
          <p>
            使う場所、しまう場所、押す人、抱っこする人。<br>
            iLy.は、スペックだけでは見えにくい毎日の使いやすさを整理しながら、<br>
            家族に合う育児用品へ近づくためのガイドです。
          </p>
        </div>
        <a class="home-message__link" href="/products.html">商品一覧を見る</a>
      </div>
    </section>
  `;
}

function renderPickupSection(state: HomeState): string {
  const pickupItems = getPickupItems(state);
  if (pickupItems.length === 0) return '';

  return `
    <section class="home-section home-pickup-section" aria-labelledby="home-pickup-title">
      <div class="home-section__header home-section__header--centered">
        <p class="home-eyebrow">Pick up contents</p>
        <h2 class="home-section-heading section-title" id="home-pickup-title">おすすめ特集</h2>
      </div>
      <div class="home-pickup-grid">
        ${pickupItems.map(renderPickupCard).join('')}
      </div>
    </section>
  `;
}

function getPickupItems(state: HomeState): Array<{ title: string; label: string; href: string; imageSrc?: string }> {
  return Array.from(state.siteAssetsByKey.values())
    .filter(isPickupAsset)
    .sort((a, b) => getAssetSortOrder(a) - getAssetSortOrder(b) || a.asset_key.localeCompare(b.asset_key))
    .map((asset) => ({
      title: asset.title || 'おすすめ特集',
      label: asset.caption || '詳しく見る',
      href: getSafeAssetLink(asset.link_url) ?? '/products.html',
      imageSrc: getAssetImage(asset),
    }))
    .filter((item): item is { title: string; label: string; href: string; imageSrc: string } => Boolean(item.imageSrc))
    .sort((a, b) => a.title.localeCompare(b.title, 'ja'))
    .slice(0, 3);
}

function isPickupAsset(asset: HomeSiteAsset): boolean {
  if (!getAssetImage(asset)) return false;
  if (asset.asset_type === 'category' || asset.asset_key.startsWith('category_')) return false;

  return asset.asset_key.startsWith('home_pickup')
    || asset.asset_key.startsWith('pickup_')
    || asset.asset_type === 'campaign'
    || asset.asset_type === 'feature'
    || asset.asset_type === 'article';
}

function renderPickupCard(item: { title: string; label: string; href: string; imageSrc?: string }): string {
  return `
    <a class="home-pickup-card" href="${escapeAttr(item.href)}">
      <span class="home-pickup-card__image reveal-wrapper">
        ${item.imageSrc ? `<img class="reveal-img" src="${escapeAttr(item.imageSrc)}" alt="${escapeAttr(item.title)}" loading="lazy">` : '<em>画像準備中</em>'}
      </span>
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.label)}</span>
    </a>
  `;
}

function renderSearchSection(state: HomeState): string {
  const scenes = ['ワンオペ', '電車移動', '軽自動車', '飛行機', 'マンション', '新生児'];

  return `
    <section class="home-search-section" aria-labelledby="home-search-title">
      <div class="home-search-inner">
        <div class="home-search-header">
          <h2 class="home-search-title-en" id="home-search-title">Search</h2>
        </div>

        <div class="home-search-group home-search-group--category">
          ${renderSearchGroupHeading('Item category')}
          <ul class="home-search-category-list">
            ${state.categoryCards.map(renderSearchCategoryItem).join('')}
          </ul>
        </div>

        <div class="home-search-group home-search-group--scene">
          ${renderSearchGroupHeading('Scene')}
          <ul class="home-search-scene-list">
            ${scenes
              .map((scene) => `<li><a href="/products.html?scene=${encodeURIComponent(scene)}">${escapeHtml(scene)}</a></li>`)
              .join('')}
          </ul>
        </div>
      </div>
    </section>
  `;
}

function renderSearchGroupHeading(title: string): string {
  return `
    <div class="home-search-group-heading">
      <span class="line-expand" aria-hidden="true"></span>
      <h3>${escapeHtml(title)}</h3>
      <span class="line-expand" aria-hidden="true"></span>
    </div>
  `;
}

function renderSearchCategoryItem(card: CategoryCard): string {
  return `
    <li>
      <a href="${escapeAttr(card.href)}">
        ${
          card.imageSrc
            ? `<img src="${escapeAttr(card.imageSrc)}" alt="${escapeAttr(card.label)}" loading="lazy">`
            : `<span class="home-search-category-fallback">${escapeHtml(card.label)}</span>`
        }
        <span>${escapeHtml(card.label)}</span>
      </a>
    </li>
  `;
}

function renderShoppingSection(siteAssetsByKey: Map<string, HomeSiteAsset>): string {
  return `
    <section class="home-section home-shopping-section" aria-labelledby="home-shopping-title">
      <div class="home-section__header home-section__header--centered">
        <p class="home-eyebrow">SHOPPING</p>
        <h2 class="home-section-heading section-title" id="home-shopping-title">ストアで探す</h2>
      </div>
      <div class="home-shopping-grid">
        ${SHOPPING_LINKS.map((link) => renderShoppingCard(link, siteAssetsByKey)).join('')}
      </div>
    </section>
  `;
}

function renderShoppingCard(
  link: (typeof SHOPPING_LINKS)[number],
  siteAssetsByKey: Map<string, HomeSiteAsset>,
): string {
  const iconSrc = getAssetImage(siteAssetsByKey.get(link.assetKey));

  return `
    <a class="home-shopping-card" href="${escapeAttr(link.href)}" target="_blank" rel="nofollow sponsored noopener">
      <span class="home-shopping-card__icon">
        ${iconSrc ? `<img src="${escapeAttr(iconSrc)}" alt="${escapeAttr(`${link.label} アイコン`)}" loading="lazy">` : '<em>ICON</em>'}
      </span>
    </a>
  `;
}

function renderHomeMainHeroAssets(assets: HomeMainHeroAsset[]): string {
  return assets.length === 1 ? renderHomeMainHero(assets[0]) : renderHomeMainHeroCarousel(assets);
}

function renderHomeMainHero(asset: HomeMainHeroAsset): string {
  const desktopWidth = getPositiveDimension(asset.desktop_width, 1600);
  const desktopHeight = getPositiveDimension(asset.desktop_height, 600);
  const mobileWidth = getPositiveDimension(asset.mobile_width, desktopWidth);
  const mobileHeight = getPositiveDimension(asset.mobile_height, desktopHeight);
  const label = asset.alt_text || asset.title || 'メインバナー';
  const picture = `
    <picture class="home-main-banner__media">
      <source media="(max-width: 640px)" srcset="${escapeAttr(asset.mobile_image_url)}">
      <img
        src="${escapeAttr(asset.desktop_image_url)}"
        alt="${escapeAttr(asset.alt_text)}"
        width="${desktopWidth}"
        height="${desktopHeight}"
        loading="eager"
        fetchpriority="high"
        decoding="async"
      >
    </picture>
  `;
  const content = asset.link_url
    ? `<a class="home-main-banner__link" href="${escapeAttr(asset.link_url)}" aria-label="${escapeAttr(label)}">${picture}</a>`
    : picture;

  return `
    <section
      class="home-main-banner"
      aria-label="${escapeAttr(label)}"
      style="--desktop-aspect: ${desktopWidth} / ${desktopHeight}; --mobile-aspect: ${mobileWidth} / ${mobileHeight};"
    >
      ${content}
    </section>
  `;
}

function renderHomeMainHeroCarousel(assets: HomeMainHeroAsset[]): string {
  const firstAsset = assets[0];
  const desktopWidth = getPositiveDimension(firstAsset.desktop_width, 1600);
  const desktopHeight = getPositiveDimension(firstAsset.desktop_height, 600);
  const mobileWidth = getPositiveDimension(firstAsset.mobile_width, desktopWidth);
  const mobileHeight = getPositiveDimension(firstAsset.mobile_height, desktopHeight);

  return `
    <section
      class="home-main-carousel has-multiple-slides"
      aria-label="メインバナー"
      aria-roledescription="カルーセル"
      data-home-hero-carousel
      style="--desktop-aspect: ${desktopWidth} / ${desktopHeight}; --mobile-aspect: ${mobileWidth} / ${mobileHeight};"
    >
      <div class="home-main-carousel__track" aria-live="off">
        ${assets.map((asset, index) => renderHomeMainHeroSlide(asset, index, assets.length)).join('')}
      </div>
      <button class="home-main-carousel__arrow is-previous" type="button" data-home-hero-action="previous" aria-label="前のバナー">&#8592;</button>
      <button class="home-main-carousel__arrow is-next" type="button" data-home-hero-action="next" aria-label="次のバナー">&#8594;</button>
      <div class="home-main-carousel__dots" role="tablist" aria-label="バナーを選択">
        ${assets
          .map(
            (_, index) => `
              <button
                type="button"
                role="tab"
                data-home-hero-dot="${index}"
                aria-label="${index + 1}枚目を表示"
                aria-selected="${index === 0 ? 'true' : 'false'}"
                tabindex="${index === 0 ? '0' : '-1'}"
              ></button>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
}

function renderHomeMainHeroSlide(asset: HomeMainHeroAsset, index: number, totalSlides: number): string {
  const desktopWidth = getPositiveDimension(asset.desktop_width, 1600);
  const desktopHeight = getPositiveDimension(asset.desktop_height, 600);
  const label = asset.alt_text || asset.title || `メインバナー ${index + 1}`;
  const picture = `
    <picture class="home-main-carousel__media">
      <source media="(max-width: 640px)" srcset="${escapeAttr(asset.mobile_image_url)}">
      <img
        src="${escapeAttr(asset.desktop_image_url)}"
        alt="${escapeAttr(asset.alt_text)}"
        width="${desktopWidth}"
        height="${desktopHeight}"
        ${index === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'}
        decoding="async"
      >
    </picture>
  `;
  const content = asset.link_url
    ? `<a class="home-main-carousel__link" href="${escapeAttr(asset.link_url)}" aria-label="${escapeAttr(label)}" ${index === 0 ? '' : 'tabindex="-1"'}>${picture}</a>`
    : picture;

  return `
    <article
      class="home-main-carousel__slide ${index === 0 ? 'is-active' : ''}"
      data-home-hero-slide="${index}"
      aria-hidden="${index === 0 ? 'false' : 'true'}"
      aria-label="${index + 1} / ${totalSlides}"
    >
      ${content}
    </article>
  `;
}

function bindHomeHeroCarousel(): void {
  stopHomeHeroAutoplay();
  const carousel = app.querySelector<HTMLElement>('[data-home-hero-carousel]');
  if (!carousel) {
    currentHomeHeroIndex = 0;
    return;
  }

  const slides = Array.from(carousel.querySelectorAll<HTMLElement>('[data-home-hero-slide]'));
  const dots = Array.from(carousel.querySelectorAll<HTMLButtonElement>('[data-home-hero-dot]'));
  if (slides.length < 2) return;

  const showSlide = (index: number): void => {
    currentHomeHeroIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === currentHomeHeroIndex;
      slide.classList.toggle('is-active', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
      slide.querySelectorAll<HTMLAnchorElement>('a').forEach((link) => {
        link.tabIndex = isActive ? 0 : -1;
      });
    });
    dots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === currentHomeHeroIndex;
      dot.setAttribute('aria-selected', String(isActive));
      dot.tabIndex = isActive ? 0 : -1;
    });
  };

  const startAutoplay = (): void => {
    stopHomeHeroAutoplay();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    homeHeroTimer = window.setInterval(() => showSlide(currentHomeHeroIndex + 1), 2800);
  };

  const moveTo = (index: number): void => {
    showSlide(index);
    startAutoplay();
  };

  carousel.querySelector<HTMLButtonElement>('[data-home-hero-action="previous"]')?.addEventListener('click', () => {
    moveTo(currentHomeHeroIndex - 1);
  });
  carousel.querySelector<HTMLButtonElement>('[data-home-hero-action="next"]')?.addEventListener('click', () => {
    moveTo(currentHomeHeroIndex + 1);
  });
  dots.forEach((dot, index) => dot.addEventListener('click', () => moveTo(index)));

  carousel.addEventListener('mouseenter', stopHomeHeroAutoplay);
  carousel.addEventListener('mouseleave', startAutoplay);
  carousel.addEventListener('focusin', stopHomeHeroAutoplay);
  carousel.addEventListener('focusout', (event) => {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !carousel.contains(nextTarget)) startAutoplay();
  });

  let pointerStartX: number | null = null;
  carousel.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch') pointerStartX = event.clientX;
  });
  carousel.addEventListener('pointerup', (event) => {
    if (pointerStartX === null || event.pointerType !== 'touch') return;
    const distance = event.clientX - pointerStartX;
    pointerStartX = null;
    if (Math.abs(distance) >= 40) moveTo(currentHomeHeroIndex + (distance < 0 ? 1 : -1));
  });
  carousel.addEventListener('pointercancel', () => {
    pointerStartX = null;
  });

  showSlide(Math.min(currentHomeHeroIndex, slides.length - 1));
  startAutoplay();
}

function stopHomeHeroAutoplay(): void {
  if (homeHeroTimer === null) return;
  window.clearInterval(homeHeroTimer);
  homeHeroTimer = null;
}

function bindHomeEvents(): void {
  if (homeEventsBound) {
    return;
  }

  homeEventsBound = true;

  app.addEventListener('click', (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>('[data-home-category]');
    const category = button?.dataset.homeCategory;

    if (!category) {
      return;
    }

    renderShell({
      ...currentHomeState,
      activeCategory: category,
    });
  });
}

function getImageLoadingAttributes(index: number): string {
  if (index === 0) {
    return 'loading="eager" fetchpriority="high"';
  }

  return 'loading="lazy"';
}

function renderCategoryProducts(state: HomeState): string {
  const products = state.productsByCategory.get(state.activeCategory) ?? [];

  if (!state.hasLoaded) {
    return '<p class="home-empty-message">商品データを読み込んでいます。</p>';
  }

  if (state.loadError) {
    return `
      <section class="home-empty-panel" role="alert">
        <h3>商品データを表示できません</h3>
        <p>${escapeHtml(state.loadError)}</p>
      </section>
    `;
  }

  if (products.length === 0) {
    return `
      <section class="home-empty-panel">
        <h3>${escapeHtml(state.activeCategory)}は準備中です</h3>
        <p>このカテゴリの商品は、登録され次第こちらに表示されます。</p>
      </section>
    `;
  }

  return `
    <div class="home-product-grid">${products.slice(0, 5).map(renderProductCard).join('')}</div>
    <div class="home-recommended-actions">
      <a class="home-outline-link" href="/products.html">すべて見る</a>
    </div>
  `;
}

function renderProductCard(product: HomeProduct, index: number): string {
  const productId = encodeURIComponent(String(product.id));
  const fallbackName = getText(product.name, '商品名未登録');
  const name = normalizeProductDisplayName(product, fallbackName) || fallbackName;
  const fallbackBrand = getText(product.brand, 'ブランド未登録');
  const brand = normalizeProductDisplayBrand(product, fallbackBrand) || fallbackBrand;
  const brandRecord = product.brand_id ? homeBrandsById.get(String(product.brand_id)) : undefined;
  const displayBrand = brandRecord?.display_name ?? brand;

  return `
    <article class="home-product-card">
      <div class="home-product-card__media reveal-wrapper">
        <a class="home-product-card__image" href="/product.html?id=${productId}" aria-label="${escapeAttr(name)}の詳細を見る">
          ${
            product.imageSrc
              ? `
                <img class="home-product-card__img home-product-card__img--primary reveal-img" src="${escapeAttr(product.imageSrc)}" alt="${escapeAttr(name)}" ${getImageLoadingAttributes(index)}>
                ${
                  product.hoverImageSrc
                    ? `<img class="home-product-card__img home-product-card__img--secondary reveal-img" src="${escapeAttr(product.hoverImageSrc)}" alt="" loading="lazy" aria-hidden="true">`
                    : ''
                }
              `
              : '<span class="home-product-card__placeholder">画像準備中</span>'
          }
        </a>
      </div>
      <p class="home-product-card__title-line">
        <span class="home-product-card__brand">${brandRecord ? `<a href="/brand.html?slug=${encodeURIComponent(brandRecord.slug)}">${escapeHtml(displayBrand)}</a>` : escapeHtml(displayBrand)}</span>
        <strong class="home-product-card__name"><a href="/product.html?id=${productId}">${escapeHtml(name)}</a></strong>
      </p>
      <span class="home-product-card__price">${escapeHtml(formatPrice(product.price_yen))}（税込み）</span>
    </article>
  `;
}

function renderHomeFooter(): string {
  return `
    <footer class="home-footer">
      <div class="home-footer__inner">
        <div class="home-footer__top">
          <div class="home-footer__brand">
            <a class="home-footer__logo" href="/">iLy.</a>
            <p class="home-footer__tagline">育児用品選びを、暮らしに合わせてやさしく。</p>
          </div>
          <nav class="home-footer__nav" aria-label="フッターナビゲーション">
            <a href="/products.html">商品一覧</a>
            <a href="/compare.html">比較する</a>
            <a href="/stroller-guide.html">ベビーカー診断</a>
            <a href="/brand.html">ブランド</a>
          </nav>
        </div>
        <div class="home-footer__bottom">
          <div class="home-affiliate-notice">
            <p>当サイトはアフィリエイト広告を利用しています。</p>
            <p>掲載している商品・サービスの価格、在庫、仕様等は変更される場合があります。最新情報は各販売サイト・公式サイトにてご確認ください。</p>
          </div>
          <small>&copy; iLy.</small>
        </div>
      </div>
    </footer>
  `;
}

function renderCategoryLink(card: CategoryCard): string {
  return `
    <a class="home-category-card" href="${escapeAttr(card.href)}">
      <span class="home-category-card__image home-category-media">
        ${
          card.imageSrc
            ? `<img src="${escapeAttr(card.imageSrc)}" alt="${escapeAttr(card.label)}" loading="lazy">`
            : '<em class="home-category-placeholder">画像準備中</em>'
        }
      </span>
      <strong class="home-category-card__title">${escapeHtml(card.label)}</strong>
    </a>
  `;
}

function renderBrandCards(brands: BrandCard[], siteAssetsByKey: Map<string, HomeSiteAsset>): string {
  if (brands.length === 0) {
    return '<p class="home-empty-message">ブランド情報は商品登録後に表示されます。</p>';
  }

  const logoBrands = brands
    .map((brand) => ({ ...brand, logoSrc: getBrandLogoSrc(brand, siteAssetsByKey) }))
    .filter((brand): brand is BrandCard & { logoSrc: string } => Boolean(brand.logoSrc));

  if (logoBrands.length === 0) {
    return '<p class="home-empty-message">ブランドロゴは準備中です。</p>';
  }

  return `
    <div class="home-brand-grid">
      ${logoBrands
        .map(
          (brand) => `
            <a class="home-brand-card has-logo" href="${brand.slug ? `/brand.html?slug=${encodeURIComponent(brand.slug)}` : `/products.html?brand=${encodeURIComponent(brand.brand)}`}">
              <img src="${escapeAttr(brand.logoSrc)}" alt="${escapeAttr(`${brand.brand} ロゴ`)}" loading="lazy">
            </a>
          `,
        )
        .join('')}
    </div>
  `;
}

function groupProductsByCategory(products: Product[]): Map<string, Product[]> {
  const groupedProducts = new Map<string, Product[]>();

  categories.forEach((category) => {
    const categoryProducts = products
      .filter((product) => matchesCategory(product, category))
      .sort(sortProductsForHome)
      .slice(0, 6);

    groupedProducts.set(category.label, categoryProducts);
  });

  return groupedProducts;
}

function getCategoryCards(
  productsByCategory: Map<string, HomeProduct[]>,
  siteAssetsByKey: Map<string, HomeSiteAsset> = new Map(),
): CategoryCard[] {
  return categories.map((category) => {
    const categoryProducts = productsByCategory.get(category.label) ?? [];
    const rankOneProduct = categoryProducts.find((product) => Number(product.rank_no) === 1) ?? categoryProducts[0];
    const assetImage = getAssetImageByCandidates(siteAssetsByKey, categoryAssetCandidates[category.label] ?? []);

    return {
      label: category.label,
      href: getCategoryHref(category.label),
      imageSrc: assetImage ?? rankOneProduct?.categoryImageSrc ?? rankOneProduct?.imageSrc,
    };
  });
}

function getProductImageOrder(image: ProductImage): number {
  return Number(image.sort_order ?? image.display_order ?? 9999);
}

function getDefaultCategoryCards(): CategoryCard[] {
  return categories.map((category) => ({
    label: category.label,
    href: getCategoryHref(category.label),
  }));
}

function getCategoryHref(category: string): string {
  if (category === 'ベビーカー') return '/products.html';
  if (category === '抱っこ紐') return '/products.html?category=carrier';
  if (category === 'チャイルドシート') return '/products.html?category=car-seat';
  if (category === 'ヒップシート') return '/products.html?category=hipseat';
  return `/products.html?category=${encodeURIComponent(category)}`;
}

function getPopularBrands(products: Product[]): BrandCard[] {
  const counts = new Map<string, BrandCard>();

  products.forEach((product) => {
    const rawBrand = getText(product.brand, '');
    const brand = normalizeProductDisplayBrand(product, rawBrand);
    if (!brand) {
      return;
    }

    const brandRecord = product.brand_id ? homeBrandsById.get(String(product.brand_id)) : undefined;
    const key = brandRecord?.id ?? brand;
    const current = counts.get(key);
    counts.set(key, {
      brand: brandRecord?.display_name ?? brand,
      slug: brandRecord?.slug,
      logoAssetKey: brandRecord?.logo_asset_key,
      count: (current?.count ?? 0) + 1,
    });
  });

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand, 'ja'))
    .slice(0, 8);
}

function getCategoryImage(state: HomeState, category: string): string | undefined {
  return state.categoryCards.find((card) => card.label === category)?.imageSrc
    ?? state.productsByCategory.get(category)?.find((product) => product.imageSrc)?.imageSrc;
}

function getHomeFixedHeroMedia(
  state: HomeState,
): { desktopSrc: string; mobileSrc: string; alt: string; copy: { title: string; lines: string[] } } | undefined {
  const mainHero = selectHomeHeroAsset(state.mainHeroes);
  if (mainHero) {
    return {
      desktopSrc: mainHero.desktop_image_url,
      mobileSrc: mainHero.mobile_image_url,
      alt: mainHero.alt_text || mainHero.title || 'iLy. メインビジュアル',
      copy: getHomeHeroCopy(mainHero),
    };
  }

  const fallbackHeroAssets = Array.from(state.siteAssetsByKey.values())
    .filter(isHomeMainHeroAsset)
    .sort((a, b) => getAssetSortOrder(a) - getAssetSortOrder(b) || a.asset_key.localeCompare(b.asset_key))
    .filter((asset) => getAssetImage(asset));
  const heroAsset = selectHomeHeroAsset(fallbackHeroAssets);
  const desktopSrc = getAssetImage(heroAsset);
  if (!desktopSrc) return undefined;

  return {
    desktopSrc,
    mobileSrc: isSafeImageUrl(heroAsset?.mobile_image_url) ? heroAsset.mobile_image_url : desktopSrc,
    alt: heroAsset?.alt_text || heroAsset?.title || 'iLy. メインビジュアル',
    copy: getHomeHeroCopy(heroAsset),
  };
}

function getHomeHeroCopy(asset: HomeSiteAsset | undefined): { title: string; lines: string[] } {
  const captionLines = String(asset?.caption ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (captionLines.length >= 2) {
    return {
      title: captionLines[0],
      lines: captionLines.slice(1),
    };
  }

  return selectDefaultHomeHeroCopy();
}

function selectDefaultHomeHeroCopy(): { title: string; lines: string[] } {
  const lastCopyKey = readStorageValue(homeHeroLastCopyStorageKey);
  const copyCandidates = defaultHomeHeroCopies
    .map((copy, index) => ({ copy, key: String(index) }))
    .filter((item) => defaultHomeHeroCopies.length < 2 || item.key !== lastCopyKey);
  const selected = copyCandidates[Math.floor(Math.random() * copyCandidates.length)] ?? copyCandidates[0];
  if (selected) {
    saveStorageValue(homeHeroLastCopyStorageKey, selected.key);
    return {
      title: selected.copy.title,
      lines: [...selected.copy.lines],
    };
  }

  return {
    title: defaultHomeHeroCopy.title,
    lines: [...defaultHomeHeroCopy.lines],
  };
}

function selectHomeHeroAsset<T extends { asset_key: string }>(assets: T[]): T | undefined {
  if (assets.length === 0) return undefined;

  const currentAsset = selectedHomeHeroAssetKey
    ? assets.find((asset) => asset.asset_key === selectedHomeHeroAssetKey)
    : undefined;
  if (currentAsset) return currentAsset;

  const previousAssetKey = readLastHomeHeroAssetKey();
  const selectableAssets = assets.length > 1
    ? assets.filter((asset) => asset.asset_key !== previousAssetKey)
    : assets;
  const selectedAsset = selectableAssets[Math.floor(Math.random() * selectableAssets.length)]
    ?? selectableAssets[0]
    ?? assets[0];
  selectedHomeHeroAssetKey = selectedAsset.asset_key;
  saveLastHomeHeroAssetKey(selectedAsset.asset_key);
  return selectedAsset;
}

function readLastHomeHeroAssetKey(): string {
  return readStorageValue(homeHeroLastAssetKeyStorageKey);
}

function saveLastHomeHeroAssetKey(assetKey: string): void {
  saveStorageValue(homeHeroLastAssetKeyStorageKey, assetKey);
}

function readStorageValue(key: string): string {
  try {
    return window.sessionStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function saveStorageValue(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private contexts; random selection still works.
  }
}

function getHomeMessageImage(state: HomeState): string | undefined {
  return getAssetImageByCandidates(state.siteAssetsByKey, [
    'home_message',
    'message',
    'home_about',
    'about',
    'home_pickup',
    'pickup',
  ])
    ?? state.categoryCards.find((card) => card.imageSrc)?.imageSrc
    ?? Array.from(state.productsByCategory.values()).flat().find((product) => product.imageSrc)?.imageSrc;
}

function getBrandLogoSrc(brand: BrandCard, siteAssetsByKey: Map<string, HomeSiteAsset>): string | undefined {
  const candidates = [
    brand.logoAssetKey ?? '',
    ...(brand.slug
      ? [`brand_logo_${brand.slug}`, `brand_${brand.slug}_logo`, `${brand.slug}_logo`, `brand-${brand.slug}-logo`, `${brand.slug}-logo`, brand.slug]
      : []),
  ].filter(Boolean);

  return getAssetImageByCandidates(siteAssetsByKey, candidates);
}

function getAssetImageByCandidates(
  siteAssetsByKey: Map<string, HomeSiteAsset>,
  candidates: string[],
): string | undefined {
  for (const candidate of candidates) {
    const image = getAssetImage(siteAssetsByKey.get(candidate));
    if (image) return image;
  }

  const normalizedCandidates = candidates.map((candidate) => candidate.toLowerCase());
  for (const asset of siteAssetsByKey.values()) {
    if (!normalizedCandidates.some((candidate) => asset.asset_key.toLowerCase().includes(candidate))) continue;
    const image = getAssetImage(asset);
    if (image) return image;
  }

  return undefined;
}

function getAssetImage(asset: HomeSiteAsset | undefined): string | undefined {
  const desktop = asset?.desktop_image_url?.trim();
  if (isSafeImageUrl(desktop)) return desktop;

  const mobile = asset?.mobile_image_url?.trim();
  return isSafeImageUrl(mobile) ? mobile : undefined;
}

function updateHomeHeaderLogo(siteAssetsByKey: Map<string, HomeSiteAsset>): void {
  const brand = document.querySelector<HTMLAnchorElement>('#site-header .site-header__brand');
  if (!brand) return;

  const logoSrc = getAssetImageByCandidates(siteAssetsByKey, homeLogoAssetCandidates);
  if (!logoSrc) {
    brand.textContent = 'iLy.';
    return;
  }

  brand.innerHTML = `<img src="${escapeAttr(logoSrc)}" alt="iLy.">`;
}

function groupColors(colors: ProductColor[]): Map<string, ProductColor[]> {
  const grouped = new Map<string, ProductColor[]>();
  colors.forEach((color) => {
    const key = String(color.product_id);
    grouped.set(key, [...(grouped.get(key) ?? []), color]);
  });
  return grouped;
}

function sortProductsForHome(a: Product, b: Product): number {
  const rankA = toNumber(a.rank_no);
  const rankB = toNumber(b.rank_no);

  if (rankA !== rankB) {
    return rankA - rankB;
  }

  return String(a.id).localeCompare(String(b.id), 'ja', { numeric: true });
}

function matchesCategory(product: Product, category: Category): boolean {
  const categoryText = String(product.category ?? '').trim();
  return category.patterns.some((pattern) => pattern.test(categoryText));
}

function extractImageSrc(html: unknown): string {
  if (typeof html !== 'string' || !html.trim()) {
    return '';
  }

  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.querySelector('img')?.getAttribute('src')?.trim() ?? '';
}

function getProductImageSrc(image: ProductImage | undefined): string {
  const directUrl = image?.image_url?.trim();
  if (isSafeImageUrl(directUrl)) {
    return directUrl;
  }

  return extractImageSrc(image?.rakuten_image_html);
}

function getTags(product: Product): string[] {
  const rawTags = product.feature_tags;

  if (Array.isArray(rawTags)) {
    return rawTags.map(String).map((tag) => tag.trim()).filter(Boolean);
  }

  if (typeof rawTags === 'string') {
    return rawTags
      .split(/[,、\n]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  const fallbackTags = [product.product_type, product.target_age, product.weight_kg ? `${product.weight_kg}kg` : ''];
  return fallbackTags.map(String).map((tag) => tag.trim()).filter(Boolean);
}

function getRankLabel(product: Product, index: number): string {
  const rank = toNumber(product.rank_no);
  const displayRank = Number.isFinite(rank) && rank < Number.MAX_SAFE_INTEGER ? rank : index + 1;

  return displayRank <= 3 ? `${displayRank}位` : '';
}

function formatPrice(value: Product['price_yen']): string {
  if (value === null || value === undefined || value === '') {
    return '価格未登録';
  }

  const numericValue = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(numericValue) ? `¥${Math.round(numericValue).toLocaleString('ja-JP')}` : '価格未登録';
}

function getText(value: unknown, fallback: string): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();
  return text ? text : fallback;
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return Number.MAX_SAFE_INTEGER;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : Number.MAX_SAFE_INTEGER;
}

function isSafeImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getSafeAssetLink(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const link = value.trim();
  if (!link) {
    return null;
  }

  if (link.startsWith('/') && !link.startsWith('//')) {
    return link;
  }

  try {
    const url = new URL(link);
    return url.protocol === 'http:' || url.protocol === 'https:' ? link : null;
  } catch {
    return null;
  }
}

function getPositiveDimension(value: unknown, fallback: number): number {
  const dimension = Number(value);
  return Number.isFinite(dimension) && dimension > 0 ? Math.round(dimension) : fallback;
}

function getHeroSortOrder(asset: HomeMainHeroAsset): number {
  return getAssetSortOrder(asset);
}

function getAssetSortOrder(asset: HomeSiteAsset): number {
  const order = Number(asset.sort_order ?? asset.display_order);
  return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value);
}
