import './styles.css';
import { mountBackToTop } from './back-to-top';
import {
  MAX_COMPARE_PRODUCTS,
  applyFadeUpAnimations,
  loadCompareProductIds,
  mountCommonHeader,
  setupCompareTrayNavigation,
  syncCompareUI,
  updateCompareState,
} from './shared-ui';
import { supabase } from './lib/supabase';
import { renderQuickViewButton, setupProductQuickView } from './product-quick-view';
import type { Brand, Product as SharedProduct, ProductColor } from './types';

type Product = {
  id: string | number;
  name?: string | null;
  product_name?: string | null;
  title?: string | null;
  brand?: string | null;
  maker?: string | null;
  manufacturer?: string | null;
  category?: string | null;
  type?: string | null;
  product_type?: string | null;
  age?: string | null;
  age_range?: string | null;
  target_age?: string | null;
  weight?: string | number | null;
  weight_kg?: string | number | null;
  price_yen?: number | string | null;
  feature_tags?: string[] | string | null;
  tags?: string[] | string | null;
  colors?: string[] | string | null;
  color_variants?: string[] | string | null;
  rakuten_url?: string | null;
  rakuten_link?: string | null;
  amazon_url?: string | null;
  amazon_link?: string | null;
  yahoo_url?: string | null;
  yahoo_link?: string | null;
  official_url?: string | null;
  official_link?: string | null;
  [key: string]: unknown;
};

type AffiliateImage = {
  product_id: string | number;
  rakuten_image_html: string | null;
  is_primary?: boolean | null;
  display_order?: number | null;
};

type ProductImagePair = {
  primary: string;
  secondary: string;
};

type SortKey = 'recommended' | 'popular' | 'priceAsc' | 'priceDesc' | 'weightAsc';
type QuickFilter = string;
type QuickFilterConfig = { value: QuickFilter; label: string; test: (product: Product) => boolean };

const appElement = document.querySelector<HTMLDivElement>('#app');
const pageSize = 12;

if (!appElement) {
  throw new Error('#app was not found.');
}

const app: HTMLDivElement = appElement;

mountBackToTop();
mountCommonHeader('products');
setupCompareTrayNavigation();
syncCompareUI(loadCompareProductIds());
window.setTimeout(() => syncCompareUI(loadCompareProductIds()), 100);

bindProductCompareState();

function bindProductCompareState(): void {
  document.addEventListener(
    'change',
    (event: Event) => {
      const target = event.target;

      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      if (!target.matches('[data-compare-product-id], [data-compare-id]')) {
        return;
      }

      event.stopPropagation();
      setCompareInputState(target, target.checked);
    },
    true,
  );

  document.addEventListener(
    'click',
    (event: MouseEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const compareLabel = target.closest<HTMLLabelElement>('label.compare-check');
      if (compareLabel && !target.matches('input')) {
        const input = compareLabel.querySelector<HTMLInputElement>('[data-compare-product-id], [data-compare-id]');
        if (input) {
          event.preventDefault();
          event.stopPropagation();
          setCompareInputState(input, !input.checked);
          return;
        }
      }

      const compareButton = target.closest<HTMLElement>(
        '[data-compare-submit], [data-compare-action="open"], .compare-tray__primary, .compare-bar button',
      );

      if (!compareButton) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const selectedIds = updateCompareState(loadCompareProductIds());
      comparedProducts = new Set<string>(selectedIds);

      if (selectedIds.length < 1) {
        showCompareMessage('比較する商品を選択してください');
        return;
      }

      window.location.assign('/compare.html');
    },
    true,
  );
}

function setCompareInputState(input: HTMLInputElement, shouldSelect: boolean): void {
  const productId = getCompareProductIdFromInput(input);
  if (!productId) {
    comparedProducts = new Set<string>(loadCompareProductIds());
    syncCompareUI(Array.from(comparedProducts));
    return;
  }

  const currentIds = loadCompareProductIds();
  let nextIds = currentIds;

  if (shouldSelect) {
    if (!currentIds.includes(productId)) {
      if (currentIds.length >= MAX_COMPARE_PRODUCTS) {
        showCompareMessage('比較できる商品は最大4件までです。不要な商品を解除してください。');
        input.checked = false;
        syncCompareUI(currentIds);
        return;
      }

      nextIds = [...currentIds, productId];
    }
  } else {
    nextIds = currentIds.filter((id) => id !== productId);
  }

  const selectedIds = updateCompareState(nextIds);
  comparedProducts = new Set<string>(selectedIds);
  input.checked = selectedIds.includes(productId);
  syncCompareUI(selectedIds);
}

function getCompareProductIdFromInput(input: HTMLInputElement): string {
  const directId = input.dataset.compareProductId ?? input.dataset.compareId ?? input.value;

  if (directId) {
    return String(directId).trim();
  }

  const card = input.closest('.product-card, article, li') ?? input;
  const detailLink = card.querySelector<HTMLAnchorElement>('a[href*="product.html?id="]');

  if (!detailLink) {
    return '';
  }

  try {
    const url = new URL(detailLink.href, window.location.origin);
    return url.searchParams.get('id')?.trim() ?? '';
  } catch {
    return '';
  }
}

function showCompareMessage(message: string): void {
  document.querySelectorAll<HTMLElement>('.compare-tray__message, #compare-tray-message').forEach((element) => {
    element.textContent = message;
    element.classList.toggle('is-visible', Boolean(message));
  });
}

if (import.meta.env.DEV) {
  console.log('一覧初期化時の比較ID:', loadCompareProductIds());
}

let allProducts: Product[] = [];
let strollerProducts: Product[] = [];
let activeCategory = getInitialCategory();
let productImages = new Map<string, ProductImagePair>();
let productColors = new Map<string, ProductColor[]>();
let brandsById = new Map<string, Brand>();
let activeQuickFilter: QuickFilter = getInitialQuickFilter(activeCategory);
let activeSidebarFilters = getInitialSidebarFilters();
let sortKey: SortKey = getInitialSortKey();
let comparedProducts = new Set<string>(loadCompareProductIds());
let renderedCount = pageSize;
let loadObserver: IntersectionObserver | null = null;
let mobileSidebarOpen = false;

window.addEventListener('popstate', () => {
  const previousCategory = activeCategory;
  restoreFilterStateFromUrl();
  renderedCount = pageSize;
  if (previousCategory !== activeCategory) {
    strollerProducts = getProductsForCategory(activeCategory);
    renderStorefront();
    return;
  }
  syncFilterControls();
  renderProductResults({ updateUrl: false, animate: false });
});

renderPublicPage().catch((error) => {
  console.error('Failed to render public product listing:', error);
  app.innerHTML = `
    <main class="storefront-shell">
      <p class="listing-error">商品データの読み込みに失敗しました。</p>
    </main>
  `;
});

async function renderPublicPage() {
  app.innerHTML = `
    <main class="storefront-shell">
      <p class="listing-loading">商品データを読み込んでいます。</p>
    </main>
  `;

  const [productsResult, imagesResult, colorsResult, brandsResult] = await Promise.all([
    supabase.from('products').select('*').order('id', { ascending: true }),
    supabase
      .from('product_affiliate_images')
      .select('product_id, rakuten_image_html, is_primary, display_order')
      .eq('media_type', 'image')
      .order('display_order', { ascending: true }),
    supabase.from('product_colors').select('*').order('display_order', { ascending: true }),
    supabase.from('brands').select('*').eq('is_published', true),
  ]);

  if (productsResult.error) {
    console.error('Failed to load products:', productsResult.error);
    throw productsResult.error;
  }

  if (imagesResult.error) {
    console.error('Failed to load product_affiliate_images:', imagesResult.error);
    throw imagesResult.error;
  }

  allProducts = (productsResult.data ?? []) as Product[];
  const categoryCounts = countCategories(allProducts);
  console.log('全products件数', allProducts.length);
  console.log('categoryごとの件数', Object.fromEntries(categoryCounts));
  strollerProducts = getProductsForCategory(activeCategory);
  console.log(`${activeCategory} 絞り込み後の件数`, strollerProducts.length);

  productImages = buildProductImagePairs((imagesResult.data ?? []) as AffiliateImage[]);
  if (colorsResult.error) console.info('商品カラーはmigration適用後に表示されます。', colorsResult.error.message);
  if (brandsResult.error) console.info('ブランド導線はmigration適用後に有効になります。', brandsResult.error.message);
  productColors = groupProductColors((colorsResult.data ?? []) as ProductColor[]);
  brandsById = new Map(((brandsResult.data ?? []) as Brand[]).map((brand) => [brand.id, brand]));
  renderStorefront();
}

function renderStorefront() {
  comparedProducts = new Set<string>(loadCompareProductIds());
  app.innerHTML = `
    <main class="storefront-shell">
      <section class="hero-panel">
        <div class="hero-inner">
          <p class="section-title-en">COLLECTION</p>
          <h1 class="product-list-title">${escapeText(activeCategory)}</h1>
          <p class="hero-copy">${escapeText(activeCategory)}を、暮らしに合う条件から探せます。</p>
          <nav class="guide-links" aria-label="ベビーカー選びの導線">
            <a href="#">人気ランキング</a>
            <a href="#">かんたん診断</a>
            <a href="#">比較表</a>
            <a href="#">メーカーから探す</a>
          </nav>
        </div>
      </section>

      ${renderCategoryTabs()}

      <div class="content-shell">
        <div class="quick-filters" aria-label="クイックフィルター">
          ${getQuickFiltersForCategory(activeCategory).map((filter) => renderQuickFilter(filter.value, filter.label)).join('')}
        </div>

        <section class="catalog-layout">
          ${renderSidebar()}
          <section class="catalog-main">${renderCatalogMain()}</section>
        </section>
      </div>
    </main>

    <aside class="compare-bar ${comparedProducts.size > 0 ? 'is-active' : ''}">
      <span>${comparedProducts.size}件を比較中</span>
      <button type="button" ${comparedProducts.size === 0 ? 'disabled' : ''}>比較する</button>
    </aside>
  `;

  bindEvents();
  bindProductResultControls();
  setupProductQuickView({
    products: allProducts as SharedProduct[],
    imageByProductId: new Map(Array.from(productImages, ([id, pair]) => [id, pair.primary])),
    colorsByProductId: productColors,
    brandsById,
  });
  syncCompareUI(Array.from(comparedProducts));
  applyFadeUpAnimations(app);
  observeLoadMore(getVisibleProducts().slice(0, renderedCount).length < getVisibleProducts().length);
}

function renderCatalogMain(): string {
  const visibleProducts = getVisibleProducts();
  const renderedProducts = visibleProducts.slice(0, renderedCount);
  const hasMore = renderedProducts.length < visibleProducts.length;
  return `
    <div class="catalog-toolbar">
      <p>${visibleProducts.length}件の商品</p>
      <label>
        並び替え
        <select id="sortSelect">
          <option value="recommended" ${sortKey === 'recommended' ? 'selected' : ''}>おすすめ順</option>
          <option value="popular" ${sortKey === 'popular' ? 'selected' : ''}>人気順</option>
          <option value="priceAsc" ${sortKey === 'priceAsc' ? 'selected' : ''}>価格が安い順</option>
          <option value="priceDesc" ${sortKey === 'priceDesc' ? 'selected' : ''}>価格が高い順</option>
          <option value="weightAsc" ${sortKey === 'weightAsc' ? 'selected' : ''}>軽い順</option>
        </select>
      </label>
    </div>
    ${renderActiveFilterChips()}
    <div class="product-grid">
      ${renderedProducts.map((product, index) => renderProductCard(product, index)).join('')}
    </div>
    ${
      hasMore
        ? `<div id="loadMoreSentinel" class="load-sentinel">商品を読み込んでいます…</div>`
        : `<p class="load-complete">すべての商品を表示しました。</p>`
    }
  `;
}

function renderProductResults(options: { updateUrl?: boolean; replaceUrl?: boolean; animate?: boolean } = {}): void {
  const catalogMain = document.querySelector<HTMLElement>('.catalog-main');
  if (!catalogMain) {
    renderStorefront();
    return;
  }
  if (options.updateUrl !== false) updateProductsUrl(options.replaceUrl ? 'replace' : 'push');
  loadObserver?.disconnect();
  loadObserver = null;
  if (options.animate !== false) catalogMain.classList.add('is-filter-updating');
  catalogMain.innerHTML = renderCatalogMain();
  bindProductResultControls();
  comparedProducts = new Set<string>(loadCompareProductIds());
  syncCompareUI(Array.from(comparedProducts));
  const visibleProducts = getVisibleProducts();
  observeLoadMore(Math.min(renderedCount, visibleProducts.length) < visibleProducts.length);
  if (options.animate !== false) {
    window.setTimeout(() => catalogMain.classList.remove('is-filter-updating'), 180);
  }
}

function renderActiveFilterChips(): string {
  const chips: string[] = [];
  if (activeQuickFilter !== 'all') {
    chips.push(`<button type="button" data-clear-quick-filter>${escapeText(getQuickFilterLabel(activeQuickFilter))}<span aria-hidden="true">×</span></button>`);
  }
  for (const filter of activeSidebarFilters) {
    chips.push(`<button type="button" data-remove-sidebar-filter="${escapeAttr(filter)}">${escapeText(getSidebarFilterLabel(filter))}<span aria-hidden="true">×</span></button>`);
  }
  if (chips.length === 0) return '';
  return `<div class="active-filter-chips" aria-label="選択中の条件">${chips.join('')}</div>`;
}

function syncFilterControls(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-quick-filter]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.quickFilter === activeQuickFilter);
  });
  document.querySelectorAll<HTMLInputElement>('.filter-check input').forEach((input) => {
    input.checked = activeSidebarFilters.has(input.value);
  });
  const clearButton = document.querySelector<HTMLButtonElement>('[data-clear-sidebar-filters]');
  if (clearButton) clearButton.hidden = activeSidebarFilters.size === 0;
}

function getQuickFilterLabel(value: QuickFilter): string {
  return getQuickFiltersForCategory(activeCategory).find((filter) => filter.value === value)?.label ?? value;
}

function getSidebarFilterLabel(value: string): string {
  const [group, ...rest] = value.split(':');
  const rawValue = rest.join(':');
  const allFilters = [
    ...getTypeFiltersForCategory(activeCategory),
    ...getSceneFiltersForCategory(activeCategory),
    ...getBrandFilters(),
    ['price:under30000', '〜3万円'],
    ['price:30000to50000', '3〜5万円'],
    ['price:50000to80000', '5〜8万円'],
    ['price:over80000', '8万円〜'],
    ['weight:under5', '5kg未満'],
    ['weight:5to6', '5〜6kg'],
    ['weight:6to8', '6〜8kg'],
    ['weight:over8', '8kg以上'],
    ['color:black', 'ブラック'],
    ['color:beige', 'ベージュ'],
    ['color:gray', 'グレー'],
    ['color:navy', 'ネイビー'],
  ];
  return allFilters.find(([filterValue]) => filterValue === value)?.[1] ?? (rawValue || group || value);
}

function renderQuickFilter(value: QuickFilter, label: string) {
  return `<button class="${activeQuickFilter === value ? 'is-active' : ''}" data-quick-filter="${value}" type="button">${escapeText(label)}</button>`;
}

function renderCategoryTabs() {
  const categories = getMainCategories();
  return `
    <nav class="category-tabs" aria-label="商品カテゴリ">
      ${categories.map((category) => {
        const count = getProductsForCategory(category).length;
        const isCurrent = category === activeCategory;
        const href = buildCategoryUrl(category);
        return `
          <a class="category-tab${isCurrent ? ' is-current' : ''}" href="${escapeAttr(href)}" data-category-nav="${escapeAttr(category)}" ${isCurrent ? 'aria-current="page"' : ''}>
            <span>${escapeText(category)}</span>
            <small>${count}</small>
          </a>
        `;
      }).join('')}
    </nav>
  `;
}

function getMainCategories(): string[] {
  return ['ベビーカー', '抱っこ紐', 'チャイルドシート', 'ヒップシート'];
}

function getQuickFiltersForCategory(category: string): QuickFilterConfig[] {
  const byText = (value: string, label: string, pattern: RegExp): QuickFilterConfig => ({
    value,
    label,
    test: (product) => pattern.test(searchableText(product)),
  });
  const all: QuickFilterConfig = { value: 'all', label: 'すべて', test: () => true };
  const weightUnder = (kg: number) => (product: Product) => {
    const weight = getWeightNumber(product);
    return weight > 0 && weight < kg;
  };

  if (category === '抱っこ紐') {
    return [
      all,
      byText('newbornCarrier', '新生児OK', /新生児|生後\s*1|1カ月|1ヶ月/),
      byText('mesh', 'メッシュ', /メッシュ|通気|夏/),
      byText('frontHold', '前向き', /前向き|対面|おんぶ/),
      byText('compactCarrier', 'コンパクト', /コンパクト|収納|軽量/),
    ];
  }

  if (category === 'チャイルドシート') {
    return [
      all,
      byText('newbornSeat', '新生児OK', /新生児|乳児|ベビーシート/),
      byText('rotateSeat', '回転式', /回転|360/),
      byText('isofix', 'ISOFIX', /ISOFIX|アイソフィックス/i),
      byText('longUse', 'ロングユース', /ロング|長く|ジュニア/),
    ];
  }

  if (category === 'ヒップシート') {
    return [
      all,
      byText('singleHipseat', '単体タイプ', /単体|ヒップシート/),
      byText('shoulderHipseat', '肩ベルト付き', /肩|ショルダー|抱っこ紐/),
      byText('storageHipseat', '収納あり', /収納|ポケット/),
      byText('compactHipseat', 'コンパクト', /コンパクト|軽量/),
    ];
  }

  return [
    all,
    byText('newborn', '新生児OK', /新生児|生後\s*1|1カ月|1ヶ月/),
    { value: 'lightweight', label: '軽量', test: weightUnder(5) },
    byText('reversible', '両対面', /両対面/),
    byText('train', '電車移動', /軽量|コンパクト|電車|ワンタッチ|折りたたみ/),
    byText('compactCar', '軽自動車', /コンパクト|軽自動車|折りたたみ/),
    byText('travel', '旅行', /旅行|軽量|コンパクト|機内|トラベル/),
  ];
}

function getTypeFiltersForCategory(category: string): Array<[string, string]> {
  if (category === '抱っこ紐') {
    return [['type:腰ベルト', '腰ベルト'], ['type:スリング', 'スリング'], ['type:ラップ', 'ラップ'], ['type:おんぶ', 'おんぶ'], ['type:メッシュ', 'メッシュ']];
  }
  if (category === 'チャイルドシート') {
    return [['type:回転式', '回転式'], ['type:固定式', '固定式'], ['type:ISOFIX', 'ISOFIX'], ['type:ベビーシート', 'ベビーシート'], ['type:ジュニア', 'ジュニア']];
  }
  if (category === 'ヒップシート') {
    return [['type:単体', '単体'], ['type:肩ベルト', '肩ベルト付き'], ['type:収納', '収納あり'], ['type:折りたたみ', '折りたたみ']];
  }
  return [['type:A型', 'A型'], ['type:B型', 'B型'], ['type:AB型', 'AB型'], ['type:三輪', '三輪'], ['type:コンパクト', 'コンパクト'], ['type:両対面', '両対面']];
}

function getSceneFiltersForCategory(category: string): Array<[string, string]> {
  if (category === '抱っこ紐') {
    return [['scene:ワンオペ', 'ワンオペ'], ['scene:電車移動', '電車移動'], ['scene:旅行', '旅行'], ['scene:寝かしつけ', '寝かしつけ'], ['scene:夏', '夏のお出かけ']];
  }
  if (category === 'チャイルドシート') {
    return [['scene:軽自動車', '軽自動車'], ['scene:長距離', '長距離移動'], ['scene:乗せ降ろし', '乗せ降ろし'], ['scene:新生児', '新生児'], ['scene:買い替え', '買い替え']];
  }
  if (category === 'ヒップシート') {
    return [['scene:ちょい抱き', 'ちょい抱き'], ['scene:公園', '公園'], ['scene:旅行', '旅行'], ['scene:上の子送迎', '上の子送迎'], ['scene:収納', '収納重視']];
  }
  return [['scene:電車移動', '電車移動'], ['scene:軽自動車', '軽自動車'], ['scene:マンション', 'マンション'], ['scene:ワンオペ', 'ワンオペ'], ['scene:旅行', '旅行'], ['scene:新生児', '新生児'], ['scene:飛行機', '飛行機']];
}

function renderSidebar() {
  const brandFilters = getBrandFilters();
  return `
    <details class="filter-sidebar">
      <summary>絞り込み</summary>
      <div class="filter-panel">
        ${renderFilterGroup('タイプ', getTypeFiltersForCategory(activeCategory))}
        ${renderFilterGroup('シーンで探す', getSceneFiltersForCategory(activeCategory))}
        ${renderFilterGroup('ブランド', brandFilters)}
        ${renderFilterGroup('価格', [['price:under30000', '〜3万円'], ['price:30000to50000', '3〜5万円'], ['price:50000to80000', '5〜8万円'], ['price:over80000', '8万円〜']])}
        ${renderFilterGroup('重さ', [['weight:under5', '5kg未満'], ['weight:5to6', '5〜6kg'], ['weight:6to8', '6〜8kg'], ['weight:over8', '8kg以上']])}
        ${renderColorFilterGroup()}
        <button class="filter-clear" type="button" data-clear-sidebar-filters ${activeSidebarFilters.size === 0 ? 'hidden' : ''}>条件をクリア</button>
      </div>
    </details>
  `;
}

function getBrandFilters(): Array<[string, string]> {
  const counts = new Map<string, number>();
  for (const product of strollerProducts) {
    const brand = getCanonicalBrand(getFirstText(product, ['brand', 'maker', 'manufacturer']));
    if (brand) counts.set(brand, (counts.get(brand) ?? 0) + 1);
  }
  const priority = ['CYBEX', 'Aprica', 'Combi', 'Pigeon', 'Joie', 'Bugaboo'];
  return [...counts.keys()]
    .sort((a, b) => {
      const ai = priority.indexOf(a);
      const bi = priority.indexOf(b);
      if (ai >= 0 || bi >= 0) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
      return a.localeCompare(b, 'ja');
    })
    .map((brand) => [`brand:${brand}`, brand]);
}

function getCanonicalBrand(value: string) {
  const normalized = value.trim();
  if (!normalized) return '';
  if (/cybex|サイベックス/i.test(normalized)) return 'CYBEX';
  if (/aprica|アップリカ/i.test(normalized)) return 'Aprica';
  if (/combi|コンビ/i.test(normalized)) return 'Combi';
  if (/pigeon|ピジョン/i.test(normalized)) return 'Pigeon';
  if (/bugaboo|バガブー/i.test(normalized)) return 'Bugaboo';
  if (/^joie$/i.test(normalized)) return 'Joie';
  return normalized;
}

function renderFilterGroup(title: string, filters: Array<[string, string]>) {
  const isOpen = filters.some(([value]) => activeSidebarFilters.has(value));
  return `
    <details class="filter-group filter-accordion${title === 'ブランド' ? ' brand-filter-group' : ''}" ${isOpen ? 'open' : ''}>
      <summary><span>${escapeText(title)}</span><i aria-hidden="true"></i></summary>
      <div class="filter-options">${filters
        .map(
          ([value, label]) => `
            <label class="filter-check">
              <input type="checkbox" value="${escapeAttr(value)}" ${activeSidebarFilters.has(value) ? 'checked' : ''} />
              <span>${escapeText(label)}</span>
            </label>
          `,
        )
        .join('')}</div>
    </details>
  `;
}

function renderColorFilterGroup() {
  const filters: Array<[string, string, string]> = [
    ['color:black', 'ブラック系', '#242424'],
    ['color:beige', 'ベージュ系', '#d8c3a5'],
    ['color:gray', 'グレー系', '#9b9b9b'],
    ['color:navy', 'ネイビー系', '#25385f'],
  ];
  const isOpen = filters.some(([value]) => activeSidebarFilters.has(value));
  return `
    <details class="filter-group filter-accordion color-filter-group" ${isOpen ? 'open' : ''}>
      <summary><span>カラー</span><i aria-hidden="true"></i></summary>
      <div class="filter-options color-filter-options">${filters
        .map(
          ([value, label, color]) => `
            <label class="filter-check color-filter-check" title="${escapeAttr(label)}">
              <input type="checkbox" value="${escapeAttr(value)}" ${activeSidebarFilters.has(value) ? 'checked' : ''} />
              <span class="color-swatch" style="--swatch:${escapeAttr(color)}" aria-label="${escapeAttr(label)}"></span>
              <small>${escapeText(label.replace('系', ''))}</small>
            </label>
          `,
        )
        .join('')}</div>
    </details>
  `;
}

function renderProductCard(product: Product, index: number) {
  const rank = index + 1;
  const productId = String(product.id);
  const imagePair = productImages.get(productId);
  const brand = getFirstText(product, ['brand', 'maker', 'manufacturer', 'category']) || 'Baby item';
  const brandRecord = product.brand_id ? brandsById.get(String(product.brand_id)) : undefined;
  const name = getProductName(product);
  const price = formatPrice(product.price_yen);
  const tags = getDisplayTags(product).slice(0, 3);
  const detailUrl = `product.html?id=${encodeURIComponent(productId)}`;
  const purchaseLinks = getPurchaseLinks(product);
  const checked = comparedProducts.has(productId);

  return `
    <article class="product-card">
      <div class="product-media">
        ${rank <= 3 ? `<span class="rank-label">${rank}位</span>` : ''}
        <a class="product-media-link" href="${escapeAttr(detailUrl)}" aria-label="${escapeAttr(`${name}の商品詳細を見る`)}">
          ${
            imagePair?.primary
              ? `
                <span class="image-hover-stack ${imagePair.secondary ? 'has-hover-image' : ''}">
                  <img class="image-main" src="${escapeAttr(imagePair.primary)}" alt="${escapeAttr(name)}" loading="lazy" decoding="async" />
                  ${
                    imagePair.secondary
                      ? `<img class="image-secondary" src="${escapeAttr(imagePair.secondary)}" alt="" loading="lazy" decoding="async" />`
                      : ''
                  }
                </span>
              `
              : `<div class="image-placeholder">画像準備中</div>`
          }
        </a>
        ${renderQuickViewButton(productId)}
      </div>
      <div class="product-body">
        <p class="product-brand">${brandRecord ? `<a href="/brand.html?slug=${encodeURIComponent(brandRecord.slug)}">${escapeText(brandRecord.display_name)}</a>` : escapeText(brand)}</p>
        <h2 class="product-name"><a href="${escapeAttr(detailUrl)}">${escapeText(name)}</a></h2>
        <p class="product-price">${escapeText(price)}</p>
        <ul class="feature-tags">${tags.map((tag) => `<li>${escapeText(tag)}</li>`).join('')}</ul>
        ${renderProductColors(productId)}
        <div class="card-actions">
          <div class="mall-links">${purchaseLinks.map((link) => renderPurchaseLink(link.label, link.url)).join('')}</div>
          <label class="compare-check">
            <input type="checkbox" data-compare-id="${escapeAttr(productId)}" ${checked ? 'checked' : ''} />
            <span>比較する</span>
          </label>
        </div>
      </div>
    </article>
  `;
}

function renderPurchaseLink(label: string, url: string) {
  if (!url) return '';
  return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeText(label)}</a>`;
}

function bindEvents() {
  bindResponsiveSidebar();
  bindFilterAccordionAnimations();
  document.querySelectorAll<HTMLButtonElement>('[data-quick-filter]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      activeQuickFilter = button.dataset.quickFilter as QuickFilter;
      renderedCount = pageSize;
      syncFilterControls();
      renderProductResults({ updateUrl: true });
    });
  });

  document.querySelectorAll<HTMLAnchorElement>('[data-category-nav]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const nextCategory = link.dataset.categoryNav?.trim();
      if (!nextCategory || nextCategory === activeCategory) return;
      activeCategory = nextCategory;
      strollerProducts = getProductsForCategory(activeCategory);
      activeQuickFilter = 'all';
      activeSidebarFilters.clear();
      sortKey = 'recommended';
      renderedCount = pageSize;
      window.history.pushState({ category: activeCategory }, '', buildCategoryUrl(activeCategory));
      renderStorefront();
    });
  });

  document.querySelectorAll<HTMLInputElement>('.filter-check input').forEach((input) => {
    input.addEventListener('change', () => {
      if (input.checked) activeSidebarFilters.add(input.value);
      else activeSidebarFilters.delete(input.value);
      renderedCount = pageSize;
      syncFilterControls();
      renderProductResults({ updateUrl: true });
    });
  });

  document.querySelector<HTMLButtonElement>('[data-clear-sidebar-filters]')?.addEventListener('click', (event) => {
    event.preventDefault();
    activeSidebarFilters.clear();
    renderedCount = pageSize;
    syncFilterControls();
    renderProductResults({ updateUrl: true });
  });
}

function bindProductResultControls() {
  document.querySelector<HTMLSelectElement>('#sortSelect')?.addEventListener('change', (event: Event) => {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;

    sortKey = select.value as SortKey;
    renderedCount = pageSize;
    renderProductResults({ updateUrl: true });
  });

  document.querySelector<HTMLButtonElement>('[data-clear-quick-filter]')?.addEventListener('click', (event) => {
    event.preventDefault();
    activeQuickFilter = 'all';
    renderedCount = pageSize;
    syncFilterControls();
    renderProductResults({ updateUrl: true });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-remove-sidebar-filter]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const filter = button.dataset.removeSidebarFilter;
      if (filter) activeSidebarFilters.delete(filter);
      renderedCount = pageSize;
      syncFilterControls();
      renderProductResults({ updateUrl: true });
    });
  });
}

function bindFilterAccordionAnimations() {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll<HTMLDetailsElement>('.filter-accordion').forEach((details) => {
    const summary = details.querySelector<HTMLElement>(':scope > summary');
    const content = details.querySelector<HTMLElement>(':scope > .filter-options');
    if (!summary || !content || reducedMotion) return;

    summary.addEventListener('click', (event) => {
      event.preventDefault();
      if (details.classList.contains('is-animating')) return;

      const isOpening = !details.open;
      details.classList.add('is-animating');
      if (isOpening) {
        details.open = true;
        content.style.maxHeight = '0px';
        content.style.opacity = '0';
        requestAnimationFrame(() => {
          content.style.maxHeight = `${content.scrollHeight}px`;
          content.style.opacity = '1';
        });
      } else {
        content.style.maxHeight = `${content.scrollHeight}px`;
        content.style.opacity = '1';
        requestAnimationFrame(() => {
          content.style.maxHeight = '0px';
          content.style.opacity = '0';
        });
      }

      let isFinished = false;
      const finish = () => {
        if (isFinished) return;
        isFinished = true;
        content.removeEventListener('transitionend', finish);
        details.classList.remove('is-animating');
        if (!isOpening) details.open = false;
        content.style.maxHeight = '';
        content.style.opacity = '';
      };
      content.addEventListener('transitionend', finish);
      window.setTimeout(finish, 280);
    });
  });
}

function bindResponsiveSidebar() {
  const sidebar = document.querySelector<HTMLDetailsElement>('.filter-sidebar');
  if (!sidebar) return;
  const desktop = window.matchMedia('(min-width: 1101px)').matches;
  sidebar.open = desktop || mobileSidebarOpen;
  sidebar.addEventListener('toggle', () => {
    if (!window.matchMedia('(min-width: 1101px)').matches) mobileSidebarOpen = sidebar.open;
  });
}

function observeLoadMore(hasMore: boolean) {
  loadObserver?.disconnect();
  loadObserver = null;
  if (!hasMore) return;

  const sentinel = document.querySelector('#loadMoreSentinel');
  if (!sentinel) return;

  loadObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      const total = getVisibleProducts().length;
      renderedCount = Math.min(renderedCount + pageSize, total);
      if (renderedCount >= total) loadObserver?.disconnect();
      renderProductResults({ updateUrl: false, animate: false });
    },
    { rootMargin: '360px 0px' },
  );

  loadObserver.observe(sentinel);
}

function getVisibleProducts() {
  const filtered = strollerProducts.filter((product) => matchesQuickFilter(product) && matchesSidebarFilters(product));
  return sortProducts(filtered);
}

function getInitialCategory(): string {
  const category = new URLSearchParams(window.location.search).get('category')?.trim();
  return normalizeRequestedCategory(category || 'ベビーカー');
}

function getInitialQuickFilter(category: string): QuickFilter {
  const value = new URLSearchParams(window.location.search).get('filter')?.trim()
    || new URLSearchParams(window.location.search).get('quick')?.trim()
    || 'all';
  return getQuickFiltersForCategory(category).some((filter) => filter.value === value) ? value : 'all';
}

function getInitialSortKey(): SortKey {
  const value = new URLSearchParams(window.location.search).get('sort')?.trim() as SortKey | null;
  return value && ['recommended', 'popular', 'priceAsc', 'priceDesc', 'weightAsc'].includes(value) ? value : 'recommended';
}

function getInitialSidebarFilters(): Set<string> {
  const params = new URLSearchParams(window.location.search);
  const filters = new Set<string>();
  getQueryValues(params, 'type').forEach((value) => filters.add(`type:${value}`));
  getQueryValues(params, 'scene').forEach((value) => filters.add(`scene:${value}`));
  getQueryValues(params, 'brand').forEach((value) => filters.add(`brand:${getCanonicalBrand(value) || value}`));
  getQueryValues(params, 'price').forEach((value) => filters.add(`price:${value}`));
  getQueryValues(params, 'weight').forEach((value) => filters.add(`weight:${value}`));
  getQueryValues(params, 'color').forEach((value) => filters.add(`color:${value}`));
  return filters;
}

function restoreFilterStateFromUrl(): void {
  activeCategory = getInitialCategory();
  activeQuickFilter = getInitialQuickFilter(activeCategory);
  activeSidebarFilters = getInitialSidebarFilters();
  sortKey = getInitialSortKey();
}

function getQueryValues(params: URLSearchParams, key: string): string[] {
  return params
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeRequestedCategory(category: string) {
  if (/stroller|babycar|ベビーカー/i.test(category)) return 'ベビーカー';
  if (/carrier|抱っこ/i.test(category)) return '抱っこ紐';
  if (/car\s*seat|carseat|チャイルド/i.test(category)) return 'チャイルドシート';
  if (/hip\s*seat|hipseat|ヒップ/i.test(category)) return 'ヒップシート';
  return category;
}

function categoryToQuery(category: string): string {
  if (category === '抱っこ紐') return 'carrier';
  if (category === 'チャイルドシート') return 'car-seat';
  if (category === 'ヒップシート') return 'hip-seat';
  return 'stroller';
}

function buildCategoryUrl(category: string): string {
  return category === 'ベビーカー' ? '/products.html' : `/products.html?category=${encodeURIComponent(categoryToQuery(category))}`;
}

function updateProductsUrl(mode: 'push' | 'replace' = 'push'): void {
  const url = buildProductsUrl();
  const current = `${window.location.pathname}${window.location.search}`;
  if (url === current) return;
  window.history[mode === 'replace' ? 'replaceState' : 'pushState']({ category: activeCategory }, '', url);
}

function buildProductsUrl(): string {
  const params = new URLSearchParams();
  if (activeCategory !== 'ベビーカー') params.set('category', categoryToQuery(activeCategory));
  if (activeQuickFilter !== 'all') params.set('filter', activeQuickFilter);
  if (sortKey !== 'recommended') params.set('sort', sortKey);
  const grouped = [...activeSidebarFilters].sort().reduce((map, filter) => {
    const [key, ...rest] = filter.split(':');
    if (!key || rest.length === 0) return map;
    map.set(key, [...(map.get(key) ?? []), rest.join(':')]);
    return map;
  }, new Map<string, string[]>());
  ['type', 'scene', 'brand', 'price', 'weight', 'color'].forEach((key) => {
    grouped.get(key)?.forEach((value) => params.append(key, value));
  });
  const query = params.toString();
  return query ? `/products.html?${query}` : '/products.html';
}

function matchesQuickFilter(product: Product) {
  return getQuickFiltersForCategory(activeCategory).find((filter) => filter.value === activeQuickFilter)?.test(product) ?? true;
}

function matchesSidebarFilters(product: Product) {
  const grouped = new Map<string, string[]>();
  for (const filter of activeSidebarFilters) {
    const group = filter.split(':', 1)[0];
    grouped.set(group, [...(grouped.get(group) ?? []), filter]);
  }
  for (const filters of grouped.values()) {
    if (!filters.some((filter) => matchesSidebarFilter(product, filter))) return false;
  }
  return true;
}

function matchesSidebarFilter(product: Product, filter: string) {
  const haystack = searchableText(product);
  const weight = getWeightNumber(product);
  const price = getPriceNumber(product);
  if (filter === 'type:A型') return /A型/.test(haystack);
  if (filter === 'type:B型') return /B型/.test(haystack) && !/AB型/.test(haystack);
  if (filter === 'type:AB型') return /AB型/.test(haystack);
  if (filter === 'type:三輪') return /三輪|3輪/.test(haystack);
  if (filter === 'type:コンパクト') return /コンパクト|折りたたみ|折畳/.test(haystack);
  if (filter === 'type:両対面') return /両対面/.test(haystack);
  if (filter.startsWith('type:')) return new RegExp(escapeRegExp(filter.replace('type:', '')), 'i').test(haystack);
  if (filter.startsWith('scene:')) return matchesSceneFilter(haystack, filter.replace('scene:', ''));
  if (filter === 'weight:under5') return weight > 0 && weight < 5;
  if (filter === 'weight:5to6') return weight >= 5 && weight < 6;
  if (filter === 'weight:6to8') return weight >= 6 && weight < 8;
  if (filter === 'weight:over8') return weight >= 8 && Number.isFinite(weight);
  if (filter === 'price:under30000') return price > 0 && price < 30000;
  if (filter === 'price:30000to50000') return price >= 30000 && price < 50000;
  if (filter === 'price:50000to80000') return price >= 50000 && price < 80000;
  if (filter === 'price:over80000') return price >= 80000 && Number.isFinite(price);
  if (filter.startsWith('brand:')) {
    const brand = getCanonicalBrand(getFirstText(product, ['brand', 'maker', 'manufacturer']));
    return brand === filter.replace('brand:', '');
  }
  if (filter.startsWith('color:')) {
    if (productColors.size === 0) return true;
    const family = filter.replace('color:', '').toLowerCase();
    return (productColors.get(String(product.id)) ?? []).some((color) => color.color_family === family);
  }
  return true;
}

function matchesSceneFilter(haystack: string, scene: string) {
  if (scene === '電車移動') return /電車|改札|駅|軽量|コンパクト/.test(haystack);
  if (scene === '軽自動車') return /軽自動車|コンパクト|折りたたみ|折畳|車載/.test(haystack);
  if (scene === 'マンション') return /マンション|玄関|省スペース|コンパクト|自立/.test(haystack);
  if (scene === 'ワンオペ') return /ワンオペ|片手|自立|簡単|かんたん|軽量/.test(haystack);
  if (scene === '旅行') return /旅行|トラベル|コンパクト|機内|軽量/.test(haystack);
  if (scene === '新生児') return /新生児|生後\s*1|1カ月|1ヶ月/.test(haystack);
  if (scene === '飛行機') return /飛行機|機内|旅行|トラベル|コンパクト/.test(haystack);
  if (scene === '寝かしつけ') return /寝かしつけ|寝かせ|寝る|ねんね/.test(haystack);
  if (scene === '夏') return /夏|メッシュ|通気|涼/.test(haystack);
  if (scene === '長距離') return /長距離|ドライブ|車|快適/.test(haystack);
  if (scene === '乗せ降ろし') return /乗せ降ろし|回転|ドア|片手/.test(haystack);
  if (scene === '買い替え') return /ジュニア|買い替え|ロング|長く/.test(haystack);
  if (scene === 'ちょい抱き') return /ちょい|短時間|ヒップシート|抱っこ/.test(haystack);
  if (scene === '公園') return /公園|散歩|外遊び|歩き/.test(haystack);
  if (scene === '上の子送迎') return /送迎|上の子|保育園|幼稚園/.test(haystack);
  if (scene === '収納') return /収納|ポケット|バッグ/.test(haystack);
  return true;
}

function groupProductColors(colors: ProductColor[]) {
  const grouped = new Map<string, ProductColor[]>();
  for (const color of colors) {
    const key = String(color.product_id);
    grouped.set(key, [...(grouped.get(key) ?? []), color]);
  }
  return grouped;
}

function renderProductColors(productId: string) {
  const colors = productColors.get(productId) ?? [];
  if (colors.length === 0) return '';
  return `<div class="color-swatches" aria-label="カラー">${colors.slice(0, 6).map((color) => `<span style="--swatch:${escapeAttr(color.swatch_hex)}" title="${escapeAttr(color.name)}" aria-label="${escapeAttr(color.name)}"></span>`).join('')}</div>`;
}

function sortProducts(products: Product[]) {
  const copy = [...products];
  if (sortKey === 'priceAsc') return copy.sort((a, b) => getPriceNumber(a) - getPriceNumber(b));
  if (sortKey === 'priceDesc') return copy.sort((a, b) => getPriceNumber(b) - getPriceNumber(a));
  if (sortKey === 'weightAsc') return copy.sort((a, b) => getWeightNumber(a) - getWeightNumber(b));
  return copy;
}

function countCategories(products: Product[]) {
  const counts = new Map<string, number>();
  for (const product of products) {
    const category = normalizeCategory(product.category);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return counts;
}

function getStrollerCategoryValues(categoryCounts: Map<string, number>) {
  const values = new Set<string>();
  for (const category of categoryCounts.keys()) {
    if (/ベビーカー|stroller/i.test(category.trim())) values.add(category.trim());
  }
  if (values.size === 0) {
    console.warn('ベビーカーに該当するcategory値が見つかりませんでした。category values:', [...categoryCounts.keys()]);
  }
  return values;
}

function getProductsForCategory(category: string) {
  const categoryCounts = countCategories(allProducts);
  const categories = category === 'ベビーカー'
    ? getStrollerCategoryValues(categoryCounts)
    : new Set([...categoryCounts.keys()].filter((value) => matchesCategoryLabel(value, category)));
  const categoryFilteredProducts = allProducts.filter((product) => categories.has(normalizeCategory(product.category)));
  return dedupeProductsById(categoryFilteredProducts);
}

function matchesCategoryLabel(value: string, category: string) {
  if (value === category) return true;
  const patterns: Record<string, RegExp> = {
    抱っこ紐: /抱っこ紐|抱っこひも|baby carrier|carrier/i,
    チャイルドシート: /チャイルドシート|car seat|carseat/i,
    ヒップシート: /ヒップシート|hipseat|hip seat/i,
  };
  return (patterns[category] ?? new RegExp(escapeRegExp(category), 'i')).test(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCategory(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value === null || value === undefined) return '(empty)';
  return String(value).trim() || '(empty)';
}

function dedupeProductsById(products: Product[]) {
  const map = new Map<string, Product>();
  for (const product of products) {
    const id = String(product.id);
    if (!map.has(id)) map.set(id, product);
  }
  return [...map.values()];
}

function buildProductImagePairs(images: AffiliateImage[]) {
  const grouped = new Map<string, Array<{ src: string; isPrimary: boolean; order: number }>>();
  for (const image of images) {
    const src = extractImageSrc(image.rakuten_image_html ?? '');
    if (!src) continue;
    const productId = String(image.product_id);
    const list = grouped.get(productId) ?? [];
    list.push({
      src,
      isPrimary: Boolean(image.is_primary),
      order: Number(image.display_order ?? 9999),
    });
    grouped.set(productId, list);
  }

  const pairs = new Map<string, ProductImagePair>();
  for (const [productId, list] of grouped) {
    const sorted = [...list].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.order - b.order);
    const primary = sorted.find((image) => image.isPrimary)?.src ?? sorted[0]?.src ?? '';
    const secondary = sorted
      .filter((image) => !image.isPrimary)
      .sort((a, b) => a.order - b.order)
      .find((image) => image.src !== primary)?.src ?? '';
    if (primary) pairs.set(productId, { primary, secondary });
  }
  return pairs;
}

function extractImageSrc(html: string) {
  if (!html) return '';
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.querySelector('img')?.getAttribute('src') ?? '';
}

function searchableText(product: Product) {
  return [
    getProductName(product),
    product.brand,
    product.maker,
    product.manufacturer,
    product.category,
    product.product_type,
    product.type,
    product.age,
    product.age_range,
    product.target_age,
    normalizeTags(product.feature_tags ?? product.tags).join(' '),
    weightLabel(product.weight_kg ?? product.weight),
  ].filter((value) => value !== null && value !== undefined).join(' ');
}

function getProductName(product: Product) {
  return getFirstText(product, ['name', 'product_name', 'title']) || `商品ID: ${String(product.id)}`;
}

function getDisplayTags(product: Product) {
  const featureTags = normalizeTags(product.feature_tags ?? product.tags);
  const fallbackTags = [
    shortAgeLabel(getFirstText(product, ['target_age', 'age_range', 'age'])),
    shortTypeLabel(getFirstText(product, ['product_type', 'type'])),
    shortWeightLabel(product.weight_kg ?? product.weight),
  ].filter(Boolean);
  return uniqueStrings([...featureTags, ...fallbackTags]).slice(0, 3);
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
    } catch {
      // Plain comma-separated strings are handled below.
    }
    return trimmed.split(/[,\n、]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function shortAgeLabel(value: string) {
  if (!value) return '';
  if (/新生児|生後\s*1|1カ月|1ヶ月/.test(value)) return '新生児OK';
  return value.replace(/\s+/g, '').slice(0, 10);
}

function shortTypeLabel(value: string) {
  if (!value) return '';
  if (/両対面/.test(value)) return '両対面';
  return value.replace(/\s+/g, '').slice(0, 8);
}

function shortWeightLabel(value: unknown) {
  const weight = weightLabel(value);
  if (!weight) return '';
  const numeric = Number(weight.replace(/[^\d.]/g, ''));
  if (Number.isFinite(numeric) && numeric < 5) return '軽量';
  return weight;
}

function weightLabel(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value).trim();
  return /kg/i.test(text) ? text : `${text}kg`;
}

function getPurchaseLinks(product: Product) {
  return [
    { label: '楽天', url: getFirstText(product, ['rakuten_url', 'rakuten_link']) },
    { label: 'Amazon', url: getFirstText(product, ['amazon_url', 'amazon_link']) },
    { label: 'Yahoo!', url: getFirstText(product, ['yahoo_url', 'yahoo_link']) },
    { label: '公式', url: getFirstText(product, ['official_url', 'official_link']) },
  ];
}

function getFirstText(product: Product, keys: string[]) {
  for (const key of keys) {
    const value = product[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function formatPrice(value: Product['price_yen']) {
  if (value === null || value === undefined || value === '') return '価格未登録';
  const numeric = Number(String(value).replace(/[^\d.-]/g, ''));
  if (Number.isFinite(numeric)) return `¥${numeric.toLocaleString('ja-JP')}`;
  return '価格未登録';
}

function getPriceNumber(product: Product) {
  const value = product.price_yen;
  if (value === null || value === undefined || value === '') return Number.POSITIVE_INFINITY;
  const numeric = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
}

function getWeightNumber(product: Product) {
  const numeric = Number(String(product.weight_kg ?? product.weight ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function escapeText(value: string) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function escapeAttr(value: string) {
  return escapeText(value).replace(/"/g, '&quot;');
}
