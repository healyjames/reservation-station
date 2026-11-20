import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Each surface's CSS entry (public.css, admin.css) only generates classes found in the paths its `@source` lines list.
// A file a surface renders but its entry does not scan ships with no styles, and jsdom tests never load CSS, so this
// test follows the real imports from each surface's entry files and checks every file that writes classes is scanned.
// Not followed (none exist today): dynamic import()/lazy(), entry files importing the CSS by a relative path, and
// class strings kept in constants without `class`/`cx(` in the same file.

const stylesDir = fileURLToPath(new URL('.', import.meta.url));
const frontend = normalize(join(stylesDir, '..', '..'));
const shared = join(frontend, 'shared');

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });

/** The `@source` paths of a CSS entry, absolute; `@source not` lines are left out. */
const scannedPaths = (css: string) => [...css.matchAll(/^@source '([^']+)';/gm)].map((m) => normalize(join(stylesDir, m[1])));

const isScanned = (file: string, scanned: string[]) => scanned.some((path) => file === path || file.startsWith(path + sep));

/** Resolves an import specifier to a source file, or null for packages, CSS and anything outside src/frontend. */
function resolve(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith('@shared/')) base = join(shared, spec.slice('@shared/'.length));
  else if (spec.startsWith('@frontend/')) base = join(frontend, spec.slice('@frontend/'.length));
  else if (spec.startsWith('.')) base = join(dirname(from), spec);
  else return null;
  if (/\.css$/.test(spec)) return null;
  const candidates = [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  return candidates.find((path) => existsSync(path) && statSync(path).isFile()) ?? null;
}

const isBarrel = (file: string) => /[\\/]index\.tsx?$/.test(file);

/** `export { default as Name } from './X'` and `export { Name } from './X'` lines of a barrel, as name -> specifier. */
function barrelNames(barrel: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const m of readFileSync(barrel, 'utf8').matchAll(/export\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)) {
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()!;
      if (name) names.set(name, m[2]);
    }
  }
  return names;
}

/** The files a file pulls in at runtime. A named import from a barrel only follows the names it uses. */
function runtimeImports(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const found: string[] = [];
  for (const m of src.matchAll(/^\s*(import|export)\s+(type\s+)?([^;]*?)\s*from\s*'([^']+)'/gm)) {
    if (m[2]) continue; // type-only: no runtime code, no classes
    const target = resolve(m[4], file);
    if (!target) continue;
    const named = m[1] === 'import' ? /\{([^}]*)\}/.exec(m[3]) : null;
    if (named && isBarrel(target) && !/^[A-Za-z_$]/.test(m[3])) {
      const names = barrelNames(target);
      for (const part of named[1].split(',')) {
        const raw = part.trim();
        if (!raw || raw.startsWith('type ')) continue;
        const spec = names.get(raw.split(/\s+as\s+/)[0]);
        // A name the barrel does not list by name (`export *`, or declared there): follow the whole barrel.
        const resolved = spec ? resolve(spec, target) : target;
        if (resolved) found.push(resolved);
      }
      continue;
    }
    found.push(target);
  }
  // Side-effect imports such as `import './x'`.
  for (const m of src.matchAll(/^\s*import\s+'([^']+)'/gm)) {
    const target = resolve(m[1], file);
    if (target) found.push(target);
  }
  return found;
}

/** Every file reachable from the entry files that import this CSS entry. */
function reachableFrom(entryCss: string): Set<string> {
  const roots = sourceFiles(frontend).filter((file) => readFileSync(file, 'utf8').includes(`'@shared/styles/${entryCss}'`));
  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...runtimeImports(file));
  }
  return seen;
}

const writesClasses = (file: string) => /\bclass(Name)?\s*[=:]|\bcx\(/.test(readFileSync(file, 'utf8'));

describe.each(['public.css', 'admin.css'])('%s sources', (entryCss) => {
  const css = readFileSync(join(stylesDir, entryCss), 'utf8');
  const scanned = scannedPaths(css);
  const reachable = reachableFrom(entryCss);

  it('is imported by at least one entry file', () => {
    expect(reachable.size).toBeGreaterThan(0);
  });

  it('scans every file its pages render that writes classes', () => {
    const unscanned = [...reachable]
      .filter((file) => writesClasses(file) && !isScanned(file, scanned))
      .map((file) => file.slice(frontend.length + 1));
    expect(unscanned).toEqual([]);
  });

  it('lists only paths that exist', () => {
    expect(scanned.filter((path) => !existsSync(path)).map((path) => path.slice(frontend.length + 1))).toEqual([]);
  });
});

describe('public.css', () => {
  const css = readFileSync(join(stylesDir, 'public.css'), 'utf8');
  const blocked = (css.match(/@source not inline\('([^']+)'\)/)?.[1] ?? '').split(/\s+/).filter(Boolean);
  const reachable = reachableFrom('public.css');

  it('blocks the admin-only daisyUI components', () => {
    expect(blocked).toEqual(expect.arrayContaining(['drawer', 'menu', 'navbar', 'table', 'toggle']));
  });

  // A helper with no classes (e.g. Modal/portalTarget, used by FloatingTooltip) is fine to share.
  it('never renders an admin-only ui component, whose classes it blocks', () => {
    const uiFolders = new Set(
      [...reachable]
        .filter(writesClasses)
        .map((file) => /[\\/]components[\\/]ui[\\/]([^\\/]+)[\\/]/.exec(file)?.[1])
        .filter(Boolean) as string[],
    );
    expect([...uiFolders].filter((folder) => blocked.includes(folder.toLowerCase()))).toEqual([]);
  });
});
