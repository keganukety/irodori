import './styles.css';
import { supabase } from './lib/supabase';
import {
  clearCompareIds,
  extractImageSrc,
  formatPrice,
  loadCompareProductIds,
  applyFadeUpAnimations,
  mountCommonHeader,
  normalizeProductDisplayName,
  normalizeProductId,
  removeCompareId,
  saveCompareIds,
} from './shared-ui';

type Product = {
  id: string | number;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  price_yen?: string | number | null;
  feature_tags?: string[] | string | null;
  tags?: string[] | string | null;
  product_type?: string | null;
  type?: string | null;
  target_age_text?: string | null;
  weight_kg?: string | number | null;
  weight?: string | number | null;
  weight_note?: string | null;
  target_age?: string | null;
  product_size?: string | null;
  size_text?: string | null;
  size?: string | null;
  dimensions?: string | null;
  product_dimensions?: string | null;
  waist_size_text?: string | null;
  length_cm?: string | number | null;
  depth_cm?: string | number | null;
  width_cm?: string | number | null;
  height_cm?: string | number | null;
  folded_size?: string | null;
  folding_size?: string | null;
  storage_position?: string | null;
  folded_length_cm?: string | number | null;
  folded_depth_cm?: string | number | null;
  folded_width_cm?: string | number | null;
  folded_height_cm?: string | number | null;
  load_capacity?: string | number | null;
  max_weight_kg?: string | number | null;
  load_capacity_kg?: string | number | null;
  max_load?: string | number | null;
  max_weight?: string | number | null;
  washable?: string | null;
  washing?: string | null;
  washable_text?: string | null;
  features?: Record<string, unknown> | string | null;
  basket_capacity?: string | null;
  shopping_basket?: string | null;
  basket?: string | null;
  rakuten_url?: string | null;
  amazon_url?: string | null;
  yahoo_url?: string | null;
  official_url?: string | null;
  official_page_url?: string | null;
  [key: string]: unknown;
};

type ProductImage = {
  product_id: string | number;
  rakuten_image_html?: string | null;
  is_primary?: boolean | null;
  display_order?: number | null;
};

type CompareRow = {
  label: string;
  getValue: (product: Product) => string;
};

const appElement = document.querySelector<HTMLDivElement>('#compare-app');

if (!appElement) {
  throw new Error('#compare-app が見つかりません。');
}

const app: HTMLDivElement = appElement;

mountCommonHeader('compare');
injectCompareStyles();

void initializeComparePage();

async function initializeComparePage(): Promise<void> {
  renderLoading();

  try {
    const selectedIds: string[] = loadCompareProductIds();

    const { data: products, error: productsError } = await supabase.from('products').select('*');

    if (productsError) {
      throw productsError;
    }

    const { data: images, error: imagesError } = await supabase
      .from('product_affiliate_images')
      .select('product_id, rakuten_image_html, is_primary, display_order')
      .eq('media_type', 'image')
      .order('display_order', { ascending: true });

    if (imagesError) {
      console.error('比較商品の画像取得に失敗しました。', imagesError);
    }

    const productList = Array.isArray(products) ? (products as Product[]) : [];
    const availableIds = new Set(productList.map((product) => normalizeProductId(product.id)));
    const validIds = selectedIds.filter((id) => availableIds.has(id));

    if (validIds.length !== selectedIds.length) {
      saveCompareIds(validIds);
    }

    const productMap = new Map(productList.map((product) => [normalizeProductId(product.id), product]));
    const selectedProducts = validIds
      .map((id) => productMap.get(id))
      .filter((product): product is Product => Boolean(product));

    if (import.meta.env.DEV) {
      console.log('比較ID件数:', selectedIds.length);
      console.log('取得商品件数:', productList.length);
      console.log('照合商品件数:', selectedProducts.length);
    }

    const imageMap = createImageMap((images ?? []) as ProductImage[]);

    renderComparePage(selectedProducts, imageMap);
  } catch (error) {
    console.error('比較ページの読み込みに失敗しました。', error);
    app.innerHTML = `
      <main class="compare-page">
        <section class="compare-empty">
          <h1>商品比較</h1>
          <p>比較情報を読み込めませんでした。時間を置いてもう一度お試しください。</p>
          <a href="/products.html">商品一覧へ戻る</a>
        </section>
      </main>
    `;
  }
}

function renderLoading(): void {
  app.innerHTML = `
    <main class="compare-page">
      <section class="compare-empty">
        <h1>商品比較</h1>
        <p>比較する商品を読み込んでいます...</p>
      </section>
    </main>
  `;
}

function renderComparePage(products: Product[], imageMap: Map<string, string>): void {
  const category = getCompareCategory(products);
  app.innerHTML = `
    <main class="compare-page">
      <section class="compare-hero">
        <p class="compare-hero__eyebrow">COMPARE</p>
        <h1>商品比較</h1>
        <p>${escapeHtml(getCompareHeroCopy(category))}</p>
        ${category === 'ベビーカー' ? '<a class="compare-hero__guide-link" href="/stroller-guide.html">ベビーカーの選び方を見る</a>' : ''}
      </section>
      ${renderCompareNotice(products.length)}
      ${products.length > 0 ? renderCompareTable(products, imageMap, category) : renderEmptyState()}
    </main>
  `;

  app.querySelectorAll<HTMLElement>('[data-remove-compare-id]').forEach((button) => {
    button.addEventListener('click', (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      removeCompareId(button.dataset.removeCompareId);
      void initializeComparePage();
    });
  });

  const clearButton = app.querySelector<HTMLButtonElement>('[data-clear-compare-page]');
  clearButton?.addEventListener('click', (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    clearCompareIds();
    void initializeComparePage();
  });

  const addProductButton = app.querySelector<HTMLAnchorElement>('[data-add-compare-product]');
  addProductButton?.addEventListener('click', (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (import.meta.env.DEV) {
      console.log('一覧へ戻る直前の比較ID:', loadCompareProductIds());
    }

    window.location.assign('/products.html');
  });

  applyFadeUpAnimations(app);
}

function renderCompareNotice(count: number): string {
  const message =
    count === 0
      ? '比較する商品が選択されていません。'
      : count === 1
        ? '比較するには2件以上の商品を選択してください。'
        : `${count}件の商品を比較中です。`;

  return `
    <div class="compare-notice">
      <p>${escapeHtml(message)}</p>
      <div class="compare-notice__actions">
        <a href="/products.html" data-add-compare-product>商品を追加する</a>
        <button type="button" data-clear-compare-page>すべて解除</button>
      </div>
    </div>
  `;
}

function renderEmptyState(): string {
  return `
    <section class="compare-empty">
      <h2>比較する商品がありません</h2>
      <p>商品一覧で「比較する」を選ぶと、このページに比較表が表示されます。</p>
      <a href="/products.html">商品一覧へ戻る</a>
    </section>
  `;
}

function renderCompareTable(products: Product[], imageMap: Map<string, string>, category: string): string {
  const rows = getCompareRows(category);

  return `
    <section class="compare-table-section" aria-label="商品比較表">
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th class="compare-table__label">項目</th>
              ${products.map((product) => renderProductHeader(product, imageMap)).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr class="${row.label === '価格' ? 'compare-table__price-row' : ''}">
                    <th class="compare-table__label">${escapeHtml(row.label)}</th>
                    ${products
                      .map((product) => `<td class="${row.label === '価格' ? 'compare-table__price' : ''}">${escapeHtml(row.getValue(product) || '—')}</td>`)
                      .join('')}
                  </tr>
                `,
              )
              .join('')}
            <tr>
              <th class="compare-table__label">商品詳細</th>
              ${products
                .map(
                  (product) => `
                    <td>
                      <a class="compare-detail-link" href="/product.html?id=${encodeURIComponent(
                        normalizeProductId(product.id),
                      )}">商品詳細を見る →</a>
                    </td>
                  `,
                )
                .join('')}
            </tr>
            <tr>
              <th class="compare-table__label">購入先</th>
              ${products.map((product) => `<td>${renderMallLinks(product)}</td>`).join('')}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderProductHeader(product: Product, imageMap: Map<string, string>): string {
  const productId = normalizeProductId(product.id);
  const imageSrc = imageMap.get(productId);

  return `
    <th class="compare-product">
      <div class="compare-product-image-wrap">
        <button
          type="button"
          class="compare-remove-button"
          data-remove-compare-id="${escapeAttr(productId)}"
          aria-label="${escapeAttr(getProductName(product))}を比較から外す"
        >
          ×
        </button>
        <a class="compare-product__image" href="/product.html?id=${encodeURIComponent(productId)}">
          ${
            imageSrc
              ? `<img src="${escapeAttr(imageSrc)}" alt="${escapeAttr(getProductName(product))}" loading="lazy">`
              : '<span>画像準備中</span>'
          }
        </a>
      </div>
      <p class="compare-product__brand">${escapeHtml(getText(product.brand))}</p>
      <a class="compare-product__name" href="/product.html?id=${encodeURIComponent(productId)}">
        ${escapeHtml(getProductName(product))}
      </a>
      <p class="compare-product__price">${escapeHtml(formatPrice(product.price_yen))}</p>
    </th>
  `;
}

function getCompareRows(category = ''): CompareRow[] {
  if (category === 'ヒップシート') {
    return [
      { label: 'タイプ', getValue: getHipseatType },
      { label: '対象月齢', getValue: (product) => firstValue(product.target_age, product.target_age_text) },
      { label: '耐荷重', getValue: getHipseatLoadCapacity },
      { label: '本体重量', getValue: (product) => formatWeight(firstValue(product.weight_kg, product.weight)) },
      { label: 'サイズ', getValue: getHipseatSize },
      { label: 'ウエストサイズ', getValue: getHipseatWaistSize },
      { label: '装着タイプ', getValue: getHipseatWearType },
      { label: '肩掛け対応', getValue: (product) => getHipseatSupport(product, /肩掛け|ショルダー|肩ベルト/) },
      { label: '腰ベルト対応', getValue: (product) => getHipseatSupport(product, /腰ベルト/) },
      { label: 'バッグ型', getValue: (product) => getHipseatSupport(product, /バッグ型|バッグ/) },
      { label: '収納ポケット', getValue: (product) => getHipseatSupport(product, /収納|ポケット/) },
      { label: '座面すべり止め', getValue: (product) => firstValue(product.seat_non_slip, product.non_slip_seat) },
      { label: '背あて', getValue: (product) => firstValue(product.back_support, product.backrest) },
      { label: '洗濯可否', getValue: getHipseatWashable },
      { label: '折りたたみ', getValue: (product) => firstValue(product.foldable, product.folded_size) },
      { label: '向いているシーン', getValue: getHipseatScenes },
      { label: '補足メモ', getValue: getHipseatNote },
    ];
  }

  return [
    { label: '商品名', getValue: getProductName },
    { label: 'ブランド', getValue: (product) => getText(product.brand) },
    { label: '価格', getValue: (product) => formatPrice(product.price_yen) },
    { label: '商品タイプ', getValue: (product) => firstValue(product.product_type, product.type) },
    { label: '重量', getValue: (product) => formatWeight(firstValue(product.weight_kg, product.weight)) },
    { label: '対象月齢', getValue: (product) => firstValue(product.target_age) },
    {
      label: '製品サイズ',
      getValue: (product) =>
        firstValue(product.product_size, product.size, product.dimensions, product.product_dimensions) ||
        formatDimensions(product.length_cm ?? product.depth_cm, product.width_cm, product.height_cm),
    },
    {
      label: '収納サイズ',
      getValue: (product) =>
        firstValue(product.folded_size, product.folding_size, product.storage_position) ||
        formatDimensions(product.folded_length_cm ?? product.folded_depth_cm, product.folded_width_cm, product.folded_height_cm),
    },
    {
      label: '耐荷重',
      getValue: (product) => firstValue(product.load_capacity, product.max_load, product.max_weight),
    },
    {
      label: 'バスケット容量',
      getValue: (product) => firstValue(product.basket_capacity, product.shopping_basket, product.basket),
    },
  ];
}

function getCompareCategory(products: Product[]): string {
  const categories = products.map(getProductCategory).filter(Boolean);
  const firstCategory = categories[0] ?? '';
  return categories.length > 0 && categories.every((category) => category === firstCategory) ? firstCategory : '';
}

function getProductCategory(product: Product): string {
  const category = firstValue(product.category);
  if (/hip\s*seat|hipseat|ヒップシート/i.test(category) || firstValue(product.product_type) === 'hipseat') return 'ヒップシート';
  if (/抱っこ紐|抱っこひも|carrier/i.test(category)) return '抱っこ紐';
  if (/チャイルドシート|car\s*seat|carseat/i.test(category)) return 'チャイルドシート';
  if (/ベビーカー|stroller|babycar/i.test(category)) return 'ベビーカー';
  return category;
}

function getCompareHeroCopy(category: string): string {
  if (category === 'ヒップシート') {
    return '気になるヒップシートを横並びで比べられます。軽さ・安定感・収納力などを見ながら選べます。';
  }
  return '気になるベビーカーを横並びで比べられます。2〜4商品を選んで比較してください。';
}

function getHipseatType(product: Product): string {
  const explicit = firstValue(product.type);
  if (explicit) return explicit;
  const tags = getCompareTags(product).join(' ');
  if (/バッグ型|バッグ/.test(tags)) return 'バッグ型';
  if (/肩掛け|ショルダー|肩ベルト/.test(tags)) return '肩掛けタイプ';
  if (/腰ベルト/.test(tags)) return '腰ベルト型';
  return firstValue(product.product_type) === 'hipseat' ? 'ヒップシート' : firstValue(product.product_type);
}

function getHipseatWearType(product: Product): string {
  const tags = getHipseatComparableText(product);
  const types = [
    /肩掛け|ショルダー|肩ベルト/.test(tags) ? '肩掛け' : '',
    /腰ベルト/.test(tags) ? '腰ベルト' : '',
    /バッグ型|バッグ/.test(tags) ? 'バッグ型' : '',
  ].filter(Boolean);
  return types.join(' / ');
}

function getHipseatSupport(product: Product, pattern: RegExp): string {
  return pattern.test(getHipseatComparableText(product)) ? '対応' : '';
}

function getHipseatLoadCapacity(product: Product): string {
  const explicit = firstValue(product.load_capacity, product.max_load, product.max_weight);
  if (explicit) return explicit;
  const numeric = firstValue(product.max_weight_kg, product.load_capacity_kg);
  return numeric ? formatWeight(numeric) : '';
}

function getHipseatSize(product: Product): string {
  return firstValue(product.product_size, product.size_text, product.size, product.dimensions, product.product_dimensions)
    || formatDimensions(product.length_cm ?? product.depth_cm, product.width_cm, product.height_cm);
}

function getHipseatWaistSize(product: Product): string {
  return firstValue(product.waist_size_text) || getCompareFeatureValue(product, ['waist_size', 'waist_size_text']);
}

function getHipseatWashable(product: Product): string {
  const explicit = firstValue(product.washable, product.washing, product.washable_text);
  if (explicit) return explicit;
  return getCompareFeatureValue(product, ['washable', 'washing', 'washable_text']);
}

function getHipseatScenes(product: Product): string {
  const tags = getCompareTags(product);
  return tags.filter((tag) => /ワンオペ|保育園送迎|旅行|お出かけ|短時間抱っこ|持ち歩き|はじめて/.test(tag)).join(' / ');
}

function getHipseatNote(product: Product): string {
  return firstValue(product.weight_note)
    || getCompareFeatureValue(product, ['weight_note', 'price_note', 'note']);
}

function getHipseatComparableText(product: Product): string {
  const features = parseCompareFeatureObject(product.features);
  return [
    product.type,
    product.product_type,
    ...getCompareTags(product),
    ...Object.values(features).map((value) => String(value)),
  ].filter(Boolean).join(' ');
}

function getCompareTags(product: Product): string[] {
  const value = product.feature_tags ?? product.tags;
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
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

function getCompareFeatureValue(product: Product, keys: string[]): string {
  const features = parseCompareFeatureObject(product.features);
  for (const key of keys) {
    const value = features[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? '可' : '不可';
  }
  return '';
}

function parseCompareFeatureObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function renderMallLinks(product: Product): string {
  const links = [
    { label: '楽天', href: product.rakuten_url },
    { label: 'Amazon', href: product.amazon_url },
    { label: 'Yahoo!', href: product.yahoo_url },
    { label: '公式', href: product.official_url ?? product.official_page_url },
  ].filter((link) => isPresent(link.href));

  if (links.length === 0) {
    return '—';
  }

  return `
    <div class="compare-mall-links">
      ${links
        .map(
          (link) =>
            `<a href="${escapeAttr(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
              link.label,
            )}</a>`,
        )
        .join('')}
    </div>
  `;
}

function createImageMap(images: ProductImage[]): Map<string, string> {
  const groupedImages = new Map<string, ProductImage[]>();

  images.forEach((image) => {
    const productId = normalizeProductId(image.product_id);
    if (!productId) {
      return;
    }

    const list = groupedImages.get(productId) ?? [];
    list.push(image);
    groupedImages.set(productId, list);
  });

  const imageMap = new Map<string, string>();

  groupedImages.forEach((productImages, productId) => {
    const sortedImages = [...productImages].sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999));
    const primaryImage = sortedImages.find((image) => image.is_primary) ?? sortedImages[0];
    const imageSrc = extractImageSrc(primaryImage?.rakuten_image_html);

    if (imageSrc) {
      imageMap.set(productId, imageSrc);
    }
  });

  return imageMap;
}

function getProductName(product: Product): string {
  const fallback = firstValue(product.name) || `商品ID ${normalizeProductId(product.id)}`;
  return normalizeProductDisplayName(product, fallback) || fallback;
}

function firstValue(...values: unknown[]): string {
  const value = values.find(isPresent);
  return value === undefined ? '' : String(value).trim();
}

function getText(value: unknown): string {
  return isPresent(value) ? String(value).trim() : '—';
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  const text = String(value).trim();
  return text !== '' && text !== '-' && text !== '不明' && text !== '未登録';
}

function formatWeight(value: string): string {
  if (!value) {
    return '';
  }

  return /kg/i.test(value) ? value : `${value}kg`;
}

function formatDimensions(length: unknown, width: unknown, height: unknown): string {
  if (!isPresent(length) || !isPresent(width) || !isPresent(height)) {
    return '';
  }

  return `長さ${length}cm × 幅${width}cm × 高さ${height}cm`;
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

function injectCompareStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
    body {
      background: #fff;
    }

    .compare-page {
      width: min(1280px, calc(100% - 40px));
      margin: 0 auto;
      padding: 48px 0 120px;
      color: #26231f;
    }

    .compare-hero {
      text-align: center;
      margin-bottom: 32px;
    }

    .compare-hero__eyebrow {
      margin: 0 0 8px;
      color: #333;
      font-size: clamp(28px, 3vw, 36px);
      font-weight: 400;
      letter-spacing: .08em;
    }

    .compare-hero h1 {
      margin: 0;
      font-size: clamp(28px, 5vw, 44px);
      letter-spacing: .03em;
    }

    .compare-hero p:last-child {
      margin: 14px auto 0;
      max-width: 620px;
      color: #6d675f;
      line-height: 1.8;
    }

    .compare-hero__guide-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 32px;
      margin-top: 18px;
      padding: 8px 20px;
      border: 1px solid #dadada;
      background: #fff;
      color: #333;
      font-size: 12px;
      font-weight: 400;
      letter-spacing: 1px;
      text-decoration: none;
      transition: border-color .2s ease, opacity .2s ease;
    }

    .compare-hero__guide-link:hover,
    .compare-hero__guide-link:focus-visible {
      border-color: #333;
      opacity: .82;
    }

    .compare-notice {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      padding: 16px 0;
      border-top: 1px solid #ebe7df;
      border-bottom: 1px solid #ebe7df;
      margin-bottom: 28px;
    }

    .compare-notice p {
      margin: 0;
      font-weight: 600;
    }

    .compare-notice__actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .compare-notice a,
    .compare-notice button,
    .compare-empty a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0 18px;
      border: 1px solid #b8b3aa;
      background: #fff;
      color: #272420;
      text-decoration: none;
      font: inherit;
      cursor: pointer;
    }

    .compare-table-wrap {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .compare-table {
      width: 100%;
      min-width: 760px;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .compare-table th,
    .compare-table td {
      padding: 18px;
      border-bottom: 1px solid #e7e2d9;
      vertical-align: top;
      text-align: left;
      background: #fff;
      overflow-wrap: anywhere;
    }

    .compare-table__label {
      position: sticky;
      left: 0;
      z-index: 1;
      width: 160px;
      color: #6f695f;
      font-weight: 600;
      background: #fff;
    }

    .compare-product {
      min-width: 220px;
    }

    .compare-product-image-wrap {
      position: relative;
      margin-bottom: 14px;
    }

    .compare-product__image {
      display: flex;
      align-items: center;
      justify-content: center;
      aspect-ratio: 1 / 1;
      border-radius: 18px;
      background: #fff;
      overflow: hidden;
      color: #928b80;
      text-decoration: none;
    }

    .compare-product__image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: inherit;
      background: transparent;
    }

    .compare-product__brand {
      margin: 0 0 6px;
      color: #8a8377;
      font-size: 13px;
      font-weight: 400;
    }

    .compare-product__name {
      display: block;
      color: #26231f;
      text-decoration: none;
      font-size: 16px;
      line-height: 1.55;
      font-weight: 600;
    }

    .compare-product__price {
      margin: 10px 0 12px;
      font-size: 16px;
      font-weight: 600;
    }

    .compare-remove-button {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 2;
      width: 38px;
      height: 38px;
      border: 1px solid #ded8ce;
      border-radius: 999px;
      background: rgba(255, 255, 255, .96);
      color: #3d3933;
      box-shadow: 0 6px 16px rgba(30, 30, 30, .08);
      font: inherit;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
    }

    .compare-remove-button:hover,
    .compare-remove-button:focus-visible {
      background: #f6f3ed;
      border-color: #c7bfb3;
    }

    .compare-detail-link {
      color: #333;
      font-size: 12px;
      font-weight: 400;
      letter-spacing: .04em;
      text-decoration: none;
      text-underline-offset: 5px;
    }

    .compare-detail-link:hover,
    .compare-detail-link:focus-visible {
      opacity: .72;
      text-decoration: underline;
    }

    .compare-mall-links {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .compare-mall-links a {
      color: #5f574d;
      font-size: 13px;
      text-underline-offset: 5px;
    }

    .compare-empty {
      max-width: 680px;
      margin: 56px auto;
      text-align: center;
    }

    .compare-empty p {
      color: #6f695f;
      line-height: 1.8;
    }

    @media (max-width: 760px) {
      .compare-page {
        width: min(100% - 28px, 1280px);
        padding-top: 36px;
      }

      .compare-notice {
        align-items: flex-start;
        flex-direction: column;
      }

      .compare-table {
        min-width: 680px;
      }

      .compare-table th,
      .compare-table td {
        padding: 14px;
      }

      .compare-hero__eyebrow {
        font-size: clamp(24px, 8vw, 28px);
      }
    }
  `;

  document.head.append(style);
}
