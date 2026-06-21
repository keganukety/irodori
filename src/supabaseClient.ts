import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type PublicConfigSource = 'build-time' | 'runtime' | 'unavailable';

type SupabasePublicConfig = {
  url: string;
  anonKey: string;
  source: Exclude<PublicConfigSource, 'unavailable'>;
};

type PublicConfigResponse = {
  ok?: boolean;
  VITE_SUPABASE_URL?: unknown;
  VITE_SUPABASE_ANON_KEY?: unknown;
  error?: unknown;
};

const buildTimeConfig = normalizePublicConfig(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  'build-time',
);

const resolvedConfig = buildTimeConfig ?? await loadRuntimePublicConfig();

export const isSupabaseConfigured = resolvedConfig !== null;
export const supabaseConfigSource: PublicConfigSource = resolvedConfig?.source ?? 'unavailable';

const fallbackSupabaseUrl = 'https://example.supabase.co';
const fallbackSupabaseAnonKey = 'supabase-anon-key-not-configured';

export const supabase: SupabaseClient = createClient(
  resolvedConfig?.url ?? fallbackSupabaseUrl,
  resolvedConfig?.anonKey ?? fallbackSupabaseAnonKey,
);

if (isSupabaseConfigured) {
  console.info(`[Supabase] Public client configured from ${supabaseConfigSource}.`);
} else {
  console.error('[Supabase] Public client configuration is unavailable.', {
    buildTimeUrlPresent: Boolean(import.meta.env.VITE_SUPABASE_URL),
    buildTimeAnonKeyPresent: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
    runtimeEndpoint: '/api/public-config',
  });
}

export default supabase;

async function loadRuntimePublicConfig(): Promise<SupabasePublicConfig | null> {
  try {
    const response = await fetch('/api/public-config', {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    const contentType = response.headers.get('content-type') ?? '';

    if (!contentType.toLowerCase().includes('application/json')) {
      console.error('[Supabase] Runtime configuration returned a non-JSON response.', {
        status: response.status,
        contentType: contentType || 'missing',
      });
      return null;
    }

    const payload = await response.json() as PublicConfigResponse;
    if (!response.ok || payload.ok !== true) {
      console.error('[Supabase] Runtime configuration request failed.', {
        status: response.status,
        message: typeof payload.error === 'string' ? payload.error : 'unknown error',
      });
      return null;
    }

    const config = normalizePublicConfig(
      payload.VITE_SUPABASE_URL,
      payload.VITE_SUPABASE_ANON_KEY,
      'runtime',
    );

    if (!config) {
      console.error('[Supabase] Runtime configuration response is incomplete or invalid.');
    }

    return config;
  } catch (error) {
    console.error('[Supabase] Runtime configuration could not be loaded.', {
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return null;
  }
}

function normalizePublicConfig(
  urlValue: unknown,
  anonKeyValue: unknown,
  source: SupabasePublicConfig['source'],
): SupabasePublicConfig | null {
  if (typeof urlValue !== 'string' || typeof anonKeyValue !== 'string') {
    return null;
  }

  const anonKey = anonKeyValue.trim();
  if (!anonKey) {
    return null;
  }

  try {
    const url = new URL(urlValue.trim());
    const allowsLocalHttp = import.meta.env.DEV && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    if ((url.protocol !== 'https:' && !allowsLocalHttp) || url.username || url.password) {
      return null;
    }

    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';

    return {
      url: url.toString().replace(/\/$/, ''),
      anonKey,
      source,
    };
  } catch {
    return null;
  }
}
