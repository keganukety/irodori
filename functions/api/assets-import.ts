import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type AssetImportEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  ALLOWED_EXTENSION_ORIGINS?: string;
  ASSET_IMPORT_ALLOWED_ORIGINS?: string;
  ASSET_IMPORT_ENABLE_CLOUDFLARE_IMAGE_RESIZING?: string;
};

type PagesContext = {
  request: Request;
  env: AssetImportEnv;
};

type SiteAssetType = 'hero' | 'category' | 'article' | 'brand_logo' | 'brand_hero';
type SiteAssetMimeType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';
type ImageSlot = 'desktop' | 'mobile';

type ImportImageInput = {
  url?: unknown;
  sourcePageUrl?: unknown;
  alt?: unknown;
  title?: unknown;
};

type AssetInput = {
  asset_key?: unknown;
  asset_type?: unknown;
  folder_id?: unknown;
  title?: unknown;
  alt_text?: unknown;
  brand_slug_or_category?: unknown;
  image_slot?: unknown;
  is_published?: unknown;
  display_order?: unknown;
  link_url?: unknown;
  memo?: unknown;
};

type ImportRequestBody = {
  images?: unknown;
  asset?: unknown;
  options?: unknown;
};

type NormalizedAssetInput = {
  assetKey: string;
  assetType: SiteAssetType;
  folderId: string | null;
  title: string;
  altText: string;
  scope: string;
  imageSlot: ImageSlot;
  isPublished: boolean;
  displayOrder: number;
  assetKeyStartIndex: number | null;
  linkUrl: string | null;
  memo: string;
  optimize: boolean;
  forceDuplicate: boolean;
};

type PreparedImportImage = {
  sourceUrl: string;
  sourceUrlHash: string;
  sourcePageUrl: string | null;
  alt: string;
  title: string;
  duplicate: DuplicateSource | null;
};

type DuplicateSource = {
  asset_id: string;
  asset_key: string;
  asset_type: string;
  title: string;
  desktop_image_url: string;
  created_at: string;
};

type ImageBytes = {
  bytes: Uint8Array;
  mimeType: SiteAssetMimeType;
  width: number;
  height: number;
  finalUrl: string;
  optimized: boolean;
  optimizationMessage: string;
};

type StoredImage = {
  publicUrl: string;
  storagePath: string;
  mimeType: SiteAssetMimeType;
  width: number;
  height: number;
};

type CreatedAsset = {
  id: string;
  asset_key: string;
  asset_type: string;
  title: string;
  desktop_image_url: string;
  mobile_image_url: string | null;
};

type AssetFolder = {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
};

const storageBucket = 'site-assets';
const maxImportImages = 30;
const maxSourceBytes = 20 * 1024 * 1024;
const maxStoredBytes = 5 * 1024 * 1024;
const fetchTimeoutMs = 12_000;
const maxRedirects = 3;
const validAssetTypes: SiteAssetType[] = ['hero', 'category', 'article', 'brand_logo', 'brand_hero'];
const validMimeTypes: SiteAssetMimeType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const assetKeyPattern = /^[a-z0-9][a-z0-9_-]*$/;
const brandSlugPattern = /^[a-z0-9][a-z0-9-]*$/;
const defaultAllowedExtensionOrigins = [
  'chrome-extension://nacncbbiibbnjlhpadfbgdgnfejigmfm',
];

export async function onRequestOptions(context: PagesContext): Promise<Response> {
  const cors = getCorsHeaders(context.request, context.env);
  if (!cors.allowed) return json({ ok: false, error: 'この送信元からは利用できません。' }, 403, cors.headers);
  return new Response(null, {
    status: 204,
    headers: cors.headers,
  });
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const cors = getCorsHeaders(context.request, context.env);
  if (!cors.allowed) return json({ ok: false, error: 'この送信元からは利用できません。' }, 403, cors.headers);

  try {
    const token = readBearerToken(context.request);
    const supabase = createAuthenticatedSupabaseClient(context.env, token);
    await assertAdmin(supabase);
    const { data, error } = await supabase.rpc('list_site_asset_folders');
    if (error) throw new UserFacingError('フォルダ一覧を取得できませんでした。Supabase migrationを適用してください。', 500);
    return json({ ok: true, folders: (data ?? []) as AssetFolder[] }, 200, cors.headers);
  } catch (error) {
    const status = error instanceof UserFacingError ? error.status : 500;
    return json({
      ok: false,
      error: getErrorMessage(error),
    }, status, cors.headers);
  }
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const cors = getCorsHeaders(context.request, context.env);
  if (!cors.allowed) return json({ ok: false, error: 'この送信元からは利用できません。' }, 403, cors.headers);

  try {
    const token = readBearerToken(context.request);
    const supabase = createAuthenticatedSupabaseClient(context.env, token);
    await assertAdmin(supabase);

    const body = await readJsonBody(context.request);
    const normalized = normalizeImportBody(body);
    const preparedImages = await prepareImportImages(supabase, normalized.images);
    const duplicates = preparedImages
      .filter((image) => image.duplicate)
      .map((image) => ({
        source_url: image.sourceUrl,
        existing_asset: image.duplicate,
      }));

    if (duplicates.length > 0 && !normalized.asset.forceDuplicate) {
      return json({
        ok: false,
        duplicate: true,
        error: '同じ画像URLがすでに登録されています。内容を確認してから保存してください。',
        duplicates,
        can_force_duplicate: true,
      }, 409, cors.headers);
    }

    const created: CreatedAsset[] = [];
    const failures: Array<{ source_url: string; error: string }> = [];
    const warnings: string[] = [];

    for (const [index, image] of preparedImages.entries()) {
      try {
        const result = await importOneImage(supabase, context.env, normalized.asset, image, index, preparedImages.length);
        created.push(result.asset);
        warnings.push(...result.warnings);
      } catch (error) {
        failures.push({
          source_url: image.sourceUrl,
          error: getErrorMessage(error),
        });
      }
    }

    if (created.length === 0) {
      const message = failures[0]?.error || '画像を保存できませんでした。';
      throw new UserFacingError(message, 400, { failures });
    }

    return json({
      ok: failures.length === 0,
      partial: failures.length > 0,
      assets: created,
      failures,
      warnings,
      assets_admin_url: `/assets-admin.html?asset_key=${encodeURIComponent(created[0].asset_key)}`,
    }, 200, cors.headers);
  } catch (error) {
    const status = error instanceof UserFacingError ? error.status : 500;
    const details = error instanceof UserFacingError ? error.details : undefined;
    console.warn('[assets-import] request failed', {
      status,
      message: getErrorMessage(error),
    });
    return json({
      ok: false,
      error: getErrorMessage(error),
      details,
    }, status, cors.headers);
  }
}

function createAuthenticatedSupabaseClient(env: AssetImportEnv, accessToken: string): SupabaseClient {
  const supabaseUrl = normalizeSupabaseUrl(env.VITE_SUPABASE_URL);
  const anonKey = typeof env.VITE_SUPABASE_ANON_KEY === 'string' ? env.VITE_SUPABASE_ANON_KEY.trim() : '';
  if (!supabaseUrl || !anonKey) {
    throw new UserFacingError('Supabaseの公開接続設定が不足しています。', 500);
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

async function assertAdmin(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) {
    throw new UserFacingError('管理者権限を確認できませんでした。サイトへログインし直してください。', 403);
  }
  if (data !== true) {
    throw new UserFacingError('この操作は管理者だけが利用できます。', 403);
  }
}

function readBearerToken(request: Request): string {
  const authorization = request.headers.get('authorization') ?? '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() ?? '';
  if (!token) throw new UserFacingError('ログイン情報がありません。拡張機能をサイトに接続してください。', 401);
  return token;
}

async function readJsonBody(request: Request): Promise<ImportRequestBody> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new UserFacingError('JSON形式で送信してください。', 415);
  }

  try {
    return await request.json() as ImportRequestBody;
  } catch {
    throw new UserFacingError('送信内容を読み取れませんでした。', 400);
  }
}

function normalizeImportBody(body: ImportRequestBody): { images: ImportImageInput[]; asset: NormalizedAssetInput } {
  const rawImages = Array.isArray(body.images) ? body.images : [];
  if (rawImages.length > maxImportImages) {
    throw new UserFacingError(`一度に保存できる画像は最大${maxImportImages}件です。選択数を減らしてください。`, 400);
  }
  const images = rawImages
    .filter((image): image is ImportImageInput => Boolean(image && typeof image === 'object'));
  if (images.length === 0) throw new UserFacingError('保存する画像を選択してください。', 400);

  const rawAsset = body.asset && typeof body.asset === 'object' ? body.asset as AssetInput : {};
  const rawOptions = body.options && typeof body.options === 'object' ? body.options as Record<string, unknown> : {};
  const assetKey = normalizeAssetKey(readText(rawAsset.asset_key, 80));
  const assetType = readSiteAssetType(rawAsset.asset_type);
  const folderId = readOptionalUuid(rawAsset.folder_id, 'フォルダ');
  const displayOrder = readDisplayOrder(rawAsset.display_order);
  const assetKeyStartIndex = readAssetKeyStartIndex(rawOptions.asset_key_start_index);
  const imageSlot = rawAsset.image_slot === 'mobile' ? 'mobile' : 'desktop';
  const scope = readText(rawAsset.brand_slug_or_category, 120);
  const forceDuplicate = rawOptions.force_duplicate === true;

  if (!assetKeyPattern.test(assetKey)) {
    throw new UserFacingError('asset_keyは小文字英数字、ハイフン、アンダースコアで入力してください。', 400);
  }
  if ((assetType === 'brand_logo' || assetType === 'brand_hero') && (!scope || !brandSlugPattern.test(scope))) {
    throw new UserFacingError('ブランド素材では brand slug を入力してください。', 400);
  }

  return {
    images,
    asset: {
      assetKey,
      assetType,
      folderId,
      title: readText(rawAsset.title, 160),
      altText: readText(rawAsset.alt_text, 220),
      scope,
      imageSlot,
      isPublished: rawAsset.is_published === true,
      displayOrder,
      assetKeyStartIndex,
      linkUrl: normalizeLinkUrl(readText(rawAsset.link_url, 500)),
      memo: readText(rawAsset.memo, 1000),
      optimize: rawOptions.optimize !== false,
      forceDuplicate,
    },
  };
}

async function prepareImportImages(supabase: SupabaseClient, images: ImportImageInput[]): Promise<PreparedImportImage[]> {
  const result: PreparedImportImage[] = [];
  const seen = new Set<string>();
  for (const image of images) {
    const sourceUrl = normalizeImageSourceUrl(readText(image.url, 2000));
    if (seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    const sourceUrlHash = await sha256Hex(sourceUrl);
    const duplicate = await findDuplicateSource(supabase, sourceUrlHash);
    result.push({
      sourceUrl,
      sourceUrlHash,
      sourcePageUrl: normalizeOptionalPageUrl(readText(image.sourcePageUrl, 2000)),
      alt: readText(image.alt, 220),
      title: readText(image.title, 160),
      duplicate,
    });
  }
  if (result.length === 0) throw new UserFacingError('保存できる画像URLがありません。', 400);
  return result;
}

async function findDuplicateSource(supabase: SupabaseClient, sourceUrlHash: string): Promise<DuplicateSource | null> {
  const { data, error } = await supabase.rpc('find_site_asset_import_source', {
    p_source_url_hash: sourceUrlHash,
  });
  if (error) {
    throw new UserFacingError('重複チェックに失敗しました。Supabase migrationを適用してください。', 500);
  }
  const rows = Array.isArray(data) ? data as DuplicateSource[] : [];
  return rows[0] ?? null;
}

async function importOneImage(
  supabase: SupabaseClient,
  env: AssetImportEnv,
  fields: NormalizedAssetInput,
  image: PreparedImportImage,
  index: number,
  total: number,
): Promise<{ asset: CreatedAsset; warnings: string[] }> {
  const sequenceIndex = fields.assetKeyStartIndex === null ? index + 1 : fields.assetKeyStartIndex + index;
  const assetKey = total === 1 && fields.assetKeyStartIndex === null
    ? fields.assetKey
    : createIndexedAssetKey(fields.assetKey, sequenceIndex);
  const title = total === 1 && fields.assetKeyStartIndex === null
    ? fields.title || image.title
    : appendIndex(fields.title || image.title || assetKey, sequenceIndex);
  const altText = fields.altText || image.alt || title;
  const fetched = await fetchAndPrepareImage(image.sourceUrl, env, fields.optimize);
  const uploadedPaths: string[] = [];
  const warnings: string[] = [];

  try {
    const desktopImage = await uploadStoredImage(supabase, fetched, assetKey, 'desktop');
    uploadedPaths.push(desktopImage.storagePath);

    let mobileImage: StoredImage | null = null;
    if (fields.imageSlot === 'mobile') {
      mobileImage = await uploadStoredImage(supabase, fetched, assetKey, 'mobile');
      uploadedPaths.push(mobileImage.storagePath);
    }

    const createPayload = {
      p_asset_key: assetKey,
      p_asset_type: fields.assetType,
      p_title: title,
      p_alt_text: altText,
      p_caption: fields.memo,
      p_desktop_image_url: desktopImage.publicUrl,
      p_desktop_storage_path: desktopImage.storagePath,
      p_desktop_mime_type: desktopImage.mimeType,
      p_desktop_width: desktopImage.width,
      p_desktop_height: desktopImage.height,
      p_mobile_image_url: mobileImage?.publicUrl ?? null,
      p_mobile_storage_path: mobileImage?.storagePath ?? null,
      p_mobile_mime_type: mobileImage?.mimeType ?? null,
      p_mobile_width: mobileImage?.width ?? null,
      p_mobile_height: mobileImage?.height ?? null,
      p_link_url: fields.linkUrl,
      p_display_order: fields.displayOrder + index,
      p_is_published: fields.isPublished,
      p_starts_at: null,
      p_ends_at: null,
    };
    const { data, error } = await supabase.rpc('create_site_asset', fields.folderId
      ? { ...createPayload, p_folder_id: fields.folderId }
      : createPayload);
    if (error) throw new UserFacingError(error.message, 400);
    const asset = data as CreatedAsset;

    const brandWarning = await linkBrandIfNeeded(supabase, fields, assetKey);
    if (brandWarning) warnings.push(brandWarning);

    const sourceWarning = await recordImportSource(supabase, asset.id, image);
    if (sourceWarning) warnings.push(sourceWarning);
    if (fetched.optimized) warnings.push(`${assetKey}: ${fetched.optimizationMessage}`);

    return { asset, warnings };
  } catch (error) {
    await rollbackUploads(supabase, uploadedPaths);
    throw error;
  }
}

async function linkBrandIfNeeded(supabase: SupabaseClient, fields: NormalizedAssetInput, assetKey: string): Promise<string> {
  if (fields.assetType !== 'brand_logo' && fields.assetType !== 'brand_hero') return '';

  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id, slug, display_name')
    .eq('slug', fields.scope)
    .maybeSingle();
  if (brandError || !brand || typeof brand.id !== 'string') {
    return `${assetKey}: 素材は保存しましたが、ブランド slug「${fields.scope}」に紐付けできませんでした。`;
  }

  const { error } = await supabase.rpc('link_brand_site_asset', {
    p_brand_id: brand.id,
    p_asset_type: fields.assetType,
    p_asset_key: assetKey,
  });
  return error ? `${assetKey}: 素材は保存しましたが、ブランドへの紐付けに失敗しました: ${error.message}` : '';
}

async function recordImportSource(
  supabase: SupabaseClient,
  assetId: string,
  image: PreparedImportImage,
): Promise<string> {
  const { error } = await supabase.rpc('record_site_asset_import_source', {
    p_site_asset_id: assetId,
    p_source_url: image.sourceUrl,
    p_source_url_hash: image.sourceUrlHash,
    p_source_page_url: image.sourcePageUrl,
  });
  return error ? '画像は保存しましたが、重複確認用の元URL履歴を保存できませんでした。' : '';
}

async function fetchAndPrepareImage(sourceUrl: string, env: AssetImportEnv, optimize: boolean): Promise<ImageBytes> {
  const original = await fetchRemoteImage(sourceUrl, false);
  let selected = original;

  if (optimize && shouldUseCloudflareImageResizing(env) && original.mimeType !== 'image/avif') {
    try {
      const optimized = await fetchRemoteImage(sourceUrl, true);
      if (optimized.mimeType === 'image/webp' && optimized.bytes.byteLength > 0 && optimized.bytes.byteLength < original.bytes.byteLength) {
        selected = {
          ...optimized,
          optimized: true,
          optimizationMessage: `WebP最適化を適用しました (${formatBytes(original.bytes.byteLength)} -> ${formatBytes(optimized.bytes.byteLength)})`,
        };
      }
    } catch (error) {
      console.warn('[assets-import] image optimization skipped', {
        message: getErrorMessage(error),
        sourceUrl,
      });
    }
  }

  if (selected.bytes.byteLength > maxStoredBytes) {
    throw new UserFacingError('画像が5MBを超えています。Cloudflare Image Resizingを有効にするか、軽量な画像を選んでください。', 413);
  }

  return selected;
}

async function fetchRemoteImage(sourceUrl: string, cfImage: boolean): Promise<ImageBytes> {
  const { response, finalUrl } = await fetchWithValidatedRedirects(sourceUrl, cfImage);
  if (!response.ok) {
    throw new UserFacingError(`画像を取得できませんでした（HTTP ${response.status}）。`, 502);
  }

  const bytes = await readLimitedBody(response, maxSourceBytes);
  const declaredType = response.headers.get('content-type') ?? '';
  const mimeType = sniffImageMime(bytes, declaredType);
  if (!mimeType) {
    throw new UserFacingError('取得したファイルが対応画像形式ではありません。JPEG / PNG / WebP / AVIF のみ保存できます。', 415);
  }

  const dimensions = readImageDimensions(bytes, mimeType);
  return {
    bytes,
    mimeType,
    width: dimensions.width,
    height: dimensions.height,
    finalUrl,
    optimized: false,
    optimizationMessage: '',
  };
}

async function fetchWithValidatedRedirects(sourceUrl: string, cfImage: boolean): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = sourceUrl;
  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const url = new URL(currentUrl);
    validateFetchTarget(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), fetchTimeoutMs);
    const init = {
      headers: {
        accept: 'image/avif,image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.1',
        'user-agent': 'iLy asset importer/1.0',
      },
      redirect: 'manual',
      signal: controller.signal,
    } as RequestInit & { cf?: unknown };
    if (cfImage) {
      init.cf = {
        image: {
          format: 'webp',
          quality: 82,
          metadata: 'none',
        },
      };
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), init);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new UserFacingError('画像の取得がタイムアウトしました。', 504);
      }
      throw new UserFacingError('画像URLを取得できませんでした。', 502);
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new UserFacingError('画像URLの転送先を確認できませんでした。', 502);
      const redirected = new URL(location, url);
      validateFetchTarget(redirected);
      currentUrl = redirected.toString();
      continue;
    }

    return { response, finalUrl: url.toString() };
  }

  throw new UserFacingError('画像URLの転送回数が多すぎます。', 502);
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new UserFacingError('画像サイズが20MBを超えています。', 413);
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) throw new UserFacingError('画像サイズが20MBを超えています。', 413);
    return new Uint8Array(buffer);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new UserFacingError('画像サイズが20MBを超えています。', 413);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function uploadStoredImage(
  supabase: SupabaseClient,
  image: ImageBytes,
  assetKey: string,
  variant: ImageSlot,
): Promise<StoredImage> {
  const extension = extensionForMimeType(image.mimeType);
  const storagePath = `external-imports/${assetKey}/${variant}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const buffer = image.bytes.buffer.slice(
    image.bytes.byteOffset,
    image.bytes.byteOffset + image.bytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([buffer], { type: image.mimeType });
  const { error } = await supabase.storage.from(storageBucket).upload(storagePath, blob, {
    cacheControl: '3600',
    contentType: image.mimeType,
    upsert: false,
  });
  if (error) throw new UserFacingError(error.message, 400);
  const { data } = supabase.storage.from(storageBucket).getPublicUrl(storagePath);
  return {
    publicUrl: data.publicUrl,
    storagePath,
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
  };
}

async function rollbackUploads(supabase: SupabaseClient, storagePaths: string[]) {
  const uniquePaths = [...new Set(storagePaths)];
  if (uniquePaths.length === 0) return;
  const { error } = await supabase.storage.from(storageBucket).remove(uniquePaths);
  if (error) {
    console.warn('[assets-import] rollback failed', {
      paths: uniquePaths,
      message: error.message,
    });
  }
}

function validateFetchTarget(url: URL) {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UserFacingError('画像URLは http / https のみ利用できます。', 400);
  }
  if (url.username || url.password) {
    throw new UserFacingError('ユーザー情報を含むURLは利用できません。', 400);
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new UserFacingError('標準ポート以外の画像URLは安全のため利用できません。', 400);
  }

  const hostname = normalizeHostname(url.hostname);
  if (!hostname || isIpLiteral(hostname)) {
    throw new UserFacingError('IPアドレス直指定の画像URLは安全のため利用できません。', 400);
  }
  if (isBlockedHostname(hostname)) {
    throw new UserFacingError('localhost / private network / internal host の画像URLは利用できません。', 400);
  }
  if (!hostname.includes('.')) {
    throw new UserFacingError('内部ホスト名の可能性があるため、この画像URLは利用できません。', 400);
  }
}

function normalizeImageSourceUrl(value: string): string {
  if (!value) throw new UserFacingError('画像URLが空です。', 400);
  if (/^(data|file|blob|javascript|chrome|chrome-extension):/i.test(value)) {
    throw new UserFacingError('data URL / file URL / blob URL は保存できません。', 400);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UserFacingError('画像URLの形式が正しくありません。', 400);
  }
  validateFetchTarget(url);
  url.hash = '';
  return url.toString();
}

function normalizeOptionalPageUrl(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeLinkUrl(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.startsWith('/') && !normalized.startsWith('//')) return normalized;
  try {
    const url = new URL(normalized);
    if ((url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password) {
      return url.toString();
    }
  } catch {
    // Use the shared message below.
  }
  throw new UserFacingError('リンクURLは / から始まる内部パス、または http/https URLにしてください。', 400);
}

function readSiteAssetType(value: unknown): SiteAssetType {
  const type = readText(value, 40) as SiteAssetType;
  if (!validAssetTypes.includes(type)) throw new UserFacingError('用途が正しくありません。', 400);
  return type;
}

function readDisplayOrder(value: unknown): number {
  const order = typeof value === 'number' ? value : Number(value ?? 1);
  if (!Number.isInteger(order) || order < 1 || order > 9999) {
    throw new UserFacingError('表示順は1以上の整数で入力してください。', 400);
  }
  return order;
}

function readAssetKeyStartIndex(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const index = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(index) || index < 1 || index > 9999) {
    throw new UserFacingError('asset_keyの開始番号が正しくありません。', 400);
  }
  return index;
}

function readOptionalUuid(value: unknown, label: string): string | null {
  const uuid = readText(value, 64);
  if (!uuid) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
    throw new UserFacingError(`${label}が正しくありません。`, 400);
  }
  return uuid.toLowerCase();
}

function readText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeAssetKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function createIndexedAssetKey(base: string, index: number): string {
  const suffix = `_${index}`;
  return base.length + suffix.length <= 80 ? `${base}${suffix}` : `${base.slice(0, 80 - suffix.length)}${suffix}`;
}

function appendIndex(value: string, index: number): string {
  return `${value} ${index}`.trim().slice(0, 160);
}

function sniffImageMime(bytes: Uint8Array, declaredType: string): SiteAssetMimeType | null {
  const declared = declaredType.split(';')[0].trim().toLowerCase();
  if (declared === 'image/svg+xml') return null;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 24 && readAscii(bytes, 0, 8) === '\x89PNG\r\n\x1A\n') return 'image/png';
  if (bytes.length >= 16 && readAscii(bytes, 0, 4) === 'RIFF' && readAscii(bytes, 8, 4) === 'WEBP') return 'image/webp';
  if (bytes.length >= 16 && readAscii(bytes, 4, 4) === 'ftyp') {
    const brands = readAscii(bytes, 8, Math.min(bytes.length - 8, 64));
    if (brands.includes('avif') || brands.includes('avis')) return 'image/avif';
  }
  return null;
}

function readImageDimensions(bytes: Uint8Array, mimeType: SiteAssetMimeType): { width: number; height: number } {
  const dimensions = (() => {
    if (mimeType === 'image/png') return readPngDimensions(bytes);
    if (mimeType === 'image/jpeg') return readJpegDimensions(bytes);
    if (mimeType === 'image/webp') return readWebpDimensions(bytes);
    if (mimeType === 'image/avif') return readAvifDimensions(bytes);
    return null;
  })();
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    throw new UserFacingError('画像の幅と高さを確認できませんでした。', 415);
  }
  return dimensions;
}

function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || readAscii(bytes, 0, 8) !== '\x89PNG\r\n\x1A\n') return null;
  return {
    width: readUint32BE(bytes, 16),
    height: readUint32BE(bytes, 20),
  };
}

function readJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > bytes.length) break;
    const segmentLength = readUint16BE(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    const dataStart = offset + 2;
    if (isJpegStartOfFrame(marker) && dataStart + 5 <= bytes.length) {
      return {
        height: readUint16BE(bytes, dataStart + 1),
        width: readUint16BE(bytes, dataStart + 3),
      };
    }
    offset += segmentLength;
  }
  return null;
}

function isJpegStartOfFrame(marker: number): boolean {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

function readWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 16 || readAscii(bytes, 0, 4) !== 'RIFF' || readAscii(bytes, 8, 4) !== 'WEBP') return null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = readAscii(bytes, offset, 4);
    const chunkSize = readUint32LE(bytes, offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkSize;
    if (dataEnd > bytes.length) break;

    if (chunkType === 'VP8X' && chunkSize >= 10) {
      return {
        width: readUint24LE(bytes, dataStart + 4) + 1,
        height: readUint24LE(bytes, dataStart + 7) + 1,
      };
    }
    if (chunkType === 'VP8 ' && chunkSize >= 10 && readAscii(bytes, dataStart + 3, 3) === '\x9D\x01\x2A') {
      return {
        width: readUint16LE(bytes, dataStart + 6) & 0x3fff,
        height: readUint16LE(bytes, dataStart + 8) & 0x3fff,
      };
    }
    if (chunkType === 'VP8L' && chunkSize >= 5 && bytes[dataStart] === 0x2f) {
      const b1 = bytes[dataStart + 1];
      const b2 = bytes[dataStart + 2];
      const b3 = bytes[dataStart + 3];
      const b4 = bytes[dataStart + 4];
      return {
        width: (((b2 & 0x3f) << 8) | b1) + 1,
        height: (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)) + 1,
      };
    }

    offset = dataEnd + (chunkSize % 2);
  }
  return null;
}

function readAvifDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  return findIspeBox(bytes, 0, bytes.length, 0);
}

function findIspeBox(bytes: Uint8Array, start: number, end: number, depth: number): { width: number; height: number } | null {
  if (depth > 8) return null;
  let offset = start;
  while (offset + 8 <= end) {
    const size32 = readUint32BE(bytes, offset);
    const type = readAscii(bytes, offset + 4, 4);
    let headerSize = 8;
    let boxSize = size32;
    if (size32 === 1 && offset + 16 <= end) {
      const high = readUint32BE(bytes, offset + 8);
      const low = readUint32BE(bytes, offset + 12);
      if (high > 0) return null;
      boxSize = low;
      headerSize = 16;
    } else if (size32 === 0) {
      boxSize = end - offset;
    }
    if (boxSize < headerSize || offset + boxSize > end) break;
    let contentStart = offset + headerSize;
    const boxEnd = offset + boxSize;

    if (type === 'ispe' && contentStart + 12 <= boxEnd) {
      return {
        width: readUint32BE(bytes, contentStart + 4),
        height: readUint32BE(bytes, contentStart + 8),
      };
    }

    if (type === 'meta') contentStart += 4;
    if (isAvifContainerBox(type) && contentStart < boxEnd) {
      const found = findIspeBox(bytes, contentStart, boxEnd, depth + 1);
      if (found) return found;
    }

    offset = boxEnd;
  }
  return null;
}

function isAvifContainerBox(type: string): boolean {
  return type === 'meta' || type === 'iprp' || type === 'ipco' || type === 'trak' || type === 'mdia' || type === 'minf' || type === 'stbl';
}

function readAscii(bytes: Uint8Array, start: number, length: number): string {
  let value = '';
  for (let index = start; index < start + length && index < bytes.length; index += 1) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] * 0x1000000) + ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])) >>> 0;
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] * 0x1000000)) >>> 0;
}

function extensionForMimeType(mimeType: SiteAssetMimeType): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'avif';
}

function shouldUseCloudflareImageResizing(env: AssetImportEnv): boolean {
  return String(env.ASSET_IMPORT_ENABLE_CLOUDFLARE_IMAGE_RESIZING ?? '').toLowerCase() === 'true';
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '').replace(/\.$/, '');
}

function isIpLiteral(hostname: string): boolean {
  return isIpv4Literal(hostname) || hostname.includes(':');
}

function isIpv4Literal(hostname: string): boolean {
  const parts = hostname.split('.');
  return parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function isBlockedHostname(hostname: string): boolean {
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.home') ||
    hostname.endsWith('.corp') ||
    hostname === 'metadata.google.internal'
  ) {
    return true;
  }
  return false;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeSupabaseUrl(value: string | undefined): string {
  try {
    const url = new URL(value?.trim() ?? '');
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function getCorsHeaders(request: Request, env: AssetImportEnv): { allowed: boolean; headers: Headers } {
  const origin = request.headers.get('origin') ?? '';
  const headers = new Headers({
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    vary: 'Origin',
  });

  if (!origin) return { allowed: true, headers };
  if (!isAllowedOrigin(origin, request.url, env)) return { allowed: false, headers };
  headers.set('access-control-allow-origin', origin);
  return { allowed: true, headers };
}

function isAllowedOrigin(origin: string, requestUrl: string, env: AssetImportEnv): boolean {
  const sameOrigin = new URL(requestUrl).origin;
  if (origin === sameOrigin) return true;
  const allowedOrigins = [
    ...defaultAllowedExtensionOrigins,
    ...readOriginList(env.ALLOWED_EXTENSION_ORIGINS),
    ...readOriginList(env.ASSET_IMPORT_ALLOWED_ORIGINS),
  ];
  return allowedOrigins.includes(origin);
}

function readOriginList(value: string | undefined): string[] {
  return String(value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function json(value: unknown, status = 200, headers = new Headers()): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');
  responseHeaders.set('cache-control', 'no-store');
  responseHeaders.set('x-content-type-options', 'nosniff');
  return new Response(JSON.stringify(value), {
    status,
    headers: responseHeaders,
  });
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class UserFacingError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status = 400, details: unknown = undefined) {
    super(message);
    this.name = 'UserFacingError';
    this.status = status;
    this.details = details;
  }
}
