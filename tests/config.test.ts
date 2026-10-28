import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RELEASE_MODE, appConfig, cspSources } from '../src/lib/config.ts';

const PRODUCTION_URL = 'https://bwemexnjgenocaevsubk.supabase.co';

const json = (path: string) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));

/** The sources a CSP string's connect-src allows. */
function connectSrc(csp: string): string[] {
  return csp
    .split(';')
    .map((d) => d.trim().split(/\s+/))
    .find((d) => d[0] === 'connect-src')
    ?.slice(1) ?? [];
}

/** Whether `sources` allow `source`, by name or by a port wildcard (`http://127.0.0.1:*`). */
function allows(sources: string[], source: string): boolean {
  return sources.includes(source) || sources.includes(source.replace(/:\d+$/, ':*'));
}

test('without settings the app talks to the local stack and the local account site', () => {
  const c = appConfig({});
  assert.equal(c.supabaseUrl, 'http://127.0.0.1:54321');
  assert.ok(c.anonKey.length > 0);
  assert.equal(c.accountUrl, 'http://127.0.0.1:3100');
  assert.equal(c.release, false);
});

test('another local stack can be named', () => {
  assert.equal(appConfig({ VITE_SUPABASE_URL: 'http://localhost:55421/' }).supabaseUrl, 'http://localhost:55421');
});

test('a stack that is not local is refused', () => {
  assert.throws(() => appConfig({ VITE_SUPABASE_URL: PRODUCTION_URL }), /not a local stack/);
  assert.throws(() => appConfig({ MODE: 'production', VITE_SUPABASE_URL: PRODUCTION_URL }), /not a local stack/);
  assert.throws(() => appConfig({ VITE_SUPABASE_URL: 'nonsense' }), /not a local stack/);
});

test('the release build talks to production and the account site, whatever the environment says', () => {
  const env = { VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'other', VITE_ACCOUNT_URL: 'http://127.0.0.1:3100' };
  for (const c of [appConfig({ MODE: RELEASE_MODE }), appConfig({ MODE: RELEASE_MODE, ...env })]) {
    assert.equal(c.supabaseUrl, PRODUCTION_URL);
    assert.match(c.anonKey, /^eyJ/);
    assert.notEqual(c.anonKey, appConfig({}).anonKey);
    assert.equal(c.accountUrl, 'https://accounts.cbratest.ch');
    assert.equal(c.release, true);
  }
});

test('a local and a release build keep their sign-ins apart', () => {
  assert.notEqual(appConfig({}).sessionKey, appConfig({ MODE: RELEASE_MODE }).sessionKey);
});

test('each CSP lets its build reach its project, and the release ones nothing local', () => {
  const local = cspSources(appConfig({}).supabaseUrl);
  const production = cspSources(appConfig({ MODE: RELEASE_MODE }).supabaseUrl);
  assert.deepEqual(production, [PRODUCTION_URL, 'wss://bwemexnjgenocaevsubk.supabase.co']);

  const desktopLocal = connectSrc(json('src-tauri/tauri.conf.json').app.security.csp);
  const desktopRelease = connectSrc(json('src-tauri/tauri.release.conf.json').app.security.csp);
  const web = connectSrc(json('vercel.json').headers[0].headers.find((h: { key: string }) => h.key === 'Content-Security-Policy').value);

  for (const source of local) assert.ok(allows(desktopLocal, source), `tauri.conf.json lacks ${source}`);
  for (const [name, csp] of [['tauri.release.conf.json', desktopRelease], ['vercel.json', web]] as const) {
    for (const source of production) assert.ok(allows(csp, source), `${name} lacks ${source}`);
    assert.ok(!csp.some((s) => /127\.0\.0\.1|\/\/localhost/.test(s)), `${name} allows a local stack`);
  }
});
