type PublicConfigEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

type PagesContext = {
  env: PublicConfigEnv;
};

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const availableEnvNames = Object.keys(context.env ?? {}).sort();
  const rawSupabaseUrl = context.env?.VITE_SUPABASE_URL;
  const rawSupabaseAnonKey = context.env?.VITE_SUPABASE_ANON_KEY;
  const hasUrl = typeof rawSupabaseUrl === 'string' && rawSupabaseUrl.trim().length > 0;
  const hasAnonKey = typeof rawSupabaseAnonKey === 'string' && rawSupabaseAnonKey.trim().length > 0;
  const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
  const supabaseAnonKey = rawSupabaseAnonKey?.trim() ?? '';

  if (!supabaseUrl || !supabaseAnonKey) {
    // Temporary name-only diagnostics. Remove after the production binding is confirmed.
    console.error('[public-config] Supabase public configuration is incomplete.', {
      hasUrl,
      hasAnonKey,
      hasValidUrl: Boolean(supabaseUrl),
      availableEnvNames,
    });

    return json({
      ok: false,
      error: 'Supabase public configuration is unavailable.',
      debug: {
        hasUrl,
        hasAnonKey,
        hasValidUrl: Boolean(supabaseUrl),
        availableEnvNames,
      },
    }, 503);
  }

  return json({
    ok: true,
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey,
  });
}

function normalizeSupabaseUrl(value: string | undefined): string {
  try {
    const url = new URL(value?.trim() ?? '');
    if (url.protocol !== 'https:' || url.username || url.password) {
      return '';
    }

    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
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
