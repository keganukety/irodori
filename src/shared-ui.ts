export const SITE_NAME = 'IRODORI';
export const COMPARE_STORAGE_KEY = 'irodori_compare_product_ids';
export const MAX_COMPARE_PRODUCTS = 4;
export const MIN_COMPARE_PRODUCTS = 1;

type HeaderPage = 'products' | 'compare' | 'guide' | 'other';

const sharedStyleId = 'irodori-shared-ui-style';
const headerId = 'site-header';
const compareTrayId = 'compare-tray';
const compareMessageId = 'compare-tray-message';
const legacyCompareStorageKeys = ['irodoriCompareProductIds'];
let compareTrayNavigationInitialized = false;
let comparePageshowSyncInitialized = false;
let compareTrayObserver: MutationObserver | null = null;

export function normalizeProductId(id: unknown): string {
  return String(id ?? '').trim();
}

export function uniqueIds(ids: unknown[]): string[] {
  const seen = new Set<string>();

  return ids
    .map(normalizeProductId)
    .filter((id) => {
      if (!id || seen.has(id)) {
        return false;
      }

      seen.add(id);
      return true;
    });
}

export function getStoredCompareIds(): string[] {
  return loadCompareProductIds();
}

export function loadCompareProductIds(): string[] {
  const storedIds = readCompareIdsFromStorage(COMPARE_STORAGE_KEY);

  if (storedIds.length > 0) {
    return storedIds;
  }

  for (const legacyKey of legacyCompareStorageKeys) {
    const legacyIds = readCompareIdsFromStorage(legacyKey);
    if (legacyIds.length > 0) {
      return legacyIds;
    }
  }

  return [];
}

export function saveCompareIds(ids: unknown[]): string[] {
  return saveCompareProductIds(ids);
}

export function saveCompareProductIds(ids: unknown[]): string[] {
  const normalizedIds = uniqueIds(ids).slice(0, MAX_COMPARE_PRODUCTS);
  window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(normalizedIds));

  if (import.meta.env.DEV) {
    console.log('比較IDを保存:', normalizedIds);
  }

  window.dispatchEvent(new CustomEvent('compare-products-updated', { detail: normalizedIds }));
  return normalizedIds;
}

export function updateCompareState(ids: unknown[]): string[] {
  const nextIds = saveCompareProductIds(ids);
  syncCompareUI(nextIds);
  return nextIds;
}

export function removeCompareId(productId: unknown): string[] {
  return removeCompareProductId(productId);
}

export function removeCompareProductId(productId: unknown): string[] {
  const targetId = normalizeProductId(productId);
  const nextIds = loadCompareProductIds().filter((id) => id !== targetId);
  return updateCompareState(nextIds);
}

export function toggleCompareProductId(productId: unknown): string[] {
  const targetId = normalizeProductId(productId);
  if (!targetId) {
    return loadCompareProductIds();
  }

  const currentIds = loadCompareProductIds();
  const nextIds = currentIds.includes(targetId)
    ? currentIds.filter((id) => id !== targetId)
    : [...currentIds, targetId].slice(0, MAX_COMPARE_PRODUCTS);

  if (!currentIds.includes(targetId) && currentIds.length >= MAX_COMPARE_PRODUCTS) {
    setCompareMessage('比較できる商品は最大4件までです。不要な商品を解除してください。');
    return currentIds;
  }

  return updateCompareState(nextIds);
}

export function isProductCompared(productId: unknown): boolean {
  const targetId = normalizeProductId(productId);
  return Boolean(targetId) && loadCompareProductIds().includes(targetId);
}

export function clearCompareIds(): string[] {
  return clearCompareProductIds();
}

export function clearCompareProductIds(): string[] {
  return updateCompareState([]);
}

export function mountCommonHeader(page: HeaderPage = 'other'): void {
  try {
    if (!document.body) {
      return;
    }

    injectSharedStyles();

    if (document.getElementById(headerId)) {
      return;
    }

    const header = document.createElement('header');
    header.id = headerId;
    header.className = 'site-header';
    header.innerHTML = `
      <div class="site-header__inner">
        <a class="site-header__brand" href="/" aria-label="${SITE_NAME} トップへ">${SITE_NAME}</a>
        <button class="site-header__menu" type="button" aria-expanded="false" aria-controls="site-nav">
          メニュー
        </button>
        <nav class="site-header__nav" id="site-nav" aria-label="サイト内メニュー">
          <a class="${page === 'products' ? 'is-current' : ''}" href="/">商品を探す</a>
          <a class="${page === 'compare' ? 'is-current' : ''}" href="/compare.html">比較</a>
          <a class="${page === 'guide' ? 'is-current' : ''}" href="/stroller-guide.html">ベビーカーの選び方</a>
          <a href="/#ranking">ランキング</a>
        </nav>
      </div>
    `;

    const menuButton = header.querySelector<HTMLButtonElement>('.site-header__menu');
    const nav = header.querySelector<HTMLElement>('#site-nav');

    menuButton?.addEventListener('click', () => {
      const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!isOpen));
      nav?.classList.toggle('is-open', !isOpen);
    });

    document.body.prepend(header);
  } catch (error) {
    console.error('共通ヘッダーの初期化に失敗しました。', error);
  }
}

export function setupCompareEnhancements(): void {
  try {
    if (!document.body) {
      return;
    }

    injectSharedStyles();
    ensureCompareTray();
    enhanceProductCardsForCompare();
    syncCompareControls();

    document.addEventListener('click', handleCompareClick);
    document.addEventListener('change', handleCompareChange);

    if ('MutationObserver' in window) {
      const observer = new MutationObserver(() => {
        try {
          enhanceProductCardsForCompare();
          syncCompareControls();
        } catch (error) {
          console.error('比較UIの同期に失敗しました。', error);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }
  } catch (error) {
    console.error('比較UIの初期化に失敗しました。', error);
  }
}

export function setupCompareTrayNavigation(): void {
  try {
    if (!document.body) {
      return;
    }

    injectSharedStyles();
    ensureCompareTray();
    syncCompareUI(loadCompareProductIds());
    window.setTimeout(() => syncCompareUI(loadCompareProductIds()), 300);
    window.setTimeout(() => syncCompareUI(loadCompareProductIds()), 900);
    watchCompareTrayChanges();

    if (!comparePageshowSyncInitialized) {
      comparePageshowSyncInitialized = true;
      window.addEventListener('pageshow', () => {
        updateCompareTrayFromStorage();
      });
    }

    if (compareTrayNavigationInitialized) {
      return;
    }

    compareTrayNavigationInitialized = true;
    window.addEventListener('compare-products-updated', () => {
      syncCompareUI(loadCompareProductIds());
    });

    document.addEventListener('click', (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const clearButton = target.closest<HTMLElement>(
        '[data-compare-action="clear"], [data-clear-compare-page]',
      );

      if (clearButton) {
        event.preventDefault();
        event.stopPropagation();
        clearCompareProductIds();
        return;
      }

      const compareControl = target.closest<HTMLElement>(
        '[data-compare-product-id], [data-compare-id]',
      );

      if (compareControl && !isCompareSubmitElement(compareControl)) {
        if (
          isCheckboxCompareControl(compareControl) ||
          target instanceof HTMLInputElement ||
          Boolean(target.closest('label'))
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const productId = getCompareControlProductId(compareControl);
        if (productId) {
          toggleCompareProductId(productId);
          syncCompareUI();
        }

        return;
      }

      const compareButton = target.closest<HTMLButtonElement | HTMLAnchorElement>(
        '[data-compare-submit], [data-compare-action="open"], .compare-tray__primary',
      ) ?? getCompareSubmitButton(target);

      if (!compareButton) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (compareButton instanceof HTMLButtonElement && compareButton.disabled) {
        return;
      }

      const currentCompareIds = loadCompareProductIds();

      if (currentCompareIds.length < MIN_COMPARE_PRODUCTS) {
        syncCompareUI(currentCompareIds);
        return;
      }

      updateCompareState(currentCompareIds);
      window.location.assign('/compare.html');
    });

    document.addEventListener('change', (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      if (!target.matches('[data-compare-product-id], [data-compare-id]')) {
        return;
      }

      event.stopPropagation();

      const productId = getCompareControlProductId(target);
      if (!productId) {
        syncCompareUI();
        return;
      }

      const currentIds = loadCompareProductIds();
      const isAlreadyCompared = currentIds.includes(productId);

      if (target.checked && !isAlreadyCompared) {
        if (currentIds.length >= MAX_COMPARE_PRODUCTS) {
          setCompareMessage('比較できる商品は最大4件までです。不要な商品を解除してください。');
          target.checked = false;
          syncCompareUI();
          return;
        }

        updateCompareState([...currentIds, productId]);
      } else if (!target.checked && isAlreadyCompared) {
        updateCompareState(currentIds.filter((id) => id !== productId));
      } else {
        syncCompareUI();
        return;
      }
    });
  } catch (error) {
    console.error('比較ページへの遷移設定に失敗しました。', error);
  }
}

function readCompareIdsFromStorage(storageKey: string): string[] {
  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return uniqueIds(parsed).slice(0, MAX_COMPARE_PRODUCTS);
  } catch (error) {
    console.error('比較商品の保存情報を読み込めませんでした。', error);
    return [];
  }
}

function getCompareSubmitButton(target: Element): HTMLButtonElement | HTMLAnchorElement | null {
  const button = target.closest<HTMLButtonElement | HTMLAnchorElement>('button, a');
  if (!button) {
    return null;
  }

  const inCompareTray = Boolean(
    button.closest('.compare-tray, .compare-bar, .comparison-bar, [data-compare-tray]'),
  );

  if (!inCompareTray) {
    return null;
  }

  return button.textContent?.includes('比較する') ? button : null;
}

export function extractImageSrc(html: unknown): string {
  if (typeof html !== 'string' || !html.trim()) {
    return '';
  }

  const template = document.createElement('template');
  template.innerHTML = html;

  return template.content.querySelector('img')?.getAttribute('src')?.trim() ?? '';
}

export function formatPrice(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '価格未登録';
  }

  const numericValue = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(numericValue)) {
    return '価格未登録';
  }

  return `¥${Math.round(numericValue).toLocaleString('ja-JP')}`;
}

function handleCompareClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const compareAction = target.closest<HTMLElement>('[data-compare-action]');
  if (compareAction) {
    event.preventDefault();
    event.stopPropagation();

    const action = compareAction.dataset.compareAction;

    if (action === 'clear') {
      clearCompareIds();
      setCompareMessage('比較リストを空にしました。');
      return;
    }

    if (action === 'open') {
      const count = getStoredCompareIds().length;
      if (count < MIN_COMPARE_PRODUCTS) {
        setCompareMessage('比較するには2商品以上を選択してください。');
        return;
      }

      window.location.href = '/compare.html';
      return;
    }
  }

  const compareControl = target.closest<HTMLElement>('[data-compare-id]');
  if (!compareControl || compareControl instanceof HTMLInputElement) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  toggleCompareProduct(compareControl.dataset.compareId);
}

function handleCompareChange(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (!target.matches('[data-compare-id]')) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (target.checked) {
    const added = addCompareProduct(target.dataset.compareId);
    if (!added) {
      target.checked = false;
    }
  } else {
    removeCompareId(target.dataset.compareId);
  }
}

function toggleCompareProduct(productId: unknown): void {
  const normalizedId = normalizeProductId(productId);
  if (!normalizedId) {
    return;
  }

  const selectedIds = getStoredCompareIds();
  if (selectedIds.includes(normalizedId)) {
    removeCompareId(normalizedId);
    return;
  }

  addCompareProduct(normalizedId);
}

function addCompareProduct(productId: unknown): boolean {
  const normalizedId = normalizeProductId(productId);
  if (!normalizedId) {
    return false;
  }

  const selectedIds = getStoredCompareIds();
  if (selectedIds.includes(normalizedId)) {
    saveCompareIds(selectedIds);
    return true;
  }

  if (selectedIds.length >= MAX_COMPARE_PRODUCTS) {
    setCompareMessage('比較できる商品は最大4件までです。不要な商品を解除してください。');
    return false;
  }

  saveCompareIds([...selectedIds, normalizedId]);
  setCompareMessage('');
  return true;
}

function getCurrentCompareCount(): number {
  return getCurrentCompareIds().length;
}

function getCurrentCompareIds(): string[] {
  const storedIds = getStoredCompareIds();

  const checkedIds = Array.from(
    document.querySelectorAll<HTMLInputElement>('[data-compare-id]:checked, input[type="checkbox"]:checked'),
  )
    .map((input) => getCompareControlProductId(input) || input.value)
    .filter(Boolean);

  const selectedControlIds = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-compare-product-id].is-selected, [data-compare-product-id][aria-pressed="true"], [data-compare-id].is-selected, [data-compare-id][aria-pressed="true"]',
    ),
  )
    .map((element) => getCompareControlProductId(element))
    .filter(Boolean);

  return uniqueIds([...storedIds, ...checkedIds, ...selectedControlIds]).slice(0, MAX_COMPARE_PRODUCTS);
}

function getCompareControlProductId(element: Element): string {
  if (element instanceof HTMLElement) {
    return normalizeProductId(
      element.dataset.compareProductId ?? element.dataset.compareId ?? getProductIdFromElement(element),
    );
  }

  return normalizeProductId(getProductIdFromElement(element));
}

function isCompareSubmitElement(element: Element): boolean {
  return Boolean(
    element.closest('[data-compare-submit], [data-compare-action="open"], .compare-tray__primary'),
  );
}

function isCheckboxCompareControl(element: Element): boolean {
  return element instanceof HTMLInputElement && element.type === 'checkbox';
}

export function syncCompareUI(compareIds?: string[]): void {
  const selectedIds = uniqueIds(compareIds ?? loadCompareProductIds()).slice(0, MAX_COMPARE_PRODUCTS);
  const selectedIdSet = new Set(selectedIds);

  normalizeCompareTrays(selectedIds);

  document.querySelectorAll<HTMLElement>('[data-compare-product-id], [data-compare-id]').forEach((control) => {
    const controlId = getCompareControlProductId(control);
    const isSelected = selectedIdSet.has(controlId);

    control.classList.toggle('is-selected', isSelected);
    control.setAttribute('aria-pressed', String(isSelected));

    if (control instanceof HTMLInputElement) {
      control.checked = isSelected;
    }

    const label = control.querySelector<HTMLElement>('[data-compare-label]');
    if (label) {
      label.textContent = isSelected ? '比較から外す' : '比較に追加';
    }
  });

  document
    .querySelectorAll<HTMLElement>('[data-compare-count], .compare-count, .comparison-count')
    .forEach((element) => {
      element.textContent = String(selectedIds.length);
    });

  document.querySelectorAll<HTMLElement>('.compare-tray__count').forEach((element) => {
    element.textContent = `${selectedIds.length}件を比較中`;
  });

  document
    .querySelectorAll<HTMLElement>('[data-compare-submit], [data-compare-action="open"], .compare-tray__primary')
    .forEach((button) => {
      const isDisabled = selectedIds.length < MIN_COMPARE_PRODUCTS;

      if (button instanceof HTMLButtonElement) {
        button.disabled = isDisabled;
      }

      button.setAttribute('aria-disabled', String(isDisabled));
      button.classList.toggle('is-disabled', isDisabled);
      button.style.pointerEvents = isDisabled ? 'none' : '';
      if (isDisabled) {
        button.setAttribute('tabindex', '-1');
      } else {
        button.removeAttribute('tabindex');
      }
    });

  updateCompareTrayMessage(selectedIds);
}

function updateCompareTrayMessage(_selectedIds: string[]): void {
  const message = '';

  document.querySelectorAll<HTMLElement>('.compare-tray__message, #compare-tray-message').forEach((element) => {
    element.textContent = message;
    element.classList.toggle('is-visible', Boolean(message));
  });
}

function updateCompareTrayFromStorage(): void {
  const selectedIds = loadCompareProductIds();
  normalizeCompareTrays(selectedIds);
  updateCompareTrayCountText(selectedIds);

  if (import.meta.env.DEV) {
    console.log('比較トレイ数', document.querySelectorAll('[data-compare-tray]').length);
    console.log('保存済み比較ID', selectedIds);
  }
}

function normalizeCompareTrays(selectedIds: string[]): void {
  const trays = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-compare-tray], #compare-tray, .compare-tray, .compare-bar, .comparison-bar',
    ),
  );

  const primaryTray = trays[0];

  trays.slice(1).forEach((tray) => {
    tray.remove();
  });

  if (primaryTray) {
    primaryTray.id = compareTrayId;
    primaryTray.dataset.compareTray = 'true';
    primaryTray.hidden = selectedIds.length === 0;
    primaryTray.classList.toggle('is-active', selectedIds.length > 0);
  }

  updateCompareTrayCountText(selectedIds);

  if (import.meta.env.DEV) {
    console.log('比較トレイ数', document.querySelectorAll('[data-compare-tray]').length);
    console.log('保存済み比較ID', selectedIds);
  }
}

function updateCompareTrayCountText(selectedIds: string[]): void {
  const countText = `${selectedIds.length}件を比較中`;
  const trays = document.querySelectorAll<HTMLElement>('[data-compare-tray], #compare-tray, .compare-tray, .compare-bar, .comparison-bar');

  trays.forEach((tray) => {
    tray.hidden = selectedIds.length === 0;
    tray.classList.toggle('is-active', selectedIds.length > 0);

    const countTargets = tray.querySelectorAll<HTMLElement>(
      '[data-compare-count], .compare-count, .comparison-count, .compare-tray__count',
    );

    if (countTargets.length > 0) {
      countTargets.forEach((target) => {
        const nextText = target.hasAttribute('data-compare-count') ? String(selectedIds.length) : countText;
        if (target.textContent !== nextText) {
          target.textContent = nextText;
        }
      });
      return;
    }

    const walker = document.createTreeWalker(tray, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();

    while (textNode) {
      if (textNode.textContent?.includes('件を比較中')) {
        if (textNode.textContent !== countText) {
          textNode.textContent = countText;
        }
        return;
      }

      textNode = walker.nextNode();
    }
  });
}

function watchCompareTrayChanges(): void {
  if (compareTrayObserver || !document.body || !('MutationObserver' in window)) {
    return;
  }

  compareTrayObserver = new MutationObserver(() => {
    window.requestAnimationFrame(() => {
      updateCompareTrayFromStorage();
    });
  });

  compareTrayObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function ensureCompareTray(): HTMLElement {
  const existingTray = document.getElementById(compareTrayId);
  if (existingTray) {
    updateCompareTray(existingTray);
    return existingTray;
  }

  const tray =
    document.querySelector<HTMLElement>('.compare-bar, .comparison-bar') ?? document.createElement('aside');

  tray.id = compareTrayId;
  tray.className = 'compare-tray';
  tray.setAttribute('aria-live', 'polite');
  tray.innerHTML = `
    <div class="compare-tray__content">
      <p class="compare-tray__count"><span data-compare-count>0</span>件を比較中</p>
      <p class="compare-tray__message" id="${compareMessageId}"></p>
      <div class="compare-tray__actions">
        <button type="button" data-compare-action="clear">すべて解除</button>
        <button type="button" class="compare-tray__primary" data-compare-action="open">比較する</button>
      </div>
    </div>
  `;

  if (!tray.parentElement) {
    document.body.append(tray);
  }
  updateCompareTray(tray);

  window.addEventListener('compare-products-updated', () => {
    updateCompareTray(tray);
    syncCompareControls();
  });

  return tray;
}

function updateCompareTray(tray = document.getElementById(compareTrayId)): void {
  if (!tray) {
    return;
  }

  const count = getStoredCompareIds().length;
  const countElement = tray.querySelector<HTMLElement>('[data-compare-count]');
  const openButton = tray.querySelector<HTMLButtonElement>('[data-compare-action="open"]');
  const clearButton = tray.querySelector<HTMLButtonElement>('[data-compare-action="clear"]');

  if (countElement) {
    countElement.textContent = String(count);
  }

  tray.classList.toggle('is-active', count > 0);

  if (openButton) {
    openButton.disabled = count < MIN_COMPARE_PRODUCTS;
  }

  if (clearButton) {
    clearButton.disabled = count === 0;
  }
}

function setCompareMessage(message: string): void {
  ensureCompareTray();

  const messageElement = document.getElementById(compareMessageId);
  if (!messageElement) {
    return;
  }

  messageElement.textContent = message;
  messageElement.classList.toggle('is-visible', Boolean(message));

  if (message) {
    window.setTimeout(() => {
      if (messageElement.textContent === message) {
        messageElement.textContent = '';
        messageElement.classList.remove('is-visible');
      }
    }, 4200);
  }
}

function syncCompareControls(): void {
  const selectedIds = new Set(getStoredCompareIds());

  document.querySelectorAll<HTMLElement>('[data-compare-id]').forEach((control) => {
    const productId = normalizeProductId(control.dataset.compareId);
    const isSelected = selectedIds.has(productId);

    control.classList.toggle('is-selected', isSelected);
    control.setAttribute('aria-pressed', String(isSelected));

    if (control instanceof HTMLInputElement) {
      control.checked = isSelected;
    }

    const label = control.querySelector<HTMLElement>('[data-compare-label]');
    if (label) {
      label.textContent = isSelected ? '比較から外す' : '比較に追加';
    }
  });

  updateCompareTray();
}

function enhanceProductCardsForCompare(): void {
  const candidateCards = document.querySelectorAll<HTMLElement>('.product-card, .recommend-card, article, li');

  candidateCards.forEach((card) => {
    if (card.querySelector('[data-compare-id]')) {
      return;
    }

    const detailLink = card.querySelector<HTMLAnchorElement>('a[href*="product.html?id="]');
    const productId = getProductIdFromHref(detailLink?.getAttribute('href'));

    if (!productId) {
      return;
    }

    const compareWrapper = document.createElement('label');
    compareWrapper.className = 'compare-inline-control';
    compareWrapper.innerHTML = `
      <input type="checkbox" data-compare-id="${escapeAttr(productId)}">
      <span data-compare-label>比較に追加</span>
    `;

    const mountTarget =
      card.querySelector<HTMLElement>('.product-actions, .product-card__actions, .mall-links, .product-mall-links') ??
      card;

    mountTarget.append(compareWrapper);
  });
}

function getProductIdFromHref(href: string | null | undefined): string {
  if (!href) {
    return '';
  }

  try {
    const url = new URL(href, window.location.origin);
    return normalizeProductId(url.searchParams.get('id'));
  } catch {
    const matched = href.match(/[?&]id=([^&]+)/);
    return matched ? decodeURIComponent(matched[1]) : '';
  }
}

function getProductIdFromElement(element: Element): string {
  const card = element.closest('.product-card, .recommend-card, .recent-card, article, li') ?? element;
  const detailLink = card.querySelector<HTMLAnchorElement>('a[href*="product.html?id="]');

  return getProductIdFromHref(detailLink?.getAttribute('href'));
}

function escapeAttr(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectSharedStyles(): void {
  if (document.getElementById(sharedStyleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = sharedStyleId;
  style.textContent = `
    .site-header {
      background: #fff;
      color: #252522;
      border-bottom: 1px solid #e7e1d7;
    }

    .site-header__inner {
      width: min(1280px, calc(100% - 40px));
      min-height: 72px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }

    .site-header__brand {
      color: inherit;
      text-decoration: none;
      letter-spacing: .08em;
      font-size: 22px;
      font-weight: 700;
    }

    .site-header__nav {
      display: flex;
      align-items: center;
      gap: 24px;
      font-size: 14px;
    }

    .site-header__nav a {
      color: #36342f;
      text-decoration: none;
      text-underline-offset: 5px;
    }

    .site-header__nav a:hover,
    .site-header__nav a:focus-visible,
    .site-header__nav a.is-current {
      text-decoration: underline;
    }

    .site-header__menu {
      display: none;
      border: 1px solid #cfc6b7;
      background: #fff;
      color: #252522;
      min-height: 40px;
      padding: 0 14px;
      font: inherit;
    }

    .compare-tray {
      position: fixed;
      left: 50%;
      bottom: 18px;
      z-index: 40;
      width: min(640px, calc(100% - 32px));
      transform: translateX(-50%);
      pointer-events: none;
    }

    .compare-tray[hidden] {
      display: none !important;
    }

    .compare-tray.is-active {
      display: block;
      visibility: visible;
    }

    .compare-tray__content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 16px;
      border: 1px solid rgba(43, 83, 70, .22);
      border-radius: 8px;
      background: rgba(128, 189, 158, .94);
      color: #fff;
      box-shadow: 0 12px 32px rgba(32, 40, 36, .14);
      pointer-events: auto;
      opacity: .88;
    }

    .compare-tray.is-active .compare-tray__content {
      opacity: 1;
    }

    .compare-tray__count,
    .compare-tray__message {
      margin: 0;
    }

    .compare-tray__count {
      font-weight: 700;
      white-space: nowrap;
    }

    .compare-tray__message {
      flex: 1;
      min-width: 0;
      font-size: 13px;
      color: #fff4dd;
    }

    .compare-tray__actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .compare-tray button {
      min-height: 38px;
      border: 1px solid rgba(255, 255, 255, .55);
      background: transparent;
      color: inherit;
      padding: 0 14px;
      font: inherit;
      cursor: pointer;
    }

    .compare-tray button:disabled {
      cursor: not-allowed;
      opacity: .48;
    }

    .compare-tray .is-disabled {
      cursor: not-allowed;
      opacity: .55;
    }

    .compare-tray__primary {
      background: #fff !important;
      color: #244f42 !important;
      border-color: #fff !important;
      font-weight: 700 !important;
    }

    .compare-inline-control {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #4a4740;
      font-size: 13px;
      cursor: pointer;
      user-select: none;
    }

    .compare-inline-control input {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: #2f6758;
    }

    [data-compare-id]:focus-visible,
    .compare-inline-control:focus-within,
    .site-header a:focus-visible,
    .site-header button:focus-visible,
    .compare-tray button:focus-visible {
      outline: 2px solid #2f6758;
      outline-offset: 3px;
    }

    .product-card,
    .recommend-card,
    .recent-card {
      background: #fff;
    }

    .product-media,
    .product-media:hover,
    .product-media-link,
    .product-media-link:hover,
    .image-hover-stack,
    .image-hover-stack:hover,
    .product-image,
    .product-image:hover,
    .recommend-image,
    .recommend-image:hover,
    .recent-image,
    .recent-image:hover {
      background: #fff;
      background-image: none;
    }

    .product-media::before,
    .product-media::after,
    .product-media-link::before,
    .product-media-link::after,
    .image-hover-stack::before,
    .image-hover-stack::after,
    .product-image::before,
    .product-image::after,
    .recommend-image::before,
    .recommend-image::after,
    .recent-image::before,
    .recent-image::after {
      content: none;
      display: none;
      background: transparent;
    }

    .product-media img,
    .image-hover-stack img,
    .product-image img,
    .recommend-image img,
    .recent-image img {
      background: transparent;
      object-fit: contain;
    }

    .product-media a:focus-visible,
    .product-title-link:focus-visible,
    .product-name-link:focus-visible,
    .recommend-card a:focus-visible,
    .recent-card a:focus-visible {
      outline: 2px solid #2f6758;
      outline-offset: 4px;
    }

    @media (hover: hover) and (pointer: fine) {
      .image-hover-stack img,
      .product-media img,
      .recommend-image img,
      .recent-image img {
        transition-duration: 240ms;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .image-hover-stack img,
      .product-media img,
      .recommend-image img,
      .recent-image img,
      .product-media a,
      .recommend-card a,
      .recent-card a {
        transition: none !important;
        animation: none !important;
      }
    }

    @media (max-width: 760px) {
      .site-header__inner {
        width: min(100% - 28px, 1280px);
        min-height: 64px;
        flex-wrap: wrap;
        gap: 10px;
        padding: 10px 0;
      }

      .site-header__menu {
        display: inline-flex;
        align-items: center;
      }

      .site-header__nav {
        display: none;
        width: 100%;
        padding-bottom: 8px;
      }

      .site-header__nav.is-open {
        display: flex;
      }

      .compare-tray {
        bottom: 10px;
        width: calc(100% - 20px);
      }

      .compare-tray__content {
        align-items: stretch;
        gap: 8px;
        padding: 10px;
      }

      .compare-tray__message {
        display: none;
      }

      .compare-tray__actions {
        margin-left: auto;
      }

      .compare-tray button {
        min-height: 34px;
        padding: 0 10px;
        font-size: 13px;
      }
    }
  `;

  document.head.append(style);
}
