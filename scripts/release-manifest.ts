/**
 * The updater manifest (`latest.json`) of a release. The release workflow
 * writes it once both platforms are built and their signatures uploaded:
 *
 *     node scripts/release-manifest.ts v0.2.0 <folder with the .sig files> > latest.json
 *
 * The installed app reads it from the latest release (`plugins.updater` in
 * src-tauri/tauri.conf.json), downloads its platform's file from that tag and
 * checks the signature against its public key.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const REPO = 'cbrasser/takt-student';

/** A release's files, named alike in every release so the install page can link to the latest. */
export const ASSETS = {
  dmg: 'Takt-Student-macOS.dmg',
  macUpdate: 'Takt-Student-macOS.app.tar.gz',
  windowsSetup: 'Takt-Student-Windows-Setup.exe',
} as const;

/** What each platform's updater installs: the universal macOS app serves both kinds of Mac. */
const PLATFORMS: Record<string, string> = {
  'darwin-aarch64': ASSETS.macUpdate,
  'darwin-x86_64': ASSETS.macUpdate,
  'windows-x86_64': ASSETS.windowsSetup,
};

/** The files the updater installs, each uploaded with a `.sig` next to it. */
export const SIGNED = [...new Set(Object.values(PLATFORMS))];

export interface Manifest {
  version: string;
  notes: string;
  pub_date: string;
  platforms: Record<string, { signature: string; url: string }>;
}

/** The manifest for `tag` (`v` and a semantic version), given each signed file's signature. */
export function manifest(tag: string, signatures: Record<string, string | undefined>, published: Date): Manifest {
  const version = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(tag)?.[1];
  if (!version) throw new Error(`tag "${tag}" is not v and a semantic version`);
  const platforms: Manifest['platforms'] = {};
  for (const [platform, file] of Object.entries(PLATFORMS)) {
    const signature = signatures[file]?.trim();
    if (!signature) throw new Error(`no signature for ${file}`);
    platforms[platform] = { signature, url: `https://github.com/${REPO}/releases/download/${tag}/${file}` };
  }
  return { version, notes: `Takt Student ${version}`, pub_date: published.toISOString(), platforms };
}

if (import.meta.main) {
  const [tag, dir] = process.argv.slice(2);
  if (!tag || !dir) {
    console.error('usage: node scripts/release-manifest.ts <tag> <folder with the .sig files>');
    process.exit(2);
  }
  const read = (file: string) => {
    try {
      return readFileSync(join(dir, `${file}.sig`), 'utf8');
    } catch {
      return undefined;
    }
  };
  const signatures = Object.fromEntries(SIGNED.map((file) => [file, read(file)]));
  console.log(JSON.stringify(manifest(tag, signatures, new Date()), null, 2));
}
