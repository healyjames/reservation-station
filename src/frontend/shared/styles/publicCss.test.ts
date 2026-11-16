import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// public.css only scans the ui/ folders the public pages use, so a ui component that a public page starts using without
// adding its folder there ships with no styles. Nothing else catches that: jsdom tests do not load CSS.

const stylesDir = fileURLToPath(new URL('.', import.meta.url));
const frontend = join(stylesDir, '..', '..');
const uiDir = join(frontend, 'shared', 'components', 'ui');
const publicCss = readFileSync(join(stylesDir, 'public.css'), 'utf8');

const scannedUi = new Set([...publicCss.matchAll(/@source '\.\.\/components\/ui\/([^']+)';/g)].map((m) => m[1]));
const blockedClasses = (publicCss.match(/@source not inline\('([^']+)'\)/)?.[1] ?? '').split(/\s+/).filter(Boolean);

// Folders each name in the ui barrel comes from, e.g. FieldsetMessage -> Fieldset.
const barrelFolder = new Map<string, string>();
for (const m of readFileSync(join(uiDir, 'index.ts'), 'utf8').matchAll(/export (?:type )?\{([^}]+)\} from '\.\/([^']+)'/g)) {
  for (const name of m[1].split(',')) barrelFolder.set(name.trim().replace(/^default as /, ''), m[2]);
}

const PUBLIC_ROOTS = [
  'booking-widget',
  'booking',
  'cancel',
  ...['BookingWidget', 'BookingManage', 'Cancel', 'StandaloneLayout', 'BookingDetailsList', 'SelectedDateInfo'].map((d) =>
    join('shared', 'components', d),
  ),
];

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });

/** The ui folders a file uses: named barrel imports, icons, and (inside ui) sibling folders. */
function uiFoldersUsedBy(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const used: string[] = [];
  for (const m of src.matchAll(/import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*'@shared\/components\/ui'/g)) {
    for (const name of m[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0])) {
      const folder = barrelFolder.get(name);
      if (folder) used.push(folder);
    }
  }
  if (/from\s*'@shared\/components\/ui\/icons'/.test(src)) used.push('icons');
  for (const m of src.matchAll(/from\s*'\.\.\/([A-Za-z]+)(\/[^']+)?'/g)) {
    // A single file deep inside another folder (e.g. Modal/portalTarget) only matters if it carries classes.
    const deepFile = m[2] && [`${m[2]}.ts`, `${m[2]}.tsx`].map((ext) => join(uiDir, m[1], ext)).find(existsSync);
    if (deepFile && !/\bclass(Name)?[=:]/.test(readFileSync(deepFile, 'utf8'))) continue;
    used.push(m[1]);
  }
  return used;
}

function publicUiFolders(): Set<string> {
  const used = new Set<string>();
  const queue = PUBLIC_ROOTS.flatMap((root) => sourceFiles(join(frontend, root)));
  const seenFolders = new Set<string>();
  while (queue.length) {
    for (const folder of uiFoldersUsedBy(queue.pop()!)) {
      used.add(folder);
      if (!seenFolders.has(folder)) {
        seenFolders.add(folder);
        queue.push(...sourceFiles(join(uiDir, folder)));
      }
    }
  }
  return used;
}

describe('public.css sources', () => {
  it('scans every ui folder the public pages use', () => {
    const missing = [...publicUiFolders()].filter((folder) => !scannedUi.has(folder));
    expect(missing).toEqual([]);
  });

  it('does not block the classes of a ui component it scans', () => {
    const blockedButScanned = [...scannedUi].filter((folder) => blockedClasses.includes(folder.toLowerCase()));
    expect(blockedButScanned).toEqual([]);
  });

  it('lists only ui folders that exist', () => {
    expect([...scannedUi].filter((folder) => !existsSync(join(uiDir, folder)))).toEqual([]);
  });
});
