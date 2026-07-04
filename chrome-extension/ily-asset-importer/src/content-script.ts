type CollectedImage = {
  url: string;
  sourcePageUrl: string;
  alt: string;
  title: string;
  width: number | null;
  height: number | null;
  source: string;
};

chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
  if (!message || message.type !== 'COLLECT_IRODORI_IMAGES') return false;
  sendResponse({
    images: collectPageImages(),
    pageTitle: document.title,
    pageUrl: location.href,
  });
  return true;
});

function collectPageImages(): CollectedImage[] {
  const found = new Map<string, CollectedImage>();

  document.querySelectorAll<HTMLMetaElement>('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]').forEach((meta) => {
    addImage(found, meta.content, {
      alt: document.title,
      title: document.title,
      width: null,
      height: null,
      source: 'og',
    });
  });

  document.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    const width = image.naturalWidth || image.width || null;
    const height = image.naturalHeight || image.height || null;
    const alt = image.alt || image.getAttribute('aria-label') || '';
    const title = image.title || image.closest('[aria-label]')?.getAttribute('aria-label') || document.title;

    [
      image.currentSrc,
      image.src,
      image.getAttribute('data-src'),
      image.getAttribute('data-original'),
      image.getAttribute('data-lazy-src'),
    ].forEach((url) => addImage(found, url, { alt, title, width, height, source: 'img' }));

    parseSrcset(image.srcset || image.getAttribute('data-srcset') || '').forEach((url) => {
      addImage(found, url, { alt, title, width, height, source: 'srcset' });
    });
  });

  document.querySelectorAll<HTMLSourceElement>('picture source, source[srcset]').forEach((source) => {
    parseSrcset(source.srcset || source.getAttribute('data-srcset') || '').forEach((url) => {
      addImage(found, url, {
        alt: document.title,
        title: document.title,
        width: null,
        height: null,
        source: 'picture',
      });
    });
  });

  Array.from(document.querySelectorAll<HTMLElement>('body *')).slice(0, 1500).forEach((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width < 24 || rect.height < 24) return;
    const style = getComputedStyle(element);
    extractCssUrls(`${style.backgroundImage},${style.listStyleImage},${style.borderImageSource}`).forEach((url) => {
      addImage(found, url, {
        alt: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 80) || document.title,
        title: document.title,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        source: 'background',
      });
    });
  });

  return [...found.values()].slice(0, 250);
}

function addImage(
  found: Map<string, CollectedImage>,
  rawUrl: string | null | undefined,
  metadata: Omit<CollectedImage, 'url' | 'sourcePageUrl'>,
) {
  const url = normalizeImageUrl(rawUrl);
  if (!url || found.has(url)) return;
  found.set(url, {
    url,
    sourcePageUrl: location.href,
    ...metadata,
  });
}

function normalizeImageUrl(rawUrl: string | null | undefined): string {
  const value = String(rawUrl ?? '').trim();
  if (!value || /^(data|file|blob|javascript|chrome|chrome-extension):/i.test(value)) return '';
  try {
    const url = new URL(value.replace(/^\/\//, `${location.protocol}//`), document.baseURI);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function parseSrcset(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function extractCssUrls(value: string): string[] {
  const urls: string[] = [];
  const pattern = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^'")]+))\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    urls.push(match[1] || match[2] || match[3] || '');
  }
  return urls;
}
