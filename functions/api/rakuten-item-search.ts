type RakutenItemSearchEnv = {
  RAKUTEN_APPLICATION_ID?: string;
  RAKUTEN_APP_ID?: string;
  RAKUTEN_ACCESS_KEY?: string;
  RAKUTEN_APPLICATION_SECRET?: string;
  RAKUTEN_AFFILIATE_ID?: string;
};

type PagesContext = {
  request: Request;
  env: RakutenItemSearchEnv;
};

type RakutenSearchItem = Record<string, unknown>;
type SearchPlan = {
  label: string;
  params: Record<string, string>;
};

const ITEM_HOST = 'item.rakuten.co.jp';
const API_URL = 'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601';
const ELEMENTS = [
  'itemName',
  'itemPrice',
  'itemUrl',
  'affiliateUrl',
  'smallImageUrls',
  'mediumImageUrls',
  'shopCode',
  'shopName',
  'itemCode',
  'reviewCount',
  'reviewAverage',
].join(',');

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const requestUrl = new URL(context.request.url);
  const parsedUrl = parseRakutenItemUrl(requestUrl.searchParams.get('url') ?? '');
  if (!parsedUrl) return failure('有効な楽天商品URLを指定してください。', 400);

  const applicationId = readEnv(context.env, 'RAKUTEN_APPLICATION_ID', 'RAKUTEN_APP_ID');
  const accessKey = readEnv(context.env, 'RAKUTEN_ACCESS_KEY', 'RAKUTEN_APPLICATION_SECRET');
  const affiliateId = readEnv(context.env, 'RAKUTEN_AFFILIATE_ID');

  if (!applicationId || !affiliateId) {
    console.error('[rakuten-item-search] Rakuten API environment is incomplete.', {
      hasApplicationId: Boolean(applicationId),
      hasAccessKey: Boolean(accessKey),
      hasAffiliateId: Boolean(affiliateId),
    });
    return failure('楽天APIの接続設定が不足しています。環境変数を確認してください。', 500);
  }

  const productName = cleanKeyword(requestUrl.searchParams.get('productName') ?? '');
  const brandName = cleanKeyword(requestUrl.searchParams.get('brandName') ?? '');
  const searchPlans = buildSearchPlans(parsedUrl, productName, brandName);

  try {
    for (const plan of searchPlans) {
      const payload = await fetchRakutenItems(plan, {
        applicationId,
        accessKey,
        affiliateId,
      });
      const item = pickBestItem(payload, parsedUrl.shopCode);
      if (!item) continue;

      const imageUrls = getRakutenImageUrls(item);
      return json({
        ok: true,
        fallbackAvailable: false,
        normalized_item_url: getText(item.itemUrl) || parsedUrl.normalizedUrl,
        shop_key: getText(item.shopCode) || parsedUrl.shopCode,
        item_code: getText(item.itemCode) || `${parsedUrl.shopCode}:${parsedUrl.itemPath}`,
        title: getText(item.itemName) || null,
        item_name: getText(item.itemName) || null,
        item_price: getNumber(item.itemPrice),
        affiliate_url: getText(item.affiliateUrl) || null,
        image_urls: imageUrls,
        detected_item_id: getText(item.itemCode) || null,
        detected_me_id: null,
        search_method: plan.label,
      });
    }

    return failure('楽天APIで商品情報が見つかりませんでした。商品URLまたは商品名を確認してください。', 200);
  } catch (error) {
    console.error('[rakuten-item-search] Search failed.', {
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return failure('楽天APIから商品情報を取得できませんでした。時間をおいて再度お試しください。', 502);
  }
}

function buildSearchPlans(
  parsedUrl: { shopCode: string; itemPath: string },
  productName: string,
  brandName: string,
) {
  const plans: Array<SearchPlan | null> = [
    { label: 'itemCode', params: { itemCode: `${parsedUrl.shopCode}:${parsedUrl.itemPath}` } },
    productName ? { label: 'shopCode+productName', params: { shopCode: parsedUrl.shopCode, keyword: productName } } : null,
    brandName ? { label: 'shopCode+brandName', params: { shopCode: parsedUrl.shopCode, keyword: brandName } } : null,
    { label: 'shopCode+itemPath', params: { shopCode: parsedUrl.shopCode, keyword: parsedUrl.itemPath.replace(/[/-]+/g, ' ') } },
  ];

  return plans.filter((plan): plan is SearchPlan => Boolean(plan));
}

async function fetchRakutenItems(
  plan: SearchPlan,
  auth: { applicationId: string; accessKey: string; affiliateId: string },
): Promise<unknown> {
  const apiUrl = new URL(API_URL);
  apiUrl.searchParams.set('format', 'json');
  apiUrl.searchParams.set('formatVersion', '2');
  apiUrl.searchParams.set('applicationId', auth.applicationId);
  apiUrl.searchParams.set('affiliateId', auth.affiliateId);
  apiUrl.searchParams.set('elements', ELEMENTS);
  apiUrl.searchParams.set('hits', '10');
  if (auth.accessKey) apiUrl.searchParams.set('accessKey', auth.accessKey);
  Object.entries(plan.params).forEach(([key, value]) => apiUrl.searchParams.set(key, value));

  const response = await fetch(apiUrl, {
    headers: { accept: 'application/json' },
  });
  const contentType = response.headers.get('content-type') ?? '';
  const bodyText = await response.text();

  if (!response.ok || !contentType.toLowerCase().includes('application/json')) {
    console.error('[rakuten-item-search] Non-JSON or failed response.', {
      status: response.status,
      contentType,
      bodyHead: bodyText.slice(0, 300),
      searchMethod: plan.label,
    });
    throw new Error(`Rakuten API response was not usable: ${response.status}`);
  }

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    console.error('[rakuten-item-search] JSON parse failed.', {
      status: response.status,
      contentType,
      bodyHead: bodyText.slice(0, 300),
      searchMethod: plan.label,
    });
    throw new Error('Rakuten API JSON parse failed.');
  }
}

function pickBestItem(payload: unknown, shopCode: string): RakutenSearchItem | null {
  const items = getItems(payload);
  return items.find((item) => getText(item.shopCode).toLowerCase() === shopCode.toLowerCase()) ?? items[0] ?? null;
}

function getItems(payload: unknown): RakutenSearchItem[] {
  if (!payload || typeof payload !== 'object') return [];
  const items = (payload as Record<string, unknown>).Items;
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (item && typeof item === 'object' && 'Item' in item) {
        return (item as Record<string, unknown>).Item;
      }
      return item;
    })
    .filter((item): item is RakutenSearchItem => Boolean(item && typeof item === 'object'));
}

function getRakutenImageUrls(item: RakutenSearchItem): string[] {
  const urls = [
    ...getImageList(item.mediumImageUrls),
    ...getImageList(item.smallImageUrls),
  ];
  return urls.filter((url, index) => urls.indexOf(url) === index).slice(0, 20);
}

function getImageList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') return getText((item as Record<string, unknown>).imageUrl);
      return '';
    })
    .map(normalizeImageUrl)
    .filter(Boolean);
}

function normalizeImageUrl(value: string): string {
  try {
    const url = new URL(value.replace(/^http:\/\//i, 'https://').replace(/\?_ex=\d+x\d+$/, ''));
    if (url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function parseRakutenItemUrl(value: string): { normalizedUrl: string; shopCode: string; itemPath: string } | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== ITEM_HOST) return null;
    const [shopCode, ...itemPathParts] = url.pathname.split('/').filter(Boolean);
    const itemPath = itemPathParts.join('/');
    if (!shopCode || !itemPath || !/^[A-Za-z0-9_-]+$/.test(shopCode)) return null;
    return {
      normalizedUrl: `https://${ITEM_HOST}/${shopCode}/${itemPath}/`,
      shopCode,
      itemPath,
    };
  } catch {
    return null;
  }
}

function readEnv(env: RakutenItemSearchEnv, ...keys: Array<keyof RakutenItemSearchEnv>): string {
  for (const key of keys) {
    const value = env?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function cleanKeyword(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 120);
}

function getText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function failure(message: string, status = 200): Response {
  return json({
    ok: false,
    error: message,
    fallbackAvailable: true,
  }, status);
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
