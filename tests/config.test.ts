import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appConfig } from '../src/lib/config.ts';

test('without settings the app talks to the local stack and the local account site', () => {
  const c = appConfig({});
  assert.equal(c.supabaseUrl, 'http://127.0.0.1:54321');
  assert.ok(c.anonKey.length > 0);
  assert.equal(c.accountUrl, 'http://127.0.0.1:3100');
});

test('another local stack can be named', () => {
  assert.equal(appConfig({ VITE_SUPABASE_URL: 'http://localhost:55421/' }).supabaseUrl, 'http://localhost:55421');
});

test('a stack that is not local is refused', () => {
  assert.throws(() => appConfig({ VITE_SUPABASE_URL: 'https://bwemexnjgenocaevsubk.supabase.co' }), /not a local stack/);
  assert.throws(() => appConfig({ VITE_SUPABASE_URL: 'nonsense' }), /not a local stack/);
});
