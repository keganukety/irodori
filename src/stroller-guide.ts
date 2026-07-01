import './styles.css';
import './stroller-guide.css';
import { applyFadeUpAnimations, mountCommonHeader } from './shared-ui';
import { fallbackProducts } from './data/fallback-products';
import { supabase } from './lib/supabase';

mountCommonHeader('guide');
mountStrollerDiagnosis();
void mountStrollerTypeImages();
applyFadeUpAnimations(document);

const strollerDiagnosisResultDelay = 720;

const strollerTypes = {
  lightweight: 'lightweight',
  driving: 'driving',
  carUser: 'carUser',
  longUse: 'longUse',
} as const;

type StrollerType = typeof strollerTypes[keyof typeof strollerTypes];
type StrollerScores = Partial<Record<StrollerType, number>>;

type DiagnosisOption = {
  text: string;
  note: string;
  mark: string;
  iconSvg: string;
  scores: StrollerScores;
};

type DiagnosisQuestion = {
  title: string;
  options: DiagnosisOption[];
};

type DiagnosisProduct = {
  brand: string;
  name: string;
  href: string;
};

type DiagnosisResult = {
  title: string;
  description: string;
  conditions: string[];
  cautions: string[];
  products: DiagnosisProduct[];
  searchPath: string;
};

type TypeGuideImageKey = 'a' | 'b' | 'ab' | 'threeWheel';
type GuideProduct = {
  id?: string | number | null;
  name?: string | null;
  product_name?: string | null;
  title?: string | null;
  brand?: string | null;
  maker?: string | null;
  manufacturer?: string | null;
  category?: string | null;
  type?: string | null;
  product_type?: string | null;
  tags?: string[] | string | null;
  feature_tags?: string[] | string | null;
  image_url?: string | null;
  [key: string]: unknown;
};

type GuideAffiliateImage = {
  product_id: string | number;
  image_url?: string | null;
  rakuten_image_html?: string | null;
  is_primary?: boolean | null;
  display_order?: number | null;
  sort_order?: number | null;
};

type GuideUploadedImage = {
  product_id: string | number;
  public_url?: string | null;
  role?: string | null;
  is_primary?: boolean | null;
  display_order?: number | null;
};

const diagnosisIcons = {
  train: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="16" rx="2"></rect><path d="M4 11h16M12 3v8M8 19l-2 3M16 19l2 3"></path><path d="M8 15h.01M16 15h.01"></path></svg>',
  car: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle></svg>',
  walk: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1"></circle><path d="M9 20l2.2-3.6L9 14M15 20l-1.8-4.2c-.3-.8-.9-1.4-1.7-1.8L9 12.5M12 9v4l3 3"></path></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5 10v10h14V10"></path><path d="M9 20v-6h6v6"></path></svg>',
  stairs: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h4v-4h4v-4h4V9h4V5"></path></svg>',
  storage: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="M3.3 7 12 12l8.7-5M12 22V12"></path></svg>',
  feather: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 12.2a6 6 0 0 0-8.5-8.5L5 10.5V19h8.5Z"></path><path d="M16 8 2 22M17.5 15H9"></path></svg>',
  road: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 22 12 2l8 20M12 13v-1M12 18v-1"></path></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"></path><path d="m9 12 2 2 4-5"></path></svg>',
  person: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4"></circle><path d="M5.5 21a6.5 6.5 0 0 1 13 0"></path></svg>',
  users: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
  family: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V21H3Z"></path><path d="M9 21v-6h6v6M8 11h.01M16 11h.01"></path></svg>',
  baby: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="6" r="3"></circle><path d="M12 9v12M5 13h14M8 21h8"></path></svg>',
  child: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="6" r="3"></circle><path d="M12 9v5M8 22l4-8 4 8M8 12h8"></path></svg>',
  question: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 3-3 3M12 17h.01"></path></svg>',
} as const;

const diagnosisQuestions: DiagnosisQuestion[] = [
  {
    title: '普段のお出かけで多い移動手段は？',
    options: [
      {
        text: '徒歩や電車、バスが多い',
        note: '駅、改札、階段、バス乗降をよく使う',
        mark: '01',
        iconSvg: diagnosisIcons.train,
        scores: { lightweight: 3, driving: 1 },
      },
      {
        text: '車での移動がメイン',
        note: '車への積み下ろしやトランク収納を優先したい',
        mark: '02',
        iconSvg: diagnosisIcons.car,
        scores: { carUser: 3, lightweight: 1 },
      },
      {
        text: '徒歩も車も、両方よく使う',
        note: '日常の散歩と週末の車移動、どちらもある',
        mark: '03',
        iconSvg: diagnosisIcons.walk,
        scores: { driving: 2, carUser: 1, lightweight: 1 },
      },
    ],
  },
  {
    title: '住まいと収納環境で近いものは？',
    options: [
      {
        text: 'エレベーターあり、または戸建て',
        note: '持ち上げる場面は少なく、安定感も選びやすい',
        mark: '01',
        iconSvg: diagnosisIcons.home,
        scores: { driving: 2, longUse: 2 },
      },
      {
        text: '階段の上り下りが必要',
        note: '片手で持てる軽さや折りたたみやすさが大切',
        mark: '02',
        iconSvg: diagnosisIcons.stairs,
        scores: { lightweight: 4 },
      },
      {
        text: '玄関や収納スペースがコンパクト',
        note: '自立収納や折りたたみサイズを確認したい',
        mark: '03',
        iconSvg: diagnosisIcons.storage,
        scores: { lightweight: 2, carUser: 2 },
      },
    ],
  },
  {
    title: '一番重視したいポイントは？',
    options: [
      {
        text: '軽さと持ち運びやすさ',
        note: '毎日の出し入れを軽くしたい',
        mark: '01',
        iconSvg: diagnosisIcons.feather,
        scores: { lightweight: 4 },
      },
      {
        text: '押しやすさと安定感',
        note: '段差や凸凹道でもストレスを減らしたい',
        mark: '02',
        iconSvg: diagnosisIcons.road,
        scores: { driving: 4 },
      },
      {
        text: '車への積みやすさ',
        note: '省スペース収納やトラベルシステムも見たい',
        mark: '03',
        iconSvg: diagnosisIcons.storage,
        scores: { carUser: 4 },
      },
      {
        text: '新生児期からの快適さ',
        note: '寝姿勢、幌、クッション性を優先したい',
        mark: '04',
        iconSvg: diagnosisIcons.shield,
        scores: { longUse: 4 },
      },
    ],
  },
  {
    title: '主に使う人は誰ですか？',
    options: [
      {
        text: 'ひとりで使う場面が多い',
        note: '開閉、持ち上げ、荷物管理を少ない動作にしたい',
        mark: '01',
        iconSvg: diagnosisIcons.person,
        scores: { lightweight: 2 },
      },
      {
        text: '家族で同じくらい使う',
        note: '押す人が変わっても扱いやすいものが安心',
        mark: '02',
        iconSvg: diagnosisIcons.users,
        scores: { driving: 1, longUse: 1 },
      },
      {
        text: '祖父母など複数人で使う',
        note: '操作がわかりやすく、安定しているものが向きやすい',
        mark: '03',
        iconSvg: diagnosisIcons.family,
        scores: { driving: 1 },
      },
    ],
  },
  {
    title: '使い始めたい時期はいつ頃ですか？',
    options: [
      {
        text: '生後1カ月頃からすぐ',
        note: 'リクライニングや対象月齢をしっかり確認したい',
        mark: '01',
        iconSvg: diagnosisIcons.baby,
        scores: { longUse: 3, driving: 1 },
      },
      {
        text: '生後半年頃、おすわり期以降',
        note: 'B型や軽量タイプも候補に入りやすい',
        mark: '02',
        iconSvg: diagnosisIcons.child,
        scores: { lightweight: 3 },
      },
      {
        text: 'まだ決めていない',
        note: 'まずは生活動線に合う条件から整理したい',
        mark: '03',
        iconSvg: diagnosisIcons.question,
        scores: { longUse: 1, lightweight: 1 },
      },
    ],
  },
];

const diagnosisResults: Record<StrollerType, DiagnosisResult> = {
  lightweight: {
    title: '軽量・コンパクトタイプ',
    description:
      '電車やバスでの移動、階段、ワンオペのお出かけが多い暮らしには、軽くて持ち運びしやすいタイプが合いやすいです。毎日の出し入れや乗り換えの負担を減らせます。',
    conditions: ['5kg前後までの軽さ', '片手で開閉しやすい構造', '折りたたみ時に自立する', '改札を通りやすい幅'],
    cautions: ['軽いモデルは荷物を掛けすぎると不安定になりやすい', '大きな段差では走行性重視モデルより揺れやすい'],
    products: [
      { brand: 'CYBEX', name: 'MELIO CARBON', href: '/products.html?brand=CYBEX&filter=lightweight' },
      { brand: 'Aprica', name: 'Magical Air', href: '/products.html?brand=Aprica&filter=lightweight' },
    ],
    searchPath: '/products.html?filter=lightweight',
  },
  driving: {
    title: '走行性・安定感重視タイプ',
    description:
      '徒歩での移動や公園、段差のある道が多い暮らしには、タイヤやフレームがしっかりしたタイプが向いています。赤ちゃんへの振動や押す人の疲れを減らしやすい選び方です。',
    conditions: ['シングルタイヤやサスペンション', 'ブレにくいフレーム', '荷物カゴの容量', '押す人に合うハンドル高さ'],
    cautions: ['本体重量は重めになりやすい', '折りたたみ後のサイズが大きいモデルもある'],
    products: [
      { brand: 'AirBuggy', name: 'COCO PREMIER', href: '/products.html?brand=AirBuggy&type=三輪' },
      { brand: 'Pigeon', name: 'Runfee', href: '/products.html?brand=Pigeon&scene=公園' },
    ],
    searchPath: '/products.html?scene=公園&type=三輪',
  },
  carUser: {
    title: '車移動・省スペースタイプ',
    description:
      '車でのお出かけが中心なら、トランクに積みやすく、玄関にも置きやすいコンパクト収納タイプが候補です。車からベビーカーへの移動を考えるなら対応アクセサリーも確認しましょう。',
    conditions: ['折りたたみ時の小ささ', '軽自動車にも積みやすいサイズ', '三つ折りなどの収納性', '車内から出し入れしやすい重さ'],
    cautions: ['開閉に両手が必要なモデルもある', '座面下の収納カゴは小さめな場合がある'],
    products: [
      { brand: 'CYBEX', name: 'LIBELLE', href: '/products.html?brand=CYBEX&filter=compactCar' },
      { brand: 'BABYZEN', name: 'YOYO', href: '/products.html?brand=BABYZEN&filter=compactCar' },
    ],
    searchPath: '/products.html?filter=compactCar',
  },
  longUse: {
    title: '新生児から長く使えるタイプ',
    description:
      '生後早い時期から1台を長く使いたい場合は、対象月齢、リクライニング、幌、シートの快適性を重視すると選びやすくなります。両対面式も候補に入ります。',
    conditions: ['生後1カ月頃から使える対象月齢', 'しっかり倒せるリクライニング', '対面・背面を切り替えられる両対面式', '大きめの幌とクッション性'],
    cautions: ['多機能な分、価格は高めになりやすい', '成長後は軽量B型へ買い替える家庭もある'],
    products: [
      { brand: 'Combi', name: 'スゴカル エッグショック LA', href: '/products.html?brand=Combi&filter=newborn' },
      { brand: 'Aprica', name: 'LUXUNA', href: '/products.html?brand=Aprica&type=AB型' },
    ],
    searchPath: '/products.html?filter=newborn&type=AB型',
  },
};

function mountStrollerDiagnosis(): void {
  const root = document.querySelector<HTMLElement>('#stroller-diagnosis');
  if (!root) return;

  const screens = {
    start: root.querySelector<HTMLElement>('[data-diagnosis-screen="start"]'),
    question: root.querySelector<HTMLElement>('[data-diagnosis-screen="question"]'),
    loading: root.querySelector<HTMLElement>('[data-diagnosis-screen="loading"]'),
    result: root.querySelector<HTMLElement>('[data-diagnosis-screen="result"]'),
  };
  const questionTitle = root.querySelector<HTMLElement>('[data-diagnosis-question]');
  const optionsContainer = root.querySelector<HTMLElement>('[data-diagnosis-options]');
  const stepElement = root.querySelector<HTMLElement>('[data-diagnosis-step]');
  const percentElement = root.querySelector<HTMLElement>('[data-diagnosis-percent]');
  const progressElement = root.querySelector<HTMLElement>('[data-diagnosis-progress]');
  const resultTitle = root.querySelector<HTMLElement>('[data-diagnosis-result-title]');
  const resultDescription = root.querySelector<HTMLElement>('[data-diagnosis-result-description]');
  const conditionsList = root.querySelector<HTMLElement>('[data-diagnosis-conditions]');
  const cautionsList = root.querySelector<HTMLElement>('[data-diagnosis-cautions]');
  const productsContainer = root.querySelector<HTMLElement>('[data-diagnosis-products]');
  const searchLink = root.querySelector<HTMLAnchorElement>('[data-diagnosis-search]');

  if (
    !screens.start ||
    !screens.question ||
    !screens.loading ||
    !screens.result ||
    !questionTitle ||
    !optionsContainer ||
    !stepElement ||
    !percentElement ||
    !progressElement ||
    !resultTitle ||
    !resultDescription ||
    !conditionsList ||
    !cautionsList ||
    !productsContainer ||
    !searchLink
  ) {
    return;
  }

  const ui = {
    questionTitle,
    optionsContainer,
    stepElement,
    percentElement,
    progressElement,
    resultTitle,
    resultDescription,
    conditionsList,
    cautionsList,
    productsContainer,
    searchLink,
  };

  let currentStep = 0;
  let scores = getInitialScores();
  let loadingTimer = 0;

  root.querySelector<HTMLButtonElement>('[data-diagnosis-start]')?.addEventListener('click', () => {
    currentStep = 0;
    scores = getInitialScores();
    renderQuestion(currentStep);
    showScreen(screens, 'question');
  });

  root.querySelector<HTMLButtonElement>('[data-diagnosis-restart]')?.addEventListener('click', () => {
    window.clearTimeout(loadingTimer);
    currentStep = 0;
    scores = getInitialScores();
    ui.progressElement.style.width = '0%';
    showScreen(screens, 'start');
  });

  function renderQuestion(step: number): void {
    const question = diagnosisQuestions[step];
    const percent = Math.round((step / diagnosisQuestions.length) * 100);

    ui.stepElement.textContent = `Question ${step + 1}/${diagnosisQuestions.length}`;
    ui.percentElement.textContent = `${percent}%`;
    ui.progressElement.style.width = `${percent}%`;
    ui.questionTitle.textContent = question.title;
    ui.optionsContainer.textContent = '';

    question.options.forEach((option) => {
      const button = document.createElement('button');
      button.className = 'stroller-diagnosis__option';
      button.type = 'button';
      button.innerHTML = `
        <span class="stroller-diagnosis__option-mark" data-option-number="${escapeAttr(option.mark)}">${option.iconSvg}</span>
        <span>
          <b>${escapeHtml(option.text)}</b>
          <small>${escapeHtml(option.note)}</small>
        </span>
      `;
      button.addEventListener('click', () => handleAnswer(option.scores));
      ui.optionsContainer.append(button);
    });
  }

  function handleAnswer(answerScores: StrollerScores): void {
    Object.entries(answerScores).forEach(([type, score]) => {
      scores[type as StrollerType] += score ?? 0;
    });

    currentStep += 1;

    if (currentStep < diagnosisQuestions.length) {
      renderQuestion(currentStep);
      return;
    }

    ui.progressElement.style.width = '100%';
    ui.percentElement.textContent = '100%';
    showScreen(screens, 'loading');
    loadingTimer = window.setTimeout(() => {
      renderResult(getHighestScoreType(scores));
      showScreen(screens, 'result');
    }, strollerDiagnosisResultDelay);
  }

  function renderResult(type: StrollerType): void {
    const result = diagnosisResults[type];
    ui.resultTitle.textContent = result.title;
    ui.resultDescription.textContent = result.description;
    ui.conditionsList.innerHTML = result.conditions.map((condition) => `<li>${escapeHtml(condition)}</li>`).join('');
    ui.cautionsList.innerHTML = result.cautions.map((caution) => `<li>${escapeHtml(caution)}</li>`).join('');
    ui.productsContainer.innerHTML = result.products.map((product) => `
      <a class="stroller-diagnosis__model" href="${escapeAttr(product.href)}">
        <span>${escapeHtml(product.brand)}</span>
        <b>${escapeHtml(product.name)}</b>
      </a>
    `).join('');
    ui.searchLink.href = result.searchPath;
  }
}

function getInitialScores(): Record<StrollerType, number> {
  return {
    lightweight: 0,
    driving: 0,
    carUser: 0,
    longUse: 0,
  };
}

function getHighestScoreType(scores: Record<StrollerType, number>): StrollerType {
  return (Object.entries(scores) as Array<[StrollerType, number]>).reduce(
    (best, current) => (current[1] > best[1] ? current : best),
    [strollerTypes.lightweight, Number.NEGATIVE_INFINITY],
  )[0];
}

function showScreen(
  screens: Record<'start' | 'question' | 'loading' | 'result', HTMLElement | null>,
  screenName: 'start' | 'question' | 'loading' | 'result',
): void {
  Object.entries(screens).forEach(([key, screen]) => {
    if (!screen) return;
    const isActive = key === screenName;
    screen.hidden = !isActive;
    screen.classList.toggle('is-active', isActive);
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

async function mountStrollerTypeImages(): Promise<void> {
  const imageElements = Array.from(document.querySelectorAll<HTMLImageElement>('[data-stroller-type-image]'));
  if (imageElements.length === 0) return;

  const products = await loadGuideProducts();
  const productIds = products.map((product) => normalizeProductId(product.id)).filter(Boolean);
  const [affiliateImages, uploadedImages] = productIds.length > 0
    ? await Promise.all([loadGuideAffiliateImages(productIds), loadGuideUploadedImages(productIds)])
    : [new Map<string, string>(), new Map<string, string>()];
  const imageByProductId = new Map([...affiliateImages, ...uploadedImages]);
  const assignments = getTypeGuideImageAssignments(products, imageByProductId);

  imageElements.forEach((image) => {
    const key = image.dataset.strollerTypeImage as TypeGuideImageKey | undefined;
    if (!key) return;

    const assignment = assignments[key];
    if (!assignment?.src) return;

    image.src = assignment.src;
    image.alt = `${assignment.label}のイメージ`;
    image.classList.add('is-loaded');
  });
}

async function loadGuideProducts(): Promise<GuideProduct[]> {
  try {
    const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true });
    if (!error && data?.length) return data as GuideProduct[];
    if (error) console.info('ベビーカータイプ画像はフォールバック商品画像を使用します。', error.message);
  } catch (error) {
    console.info('ベビーカータイプ画像はフォールバック商品画像を使用します。', error);
  }

  return [...fallbackProducts] as GuideProduct[];
}

async function loadGuideAffiliateImages(productIds: string[]): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();

  try {
    const { data, error } = await supabase
      .from('product_affiliate_images')
      .select('product_id, image_url, rakuten_image_html, is_primary, display_order, sort_order')
      .eq('media_type', 'image')
      .in('product_id', productIds)
      .order('display_order', { ascending: true });

    if (error || !data) return imageMap;

    const grouped = new Map<string, GuideAffiliateImage[]>();
    (data as GuideAffiliateImage[]).forEach((image) => {
      const productId = normalizeProductId(image.product_id);
      if (!productId) return;
      grouped.set(productId, [...(grouped.get(productId) ?? []), image]);
    });

    grouped.forEach((images, productId) => {
      const src = [...images]
        .sort((a, b) =>
          Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary))
          || Number(a.sort_order ?? a.display_order ?? 999) - Number(b.sort_order ?? b.display_order ?? 999),
        )
        .map((image) => normalizeImageUrl(image.image_url) || extractImageSrc(image.rakuten_image_html))
        .find(Boolean);

      if (src) imageMap.set(productId, src);
    });
  } catch (error) {
    console.info('商品アフィリエイト画像を読み込めませんでした。', error);
  }

  return imageMap;
}

async function loadGuideUploadedImages(productIds: string[]): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();

  try {
    const { data, error } = await supabase
      .from('product_uploaded_images')
      .select('product_id, public_url, role, is_primary, display_order')
      .in('product_id', productIds)
      .order('display_order', { ascending: true });

    if (error || !data) return imageMap;

    const grouped = new Map<string, GuideUploadedImage[]>();
    (data as GuideUploadedImage[]).forEach((image) => {
      const productId = normalizeProductId(image.product_id);
      if (!productId) return;
      grouped.set(productId, [...(grouped.get(productId) ?? []), image]);
    });

    grouped.forEach((images, productId) => {
      const src = [...images]
        .sort((a, b) =>
          Number(b.role === 'main') - Number(a.role === 'main')
          || Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary))
          || Number(a.display_order ?? 999) - Number(b.display_order ?? 999),
        )
        .map((image) => normalizeImageUrl(image.public_url))
        .find(Boolean);

      if (src) imageMap.set(productId, src);
    });
  } catch (error) {
    console.info('アップロード済み商品画像を読み込めませんでした。', error);
  }

  return imageMap;
}

function getTypeGuideImageAssignments(
  products: GuideProduct[],
  imageByProductId: Map<string, string>,
): Record<TypeGuideImageKey, { label: string; src: string }> {
  const usedProductIds = new Set<string>();
  const usedImageSrcs = new Set<string>();
  const pick = (matchers: RegExp[]) =>
    findGuideProductImage(products, imageByProductId, matchers, usedProductIds, usedImageSrcs);

  return {
    a: {
      label: 'A型ベビーカー',
      src: pick([
        /ラクーナ|LUXUNA|Luxuna|スゴカル|SUGOCAL/i,
        /A型(?!寄り)|新生児|生後\s*1|1カ月|1ヶ月/i,
      ]),
    },
    b: {
      label: 'B型ベビーカー',
      src: pick([
        /リベル|LIBELLE|Magical|マジカル/i,
        /B型|セカンド/i,
        /コンパクト|セカンド/i,
      ]),
    },
    ab: {
      label: 'AB型ベビーカー',
      src: pick([
        /メリオ|MELIO|Runfee|ランフィ/i,
        /AB型寄り|AB型/i,
        /長く使える|バランス/i,
      ]),
    },
    threeWheel: {
      label: '三輪タイプのベビーカー',
      src: pick([
        /スムーヴ|三輪|3輪|AirBuggy|エアバギー|COCO|ココ/i,
        /走行性|安定|公園/i,
      ]),
    },
  };
}

function findGuideProductImage(
  products: GuideProduct[],
  imageByProductId: Map<string, string>,
  matchers: RegExp[],
  usedProductIds: Set<string>,
  usedImageSrcs: Set<string>,
): string {
  for (const matcher of matchers) {
    const product = products.find((candidate) => {
      const text = searchableProductText(candidate);
      const productId = normalizeProductId(candidate.id);
      const src = getGuideProductImage(candidate, imageByProductId);
      return Boolean(src)
        && matcher.test(text)
        && (!productId || !usedProductIds.has(productId))
        && !usedImageSrcs.has(src);
    });

    if (product) {
      const productId = normalizeProductId(product.id);
      const src = getGuideProductImage(product, imageByProductId);
      if (productId) usedProductIds.add(productId);
      usedImageSrcs.add(src);
      return src;
    }
  }

  return '';
}

function getGuideProductImage(product: GuideProduct, imageByProductId: Map<string, string>): string {
  const productId = normalizeProductId(product.id);
  return (productId ? imageByProductId.get(productId) : '') || normalizeImageUrl(product.image_url);
}

function searchableProductText(product: GuideProduct): string {
  return [
    product.name,
    product.product_name,
    product.title,
    product.brand,
    product.maker,
    product.manufacturer,
    product.category,
    product.type,
    product.product_type,
    normalizeTags(product.tags).join(' '),
    normalizeTags(product.feature_tags).join(' '),
  ].filter(Boolean).join(' ');
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
    } catch {
      // Plain separated strings are handled below.
    }
    return trimmed.split(/[,\n、]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function normalizeProductId(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeImageUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/') ? trimmed : '';
}

function extractImageSrc(html: unknown): string {
  if (typeof html !== 'string' || !html.trim()) return '';
  const template = document.createElement('template');
  template.innerHTML = html;
  return normalizeImageUrl(template.content.querySelector('img')?.getAttribute('src'));
}
