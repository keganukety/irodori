import { supabase } from './supabaseClient';
import { setupCompareTrayNavigation, syncCompareUI, loadCompareProductIds } from './shared-ui';
import { renderQuickViewButton, setupProductQuickView } from './product-quick-view';
import type { Brand, Product as SharedProduct, ProductColor } from './types';

type Product = {
  id: string | number;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  price_yen?: string | number | null;
  feature_tags?: string[] | string | null;
  product_type?: string | null;
  target_age?: string | null;
  memo?: string | null;
  brand_id?: string | null;
  [key: string]: unknown;
};

type ProductImage = {
  product_id: string | number;
  rakuten_image_html?: string | null;
  is_primary?: boolean | null;
  display_order?: number | null;
};

type ProductImagePair = {
  primary: string;
  secondary: string;
};

const params = new URLSearchParams(window.location.search);
const selectedCategory = params.get('category')?.trim() ?? '';
const selectedScene = params.get('scene')?.trim() ?? '';
const selectedBrand = params.get('brand')?.trim() ?? '';
const isCanonicalStrollerPage = selectedCategory === 'ベビーカー' && !selectedScene && !selectedBrand;

if (isCanonicalStrollerPage) {
  window.history.replaceState({}, '', '/products.html');
} else if ((selectedCategory && (selectedScene || selectedBrand)) || selectedScene || selectedBrand) {
  injectUrlFilterStyles();
  void initializeUrlFilteredProducts();
}

async function initializeUrlFilteredProducts(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');

  if (!app) {
    return;
  }

  app.innerHTML = renderLoading();

  try {
    const { data, error } = await supabase.from('products').select('*');

    if (error) {
      throw error;
    }

    const products = Array.isArray(data) ? (data as Product[]) : [];
    const filteredProducts = products.filter((product) => {
      const categoryMatched = selectedCategory ? matchesCategory(product, selectedCategory) : true;
      const sceneMatched = selectedScene ? matchesScene(product, selectedScene) : true;
      const brandMatched = selectedBrand ? normalize(product.brand) === normalize(selectedBrand) : true;

      return categoryMatched && sceneMatched && brandMatched;
    });

    const [imageMap, colorResult, brandResult] = await Promise.all([
      loadImages(filteredProducts),
      supabase.from('product_colors').select('*').in('product_id', filteredProducts.map((product) => product.id)).order('display_order', { ascending: true }),
      supabase.from('brands').select('*').eq('is_published', true),
    ]);
    const colors = groupColors((colorResult.data ?? []) as ProductColor[]);
    const brands = new Map(((brandResult.data ?? []) as Brand[]).map((brand) => [brand.id, brand]));
    const pageHtml = renderPage(filteredProducts, imageMap, colors, brands);
    app.innerHTML = pageHtml;
    keepUrlFilteredPageVisible(app, pageHtml);
    setupCompareTrayNavigation();
    syncCompareUI(loadCompareProductIds());
    window.setTimeout(() => syncCompareUI(loadCompareProductIds()), 100);
    setupProductQuickView({ products: filteredProducts as SharedProduct[], imageByProductId: toPrimaryImageMap(imageMap), colorsByProductId: colors, brandsById: brands });
  } catch (error) {
    console.error('URL条件の商品一覧取得に失敗しました。', error);
    app.innerHTML = renderError();
  }
}

function keepUrlFilteredPageVisible(app: HTMLElement, pageHtml: string): void {
  if (!('MutationObserver' in window)) {
    return;
  }

  const observer = new MutationObserver(() => {
    if (app.querySelector('.url-filter-products')) {
      return;
    }

    app.innerHTML = pageHtml;
    setupCompareTrayNavigation();
    syncCompareUI(loadCompareProductIds());
  });

  observer.observe(app, { childList: true });
}

async function loadImages(products: Product[]): Promise<Map<string, ProductImagePair>> {
  const imageMap = new Map<string, ProductImagePair>();
  const productIds = products.map((product) => product.id);

  if (productIds.length === 0) {
    return imageMap;
  }

  try {
    const { data, error } = await supabase
      .from('product_affiliate_images')
      .select('product_id, rakuten_image_html, is_primary, display_order')
      .eq('media_type', 'image')
      .in('product_id', productIds)
      .order('display_order', { ascending: true });

    if (error) {
      throw error;
    }

    const grouped = new Map<string, ProductImage[]>();
    const images = Array.isArray(data) ? (data as ProductImage[]) : [];

    images.forEach((image) => {
      const productId = String(image.product_id);
      const list = grouped.get(productId) ?? [];
      list.push(image);
      grouped.set(productId, list);
    });

    grouped.forEach((list, productId) => {
      const sorted = [...list].sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999));
      const primaryImage = sorted.find((item) => item.is_primary) ?? sorted[0];
      const primary = extractImageSrc(primaryImage?.rakuten_image_html);
      const secondary = sorted
        .map((item) => extractImageSrc(item.rakuten_image_html))
        .find((src) => src && src !== primary) ?? '';

      if (primary) {
        imageMap.set(productId, { primary, secondary });
      }
    });
  } catch (error) {
    console.error('URL条件の商品画像取得に失敗しました。', error);
  }

  return imageMap;
}

function toPrimaryImageMap(imageMap: Map<string, ProductImagePair>): Map<string, string> {
  return new Map(Array.from(imageMap, ([productId, image]) => [productId, image.primary]));
}

function renderLoading(): string {
  return `
    <main class="url-filter-products">
      <p>商品データを読み込んでいます。</p>
    </main>
  `;
}

function renderError(): string {
  return `
    <main class="url-filter-products">
      <h1>商品一覧</h1>
      <p>商品一覧を読み込めませんでした。時間を置いてもう一度お試しください。</p>
      <a href="/products.html">すべて表示</a>
    </main>
  `;
}

function renderPage(products: Product[], imageMap: Map<string, ProductImagePair>, colors: Map<string, ProductColor[]>, brands: Map<string, Brand>): string {
  const title = selectedCategory || selectedScene || selectedBrand || '商品一覧';

  return `
    <main class="url-filter-products">
      <header class="url-filter-products__header">
        <p>COLLECTION</p>
        <h1>${escapeHtml(title)}の商品一覧</h1>
        <div class="url-filter-products__actions">
          <span>${products.length}件の商品</span>
          <a href="/products.html">すべて表示</a>
        </div>
      </header>
      ${
        products.length > 0
          ? `<div class="url-filter-products__grid">${products.map((product) => renderProductCard(product, imageMap, colors, brands)).join('')}</div>`
          : renderEmpty()
      }
    </main>
  `;
}

function renderEmpty(): string {
  return `
    <section class="url-filter-products__empty">
      <h2>条件に合う商品が見つかりませんでした</h2>
      <p>条件を変えるか、すべての商品一覧から探してみてください。</p>
      <a href="/products.html">すべて表示</a>
    </section>
  `;
}

function renderProductCard(product: Product, imageMap: Map<string, ProductImagePair>, colors: Map<string, ProductColor[]>, brands: Map<string, Brand>): string {
  const productId = String(product.id);
  const name = getText(product.name, `商品ID ${productId}`);
  const brand = getText(product.brand, 'ブランド未登録');
  const image = imageMap.get(productId);
  const tags = getTags(product).slice(0, 3);
  const productColors = colors.get(productId) ?? [];
  const brandRecord = product.brand_id ? brands.get(String(product.brand_id)) : undefined;

  return `
    <article class="url-product-card">
      <div class="url-product-card__media">
        <a class="url-product-card__image" href="/product.html?id=${encodeURIComponent(productId)}">
          ${
            image?.primary
              ? `
                <span class="image-hover-stack ${image.secondary ? 'has-hover-image' : ''}">
                  <img class="image-main" src="${escapeAttr(image.primary)}" alt="${escapeAttr(name)}" loading="lazy">
                  ${image.secondary ? `<img class="image-secondary" src="${escapeAttr(image.secondary)}" alt="" loading="lazy" aria-hidden="true">` : ''}
                </span>
              `
              : '<span>画像準備中</span>'
          }
        </a>
        ${renderQuickViewButton(productId)}
      </div>
      <p class="url-product-card__brand">${brandRecord ? `<a href="/brand.html?slug=${encodeURIComponent(brandRecord.slug)}">${escapeHtml(brandRecord.display_name)}</a>` : escapeHtml(brand)}</p>
      <a class="url-product-card__name" href="/product.html?id=${encodeURIComponent(productId)}">${escapeHtml(name)}</a>
      <p class="url-product-card__price">${escapeHtml(formatPrice(product.price_yen))}</p>
      ${tags.length > 0 ? `<div class="url-product-card__tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
      ${productColors.length > 0 ? `<div class="color-swatches" aria-label="カラー">${productColors.slice(0, 6).map((color) => `<span style="--swatch:${escapeAttr(color.swatch_hex)}" title="${escapeAttr(color.name)}"></span>`).join('')}</div>` : ''}
      <label class="url-product-card__compare">
        <input type="checkbox" data-compare-product-id="${escapeAttr(productId)}">
        <span>比較する</span>
      </label>
    </article>
  `;
}

function groupColors(colors: ProductColor[]): Map<string, ProductColor[]> {
  const grouped = new Map<string, ProductColor[]>();
  colors.forEach((color) => {
    const key = String(color.product_id);
    grouped.set(key, [...(grouped.get(key) ?? []), color]);
  });
  return grouped;
}

function matchesCategory(product: Product, category: string): boolean {
  const text = normalize(product.category);
  const patterns: Record<string, RegExp> = {
    ベビーカー: /ベビーカー|stroller|babycar/,
    抱っこ紐: /抱っこ紐|抱っこひも|baby carrier|carrier/,
    チャイルドシート: /チャイルドシート|car seat|carseat/,
    ヒップシート: /ヒップシート|hipseat|hip seat/,
  };

  return (patterns[category] ?? new RegExp(escapeRegExp(normalize(category)))).test(text);
}

function matchesScene(product: Product, scene: string): boolean {
  const text = normalize([
    product.name,
    product.feature_tags,
    product.product_type,
    product.target_age,
    product.memo,
  ]);
  const patterns: Record<string, RegExp> = {
    ワンオペ: /ワンオペ|片手|自立|簡単|かんたん|軽量/,
    電車移動: /電車|改札|駅|軽量|コンパクト/,
    軽自動車: /軽自動車|コンパクト|折りたたみ|折畳|車/,
    飛行機: /飛行機|旅行|トラベル|機内|コンパクト/,
    マンション: /マンション|玄関|省スペース|コンパクト|自立/,
    新生児: /新生児|生後1|1ヶ月|1か月|新生児ok/,
  };

  return (patterns[scene] ?? new RegExp(escapeRegExp(normalize(scene)))).test(text);
}

function getTags(product: Product): string[] {
  if (Array.isArray(product.feature_tags)) {
    return product.feature_tags.map(String).map((tag) => tag.trim()).filter(Boolean);
  }

  if (typeof product.feature_tags === 'string') {
    return product.feature_tags.split(/[,、\n]/).map((tag) => tag.trim()).filter(Boolean);
  }

  return [];
}

function extractImageSrc(html: unknown): string {
  if (typeof html !== 'string' || !html.trim()) {
    return '';
  }

  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.querySelector('img')?.getAttribute('src')?.trim() ?? '';
}

function formatPrice(value: Product['price_yen']): string {
  if (value === null || value === undefined || value === '') {
    return '価格未登録';
  }

  const numericValue = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(numericValue) ? `¥${Math.round(numericValue).toLocaleString('ja-JP')}` : '価格未登録';
}

function getText(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalize(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(normalize).join(' ');
  }

  return String(value ?? '').toLowerCase();
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function injectUrlFilterStyles(): void {
  if (document.getElementById('url-filter-products-style')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'url-filter-products-style';
  style.textContent = `
    .url-filter-products {
      width: min(1280px, calc(100% - 48px));
      margin: 0 auto;
      padding: 48px 0 96px;
      background: #fff;
      color: #28241f;
    }

    .url-filter-products__header {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid #e8e2d8;
      margin-bottom: 30px;
    }

    .url-filter-products__header p {
      margin: 0 0 8px;
      color: #81786b;
      font-size: 13px;
      letter-spacing: .08em;
    }

    .url-filter-products__header h1 {
      margin: 0;
      font-size: clamp(30px, 5vw, 52px);
      line-height: 1.3;
    }

    .url-filter-products__actions {
      display: flex;
      align-items: center;
      gap: 14px;
      white-space: nowrap;
    }

    .url-filter-products__actions a,
    .url-filter-products__empty a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0 16px;
      border: 1px solid #b8b3aa;
      background: #fff;
      color: #28241f;
      text-decoration: none;
    }

    .url-filter-products__grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 30px;
    }

    .url-product-card {
      min-width: 0;
      background: #fff;
    }

    .url-product-card__image {
      display: flex;
      align-items: center;
      justify-content: center;
      aspect-ratio: 1 / 1;
      border: none;
      border-radius: 0;
      background: transparent;
      color: #8a8378;
      text-decoration: none;
      overflow: hidden;
    }

    .url-product-card__image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .url-product-card__brand {
      margin: 18px 0 6px;
      color: #81786b;
      font-size: 13px;
    }

    .url-product-card__brand a {
      position: relative;
      display: inline-flex;
      width: fit-content;
      color: inherit;
      text-decoration: none;
    }

    .url-product-card__name {
      position: relative;
      display: inline-flex;
      width: fit-content;
      overflow: hidden;
      color: #28241f;
      text-decoration: none;
      font-size: 16px;
      font-weight: 500;
      line-height: 1.6;
    }

    .url-product-card__name::after,
    .url-product-card__brand a::after {
      position: absolute;
      left: 50%;
      bottom: -3px;
      width: 0;
      height: 1px;
      background: currentColor;
      content: '';
      transform: translateX(-50%);
      transition: width .25s ease;
    }

    .url-product-card__name:hover::after,
    .url-product-card__brand a:hover::after {
      width: 100%;
    }

    .url-product-card__price {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 8px;
      margin: 12px 0 0;
      color: #584f46;
      font-weight: 500;
    }

    .url-product-card__tags {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 13px;
    }

    .url-product-card__tags span {
      padding: 5px 10px;
      border: 1px solid #ff420e;
      border-radius: 2px;
      background: #fff;
      color: #ff420e;
      font-size: 9px;
    }

    .url-product-card .color-swatches {
      display: flex;
      gap: 6px;
      margin-top: 13px;
    }

    .url-product-card .color-swatches > span {
      width: 14px;
      height: 14px;
      border: 1px solid rgba(0, 0, 0, .14);
      border-radius: 50%;
      background: var(--swatch);
    }

    .url-product-card > .quick-view-trigger {
      display: none;
    }

    .product-check-link {
      display: none;
    }

    .product-check-link:hover {
      display: none;
    }

    .url-product-card__compare {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      color: #4a4740;
      font-size: 13px;
    }

    .url-product-card__compare input {
      width: 16px;
      height: 16px;
      accent-color: #333;
    }

    .url-filter-products__empty {
      max-width: 680px;
      padding: 48px 0;
    }

    .url-filter-products__empty p {
      color: #625b51;
      line-height: 1.8;
    }

    @media (max-width: 900px) {
      .url-filter-products__grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .url-filter-products {
        width: calc(100% - 28px);
      }

      .url-filter-products__header {
        align-items: flex-start;
        flex-direction: column;
      }

      .url-filter-products__actions {
        align-items: flex-start;
        flex-direction: column;
        white-space: normal;
      }

      .url-filter-products__grid {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.append(style);
}
