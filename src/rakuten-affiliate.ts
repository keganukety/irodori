export type RakutenAffiliateImageCandidate = {
  affiliateUrl: string;
  imageUrl: string;
  itemId: string;
  meId: string;
  imageSize: string;
  rakutenItemUrl: string;
  shopKey: string;
  affiliatePath: string;
  sourceType?: 'affiliate-html' | 'rakuten-api';
  itemName?: string;
  itemPrice?: number | null;
};

const allowedAffiliateHost = 'hb.afl.rakuten.co.jp';
const allowedImageHost = 'hbb.afl.rakuten.co.jp';
const allowedItemHost = 'item.rakuten.co.jp';

export type RakutenShopSetting = {
  shop_key: string;
  me_id: string;
  affiliate_path: string;
  sample_affiliate_url?: string | null;
  sample_item_url?: string | null;
};

export type RakutenProductInfo = {
  ok: true;
  fallbackAvailable: false;
  normalized_item_url: string;
  shop_key: string;
  item_code: string;
  title: string | null;
  item_name?: string | null;
  item_price?: number | null;
  affiliate_url?: string | null;
  image_urls: string[];
  detected_item_id: string | null;
  detected_me_id: string | null;
  search_method?: string;
};

export type RakutenProductInfoFailure = {
  ok: false;
  error: string;
  fallbackAvailable: boolean;
};

export type RakutenProductInfoResponse = RakutenProductInfo | RakutenProductInfoFailure;

export function normalizeRakutenItemUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== allowedItemHost) return '';
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return '';
    const [shopCode, ...itemPathParts] = parts;
    const itemPath = itemPathParts.map((part) => encodeURIComponent(part)).join('/');
    return `https://${allowedItemHost}/${encodeURIComponent(shopCode)}/${itemPath}/`;
  } catch {
    return '';
  }
}

export function getRakutenShopKey(itemUrl: string): string {
  try {
    const normalized = normalizeRakutenItemUrl(itemUrl);
    return normalized ? new URL(normalized).pathname.split('/').filter(Boolean)[0] ?? '' : '';
  } catch {
    return '';
  }
}

export function createRakutenAffiliateCandidate(
  itemUrl: string,
  sourceImageUrl: string,
  setting: RakutenShopSetting,
  itemId: string,
  displaySize = '400x400',
): RakutenAffiliateImageCandidate | null {
  const normalizedItemUrl = normalizeRakutenItemUrl(itemUrl);
  const shopKey = getRakutenShopKey(normalizedItemUrl);
  const meId = cleanIdentifier(setting.me_id);
  const safeItemId = cleanIdentifier(itemId);
  const affiliatePath = normalizeAffiliatePath(setting.affiliate_path);
  if (!normalizedItemUrl || !shopKey || shopKey !== setting.shop_key || !meId || !safeItemId || !affiliatePath) return null;

  let source: URL;
  try {
    source = new URL(sourceImageUrl);
    if (source.protocol !== 'https:') return null;
  } catch {
    return null;
  }

  const affiliateUrl = new URL(`https://${allowedAffiliateHost}/ichiba/${affiliatePath}`);
  affiliateUrl.searchParams.set('pc', normalizedItemUrl);
  affiliateUrl.searchParams.set('link_type', 'pict');
  const imageUrl = new URL(`https://${allowedImageHost}/hgb/${affiliatePath}`);
  imageUrl.searchParams.set('me_id', meId);
  imageUrl.searchParams.set('item_id', safeItemId);
  imageUrl.searchParams.set('pc', source.toString());
  imageUrl.searchParams.set('s', displaySize);
  imageUrl.searchParams.set('t', 'pict');

  return {
    affiliateUrl: affiliateUrl.toString(),
    imageUrl: imageUrl.toString(),
    itemId: safeItemId,
    meId,
    imageSize: displaySize,
    rakutenItemUrl: normalizedItemUrl,
    shopKey,
    affiliatePath,
    sourceType: 'affiliate-html',
  };
}

export function parseRakutenAffiliateHtml(html: string, itemUrlInput = ''): RakutenAffiliateImageCandidate[] {
  const template = document.createElement('template');
  template.innerHTML = html;
  const fallbackItemUrl = normalizeRakutenItemUrl(itemUrlInput);
  const seen = new Set<string>();
  const results: RakutenAffiliateImageCandidate[] = [];

  template.content.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    const image = anchor.querySelector<HTMLImageElement>('img[src]');
    if (!image) return;

    const affiliateUrl = normalizeAllowedUrl(anchor.getAttribute('href') ?? '', allowedAffiliateHost);
    const imageUrl = normalizeAllowedUrl(image.getAttribute('src') ?? '', allowedImageHost);
    if (!affiliateUrl || !imageUrl) return;

    const imageDetails = readImageDetails(imageUrl);
    const affiliateDetails = readAffiliateDetails(affiliateUrl);
    const rakutenItemUrl = fallbackItemUrl || affiliateDetails.itemUrl;
    const shopKey = getRakutenShopKey(rakutenItemUrl);
    const duplicateKey = `${affiliateUrl}\n${imageUrl}`;
    if (!rakutenItemUrl || !shopKey || !imageDetails.itemId || !imageDetails.meId || !affiliateDetails.affiliatePath || seen.has(duplicateKey)) return;

    seen.add(duplicateKey);
    results.push({
      affiliateUrl,
      imageUrl,
      itemId: imageDetails.itemId,
      meId: imageDetails.meId,
      imageSize: imageDetails.imageSize,
      rakutenItemUrl,
      shopKey,
      affiliatePath: affiliateDetails.affiliatePath,
      sourceType: 'affiliate-html',
    });
  });

  return results;
}

function normalizeAllowedUrl(value: string, allowedHost: string): string {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== allowedHost) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function readImageDetails(imageUrl: string) {
  const url = new URL(imageUrl);
  return {
    meId: cleanIdentifier(url.searchParams.get('me_id')),
    itemId: cleanIdentifier(url.searchParams.get('item_id')),
    imageSize: normalizeImageSize(url.searchParams.get('s') || url.searchParams.get('size') || ''),
  };
}

function readAffiliateDetails(affiliateUrl: string) {
  const url = new URL(affiliateUrl);
  const pathMatch = url.pathname.match(/^\/ichiba\/([^/]+)\/?/);
  const encodedItemUrl = url.searchParams.get('pc') ?? '';
  return {
    affiliatePath: pathMatch?.[1] ? `${pathMatch[1]}/` : '',
    itemUrl: normalizeRakutenItemUrl(encodedItemUrl),
  };
}

function cleanIdentifier(value: string | null): string {
  const normalized = value?.trim() ?? '';
  return /^[A-Za-z0-9_-]+$/.test(normalized) ? normalized : '';
}

function normalizeAffiliatePath(value: string): string {
  const normalized = value.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return /^[A-Za-z0-9.]+$/.test(normalized) ? `${normalized}/` : '';
}

function normalizeImageSize(value: string): string {
  const match = value.trim().match(/^(\d{2,4})x(\d{2,4})$/i);
  return match ? `${match[1]}x${match[2]}` : '';
}
