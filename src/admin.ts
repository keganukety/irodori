import './admin.css';
import { supabase } from './lib/supabase';
import type { ImageRole, Product, ProductAffiliateImage, ProductColor, ProductUploadedImage, UploadedImageMimeType } from './types';
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from './youtube';
import {
  createRakutenAffiliateCandidate,
  getRakutenShopKey,
  normalizeRakutenItemUrl,
  parseRakutenAffiliateHtml,
} from './rakuten-affiliate';
import type { RakutenAffiliateImageCandidate, RakutenProductInfoResponse, RakutenShopSetting } from './rakuten-affiliate';

const appElement = document.querySelector<HTMLDivElement>('#admin-app');

if (!appElement) {
  throw new Error('#admin-app was not found.');
}

const app: HTMLDivElement = appElement;

const roles: ImageRole[] = ['main', 'color', 'detail', 'folded', 'usage'];
const uploadedImageBucket = 'product-images';
const maxUploadSizeBytes = 5 * 1024 * 1024;
const allowedUploadMimeTypes: UploadedImageMimeType[] = ['image/jpeg', 'image/png', 'image/webp'];
const pageSize = 10;
const managedCategories = ['ベビーカー', '抱っこ紐', 'チャイルドシート', 'ヒップシート'] as const;
type CategoryFilter = 'all' | (typeof managedCategories)[number];
type BulkAffiliateCandidate = RakutenAffiliateImageCandidate & {
  selected: boolean;
  displayOrder: number;
  blocked?: boolean;
};

let products: Product[] = [];
let images: ProductAffiliateImage[] = [];
let uploadedImages: ProductUploadedImage[] = [];
let productColors: ProductColor[] = [];
let query = '';
let categoryFilter: CategoryFilter = 'all';
let filter: 'all' | 'registered' | 'unregistered' = 'unregistered';
let currentPage = 1;
let openProductId = '';
let draggingImageId = '';
const uploadPreviewUrls = new Map<HTMLFormElement, string>();
let bulkProductId = '';
let bulkItemUrl = '';
let bulkHtml = '';
let bulkCandidates: BulkAffiliateCandidate[] = [];
let bulkPanelOpen = false;
let bulkMessage = '';
let bulkMessageIsError = false;
let bulkMode: 'html' | 'url' = 'html';
let bulkShopSetting: RakutenShopSetting | null = null;
let bulkSettingChanged = false;
let bulkUpdateSetting = false;

init();

async function init() {
  supabase.auth.onAuthStateChange(() => {
    render();
  });

  await render();
}

async function render() {
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    renderLogin();
    return;
  }

  const isAdmin = await checkAdmin();

  if (!isAdmin) {
    renderForbidden();
    return;
  }

  await renderAdmin();
}

function renderLogin() {
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-panel">
        <h1>商品画像・YouTube管理</h1>
        <p>管理者アカウントでログインしてください。</p>

        <form id="login-form" class="auth-form">
          <label>
            メールアドレス
            <input name="email" type="email" required autocomplete="email" />
          </label>

          <label>
            パスワード
            <input name="password" type="password" required autocomplete="current-password" />
          </label>

          <button type="submit">ログイン</button>
        </form>

        <p id="login-message" class="message"></p>
      </section>
    </main>
  `;

  document.querySelector<HTMLFormElement>('#login-form')?.addEventListener('submit', async (event: SubmitEvent) => {
    event.preventDefault();

    const target = event.currentTarget;
    if (!(target instanceof HTMLFormElement)) return;

    const form = new FormData(target);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const message = document.querySelector<HTMLElement>('#login-message');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (message) message.textContent = error.message;
      return;
    }

    await render();
  });
}

function renderForbidden() {
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-panel">
        <h1>アクセスできません</h1>
        <p>ログイン済みですが、このユーザーは管理者に登録されていません。</p>
        <button id="logout-button">ログアウト</button>
      </section>
    </main>
  `;

  document.querySelector<HTMLButtonElement>('#logout-button')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    await render();
  });
}

async function checkAdmin() {
  const { data, error } = await supabase.rpc('is_admin');

  if (error) {
    console.error(error);
    return false;
  }

  return data === true;
}

async function renderAdmin() {
  app.innerHTML = `
    <header class="admin-header">
      <div>
        <h1>商品画像管理</h1>
        <p>楽天HTML画像、自作画像、YouTube動画を商品ごとに管理します。</p>
      </div>
      <div class="header-actions">
        <a href="/affiliate-admin.html">アフィリエイトURL管理</a>
        <a href="/assets-admin.html">素材管理</a>
        <button id="logout-button" type="button">ログアウト</button>
      </div>
    </header>

    <main class="admin-main">
      <nav class="category-tabs" aria-label="商品カテゴリ">
        ${renderCategoryTab('all', 'すべて')}
        ${managedCategories.map((category) => renderCategoryTab(category, category)).join('')}
      </nav>

      <section class="toolbar">
        <label class="search-box">
          商品名・ブランド名・商品IDで検索
          <input id="search-input" type="search" value="${escapeAttr(query)}" placeholder="例: 商品名 / ブランド / ID" />
        </label>

        <label>
          表示
          <select id="filter-select">
            <option value="all" ${filter === 'all' ? 'selected' : ''}>すべて</option>
            <option value="registered" ${filter === 'registered' ? 'selected' : ''}>登録済み</option>
            <option value="unregistered" ${filter === 'unregistered' ? 'selected' : ''}>未登録</option>
          </select>
        </label>
      </section>

      <section id="rakuten-bulk-panel"></section>

      <section id="status" class="status">読み込み中...</section>
      <section id="product-list" class="product-list"></section>
      <nav id="pagination" class="pagination" aria-label="ページネーション"></nav>
    </main>
  `;

  bindShellEvents();

  try {
    await loadData();
    renderProductList();
  } catch (error) {
    showStatus(getErrorMessage(error), 'error');
  }
}

function bindShellEvents() {
  document.querySelector<HTMLButtonElement>('#logout-button')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    await render();
  });

  document.querySelector<HTMLInputElement>('#search-input')?.addEventListener('input', (event: Event) => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;

    query = input.value;
    currentPage = 1;
    openProductId = '';
    renderProductList();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-category-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.categoryFilter ?? 'all';
      categoryFilter = value === 'all' || managedCategories.includes(value as (typeof managedCategories)[number])
        ? value as CategoryFilter
        : 'all';
      currentPage = 1;
      openProductId = '';
      bulkProductId = '';
      bulkCandidates = [];
      renderAdmin().catch((error) => showStatus(getErrorMessage(error), 'error'));
    });
  });

  document.querySelector<HTMLSelectElement>('#filter-select')?.addEventListener('change', (event: Event) => {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;

    filter = select.value as typeof filter;
    currentPage = 1;
    openProductId = '';
    renderProductList();
  });
}

async function loadData() {
  const [productResult, imageResult, uploadedImageResult, colorResult] = await Promise.all([
    supabase.from('products').select('*').order('id', { ascending: true }),
    supabase
      .from('product_affiliate_images')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('product_uploaded_images')
      .select('*')
      .order('is_primary', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase.from('product_colors').select('*').order('display_order', { ascending: true }),
  ]);

  if (productResult.error) throw productResult.error;
  if (imageResult.error) throw imageResult.error;
  if (uploadedImageResult.error) throw uploadedImageResult.error;
  if (colorResult.error) console.info('商品カラーを取得できませんでした。', colorResult.error.message);

  products = (productResult.data ?? []) as Product[];
  images = (imageResult.data ?? []) as ProductAffiliateImage[];
  uploadedImages = (uploadedImageResult.data ?? []) as ProductUploadedImage[];
  productColors = (colorResult.data ?? []) as ProductColor[];
}

function renderProductList() {
  const list = document.querySelector<HTMLElement>('#product-list');
  const pagination = document.querySelector<HTMLElement>('#pagination');
  if (!list || !pagination) return;

  const visibleProducts = getVisibleProducts();
  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / pageSize));
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);

  const start = (currentPage - 1) * pageSize;
  const pageProducts = visibleProducts.slice(start, start + pageSize);

  showStatus(`${visibleProducts.length}件中 ${pageProducts.length}件を表示中`, 'normal');

  revokeUploadPreviewUrls();
  list.innerHTML = pageProducts.map(renderProductCard).join('');
  pagination.innerHTML = renderPagination(totalPages, visibleProducts.length);
  renderRakutenBulkPanel();

  bindProductEvents();
  bindPaginationEvents();

  if (openProductId) {
    const target = document.querySelector<HTMLElement>(`[data-product-id="${cssEscape(openProductId)}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderPagination(totalPages: number, totalItems: number) {
  if (totalItems <= pageSize) return '';

  return `
    <button type="button" data-page-action="prev" ${currentPage === 1 ? 'disabled' : ''}>前へ</button>
    <span>${currentPage} / ${totalPages}</span>
    <button type="button" data-page-action="next" ${currentPage === totalPages ? 'disabled' : ''}>次へ</button>
  `;
}

function renderCategoryTab(value: CategoryFilter, label: string) {
  return `<button type="button" data-category-filter="${escapeAttr(value)}" class="${categoryFilter === value ? 'is-active' : ''}">${escapeText(label)}</button>`;
}

function renderRakutenBulkPanel() {
  const container = document.querySelector<HTMLElement>('#rakuten-bulk-panel');
  if (!container) return;
  const selectableProducts = getBulkSelectableProducts();
  if (!bulkProductId || !selectableProducts.some((product) => String(product.id) === bulkProductId)) {
    bulkProductId = selectableProducts[0] ? String(selectableProducts[0].id) : '';
  }

  container.innerHTML = `
    <details class="rakuten-bulk-accordion" ${bulkPanelOpen ? 'open' : ''}>
      <summary>楽天アフィ画像を自動登録</summary>
      <div class="rakuten-bulk-content">
        <div class="rakuten-mode-tabs" role="tablist" aria-label="楽天画像の登録方法">
          <button type="button" data-bulk-mode="html" class="${bulkMode === 'html' ? 'is-active' : ''}">初回：アフィHTMLから学習</button>
          <button type="button" data-bulk-mode="url" class="${bulkMode === 'url' ? 'is-active' : ''}">学習済み：URLだけで生成</button>
        </div>
        <div class="rakuten-bulk-fields">
          <label>
            商品選択
            <select id="bulk-product-select" ${selectableProducts.length === 0 ? 'disabled' : ''}>
              ${selectableProducts.map((product) => `<option value="${escapeAttr(String(product.id))}" ${String(product.id) === bulkProductId ? 'selected' : ''}>${escapeText(getProductLabel(product))} / ${escapeText(getProductBrand(product))}</option>`).join('')}
            </select>
          </label>
          <label>
            楽天商品URL
            <input id="bulk-item-url" type="url" value="${escapeAttr(bulkItemUrl)}" placeholder="https://item.rakuten.co.jp/shop/item/" />
          </label>
        </div>

        ${bulkMode === 'html' ? `
          <label>
            楽天アフィリエイト発行HTML
            <textarea id="bulk-affiliate-html" rows="9" placeholder="楽天アフィリエイト画面で発行したHTMLを貼り付けてください。">${escapeText(bulkHtml)}</textarea>
          </label>
        ` : '<p class="affiliate-mode-help">楽天APIから代表画像を最大3枚ほど取得します。追加画像が必要な場合はHTML貼り付け登録を使ってください。</p>'}

        ${renderBulkShopSettingNotice()}

        <div class="actions">
          ${bulkMode === 'html'
            ? '<button type="button" data-action="analyze-rakuten-html">解析</button>'
            : '<button type="button" data-action="generate-rakuten-url">URLから生成</button><button type="button" data-action="fallback-rakuten-html">HTML貼り付けへ戻る</button>'}
          <button type="button" data-action="register-rakuten-bulk" ${bulkCandidates.some((candidate) => candidate.selected) && bulkProductId ? '' : 'disabled'}>まとめて登録</button>
        </div>
        <p class="form-message ${bulkMessageIsError ? 'danger-text' : ''}">${escapeText(bulkMessage)}</p>
        ${renderBulkCandidateGrid()}
      </div>
    </details>
  `;

  bindRakutenBulkEvents();
}

function renderBulkShopSettingNotice() {
  if (!bulkShopSetting) return '';
  if (!bulkSettingChanged) {
    return `<p class="shop-setting-status">店舗「${escapeText(bulkShopSetting.shop_key)}」のaffiliatePathは登録済みです。</p>`;
  }
  return `
    <label class="shop-setting-update">
      <input type="checkbox" id="bulk-update-setting" ${bulkUpdateSetting ? 'checked' : ''} />
      この店舗の登録済みaffiliatePathを今回の解析値で更新する
    </label>
  `;
}

function renderBulkCandidateGrid() {
  if (bulkCandidates.length === 0) {
    return '<div class="affiliate-analysis-empty">解析すると画像候補がここに表示されます。</div>';
  }

  return `
    <div class="affiliate-image-grid">
      ${bulkCandidates.map((candidate, index) => `
        <article class="affiliate-image-card">
          <div class="affiliate-image-preview">
            <img src="${escapeAttr(candidate.imageUrl)}" alt="楽天画像候補 ${index + 1}" loading="lazy" />
          </div>
          <label class="affiliate-select-check">
            <input type="checkbox" data-bulk-select="${index}" ${candidate.selected ? 'checked' : ''} ${candidate.blocked ? 'disabled' : ''} />
            ${candidate.blocked ? '重複のため登録不可' : 'この画像を登録'}
          </label>
          <dl class="affiliate-analysis-meta">
            <div><dt>affiliate_url</dt><dd>${escapeText(candidate.affiliateUrl)}</dd></div>
            <div><dt>image_url</dt><dd>${escapeText(candidate.imageUrl)}</dd></div>
            <div><dt>item_id</dt><dd>${escapeText(candidate.itemId)}</dd></div>
            <div><dt>me_id</dt><dd>${escapeText(candidate.meId)}</dd></div>
            <div><dt>shop</dt><dd>${escapeText(candidate.shopKey)}</dd></div>
            <div><dt>size</dt><dd>${escapeText(candidate.imageSize || '未取得')}</dd></div>
          </dl>
          <label>
            表示順
            <input type="number" min="1" data-bulk-order="${index}" value="${candidate.displayOrder}" />
          </label>
        </article>
      `).join('')}
    </div>
  `;
}

function bindRakutenBulkEvents() {
  const details = document.querySelector<HTMLDetailsElement>('.rakuten-bulk-accordion');
  details?.addEventListener('toggle', () => {
    bulkPanelOpen = details.open;
  });

  document.querySelectorAll<HTMLButtonElement>('[data-bulk-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      bulkMode = button.dataset.bulkMode === 'url' ? 'url' : 'html';
      bulkCandidates = [];
      bulkMessage = '';
      bulkShopSetting = null;
      renderRakutenBulkPanel();
    });
  });

  document.querySelector<HTMLSelectElement>('#bulk-product-select')?.addEventListener('change', (event) => {
    bulkProductId = (event.currentTarget as HTMLSelectElement).value;
    bulkCandidates = [];
    bulkMessage = '';
    renderRakutenBulkPanel();
  });
  document.querySelector<HTMLInputElement>('#bulk-item-url')?.addEventListener('input', (event) => {
    bulkItemUrl = (event.currentTarget as HTMLInputElement).value;
  });
  document.querySelector<HTMLTextAreaElement>('#bulk-affiliate-html')?.addEventListener('input', (event) => {
    bulkHtml = (event.currentTarget as HTMLTextAreaElement).value;
  });
  document.querySelector<HTMLButtonElement>('[data-action="analyze-rakuten-html"]')?.addEventListener('click', analyzeRakutenBulkHtml);
  document.querySelector<HTMLButtonElement>('[data-action="generate-rakuten-url"]')?.addEventListener('click', generateRakutenImagesFromUrl);
  document.querySelector<HTMLButtonElement>('[data-action="fallback-rakuten-html"]')?.addEventListener('click', () => {
    bulkMode = 'html';
    bulkCandidates = [];
    bulkMessage = '初回だけ楽天アフィリエイト発行HTMLを貼り付けてください。';
    bulkMessageIsError = false;
    renderRakutenBulkPanel();
  });
  document.querySelector<HTMLButtonElement>('[data-action="register-rakuten-bulk"]')?.addEventListener('click', registerRakutenBulkImages);
  document.querySelector<HTMLInputElement>('#bulk-update-setting')?.addEventListener('change', (event) => {
    bulkUpdateSetting = (event.currentTarget as HTMLInputElement).checked;
  });

  document.querySelectorAll<HTMLInputElement>('[data-bulk-select]').forEach((input) => {
    input.addEventListener('change', () => {
      const index = Number(input.dataset.bulkSelect);
      if (bulkCandidates[index]) bulkCandidates[index].selected = input.checked;
      const registerButton = document.querySelector<HTMLButtonElement>('[data-action="register-rakuten-bulk"]');
      if (registerButton) registerButton.disabled = !bulkProductId || !bulkCandidates.some((candidate) => candidate.selected);
    });
  });
  document.querySelectorAll<HTMLInputElement>('[data-bulk-order]').forEach((input) => {
    input.addEventListener('change', () => {
      const index = Number(input.dataset.bulkOrder);
      if (bulkCandidates[index]) bulkCandidates[index].displayOrder = Math.max(1, Number(input.value) || 1);
    });
  });
}

async function analyzeRakutenBulkHtml() {
  bulkPanelOpen = true;
  const normalizedInputUrl = bulkItemUrl.trim() ? normalizeRakutenItemUrl(bulkItemUrl) : '';
  if (bulkItemUrl.trim() && !normalizedInputUrl) {
    bulkCandidates = [];
    bulkMessage = '楽天商品URLを確認してください。';
    bulkMessageIsError = true;
    renderRakutenBulkPanel();
    return;
  }

  const parsed = parseRakutenAffiliateHtml(bulkHtml, normalizedInputUrl);
  bulkShopSetting = parsed[0]?.shopKey ? await loadRakutenShopSetting(parsed[0].shopKey) : null;
  bulkSettingChanged = Boolean(bulkShopSetting && parsed[0]
    && (bulkShopSetting.affiliate_path !== parsed[0].affiliatePath || bulkShopSetting.me_id !== parsed[0].meId));
  bulkUpdateSetting = false;
  const currentImages = getImagesByProductId(bulkProductId);
  const existingUrls = new Set(currentImages.map(getStoredAffiliateImageUrl).filter(Boolean));
  const existingAffiliateUrls = new Set(currentImages.map((image) => image.affiliate_url ?? '').filter(Boolean));
  const candidateAffiliateUrls = new Set(existingAffiliateUrls);
  const startOrder = getNextDisplayOrder(currentImages);
  bulkCandidates = parsed.map((candidate, index) => {
    const blocked = existingUrls.has(candidate.imageUrl) || candidateAffiliateUrls.has(candidate.affiliateUrl);
    if (!blocked) candidateAffiliateUrls.add(candidate.affiliateUrl);
    return { ...candidate, selected: !blocked, blocked, displayOrder: startOrder + index };
  });
  bulkItemUrl = normalizedInputUrl || parsed[0]?.rakutenItemUrl || bulkItemUrl;
  if (parsed.length === 0) {
    bulkMessage = '登録可能な楽天アフィリエイト画像が見つかりませんでした。';
    bulkMessageIsError = true;
    renderRakutenBulkPanel();
    return;
  }

  const learned = await rememberRakutenShopSettingFromCandidate(parsed[0]);
  if (!learned) {
    renderRakutenBulkPanel();
    return;
  }

  await loadRakutenApiCandidatesAfterHtmlLearning();
  renderRakutenBulkPanel();
}

async function rememberRakutenShopSettingFromCandidate(candidate: RakutenAffiliateImageCandidate): Promise<boolean> {
  const { error } = await supabase.rpc('remember_rakuten_affiliate_shop_setting', {
    p_shop_key: candidate.shopKey,
    p_me_id: candidate.meId,
    p_affiliate_path: candidate.affiliatePath,
    p_sample_affiliate_url: candidate.affiliateUrl,
    p_sample_item_url: candidate.rakutenItemUrl,
  });

  if (error) {
    bulkMessage = `HTML解析はできましたが、店舗設定の学習に失敗しました: ${error.message}`;
    bulkMessageIsError = true;
    return false;
  }

  return true;
}

async function generateRakutenImagesFromUrl() {
  bulkPanelOpen = true;
  bulkCandidates = [];
  bulkMessageIsError = false;
  const normalizedItemUrl = normalizeRakutenItemUrl(bulkItemUrl);
  const shopKey = getRakutenShopKey(normalizedItemUrl);
  if (!normalizedItemUrl || !shopKey) {
    bulkMessage = '楽天商品URLを確認してください。';
    bulkMessageIsError = true;
    renderRakutenBulkPanel();
    return;
  }

  bulkItemUrl = normalizedItemUrl;
  bulkShopSetting = await loadRakutenShopSetting(shopKey).catch(() => null);

  bulkMessage = '楽天APIから画像候補を取得中...';
  renderRakutenBulkPanel();
  try {
    const payload = await fetchRakutenApiImagePayload(normalizedItemUrl);
    bulkCandidates = buildRakutenApiCandidatesForCurrentProduct(payload);
    if (bulkCandidates.length === 0) throw new Error('登録できる楽天画像候補を生成できませんでした。');
    const priceText = payload.item_price ? ` / ¥${payload.item_price.toLocaleString('ja-JP')}` : '';
    bulkMessage = `${bulkCandidates.length}件を生成しました。${payload.item_name ?? '商品名未取得'}${priceText}。画像を確認してから登録してください。`;
    bulkMessageIsError = false;
  } catch (error) {
    bulkCandidates = [];
    bulkMessage = `${getErrorMessage(error)} HTML貼り付け登録へ戻ってください。`;
    bulkMessageIsError = true;
  }
  renderRakutenBulkPanel();
}

async function loadRakutenApiCandidatesAfterHtmlLearning(): Promise<void> {
  try {
    const normalizedItemUrl = normalizeRakutenItemUrl(bulkItemUrl);
    if (!normalizedItemUrl) throw new Error('楽天商品URLを確認してください。');

    const payload = await fetchRakutenApiImagePayload(normalizedItemUrl);
    const candidates = buildRakutenApiCandidatesForCurrentProduct(payload);
    const hasNewCandidates = candidates.some((candidate) => candidate.selected && !candidate.blocked);
    bulkCandidates = candidates;
    bulkMessageIsError = false;
    bulkMessage = hasNewCandidates
      ? 'HTML学習が完了しました。楽天APIから代表画像候補を取得しました。'
      : 'HTML学習は完了しました。楽天APIで取得できる新規画像はありません。追加画像はHTML貼り付け登録を使ってください。';
  } catch {
    bulkCandidates = [];
    bulkMessage = 'HTML学習は完了しましたが、楽天API画像候補の取得に失敗しました。必要ならHTML貼り付け登録を使ってください。';
    bulkMessageIsError = false;
  }
}

async function fetchRakutenApiImagePayload(
  normalizedItemUrl: string,
): Promise<Extract<RakutenProductInfoResponse, { ok: true }>> {
  const product = products.find((item) => String(item.id) === bulkProductId);
  const params = new URLSearchParams({
    url: normalizedItemUrl,
    productName: product ? getProductLabel(product) : '',
    brandName: product ? getProductBrand(product) : '',
  });
  const response = await fetch(`/api/rakuten-item-search?${params.toString()}`, {
    headers: { accept: 'application/json' },
  });
  const payload = await readRakutenProductInfoResponse(response);
  if (!payload.ok) {
    throw new Error(payload.error || '楽天APIから商品情報を取得できませんでした。');
  }
  if (!payload.affiliate_url) throw new Error('楽天APIからaffiliateUrlを取得できませんでした。');
  if (payload.image_urls.length === 0) throw new Error('楽天APIから画像URLを取得できませんでした。');
  return payload;
}

function buildRakutenApiCandidatesForCurrentProduct(
  payload: Extract<RakutenProductInfoResponse, { ok: true }>,
): BulkAffiliateCandidate[] {
  const currentImages = getImagesByProductId(bulkProductId);
  return buildRakutenApiBulkCandidates(payload, currentImages, getNextDisplayOrder(currentImages));
}

function buildRakutenApiBulkCandidates(
  payload: Extract<RakutenProductInfoResponse, { ok: true }>,
  currentImages: ProductAffiliateImage[],
  startOrder: number,
): BulkAffiliateCandidate[] {
  const seenImageUrls = new Set(currentImages.map(getComparableImageUrl).filter(Boolean));

  return payload.image_urls
    .map((imageUrl) => createRakutenApiCandidate(payload, imageUrl))
    .map((candidate, index) => {
      const comparableImageUrl = getComparableCandidateImageUrl(candidate);
      const blocked = !comparableImageUrl || seenImageUrls.has(comparableImageUrl);
      if (!blocked) seenImageUrls.add(comparableImageUrl);
      return {
        ...candidate,
        selected: !blocked,
        blocked,
        displayOrder: startOrder + index,
      };
    });
}

function createRakutenApiCandidate(
  payload: Extract<RakutenProductInfoResponse, { ok: true }>,
  imageUrl: string,
): RakutenAffiliateImageCandidate {
  return {
    affiliateUrl: payload.affiliate_url ?? payload.normalized_item_url,
    imageUrl,
    itemId: payload.item_code,
    meId: '',
    imageSize: 'api',
    rakutenItemUrl: payload.normalized_item_url,
    shopKey: payload.shop_key,
    affiliatePath: '',
    sourceType: 'rakuten-api',
    itemName: payload.item_name ?? payload.title ?? '',
    itemPrice: payload.item_price ?? null,
  };
}

async function readRakutenProductInfoResponse(
  response: Response,
): Promise<RakutenProductInfoResponse> {
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  const responseText = await response.text();

  if (!response.ok || !contentType.includes('application/json')) {
    if (import.meta.env.DEV) {
      console.warn('URL生成APIの応答を確認してください。', {
        status: response.status,
        contentType,
        bodyHead: responseText.slice(0, 300),
      });
    }
    const isLocalVite = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    const looksLikeHtml = contentType.includes('text/html') || /^\s*<!doctype html|^\s*<html/i.test(responseText);
    if (isLocalVite && looksLikeHtml) {
      throw new Error('URLだけ生成APIが起動していません。Cloudflare Pages Functions環境で確認してください。');
    }
    if (!contentType.includes('application/json')) {
      throw new Error(`URLだけ生成APIからJSON以外の応答が返されました${contentType ? `（${contentType}）` : ''}。`);
    }
    throw new Error(`URLだけ生成APIがエラーを返しました（${response.status}）。`);
  }

  if (!responseText.trim()) {
    throw new Error('URLだけ生成APIから空の応答が返されました。');
  }

  try {
    const payload = JSON.parse(responseText) as RakutenProductInfoResponse;
    const hasValidFailureShape = payload.ok === false && typeof payload.error === 'string';
    const hasValidSuccessShape = payload.ok === true
      && Array.isArray(payload.image_urls)
      && typeof payload.normalized_item_url === 'string';
    if (!hasValidFailureShape && !hasValidSuccessShape) {
      throw new Error('URLだけ生成APIの応答形式が正しくありません。');
    }
    return payload;
  } catch (error) {
    if (error instanceof Error && error.message === 'URLだけ生成APIの応答形式が正しくありません。') {
      throw error;
    }
    throw new Error('URLだけ生成APIのJSONを解析できませんでした。');
  }
}

async function loadRakutenShopSetting(shopKey: string): Promise<RakutenShopSetting | null> {
  const { data, error } = await supabase
    .from('rakuten_affiliate_shop_settings')
    .select('shop_key, me_id, affiliate_path, sample_affiliate_url, sample_item_url')
    .eq('shop_key', shopKey)
    .maybeSingle();
  if (error) throw error;
  return data as RakutenShopSetting | null;
}

async function registerRakutenBulkImages() {
  const selected = bulkCandidates.filter((candidate) => candidate.selected);
  if (!bulkProductId || selected.length === 0) return;
  bulkMessage = '登録中...';
  bulkMessageIsError = false;
  renderRakutenBulkPanel();

  const apiCandidates = selected.filter(isRakutenApiCandidate);
  const affiliateCandidates = selected.filter((candidate) => !isRakutenApiCandidate(candidate));
  let inserted = 0;
  let skipped = 0;

  if (affiliateCandidates.length > 0) {
    const result = await registerRakutenAffiliateCandidates(affiliateCandidates);
    if (!result) return;
    inserted += result.inserted;
    skipped += result.skipped;
  }

  if (apiCandidates.length > 0) {
    const result = await registerRakutenApiCandidates(apiCandidates);
    if (!result) return;
    inserted += result.inserted;
    skipped += result.skipped;
  }

  await normalizeMediaOrder('affiliate', bulkProductId);
  bulkMessage = `${inserted}件を登録しました。重複スキップ: ${skipped}件`;
  bulkMessageIsError = false;
  bulkCandidates = [];
  bulkShopSetting = null;
  await loadData();
  openProductId = bulkProductId;
  moveToProductPage(bulkProductId);
  renderProductList();
}

async function registerRakutenAffiliateCandidates(candidates: BulkAffiliateCandidate[]): Promise<{ inserted: number; skipped: number } | null> {
  if (bulkUpdateSetting && bulkSettingChanged) {
    const candidate = candidates[0];
    const { error: settingError } = await supabase.rpc('update_rakuten_affiliate_shop_setting', {
      p_shop_key: candidate.shopKey,
      p_me_id: candidate.meId,
      p_affiliate_path: candidate.affiliatePath,
      p_sample_affiliate_url: candidate.affiliateUrl,
      p_sample_item_url: candidate.rakutenItemUrl,
    });
    if (settingError) {
      bulkMessage = settingError.message;
      bulkMessageIsError = true;
      renderRakutenBulkPanel();
      return null;
    }
  } else {
    const candidate = candidates[0];
    const { error: rememberError } = await supabase.rpc('remember_rakuten_affiliate_shop_setting', {
      p_shop_key: candidate.shopKey,
      p_me_id: candidate.meId,
      p_affiliate_path: candidate.affiliatePath,
      p_sample_affiliate_url: candidate.affiliateUrl,
      p_sample_item_url: candidate.rakutenItemUrl,
    });
    if (rememberError) {
      bulkMessage = rememberError.message;
      bulkMessageIsError = true;
      renderRakutenBulkPanel();
      return null;
    }
  }

  const { data, error } = await supabase.rpc('create_rakuten_affiliate_images_bulk', {
    p_product_id: bulkProductId,
    p_role: 'main',
    p_items: candidates.map((candidate) => ({
      affiliate_url: candidate.affiliateUrl,
      image_url: candidate.imageUrl,
      item_id: candidate.itemId,
      me_id: candidate.meId,
      image_size: candidate.imageSize,
      rakuten_item_url: candidate.rakutenItemUrl,
      shop_key: candidate.shopKey,
      affiliate_path: candidate.affiliatePath,
      display_order: candidate.displayOrder,
    })),
  });

  if (error) {
    bulkMessage = error.message;
    bulkMessageIsError = true;
    renderRakutenBulkPanel();
    return null;
  }

  const result = data as { inserted?: number; skipped?: number } | null;
  return {
    inserted: result?.inserted ?? 0,
    skipped: result?.skipped ?? 0,
  };
}

async function registerRakutenApiCandidates(candidates: BulkAffiliateCandidate[]): Promise<{ inserted: number; skipped: number } | null> {
  let inserted = 0;
  let skipped = 0;
  const existingImageUrls = new Set(getImagesByProductId(bulkProductId).map(getComparableImageUrl).filter(Boolean));

  for (const candidate of candidates) {
    const comparableImageUrl = getComparableCandidateImageUrl(candidate);
    if (!comparableImageUrl || existingImageUrls.has(comparableImageUrl)) {
      skipped += 1;
      continue;
    }

    let html = '';
    try {
      html = createRakutenApiAffiliateHtml(candidate);
    } catch (error) {
      bulkMessage = getErrorMessage(error);
      bulkMessageIsError = true;
      renderRakutenBulkPanel();
      return null;
    }

    const { error } = await supabase.rpc('create_product_affiliate_image', {
      p_product_id: bulkProductId,
      p_role: 'main',
      p_rakuten_image_html: html,
      p_is_primary: false,
      p_display_order: candidate.displayOrder,
      p_mall: 'rakuten',
    });

    if (error) {
      bulkMessage = error.message;
      bulkMessageIsError = true;
      renderRakutenBulkPanel();
      return null;
    }

    existingImageUrls.add(comparableImageUrl);
    inserted += 1;
  }

  return { inserted, skipped };
}

function isRakutenApiCandidate(candidate: RakutenAffiliateImageCandidate): boolean {
  return candidate.sourceType === 'rakuten-api' || !candidate.meId || !candidate.affiliatePath;
}

function createRakutenApiAffiliateHtml(candidate: RakutenAffiliateImageCandidate): string {
  const affiliateUrl = normalizeHttpsUrl(candidate.affiliateUrl);
  const imageUrl = normalizeHttpsUrl(candidate.imageUrl);
  if (!affiliateUrl || !imageUrl) {
    throw new Error('楽天APIから取得したURLの形式を確認してください。');
  }
  return `<a href="${escapeAttr(affiliateUrl)}" target="_blank" rel="nofollow sponsored noopener"><img src="${escapeAttr(imageUrl)}" alt=""></a>`;
}

function normalizeHttpsUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    url.hash = '';
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function getComparableCandidateImageUrl(candidate: RakutenAffiliateImageCandidate): string {
  return normalizeHttpsUrl(candidate.imageUrl);
}

function getComparableImageUrl(image: ProductAffiliateImage): string {
  return normalizeHttpsUrl(getStoredAffiliateImageUrl(image));
}

function renderProductCard(product: Product) {
  const productId = String(product.id);
  const productImages = getImagesByProductId(productId);
  const productUploadedImages = getUploadedImagesByProductId(productId);
  const colors = productColors.filter((color) => String(color.product_id) === productId);
  const hasPrimary = productImages.some((image) => image.is_primary);
  const affiliateImageCount = productImages.filter((image) => getAffiliateMediaType(image) === 'image').length;
  const youtubeCount = productImages.filter((image) => getAffiliateMediaType(image) === 'youtube').length;
  const hasUploadedPrimary = productUploadedImages.some((image) => image.is_primary);
  const name = getProductLabel(product);
  const isOpen = openProductId === productId;

  return `
    <article class="product-card ${isOpen ? 'is-open' : ''}" data-product-id="${escapeAttr(productId)}">
      <div class="product-summary">
        <div class="product-title">
          <h2>${escapeText(name)}</h2>
          <p>ID: ${escapeText(productId)}</p>
        </div>
        <div class="head-badges">
          ${affiliateImageCount > 0 ? `<span class="badge">楽天 ${affiliateImageCount}</span>` : `<span class="badge muted">楽天 未登録</span>`}
          ${youtubeCount > 0 ? `<span class="badge youtube">YouTube ${youtubeCount}</span>` : ''}
          ${colors.length > 0 ? `<span class="badge">カラー ${colors.length}</span>` : ''}
          ${
            productUploadedImages.length > 0
              ? `<span class="badge uploaded">自作 ${productUploadedImages.length}</span>`
              : `<span class="badge muted">自作 未登録</span>`
          }
          ${hasPrimary || hasUploadedPrimary ? '' : `<span class="badge warning">メイン画像未設定</span>`}
        </div>
        <button type="button" data-action="toggle-product">${isOpen ? '閉じる' : '開く'}</button>
      </div>

      ${
        isOpen
          ? `
            <div class="product-detail">
              ${colors.length > 0 ? `
                <section class="image-section product-color-summary">
                  <div class="section-heading"><h3>登録カラー</h3><span class="badge">${colors.length}件</span></div>
                  <div class="admin-color-list">${colors.map((color) => `<span><i style="background:${escapeAttr(color.swatch_hex)}"></i>${escapeText(color.name)}${color.is_default ? '（デフォルト）' : ''}</span>`).join('')}</div>
                </section>
              ` : ''}
              <section class="image-section uploaded-section">
                <div class="section-heading">
                  <h3>自作画像</h3>
                  <span class="badge uploaded">${productUploadedImages.length}件</span>
                </div>
                <details class="upload-accordion">
                  <summary>自作画像をアップロード</summary>
                  ${renderUploadedImageForm(product, productUploadedImages, hasUploadedPrimary)}
                </details>
                ${renderUploadedImagesArea(productUploadedImages)}
              </section>

              <section class="image-section rakuten-section">
                <div class="section-heading">
                  <h3>楽天HTML画像 / YouTube</h3>
                  <span class="badge">${productImages.length}件</span>
                </div>
                ${renderCreateForm(productId, productImages, hasPrimary)}
              </section>

              <section class="registered-area image-section rakuten-section">
                <div class="section-heading">
                  <h3>登録済み画像・動画</h3>
                  <span class="badge">${productImages.length}件</span>
                </div>
                ${
                  productImages.length === 0
                    ? `<p class="empty-line">登録済み画像はありません。</p>`
                    : `<div class="registered-grid">${productImages.map(renderImageRow).join('')}</div>`
                }
              </section>

            </div>
          `
          : ''
      }
    </article>
  `;
}

function renderCreateForm(productId: string, productImages: ProductAffiliateImage[], hasPrimary: boolean) {
  return `
    <form class="create-form" data-product-id="${escapeAttr(productId)}">
      <div class="form-grid">
        <label>
          メディア種別
          <select name="media_type">
            <option value="image">画像</option>
            <option value="youtube">YouTube</option>
          </select>
        </label>

        <label>
          画像役割
          <select name="role">
            ${roles.map((role) => `<option value="${role}">${role}</option>`).join('')}
          </select>
        </label>

        <label>
          並び順
          <input name="display_order" type="number" min="1" value="${getNextDisplayOrder(productImages)}" />
        </label>

        <label class="check-label image-media-field">
          <input name="is_primary" type="checkbox" ${hasPrimary ? '' : 'checked'} />
          メイン画像にする
        </label>
      </div>

      <label class="image-media-field">
        楽天HTMLコード
        <textarea name="rakuten_image_html" rows="6" required spellcheck="false"></textarea>
      </label>

      <label class="youtube-media-field" hidden>
        YouTube URL
        <input name="youtube_url" type="url" inputmode="url" placeholder="https://www.youtube.com/watch?v=..." disabled />
      </label>

      <div class="actions">
        <button type="button" data-action="preview-create">登録前プレビュー</button>
        <button type="submit" data-submit-mode="save">保存</button>
        <button type="submit" data-submit-mode="save-next">保存して次へ</button>
      </div>

      <p class="form-message"></p>
      <div class="preview-box create-preview">
        <span class="empty">登録前プレビューがここに表示されます。</span>
      </div>
    </form>
  `;
}

function renderUploadedImageForm(product: Product, productUploadedImages: ProductUploadedImage[], hasUploadedPrimary: boolean) {
  const productId = String(product.id);
  const productName = getProductLabel(product);

  return `
    <form class="uploaded-create-form" data-product-id="${escapeAttr(productId)}" data-product-name="${escapeAttr(productName)}">
      <div class="form-grid">
        <label>
          ファイル
          <input name="uploaded_file" type="file" accept="image/jpeg,image/png,image/webp" />
        </label>

        <label>
          画像役割
          <select name="role">
            ${roles.map((role) => `<option value="${role}">${role}</option>`).join('')}
          </select>
        </label>

        <label>
          並び順
          <input name="display_order" type="number" min="1" value="${getNextUploadedDisplayOrder(productUploadedImages)}" />
        </label>

        <label class="check-label">
          <input name="is_primary" type="checkbox" ${hasUploadedPrimary ? '' : 'checked'} />
          メイン画像にする
        </label>
      </div>

      <div class="form-grid">
        <label>
          altテキスト
          <input name="alt_text" type="text" value="${escapeAttr(productName)}" />
        </label>

        <label>
          キャプション
          <input name="caption" type="text" />
        </label>
      </div>

      <div class="actions">
        <button type="submit">アップロード</button>
      </div>

      <p class="form-message upload-state">未選択</p>
      <div class="uploaded-preview">
        <span class="empty">選択した画像のプレビューがここに表示されます。</span>
      </div>
    </form>
  `;
}

function renderUploadedImagesArea(productUploadedImages: ProductUploadedImage[]) {
  return `
    <section class="uploaded-registered-area">
      <div class="section-heading compact">
        <h4>登録済み自作画像</h4>
        <span class="badge uploaded">${productUploadedImages.length}件</span>
      </div>
      ${
        productUploadedImages.length === 0
          ? `<p class="empty-line">登録済みの自作画像はありません。</p>`
          : `<div class="uploaded-grid">${productUploadedImages.map(renderUploadedImageRow).join('')}</div>`
      }
    </section>
  `;
}

function renderUploadedImageRow(image: ProductUploadedImage) {
  return `
    <article class="uploaded-image-row" data-uploaded-image-id="${escapeAttr(image.id)}">
      <div class="uploaded-thumb">
        <img src="${escapeAttr(image.public_url)}" alt="${escapeAttr(image.alt_text)}" loading="lazy" decoding="async" />
      </div>

      <div class="uploaded-edit-fields">
        <div class="image-meta">
          <strong>${escapeText(image.role)}</strong>
          <span>order: ${image.display_order}</span>
          ${image.is_primary ? `<span class="badge primary">メイン</span>` : ''}
        </div>

        <div class="form-grid">
          <label>
            画像役割
            <select data-field="role">
              ${roles.map((role) => `<option value="${role}" ${image.role === role ? 'selected' : ''}>${role}</option>`).join('')}
            </select>
          </label>

          <label>
            並び順
            <input data-field="display_order" type="number" min="1" value="${image.display_order}" />
          </label>
        </div>

        <label>
          altテキスト
          <input data-field="alt_text" type="text" value="${escapeAttr(image.alt_text)}" />
        </label>

        <label>
          キャプション
          <input data-field="caption" type="text" value="${escapeAttr(image.caption)}" />
        </label>

        <details class="storage-details">
          <summary>Storageパス</summary>
          <code>${escapeText(image.storage_path)}</code>
        </details>

        <div class="image-controls">
          <button type="button" data-action="update-uploaded-image">情報を更新</button>
          <button type="button" data-action="set-uploaded-primary" ${image.is_primary ? 'disabled' : ''}>メインにする</button>
          <button type="button" data-action="delete-uploaded-image" class="danger">削除</button>
        </div>

        <p class="row-message"></p>
      </div>
    </article>
  `;
}

function renderImageRow(image: ProductAffiliateImage) {
  const mediaType = getAffiliateMediaType(image);
  const unsafe = mediaType === 'image' ? detectUnsafeHtml(image.rakuten_image_html) : '';
  const youtubeVideoId = image.youtube_video_id ?? '';
  const youtubeThumbnail = image.thumbnail_url || getYouTubeThumbnailUrl(youtubeVideoId);

  return `
    <article class="image-row" data-image-id="${escapeAttr(image.id)}" draggable="true">
      <div class="image-meta">
        <span class="drag-handle" aria-hidden="true">ドラッグ</span>
        <strong>${escapeText(image.role)}</strong>
        ${mediaType === 'youtube' ? '<span class="badge youtube">YouTube</span>' : '<span class="badge">画像</span>'}
        <span>order: ${image.display_order}</span>
        ${image.is_primary ? `<span class="badge primary">メイン</span>` : ''}
      </div>

      <div class="preview-box">
        ${
          mediaType === 'youtube'
            ? `<div class="youtube-admin-preview">
                ${youtubeThumbnail ? `<img src="${escapeAttr(youtubeThumbnail)}" alt="YouTubeサムネイル" loading="lazy" />` : '<span class="empty">サムネイルなし</span>'}
                <span class="youtube-play-mark" aria-hidden="true">▶</span>
              </div>`
            : unsafe
            ? `<span class="danger-text">危険なHTMLを検出したためプレビューしません: ${escapeText(unsafe)}</span>`
            : image.rakuten_image_html
        }
      </div>

      <div class="image-controls">
        <label>
          並び順
          <input data-field="display_order" type="number" min="1" value="${image.display_order}" />
        </label>

        <button type="button" data-action="update-order">並び順変更</button>
        ${mediaType === 'image' ? `<button type="button" data-action="set-primary" ${image.is_primary ? 'disabled' : ''}>メインにする</button>` : ''}
        <button type="button" data-action="delete-image" class="danger">削除</button>
      </div>

      <p class="row-message"></p>
    </article>
  `;
}

function bindProductEvents() {
  document.querySelectorAll<HTMLButtonElement>('[data-action="toggle-product"]').forEach((button) => {
    button.addEventListener('click', () => {
      const productId = button.closest<HTMLElement>('.product-card')?.dataset.productId ?? '';
      openProductId = openProductId === productId ? '' : productId;
      renderProductList();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-action="preview-create"]').forEach((button) => {
    button.addEventListener('click', () => {
      const form = button.closest<HTMLFormElement>('.create-form');
      if (!form) return;

      const preview = form.querySelector<HTMLElement>('.create-preview');
      const message = form.querySelector<HTMLElement>('.form-message');
      if (!preview || !message) return;

      previewAffiliateMedia(form, preview, message);
    });
  });

  document.querySelectorAll<HTMLFormElement>('.create-form').forEach((form) => {
    let submitMode: 'save' | 'save-next' = 'save';

    form.querySelector<HTMLSelectElement>('select[name="media_type"]')?.addEventListener('change', () => {
      syncAffiliateMediaForm(form);
    });
    syncAffiliateMediaForm(form);

    form.querySelectorAll<HTMLButtonElement>('button[type="submit"]').forEach((button) => {
      button.addEventListener('click', () => {
        submitMode = button.dataset.submitMode === 'save-next' ? 'save-next' : 'save';
      });
    });

    form.addEventListener('submit', async (event: SubmitEvent) => {
      event.preventDefault();
      await createImage(form, submitMode);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-action="set-primary"]').forEach((button) => {
    button.addEventListener('click', async () => {
      await setPrimary(button);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-action="update-order"]').forEach((button) => {
    button.addEventListener('click', async () => {
      await updateOrder(button);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-action="delete-image"]').forEach((button) => {
    button.addEventListener('click', async () => {
      await deleteImage(button);
    });
  });

  document.querySelectorAll<HTMLFormElement>('.uploaded-create-form').forEach((form) => {
    form.querySelector<HTMLInputElement>('input[name="uploaded_file"]')?.addEventListener('change', async () => {
      await previewUploadedFile(form);
    });

    form.addEventListener('submit', async (event: SubmitEvent) => {
      event.preventDefault();
      await uploadProductImage(form);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-action="set-uploaded-primary"]').forEach((button) => {
    button.addEventListener('click', async () => {
      await setUploadedPrimary(button);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-action="update-uploaded-image"]').forEach((button) => {
    button.addEventListener('click', async () => {
      await updateUploadedImage(button);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-action="delete-uploaded-image"]').forEach((button) => {
    button.addEventListener('click', async () => {
      await deleteUploadedImage(button);
    });
  });

  bindImageDragEvents();
}

function bindPaginationEvents() {
  document.querySelectorAll<HTMLButtonElement>('[data-page-action]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.pageAction === 'prev') currentPage -= 1;
      if (button.dataset.pageAction === 'next') currentPage += 1;
      openProductId = '';
      renderProductList();
    });
  });
}

async function createImage(form: HTMLFormElement, mode: 'save' | 'save-next') {
  const productId = form.dataset.productId;
  const message = form.querySelector<HTMLElement>('.form-message');

  if (!productId || !message) return;

  const data = new FormData(form);
  const mediaType = data.get('media_type') === 'youtube' ? 'youtube' : 'image';
  const html = String(data.get('rakuten_image_html') ?? '');
  const displayOrder = Number(data.get('display_order') ?? 1);

  message.textContent = '保存中...';

  let error: { message: string } | null = null;

  if (mediaType === 'youtube') {
    const youtubeUrl = String(data.get('youtube_url') ?? '').trim();
    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      message.textContent = '対応しているYouTube URLを入力してください。';
      return;
    }

    ({ error } = await supabase.rpc('create_product_youtube_media', {
      p_product_id: productId,
      p_youtube_url: youtubeUrl,
      p_youtube_video_id: videoId,
      p_role: String(data.get('role')) as ImageRole,
      p_display_order: displayOrder,
    }));
  } else {
    if (!html.trim()) {
      message.textContent = '楽天HTMLコードを入力してください。';
      return;
    }
    const unsafe = detectUnsafeHtml(html);
    if (unsafe) {
      message.textContent = `危険なコードを検出したため保存しません: ${unsafe}`;
      return;
    }

    ({ error } = await supabase.rpc('create_product_affiliate_image', {
      p_product_id: productId,
      p_role: String(data.get('role')) as ImageRole,
      p_rakuten_image_html: html,
      p_is_primary: data.get('is_primary') === 'on',
      p_display_order: displayOrder,
      p_mall: 'rakuten',
    }));
  }

  if (error) {
    message.textContent = error.message;
    return;
  }

  await normalizeMediaOrder('affiliate', productId);
  await loadData();

  if (mode === 'save-next') {
    openNextUnregisteredProduct(productId);
  } else {
    openProductId = productId;
    moveToProductPage(productId);
  }

  renderProductList();
}

async function setPrimary(button: HTMLButtonElement) {
  const imageId = getImageId(button);
  const message = getRowMessage(button);

  if (!imageId || !message) return;

  message.textContent = '更新中...';

  const { error } = await supabase.rpc('set_product_affiliate_image_primary', {
    p_image_id: imageId,
  });

  if (error) {
    message.textContent = error.message;
    return;
  }

  await loadData();
  openProductId = getProductIdByImageId(imageId);
  moveToProductPage(openProductId);
  renderProductList();
}

async function updateOrder(button: HTMLButtonElement) {
  const imageId = getImageId(button);
  const wrapper = button.closest<HTMLElement>('.image-row');
  const input = wrapper?.querySelector<HTMLInputElement>('[data-field="display_order"]');
  const message = getRowMessage(button);

  if (!imageId || !input || !message) return;

  message.textContent = '更新中...';

  const productId = getProductIdByImageId(imageId);
  const { error } = await supabase.rpc('update_product_affiliate_image_order', {
    p_image_id: imageId,
    p_display_order: Number(input.value),
  });

  if (error) {
    message.textContent = error.message;
    return;
  }

  await normalizeMediaOrder('affiliate', productId);
  await loadData();
  openProductId = productId;
  moveToProductPage(openProductId);
  renderProductList();
}

async function deleteImage(button: HTMLButtonElement) {
  if (!confirm('この画像または動画を削除しますか？')) return;

  const imageId = getImageId(button);
  const message = getRowMessage(button);

  if (!imageId || !message) return;

  const productId = getProductIdByImageId(imageId);
  message.textContent = '削除中...';

  const { error } = await supabase.rpc('delete_product_affiliate_image', {
    p_image_id: imageId,
  });

  if (error) {
    message.textContent = error.message;
    return;
  }

  await normalizeMediaOrder('affiliate', productId);
  await loadData();
  openProductId = productId;
  moveToProductPage(productId);
  renderProductList();
}

async function previewUploadedFile(form: HTMLFormElement) {
  const message = form.querySelector<HTMLElement>('.form-message');
  const preview = form.querySelector<HTMLElement>('.uploaded-preview');
  const file = getUploadFile(form);

  if (!message || !preview) return;

  revokeUploadPreviewUrl(form);

  if (!file) {
    message.textContent = '未選択';
    preview.innerHTML = `<span class="empty">選択した画像のプレビューがここに表示されます。</span>`;
    return;
  }

  message.textContent = '検証中...';

  try {
    await validateUploadFile(file);
    const previewUrl = URL.createObjectURL(file);
    uploadPreviewUrls.set(form, previewUrl);
    preview.innerHTML = `
      <img src="${escapeAttr(previewUrl)}" alt="選択中の自作画像プレビュー" loading="lazy" decoding="async" />
      <p>${escapeText(file.name)} / ${formatBytes(file.size)}</p>
    `;
    message.textContent = '選択済み。アップロードできます。';
  } catch (error) {
    message.textContent = getErrorMessage(error);
    preview.innerHTML = `<span class="danger-text">プレビューできません。</span>`;
  }
}

async function uploadProductImage(form: HTMLFormElement) {
  const productId = form.dataset.productId;
  const message = form.querySelector<HTMLElement>('.form-message');
  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const file = getUploadFile(form);

  if (!productId || !message || !submitButton) return;

  if (!file) {
    message.textContent = '未選択です。JPG / PNG / WebP画像を選んでください。';
    return;
  }

  submitButton.disabled = true;
  message.textContent = '検証中...';

  let storagePath = '';

  try {
    const extension = await validateUploadFile(file);
    storagePath = createStoragePath(productId, extension);

    message.textContent = 'アップロード中...';
    const { error: uploadError } = await supabase.storage.from(uploadedImageBucket).upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from(uploadedImageBucket).getPublicUrl(storagePath);
    const publicUrl = publicUrlData.publicUrl;

    message.textContent = 'DB保存中...';
    const formData = new FormData(form);
    const { error: rpcError } = await supabase.rpc('create_product_uploaded_image', {
      p_product_id: productId,
      p_storage_bucket: uploadedImageBucket,
      p_storage_path: storagePath,
      p_public_url: publicUrl,
      p_role: String(formData.get('role')) as ImageRole,
      p_alt_text: String(formData.get('alt_text') ?? ''),
      p_caption: String(formData.get('caption') ?? ''),
      p_is_primary: formData.get('is_primary') === 'on',
      p_display_order: Number(formData.get('display_order') ?? 1),
      p_original_filename: file.name,
      p_mime_type: file.type,
      p_file_size_bytes: file.size,
    });

    if (rpcError) {
      await rollbackUploadedStorageObject(storagePath);
      throw rpcError;
    }

    await normalizeMediaOrder('uploaded', productId);
    message.textContent = '完了しました。';
    revokeUploadPreviewUrl(form);
    form.reset();
    await loadData();
    openProductId = productId;
    moveToProductPage(productId);
    renderProductList();
  } catch (error) {
    message.textContent = getErrorMessage(error);
  } finally {
    submitButton.disabled = false;
  }
}

async function setUploadedPrimary(button: HTMLButtonElement) {
  const imageId = getUploadedImageId(button);
  const message = getUploadedRowMessage(button);

  if (!imageId || !message) return;

  message.textContent = '更新中...';

  const { error } = await supabase.rpc('set_product_uploaded_image_primary', {
    p_image_id: imageId,
  });

  if (error) {
    message.textContent = error.message;
    return;
  }

  await loadData();
  openProductId = getProductIdByUploadedImageId(imageId);
  moveToProductPage(openProductId);
  renderProductList();
}

async function updateUploadedImage(button: HTMLButtonElement) {
  const imageId = getUploadedImageId(button);
  const wrapper = button.closest<HTMLElement>('.uploaded-image-row');
  const message = getUploadedRowMessage(button);

  if (!imageId || !wrapper || !message) return;

  const role = wrapper.querySelector<HTMLSelectElement>('[data-field="role"]');
  const altText = wrapper.querySelector<HTMLInputElement>('[data-field="alt_text"]');
  const caption = wrapper.querySelector<HTMLInputElement>('[data-field="caption"]');
  const displayOrder = wrapper.querySelector<HTMLInputElement>('[data-field="display_order"]');

  if (!role || !altText || !caption || !displayOrder) return;

  message.textContent = '更新中...';

  const productId = getProductIdByUploadedImageId(imageId);
  const { error } = await supabase.rpc('update_product_uploaded_image_metadata', {
    p_image_id: imageId,
    p_role: role.value as ImageRole,
    p_alt_text: altText.value,
    p_caption: caption.value,
    p_display_order: Number(displayOrder.value),
  });

  if (error) {
    message.textContent = error.message;
    return;
  }

  await normalizeMediaOrder('uploaded', productId);
  await loadData();
  openProductId = productId;
  moveToProductPage(openProductId);
  renderProductList();
}

async function deleteUploadedImage(button: HTMLButtonElement) {
  if (!confirm('この自作画像を削除しますか？')) return;

  const imageId = getUploadedImageId(button);
  const message = getUploadedRowMessage(button);

  if (!imageId || !message) return;

  const productId = getProductIdByUploadedImageId(imageId);
  message.textContent = '削除中...';

  const { data, error } = await supabase.rpc('delete_product_uploaded_image', {
    p_image_id: imageId,
  });

  if (error) {
    message.textContent = error.message;
    return;
  }

  const removedObject = getRemovedStorageObject(data);
  let storageWarning = '';

  if (removedObject) {
    const { error: storageError } = await supabase.storage
      .from(removedObject.storage_bucket)
      .remove([removedObject.storage_path]);

    if (storageError) {
      storageWarning =
        'DBからの削除は完了しましたが、Storageに孤立ファイルが残った可能性があります。Supabase Storageを確認してください。';
    }
  }

  await normalizeMediaOrder('uploaded', productId);
  await loadData();
  openProductId = productId;
  moveToProductPage(productId);
  renderProductList();

  if (storageWarning) {
    showStatus(storageWarning, 'error');
  }
}

function bindImageDragEvents() {
  document.querySelectorAll<HTMLElement>('.image-row').forEach((row) => {
    row.addEventListener('dragstart', (event) => {
      draggingImageId = row.dataset.imageId ?? '';
      row.classList.add('is-dragging');
      event.dataTransfer?.setData('text/plain', draggingImageId);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
      }
    });

    row.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (!draggingImageId || draggingImageId === row.dataset.imageId) return;

      row.classList.add('is-drag-over');
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('is-drag-over');
    });

    row.addEventListener('drop', async (event) => {
      event.preventDefault();
      row.classList.remove('is-drag-over');

      const targetImageId = row.dataset.imageId ?? '';
      const sourceImageId = draggingImageId || event.dataTransfer?.getData('text/plain') || '';

      if (!sourceImageId || !targetImageId || sourceImageId === targetImageId) return;

      const rect = row.getBoundingClientRect();
      const insertAfterTarget = event.clientY > rect.top + rect.height / 2;

      await reorderImagesByDrag(sourceImageId, targetImageId, insertAfterTarget);
    });

    row.addEventListener('dragend', () => {
      draggingImageId = '';
      document.querySelectorAll<HTMLElement>('.image-row').forEach((item) => {
        item.classList.remove('is-dragging', 'is-drag-over');
      });
    });
  });
}

async function reorderImagesByDrag(sourceImageId: string, targetImageId: string, insertAfterTarget: boolean) {
  const sourceImage = images.find((image) => image.id === sourceImageId);
  const targetImage = images.find((image) => image.id === targetImageId);

  if (!sourceImage || !targetImage) return;

  const productId = String(sourceImage.product_id);
  if (String(targetImage.product_id) !== productId) return;

  const orderedImages = getImagesByProductId(productId);
  const sourceIndex = orderedImages.findIndex((image) => image.id === sourceImageId);
  const targetIndex = orderedImages.findIndex((image) => image.id === targetImageId);

  if (sourceIndex < 0 || targetIndex < 0) return;

  const [movedImage] = orderedImages.splice(sourceIndex, 1);
  const newTargetIndex = orderedImages.findIndex((image) => image.id === targetImageId);
  const insertIndex = newTargetIndex + (insertAfterTarget ? 1 : 0);
  orderedImages.splice(insertIndex, 0, movedImage);

  showStatus('並び順を保存中...', 'normal');

  const { error } = await supabase.rpc('reorder_product_affiliate_media', {
    p_product_id: productId,
    p_ordered_ids: orderedImages.map((image) => image.id),
  });

  if (error) {
    showStatus(error.message, 'error');
    return;
  }

  await loadData();
  openProductId = productId;
  moveToProductPage(productId);
  renderProductList();
}

function matchesVisibleCondition(product: Product) {
  const productId = String(product.id);
  const productImages = getImagesByProductId(productId);
  const label = getProductLabel(product).toLowerCase();
  const brand = getProductBrand(product).toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();

  if (categoryFilter !== 'all' && getProductCategory(product) !== categoryFilter) return false;

  if (normalizedQuery) {
    const idMatches = productId.toLowerCase().includes(normalizedQuery);
    const nameMatches = label.includes(normalizedQuery);
    const brandMatches = brand.includes(normalizedQuery);

    if (!idMatches && !nameMatches && !brandMatches) return false;
  }

  if (filter === 'registered') return productImages.length > 0;
  if (filter === 'unregistered') return productImages.length === 0;

  return true;
}

function getVisibleProducts() {
  return products.filter(matchesVisibleCondition);
}

function getBulkSelectableProducts() {
  const normalizedQuery = query.trim().toLowerCase();
  return products.filter((product) => {
    if (categoryFilter !== 'all' && getProductCategory(product) !== categoryFilter) return false;
    if (!normalizedQuery) return true;
    return [String(product.id), getProductLabel(product), getProductBrand(product)]
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });
}

function moveToProductPage(productId: string) {
  const visibleProducts = getVisibleProducts();
  const productIndex = visibleProducts.findIndex((product) => String(product.id) === productId);

  if (productIndex >= 0) {
    currentPage = Math.floor(productIndex / pageSize) + 1;
  }
}

function openNextUnregisteredProduct(currentProductId: string) {
  const next = findNextUnregisteredProduct(currentProductId);

  if (next) {
    openProductId = String(next.id);
    moveToProductPage(openProductId);
    return;
  }

  openProductId = '';
}

function findNextUnregisteredProduct(currentProductId: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const searchableProducts = products.filter((product) => {
    if (categoryFilter !== 'all' && getProductCategory(product) !== categoryFilter) return false;
    if (!normalizedQuery) return true;

    const productId = String(product.id).toLowerCase();
    const label = getProductLabel(product).toLowerCase();
    const brand = getProductBrand(product).toLowerCase();

    return productId.includes(normalizedQuery) || label.includes(normalizedQuery) || brand.includes(normalizedQuery);
  });
  const currentIndex = searchableProducts.findIndex((product) => String(product.id) === currentProductId);
  const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
  const ordered = [...searchableProducts.slice(startIndex), ...searchableProducts.slice(0, startIndex)];

  return ordered.find((product) => getImagesByProductId(String(product.id)).length === 0) ?? null;
}

function getImagesByProductId(productId: string) {
  return images
    .filter((image) => String(image.product_id) === productId)
    .sort((a, b) => getAffiliateMediaOrder(a) - getAffiliateMediaOrder(b) || a.created_at.localeCompare(b.created_at));
}

function getUploadedImagesByProductId(productId: string) {
  return uploadedImages
    .filter((image) => String(image.product_id) === productId)
    .sort(
      (a, b) =>
        Number(b.is_primary) - Number(a.is_primary) ||
        a.display_order - b.display_order ||
        a.created_at.localeCompare(b.created_at),
    );
}

async function normalizeMediaOrder(kind: 'affiliate' | 'uploaded', productId: string) {
  if (!productId) return;
  const rpcName = kind === 'affiliate'
    ? 'normalize_product_affiliate_media_order'
    : 'normalize_product_uploaded_image_order';
  const { error } = await supabase.rpc(rpcName, { p_product_id: productId });
  if (error) throw error;
}

function getProductLabel(product: Product) {
  if (typeof product.name === 'string' && product.name.trim()) {
    return product.name;
  }

  return `商品ID: ${String(product.id)}`;
}

function getProductBrand(product: Product) {
  for (const key of ['brand', 'maker', 'manufacturer']) {
    const value = product[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return 'ブランド未登録';
}

function getProductCategory(product: Product): string {
  const value = product.category;
  return typeof value === 'string' ? value.trim() : '';
}

function getNextDisplayOrder(productImages: ProductAffiliateImage[]) {
  if (productImages.length === 0) return 1;
  return Math.max(...productImages.map(getAffiliateMediaOrder)) + 1;
}

function getNextUploadedDisplayOrder(productUploadedImages: ProductUploadedImage[]) {
  if (productUploadedImages.length === 0) return 1;
  return Math.max(...productUploadedImages.map((image) => image.display_order)) + 1;
}

function getProductIdByImageId(imageId: string) {
  const image = images.find((item) => item.id === imageId);
  return image ? String(image.product_id) : '';
}

function getProductIdByUploadedImageId(imageId: string) {
  const image = uploadedImages.find((item) => item.id === imageId);
  return image ? String(image.product_id) : '';
}

function getFormHtml(form: HTMLFormElement) {
  return String(new FormData(form).get('rakuten_image_html') ?? '');
}

function getAffiliateMediaType(image: ProductAffiliateImage): 'image' | 'youtube' {
  return image.media_type === 'youtube' ? 'youtube' : 'image';
}

function getAffiliateMediaOrder(image: ProductAffiliateImage): number {
  return Number(image.sort_order ?? image.display_order ?? 9999);
}

function getStoredAffiliateImageUrl(image: ProductAffiliateImage): string {
  if (image.image_url) return image.image_url;
  const template = document.createElement('template');
  template.innerHTML = image.rakuten_image_html || '';
  return template.content.querySelector<HTMLImageElement>('img[src]')?.src ?? '';
}

function syncAffiliateMediaForm(form: HTMLFormElement) {
  const mediaType = form.querySelector<HTMLSelectElement>('select[name="media_type"]')?.value === 'youtube' ? 'youtube' : 'image';
  const htmlField = form.querySelector<HTMLTextAreaElement>('textarea[name="rakuten_image_html"]');
  const youtubeField = form.querySelector<HTMLInputElement>('input[name="youtube_url"]');
  const primaryField = form.querySelector<HTMLInputElement>('input[name="is_primary"]');

  form.querySelectorAll<HTMLElement>('.image-media-field').forEach((field) => {
    field.hidden = mediaType !== 'image';
  });
  form.querySelectorAll<HTMLElement>('.youtube-media-field').forEach((field) => {
    field.hidden = mediaType !== 'youtube';
  });

  if (htmlField) {
    htmlField.disabled = mediaType !== 'image';
    htmlField.required = mediaType === 'image';
  }
  if (youtubeField) {
    youtubeField.disabled = mediaType !== 'youtube';
    youtubeField.required = mediaType === 'youtube';
  }
  if (primaryField) {
    primaryField.disabled = mediaType !== 'image';
    if (mediaType === 'youtube') primaryField.checked = false;
  }
}

function previewAffiliateMedia(form: HTMLFormElement, preview: HTMLElement, message: HTMLElement) {
  const mediaType = form.querySelector<HTMLSelectElement>('select[name="media_type"]')?.value === 'youtube' ? 'youtube' : 'image';

  if (mediaType === 'youtube') {
    const youtubeUrl = form.querySelector<HTMLInputElement>('input[name="youtube_url"]')?.value ?? '';
    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      message.textContent = '対応しているYouTube URLを入力してください。';
      preview.innerHTML = '<span class="danger-text">YouTube URLを確認してください。</span>';
      return;
    }

    message.textContent = `video_id: ${videoId}`;
    preview.innerHTML = `
      <div class="youtube-admin-preview">
        <img src="${escapeAttr(getYouTubeThumbnailUrl(videoId))}" alt="YouTubeサムネイル" loading="lazy" />
        <span class="youtube-play-mark" aria-hidden="true">▶</span>
      </div>
    `;
    return;
  }

  const html = getFormHtml(form);
  const unsafe = detectUnsafeHtml(html);
  if (!html) {
    message.textContent = '楽天HTMLコードを入力してください。';
    preview.innerHTML = '<span class="empty">登録前プレビューがここに表示されます。</span>';
    return;
  }
  if (unsafe) {
    message.textContent = `危険なコードを検出したためプレビューしません: ${unsafe}`;
    preview.innerHTML = '<span class="danger-text">プレビューを停止しました。</span>';
    return;
  }

  message.textContent = '';
  preview.innerHTML = html;
}

function getImageId(element: HTMLElement) {
  return element.closest<HTMLElement>('.image-row')?.dataset.imageId ?? '';
}

function getRowMessage(element: HTMLElement) {
  return element.closest<HTMLElement>('.image-row')?.querySelector<HTMLElement>('.row-message') ?? null;
}

function getUploadedImageId(element: HTMLElement) {
  return element.closest<HTMLElement>('.uploaded-image-row')?.dataset.uploadedImageId ?? '';
}

function getUploadedRowMessage(element: HTMLElement) {
  return element.closest<HTMLElement>('.uploaded-image-row')?.querySelector<HTMLElement>('.row-message') ?? null;
}

function getUploadFile(form: HTMLFormElement) {
  const input = form.querySelector<HTMLInputElement>('input[name="uploaded_file"]');
  return input?.files?.[0] ?? null;
}

async function validateUploadFile(file: File) {
  if (!isAllowedUploadMimeType(file.type)) {
    throw new Error('JPG / PNG / WebP画像だけアップロードできます。SVG、GIF、PDFなどは使えません。');
  }

  if (file.size > maxUploadSizeBytes) {
    throw new Error('ファイルサイズは5MB以下にしてください。');
  }

  if (file.size <= 0) {
    throw new Error('空のファイルはアップロードできません。');
  }

  await ensureImageCanLoad(file);
  return getExtensionByMimeType(file.type);
}

function isAllowedUploadMimeType(value: string): value is UploadedImageMimeType {
  return allowedUploadMimeTypes.includes(value as UploadedImageMimeType);
}

function getExtensionByMimeType(mimeType: UploadedImageMimeType) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  return 'webp';
}

function ensureImageCanLoad(file: File) {
  return new Promise<void>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve();
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('画像として読み込めません。ファイルを確認してください。'));
    };

    image.src = objectUrl;
  });
}

function createStoragePath(productId: string, extension: string) {
  const safeProductId = String(productId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safeProductId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

async function rollbackUploadedStorageObject(storagePath: string) {
  if (!storagePath) return;

  try {
    await supabase.storage.from(uploadedImageBucket).remove([storagePath]);
  } catch (error) {
    console.warn('Uploaded object rollback failed.', error);
  }
}

function getRemovedStorageObject(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate || typeof candidate !== 'object') return null;

  const record = candidate as Record<string, unknown>;
  const storageBucket = record.storage_bucket;
  const storagePath = record.storage_path;

  if (typeof storageBucket !== 'string' || typeof storagePath !== 'string') return null;

  return {
    storage_bucket: storageBucket,
    storage_path: storagePath,
  };
}

function revokeUploadPreviewUrl(form: HTMLFormElement) {
  const previewUrl = uploadPreviewUrls.get(form);
  if (!previewUrl) return;

  URL.revokeObjectURL(previewUrl);
  uploadPreviewUrls.delete(form);
}

function revokeUploadPreviewUrls() {
  uploadPreviewUrls.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
  uploadPreviewUrls.clear();
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function detectUnsafeHtml(html: string) {
  if (/<\s*script\b/i.test(html)) return 'scriptタグ';
  if (/javascript\s*:/i.test(html)) return 'javascript: URL';
  if (/\son[a-z]+\s*=/i.test(html)) return 'イベント属性';
  return '';
}

function showStatus(message: string, type: 'normal' | 'error') {
  const status = document.querySelector<HTMLElement>('#status');
  if (!status) return;

  status.textContent = message;
  status.className = type === 'error' ? 'status error' : 'status';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function escapeText(value: string) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function escapeAttr(value: string) {
  return escapeText(value).replace(/"/g, '&quot;');
}

function cssEscape(value: string) {
  if ('CSS' in window && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/"/g, '\\"');
}
