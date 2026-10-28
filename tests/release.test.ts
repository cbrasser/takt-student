import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASSETS, REPO, SIGNED, manifest } from '../scripts/release-manifest.ts';

const SIGNATURES = Object.fromEntries(SIGNED.map((file) => [file, `sig-of-${file}\n`]));
const PUBLISHED = new Date('2026-11-02T07:30:00Z');

test('the manifest points every platform at its signed file in the tagged release', () => {
  const m = manifest('v0.2.0', SIGNATURES, PUBLISHED);
  assert.equal(m.version, '0.2.0');
  assert.equal(m.pub_date, '2026-11-02T07:30:00.000Z');
  assert.deepEqual(Object.keys(m.platforms).sort(), ['darwin-aarch64', 'darwin-x86_64', 'windows-x86_64']);
  const base = `https://github.com/${REPO}/releases/download/v0.2.0/`;
  // One universal app for both kinds of Mac.
  for (const mac of ['darwin-aarch64', 'darwin-x86_64']) {
    assert.deepEqual(m.platforms[mac], { url: base + ASSETS.macUpdate, signature: `sig-of-${ASSETS.macUpdate}` });
  }
  assert.deepEqual(m.platforms['windows-x86_64'], { url: base + ASSETS.windowsSetup, signature: `sig-of-${ASSETS.windowsSetup}` });
});

test('a test tag keeps its pre-release part, so a later test tag is newer', () => {
  assert.equal(manifest('v0.0.1-test', SIGNATURES, PUBLISHED).version, '0.0.1-test');
});

test('a tag that is not v and a semantic version is refused', () => {
  for (const tag of ['0.2.0', 'v0.2', 'release-1', 'v0.2.0/x']) {
    assert.throws(() => manifest(tag, SIGNATURES, PUBLISHED), /semantic version/, tag);
  }
});

test('a missing or empty signature is refused, so no release ships an update that fails its check', () => {
  for (const file of SIGNED) {
    assert.throws(() => manifest('v0.2.0', { ...SIGNATURES, [file]: undefined }, PUBLISHED), /no signature/);
    assert.throws(() => manifest('v0.2.0', { ...SIGNATURES, [file]: ' \n' }, PUBLISHED), /no signature/);
  }
});

test('the updater reads the manifest of the latest release', () => {
  const conf = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
  assert.deepEqual(conf.plugins.updater.endpoints, [`https://github.com/${REPO}/releases/latest/download/latest.json`]);
});
