import './product-quick-view.css';
import { normalizeProductDisplayName } from './shared-ui';
import type { Brand, Product, ProductColor } from './types';

type ProductImageMap = Map<string, string>;
type ProductColorMap = Map<string, ProductColor[]>;

export type QuickViewOptions = {
  products: Product[];
  imageByProductId?: ProductImageMap;
  colorsByProductId?: ProductColorMap;
  brandsById?: Map<string, Brand>;
};

let options: QuickViewOptions = { products: [] };
let eventsBound = false;
let lastTrigger: HTMLElement | null = null;

export function setupProductQuickView(nextOptions: QuickViewOptions): void {
  options = nextOptions;
  ensureDialog();
  if (eventsBound) return;
  eventsBound = true;

  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeQuickView();
  });
}

export function renderQuickViewButton(productId: string | number, label = '+'): string {
  return `<button class="quick-view-trigger" type="button" data-quick-view-id="${escapeAttr(productId)}" aria-haspopup="dialog" aria-label="クイックビューを開く">${escapeHtml(label)}</button>`;
}

function handleDocumentClick(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const trigger = target.closest<HTMLElement>('[data-quick-view-id]');
  if (trigger) {
    event.preventDefault();
    event.stopPropagation();
    const productId = trigger.dataset.quickViewId;
    if (productId) openQuickView(productId, trigger);
    return;
  }

  if (target.closest('[data-quick-view-close]')) closeQuickView();
}

function ensureDialog(): HTMLDialogElement {
  const existing = document.querySelector<HTMLDialogElement>('#product-quick-view');
  if (existing) return existing;

  const dialog = document.createElement('dialog');
  dialog.id = 'product-quick-view';
  dialog.className = 'quick-view-dialog';
  dialog.setAttribute('aria-labelledby', 'quick-view-title');
  dialog.innerHTML = '<div class="quick-view-panel" data-quick-view-content></div>';
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeQuickView();
  });
  dialog.addEventListener('close', restoreTriggerFocus);
  document.body.append(dialog);
  return dialog;
}

function openQuickView(productId: string, trigger: HTMLElement): void {
  const product = options.products.find((item) => String(item.id) === productId);
  if (!product) return;

  lastTrigger = trigger;
  const dialog = ensureDialog();
  const content = dialog.querySelector<HTMLElement>('[data-quick-view-content]');
  if (!content) return;
  content.innerHTML = renderQuickView(product);

  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  document.body.classList.add('has-quick-view-open');
  content.querySelector<HTMLElement>('[data-quick-view-close]')?.focus();
}

function closeQuickView(): void {
  const dialog = document.querySelector<HTMLDialogElement>('#product-quick-view');
  if (!dialog?.hasAttribute('open')) return;
  if (typeof dialog.close === 'function') dialog.close();
  else {
    dialog.removeAttribute('open');
    restoreTriggerFocus();
  }
  document.body.classList.remove('has-quick-view-open');
}

function restoreTriggerFocus(): void {
  document.body.classList.remove('has-quick-view-open');
  lastTrigger?.focus();
  lastTrigger = null;
}

function renderQuickView(product: Product): string {
  const productId = String(product.id);
  const fallbackName = firstText(product, ['name', 'product_name', 'title']) || `商品ID ${productId}`;
  const name = normalizeProductDisplayName(product, fallbackName) || fallbackName;
  const brand = getBrand(product);
  const brandRecord = getBrandRecord(product);
  const brandMarkup = brandRecord
    ? `<a href="/brand.html?slug=${encodeURIComponent(brandRecord.slug)}">${escapeHtml(brandRecord.display_name)}</a>`
    : escapeHtml(brand);
  const image = options.imageByProductId?.get(productId) || firstText(product, ['image_url']);
  const colors = options.colorsByProductId?.get(productId) ?? [];

  return `
    <button class="quick-view-close" type="button" data-quick-view-close aria-label="クイックビューを閉じる">×</button>
    <div class="quick-view-layout">
      <div class="quick-view-image">
        ${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(name)}">` : '<span>画像準備中</span>'}
      </div>
      <section class="quick-view-info">
        <p class="quick-view-brand">${brandMarkup}</p>
        <h2 id="quick-view-title">${escapeHtml(name)}</h2>
        <p class="quick-view-price">${escapeHtml(formatPrice(product.price_yen))}</p>
        <dl class="quick-view-specs">
          ${renderSpec('重量', formatWeight(product.weight_kg ?? product.weight))}
          ${renderSpec('サイズ', firstText(product, ['product_size', 'size', 'dimensions', 'product_dimensions']))}
          ${renderSpec('対象年齢', firstText(product, ['target_age', 'age_range', 'age']))}
        </dl>
        ${renderColors(colors)}
        <div class="quick-view-shop-links">
          ${renderShopLink('楽天', firstText(product, ['rakuten_url', 'rakuten_link']))}
          ${renderShopLink('Amazon', firstText(product, ['amazon_url', 'amazon_link']))}
          ${renderShopLink('Yahoo!', firstText(product, ['yahoo_url', 'yahoo_link']))}
          ${renderShopLink('公式', firstText(product, ['official_url', 'official_link']))}
        </div>
        <a class="quick-view-detail-link" href="/product.html?id=${encodeURIComponent(productId)}">CHECK</a>
      </section>
    </div>
  `;
}

function renderColors(colors: ProductColor[]): string {
  if (colors.length === 0) return '';
  return `
    <section class="quick-view-colors" aria-label="カラー">
      <h3>カラー</h3>
      <div class="color-swatches color-swatches--labeled">
        ${colors
          .map(
            (color) => `<span class="color-swatch-item${color.is_default ? ' is-default' : ''}">
              <i style="--swatch:${escapeAttr(color.swatch_hex)}" aria-hidden="true"></i>
              <b>${escapeHtml(color.name)}${color.is_default ? '<small>標準</small>' : ''}</b>
            </span>`,
          )
          .join('')}
      </div>
    </section>
  `;
}

function getBrandRecord(product: Product): Brand | undefined {
  const brandId = product.brand_id;
  return brandId ? options.brandsById?.get(String(brandId)) : undefined;
}

function getBrand(product: Product): string {
  return firstText(product, ['brand', 'maker', 'manufacturer']) || 'ブランド未登録';
}

function renderSpec(label: string, value: string): string {
  return value ? `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>` : '';
}

function renderShopLink(label: string, url: string): string {
  return url ? `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer sponsored">${escapeHtml(label)}</a>` : '';
}

function firstText(product: Product, keys: string[]): string {
  for (const key of keys) {
    const value = product[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function formatPrice(value: unknown): string {
  const price = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(price) && price > 0 ? `¥${Math.round(price).toLocaleString('ja-JP')}（税込）` : '価格未登録';
}

function formatWeight(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value).trim();
  return /kg/i.test(text) ? text : `${text}kg`;
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
  return escapeHtml(value).replace(/`/g, '&#096;');
}
