import './admin.css';
import './affiliateAdmin.css';
import { supabase } from './lib/supabase';
import type { AdminProduct as Product, ProductAffiliateImage, ProductUploadedImage } from './types';
import { normalizeProductDisplayBrand, normalizeProductDisplayName } from './shared-ui';

const appElement = document.querySelector<HTMLDivElement>('#affiliate-admin-app');

if (!appElement) {
  throw new Error('#affiliate-admin-app was not found.');
}

const app: HTMLDivElement = appElement;
const managedCategories = ['ベビーカー', '抱っこ紐', 'チャイルドシート', 'ヒップシート'] as const;
const urlFields = ['official_url', 'amazon_url', 'rakuten_url', 'yahoo_url'] as const;

type ManagedCategory = (typeof managedCategories)[number];
type CategoryFilter = 'all' | ManagedCategory;
type MissingFilter = 'all' | 'any' | 'official' | 'amazon' | 'rakuten' | 'yahoo';
type UrlField = (typeof urlFields)[number];

type ProductRowValues = {
  product_name: string;
  official_url: string;
  amazon_url: string;
  rakuten_url: string;
  yahoo_url: string;
  affiliate_checked_at: string;
  affiliate_note: string;
};

type AffiliateImage = Pick<ProductAffiliateImage, 'product_id' | 'rakuten_image_html' | 'image_url' | 'is_primary' | 'display_order' | 'sort_order'>;
type UploadedImage = Pick<ProductUploadedImage, 'product_id' | 'public_url' | 'is_primary' | 'display_order'>;

let products: Product[] = [];
let affiliateImages: AffiliateImage[] = [];
let uploadedImages: UploadedImage[] = [];
let imageByProductId = new Map<string, string>();
let query = '';
let categoryFilter: CategoryFilter = 'all';
let brandFilter = 'all';
let missingFilter: MissingFilter = 'all';
let rowMessages = new Map<string, { text: string; tone: 'success' | 'error' | 'muted' }>();
let savingIds = new Set<string>();

void init();

async function init(): Promise<void> {
  supabase.auth.onAuthStateChange(() => {
    void render();
  });

  await render();
}

async function render(): Promise<void> {
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    renderLogin();
    return;
  }

  if (!(await checkAdmin())) {
    renderForbidden();
    return;
  }

  await renderAdmin();
}

function renderLogin(): void {
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-panel">
        <h1>アフィリエイトURL管理</h1>
        <p>管理者アカウントでログインしてください。</p>
        <form id="login-form" class="auth-form">
          <label>メールアドレス<input name="email" type="email" required autocomplete="email" /></label>
          <label>パスワード<input name="password" type="password" required autocomplete="current-password" /></label>
          <button type="submit">ログイン</button>
        </form>
        <p id="login-message" class="message" aria-live="polite"></p>
      </section>
    </main>
  `;

  document.querySelector<HTMLFormElement>('#login-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const values = new FormData(form);
    const message = document.querySelector<HTMLElement>('#login-message');
    const { error } = await supabase.auth.signInWithPassword({
      email: String(values.get('email') ?? ''),
      password: String(values.get('password') ?? ''),
    });

    if (error && message) {
      message.textContent = error.message;
      return;
    }

    await render();
  });
}

function renderForbidden(): void {
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-panel">
        <h1>アクセスできません</h1>
        <p>この管理画面を利用できる管理者権限がありません。</p>
        <button id="logout-button" type="button">ログアウト</button>
      </section>
    </main>
  `;
  bindLogout();
}

async function checkAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) {
    console.error(error);
    return false;
  }
  return data === true;
}

async function renderAdmin(): Promise<void> {
  app.innerHTML = `
    <header class="admin-header">
      <div>
        <h1>アフィリエイトURL管理</h1>
        <p>商品ごとに公式・Amazon・楽天・YahooのURLを管理します。</p>
      </div>
      <div class="header-actions">
        <a href="/admin.html">商品画像管理</a>
        <a href="/assets-admin.html">素材管理</a>
        <button id="logout-button" type="button">ログアウト</button>
      </div>
    </header>
    <main class="admin-main affiliate-admin-main">
      <section class="affiliate-toolbar" aria-label="絞り込み">
        <label class="affiliate-search">商品名検索<input id="search-input" type="search" value="${escapeAttr(query)}" placeholder="商品名 / ブランド / ID" /></label>
        <label>カテゴリ<select id="category-filter">${renderCategoryOptions()}</select></label>
        <label>ブランド<select id="brand-filter">${renderBrandOptions()}</select></label>
        <label>未登録<select id="missing-filter">${renderMissingOptions()}</select></label>
      </section>
      <section class="affiliate-actions">
        <p id="page-status" class="status-message" aria-live="polite">読み込み中...</p>
        <button id="save-changed-button" type="button">変更がある行を一括保存</button>
      </section>
      <section id="affiliate-list" class="affiliate-list"></section>
    </main>
  `;

  bindLogout();
  bindFilters();
  bindBulkSave();

  try {
    await loadData();
    syncFilterOptions();
    renderList();
  } catch (error) {
    showPageStatus(getErrorMessage(error), 'error');
  }
}

async function loadData(): Promise<void> {
  const [productResult, affiliateImageResult, uploadedImageResult] = await Promise.all([
    // products本体は管理者専用RPC経由で取得する(直接SELECT権限はrevoke済み)。
    supabase.rpc('list_products'),
    supabase
      .from('product_affiliate_images')
      .select('product_id, rakuten_image_html, image_url, is_primary, display_order, sort_order')
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true }),
    supabase
      .from('product_uploaded_images')
      .select('product_id, public_url, is_primary, display_order')
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true }),
  ]);

  if (productResult.error) throw productResult.error;
  if (affiliateImageResult.error) throw affiliateImageResult.error;
  if (uploadedImageResult.error) throw uploadedImageResult.error;

  products = (productResult.data ?? []) as Product[];
  affiliateImages = (affiliateImageResult.data ?? []) as AffiliateImage[];
  uploadedImages = (uploadedImageResult.data ?? []) as UploadedImage[];
  imageByProductId = createImageMap(affiliateImages, uploadedImages);
}

function renderList(): void {
  const list = document.querySelector<HTMLElement>('#affiliate-list');
  if (!list) return;

  const visibleProducts = getVisibleProducts();
  showPageStatus(`${visibleProducts.length}件を表示中`, 'muted');

  if (visibleProducts.length === 0) {
    list.innerHTML = '<div class="affiliate-empty">条件に合う商品がありません。</div>';
    return;
  }

  list.innerHTML = `
    <div class="affiliate-table" role="table" aria-label="商品別アフィリエイトURL">
      <div class="affiliate-table-head" role="row">
        <span>商品</span>
        <span>公式URL</span>
        <span>Amazon URL</span>
        <span>楽天 URL</span>
        <span>Yahoo URL</span>
        <span>確認日 / メモ</span>
        <span>保存</span>
      </div>
      ${visibleProducts.map(renderProductRow).join('')}
    </div>
  `;

  bindRows();
}

function renderProductRow(product: Product): string {
  const productId = getProductId(product);
  const values = getRowValues(product);
  const imageUrl = imageByProductId.get(productId) ?? '';
  const message = rowMessages.get(productId);
  const brand = getBrand(product);
  const name = values.product_name || getProductName(product);
  const category = getCategory(product);
  const rank = firstText(product, ['rank_no']) || '-';
  const status = getUrlStatus(values);
  const isSaving = savingIds.has(productId);

  return `
    <article class="affiliate-row" data-product-id="${escapeAttr(productId)}" role="row">
      <div class="affiliate-product-cell">
        <div class="affiliate-thumb">${imageUrl ? `<img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(name)}" loading="lazy">` : '<span>画像準備中</span>'}</div>
        <div>
          <p class="affiliate-brand">${escapeText(brand)}</p>
          <label class="affiliate-name-field">商品名
            <input data-field="product_name" type="text" value="${escapeAttr(name)}" />
          </label>
          <div class="url-actions affiliate-name-actions">
            <button type="button" data-copy-product-name>商品名をコピー</button>
          </div>
          <p class="affiliate-meta">${escapeText(category)} / rank ${escapeText(rank)}</p>
          <p class="affiliate-url-status">${escapeText(status)}</p>
        </div>
      </div>
      ${renderUrlField('official_url', '公式URL', values.official_url)}
      ${renderUrlField('amazon_url', 'Amazon URL', values.amazon_url)}
      ${renderUrlField('rakuten_url', '楽天 URL', values.rakuten_url)}
      ${renderUrlField('yahoo_url', 'Yahoo URL', values.yahoo_url)}
      <div class="affiliate-note-cell">
        <label>最終確認日<input data-field="affiliate_checked_at" type="date" value="${escapeAttr(values.affiliate_checked_at)}"></label>
        <label>メモ<textarea data-field="affiliate_note" rows="3">${escapeText(values.affiliate_note)}</textarea></label>
      </div>
      <div class="affiliate-save-cell">
        <button type="button" data-save-row ${isSaving ? 'disabled' : ''}>${isSaving ? '保存中...' : '保存'}</button>
        <p class="row-message ${message ? `is-${message.tone}` : ''}" aria-live="polite">${message ? escapeText(message.text) : ''}</p>
      </div>
    </article>
  `;
}

function renderUrlField(field: UrlField, label: string, value: string): string {
  return `
    <div class="affiliate-url-cell">
      <label>${escapeText(label)}<input data-field="${field}" type="url" value="${escapeAttr(value)}" placeholder="https://..." /></label>
      <p class="field-error" data-error-for="${field}"></p>
      <div class="url-actions">
        <button type="button" data-open-url="${field}" ${value ? '' : 'disabled'}>開く</button>
        <button type="button" data-copy-url="${field}" ${value ? '' : 'disabled'}>コピー</button>
      </div>
    </div>
  `;
}

function bindFilters(): void {
  document.querySelector<HTMLInputElement>('#search-input')?.addEventListener('input', (event) => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    query = input.value;
    renderList();
  });
  document.querySelector<HTMLSelectElement>('#category-filter')?.addEventListener('change', (event) => {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    categoryFilter = select.value as CategoryFilter;
    renderList();
  });
  document.querySelector<HTMLSelectElement>('#brand-filter')?.addEventListener('change', (event) => {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    brandFilter = select.value;
    renderList();
  });
  document.querySelector<HTMLSelectElement>('#missing-filter')?.addEventListener('change', (event) => {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    missingFilter = select.value as MissingFilter;
    renderList();
  });
}

function bindRows(): void {
  document.querySelectorAll<HTMLElement>('.affiliate-row').forEach((row) => {
    row.querySelector<HTMLButtonElement>('[data-save-row]')?.addEventListener('click', () => {
      void saveRow(row);
    });

    row.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-field]').forEach((input) => {
      input.addEventListener('input', () => {
        row.classList.add('is-dirty');
        updateUrlButtons(row);
        validateRow(row, false);
      });
    });

    row.querySelector<HTMLButtonElement>('[data-copy-product-name]')?.addEventListener('click', async () => {
      const name = getRowFieldValue(row, 'product_name');
      if (!name) return;
      await navigator.clipboard.writeText(name);
      setRowMessage(row, '商品名をコピーしました。', 'success');
    });

    row.querySelectorAll<HTMLButtonElement>('[data-open-url]').forEach((button) => {
      button.addEventListener('click', () => {
        const url = getRowFieldValue(row, button.dataset.openUrl ?? '');
        if (isValidUrlValue(url)) window.open(url, '_blank', 'noopener,noreferrer');
      });
    });

    row.querySelectorAll<HTMLButtonElement>('[data-copy-url]').forEach((button) => {
      button.addEventListener('click', async () => {
        const url = getRowFieldValue(row, button.dataset.copyUrl ?? '');
        if (!url) return;
        await navigator.clipboard.writeText(url);
        setRowMessage(row, 'コピーしました。', 'success');
      });
    });
  });
}

function bindBulkSave(): void {
  document.querySelector<HTMLButtonElement>('#save-changed-button')?.addEventListener('click', async () => {
    const dirtyRows = [...document.querySelectorAll<HTMLElement>('.affiliate-row.is-dirty')];
    if (dirtyRows.length === 0) {
      showPageStatus('変更がある行はありません。', 'muted');
      return;
    }

    let savedCount = 0;
    for (const row of dirtyRows) {
      if (await saveRow(row, false)) savedCount += 1;
    }
    showPageStatus(`${savedCount}件を保存しました。`, savedCount === dirtyRows.length ? 'success' : 'error');
  });
}

function syncFilterOptions(): void {
  const brandSelect = document.querySelector<HTMLSelectElement>('#brand-filter');
  if (brandSelect) brandSelect.innerHTML = renderBrandOptions();
}

async function saveRow(row: HTMLElement, rerender = true): Promise<boolean> {
  const productId = row.dataset.productId ?? '';
  const values = getValuesFromRow(row);
  rowMessages.delete(productId);

  if (!validateRow(row, true)) {
    setRowMessage(row, 'URLを確認してください。', 'error');
    return false;
  }

  savingIds.add(productId);
  setRowMessage(row, '保存中...', 'muted');

  const { error } = await supabase.rpc('update_product_affiliate_urls', {
    p_product_id: productId,
    p_product_name: values.product_name || null,
    p_official_url: values.official_url || null,
    p_amazon_url: values.amazon_url || null,
    p_rakuten_url: values.rakuten_url || null,
    p_yahoo_url: values.yahoo_url || null,
    p_affiliate_checked_at: values.affiliate_checked_at || null,
    p_affiliate_note: values.affiliate_note || null,
  });

  savingIds.delete(productId);

  if (error) {
    setRowMessage(row, getErrorMessage(error), 'error');
    return false;
  }

  const product = products.find((item) => getProductId(item) === productId);
  if (product) {
    Object.assign(product, values, {
      name: values.product_name,
      product_name: values.product_name,
      title: values.product_name,
    });
  }
  row.classList.remove('is-dirty');
  setRowMessage(row, '保存しました。', 'success');
  if (rerender) renderList();
  return true;
}

function validateRow(row: HTMLElement, showErrors: boolean): boolean {
  let valid = true;
  for (const field of urlFields) {
    const value = getRowFieldValue(row, field);
    const error = getUrlError(value);
    const errorElement = row.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
    if (showErrors && errorElement) errorElement.textContent = error;
    if (error) valid = false;
  }
  return valid;
}

function updateUrlButtons(row: HTMLElement): void {
  for (const field of urlFields) {
    const hasUrl = Boolean(getRowFieldValue(row, field));
    row.querySelectorAll<HTMLButtonElement>(`[data-open-url="${field}"], [data-copy-url="${field}"]`).forEach((button) => {
      button.disabled = !hasUrl;
    });
  }
}

function getVisibleProducts(): Product[] {
  const normalizedQuery = query.trim().toLowerCase();
  return products.filter((product) => {
    const values = getRowValues(product);
    if (categoryFilter !== 'all' && getCategory(product) !== categoryFilter) return false;
    if (brandFilter !== 'all' && getBrand(product) !== brandFilter) return false;
    if (missingFilter !== 'all' && !matchesMissingFilter(values)) return false;
    if (!normalizedQuery) return true;
  return [
      getProductId(product),
      getRowValues(product).product_name || getProductName(product),
      getBrand(product),
      getCategory(product),
    ].join(' ').toLowerCase().includes(normalizedQuery);
  });
}

function matchesMissingFilter(values: ProductRowValues): boolean {
  if (missingFilter === 'any') return urlFields.some((field) => !values[field]);
  if (missingFilter === 'official') return !values.official_url;
  if (missingFilter === 'amazon') return !values.amazon_url;
  if (missingFilter === 'rakuten') return !values.rakuten_url;
  if (missingFilter === 'yahoo') return !values.yahoo_url;
  return true;
}

function renderCategoryOptions(): string {
  return [
    `<option value="all" ${categoryFilter === 'all' ? 'selected' : ''}>すべて</option>`,
    ...managedCategories.map((category) => `<option value="${escapeAttr(category)}" ${categoryFilter === category ? 'selected' : ''}>${escapeText(category)}</option>`),
  ].join('');
}

function renderBrandOptions(): string {
  const brands = [...new Set(products.map(getBrand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'));
  return [
    `<option value="all" ${brandFilter === 'all' ? 'selected' : ''}>すべて</option>`,
    ...brands.map((brand) => `<option value="${escapeAttr(brand)}" ${brandFilter === brand ? 'selected' : ''}>${escapeText(brand)}</option>`),
  ].join('');
}

function renderMissingOptions(): string {
  const options: Array<[MissingFilter, string]> = [
    ['all', 'すべて'],
    ['any', 'URL未登録のみ'],
    ['official', '公式URL未登録のみ'],
    ['amazon', 'Amazon未登録のみ'],
    ['rakuten', '楽天未登録のみ'],
    ['yahoo', 'Yahoo未登録のみ'],
  ];
  return options.map(([value, label]) => `<option value="${value}" ${missingFilter === value ? 'selected' : ''}>${label}</option>`).join('');
}

function getUrlStatus(values: ProductRowValues): string {
  const missing = [
    values.official_url ? '' : '公式未登録',
    values.amazon_url ? '' : 'Amazon未登録',
    values.rakuten_url ? '' : '楽天未登録',
    values.yahoo_url ? '' : 'Yahoo未登録',
  ].filter(Boolean);
  if (missing.length === 0) return '全URL登録済み';
  if (values.official_url && missing.length === 3) return '公式のみ';
  if (missing.length === 4) return 'URLなし';
  return missing.join(' / ');
}

function getRowValues(product: Product): ProductRowValues {
  return {
    product_name: firstText(product, ['name', 'product_name', 'title']),
    official_url: firstText(product, ['official_url', 'official_link']),
    amazon_url: firstText(product, ['amazon_url', 'amazon_link']),
    rakuten_url: firstText(product, ['rakuten_url', 'rakuten_link']),
    yahoo_url: firstText(product, ['yahoo_url', 'yahoo_link']),
    affiliate_checked_at: firstText(product, ['affiliate_checked_at']),
    affiliate_note: firstText(product, ['affiliate_note']),
  };
}

function getValuesFromRow(row: HTMLElement): ProductRowValues {
  return {
    product_name: getRowFieldValue(row, 'product_name'),
    official_url: getRowFieldValue(row, 'official_url'),
    amazon_url: getRowFieldValue(row, 'amazon_url'),
    rakuten_url: getRowFieldValue(row, 'rakuten_url'),
    yahoo_url: getRowFieldValue(row, 'yahoo_url'),
    affiliate_checked_at: getRowFieldValue(row, 'affiliate_checked_at'),
    affiliate_note: getRowFieldValue(row, 'affiliate_note'),
  };
}

function getRowFieldValue(row: HTMLElement, field: string): string {
  return row.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-field="${field}"]`)?.value.trim() ?? '';
}

function getUrlError(value: string): string {
  if (!value) return '';
  if (/javascript:/i.test(value) || /<script/i.test(value) || /[<>]/.test(value)) return '使用できない文字列が含まれています。';
  if (!/^https?:\/\//i.test(value)) return 'http:// または https:// から始めてください。';
  try {
    const parsed = new URL(value);
    return /^https?:$/.test(parsed.protocol) ? '' : 'http:// または https:// のURLを入力してください。';
  } catch {
    return 'URLとして読み取れません。';
  }
}

function isValidUrlValue(value: string): boolean {
  return !getUrlError(value);
}

function createImageMap(affiliateItems: AffiliateImage[], uploadedItems: UploadedImage[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const item of uploadedItems) {
    const productId = String(item.product_id);
    if (!map.has(productId) && item.public_url) map.set(productId, item.public_url);
  }

  for (const item of affiliateItems) {
    const productId = String(item.product_id);
    const src = item.image_url || extractImageSrc(item.rakuten_image_html ?? '');
    if (!map.has(productId) && src) map.set(productId, src);
  }

  return map;
}

function extractImageSrc(html: string): string {
  if (!html) return '';
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.querySelector('img')?.getAttribute('src') ?? '';
}

function bindLogout(): void {
  document.querySelector<HTMLButtonElement>('#logout-button')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    await render();
  });
}

function setRowMessage(row: HTMLElement, text: string, tone: 'success' | 'error' | 'muted'): void {
  const productId = row.dataset.productId ?? '';
  rowMessages.set(productId, { text, tone });
  const element = row.querySelector<HTMLElement>('.row-message');
  if (!element) return;
  element.className = `row-message is-${tone}`;
  element.textContent = text;
}

function showPageStatus(text: string, tone: 'success' | 'error' | 'muted'): void {
  const status = document.querySelector<HTMLElement>('#page-status');
  if (!status) return;
  status.className = `status-message is-${tone}`;
  status.textContent = text;
}

function getProductId(product: Product): string {
  return String(product.id);
}

function getBrand(product: Product): string {
  const fallback = firstText(product, ['brand', 'maker', 'manufacturer']) || 'ブランド未登録';
  return normalizeProductDisplayBrand(product, fallback) || fallback;
}

function getProductName(product: Product): string {
  const fallback = firstText(product, ['name', 'product_name', 'title']) || `商品ID: ${getProductId(product)}`;
  return normalizeProductDisplayName(product, fallback) || fallback;
}

function getCategory(product: Product): string {
  const category = firstText(product, ['category']);
  const productType = firstText(product, ['product_type']);
  if (/hip\s*seat|hipseat|ヒップシート/i.test(category) || productType === 'hipseat') return 'ヒップシート';
  if (/抱っこ紐|抱っこひも|carrier/i.test(category)) return '抱っこ紐';
  if (/チャイルドシート|car\s*seat|carseat/i.test(category)) return 'チャイルドシート';
  return category || 'ベビーカー';
}

function firstText(product: Product, keys: string[]): string {
  for (const key of keys) {
    const value = product[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeText(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value: unknown): string {
  return escapeText(value).replace(/`/g, '&#096;');
}
