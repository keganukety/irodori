type PendingImage = {
  url: string;
  sourcePageUrl: string;
  alt: string;
  title: string;
  fromContextMenu: boolean;
};

const contextMenuId = 'save-to-ily-assets';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: contextMenuId,
    title: 'iLy.画像管理に保存',
    contexts: ['image'],
  });
});

chrome.contextMenus.onClicked.addListener((info: any, tab: any) => {
  if (info.menuItemId !== contextMenuId) return;
  const srcUrl = typeof info.srcUrl === 'string' ? info.srcUrl : '';
  if (!isHttpImageUrl(srcUrl)) return;

  const pendingImage: PendingImage = {
    url: srcUrl,
    sourcePageUrl: typeof info.pageUrl === 'string' ? info.pageUrl : tab?.url ?? '',
    alt: '',
    title: tab?.title ?? '',
    fromContextMenu: true,
  };

  chrome.storage.session.set({
    pendingImages: [pendingImage],
    pendingTabId: tab?.id ?? null,
  }, () => {
    if (chrome.action.openPopup) {
      try {
        const result = chrome.action.openPopup();
        if (result && typeof result.catch === 'function') result.catch(() => undefined);
      } catch {
        // The popup can still be opened from the toolbar button.
      }
    }
  });
});

function isHttpImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
