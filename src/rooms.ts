import './rooms.css';
import { mountCommonHeader } from './shared-ui';
import { loadRoomScenesIndex, roomScenePath, type RoomProduct, type RoomScene } from './room-scenes';

mountCommonHeader('other');
const currentNav = document.querySelector<HTMLAnchorElement>('#site-nav a[href="/rooms.html"]');
currentNav?.classList.add('is-current');
currentNav?.setAttribute('aria-current', 'page');

const app = document.querySelector<HTMLDivElement>('#rooms-app');
if (!app) throw new Error('#rooms-app が見つかりません。');
const root: HTMLDivElement = app;
const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });
const checkedDate = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
});

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function externalLink(href: string, label: string, className = ''): HTMLAnchorElement {
  const link = element('a', className, label);
  link.href = href;
  link.target = '_blank';
  link.rel = 'sponsored noopener noreferrer';
  link.setAttribute('aria-label', `${label}（新しいタブで開きます）`);
  return link;
}

function image(src: string, alt: string, className: string, eager = false): HTMLImageElement {
  const img = element('img', className);
  img.src = src;
  img.alt = alt;
  img.loading = eager ? 'eager' : 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', () => {
    const fallback = element('p', 'rooms-image-unavailable', '画像を読み込めませんでした。');
    img.replaceWith(fallback);
  }, { once: true });
  return img;
}

function productCard(product: RoomProduct): HTMLElement {
  const card = element('article', 'room-product');
  const visual = externalLink(product.affiliateUrl, `${product.name}を楽天で見る`, 'room-product__visual');
  visual.replaceChildren(image(product.imageUrl, product.name, 'room-product__image'));
  card.append(visual, element('p', 'room-product__label', '似た商品の候補 · PR'), element('h3', 'room-product__name', product.name));
  card.append(element('p', 'room-product__reason', product.similarityReason));
  card.append(element('p', 'room-product__price', `参考価格 ${yen.format(product.price)}`));
  const rating = element('p', 'room-product__rating');
  rating.append(element('span', '', `楽天の商品評価 ${product.rating.toFixed(2)} / 5`), element('span', 'room-product__reviews', `（${product.reviewCount.toLocaleString('ja-JP')}件）`));
  card.append(rating);
  const checked = element('p', 'room-product__checked');
  checked.append(document.createTextNode('評価確認：'));
  const time = element('time', '', `${checkedDate.format(new Date(product.ratingCheckedAt))} JST`);
  time.dateTime = product.ratingCheckedAt;
  checked.append(time);
  card.append(checked, element('p', 'room-product__stock', '確認時点では購入可能でした。'));
  const links = element('div', 'room-product__links');
  links.append(externalLink(product.affiliateUrl, '楽天で商品を見る', 'rooms-button rooms-button--primary'));
  if (product.roomPostUrl) links.append(externalLink(product.roomPostUrl, 'ROOMで見る', 'rooms-button'));
  links.append(externalLink(product.ratingSourceUrl, '楽天で評価を確認', 'room-product__source'));
  card.append(links);
  return card;
}

function sceneSection(scene: RoomScene): HTMLElement {
  const section = element('section', 'room-scene');
  section.setAttribute('aria-labelledby', 'scene-title');
  const hero = element('div', 'room-scene__hero');
  const figure = element('figure', 'room-scene__figure');
  figure.append(image(scene.imageUrl, scene.imageAlt, 'room-scene__image', true), element('figcaption', '', '部屋をイメージしてみました🏠'));
  const copy = element('div', 'room-scene__copy');
  const time = element('time', 'rooms-eyebrow', scene.date.replace(/-/g, '.'));
  time.dateTime = scene.date;
  const title = element('h2', '', scene.title);
  title.id = 'scene-title';
  if (scene.themeLabel) copy.append(element('p', 'room-scene__theme', scene.themeLabel));
  copy.append(time, title, element('p', 'room-scene__summary', scene.summary));
  const links = element('div', 'room-scene__links');
  if (scene.roomCollectionUrl) {
    links.append(externalLink(scene.roomCollectionUrl, '楽天ROOMのコレクションを見る', 'rooms-button rooms-button--primary'));
  }
  const permalink = element('a', 'rooms-button', 'この部屋の商品紹介ページ');
  permalink.href = roomScenePath(scene.id);
  links.append(permalink);
  copy.append(links);
  const notice = element('div', 'room-scene__notice');
  notice.append(element('p', 'room-scene__pr', 'PR · アフィリエイト広告を含みます。'));
  notice.append(element('p', '', '商品そのものの写真ではありません。色や形が近いアイテムを紹介しています🪵'));
  notice.append(element('p', '', scene.disclosure));
  copy.append(notice);
  hero.append(figure, copy);
  section.append(hero);

  const products = element('section', 'room-products');
  products.setAttribute('aria-labelledby', 'products-title');
  const heading = element('div', 'room-products__heading');
  const h2 = element('h2', '', 'この部屋の雰囲気に近いもの');
  h2.id = 'products-title';
  heading.append(element('p', 'rooms-eyebrow', 'FIND A SIMILAR ITEM'), h2, element('p', '', '評価確認時点で4.5以上の商品を紹介しています。'));
  products.append(heading);
  const grid = element('div', 'room-products__grid');
  grid.append(...scene.products.map(productCard));
  products.append(grid, element('p', 'room-products__note', '価格・評価・在庫は確認時点の情報です。最新の価格、在庫、サイズや仕様は商品ページで確認してください。'));
  section.append(products);
  return section;
}

function archive(scenes: RoomScene[], selectedId: string): HTMLElement {
  const section = element('nav', 'rooms-archive');
  section.setAttribute('aria-labelledby', 'archive-title');
  const title = element('h2', '', '部屋のイメージを選ぶ');
  title.id = 'archive-title';
  section.append(title);
  const list = element('ul', 'rooms-archive__list');
  for (const scene of scenes) {
    const li = element('li');
    const link = element('a', '', `${scene.date.replace(/-/g, '.')}　${scene.title}`);
    link.href = roomScenePath(scene.id);
    if (scene.id === selectedId) link.setAttribute('aria-current', 'true');
    li.append(link);
    list.append(li);
  }
  section.append(list);
  return section;
}

function showState(message: string, failed = false): void {
  const state = element('section', 'rooms-state');
  state.setAttribute('role', 'status');
  state.append(element('p', 'rooms-eyebrow', failed ? 'PLEASE TRY AGAIN' : 'COMING SOON'));
  state.append(element('h2', '', failed ? '読み込みを確認できませんでした' : '部屋のイメージを準備しています'));
  state.append(element('p', '', message));
  if (failed) {
    const retry = element('button', 'rooms-button', 'もう一度読み込む');
    retry.type = 'button';
    retry.addEventListener('click', () => window.location.reload());
    state.append(retry);
  }
  root.replaceChildren(state);
  root.setAttribute('aria-busy', 'false');
}

async function start(): Promise<void> {
  try {
    const { scenes } = await loadRoomScenesIndex();
    if (!scenes.length) {
      showState('公開した部屋と商品が、ここに並びます。');
      return;
    }
    const render = (): void => {
      let selectedId = '';
      try { selectedId = decodeURIComponent(window.location.hash.slice(1)); } catch { /* Use the latest scene. */ }
      const scene = scenes.find((candidate) => candidate.id === selectedId) ?? scenes[0];
      root.replaceChildren(sceneSection(scene), archive(scenes, scene.id));
      root.setAttribute('aria-busy', 'false');
      document.title = `${scene.title} | 暮らしの部屋 | iLy.`;
    };
    render();
    window.addEventListener('hashchange', () => {
      render();
      const heading = root.querySelector<HTMLHeadingElement>('#scene-title');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
      root.scrollIntoView({ block: 'start' });
    });
  } catch (error) {
    console.error('部屋データの読み込みに失敗しました。', error);
    showState('時間をおいて、もう一度お試しください。', true);
  }
}

void start();
