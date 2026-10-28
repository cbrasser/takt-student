/**
 * Where the app's data and the account site are, decided by the kind of build.
 *
 * A local build talks to a local stack only: the one cbra-platform's
 * `pnpm db:start` runs, or another local one named at build time
 * (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Anything else is refused,
 * so no dev run or test can reach shared data.
 *
 * The release build (`vite build --mode release`, i.e. `npm run build:release`,
 * which the installers and the web deployment use) talks to the production
 * project and nothing else; the build environment can't redirect it.
 */

/** The local stack's address and its well-known anon key (the same on every machine). */
const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

/** cbra-platform's account site run locally (`pnpm dev` in apps/account). */
const LOCAL_ACCOUNT_URL = 'http://127.0.0.1:3100';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * The production project (cbratestdb, Zürich), as in Takt. The anon key is
 * public by design: every build ships it, and row-level security guards the data.
 */
const PRODUCTION_REF = 'bwemexnjgenocaevsubk';
const PRODUCTION_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3ZW1leG5qZ2Vub2NhZXZzdWJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMzMxMzksImV4cCI6MjA4MTgwOTEzOX0.iAWsoW50bwFknqQUpNIGHG3qHv7NNFqX02CqRvFFviA';
const PRODUCTION_ACCOUNT_URL = 'https://accounts.cbratest.ch';

/** Vite's mode for the release build. */
export const RELEASE_MODE = 'release';

export interface AppConfig {
  supabaseUrl: string;
  anonKey: string;
  /** Where the session is kept in the app's own storage, one per project. */
  sessionKey: string;
  /** The account site: "Passwort vergessen" and "Konto erstellen". */
  accountUrl: string;
  /** The release build; only it looks for updates. */
  release: boolean;
}

export interface AppEnv {
  /** Vite's `import.meta.env.MODE`. */
  MODE?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_ACCOUNT_URL?: string;
}

export function appConfig(env: AppEnv): AppConfig {
  if (env.MODE === RELEASE_MODE) {
    return {
      supabaseUrl: `https://${PRODUCTION_REF}.supabase.co`,
      anonKey: PRODUCTION_ANON_KEY,
      sessionKey: `takt-student-auth-${PRODUCTION_REF}`,
      accountUrl: PRODUCTION_ACCOUNT_URL,
      release: true,
    };
  }
  const raw = env.VITE_SUPABASE_URL || LOCAL_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Supabase URL "${raw}" is not a local stack`);
  }
  if (url.protocol !== 'http:' || !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`Supabase URL "${raw}" is not a local stack; only the release build talks to production`);
  }
  return {
    supabaseUrl: url.origin,
    anonKey: env.VITE_SUPABASE_ANON_KEY || LOCAL_ANON_KEY,
    sessionKey: 'takt-student-auth-local',
    accountUrl: (env.VITE_ACCOUNT_URL || LOCAL_ACCOUNT_URL).replace(/\/+$/, ''),
    release: false,
  };
}

/** What a CSP's connect-src must allow for `url`: the API and its websocket. */
export function cspSources(url: string): string[] {
  const { protocol, host } = new URL(url);
  const secure = protocol === 'https:';
  return [`${secure ? 'https' : 'http'}://${host}`, `${secure ? 'wss' : 'ws'}://${host}`];
}
