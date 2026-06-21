type PagesContext = {
  request: Request;
};

const ITEM_HOST = 'item.rakuten.co.jp';
const IMAGE_HOST_PATTERN = /(^|\.)(?:rakuten\.co\.jp|r10s\.jp)$/i;
const MAX_HTML_BYTES = 3_000_000;

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const requestUrl = new URL(context.request.url);
  const normalized = normalizeItemUrl(requestUrl.searchParams.get('url') ?? '');
  if (!normalized) return failure('有効な楽天商品URLを指定してください。', false, 400);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(normalized, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'IRODORI product media importer/1.0',
      },
      redirect: 'follow',
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!response.ok) return failure(`楽天商品ページを取得できませんでした (${response.status})`);
    const finalUrl = normalizeItemUrl(response.url);
    if (!finalUrl) return failure('楽天以外のページへ転送されたため取得を中止しました。');
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_HTML_BYTES) return failure('商品ページのサイズが大きすぎます。');

    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    const parts = new URL(finalUrl).pathname.split('/').filter(Boolean);
    const imageUrls = extractImageUrls(html);
    const itemId = firstMatch(html, [
      /["']item_?id["']\s*[:=]\s*["']([A-Za-z0-9_-]+)["']/i,
      /[?&]item_id=([A-Za-z0-9_-]+)/i,
      /["']itemId["']\s*:\s*["']([A-Za-z0-9_-]+)["']/i,
    ]);
    const meId = firstMatch(html, [/[?&]me_id=([A-Za-z0-9_-]+)/i, /["']me_?id["']\s*[:=]\s*["']([A-Za-z0-9_-]+)["']/i]);
    const title = decodeEntities(firstMatch(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    ])) || null;

    return json({
      ok: true,
      fallbackAvailable: false,
      normalized_item_url: finalUrl,
      shop_key: parts[0],
      item_code: parts[1],
      title,
      image_urls: imageUrls,
      detected_item_id: itemId || null,
      detected_me_id: meId || null,
    });
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? '楽天商品ページの取得がタイムアウトしました。'
      : '楽天商品ページの取得に失敗しました。';
    return failure(message);
  }
}

function failure(message: string, fallbackAvailable = true, status = 200): Response {
  return json({
    ok: false,
    error: message,
    fallbackAvailable,
  }, status);
}

function normalizeItemUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== ITEM_HOST) return '';
    const [shopKey, itemCode] = url.pathname.split('/').filter(Boolean);
    if (!shopKey || !itemCode || !/^[A-Za-z0-9_-]+$/.test(shopKey) || !/^[A-Za-z0-9_-]+$/.test(itemCode)) return '';
    return `https://${ITEM_HOST}/${shopKey}/${itemCode}/`;
  } catch {
    return '';
  }
}

function extractImageUrls(html: string): string[] {
  const candidates = [
    ...Array.from(html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi), (match) => match[1]),
    ...Array.from(html.matchAll(/<(?:img|source)[^>]+(?:src|data-src|data-original)=["']([^"']+)["']/gi), (match) => match[1]),
  ];
  const result: string[] = [];
  for (const candidate of candidates) {
    try {
      const url = new URL(decodeEntities(candidate).replace(/^\/\//, 'https://'));
      if (url.protocol !== 'https:' || !IMAGE_HOST_PATTERN.test(url.hostname)) continue;
      url.hash = '';
      const normalized = url.toString();
      if (!result.includes(normalized)) result.push(normalized);
      if (result.length >= 20) break;
    } catch {
      // Ignore malformed page markup.
    }
  }
  return result;
}

function firstMatch(value: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
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
