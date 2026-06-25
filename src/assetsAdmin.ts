import './assetsAdmin.css';
import JSZip from 'jszip';
import { supabase } from './lib/supabase';
import {
  siteAssetTypes,
  type ImageMetadata,
  type SiteAsset,
  type SiteAssetMimeType,
  type SiteAssetType,
  type StoredImage,
  type UpdateSiteAssetResult,
} from './siteAssetTypes';

const appElement = document.querySelector<HTMLDivElement>('#assets-admin-app');

if (!appElement) {
  throw new Error('#assets-admin-app was not found.');
}

const app: HTMLDivElement = appElement;
const storageBucket = 'site-assets';
const maxFileSize = 5 * 1024 * 1024;
const maxIconZipEntries = 100;
const allowedMimeTypes: SiteAssetMimeType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml'];
const uploadAccept = 'image/avif,image/webp,image/png,image/jpeg,image/svg+xml,.avif,.webp,.png,.jpg,.jpeg,.svg';
const iconZipAccept = 'application/zip,application/x-zip-compressed,.zip';
const ASSET_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const CREATE_DRAFT_STORAGE_KEY = 'irodori_site_asset_create_draft';

type BrandOption = {
  id: string;
  slug: string;
  display_name: string;
  sort_order?: number | null;
  logo_asset_key: string | null;
  hero_asset_key?: string | null;
};

const assetTypeLabels: Record<SiteAssetType, string> = {
  hero: 'メインバナー',
  campaign: 'キャンペーン',
  feature: '特集',
  diagnosis: '診断',
  category: 'カテゴリ',
  article: '記事アイキャッチ',
  brand_logo: 'ブランドロゴ',
  brand_hero: 'ブランドヒーロー',
  icon: 'アイコン',
};

const sizeRecommendations: Record<SiteAssetType, string> = {
  hero: 'PC 1600×600 / スマホ 750×900',
  campaign: 'PC 1200×400 / スマホ 750×600',
  feature: 'PC 800×500 / スマホ 750×600',
  diagnosis: 'PC 800×500 / スマホ 750×600',
  category: 'PC・スマホ 800×800',
  article: 'PC・スマホ 1200×630',
  brand_logo: '正方形または横長',
  brand_hero: 'PC 1600×700 / スマホ 750×900',
  icon: 'SVG推奨 / 48×48表示想定 / ZIP一括登録可',
};

let assets: SiteAsset[] = [];
let query = '';
let typeFilter: 'all' | SiteAssetType = 'all';
let brands: BrandOption[] = [];
let brandHeroLinkAvailable = true;
const previewUrls = new Set<string>();
const selectedIconIds = new Set<string>();

void init();

async function init() {
  supabase.auth.onAuthStateChange(() => {
    void render();
  });

  await render();
}

async function render() {
  revokePreviewUrls();
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

function renderLogin() {
  app.innerHTML = `
    <main class="auth-page">
      <section class="auth-panel">
        <h1>サイト画像素材管理</h1>
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

    if (error && message) message.textContent = error.message;
  });
}

function renderForbidden() {
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

async function checkAdmin() {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) {
    console.error(error);
    return false;
  }
  return data === true;
}

async function renderAdmin() {
  await loadBrands();
  app.innerHTML = `
    <header class="admin-header">
      <div>
        <h1>サイト画像素材管理</h1>
        <p>バナー、カテゴリ画像、記事画像、ブランド画像を管理します。</p>
      </div>
      <div class="header-actions">
        <a href="/admin.html">商品画像管理</a>
        <button id="logout-button" type="button">ログアウト</button>
      </div>
    </header>
    <main class="admin-main">
      <section class="create-section" aria-labelledby="create-heading">
        <div class="section-heading">
          <div><p class="eyebrow">NEW ASSET</p><h2 id="create-heading">素材を登録</h2></div>
        </div>
        ${renderAssetForm()}
      </section>
      <section class="library-section" aria-labelledby="library-heading">
        <div class="section-heading library-heading">
          <div><p class="eyebrow">ASSET LIBRARY</p><h2 id="library-heading">登録済み素材</h2></div>
          <div class="library-count" id="library-count">0件</div>
        </div>
        <div class="toolbar">
          <label>検索<input id="asset-search" type="search" value="${escapeAttr(query)}" placeholder="asset_key / タイトル" /></label>
          <label>用途<select id="asset-type-filter"><option value="all">すべて</option>${renderTypeOptions(typeFilter)}</select></label>
        </div>
        <div id="icon-bulk-actions" class="icon-bulk-actions" hidden></div>
        <p id="page-message" class="page-message" aria-live="polite">読み込み中...</p>
        <div id="asset-list" class="asset-list"></div>
      </section>
    </main>
  `;

  bindLogout();
  bindCreateForm();
  bindToolbar();
  try {
    await loadAssets();
    renderAssetList();
  } catch (error) {
    showPageMessage(getErrorMessage(error), 'warning');
  }
}

function renderAssetForm() {
  return `
    <form id="create-asset-form" class="asset-form">
      <div class="field-grid identity-grid">
        <label>asset_key<input name="asset_key" required placeholder="home_main_hero" /></label>
        <label>用途<select name="asset_type">${renderTypeOptions('hero')}</select></label>
        ${renderBrandField()}
        <label>並び順<input name="display_order" type="number" min="1" value="1" required /></label>
        <label class="toggle-label"><input name="is_published" type="checkbox" />公開する</label>
      </div>
      <p class="size-recommendation" data-size-recommendation>${sizeRecommendations.hero}</p>
      <div class="field-grid copy-grid">
        <label>タイトル<input name="title" /></label>
        <label>altテキスト<input name="alt_text" /></label>
        <label>リンク先<input name="link_url" placeholder="/products.html または https://..." /></label>
      </div>
      ${renderIconFields()}
      <label>キャプション<textarea name="caption" rows="2"></textarea></label>
      <div class="field-grid period-grid">
        <label>公開開始<input name="starts_at" type="datetime-local" /></label>
        <label>公開終了<input name="ends_at" type="datetime-local" /></label>
      </div>
      <div class="upload-grid">
        ${renderUploadField('desktop_file', 'PC画像（必須）', true, 'desktop')}
        ${renderUploadField('mobile_file', 'スマホ画像（任意）', false, 'mobile')}
      </div>
      <div class="form-actions"><button type="submit" class="primary-action">素材を登録</button><button type="button" class="quiet-button" data-action="clear-create-form">入力をクリア</button></div>
      <p class="form-message" aria-live="polite"></p>
    </form>
  `;
}

function renderBrandField(selectedBrandId = '') {
  return `
    <label class="brand-select-field" data-brand-field hidden>
      ブランド
      <select name="brand_id">
        <option value="">ブランドを選択</option>
        ${brands.map((brand) => `<option value="${escapeAttr(brand.id)}" ${brand.id === selectedBrandId ? 'selected' : ''}>${escapeText(brand.display_name)} (${escapeText(brand.slug)})</option>`).join('')}
      </select>
      <small data-brand-link-note></small>
    </label>
  `;
}

function renderIconFields(isEdit = false) {
  return `
    <section class="icon-upload-panel" data-icon-fields hidden>
      <div>
        <h3>アイコンSVGを登録</h3>
        <p>SVGを1つずつ登録するか、SVGをまとめたZIPをアップロードできます。</p>
      </div>
      <div class="field-grid icon-upload-grid">
        <label>
          単体SVGアップロード
          <input name="icon_svg_file" type="file" accept="image/svg+xml,.svg" />
          <small>ファイル名から asset_key / title / alt_text を自動生成します。</small>
        </label>
        <label>
          ZIP一括アップロード
          <input name="icon_zip_file" type="file" accept="${iconZipAccept}" ${isEdit ? 'disabled' : ''} />
          <small>${isEdit ? '一括登録は新規登録フォームで利用できます。' : `SVGのみ最大${maxIconZipEntries}件まで登録します。`}</small>
        </label>
      </div>
      <ul class="icon-upload-result" data-icon-upload-result hidden></ul>
    </section>
  `;
}

async function loadBrands() {
  const orderedWithHero = await supabase
    .from('brands')
    .select('id, slug, display_name, sort_order, logo_asset_key, hero_asset_key')
    .eq('is_published', true)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('display_name', { ascending: true });

  if (!orderedWithHero.error) {
    brands = (orderedWithHero.data ?? []) as BrandOption[];
    brandHeroLinkAvailable = true;
    return;
  }

  const withHero = await supabase
    .from('brands')
    .select('id, slug, display_name, logo_asset_key, hero_asset_key')
    .eq('is_published', true)
    .order('display_name', { ascending: true });

  if (!withHero.error) {
    brands = (withHero.data ?? []) as BrandOption[];
    brandHeroLinkAvailable = true;
    return;
  }

  const fallback = await supabase
    .from('brands')
    .select('id, slug, display_name, logo_asset_key')
    .eq('is_published', true)
    .order('display_name', { ascending: true });
  if (fallback.error) {
    console.error('ブランド一覧を取得できませんでした。', fallback.error);
    brands = [];
    brandHeroLinkAvailable = false;
    return;
  }
  brands = (fallback.data ?? []) as BrandOption[];
  brandHeroLinkAvailable = false;
}

function renderUploadField(name: string, label: string, required: boolean, variant: 'desktop' | 'mobile') {
  return `
    <label class="upload-field">
      <span>${label}</span>
      <input name="${name}" type="file" accept="${uploadAccept}" ${required ? 'required' : ''} />
      <span class="file-note">JPEG・PNG・WebP・AVIF・SVG / 最大5MB</span>
      <span class="image-preview" data-preview="${variant}"><span>プレビュー未選択</span></span>
    </label>
  `;
}

async function loadAssets() {
  const { data, error } = await supabase.rpc('list_site_assets');
  if (error) throw error;
  assets = (data ?? []) as SiteAsset[];
}

function renderAssetList() {
  const list = document.querySelector<HTMLElement>('#asset-list');
  const count = document.querySelector<HTMLElement>('#library-count');
  const message = document.querySelector<HTMLElement>('#page-message');
  if (!list || !count || !message) return;

  const normalizedQuery = query.trim().toLowerCase();
  const visibleAssets = assets.filter((asset) => {
    const matchesType = typeFilter === 'all' || asset.asset_type === typeFilter;
    const matchesQuery = !normalizedQuery || `${asset.asset_key} ${asset.title}`.toLowerCase().includes(normalizedQuery);
    return matchesType && matchesQuery;
  });
  const currentIconIds = new Set(assets.filter((asset) => asset.asset_type === 'icon').map((asset) => asset.id));
  selectedIconIds.forEach((id) => {
    if (!currentIconIds.has(id)) selectedIconIds.delete(id);
  });
  const visibleIconAssets = visibleAssets.filter((asset) => asset.asset_type === 'icon');
  const visibleIconIds = new Set(visibleIconAssets.map((asset) => asset.id));
  selectedIconIds.forEach((id) => {
    if (!visibleIconIds.has(id)) selectedIconIds.delete(id);
  });
  const isIconGrid = visibleAssets.length > 0 && visibleAssets.every((asset) => asset.asset_type === 'icon');

  count.textContent = `${visibleAssets.length}件`;
  message.textContent = visibleAssets.length ? '' : '条件に一致する素材はありません。';
  list.classList.toggle('asset-list--icons', isIconGrid);
  list.innerHTML = visibleAssets.map(renderAssetCard).join('');
  renderIconBulkActions(visibleIconAssets);
  bindAssetCards();
  bindIconBulkActions(visibleIconAssets);
  updateIconSelectionUi();
}

function renderAssetCard(asset: SiteAsset) {
  const publication = getPublicationState(asset);
  const selectedBrandId = getBrandIdForAsset(asset);
  const isIcon = asset.asset_type === 'icon';
  const isSelected = selectedIconIds.has(asset.id);
  const mobileUrl = asset.mobile_image_url || asset.desktop_image_url;
  const mobileDimensions = asset.mobile_width && asset.mobile_height
    ? `${asset.mobile_width}×${asset.mobile_height}`
    : `PC画像を使用 (${asset.desktop_width}×${asset.desktop_height})`;
  const selectionMarkup = isIcon
    ? `
      <label class="icon-select-control">
        <input type="checkbox" data-icon-select value="${escapeAttr(asset.id)}" ${isSelected ? 'checked' : ''} aria-label="${escapeAttr(asset.asset_key)}を選択" />
        <span>選択</span>
      </label>
    `
    : '';
  const previewMarkup = isIcon
    ? `
      <div class="current-previews current-previews--icon">
        <figure>
          <div class="preview-frame icon-frame"><img src="${escapeAttr(asset.desktop_image_url)}" alt="${escapeAttr(asset.alt_text)}" loading="lazy" /></div>
          <figcaption>${asset.desktop_width}×${asset.desktop_height}</figcaption>
        </figure>
      </div>
    `
    : `
      <div class="current-previews">
        <figure><div class="preview-frame desktop-frame"><img src="${escapeAttr(asset.desktop_image_url)}" alt="${escapeAttr(asset.alt_text)}" loading="lazy" /></div><figcaption>PC ${asset.desktop_width}×${asset.desktop_height}</figcaption></figure>
        <figure><div class="preview-frame mobile-frame"><img src="${escapeAttr(mobileUrl)}" alt="${escapeAttr(asset.alt_text)}" loading="lazy" /></div><figcaption>スマホ ${mobileDimensions}</figcaption></figure>
      </div>
    `;

  return `
    <article class="asset-card asset-card--${escapeAttr(asset.asset_type)}" data-asset-id="${escapeAttr(asset.id)}">
      <div class="asset-card-head">
        <div>
          <div class="asset-meta"><span class="type-badge">${escapeText(assetTypeLabels[asset.asset_type])}</span><span class="status-badge ${publication.className}">${publication.label}</span></div>
          <h3>${escapeText(asset.asset_key)}</h3>
          <p>${escapeText(asset.title || 'タイトル未設定')}</p>
          ${isIcon ? `<p class="asset-card-alt">${escapeText(asset.alt_text || 'alt未設定')}</p>` : ''}
        </div>
        <div class="asset-card-actions">
          ${selectionMarkup}
          <button type="button" class="quiet-button" data-action="toggle-edit" aria-expanded="false">編集</button>
        </div>
      </div>
      ${previewMarkup}
      <form class="asset-form edit-form" hidden>
        <div class="field-grid identity-grid">
          <label>asset_key<input name="asset_key" value="${escapeAttr(asset.asset_key)}" required /></label>
          <label>用途<select name="asset_type">${renderTypeOptions(asset.asset_type)}</select></label>
          ${renderBrandField(selectedBrandId)}
          <label>並び順<input name="display_order" type="number" min="1" value="${asset.display_order}" required /></label>
          <label class="toggle-label"><input name="is_published" type="checkbox" ${asset.is_published ? 'checked' : ''} />公開する</label>
        </div>
        <p class="size-recommendation" data-size-recommendation>${escapeText(sizeRecommendations[asset.asset_type])}</p>
        <div class="field-grid copy-grid">
          <label>タイトル<input name="title" value="${escapeAttr(asset.title)}" /></label>
          <label>altテキスト<input name="alt_text" value="${escapeAttr(asset.alt_text)}" /></label>
          <label>リンク先<input name="link_url" value="${escapeAttr(asset.link_url ?? '')}" placeholder="/products.html または https://..." /></label>
        </div>
        ${renderIconFields(true)}
        <label>キャプション<textarea name="caption" rows="2">${escapeText(asset.caption)}</textarea></label>
        <div class="field-grid period-grid">
          <label>公開開始<input name="starts_at" type="datetime-local" value="${escapeAttr(toDatetimeLocal(asset.starts_at))}" /></label>
          <label>公開終了<input name="ends_at" type="datetime-local" value="${escapeAttr(toDatetimeLocal(asset.ends_at))}" /></label>
        </div>
        <div class="upload-grid compact-upload-grid">
          ${renderReplacementField('desktop_file', 'PC画像を差し替え', 'desktop', asset.desktop_image_url, `${asset.desktop_width}×${asset.desktop_height}`)}
          ${renderReplacementField('mobile_file', 'スマホ画像を差し替え', 'mobile', mobileUrl, mobileDimensions)}
        </div>
        <label class="remove-mobile"><input name="remove_mobile" type="checkbox" ${asset.mobile_image_url ? '' : 'disabled'} />現在のスマホ画像を削除し、PC画像を使用する</label>
        <div class="form-actions">
          <button type="submit" class="primary-action">更新</button>
          <button type="button" class="danger-action" data-action="delete">削除</button>
        </div>
        <p class="form-message" aria-live="polite"></p>
      </form>
    </article>
  `;
}

function renderReplacementField(name: string, label: string, variant: 'desktop' | 'mobile', url: string, dimensions: string) {
  return `
    <label class="upload-field">
      <span>${label}</span>
      <input name="${name}" type="file" accept="${uploadAccept}" />
      <span class="file-note">未選択なら現在の画像を維持</span>
      <span class="image-preview" data-preview="${variant}"><img src="${escapeAttr(url)}" alt="" /><small>${escapeText(dimensions)}</small></span>
    </label>
  `;
}

function bindLogout() {
  document.querySelector<HTMLButtonElement>('#logout-button')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });
}

function bindCreateForm() {
  const form = document.querySelector<HTMLFormElement>('#create-asset-form');
  if (!form) return;
  restoreCreateDraft(form);
  bindAssetTypeRecommendation(form);
  bindFilePreview(form, 'desktop_file', 'desktop');
  bindFilePreview(form, 'mobile_file', 'mobile');
  form.addEventListener('input', () => saveCreateDraft(form));
  form.addEventListener('change', () => saveCreateDraft(form));
  form.querySelector<HTMLButtonElement>('[data-action="clear-create-form"]')?.addEventListener('click', () => {
    clearCreateDraft();
    form.reset();
    syncBrandControls(form, false);
    form.querySelectorAll<HTMLElement>('.image-preview').forEach((preview) => {
      preview.innerHTML = '<span>プレビュー未選択</span>';
    });
    setFormMessage(form, '入力内容をクリアしました。', 'normal');
    syncIconControls(form);
  });
  form.addEventListener('submit', (event) => void handleCreate(event));
}

function bindToolbar() {
  document.querySelector<HTMLInputElement>('#asset-search')?.addEventListener('input', (event) => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    query = input.value;
    renderAssetList();
  });
  document.querySelector<HTMLSelectElement>('#asset-type-filter')?.addEventListener('change', (event) => {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    typeFilter = select.value as typeof typeFilter;
    renderAssetList();
  });
}

function bindAssetCards() {
  document.querySelectorAll<HTMLElement>('.asset-card').forEach((card) => {
    const form = card.querySelector<HTMLFormElement>('.edit-form');
    const toggle = card.querySelector<HTMLButtonElement>('[data-action="toggle-edit"]');
    if (!form || !toggle) return;

    toggle.addEventListener('click', () => {
      form.hidden = !form.hidden;
      card.classList.toggle('is-editing', !form.hidden);
      toggle.textContent = form.hidden ? '編集' : '閉じる';
      toggle.setAttribute('aria-expanded', String(!form.hidden));
    });
    bindAssetTypeRecommendation(form);
    bindFilePreview(form, 'desktop_file', 'desktop');
    bindFilePreview(form, 'mobile_file', 'mobile');

    const mobileInput = getFileInput(form, 'mobile_file');
    const removeMobile = form.elements.namedItem('remove_mobile');
    if (removeMobile instanceof HTMLInputElement && mobileInput) {
      mobileInput.addEventListener('change', () => {
        if (mobileInput.files?.length) removeMobile.checked = false;
      });
      removeMobile.addEventListener('change', () => {
        if (removeMobile.checked) mobileInput.value = '';
      });
    }

    form.addEventListener('submit', (event) => void handleUpdate(event));
    form.querySelector<HTMLButtonElement>('[data-action="delete"]')?.addEventListener('click', () => void handleDelete(card));

    const iconSelect = card.querySelector<HTMLInputElement>('[data-icon-select]');
    iconSelect?.addEventListener('change', () => {
      const id = iconSelect.value;
      if (iconSelect.checked) selectedIconIds.add(id);
      else selectedIconIds.delete(id);
      updateIconSelectionUi();
    });
  });
}

function renderIconBulkActions(visibleIconAssets: SiteAsset[]) {
  const container = document.querySelector<HTMLElement>('#icon-bulk-actions');
  if (!container) return;
  if (visibleIconAssets.length === 0) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  container.hidden = false;
  container.innerHTML = `
    <div>
      <strong>アイコン一括操作</strong>
      <span data-icon-selected-count>${selectedIconIds.size}件選択中</span>
    </div>
    <div class="icon-bulk-buttons">
      <button type="button" class="quiet-button" data-action="select-visible-icons">すべて選択</button>
      <button type="button" class="quiet-button" data-action="clear-icon-selection">選択解除</button>
      <button type="button" class="danger-action" data-action="delete-selected-icons" disabled>選択したアイコンを削除</button>
    </div>
  `;
}

function bindIconBulkActions(visibleIconAssets: SiteAsset[]) {
  const container = document.querySelector<HTMLElement>('#icon-bulk-actions');
  if (!container || container.hidden) return;

  container.querySelector<HTMLButtonElement>('[data-action="select-visible-icons"]')?.addEventListener('click', () => {
    visibleIconAssets.forEach((asset) => selectedIconIds.add(asset.id));
    updateIconSelectionUi();
  });

  container.querySelector<HTMLButtonElement>('[data-action="clear-icon-selection"]')?.addEventListener('click', () => {
    selectedIconIds.clear();
    updateIconSelectionUi();
  });

  container.querySelector<HTMLButtonElement>('[data-action="delete-selected-icons"]')?.addEventListener('click', () => void handleDeleteSelectedIcons());
}

function updateIconSelectionUi() {
  document.querySelectorAll<HTMLElement>('.asset-card--icon').forEach((card) => {
    const id = card.dataset.assetId ?? '';
    const selected = selectedIconIds.has(id);
    card.classList.toggle('is-selected', selected);
    const checkbox = card.querySelector<HTMLInputElement>('[data-icon-select]');
    if (checkbox) checkbox.checked = selected;
  });

  const selectedCount = selectedIconIds.size;
  document.querySelectorAll<HTMLElement>('[data-icon-selected-count]').forEach((element) => {
    element.textContent = `${selectedCount}件選択中`;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-action="delete-selected-icons"]').forEach((button) => {
    button.disabled = selectedCount === 0;
  });
}

function bindAssetTypeRecommendation(form: HTMLFormElement) {
  const select = form.elements.namedItem('asset_type');
  const recommendation = form.querySelector<HTMLElement>('[data-size-recommendation]');
  if (!(select instanceof HTMLSelectElement) || !recommendation) return;
  select.addEventListener('change', () => {
    recommendation.textContent = sizeRecommendations[select.value as SiteAssetType];
    syncBrandControls(form, true);
    syncIconControls(form);
  });
  const brandSelect = form.elements.namedItem('brand_id');
  if (brandSelect instanceof HTMLSelectElement) {
    brandSelect.addEventListener('change', () => syncBrandControls(form, true));
  }
  const titleInput = form.elements.namedItem('title');
  if (titleInput instanceof HTMLInputElement) {
    titleInput.addEventListener('input', () => syncAutomaticAlt(form));
  }
  const altInput = form.elements.namedItem('alt_text');
  if (altInput instanceof HTMLInputElement) {
    const suggestion = getSuggestedAlt(form);
    if (suggestion && altInput.value.trim() === suggestion) altInput.dataset.generatedAlt = suggestion;
    altInput.addEventListener('input', () => {
      if (altInput.value !== altInput.dataset.generatedAlt) delete altInput.dataset.generatedAlt;
    });
  }
  syncBrandControls(form, false);
  bindIconFileInputs(form);
  syncIconControls(form);
}

function bindIconFileInputs(form: HTMLFormElement) {
  const svgInput = getFileInput(form, 'icon_svg_file');
  const zipInput = getFileInput(form, 'icon_zip_file');
  svgInput?.addEventListener('change', async () => {
    const file = svgInput.files?.[0];
    if (!file) return;
    zipInput && (zipInput.value = '');
    try {
      await readImageMetadata(file);
      applyIconMetadataFromFileName(form, file.name);
      setFormMessage(form, 'アイコンSVGを選択しました。', 'normal');
    } catch (error) {
      svgInput.value = '';
      setFormMessage(form, getErrorMessage(error), 'error');
    }
    syncIconControls(form);
  });
  zipInput?.addEventListener('change', () => {
    if (zipInput.files?.[0]) {
      svgInput && (svgInput.value = '');
      const assetKeyInput = form.elements.namedItem('asset_key');
      if (assetKeyInput instanceof HTMLInputElement) {
        assetKeyInput.required = false;
      }
      setFormMessage(form, 'ZIP一括登録を選択しました。', 'normal');
    }
    syncIconControls(form);
  });
}

function syncIconControls(form: HTMLFormElement) {
  const typeSelect = form.elements.namedItem('asset_type');
  const assetKeyInput = form.elements.namedItem('asset_key');
  const desktopInput = getFileInput(form, 'desktop_file');
  const mobileInput = getFileInput(form, 'mobile_file');
  const iconPanel = form.querySelector<HTMLElement>('[data-icon-fields]');
  const zipInput = getFileInput(form, 'icon_zip_file');
  const removeMobile = form.querySelector<HTMLElement>('.remove-mobile');
  if (!(typeSelect instanceof HTMLSelectElement) || !(assetKeyInput instanceof HTMLInputElement) || !iconPanel) return;

  const isIcon = typeSelect.value === 'icon';
  const hasZip = Boolean(zipInput?.files?.[0]);
  iconPanel.hidden = !isIcon;
  form.querySelectorAll<HTMLElement>('.upload-grid').forEach((grid) => {
    grid.hidden = isIcon;
  });
  assetKeyInput.required = !isIcon || !hasZip;
  if (desktopInput) desktopInput.required = !isIcon;
  if (mobileInput) mobileInput.required = false;
  if (removeMobile) removeMobile.hidden = isIcon;

  form.querySelectorAll<HTMLElement>('[data-brand-field]').forEach((field) => {
    if (isIcon) field.hidden = true;
  });
}

function syncBrandControls(form: HTMLFormElement, generateAssetKey: boolean) {
  const typeSelect = form.elements.namedItem('asset_type');
  const brandSelect = form.elements.namedItem('brand_id');
  const assetKeyInput = form.elements.namedItem('asset_key');
  const field = form.querySelector<HTMLElement>('[data-brand-field]');
  const note = form.querySelector<HTMLElement>('[data-brand-link-note]');
  if (!(typeSelect instanceof HTMLSelectElement) || !(brandSelect instanceof HTMLSelectElement) || !(assetKeyInput instanceof HTMLInputElement) || !field) return;

  const assetType = typeSelect.value as SiteAssetType;
  const isBrandAsset = assetType === 'brand_logo' || assetType === 'brand_hero';
  field.hidden = !isBrandAsset;
  brandSelect.required = isBrandAsset;
  if (isBrandAsset) {
    if (note) {
      note.textContent = assetType === 'brand_hero' && !brandHeroLinkAvailable
        ? 'hero_asset_keyが未適用です。素材登録のみ行えます。'
        : '保存後にブランド情報へasset_keyを紐付けます。';
      note.dataset.tone = assetType === 'brand_hero' && !brandHeroLinkAvailable ? 'warning' : 'normal';
    }

    const brand = brands.find((item) => item.id === brandSelect.value);
    if (generateAssetKey && brand) {
      assetKeyInput.value = assetType === 'brand_logo' ? `brand_logo_${brand.slug}` : `brand_hero_${brand.slug}`;
    }
  }
  syncAutomaticAlt(form);
}

function syncAutomaticAlt(form: HTMLFormElement) {
  const altInput = form.elements.namedItem('alt_text');
  if (!(altInput instanceof HTMLInputElement)) return;
  const suggestion = getSuggestedAlt(form);
  const currentAlt = altInput.value.trim();
  const previousGeneratedAlt = altInput.dataset.generatedAlt ?? '';
  if (!suggestion) {
    if (previousGeneratedAlt && currentAlt === previousGeneratedAlt) {
      altInput.value = '';
      delete altInput.dataset.generatedAlt;
    }
    return;
  }
  if (currentAlt && currentAlt !== previousGeneratedAlt) return;

  altInput.value = suggestion;
  altInput.dataset.generatedAlt = suggestion;
}

function getSuggestedAlt(form: HTMLFormElement) {
  const typeSelect = form.elements.namedItem('asset_type');
  const brandSelect = form.elements.namedItem('brand_id');
  const titleInput = form.elements.namedItem('title');
  if (!(typeSelect instanceof HTMLSelectElement)) return '';

  const assetType = typeSelect.value;
  const title = titleInput instanceof HTMLInputElement ? titleInput.value.trim() : '';
  const brand = brandSelect instanceof HTMLSelectElement
    ? brands.find((item) => item.id === brandSelect.value)
    : undefined;

  if (assetType === 'brand_logo' && brand) return `${brand.display_name} ロゴ`;
  if (assetType === 'brand_hero' && brand) return `${brand.display_name} ブランドイメージ`;
  if (assetType === 'icon' && title) return `${title} アイコン`;
  if ((assetType === 'hero' || assetType === 'main_banner') && title) return title;
  if ((assetType === 'category' || assetType === 'category_image') && title) return `${title} カテゴリ画像`;
  if ((assetType === 'article' || assetType === 'article_image') && title) return `${title} 記事画像`;
  return '';
}

function saveCreateDraft(form: HTMLFormElement) {
  const draft: Record<string, string | boolean> = {};
  const fieldNames = [
    'asset_key', 'asset_type', 'brand_id', 'display_order', 'is_published',
    'title', 'alt_text', 'link_url', 'caption', 'starts_at', 'ends_at',
  ];
  for (const name of fieldNames) {
    const control = form.elements.namedItem(name);
    if (control instanceof HTMLInputElement && control.type === 'checkbox') draft[name] = control.checked;
    else if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) draft[name] = control.value;
  }
  try {
    sessionStorage.setItem(CREATE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn('入力内容を一時保存できませんでした。', error);
  }
}

function restoreCreateDraft(form: HTMLFormElement) {
  try {
    const raw = sessionStorage.getItem(CREATE_DRAFT_STORAGE_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw) as Record<string, unknown>;
    Object.entries(draft).forEach(([name, value]) => {
      const control = form.elements.namedItem(name);
      if (control instanceof HTMLInputElement && control.type === 'checkbox') control.checked = value === true;
      else if ((control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) && typeof value === 'string') control.value = value;
    });
  } catch (error) {
    console.warn('一時保存した入力内容を復元できませんでした。', error);
  }
}

function clearCreateDraft() {
  try {
    sessionStorage.removeItem(CREATE_DRAFT_STORAGE_KEY);
  } catch (error) {
    console.warn('一時保存した入力内容を削除できませんでした。', error);
  }
}

function getBrandIdForAsset(asset: SiteAsset) {
  if (asset.asset_type === 'brand_logo') {
    return brands.find((brand) =>
      brand.logo_asset_key === asset.asset_key
      || asset.asset_key === `brand_logo_${brand.slug}`
      || asset.asset_key === `brand_${brand.slug}_logo`,
    )?.id ?? '';
  }
  if (asset.asset_type === 'brand_hero') {
    return brands.find((brand) =>
      brand.hero_asset_key === asset.asset_key
      || asset.asset_key === `brand_hero_${brand.slug}`
      || asset.asset_key === `brand_${brand.slug}_hero`,
    )?.id ?? '';
  }
  return '';
}

function bindFilePreview(form: HTMLFormElement, inputName: string, variant: 'desktop' | 'mobile') {
  const input = getFileInput(form, inputName);
  const preview = form.querySelector<HTMLElement>(`[data-preview="${variant}"]`);
  if (!input || !preview) return;
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const metadata = await readImageMetadata(file);
      const url = URL.createObjectURL(file);
      previewUrls.add(url);
      preview.innerHTML = `<img src="${escapeAttr(url)}" alt="" /><small>${metadata.width}×${metadata.height} / ${escapeText(formatBytes(file.size))}</small>`;
    } catch (error) {
      input.value = '';
      setFormMessage(form, getErrorMessage(error), 'error');
    }
  });
}

async function handleCreate(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;

  const assetTypeInput = form.elements.namedItem('asset_type');
  const isIcon = assetTypeInput instanceof HTMLSelectElement && assetTypeInput.value === 'icon';
  const iconSvgFile = getFileInput(form, 'icon_svg_file')?.files?.[0] ?? null;
  const iconZipFile = getFileInput(form, 'icon_zip_file')?.files?.[0] ?? null;

  if (isIcon && iconZipFile) {
    await handleIconZipCreate(form, iconZipFile);
    return;
  }

  if (isIcon && iconSvgFile) {
    applyIconMetadataFromFileName(form, iconSvgFile.name);
  }

  if (isIcon && !iconSvgFile) {
    setFormMessage(form, 'アイコンSVGまたはZIPファイルを選択してください。', 'error');
    return;
  }

  let fields: ReturnType<typeof readFormFields>;
  try {
    const assetKey = readAssetKeyAtSubmit(form);
    fields = readFormFields(form, assetKey);
  } catch (error) {
    setFormMessage(form, getErrorMessage(error), 'error');
    return;
  }

  const desktopFile = iconSvgFile ?? getFileInput(form, 'desktop_file')?.files?.[0];
  const mobileFile = getFileInput(form, 'mobile_file')?.files?.[0];
  if (!desktopFile) {
    setFormMessage(form, 'PC画像を選択してください。', 'error');
    return;
  }

  const uploadedPaths: string[] = [];
  setFormBusy(form, true);
  try {
    setFormMessage(form, '画像を確認しています...', 'normal');
    const desktopMetadata = await readImageMetadata(desktopFile);
    const mobileMetadata = mobileFile ? await readImageMetadata(mobileFile) : null;

    setFormMessage(form, 'PC画像をアップロードしています...', 'normal');
    const desktopImage = await uploadImage(desktopMetadata, fields.assetKey, 'desktop');
    uploadedPaths.push(desktopImage.storagePath);

    let mobileImage: StoredImage | null = null;
    if (mobileMetadata) {
      setFormMessage(form, 'スマホ画像をアップロードしています...', 'normal');
      mobileImage = await uploadImage(mobileMetadata, fields.assetKey, 'mobile');
      uploadedPaths.push(mobileImage.storagePath);
    }

    setFormMessage(form, '登録情報を保存しています...', 'normal');
    const { error } = await supabase.rpc('create_site_asset', buildRpcPayload(fields, desktopImage, mobileImage));
    if (error) throw error;
    const brandLinkWarning = await linkBrandAsset(fields);

    await loadAssets();
    clearCreateDraft();
    form.reset();
    form.querySelectorAll<HTMLElement>('.image-preview').forEach((preview) => {
      preview.innerHTML = '<span>プレビュー未選択</span>';
    });
    renderAssetList();
    const recommendation = form.querySelector<HTMLElement>('[data-size-recommendation]');
    if (recommendation) recommendation.textContent = sizeRecommendations.hero;
    syncBrandControls(form, false);
    syncIconControls(form);
    setFormMessage(form, brandLinkWarning || '登録しました。', brandLinkWarning ? 'warning' : 'success');
  } catch (error) {
    const rollbackWarning = await rollbackUploads(uploadedPaths);
    setFormMessage(form, `${getErrorMessage(error)}${rollbackWarning}`, 'error');
  } finally {
    setFormBusy(form, false);
  }
}

type IconUploadResult = {
  fileName: string;
  status: 'success' | 'skip' | 'error';
  message: string;
};

async function handleIconZipCreate(form: HTMLFormElement, zipFile: File) {
  if (!/\.zip$/i.test(zipFile.name)) {
    setFormMessage(form, 'ZIPファイルを選択してください。', 'error');
    return;
  }
  if (zipFile.size <= 0 || zipFile.size > maxFileSize) {
    setFormMessage(form, 'ZIPファイルは5MB以下にしてください。', 'error');
    return;
  }

  let baseFields: ReturnType<typeof readFormFields>;
  try {
    baseFields = readFormFields(form, 'icon_batch');
  } catch (error) {
    setFormMessage(form, getErrorMessage(error), 'error');
    return;
  }

  setFormBusy(form, true);
  const results: IconUploadResult[] = [];
  try {
    setFormMessage(form, 'ZIPを展開しています...', 'normal');
    await loadAssets();
    const existingKeys = new Set(assets.map((asset) => asset.asset_key));
    const zip = await JSZip.loadAsync(zipFile);
    const entries = Object.values(zip.files);
    const svgEntries = entries.filter((entry) => isValidIconZipEntry(entry.name, entry.dir));

    entries
      .filter((entry) => !isValidIconZipEntry(entry.name, entry.dir) && !entry.dir)
      .slice(0, 20)
      .forEach((entry) => {
        results.push({ fileName: entry.name, status: 'skip', message: 'SVG以外、隠しファイル、または安全でないパスのためスキップ' });
      });

    if (svgEntries.length > maxIconZipEntries) {
      svgEntries.slice(maxIconZipEntries).forEach((entry) => {
        results.push({ fileName: entry.name, status: 'skip', message: `上限${maxIconZipEntries}件を超えたためスキップ` });
      });
    }

    for (const [index, entry] of svgEntries.slice(0, maxIconZipEntries).entries()) {
      const fileName = getBaseFileName(entry.name);
      const assetKey = createIconAssetKey(fileName);
      if (!assetKey || assetKey === 'icon') {
        results.push({ fileName: entry.name, status: 'skip', message: 'asset_keyを生成できないためスキップ' });
        continue;
      }
      if (existingKeys.has(assetKey)) {
        results.push({ fileName: entry.name, status: 'skip', message: `${assetKey} は既に存在するためスキップ` });
        continue;
      }

      const blob = await entry.async('blob');
      if (blob.size <= 0) {
        results.push({ fileName: entry.name, status: 'skip', message: '空ファイルのためスキップ' });
        continue;
      }
      if (blob.size > maxFileSize) {
        results.push({ fileName: entry.name, status: 'skip', message: 'ファイルサイズ上限を超えたためスキップ' });
        continue;
      }

      const iconFile = new File([blob], fileName, { type: 'image/svg+xml' });
      const iconText = createIconTitle(fileName);
      const fields = {
        ...baseFields,
        assetKey,
        title: iconText,
        altText: `${iconText} アイコン`,
        displayOrder: baseFields.displayOrder + index,
      };

      try {
        await createIconAsset(fields, iconFile);
        existingKeys.add(assetKey);
        results.push({ fileName: entry.name, status: 'success', message: `${assetKey} を登録` });
      } catch (error) {
        results.push({ fileName: entry.name, status: 'error', message: getErrorMessage(error) });
      }
    }

    await loadAssets();
    renderAssetList();
    const summary = summarizeIconResults(results);
    setIconResults(form, results);
    setFormMessage(form, summary, results.some((result) => result.status === 'error') ? 'warning' : 'success');
  } catch (error) {
    setFormMessage(form, getErrorMessage(error), 'error');
  } finally {
    setFormBusy(form, false);
  }
}

async function createIconAsset(fields: ReturnType<typeof readFormFields>, file: File) {
  const metadata = await readImageMetadata(file);
  const uploaded = await uploadImage(metadata, fields.assetKey, 'desktop');
  try {
    const { error } = await supabase.rpc('create_site_asset', buildRpcPayload(fields, uploaded, null));
    if (error) throw error;
  } catch (error) {
    await rollbackUploads([uploaded.storagePath]);
    throw error;
  }
}

function isValidIconZipEntry(name: string, isDirectory: boolean) {
  if (isDirectory) return false;
  const normalized = name.replace(/\\/g, '/');
  if (!/\.svg$/i.test(normalized)) return false;
  if (normalized.startsWith('/') || normalized.includes('../') || normalized.includes('/..')) return false;
  const parts = normalized.split('/');
  return parts.every((part) => part && !part.startsWith('.') && part !== '__MACOSX' && part !== '.DS_Store');
}

function getBaseFileName(path: string) {
  return path.replace(/\\/g, '/').split('/').pop() ?? path;
}

function createIconAssetKey(fileName: string) {
  const normalized = normalizeIconBase(fileName);
  return normalized.startsWith('icon_') ? normalized : `icon_${normalized}`;
}

function createIconTitle(fileName: string) {
  return normalizeIconBase(fileName).replace(/^icon_/, '').split('_').filter(Boolean).join(' ').toUpperCase();
}

function normalizeIconBase(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function applyIconMetadataFromFileName(form: HTMLFormElement, fileName: string) {
  const assetKey = createIconAssetKey(fileName);
  const title = createIconTitle(fileName);
  const assetKeyInput = form.elements.namedItem('asset_key');
  const titleInput = form.elements.namedItem('title');
  const altInput = form.elements.namedItem('alt_text');

  if (assetKeyInput instanceof HTMLInputElement && (!assetKeyInput.value.trim() || assetKeyInput.dataset.generatedIcon === 'true')) {
    assetKeyInput.value = assetKey;
    assetKeyInput.dataset.generatedIcon = 'true';
  }
  if (titleInput instanceof HTMLInputElement && (!titleInput.value.trim() || titleInput.dataset.generatedIcon === 'true')) {
    titleInput.value = title;
    titleInput.dataset.generatedIcon = 'true';
  }
  if (altInput instanceof HTMLInputElement && (!altInput.value.trim() || altInput.dataset.generatedIcon === 'true' || altInput.value === altInput.dataset.generatedAlt)) {
    altInput.value = `${title} アイコン`;
    altInput.dataset.generatedIcon = 'true';
    altInput.dataset.generatedAlt = altInput.value;
  }
}

function setIconResults(form: HTMLFormElement, results: IconUploadResult[]) {
  const list = form.querySelector<HTMLElement>('[data-icon-upload-result]');
  if (!list) return;
  list.hidden = results.length === 0;
  list.innerHTML = results
    .map((result) => `<li data-status="${result.status}">${escapeText(result.fileName)}: ${escapeText(result.message)}</li>`)
    .join('');
}

function summarizeIconResults(results: IconUploadResult[]) {
  const success = results.filter((result) => result.status === 'success').length;
  const skip = results.filter((result) => result.status === 'skip').length;
  const error = results.filter((result) => result.status === 'error').length;
  return `アイコン一括登録: 成功 ${success}件 / スキップ ${skip}件 / 失敗 ${error}件`;
}

async function handleUpdate(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const card = form.closest<HTMLElement>('.asset-card');
  const asset = assets.find((item) => item.id === card?.dataset.assetId);
  if (!asset) return;
  const typeSelect = form.elements.namedItem('asset_type');
  const selectedAssetType = typeSelect instanceof HTMLSelectElement ? typeSelect.value : asset.asset_type;
  const iconSvgFile = getFileInput(form, 'icon_svg_file')?.files?.[0] ?? null;
  if (selectedAssetType === 'icon' && iconSvgFile) {
    applyIconMetadataFromFileName(form, iconSvgFile.name);
  }

  let fields: ReturnType<typeof readFormFields>;
  try {
    const assetKey = readAssetKeyAtSubmit(form);
    fields = readFormFields(form, assetKey);
  } catch (error) {
    setFormMessage(form, getErrorMessage(error), 'error');
    return;
  }

  const desktopFile = iconSvgFile ?? getFileInput(form, 'desktop_file')?.files?.[0];
  const mobileFile = getFileInput(form, 'mobile_file')?.files?.[0];
  const removeMobileInput = form.elements.namedItem('remove_mobile');
  const removeMobile = removeMobileInput instanceof HTMLInputElement && removeMobileInput.checked;
  const uploadedPaths: string[] = [];

  setFormBusy(form, true);
  try {
    const currentDesktopImage = storedImageFromAsset(asset, 'desktop');
    if (!currentDesktopImage) throw new Error('現在のPC画像情報を読み込めませんでした。');
    let desktopImage = currentDesktopImage;
    let mobileImage = storedImageFromAsset(asset, 'mobile');

    if (desktopFile) {
      setFormMessage(form, '新しいPC画像をアップロードしています...', 'normal');
      desktopImage = await uploadImage(await readImageMetadata(desktopFile), fields.assetKey, 'desktop');
      uploadedPaths.push(desktopImage.storagePath);
    }

    if (mobileFile) {
      setFormMessage(form, '新しいスマホ画像をアップロードしています...', 'normal');
      mobileImage = await uploadImage(await readImageMetadata(mobileFile), fields.assetKey, 'mobile');
      uploadedPaths.push(mobileImage.storagePath);
    } else if (removeMobile) {
      mobileImage = null;
    }

    setFormMessage(form, 'DBを更新しています...', 'normal');
    const { data, error } = await supabase.rpc('update_site_asset', {
      p_asset_id: asset.id,
      ...buildRpcPayload(fields, desktopImage, mobileImage),
    });
    if (error) throw error;
    const brandLinkWarning = await linkBrandAsset(fields);

    const result = data as UpdateSiteAssetResult;
    const oldPaths = getObsoleteStoragePaths(result, desktopImage.storagePath, mobileImage?.storagePath ?? null);
    const cleanupWarning = await removeOldStorageFiles(oldPaths);

    await loadAssets();
    renderAssetList();
    const warning = [brandLinkWarning, cleanupWarning].filter(Boolean).join(' ');
    showPageMessage(warning || '更新しました。', warning ? 'warning' : 'success');
  } catch (error) {
    const rollbackWarning = await rollbackUploads(uploadedPaths);
    setFormMessage(form, `${getErrorMessage(error)}${rollbackWarning}`, 'error');
  } finally {
    setFormBusy(form, false);
  }
}

async function handleDelete(card: HTMLElement) {
  const asset = assets.find((item) => item.id === card.dataset.assetId);
  const form = card.querySelector<HTMLFormElement>('.edit-form');
  if (!asset || !form || !window.confirm(`${asset.asset_key} を削除しますか？`)) return;

  setFormBusy(form, true);
  setFormMessage(form, 'DBから削除しています...', 'normal');
  try {
    const cleanupWarning = await deleteAssetRecordAndStorage(asset.id);
    selectedIconIds.delete(asset.id);
    await loadAssets();
    renderAssetList();
    showPageMessage(cleanupWarning || '削除しました。', cleanupWarning ? 'warning' : 'success');
  } catch (error) {
    setFormMessage(form, getErrorMessage(error), 'error');
    setFormBusy(form, false);
  }
}

async function handleDeleteSelectedIcons() {
  const selectedAssets = assets.filter((asset) => asset.asset_type === 'icon' && selectedIconIds.has(asset.id));
  if (selectedAssets.length === 0) return;
  if (!window.confirm(`${selectedAssets.length}件のアイコンを削除しますか？`)) return;

  const container = document.querySelector<HTMLElement>('#icon-bulk-actions');
  container?.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.disabled = true;
  });
  showPageMessage('選択したアイコンを削除しています...', 'warning');

  const deletedIds: string[] = [];
  const warnings: string[] = [];
  const failures: string[] = [];
  for (const asset of selectedAssets) {
    try {
      const warning = await deleteAssetRecordAndStorage(asset.id);
      if (warning) warnings.push(`${asset.asset_key}: ${warning}`);
      deletedIds.push(asset.id);
    } catch (error) {
      failures.push(`${asset.asset_key}: ${getErrorMessage(error)}`);
    }
  }

  deletedIds.forEach((id) => selectedIconIds.delete(id));
  await loadAssets();
  renderAssetList();

  if (failures.length > 0) {
    showPageMessage(`削除 ${deletedIds.length}件 / 失敗 ${failures.length}件。${failures.slice(0, 2).join(' ')}`, 'warning');
    return;
  }
  showPageMessage(warnings.length > 0 ? `削除しました。ただしStorage削除の警告があります: ${warnings.slice(0, 2).join(' ')}` : `${deletedIds.length}件のアイコンを削除しました。`, warnings.length > 0 ? 'warning' : 'success');
}

async function deleteAssetRecordAndStorage(assetId: string) {
  const { data, error } = await supabase.rpc('delete_site_asset', { p_asset_id: assetId });
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  const paths = [result?.desktop_storage_path, result?.mobile_storage_path].filter((path): path is string => Boolean(path));
  return removeOldStorageFiles(paths);
}

function readAssetKeyAtSubmit(form: HTMLFormElement) {
  const assetKeyInput = form.elements.namedItem('asset_key');
  if (!(assetKeyInput instanceof HTMLInputElement)) {
    throw new Error('asset_key入力欄を確認できませんでした。');
  }

  const rawAssetKey = assetKeyInput.value;
  const assetKey = rawAssetKey.trim().toLowerCase();

  console.debug('asset key validation', {
    raw: rawAssetKey,
    normalized: assetKey,
  });

  assetKeyInput.value = assetKey;
  if (!ASSET_KEY_PATTERN.test(assetKey)) {
    console.warn('Invalid asset_key after normalization.', {
      value: safeConsoleValue(assetKey),
      length: assetKey.length,
      codePoints: safeConsoleCodePoints(assetKey),
    });
    throw new Error('asset_keyの形式が正しくありません。');
  }

  return assetKey;
}

function readFormFields(form: HTMLFormElement, assetKey: string) {
  const values = new FormData(form);
  const assetType = String(values.get('asset_type') ?? '') as SiteAssetType;
  const linkUrl = validateLinkUrl(String(values.get('link_url') ?? ''));
  const displayOrder = Number(values.get('display_order'));
  const startsAt = parseDatetime(String(values.get('starts_at') ?? ''));
  const endsAt = parseDatetime(String(values.get('ends_at') ?? ''));
  const brandId = String(values.get('brand_id') ?? '').trim();

  if (!siteAssetTypes.includes(assetType)) throw new Error('用途が正しくありません。');
  if ((assetType === 'brand_logo' || assetType === 'brand_hero') && !brandId) throw new Error('ブランドを選択してください。');
  if (!Number.isInteger(displayOrder) || displayOrder < 1) throw new Error('並び順は1以上の整数で入力してください。');
  if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt)) throw new Error('公開終了は公開開始以降にしてください。');

  return {
    assetKey,
    assetType,
    brandId,
    title: String(values.get('title') ?? '').trim(),
    altText: String(values.get('alt_text') ?? '').trim(),
    caption: String(values.get('caption') ?? '').trim(),
    linkUrl,
    displayOrder,
    isPublished: values.get('is_published') === 'on',
    startsAt,
    endsAt,
  };
}

async function linkBrandAsset(fields: ReturnType<typeof readFormFields>) {
  if (!fields.brandId || (fields.assetType !== 'brand_logo' && fields.assetType !== 'brand_hero')) return '';
  if (fields.assetType === 'brand_hero' && !brandHeroLinkAvailable) {
    return '素材は登録しましたが、hero_asset_keyが未適用です。';
  }

  const { error } = await supabase.rpc('link_brand_site_asset', {
    p_brand_id: fields.brandId,
    p_asset_type: fields.assetType,
    p_asset_key: fields.assetKey,
  });
  return error ? `素材は保存しましたが、ブランドへの紐付けに失敗しました: ${error.message}` : '';
}

function buildRpcPayload(
  fields: ReturnType<typeof readFormFields>,
  desktop: StoredImage,
  mobile: StoredImage | null,
) {
  return {
    p_asset_key: fields.assetKey,
    p_asset_type: fields.assetType,
    p_title: fields.title,
    p_alt_text: fields.altText,
    p_caption: fields.caption,
    p_desktop_image_url: desktop.publicUrl,
    p_desktop_storage_path: desktop.storagePath,
    p_desktop_mime_type: desktop.mimeType,
    p_desktop_width: desktop.width,
    p_desktop_height: desktop.height,
    p_mobile_image_url: mobile?.publicUrl ?? null,
    p_mobile_storage_path: mobile?.storagePath ?? null,
    p_mobile_mime_type: mobile?.mimeType ?? null,
    p_mobile_width: mobile?.width ?? null,
    p_mobile_height: mobile?.height ?? null,
    p_link_url: fields.linkUrl,
    p_display_order: fields.displayOrder,
    p_is_published: fields.isPublished,
    p_starts_at: fields.startsAt,
    p_ends_at: fields.endsAt,
  };
}

async function readImageMetadata(file: File): Promise<ImageMetadata> {
  const mimeType = getSupportedMimeType(file);
  if (!mimeType) throw new Error('JPEG・PNG・WebP・AVIF・SVG形式の画像を選択してください。');
  if (file.size <= 0 || file.size > maxFileSize) throw new Error('画像サイズは5MB以下にしてください。');
  if (mimeType === 'image/svg+xml') {
    return { file, ...(await readSvgMetadata(file)), mimeType };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error('画像ファイルを読み込めませんでした。'));
      image.src = objectUrl;
    });
    if (!dimensions.width || !dimensions.height) throw new Error('画像サイズを取得できませんでした。');
    return { file, ...dimensions, mimeType };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function readSvgMetadata(file: File): Promise<{ width: number; height: number }> {
  const text = await file.text();
  const document = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (document.querySelector('parsererror')) throw new Error('SVGファイルを読み込めませんでした。');
  const svg = document.documentElement;
  if (svg.tagName.toLowerCase() !== 'svg') throw new Error('SVGファイルを選択してください。');

  const width = parseSvgLength(svg.getAttribute('width'));
  const height = parseSvgLength(svg.getAttribute('height'));
  if (width > 0 && height > 0) return { width, height };

  const viewBox = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number) ?? [];
  const viewBoxWidth = viewBox.length === 4 && Number.isFinite(viewBox[2]) ? viewBox[2] : 0;
  const viewBoxHeight = viewBox.length === 4 && Number.isFinite(viewBox[3]) ? viewBox[3] : 0;
  if (viewBoxWidth > 0 && viewBoxHeight > 0) return { width: Math.round(viewBoxWidth), height: Math.round(viewBoxHeight) };

  return { width: 48, height: 48 };
}

function parseSvgLength(value: string | null) {
  if (!value) return 0;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

async function uploadImage(metadata: ImageMetadata, assetKey: string, variant: 'desktop' | 'mobile'): Promise<StoredImage> {
  const extension: Record<SiteAssetMimeType, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
  };
  const storagePath = `${assetKey}/${variant}/${Date.now()}-${crypto.randomUUID()}.${extension[metadata.mimeType]}`;
  const { error } = await supabase.storage.from(storageBucket).upload(storagePath, metadata.file, {
    cacheControl: '3600',
    contentType: metadata.mimeType,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(storageBucket).getPublicUrl(storagePath);
  return { ...metadata, storagePath, publicUrl: data.publicUrl };
}

function getSupportedMimeType(file: File): SiteAssetMimeType | null {
  if (allowedMimeTypes.includes(file.type as SiteAssetMimeType)) return file.type as SiteAssetMimeType;
  if (/\.avif$/i.test(file.name)) return 'image/avif';
  if (/\.svg$/i.test(file.name)) return 'image/svg+xml';
  return null;
}

function storedImageFromAsset(asset: SiteAsset, variant: 'desktop' | 'mobile'): StoredImage | null {
  if (variant === 'mobile') {
    if (!asset.mobile_image_url || !asset.mobile_storage_path || !asset.mobile_mime_type || !asset.mobile_width || !asset.mobile_height) return null;
    return {
      file: new File([], 'existing'),
      publicUrl: asset.mobile_image_url,
      storagePath: asset.mobile_storage_path,
      mimeType: asset.mobile_mime_type,
      width: asset.mobile_width,
      height: asset.mobile_height,
    };
  }
  return {
    file: new File([], 'existing'),
    publicUrl: asset.desktop_image_url,
    storagePath: asset.desktop_storage_path,
    mimeType: asset.desktop_mime_type,
    width: asset.desktop_width,
    height: asset.desktop_height,
  };
}

async function rollbackUploads(paths: string[]) {
  if (!paths.length) return '';
  const { error } = await supabase.storage.from(storageBucket).remove(paths);
  return error ? ' 新規ファイルのロールバックに失敗しました。Storageに孤立ファイルが残った可能性があります。' : '';
}

function getObsoleteStoragePaths(
  result: UpdateSiteAssetResult,
  currentDesktopPath: string,
  currentMobilePath: string | null,
) {
  return [
    result.old_desktop_storage_path && result.old_desktop_storage_path !== currentDesktopPath
      ? result.old_desktop_storage_path
      : null,
    result.old_mobile_storage_path && result.old_mobile_storage_path !== currentMobilePath
      ? result.old_mobile_storage_path
      : null,
  ].filter((path): path is string => path !== null);
}

async function removeOldStorageFiles(paths: string[]) {
  const uniquePaths = [...new Set(paths)];
  if (!uniquePaths.length) return '';
  const { error } = await supabase.storage.from(storageBucket).remove(uniquePaths);
  return error ? 'DB更新は完了しましたが、旧Storageファイルの削除に失敗しました。孤立ファイルが残った可能性があります。' : '';
}

function validateLinkUrl(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.startsWith('/') && !normalized.startsWith('//')) return normalized;
  try {
    const url = new URL(normalized);
    if (url.protocol === 'http:' || url.protocol === 'https:') return normalized;
  } catch {
    // The shared message below is clearer than the URL parser error.
  }
  throw new Error('リンク先は / から始まる内部パス、または http/https URLを入力してください。');
}

function safeConsoleValue(value: string) {
  const maximumLength = 120;
  const visibleValue = value.length > maximumLength ? `${value.slice(0, maximumLength)}...` : value;
  return JSON.stringify(visibleValue);
}

function safeConsoleCodePoints(value: string) {
  return Array.from(value.slice(0, 120), (character) =>
    `U+${character.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`,
  );
}

function parseDatetime(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('表示期間の日時が正しくありません。');
  return date.toISOString();
}

function toDatetimeLocal(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function getPublicationState(asset: SiteAsset) {
  if (!asset.is_published) return { label: '非公開', className: 'draft' };
  const now = Date.now();
  if (asset.starts_at && new Date(asset.starts_at).getTime() > now) return { label: '公開待ち', className: 'scheduled' };
  if (asset.ends_at && new Date(asset.ends_at).getTime() < now) return { label: '公開終了', className: 'expired' };
  return { label: '公開中', className: 'published' };
}

function renderTypeOptions(selected: 'all' | SiteAssetType) {
  return siteAssetTypes.map((type) => `<option value="${type}" ${selected === type ? 'selected' : ''}>${escapeText(assetTypeLabels[type])}</option>`).join('');
}

function getFileInput(form: HTMLFormElement, name: string) {
  const input = form.elements.namedItem(name);
  return input instanceof HTMLInputElement ? input : null;
}

function setFormBusy(form: HTMLFormElement, busy: boolean) {
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>('input, select, textarea, button').forEach((control) => {
    if (busy) {
      control.dataset.disabledBeforeBusy = String(control.disabled);
      control.disabled = true;
      return;
    }
    control.disabled = control.dataset.disabledBeforeBusy === 'true';
    delete control.dataset.disabledBeforeBusy;
  });
}

function setFormMessage(form: HTMLFormElement, text: string, tone: 'normal' | 'success' | 'error' | 'warning') {
  const message = form.querySelector<HTMLElement>('.form-message');
  if (!message) return;
  message.textContent = text;
  message.dataset.tone = tone;
}

function showPageMessage(text: string, tone: 'success' | 'warning') {
  const message = document.querySelector<HTMLElement>('#page-message');
  if (!message) return;
  message.textContent = text;
  message.dataset.tone = tone;
}

function revokePreviewUrls() {
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls.clear();
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function escapeText(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value: unknown) {
  return escapeText(value).replace(/`/g, '&#096;');
}
