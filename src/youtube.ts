const youtubeVideoIdPattern = /^[A-Za-z0-9_-]{11}$/;

export function isValidYouTubeVideoId(value: unknown): value is string {
  return typeof value === 'string' && youtubeVideoIdPattern.test(value);
}

export function extractYouTubeVideoId(value: string): string {
  const input = value.trim();
  if (!input) return '';

  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase();
    let candidate = '';

    if (host === 'youtu.be') {
      candidate = url.pathname.split('/').filter(Boolean)[0] ?? '';
    } else if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        candidate = url.searchParams.get('v') ?? '';
      } else {
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts[0] === 'shorts' || parts[0] === 'embed') candidate = parts[1] ?? '';
      }
    }

    return isValidYouTubeVideoId(candidate) ? candidate : '';
  } catch {
    return '';
  }
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return isValidYouTubeVideoId(videoId) ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';
}

export function getYouTubeEmbedUrl(videoId: string): string {
  return isValidYouTubeVideoId(videoId) ? `https://www.youtube-nocookie.com/embed/${videoId}` : '';
}
