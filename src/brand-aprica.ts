// Aprica専用ブランドページ。
// マークアップ・演出ともに .brand-page--aprica 配下に閉じ、共通UIには手を入れない。
// スクロール演出は .js-aprica-anime + data-anime を IntersectionObserver で監視し、
// 画面に入ったら is-animated を付与する方式（BOTANIST LPと同じ考え方のiLy.実装）。
import './brand-aprica.css';

export type ApricaProductView = {
  id: string;
  name: string;
  subtitle: string;
  catchCopy: string;
  price: string;
  image: string;
};

export type ApricaPageContext = {
  brandName: string;
  brandSlug: string;
  description: string;
  heroImage: string;
  logoImage: string;
  logoAlt: string;
  products: ApricaProductView[];
  youtubeEmbedUrl: string;
};

type ApricaPromise = {
  en: string;
  title: string;
  body: string;
  icon: string;
};

const apricaPromises: ApricaPromise[] = [
  {
    en: 'PROTECT',
    title: 'まもる',
    body: 'まだ未熟なあたまとからだを支えるために。衝撃をやわらげ、自然な姿勢を保つ設計を大切にしています。',
    icon: 'shield',
  },
  {
    en: 'GENTLE',
    title: 'やさしい',
    body: '肌にふれる素材、乗り心地、静かな押し心地。赤ちゃん目線の心地よさをいちばんに考えます。',
    icon: 'heart',
  },
  {
    en: 'CLEAN',
    title: '清潔',
    body: '汗っかきの赤ちゃんが毎日気持ちよく過ごせるように。洗える素材と通気のよいつくりを選んでいます。',
    icon: 'droplet',
  },
  {
    en: 'FIT YOUR LIFE',
    title: '暮らしに合う',
    body: '軽くて扱いやすく、玄関にも車にもすっと馴染むサイズ感。家族の毎日に無理なく寄り添います。',
    icon: 'home',
  },
];

export function renderApricaBrandPage(app: HTMLElement, context: ApricaPageContext): void {
  app.innerHTML = `
    <main class="brand-page brand-page--aprica">
      <nav class="brand-breadcrumb aprica-breadcrumb" aria-label="パンくず">
        <a href="/">トップ</a><span>/</span><span>${escapeHtml(context.brandName)}</span>
      </nav>
      ${renderHero(context)}
      ${renderConcept(context)}
      ${renderPromises()}
      ${renderLineup(context)}
      ${renderFinalAction(context)}
      ${renderVideo(context.youtubeEmbedUrl)}
    </main>
  `;
  applyApricaScrollAnimations(app);
}

function renderHero(context: ApricaPageContext): string {
  return `
    <section class="aprica-hero" aria-labelledby="aprica-hero-title">
      <div class="aprica-hero__media js-aprica-anime" data-anime="image-reveal">
        ${context.heroImage
          ? `<img src="${escapeAttr(context.heroImage)}" alt="${escapeAttr(`${context.brandName} ブランドイメージ`)}">`
          : `<span class="aprica-hero__placeholder" aria-hidden="true">${escapeHtml(context.brandName)}</span>`}
      </div>
      <div class="aprica-hero__copy">
        <p class="aprica-eyebrow js-aprica-anime" data-anime="fadein-up">APRICA</p>
        ${context.logoImage
          ? `<img class="aprica-hero__logo js-aprica-anime" data-anime="fadein-up" src="${escapeAttr(context.logoImage)}" alt="${escapeAttr(context.logoAlt)}">`
          : ''}
        <h1 id="aprica-hero-title" class="aprica-hero__title js-aprica-anime" data-anime="fadein-up" style="--aprica-anime-delay: 90ms">
          赤ちゃんの毎日を、<br>やさしく守るために。
        </h1>
        <p class="aprica-hero__lead js-aprica-anime" data-anime="fadein-up" style="--aprica-anime-delay: 180ms">
          生まれたばかりのからだは、とてもデリケート。${escapeHtml(context.brandName)}は、赤ちゃんの発達と家族の暮らしやすさを見つめながら、毎日の育児にそっと寄り添うものづくりを続けています。
        </p>
      </div>
    </section>`;
}

function renderConcept(context: ApricaPageContext): string {
  const lead = context.description
    || '赤ちゃんにとっての心地よさは、からだを正しく守ることから始まります。姿勢・温度・振動といった赤ちゃんを取り巻く環境をひとつずつ見つめ、医学的な視点を大切にしたものづくりを行っています。';
  return `
    <section class="aprica-concept" aria-labelledby="aprica-concept-title">
      <div class="aprica-concept__copy">
        <p class="aprica-eyebrow js-aprica-anime" data-anime="fadein-up">CONCEPT</p>
        <h2 id="aprica-concept-title" class="js-aprica-anime" data-anime="fadein-up">「守る」から生まれる、<br>心地よさ。</h2>
        <p class="js-aprica-anime" data-anime="fadein-up" style="--aprica-anime-delay: 100ms">${formatMultiline(lead)}</p>
        <p class="js-aprica-anime" data-anime="fadein-up" style="--aprica-anime-delay: 180ms">清潔に保てること。暮らしの中で無理なく使えること。家族の毎日に自然と馴染むやさしさを、かたちにしています。</p>
      </div>
      <div class="aprica-concept__media js-aprica-anime" data-anime="image-reveal">
        ${context.heroImage
          ? `<img src="${escapeAttr(context.heroImage)}" alt="" loading="lazy">`
          : '<span class="aprica-concept__placeholder" aria-hidden="true"></span>'}
      </div>
    </section>`;
}

function renderPromises(): string {
  return `
    <section class="aprica-promise" aria-labelledby="aprica-promise-title">
      <header class="aprica-section-header">
        <p class="aprica-eyebrow js-aprica-anime" data-anime="fadein-up">PROMISE</p>
        <h2 id="aprica-promise-title" class="js-aprica-anime" data-anime="fadein-up">アップリカがいちばんに考える、4つのこと。</h2>
      </header>
      <ul class="aprica-promise__grid" data-anime-stagger role="list">
        ${apricaPromises.map((item) => `
          <li class="aprica-promise-card js-aprica-anime" data-anime="fadein-up">
            <span class="aprica-promise-card__icon" aria-hidden="true">${renderIcon(item.icon)}</span>
            <p class="aprica-promise-card__en">${escapeHtml(item.en)}</p>
            <h3>${escapeHtml(item.title)}</h3>
            <p class="aprica-promise-card__body">${escapeHtml(item.body)}</p>
          </li>`).join('')}
      </ul>
    </section>`;
}

function renderLineup(context: ApricaPageContext): string {
  if (context.products.length === 0) {
    return `
      <section class="aprica-lineup" aria-labelledby="aprica-lineup-title">
        <header class="aprica-section-header">
          <p class="aprica-eyebrow js-aprica-anime" data-anime="fadein-up">LINE UP</p>
          <h2 id="aprica-lineup-title" class="js-aprica-anime" data-anime="fadein-up">${escapeHtml(context.brandName)}のラインナップ</h2>
        </header>
        <p class="aprica-lineup__empty js-aprica-anime" data-anime="fadein-up">商品情報は現在準備中です。</p>
      </section>`;
  }
  return `
    <section class="aprica-lineup" aria-labelledby="aprica-lineup-title">
      <header class="aprica-section-header">
        <p class="aprica-eyebrow js-aprica-anime" data-anime="fadein-up">LINE UP</p>
        <h2 id="aprica-lineup-title" class="js-aprica-anime" data-anime="fadein-up">${escapeHtml(context.brandName)}のラインナップ</h2>
      </header>
      <ul class="aprica-lineup__grid" data-anime-stagger role="list">
        ${context.products.map((product) => `
          <li class="aprica-lineup-card js-aprica-anime" data-anime="fadein-up">
            <a href="/product.html?id=${encodeURIComponent(product.id)}">
              <span class="aprica-lineup-card__image">
                ${product.image
                  ? `<img src="${escapeAttr(product.image)}" alt="${escapeAttr(product.name)}" loading="lazy">`
                  : `<span class="aprica-lineup-card__noimage" aria-hidden="true">${escapeHtml(product.name)}</span>`}
              </span>
              <span class="aprica-lineup-card__body">
                ${product.catchCopy ? `<span class="aprica-lineup-card__catch">${escapeHtml(product.catchCopy)}</span>` : ''}
                <span class="aprica-lineup-card__name">${escapeHtml(product.name)}</span>
                ${product.subtitle ? `<span class="aprica-lineup-card__subtitle">${escapeHtml(product.subtitle)}</span>` : ''}
                <span class="aprica-lineup-card__price">${escapeHtml(product.price)}</span>
              </span>
            </a>
          </li>`).join('')}
      </ul>
    </section>`;
}

function renderFinalAction(context: ApricaPageContext): string {
  return `
    <section class="aprica-cta">
      <a class="aprica-cta__button js-aprica-anime" data-anime="fadein-up" href="/products.html?brand=${encodeURIComponent(context.brandSlug)}">
        ${escapeHtml(context.brandName)}の商品一覧を見る
      </a>
    </section>`;
}

function renderVideo(embedUrl: string): string {
  if (!embedUrl) return '';
  return `
    <section class="aprica-video" aria-label="ブランドムービー">
      <header class="aprica-section-header">
        <p class="aprica-eyebrow js-aprica-anime" data-anime="fadein-up">MOVIE</p>
        <h2 class="js-aprica-anime" data-anime="fadein-up">ブランドムービー</h2>
      </header>
      <div class="aprica-video__frame js-aprica-anime" data-anime="image-reveal">
        <iframe src="${escapeAttr(embedUrl)}" title="ブランドムービー" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
    </section>`;
}

function renderIcon(name: string): string {
  const paths: Record<string, string> = {
    shield: '<path d="M12 3.2 18.6 6v5c0 4.4-2.8 7.3-6.6 8.8C8.2 18.3 5.4 15.4 5.4 11V6L12 3.2Z"/><path d="M9.4 11.5l1.9 1.9 3.5-3.7"/>',
    heart: '<path d="M12 19.4C8.4 16.7 4.8 14 4.8 10.4a3.9 3.9 0 0 1 7.2-2.1A3.9 3.9 0 0 1 19.2 10.4c0 3.6-3.6 6.3-7.2 9Z"/>',
    droplet: '<path d="M12 3.6c3.2 3.9 5.6 6.8 5.6 9.6a5.6 5.6 0 1 1-11.2 0c0-2.8 2.4-5.7 5.6-9.6Z"/><path d="M9.6 13.4a2.5 2.5 0 0 0 2 2.4"/>',
    home: '<path d="M4.6 11 12 4.4 19.4 11v8.2h-5v-5.4h-4.8v5.4h-5V11Z"/>',
  };
  const path = paths[name] ?? paths.shield;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${path}</svg>`;
}

function applyApricaScrollAnimations(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-anime-stagger]').forEach((group) => {
    group.querySelectorAll<HTMLElement>('.js-aprica-anime').forEach((element, index) => {
      element.style.setProperty('--aprica-anime-delay', `${index * 110}ms`);
    });
  });

  const targets = Array.from(root.querySelectorAll<HTMLElement>('.js-aprica-anime'));
  if (targets.length === 0) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || !('IntersectionObserver' in window)) {
    targets.forEach((element) => element.classList.add('is-animated'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, entryObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-animated');
        entryObserver.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
  );

  targets.forEach((element) => observer.observe(element));
}

function formatMultiline(value: string): string {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
