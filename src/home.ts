import './home.css';
import { mountBackToTop } from './back-to-top';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import { renderQuickViewButton, setupProductQuickView } from './product-quick-view';
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
};

type HomeMainHeroAsset = {
  asset_key: string;
  title: string;
  alt_text: string;
  desktop_image_url: string;
  desktop_width: number;
  desktop_height: number;
  mobile_image_url: string;
  mobile_width: number;
  mobile_height: number;
  link_url: string | null;
  display_order: number;
  sort_order?: number;
};

type HomeState = {
  activeCategory: string;
  productsByCategory: Map<string, HomeProduct[]>;
  categoryCards: CategoryCard[];
  brands: BrandCard[];
  mainHeroes: HomeMainHeroAsset[];
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

mountBackToTop();

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
  hasLoaded: false,
  loadError: null,
};

let currentHomeState = initialState;
let homeEventsBound = false;
let homeHeroTimer: number | null = null;
let currentHomeHeroIndex = 0;
let homeColorsByProductId = new Map<string, ProductColor[]>();
let homeBrandsById = new Map<string, Brand>();

void initializeHome();

async function initializeHome(): Promise<void> {
  renderShell(initialState);

  const [state, mainHeroes] = await Promise.all([loadHomeState(), loadHomeMainHeroes()]);
  renderShell({ ...state, mainHeroes });
}

async function loadHomeMainHeroes(): Promise<HomeMainHeroAsset[]> {
  if (!isSupabaseConfigured) {
    if (import.meta.env.DEV) {
      console.warn('メインバナーを取得できません: Supabaseが設定されていません。');
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

    const publicAssets = Array.isArray(data) ? (data as HomeMainHeroAsset[]) : [];
    const heroAssets = publicAssets
      .filter((asset) => asset.asset_key.startsWith('home_main_hero'))
      .filter((asset) => isSafeImageUrl(asset.desktop_image_url))
      .map((asset) => ({
        ...asset,
        mobile_image_url: isSafeImageUrl(asset.mobile_image_url)
          ? asset.mobile_image_url
          : asset.desktop_image_url,
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
  } catch (error) {
    console.error('メインバナー素材の取得に失敗しました。', error);
    return [];
  }
}

async function loadHomeState(): Promise<HomeState> {
  const emptyState: HomeState = {
    ...initialState,
    productsByCategory: new Map(categories.map((category) => [category.label, []])),
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
      <header class="home-header">
        <a class="home-brand" href="/">iLy.</a>
        <button class="home-menu-button" type="button" aria-label="メニューを開く" aria-expanded="false">
          メニュー
        </button>
        <nav class="home-nav" aria-label="メインメニュー">
          <a href="/products.html">商品を探す</a>
          <a href="/products.html#ranking">ランキング</a>
          <a href="/compare.html">比較</a>
          <a href="/stroller-guide.html">選び方</a>
          <span aria-disabled="true">診断</span>
        </nav>
      </header>

      ${state.mainHeroes.length > 0 ? renderHomeMainHeroAssets(state.mainHeroes) : '<div class="home-hero-placeholder" aria-hidden="true"></div>'}

      <section class="home-category-links home-category-section" aria-label="カテゴリから探す">
        <div class="home-section__header home-section__header--compact">
          <p class="home-eyebrow">CATEGORY</p>
          <h2 class="home-section-heading section-title">カテゴリから探す</h2>
        </div>
        <div class="home-category-grid">
          ${state.categoryCards.map(renderCategoryLink).join('')}
        </div>
      </section>

      <section class="home-scene-links home-scene-section" aria-label="シーンから探す">
        <p class="home-eyebrow">SCENE</p>
        <h2 class="home-section-heading section-title">暮らしのシーンから探す</h2>
        <div class="home-scene-list">
          ${['ワンオペ', '電車移動', '軽自動車', '飛行機', 'マンション', '新生児']
            .map((scene) => `<a href="/products.html?scene=${encodeURIComponent(scene)}">${scene}</a>`)
            .join('')}
        </div>
      </section>

      <section class="home-section home-pickup-section" aria-labelledby="category-products-title">
        <div class="home-section__header">
          <div>
            <p class="home-eyebrow">PICK UP</p>
            <h2 class="home-section-heading section-title" id="category-products-title">カテゴリ別おすすめ</h2>
          </div>
          <a href="/products.html">すべて見る</a>
        </div>
        <div class="home-tabs" role="tablist" aria-label="カテゴリ別おすすめ">
          ${categories
            .map(
              (category) => `
                <button
                  type="button"
                  class="${category.label === state.activeCategory ? 'is-active' : ''}"
                  data-home-category="${escapeAttr(category.label)}"
                  role="tab"
                  aria-selected="${category.label === state.activeCategory}"
                >
                  ${escapeHtml(category.label)}
                </button>
              `,
            )
            .join('')}
        </div>
        ${renderCategoryProducts(state)}
      </section>

      <section class="home-section home-brand-section" aria-labelledby="popular-brands-title">
        <div class="home-section__header">
          <div>
            <p class="home-eyebrow">BRAND</p>
            <h2 id="popular-brands-title">人気ブランドから探す</h2>
          </div>
        </div>
        ${renderBrandCards(state.brands)}
      </section>

      <section class="home-guide-strip">
        <div>
          <p class="home-eyebrow">NEXT STEP</p>
          <h2>迷ったら、条件を変えて見比べる。</h2>
          <p>診断・比較・ガイド・ランキングから、いまの迷いに合う探し方を選べます。</p>
        </div>
        <div class="home-action-grid">
          <span class="home-action-card is-disabled" aria-disabled="true">かんたん診断<span>準備中</span></span>
          <a class="home-action-card" href="/compare.html">比較表<span>選んだ商品を比較</span></a>
          <a class="home-action-card" href="/stroller-guide.html">選び方ガイド<span>基本を読む</span></a>
          <a class="home-action-card" href="/products.html#ranking">ランキング<span>商品一覧へ</span></a>
        </div>
      </section>

      <footer class="home-footer">
        <a class="home-brand" href="/">iLy.</a>
        <p>育児用品選びを、暮らしに合わせてやさしく。</p>
      </footer>
    </main>
  `;

  bindHomeEvents();
  bindHomeHeroCarousel();
  const visibleProducts = Array.from(state.productsByCategory.values()).flat();
  setupProductQuickView({
    products: visibleProducts as SharedProduct[],
    imageByProductId: new Map(visibleProducts.map((product) => [String(product.id), product.imageSrc ?? '']).filter((entry): entry is [string, string] => Boolean(entry[1]))),
    colorsByProductId: homeColorsByProductId,
    brandsById: homeBrandsById,
  });
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

  return `<div class="home-product-grid">${products.slice(0, 4).map(renderProductCard).join('')}</div>`;
}

function renderProductCard(product: HomeProduct, index: number): string {
  const productId = encodeURIComponent(String(product.id));
  const name = getText(product.name, '商品名未登録');
  const brand = getText(product.brand, 'ブランド未登録');
  const tags = getTags(product).slice(0, 3);
  const rank = getRankLabel(product, index);
  const brandRecord = product.brand_id ? homeBrandsById.get(String(product.brand_id)) : undefined;
  const colors = homeColorsByProductId.get(String(product.id)) ?? [];

  return `
    <article class="home-product-card">
      <div class="home-product-card__media">
        <a class="home-product-card__image" href="/product.html?id=${productId}" aria-label="${escapeAttr(name)}の詳細を見る">
          ${rank ? `<span class="home-product-card__rank">${escapeHtml(rank)}</span>` : ''}
          ${
            product.imageSrc
              ? `
                <img class="home-product-card__img home-product-card__img--primary" src="${escapeAttr(product.imageSrc)}" alt="${escapeAttr(name)}" ${getImageLoadingAttributes(index)}>
                ${
                  product.hoverImageSrc
                    ? `<img class="home-product-card__img home-product-card__img--secondary" src="${escapeAttr(product.hoverImageSrc)}" alt="" loading="lazy" aria-hidden="true">`
                    : ''
                }
              `
              : '<span class="home-product-card__placeholder">画像準備中</span>'
          }
        </a>
        ${renderQuickViewButton(product.id)}
      </div>
      <span class="home-product-card__brand">${brandRecord ? `<a href="/brand.html?slug=${encodeURIComponent(brandRecord.slug)}">${escapeHtml(brandRecord.display_name)}</a>` : escapeHtml(brand)}</span>
      <strong class="home-product-card__name"><a href="/product.html?id=${productId}">${escapeHtml(name)}</a></strong>
      <span class="home-product-card__price">${escapeHtml(formatPrice(product.price_yen))}<small>税込</small></span>
      ${tags.length > 0 ? `<span class="home-tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</span>` : ''}
      ${colors.length > 0 ? `<span class="home-color-swatches color-swatches" aria-label="カラー">${colors.slice(0, 6).map((color) => `<span style="--swatch:${escapeAttr(color.swatch_hex)}" title="${escapeAttr(color.name)}"></span>`).join('')}</span>` : ''}
    </article>
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
      <small class="category-link">商品を見る</small>
    </a>
  `;
}

function renderBrandCards(brands: BrandCard[]): string {
  if (brands.length === 0) {
    return '<p class="home-empty-message">ブランド情報は商品登録後に表示されます。</p>';
  }

  return `
    <div class="home-brand-grid">
      ${brands
        .map(
          (brand) => `
            <a class="home-brand-card" href="${brand.slug ? `/brand.html?slug=${encodeURIComponent(brand.slug)}` : `/products.html?brand=${encodeURIComponent(brand.brand)}`}">
              <strong>${escapeHtml(brand.brand)}</strong>
              <span>${brand.count}件の商品</span>
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

function getCategoryCards(productsByCategory: Map<string, HomeProduct[]>): CategoryCard[] {
  return categories.map((category) => {
    const categoryProducts = productsByCategory.get(category.label) ?? [];
    const rankOneProduct = categoryProducts.find((product) => Number(product.rank_no) === 1) ?? categoryProducts[0];

    return {
      label: category.label,
      href: category.label === 'ベビーカー' ? '/products.html' : `/products.html?category=${encodeURIComponent(category.label)}`,
      imageSrc: rankOneProduct?.categoryImageSrc ?? rankOneProduct?.imageSrc,
    };
  });
}

function getProductImageOrder(image: ProductImage): number {
  return Number(image.sort_order ?? image.display_order ?? 9999);
}

function getDefaultCategoryCards(): CategoryCard[] {
  return categories.map((category) => ({
    label: category.label,
    href: category.label === 'ベビーカー' ? '/products.html' : `/products.html?category=${encodeURIComponent(category.label)}`,
  }));
}

function getPopularBrands(products: Product[]): BrandCard[] {
  const counts = new Map<string, BrandCard>();

  products.forEach((product) => {
    const brand = getText(product.brand, '');
    if (!brand) {
      return;
    }

    const brandRecord = product.brand_id ? homeBrandsById.get(String(product.brand_id)) : undefined;
    const key = brandRecord?.id ?? brand;
    const current = counts.get(key);
    counts.set(key, {
      brand: brandRecord?.display_name ?? brand,
      slug: brandRecord?.slug,
      count: (current?.count ?? 0) + 1,
    });
  });

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand, 'ja'))
    .slice(0, 8);
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
