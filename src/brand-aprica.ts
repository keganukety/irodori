// Aprica専用ブランドページ。
// マークアップ・演出ともに .brand-page--aprica 配下に閉じ、共通UIには手を入れない。
//
// 構造(BOTANIST 26spring LPの構造の考え方をiLy.用に再設計):
// - PC(>=1080px): 3ペイン。中央に読みものの本文列を置き、左ペインにブランド
//   タイトル、右ペインにふわふわ漂うリボン装飾をsticky固定する。
//   背景は画面全体の固定バックドロップがシーンごとにクロスフェードする。
// - SP: バックドロップのクロスフェードは残しつつ、タイトルを先頭帯にして
//   中央本文が1カラムで縦に続く。リボン・透かし英字は非表示。
// - シーン検出は IntersectionObserver(中央帯)で行い、<main> の data-active-scene を更新。
// - 要素単位の演出は .js-aprica-anime + data-anime を IntersectionObserver で監視し、
//   画面に入ったら is-animated を付与する方式。scroll イベントは使わない。
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

type ApricaScene = 'hero' | 'lineup' | 'concept' | 'promise' | 'reason' | 'closing';

// シーンの表示順。左ペインのバックドロップ層・透かし英字はこの順で描画する。
const apricaSceneOrder: ApricaScene[] = ['hero', 'lineup', 'concept', 'promise', 'reason', 'closing'];

const apricaSceneWatermarks: Record<ApricaScene, string> = {
  hero: 'FOR BABY',
  lineup: 'LINE UP',
  concept: 'GENTLE',
  promise: 'PROTECT',
  reason: 'CLEAN',
  closing: 'WITH YOU',
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

type ApricaReason = {
  number: string;
  en: string;
  title: string;
  body: string;
};

const apricaReasons: ApricaReason[] = [
  {
    number: '01',
    en: 'MEDICAL EYES',
    title: '赤ちゃん医学の視点',
    body: '生まれたばかりのからだはまだ発達の途中。姿勢や呼吸を妨げないことを起点に、ひとつずつかたちを検討しています。',
  },
  {
    number: '02',
    en: 'WASHABLE',
    title: '清潔を保つ工夫',
    body: '肌にふれる部分は取り外して洗えるように。汗やよごれをその日のうちにリセットして、いつも気持ちよく使えます。',
  },
  {
    number: '03',
    en: 'FIT JAPAN LIFE',
    title: '日本の暮らしに合わせて',
    body: 'コンパクトな玄関、電車での移動、小さな車。日本の住まいと移動の事情に合わせた、軽さと扱いやすさを追求します。',
  },
];

export function renderApricaBrandPage(app: HTMLElement, context: ApricaPageContext): void {
  app.innerHTML = `
    <main class="brand-page brand-page--aprica" data-active-scene="hero">
      ${renderBackdrop(context)}
      <div class="aprica-stage">
        ${renderLeftPane(context)}
        <div class="aprica-flow">
          ${renderHeroScene(context)}
          ${renderLineupScene(context)}
          ${renderConceptScene(context)}
          ${renderPromiseScene()}
          ${renderReasonScene()}
          ${renderClosingScene(context)}
        </div>
        ${renderRightPane()}
      </div>
    </main>
  `;
  initApricaSceneSync(app);
  applyApricaScrollAnimations(app);
}

// 画面全体を覆う固定バックドロップ。data-active-scene に応じて層をクロスフェード。
function renderBackdrop(context: ApricaPageContext): string {
  return `
    <div class="aprica-backdrop" aria-hidden="true">
      ${apricaSceneOrder.map((scene) => `
        <div class="aprica-backdrop__layer" data-scene="${scene}">
          ${scene === 'hero' && context.heroImage ? `<img src="${escapeAttr(context.heroImage)}" alt="">` : ''}
        </div>`).join('')}
    </div>`;
}

function renderLeftPane(context: ApricaPageContext): string {
  return `
    <div class="aprica-pane aprica-pane--left">
      <div class="aprica-pane__watermarks" aria-hidden="true">
        ${apricaSceneOrder.map((scene) => `<span class="aprica-pane__watermark" data-scene="${scene}">${escapeHtml(apricaSceneWatermarks[scene])}</span>`).join('')}
      </div>
      <div class="aprica-pane__title">
        <p class="aprica-pane__eyebrow js-aprica-anime" data-anime="fadein-up">APRICA</p>
        <h1 id="aprica-hero-title" class="js-aprica-anime" data-anime="fadein-up" style="--aprica-anime-delay: 90ms">
          赤ちゃんの毎日を、<br>やさしく守るために。
        </h1>
        <p class="aprica-pane__lead js-aprica-anime" data-anime="fadein-up" style="--aprica-anime-delay: 180ms">
          まもる。やさしい。清潔。暮らしに合う。
        </p>
      </div>
    </div>`;
}

// 右ペイン: ふわふわ漂うリボン装飾。柔らかいAprica色で、上下にゆっくり揺れる。
function renderRightPane(): string {
  return `
    <div class="aprica-pane aprica-pane--right" aria-hidden="true">
      <div class="aprica-ribbons">
        <svg viewBox="0 0 320 960" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="aprica-ribbon-blue" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="rgba(127,181,212,0)"/>
              <stop offset="0.5" stop-color="rgba(127,181,212,0.55)"/>
              <stop offset="1" stop-color="rgba(127,181,212,0)"/>
            </linearGradient>
            <linearGradient id="aprica-ribbon-beige" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="rgba(240,231,218,0)"/>
              <stop offset="0.5" stop-color="rgba(240,231,218,0.7)"/>
              <stop offset="1" stop-color="rgba(240,231,218,0)"/>
            </linearGradient>
            <linearGradient id="aprica-ribbon-sky" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="rgba(197,222,238,0)"/>
              <stop offset="0.5" stop-color="rgba(197,222,238,0.65)"/>
              <stop offset="1" stop-color="rgba(197,222,238,0)"/>
            </linearGradient>
          </defs>
          <path class="aprica-ribbon aprica-ribbon--1" d="M-60 150 C 40 90, 130 210, 220 150 S 400 90, 500 150" fill="none" stroke="url(#aprica-ribbon-blue)" stroke-width="26" stroke-linecap="round"/>
          <path class="aprica-ribbon aprica-ribbon--2" d="M-60 330 C 60 260, 150 400, 240 330 S 420 260, 500 330" fill="none" stroke="url(#aprica-ribbon-beige)" stroke-width="30" stroke-linecap="round"/>
          <path class="aprica-ribbon aprica-ribbon--3" d="M-60 520 C 40 450, 130 580, 220 520 S 400 450, 500 520" fill="none" stroke="url(#aprica-ribbon-sky)" stroke-width="22" stroke-linecap="round"/>
          <path class="aprica-ribbon aprica-ribbon--4" d="M-60 710 C 60 640, 150 780, 240 710 S 420 640, 500 710" fill="none" stroke="url(#aprica-ribbon-blue)" stroke-width="28" stroke-linecap="round"/>
          <path class="aprica-ribbon aprica-ribbon--5" d="M-60 870 C 40 800, 130 930, 220 870 S 400 800, 500 870" fill="none" stroke="url(#aprica-ribbon-beige)" stroke-width="24" stroke-linecap="round"/>
        </svg>
      </div>
    </div>`;
}

function renderHeroScene(context: ApricaPageContext): string {
  return `
    <section class="aprica-scene aprica-scene--hero" data-scene="hero" aria-labelledby="aprica-hero-title">
      <div class="aprica-scene__inner">
        <nav class="brand-breadcrumb aprica-breadcrumb" aria-label="パンくず">
          <a href="/">トップ</a><span>/</span><span>${escapeHtml(context.brandName)}</span>
        </nav>
        ${context.logoImage
          ? `<img class="aprica-hero__logo js-aprica-anime" data-anime="fadein-up" src="${escapeAttr(context.logoImage)}" alt="${escapeAttr(context.logoAlt)}">`
          : ''}
        <p class="aprica-hero__lead js-aprica-anime" data-anime="fadein-up" style="--aprica-anime-delay: 90ms">
          生まれたばかりのからだは、とてもデリケート。${escapeHtml(context.brandName)}は、赤ちゃんの発達と家族の暮らしやすさを見つめながら、毎日の育児にそっと寄り添うものづくりを続けています。
        </p>
        <div class="aprica-hero__media js-aprica-anime" data-anime="image-reveal">
          ${context.heroImage
            ? `<img src="${escapeAttr(context.heroImage)}" alt="${escapeAttr(`${context.brandName} ブランドイメージ`)}">`
            : `<span class="aprica-hero__placeholder" aria-hidden="true">${escapeHtml(context.brandName)}</span>`}
        </div>
        <p class="aprica-scroll-cue js-aprica-anime" data-anime="fadein-up" style="--aprica-anime-delay: 260ms" aria-hidden="true">
          <span class="aprica-scroll-cue__label">SCROLL</span><span class="aprica-scroll-cue__line"></span>
        </p>
      </div>
    </section>`;
}

function renderLineupScene(context: ApricaPageContext): string {
  return `
    <section class="aprica-scene aprica-scene--lineup" data-scene="lineup" aria-labelledby="aprica-lineup-title">
      <div class="aprica-scene__inner">
        <p class="aprica-eyebrow js-aprica-anime" data-anime="fadein-up">LINE UP</p>
        <h2 id="aprica-lineup-title" class="js-aprica-anime" data-anime="text-reveal"><span class="aprica-reveal">${escapeHtml(context.brandName)}のラインナップ</span></h2>
        ${context.products.length === 0
          ? '<p class="aprica-lineup__empty js-aprica-anime" data-anime="fadein-up">商品情報は現在準備中です。</p>'
          : `
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
        </ul>`}
      </div>
    </section>`;
}

function renderConceptScene(context: ApricaPageContext): string {
  const lead = context.description
    || '赤ちゃんにとっての心地よさは、からだを正しく守ることから始まります。姿勢・温度・振動といった赤ちゃんを取り巻く環境をひとつずつ見つめ、医学的な視点を大切にしたものづくりを行っています。';
  return `
    <section class="aprica-scene aprica-scene--concept" data-scene="concept" aria-labelledby="aprica-concept-title">
      <div class="aprica-scene__inner">
        <p class="aprica-eyebrow js-aprica-anime" data-anime="fadein-up">CONCEPT</p>
        <h2 id="aprica-concept-title" class="js-aprica-anime" data-anime="text-reveal"><span class="aprica-reveal">「守る」から生まれる、<br>心地よさ。</span></h2>
        <p class="js-aprica-anime" data-anime="fadein-up" style="--aprica-anime-delay: 100ms">${formatMultiline(lead)}</p>
        <p class="js-aprica-anime" data-anime="fadein-up" style="--aprica-anime-delay: 180ms">清潔に保てること。暮らしの中で無理なく使えること。家族の毎日に自然と馴染むやさしさを、かたちにしています。</p>
        <div class="aprica-concept__media js-aprica-anime" data-anime="image-reveal">
          ${context.heroImage
            ? `<img src="${escapeAttr(context.heroImage)}" alt="" loading="lazy">`
            : '<span class="aprica-concept__placeholder" aria-hidden="true"></span>'}
        </div>
      </div>
    </section>`;
}

function renderPromiseScene(): string {
  return `
    <section class="aprica-scene aprica-scene--promise" data-scene="promise" aria-labelledby="aprica-promise-title">
      <div class="aprica-scene__inner">
        <p class="aprica-eyebrow js-aprica-anime" data-anime="fadein-up">PROMISE</p>
        <h2 id="aprica-promise-title" class="js-aprica-anime" data-anime="text-reveal"><span class="aprica-reveal">アップリカがいちばんに考える、<br>4つのこと。</span></h2>
        <ul class="aprica-promise__grid" data-anime-stagger role="list">
          ${apricaPromises.map((item) => `
            <li class="aprica-promise-card js-aprica-anime" data-anime="fadein-up">
              <span class="aprica-promise-card__icon" aria-hidden="true">${renderIcon(item.icon)}</span>
              <p class="aprica-promise-card__en">${escapeHtml(item.en)}</p>
              <h3>${escapeHtml(item.title)}</h3>
              <p class="aprica-promise-card__body">${escapeHtml(item.body)}</p>
            </li>`).join('')}
        </ul>
      </div>
    </section>`;
}

function renderReasonScene(): string {
  return `
    <section class="aprica-scene aprica-scene--reason" data-scene="reason" aria-labelledby="aprica-reason-title">
      <div class="aprica-scene__inner">
        <p class="aprica-eyebrow js-aprica-anime" data-anime="fadein-up">REASON</p>
        <h2 id="aprica-reason-title" class="js-aprica-anime" data-anime="text-reveal"><span class="aprica-reveal">毎日の安心を支える、<br>3つの理由。</span></h2>
        <ul class="aprica-reason__list" data-anime-stagger role="list">
          ${apricaReasons.map((item) => `
            <li class="aprica-reason-card js-aprica-anime" data-anime="fadein-up">
              <span class="aprica-reason-card__number" aria-hidden="true">${escapeHtml(item.number)}</span>
              <p class="aprica-reason-card__en">${escapeHtml(item.en)}</p>
              <h3>${escapeHtml(item.title)}</h3>
              <p class="aprica-reason-card__body">${escapeHtml(item.body)}</p>
            </li>`).join('')}
        </ul>
      </div>
    </section>`;
}

function renderClosingScene(context: ApricaPageContext): string {
  return `
    <section class="aprica-scene aprica-scene--closing" data-scene="closing" aria-labelledby="aprica-closing-title">
      <div class="aprica-scene__inner">
        <p class="aprica-eyebrow js-aprica-anime" data-anime="fadein-up">MESSAGE</p>
        <h2 id="aprica-closing-title" class="js-aprica-anime" data-anime="text-reveal"><span class="aprica-reveal">今日も、家族の毎日に<br>安心を。</span></h2>
        <p class="js-aprica-anime" data-anime="fadein-up" style="--aprica-anime-delay: 100ms">
          はじめての抱っこも、はじめてのお出かけも。${escapeHtml(context.brandName)}は、赤ちゃんと家族の「はじめて」に安心を添えていきます。
        </p>
        <a class="aprica-cta__button js-aprica-anime" data-anime="fadein-up" style="--aprica-anime-delay: 180ms" href="/products.html?brand=${encodeURIComponent(context.brandSlug)}">
          ${escapeHtml(context.brandName)}の商品一覧を見る
        </a>
        ${renderVideo(context.youtubeEmbedUrl)}
      </div>
    </section>`;
}

function renderVideo(embedUrl: string): string {
  if (!embedUrl) return '';
  return `
    <div class="aprica-video">
      <p class="aprica-eyebrow js-aprica-anime" data-anime="fadein-up">MOVIE</p>
      <div class="aprica-video__frame js-aprica-anime" data-anime="image-reveal">
        <iframe src="${escapeAttr(embedUrl)}" title="ブランドムービー" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      </div>
    </div>`;
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

// 中央本文のシーンが画面中央帯に入ったら data-active-scene を更新し、
// バックドロップの背景・左ペインの透かし・タイトル色をCSS側でクロスフェードさせる。
function initApricaSceneSync(root: ParentNode): void {
  const stageRoot = root.querySelector<HTMLElement>('.brand-page--aprica');
  const scenes = Array.from(root.querySelectorAll<HTMLElement>('.aprica-scene'));
  if (!stageRoot || scenes.length === 0) return;
  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const scene = (entry.target as HTMLElement).dataset.scene;
        if (scene) stageRoot.dataset.activeScene = scene;
      });
    },
    { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
  );

  scenes.forEach((scene) => observer.observe(scene));
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
