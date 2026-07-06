import { ASSETS_ADMIN_PATH, DEFAULT_SITE_ORIGIN, IMPORT_API_PATH } from './config.js';
const imageList = getElement('image-list');
const imageSummary = getElement('image-summary');
const message = getElement('message');
const openAdminLink = getElement('open-admin-link');
const saveForm = getElement('save-form');
const saveButton = getElement('save-button');
const connectButton = getElement('connect-button');
const refreshButton = getElement('refresh-images-button');
const siteOriginInput = getElement('site-origin-input');
const connectionStatus = getElement('connection-status');
const forceDuplicateWrap = getElement('force-duplicate-wrap');
const folderSelect = getElement('folder-select');
const maxImportImages = 100;
const importChunkSize = 30;
let images = [];
let folders = [];
const selectedUrls = new Set();
void init();
async function init() {
    const settings = await storageLocalGet(['siteOrigin', 'assetImporterAuth']);
    siteOriginInput.value = normalizeSiteOrigin(settings.siteOrigin) || DEFAULT_SITE_ORIGIN;
    bindEvents();
    const auth = settings.assetImporterAuth;
    updateConnectionStatus(auth);
    await loadFolders(auth);
    await loadImages();
}
function bindEvents() {
    connectButton.addEventListener('click', () => void connectToSite());
    refreshButton.addEventListener('click', () => void loadImages());
    siteOriginInput.addEventListener('change', () => void saveSiteOrigin());
    imageList.addEventListener('change', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox')
            return;
        if (target.checked)
            selectedUrls.add(target.value);
        else
            selectedUrls.delete(target.value);
        renderImages();
        applySuggestions(false);
    });
    saveForm.addEventListener('submit', (event) => {
        event.preventDefault();
        void saveSelectedImages();
    });
    ['asset_type', 'brand_slug_or_category', 'title'].forEach((name) => {
        const field = saveForm.elements.namedItem(name);
        if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
            field.addEventListener('input', () => applySuggestions(false));
            field.addEventListener('change', () => applySuggestions(false));
        }
    });
    const assetKey = saveForm.elements.namedItem('asset_key');
    if (assetKey instanceof HTMLInputElement) {
        assetKey.addEventListener('input', () => {
            assetKey.dataset.generated = 'false';
        });
    }
    const altText = saveForm.elements.namedItem('alt_text');
    if (altText instanceof HTMLInputElement) {
        altText.addEventListener('input', () => {
            altText.dataset.generated = 'false';
        });
    }
}
async function saveSiteOrigin() {
    const siteOrigin = normalizeSiteOrigin(siteOriginInput.value) || DEFAULT_SITE_ORIGIN;
    siteOriginInput.value = siteOrigin;
    await storageLocalSet({ siteOrigin });
}
async function loadImages() {
    setMessage('画像を探しています...', 'normal');
    selectedUrls.clear();
    const pending = await readPendingImages();
    const collected = await collectImagesFromActiveTab();
    images = mergeImages([...pending, ...collected]);
    pending.forEach((image) => selectedUrls.add(image.url));
    if (pending.length === 0 && images.length === 1)
        selectedUrls.add(images[0].url);
    renderImages();
    applySuggestions(true);
    setMessage(images.length ? '' : 'このページから保存できる画像URLが見つかりませんでした。', images.length ? 'normal' : 'warning');
}
async function readPendingImages() {
    const stored = await storageSessionGet(['pendingImages']);
    await storageSessionRemove(['pendingImages']);
    const pending = Array.isArray(stored.pendingImages) ? stored.pendingImages : [];
    return pending.filter(isImageCandidate);
}
async function collectImagesFromActiveTab() {
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url || isRestrictedTabUrl(tab.url))
        return [];
    try {
        const response = await sendCollectMessage(tab.id);
        return normalizeCollectedImages(response?.images);
    }
    catch {
        try {
            await executeContentScript(tab.id);
            const response = await sendCollectMessage(tab.id);
            return normalizeCollectedImages(response?.images);
        }
        catch (error) {
            setMessage(`ページ内画像を取得できませんでした: ${getErrorMessage(error)}`, 'warning');
            return [];
        }
    }
}
function renderImages() {
    imageSummary.textContent = `${images.length}件 / ${selectedUrls.size}件選択中（最大${maxImportImages}件）`;
    if (images.length === 0) {
        imageList.innerHTML = '';
        return;
    }
    imageList.innerHTML = images.map((image) => {
        const selected = selectedUrls.has(image.url);
        const dimensions = image.width && image.height ? `${image.width}x${image.height}` : image.source || 'image';
        return `
      <label class="image-card ${selected ? 'is-selected' : ''}">
        <input type="checkbox" value="${escapeAttr(image.url)}" ${selected ? 'checked' : ''} />
        <img src="${escapeAttr(image.url)}" alt="" loading="lazy" />
        <span class="image-meta">
          <strong>${escapeText(image.alt || image.title || getUrlFilename(image.url))}</strong>
          <span>${escapeText(dimensions)} / ${escapeText(getUrlHost(image.url))}</span>
        </span>
      </label>
    `;
    }).join('');
}
function applySuggestions(force) {
    const primary = getSelectedImages()[0] ?? images[0];
    if (!primary)
        return;
    const assetType = getFieldValue('asset_type');
    const suggestedTitle = primary.title || primary.alt || getUrlFilename(primary.url);
    const brandSlug = normalizeAssetKeyPart(getFieldValue('brand_slug_or_category'));
    const suggestedKey = suggestAssetKey(assetType, brandSlug, suggestedTitle, primary);
    const suggestedAlt = primary.alt || suggestedTitle;
    setGeneratedInput('asset_key', suggestedKey, force);
    setGeneratedInput('title', suggestedTitle, false);
    setGeneratedInput('alt_text', suggestedAlt, force);
}
async function connectToSite() {
    const siteOrigin = normalizeSiteOrigin(siteOriginInput.value) || DEFAULT_SITE_ORIGIN;
    siteOriginInput.value = siteOrigin;
    await storageLocalSet({ siteOrigin });
    setMessage('サイトのログイン状態を確認しています...', 'normal');
    const tabs = await queryTabs({ url: `${siteOrigin}/*` });
    let tab = tabs.find((item) => item.id && item.url?.startsWith(siteOrigin));
    if (!tab?.id) {
        tab = await createTab(`${siteOrigin}${ASSETS_ADMIN_PATH}`);
        setMessage('開いた画像管理画面でログインしてから、もう一度「接続」を押してください。', 'warning');
        return;
    }
    try {
        const session = await executeSessionExtractor(tab.id);
        if (!session?.accessToken) {
            await updateTab(tab.id, `${siteOrigin}${ASSETS_ADMIN_PATH}`);
            setMessage('画像管理画面でログインしてから、もう一度「接続」を押してください。', 'warning');
            return;
        }
        const authState = {
            siteOrigin,
            accessToken: session.accessToken,
            expiresAt: session.expiresAt || decodeJwtExp(session.accessToken),
            userEmail: session.userEmail || '',
        };
        await storageLocalSet({ assetImporterAuth: authState });
        updateConnectionStatus(authState);
        await loadFolders(authState);
        setMessage('接続しました。', 'success');
    }
    catch (error) {
        setMessage(`接続できませんでした: ${getErrorMessage(error)}`, 'error');
    }
}
async function loadFolders(auth) {
    renderFolderOptions();
    const siteOrigin = normalizeSiteOrigin(siteOriginInput.value) || DEFAULT_SITE_ORIGIN;
    const usableAuth = auth?.accessToken && auth.siteOrigin === siteOrigin
        ? { ...auth, expiresAt: auth.expiresAt || decodeJwtExp(auth.accessToken) }
        : await getUsableAuth(siteOrigin);
    if (!usableAuth || (usableAuth.expiresAt && usableAuth.expiresAt * 1000 < Date.now() + 60000))
        return;
    try {
        const response = await fetch(`${siteOrigin}${IMPORT_API_PATH}`, {
            headers: {
                authorization: `Bearer ${usableAuth.accessToken}`,
            },
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok)
            throw new Error(payload.error || 'フォルダ一覧を取得できませんでした。');
        folders = (payload.folders ?? []).filter(isAssetFolder);
        renderFolderOptions();
    }
    catch (error) {
        folders = [];
        renderFolderOptions();
        console.warn('フォルダ一覧を取得できませんでした。', error);
    }
}
async function saveSelectedImages() {
    const selected = getSelectedImages();
    if (selected.length === 0) {
        setMessage('保存する画像を選択してください。', 'error');
        return;
    }
    if (selected.length > maxImportImages) {
        setMessage(`一度に保存できる画像は最大${maxImportImages}件です。選択数を減らしてください。`, 'error');
        return;
    }
    const siteOrigin = normalizeSiteOrigin(siteOriginInput.value) || DEFAULT_SITE_ORIGIN;
    const auth = await getUsableAuth(siteOrigin);
    if (!auth) {
        setMessage('先にサイトへ接続してください。', 'error');
        return;
    }
    const formData = new FormData(saveForm);
    const createdAssets = [];
    const failures = [];
    const warnings = [];
    let firstAdminUrl = '';
    setBusy(true);
    setMessage(`0/${selected.length}件 保存中...`, 'normal');
    openAdminLink.hidden = true;
    try {
        for (let offset = 0; offset < selected.length; offset += importChunkSize) {
            const chunk = selected.slice(offset, offset + importChunkSize);
            const progress = Math.min(offset + chunk.length, selected.length);
            setMessage(`${progress}/${selected.length}件 保存中...`, 'normal');
            const body = buildImportBody(chunk, formData, offset, selected.length);
            const { response, payload } = await postImportChunk(siteOrigin, auth, body);
            if (response.status === 409 && payload.duplicate) {
                forceDuplicateWrap.hidden = false;
                const existingKey = payload.duplicates?.[0]?.existing_asset?.asset_key;
                if (existingKey)
                    setAdminLink(siteOrigin, `/assets-admin.html?asset_key=${encodeURIComponent(existingKey)}`);
                const savedPrefix = createdAssets.length > 0 ? `${createdAssets.length}件保存済みです。` : '';
                setMessage(`${savedPrefix}${payload.error || '同じ画像URLがすでに登録されています。'}`, 'warning');
                return;
            }
            const payloadFailures = payload.failures ?? payload.details?.failures ?? [];
            if (!response.ok || (!payload.ok && !payload.partial)) {
                if (payloadFailures.length > 0) {
                    failures.push(...payloadFailures);
                    continue;
                }
                throw new Error(formatImportError(payload, response.status));
            }
            createdAssets.push(...(payload.assets ?? []));
            failures.push(...(payload.failures ?? []));
            warnings.push(...(payload.warnings ?? []));
            if (!firstAdminUrl && payload.assets_admin_url)
                firstAdminUrl = payload.assets_admin_url;
        }
        forceDuplicateWrap.hidden = true;
        const adminUrl = firstAdminUrl || `/assets-admin.html?asset_key=${encodeURIComponent(createdAssets[0]?.asset_key ?? '')}`;
        if (createdAssets.length > 0)
            setAdminLink(siteOrigin, adminUrl);
        setImportResultMessage({
            ok: failures.length === 0,
            partial: failures.length > 0,
            assets: createdAssets,
            failures,
            warnings,
            assets_admin_url: firstAdminUrl,
        });
    }
    catch (error) {
        setMessage(getErrorMessage(error), 'error');
    }
    finally {
        setBusy(false);
    }
}
function buildImportBody(imagesToSave, formData, offset, total) {
    const displayOrder = Number(formData.get('display_order') ?? 1);
    const options = {
        optimize: formData.get('optimize') === 'on',
        force_duplicate: formData.get('force_duplicate') === 'on',
    };
    if (total > 1)
        options.asset_key_start_index = offset + 1;
    return {
        images: imagesToSave.map((image) => ({
            url: image.url,
            sourcePageUrl: image.sourcePageUrl,
            alt: image.alt,
            title: image.title,
        })),
        asset: {
            asset_key: String(formData.get('asset_key') ?? ''),
            asset_type: String(formData.get('asset_type') ?? ''),
            folder_id: String(formData.get('folder_id') ?? ''),
            title: String(formData.get('title') ?? ''),
            alt_text: String(formData.get('alt_text') ?? ''),
            brand_slug_or_category: String(formData.get('brand_slug_or_category') ?? ''),
            image_slot: String(formData.get('image_slot') ?? 'desktop'),
            is_published: formData.get('is_published') === 'on',
            display_order: Number.isFinite(displayOrder) ? displayOrder + offset : 1 + offset,
            link_url: String(formData.get('link_url') ?? ''),
            memo: String(formData.get('memo') ?? ''),
        },
        options,
    };
}
async function postImportChunk(siteOrigin, auth, body) {
    const response = await fetch(`${siteOrigin}${IMPORT_API_PATH}`, {
        method: 'POST',
        headers: {
            authorization: `Bearer ${auth.accessToken}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const payload = await response.json();
    return { response, payload };
}
function formatImportError(payload, status) {
    const failures = payload.failures ?? payload.details?.failures ?? [];
    const details = failures.map((failure) => `${getImageLabel(failure.source_url)}: ${failure.error}`).join(' / ');
    const message = payload.error || `保存に失敗しました (${status})`;
    return details ? `${message} ${details}` : message;
}
function setImportResultMessage(payload) {
    const savedCount = payload.assets?.length ?? 0;
    const failures = payload.failures ?? [];
    const warnings = payload.warnings ?? [];
    const failureDetails = failures.map((failure) => `${getImageLabel(failure.source_url)}: ${failure.error}`);
    const details = [...warnings, ...failureDetails].filter(Boolean).join(' / ');
    const summary = failures.length > 0
        ? `${savedCount}件保存しました。${failures.length}件は失敗しました。`
        : `${savedCount}件保存しました。`;
    setMessage(`${summary}${details ? ` ${details}` : ''}`, failures.length > 0 || warnings.length > 0 ? 'warning' : 'success');
}
function renderFolderOptions() {
    const currentValue = folderSelect.value;
    folderSelect.innerHTML = [
        '<option value="">未分類</option>',
        ...folders.map((folder) => `<option value="${escapeAttr(folder.id)}">${escapeText(folder.name)}</option>`),
    ].join('');
    if (folders.some((folder) => folder.id === currentValue))
        folderSelect.value = currentValue;
}
async function getUsableAuth(siteOrigin) {
    const stored = await storageLocalGet(['assetImporterAuth']);
    const auth = stored.assetImporterAuth;
    if (!auth?.accessToken || auth.siteOrigin !== siteOrigin)
        return null;
    const expiresAt = auth.expiresAt || decodeJwtExp(auth.accessToken);
    if (expiresAt && expiresAt * 1000 < Date.now() + 60000)
        return null;
    return { ...auth, expiresAt };
}
function updateConnectionStatus(auth) {
    const usable = auth?.accessToken && (!auth.expiresAt || auth.expiresAt * 1000 > Date.now() + 60000);
    connectionStatus.textContent = usable
        ? `接続中${auth.userEmail ? ` / ${auth.userEmail}` : ''}`
        : '未接続';
}
function getSelectedImages() {
    return images.filter((image) => selectedUrls.has(image.url));
}
function setGeneratedInput(name, value, force) {
    if (!value)
        return;
    const input = saveForm.elements.namedItem(name);
    if (!(input instanceof HTMLInputElement))
        return;
    const generated = input.dataset.generated !== 'false';
    if (!force && input.value.trim() && !generated)
        return;
    if (input.value.trim() && input.value !== input.dataset.generatedValue && !generated)
        return;
    input.value = value;
    input.dataset.generated = 'true';
    input.dataset.generatedValue = value;
}
function suggestAssetKey(assetType, brandSlug, title, image) {
    const usage = normalizeAssetKeyPart(assetType) || 'asset';
    const normalizedTitle = normalizeAssetKeyPart(title || image.alt || image.title || getUrlFilename(image.url)) || 'image';
    const fallbackBrandSlug = brandSlug || '';
    if (usage === 'brand_hero' && fallbackBrandSlug) {
        return composeAssetKey(['brand_hero', fallbackBrandSlug]);
    }
    if (usage === 'brand_logo' && fallbackBrandSlug) {
        return composeAssetKey(['brand_logo', fallbackBrandSlug]);
    }
    if (usage === 'product' || usage === 'product_image') {
        const role = normalizeAssetKeyPart(getFieldValue('image_slot')) || 'image';
        return composeAssetKey(['product', fallbackBrandSlug, normalizedTitle, role]);
    }
    return composeAssetKey([usage, fallbackBrandSlug, normalizedTitle]);
}
function getFieldValue(name) {
    const field = saveForm.elements.namedItem(name);
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
        return field.value.trim();
    }
    return '';
}
function mergeImages(input) {
    const map = new Map();
    input.forEach((image) => {
        if (!isImageCandidate(image) || map.has(image.url))
            return;
        map.set(image.url, image);
    });
    return [...map.values()];
}
function normalizeCollectedImages(value) {
    return Array.isArray(value) ? value.filter(isImageCandidate) : [];
}
function isImageCandidate(value) {
    if (!value || typeof value !== 'object')
        return false;
    const record = value;
    return typeof record.url === 'string' && /^https?:\/\//i.test(record.url);
}
function isAssetFolder(value) {
    if (!value || typeof value !== 'object')
        return false;
    const record = value;
    return typeof record.id === 'string'
        && typeof record.name === 'string'
        && typeof record.slug === 'string';
}
function setAdminLink(siteOrigin, path) {
    openAdminLink.href = `${siteOrigin}${path.startsWith('/') ? path : `/${path}`}`;
    openAdminLink.hidden = false;
}
function setBusy(busy) {
    saveButton.disabled = busy;
    connectButton.disabled = busy;
    refreshButton.disabled = busy;
}
function setMessage(text, tone) {
    message.textContent = text;
    message.dataset.tone = tone;
}
function normalizeSiteOrigin(value) {
    try {
        const url = new URL(String(value ?? '').trim());
        if (url.protocol !== 'https:' && url.origin !== 'http://localhost:8788')
            return '';
        url.pathname = '';
        url.search = '';
        url.hash = '';
        return url.toString().replace(/\/$/, '');
    }
    catch {
        return '';
    }
}
function isRestrictedTabUrl(value) {
    return /^(chrome|chrome-extension|edge|about|devtools):/i.test(value);
}
function getUrlHost(value) {
    try {
        return new URL(value).hostname.replace(/^www\./, '');
    }
    catch {
        return '';
    }
}
function getUrlFilename(value) {
    try {
        const path = new URL(value).pathname.split('/').filter(Boolean).pop() || 'image';
        return decodeURIComponent(path).replace(/\.[a-z0-9]+$/i, '');
    }
    catch {
        return 'image';
    }
}
function getImageLabel(value) {
    const filename = getUrlFilename(value);
    const host = getUrlHost(value);
    return host ? `${filename} (${host})` : filename;
}
function normalizeAssetKeyPart(value) {
    return value
        .normalize('NFKC')
        .normalize('NFKD')
        .replace(/&/g, ' and ')
        .replace(/\+/g, ' plus ')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_')
        .slice(0, 48);
}
function composeAssetKey(parts) {
    const key = parts
        .map((part) => normalizeAssetKeyPart(part))
        .filter(Boolean)
        .join('_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
    return trimAssetKey(key || 'asset');
}
function trimAssetKey(value) {
    if (value.length <= 80)
        return value;
    return value.slice(0, 80).replace(/_+$/g, '') || 'asset';
}
function decodeJwtExp(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return typeof payload.exp === 'number' ? payload.exp : 0;
    }
    catch {
        return 0;
    }
}
function extractSupabaseSessionFromPage() {
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index) || '';
        if (!/^sb-.+-auth-token$/.test(key))
            continue;
        try {
            const raw = localStorage.getItem(key);
            if (!raw)
                continue;
            const parsed = JSON.parse(raw);
            const session = parsed.currentSession || parsed.session || parsed;
            const accessToken = String(session.access_token || parsed.access_token || '');
            if (!accessToken)
                continue;
            return {
                accessToken,
                expiresAt: Number(session.expires_at || parsed.expires_at || 0),
                userEmail: String(session.user?.email || parsed.user?.email || ''),
            };
        }
        catch {
            // Try the next localStorage entry.
        }
    }
    return null;
}
async function executeSessionExtractor(tabId) {
    const results = await executeScript(tabId, { func: extractSupabaseSessionFromPage });
    return results?.[0]?.result ?? null;
}
function getActiveTab() {
    return queryTabs({ active: true, currentWindow: true }).then((tabs) => tabs[0] ?? null);
}
function queryTabs(queryInfo) {
    return new Promise((resolve) => chrome.tabs.query(queryInfo, resolve));
}
function createTab(url) {
    return new Promise((resolve) => chrome.tabs.create({ url, active: true }, resolve));
}
function updateTab(tabId, url) {
    return new Promise((resolve) => chrome.tabs.update(tabId, { url, active: true }, resolve));
}
function sendCollectMessage(tabId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { type: 'COLLECT_IRODORI_IMAGES' }, (response) => {
            const error = chrome.runtime.lastError;
            if (error)
                reject(new Error(error.message));
            else
                resolve(response);
        });
    });
}
function executeContentScript(tabId) {
    return executeScript(tabId, { files: ['dist/content-script.js'] });
}
function executeScript(tabId, details) {
    return new Promise((resolve, reject) => {
        chrome.scripting.executeScript({ target: { tabId }, ...details }, (results) => {
            const error = chrome.runtime.lastError;
            if (error)
                reject(new Error(error.message));
            else
                resolve(results);
        });
    });
}
function storageLocalGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function storageLocalSet(value) {
    return new Promise((resolve) => chrome.storage.local.set(value, resolve));
}
function storageSessionGet(keys) {
    return new Promise((resolve) => chrome.storage.session.get(keys, resolve));
}
function storageSessionRemove(keys) {
    return new Promise((resolve) => chrome.storage.session.remove(keys, resolve));
}
function getElement(id) {
    const element = document.getElementById(id);
    if (!element)
        throw new Error(`#${id} was not found.`);
    return element;
}
function escapeText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
function escapeAttr(value) {
    return escapeText(value).replace(/`/g, '&#096;');
}
function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
