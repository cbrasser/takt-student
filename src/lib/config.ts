/**
 * Where the app's data and the account site are.
 *
 * Every build talks to a local stack only: the one cbra-platform's
 * `pnpm db:start` runs, or another local one named at build time
 * (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Anything else is refused,
 * so no dev run or test can reach shared data. The release build, which talks
 * to production, comes with distribution (#31).
 */

/** The local stack's address and its well-known anon key (the same on every machine). */
const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

/** cbra-platform's account site run locally (`pnpm dev` in apps/account). */
const LOCAL_ACCOUNT_URL = 'http://127.0.0.1:3100';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

export interface AppConfig {
  supabaseUrl: string;
  anonKey: string;
  /** Where the session is kept in the app's own storage, one per project. */
  sessionKey: string;
  /** The account site: "Passwort vergessen" and "Konto erstellen". */
  accountUrl: string;
}

export interface AppEnv {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_ACCOUNT_URL?: string;
}

export function appConfig(env: AppEnv): AppConfig {
  const raw = env.VITE_SUPABASE_URL || LOCAL_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Supabase URL "${raw}" is not a local stack`);
  }
  if (url.protocol !== 'http:' || !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`Supabase URL "${raw}" is not a local stack; this build only runs on local Supabase`);
  }
  return {
    supabaseUrl: url.origin,
    anonKey: env.VITE_SUPABASE_ANON_KEY || LOCAL_ANON_KEY,
    sessionKey: 'takt-student-auth-local',
    accountUrl: (env.VITE_ACCOUNT_URL || LOCAL_ACCOUNT_URL).replace(/\/+$/, ''),
  };
}
