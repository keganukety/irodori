/** The public, read-only contract exported by the Pinterest → ROOM workflow. */
export interface RoomProduct {
  itemCode: string;
  name: string;
  itemUrl: string;
  affiliateUrl: string;
  imageUrl: string;
  price: number;
  rating: number;
  reviewCount: number;
  ratingCheckedAt: string;
  ratingSourceUrl: string;
  similarityReason: string;
  availability: 'available';
  roomPostUrl?: string;
}

export interface RoomScene {
  id: string;
  date: string;
  themeLabel?: string;
  roomCollectionUrl?: string;
  title: string;
  summary: string;
  imageUrl: string;
  imageAlt: string;
  disclosure: string;
  products: RoomProduct[];
}

export interface RoomScenesIndex {
  schemaVersion: 1;
  scenes: RoomScene[];
}

const MIN_RATING = 4.5;
const PRODUCT_IMAGE_HOSTS = new Set(['thumbnail.image.rakuten.co.jp', 'image.rakuten.co.jp', 'tshop.r10s.jp']);
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function safeHttpsUrl(value: unknown): URL | null {
  if (!text(value, 4096) || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
    return url;
  } catch {
    return null;
  }
}

function hasAllowedHost(value: unknown, hosts: Set<string>): value is string {
  const url = safeHttpsUrl(value);
  return Boolean(url && hosts.has(url.hostname) && url.pathname !== '/');
}

function itemUrl(value: unknown): value is string {
  const url = safeHttpsUrl(value);
  if (!url || url.hostname !== 'item.rakuten.co.jp' || url.hash) return false;
  // Rakuten's internal itemCode may differ from the shop's public URL slug.
  return /^\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\/?$/.test(url.pathname);
}

function affiliateUrl(value: unknown): value is string {
  const url = safeHttpsUrl(value);
  if (!url || url.pathname === '/') return false;
  return url.hostname === 'hb.afl.rakuten.co.jp' || url.hostname.endsWith('.afl.rakuten.co.jp') || url.hostname === 'r10.to' || url.hostname.endsWith('.r10.to');
}

function sameItemUrl(left: string, right: string): boolean {
  const a = safeHttpsUrl(left);
  const b = safeHttpsUrl(right);
  return Boolean(a && b && a.hostname === b.hostname && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, ''));
}

function calendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function capturedTimestamp(value: unknown, now: number): value is string {
  if (typeof value !== 'string' || !TIMESTAMP_PATTERN.test(value) || !calendarDate(value.slice(0, 10))) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > 0 && timestamp <= now;
}

function localRoomImage(value: unknown): value is string {
  // Only the pipeline's copied static assets can be used for the AI room image.
  return typeof value === 'string' && /^\/room-scenes\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(value);
}

function roomPostUrl(value: unknown): value is string {
  const url = safeHttpsUrl(value);
  return Boolean(url && url.hostname === 'room.rakuten.co.jp' && /^\/room_[A-Za-z0-9_.-]+\/170\d+\/?$/.test(url.pathname) && !url.hash);
}

function roomCollectionUrl(value: unknown): value is string {
  const url = safeHttpsUrl(value);
  // Confirmed on ROOM's public collection detail UI. /collections is only
  // the profile's collection listing, not a destination for one theme.
  return Boolean(url && url.hostname === 'room.rakuten.co.jp' && /^\/room_[A-Za-z0-9_.-]+\/180\d+\/?$/.test(url.pathname) && !url.hash && !url.search);
}

/** A stable Pinterest destination for this particular room and its products. */
export function roomScenePath(sceneId: string): string {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(sceneId)) throw new Error('部屋IDの形式を確認できませんでした。');
  return `/rooms.html#${encodeURIComponent(sceneId)}`;
}

function validateProduct(value: unknown, now: number): RoomProduct | null {
  if (!record(value) || !text(value.itemCode, 256) || !/^[A-Za-z0-9_-]+:[A-Za-z0-9_.-]+$/.test(value.itemCode)) return null;
  if (!text(value.name, 1000) || !text(value.similarityReason, 2000)) return null;
  if (!itemUrl(value.itemUrl) || !itemUrl(value.ratingSourceUrl)) return null;
  if (!sameItemUrl(value.itemUrl, value.ratingSourceUrl)) return null;
  if (!affiliateUrl(value.affiliateUrl) || !hasAllowedHost(value.imageUrl, PRODUCT_IMAGE_HOSTS)) return null;
  if (typeof value.price !== 'number' || !Number.isSafeInteger(value.price) || value.price < 1) return null;
  if (typeof value.rating !== 'number' || !Number.isFinite(value.rating) || value.rating < MIN_RATING || value.rating > 5) return null;
  if (typeof value.reviewCount !== 'number' || !Number.isSafeInteger(value.reviewCount) || value.reviewCount < 1) return null;
  if (!capturedTimestamp(value.ratingCheckedAt, now) || value.availability !== 'available') return null;
  if (value.roomPostUrl !== undefined && value.roomPostUrl !== '' && !roomPostUrl(value.roomPostUrl)) return null;

  return {
    itemCode: value.itemCode,
    name: value.name.trim(),
    itemUrl: value.itemUrl,
    affiliateUrl: value.affiliateUrl,
    imageUrl: value.imageUrl,
    price: value.price,
    rating: value.rating,
    reviewCount: value.reviewCount,
    ratingCheckedAt: value.ratingCheckedAt,
    ratingSourceUrl: value.ratingSourceUrl,
    similarityReason: value.similarityReason.trim(),
    availability: 'available',
    ...(value.roomPostUrl ? { roomPostUrl: value.roomPostUrl } : {}),
  };
}

/**
 * Reject invalid entries without rendering untrusted markup or URL schemes.
 * The publishing workflow enforces fresh evidence before export. Published
 * scenes retain their recorded ratings and dates rather than disappearing
 * after 24 hours; the page explicitly describes these as captured values.
 */
export function validateRoomScenesIndex(value: unknown, now = Date.now()): RoomScenesIndex {
  if (!Number.isFinite(now) || !record(value) || value.schemaVersion !== 1 || !Array.isArray(value.scenes)) {
    throw new Error('部屋データの形式を確認できませんでした。');
  }
  const todayInJapan = new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ids = new Set<string>();
  const scenes: RoomScene[] = [];

  for (const candidate of value.scenes.slice(0, 1000)) {
    if (!record(candidate) || !text(candidate.id, 100) || !/^[A-Za-z0-9_-]+$/.test(candidate.id) || ids.has(candidate.id)) continue;
    if (!calendarDate(candidate.date) || candidate.date > todayInJapan) continue;
    if (!text(candidate.title, 200) || !text(candidate.summary, 4000) || !text(candidate.imageAlt, 1000) || !text(candidate.disclosure, 2000)) continue;
    if (!localRoomImage(candidate.imageUrl) || !Array.isArray(candidate.products)) continue;
    const productCodes = new Set<string>();
    const products = candidate.products.slice(0, 100).flatMap((product) => {
      const validated = validateProduct(product, now);
      if (!validated || productCodes.has(validated.itemCode)) return [];
      productCodes.add(validated.itemCode);
      return [validated];
    });
    if (products.length === 0) continue;
    ids.add(candidate.id);
    scenes.push({
      id: candidate.id,
      date: candidate.date,
      ...(text(candidate.themeLabel, 100) ? { themeLabel: candidate.themeLabel.trim() } : {}),
      ...(roomCollectionUrl(candidate.roomCollectionUrl) ? { roomCollectionUrl: candidate.roomCollectionUrl } : {}),
      title: candidate.title.trim(),
      summary: candidate.summary.trim(),
      imageUrl: candidate.imageUrl,
      imageAlt: candidate.imageAlt.trim(),
      disclosure: candidate.disclosure.trim(),
      products,
    });
  }
  scenes.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  return { schemaVersion: 1, scenes };
}

export async function loadRoomScenesIndex(): Promise<RoomScenesIndex> {
  const response = await fetch('/room-scenes/index.json', { cache: 'no-cache', credentials: 'same-origin' });
  if (!response.ok) throw new Error('部屋データを読み込めませんでした。');
  return validateRoomScenesIndex(await response.json());
}
