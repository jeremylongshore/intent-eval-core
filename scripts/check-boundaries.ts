#!/usr/bin/env -S node --experimental-strip-types
/**
 * check-boundaries.ts — unified boundary enforcement checker for @intentsolutions/core.
 *
 * Reads FORBIDDEN.md + ALLOWLIST.md, scans the repo state across 4 axes,
 * emits violations. Exit codes:
 *   0 — clean (no violations)
 *   1 — CHALLENGE: at least one violation (engineer-approved override may apply in CI)
 *   2 — REFUSE: hard prohibition triggered (override path does not exist; e.g., labs.intentsolutions.io URL)
 *
 * Authority: 000-docs/003-AT-STND-core-repo-boundaries-2026-05-18.md
 * Invocations:
 *   - Pre-commit: .husky/pre-commit runs `node --experimental-strip-types scripts/check-boundaries.ts`
 *   - CI: .github/workflows/boundary-check.yml
 *   - Manual: `pnpm run boundaries`
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();

interface Violation {
  axis: string;
  rule: string;
  detail: string;
  severity: 'CHALLENGE' | 'REFUSE';
}

// ─── FORBIDDEN.md parser ──────────────────────────────────────────────────

interface Forbidden {
  packagePatterns: string[];
  importPaths: string[];
  allowedSrcPaths: string[];
  directoryNames: string[];
  allowedTopDirs: string[];
  packageCategories: string[];
  urlPatterns: string[];
}

function parseForbidden(): Forbidden {
  const md = readFileSync(join(REPO_ROOT, 'FORBIDDEN.md'), 'utf-8');

  // The blocks appear in document order. The structure is:
  //   Block 0..N        — Axis 1 package patterns (web frameworks, HTTP, DB, queues, LLM,
  //                       optimization, real-time, observability, storage, auth, process)
  //   After "Forbidden import paths" heading — Axis 2 forbidden paths (1 block)
  //   After "Allowed `src/`" heading — Axis 2 allowed paths (1 block)
  //   After "Forbidden top-level directory names" heading — Axis 3 forbidden dirs (1 block)
  //   After "Allowed top-level directories" heading — Axis 3 allowed dirs (1 block)
  //   After "Forbidden package categories" heading — Axis 4 keywords (1 block)
  //   After "Forbidden URL patterns" heading — URL patterns (1 block)
  //
  // Parse by walking section headings + the block immediately after.

  const lines = md.split('\n');
  const sectionStart: Record<string, number> = {};
  lines.forEach((line, i) => {
    if (line.startsWith('## Axis 1')) sectionStart['axis1'] = i;
    if (line.startsWith('## Axis 2')) sectionStart['axis2_forbidden'] = i;
    if (line.startsWith('**Allowed `src/`')) sectionStart['axis2_allowed'] = i;
    if (line.startsWith('## Axis 3')) sectionStart['axis3_forbidden'] = i;
    if (line.startsWith('**Allowed top-level directories**')) sectionStart['axis3_allowed'] = i;
    if (line.startsWith('## Axis 4')) sectionStart['axis4'] = i;
    if (line.startsWith('## Forbidden URL patterns')) sectionStart['urls'] = i;
  });

  function extractBlocksBetween(start: number, end: number): string[] {
    const slice = lines.slice(start, end).join('\n');
    return [...slice.matchAll(/```\n([\s\S]*?)\n```/g)].map((m) => m[1] ?? '');
  }

  const axis1Blocks = extractBlocksBetween(
    sectionStart['axis1'] ?? 0,
    sectionStart['axis2_forbidden'] ?? lines.length,
  );
  const axis2ForbiddenBlocks = extractBlocksBetween(
    sectionStart['axis2_forbidden'] ?? 0,
    sectionStart['axis2_allowed'] ?? lines.length,
  );
  const axis2AllowedBlocks = extractBlocksBetween(
    sectionStart['axis2_allowed'] ?? 0,
    sectionStart['axis3_forbidden'] ?? lines.length,
  );
  const axis3ForbiddenBlocks = extractBlocksBetween(
    sectionStart['axis3_forbidden'] ?? 0,
    sectionStart['axis3_allowed'] ?? lines.length,
  );
  const axis3AllowedBlocks = extractBlocksBetween(
    sectionStart['axis3_allowed'] ?? 0,
    sectionStart['axis4'] ?? lines.length,
  );
  const axis4Blocks = extractBlocksBetween(
    sectionStart['axis4'] ?? 0,
    sectionStart['urls'] ?? lines.length,
  );
  const urlBlocks = extractBlocksBetween(sectionStart['urls'] ?? 0, lines.length);

  const flatten = (bs: string[]): string[] =>
    bs.flatMap((b) =>
      b
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#'))
        // Strip inline comments + section dividers
        .map((l) => l.split(/\s+—\s+/)[0] ?? l)
        .map((l) => l.trim())
        .filter((l) => l.length > 0),
    );

  return {
    packagePatterns: flatten(axis1Blocks),
    importPaths: flatten(axis2ForbiddenBlocks),
    allowedSrcPaths: flatten(axis2AllowedBlocks),
    directoryNames: flatten(axis3ForbiddenBlocks),
    allowedTopDirs: flatten(axis3AllowedBlocks),
    packageCategories: flatten(axis4Blocks),
    urlPatterns: flatten(urlBlocks).filter((u) => u.includes('intentsolutions.io')),
  };
}

// ─── ALLOWLIST.md parser ──────────────────────────────────────────────────

interface Allowlist {
  runtimeDeps: Set<string>;
  devDeps: Set<string>;
  topLevelFiles: Set<string>;
  runtimeCap: number;
}

function parseAllowlist(): Allowlist {
  const md = readFileSync(join(REPO_ROOT, 'ALLOWLIST.md'), 'utf-8');

  const runtimeDeps = new Set<string>();
  const devDeps = new Set<string>();
  const topLevelFiles = new Set<string>();

  // Parse markdown tables — find rows matching `| \`<name>\` | ... |`
  const tablePattern = /^\|\s*`([^`]+)`\s*\|/gm;
  const sections = md.split(/^## /m);

  for (const section of sections) {
    if (section.startsWith('Runtime dep allowlist')) {
      for (const match of section.matchAll(tablePattern)) {
        const name = match[1];
        if (name) runtimeDeps.add(name);
      }
    } else if (section.startsWith('DevDep allowlist')) {
      for (const match of section.matchAll(tablePattern)) {
        const name = match[1];
        if (name) devDeps.add(name);
      }
    } else if (section.startsWith('Top-level files allowlist')) {
      // The files section uses a fenced block
      const blockMatch = /```\n([\s\S]*?)\n```/.exec(section);
      if (blockMatch?.[1]) {
        for (const line of blockMatch[1].split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          // Each line: "filename   — rationale"
          const name = trimmed.split(/\s+—\s+/)[0]?.trim();
          if (name) topLevelFiles.add(name);
        }
      }
    }
  }

  // Hard cap
  const capMatch = /Hard cap:\s*≤\s*\*\*(\d+)\*\*/.exec(md);
  const runtimeCap = capMatch?.[1] ? parseInt(capMatch[1], 10) : 8;

  return { runtimeDeps, devDeps, topLevelFiles, runtimeCap };
}

// ─── Axis 1 check: forbidden package patterns ─────────────────────────────

function checkAxis1(forbidden: Forbidden, allowlist: Allowlist, violations: Violation[]): void {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const runtimeDeps = Object.keys(pkg.dependencies ?? {});

  // Runtime cap
  if (runtimeDeps.length > allowlist.runtimeCap) {
    violations.push({
      axis: 'A1',
      rule: 'runtime-cap',
      detail: `${runtimeDeps.length} runtime deps exceeds cap of ${allowlist.runtimeCap}: ${runtimeDeps.join(', ')}`,
      severity: 'CHALLENGE',
    });
  }

  // Runtime deps must all be on the runtime allowlist
  for (const dep of runtimeDeps) {
    if (!allowlist.runtimeDeps.has(dep)) {
      violations.push({
        axis: 'A1',
        rule: 'runtime-not-in-allowlist',
        detail: `Runtime dep "${dep}" not in ALLOWLIST.md § Runtime dep allowlist`,
        severity: 'CHALLENGE',
      });
    }
  }

  // Runtime deps must not match any forbidden package pattern
  const matchPattern = (name: string, pattern: string): boolean => {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -1); // drop the `*`
      return name.startsWith(prefix);
    }
    return name === pattern;
  };

  for (const dep of runtimeDeps) {
    for (const pat of forbidden.packagePatterns) {
      if (matchPattern(dep, pat)) {
        violations.push({
          axis: 'A1',
          rule: 'runtime-forbidden-pattern',
          detail: `Runtime dep "${dep}" matches forbidden pattern "${pat}"`,
          severity: 'CHALLENGE',
        });
      }
    }
  }

  // DevDeps that match forbidden patterns require explicit allowlist entry
  const devDeps = Object.keys(pkg.devDependencies ?? {});
  for (const dep of devDeps) {
    for (const pat of forbidden.packagePatterns) {
      if (matchPattern(dep, pat)) {
        if (!allowlist.devDeps.has(dep)) {
          violations.push({
            axis: 'A1',
            rule: 'devdep-forbidden-without-waiver',
            detail: `DevDep "${dep}" matches forbidden pattern "${pat}" but is not waived in ALLOWLIST.md`,
            severity: 'CHALLENGE',
          });
        }
      }
    }
  }
}

// ─── Axis 2 check: forbidden import paths ─────────────────────────────────

function walkDir(root: string, prefix = ''): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  for (const entry of readdirSync(root)) {
    if (
      entry.startsWith('.') ||
      entry === 'node_modules' ||
      entry === 'dist' ||
      entry === 'coverage'
    )
      continue;
    const full = join(root, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(rel + '/');
      out.push(...walkDir(full, rel));
    } else {
      out.push(rel);
    }
  }
  return out;
}

function checkAxis2(forbidden: Forbidden, violations: Violation[]): void {
  // Check that no forbidden src path exists
  const srcEntries = walkDir(join(REPO_ROOT, 'src'), 'src');

  for (const entry of srcEntries) {
    if (!entry.endsWith('/')) continue; // only check directory entries
    for (const forbiddenPath of forbidden.importPaths) {
      const target = forbiddenPath.endsWith('/') ? forbiddenPath : `${forbiddenPath}/`;
      if (entry === target || entry.startsWith(target)) {
        violations.push({
          axis: 'A2',
          rule: 'forbidden-import-path',
          detail: `Directory "${entry}" matches forbidden path "${forbiddenPath}"`,
          severity: 'CHALLENGE',
        });
      }
    }
  }

  // Check that every src/* dir IS in the allowed list
  // We're permissive about leaf files (not enforced via paths) — only directories matter for layering.
  const allowedSet = new Set(forbidden.allowedSrcPaths.map((p) => (p.endsWith('/') ? p : `${p}/`)));
  // Always allow these well-known patterns even if absent from the allowed list
  allowedSet.add('src/');
  for (const entry of srcEntries) {
    if (!entry.endsWith('/')) continue;
    if (!allowedSet.has(entry)) {
      // Check if it's a sub-path of an allowed path
      let allowedAsSubpath = false;
      for (const allowed of allowedSet) {
        if (entry.startsWith(allowed) && allowed !== 'src/') {
          allowedAsSubpath = true;
          break;
        }
      }
      if (!allowedAsSubpath) {
        violations.push({
          axis: 'A2',
          rule: 'src-path-not-in-allowed-list',
          detail: `Directory "${entry}" is not in FORBIDDEN.md § Allowed src/ subpaths`,
          severity: 'CHALLENGE',
        });
      }
    }
  }
}

// ─── Axis 3 check: forbidden top-level dirs + files ──────────────────────

function checkAxis3(forbidden: Forbidden, allowlist: Allowlist, violations: Violation[]): void {
  const entries = readdirSync(REPO_ROOT);

  for (const entry of entries) {
    if (entry.startsWith('.')) {
      // Dotfiles checked against allowlist if not a well-known git/CI artifact
      if (
        !allowlist.topLevelFiles.has(entry) &&
        ![
          '.git',
          '.gitignore',
          '.beads',
          '.harness-hash',
          '.husky',
          '.github',
          '.vscode',
          '.dependency-cruiser.cjs',
          '.npmrc',
          '.nvmrc',
          '.prettierignore',
          '.prettierrc.json',
        ].includes(entry)
      ) {
        violations.push({
          axis: 'A3',
          rule: 'dotfile-not-allowed',
          detail: `Top-level dotfile "${entry}" not in ALLOWLIST.md`,
          severity: 'CHALLENGE',
        });
      }
      continue;
    }

    const full = join(REPO_ROOT, entry);
    const st = statSync(full);

    if (st.isDirectory()) {
      // Check against forbidden dir names
      const dirName = entry + '/';
      for (const forbiddenDir of forbidden.directoryNames) {
        const target = forbiddenDir.endsWith('/') ? forbiddenDir : `${forbiddenDir}/`;
        if (dirName === target) {
          violations.push({
            axis: 'A3',
            rule: 'forbidden-top-level-dir',
            detail: `Top-level directory "${entry}/" is in FORBIDDEN.md § Directory names`,
            severity: 'CHALLENGE',
          });
        }
      }
      // Common-but-undesired patterns
      if (entry === 'sandbox' || entry === 'sandboxes' || entry === 'playground') {
        violations.push({
          axis: 'A3',
          rule: 'common-undesired-dir',
          detail: `Top-level directory "${entry}/" is a common-but-undesired pattern for kernel repos`,
          severity: 'CHALLENGE',
        });
      }
    } else if (st.isFile()) {
      // Check against allowed top-level files
      if (!allowlist.topLevelFiles.has(entry)) {
        // Refuse common-secret patterns regardless of allowlist
        if (
          /^\.env(\..*)?$/.test(entry) ||
          /credentials/i.test(entry) ||
          entry.endsWith('.pem') ||
          entry.endsWith('.key')
        ) {
          violations.push({
            axis: 'A3',
            rule: 'secret-shaped-file',
            detail: `Top-level file "${entry}" matches secret-shape pattern (e.g., .env / credentials / .pem / .key)`,
            severity: 'REFUSE',
          });
        } else {
          violations.push({
            axis: 'A3',
            rule: 'top-level-file-not-in-allowlist',
            detail: `Top-level file "${entry}" not in ALLOWLIST.md § Top-level files allowlist`,
            severity: 'CHALLENGE',
          });
        }
      }
    }
  }
}

// ─── Axis 4 check: package categories (best-effort heuristic) ────────────

function checkAxis4(_forbidden: Forbidden, _allowlist: Allowlist, _violations: Violation[]): void {
  // Best-effort heuristic against npm `keywords`. We do NOT actually call
  // `npm view` from the checker — that adds a network dependency to a
  // boundary check that must work offline at pre-commit.
  //
  // The category check is INFORMATIVE in this v0.1 implementation; the
  // explicit Axis 1 package-pattern list is the operative gate. If a
  // contributor wants to add a package whose name doesn't match any Axis 1
  // pattern but whose keywords scream "database / runtime / agent," the
  // PR review catches it (the CODEOWNERS narrowing routes the PR to the
  // maintainer). A future iteration can wire `npm view <pkg> keywords` if
  // the heuristic becomes worth the network cost.
}

// ─── URL pattern check ───────────────────────────────────────────────────

function checkUrls(forbidden: Forbidden, violations: Violation[]): void {
  if (forbidden.urlPatterns.length === 0) return;

  const scanDirs = ['src', 'schemas', '000-docs', 'tests'];
  const scanFiles = [
    'README.md',
    'CLAUDE.md',
    'AGENTS.md',
    'CHANGELOG.md',
    'FORBIDDEN.md',
    'ALLOWLIST.md',
    'CODEOWNERS',
  ];

  const allFiles: string[] = [];
  for (const d of scanDirs) {
    const fullDir = join(REPO_ROOT, d);
    if (!existsSync(fullDir)) continue;
    allFiles.push(
      ...walkDir(fullDir, d).filter((p) => !p.endsWith('/') && /\.(ts|md|json)$/.test(p)),
    );
  }
  for (const f of scanFiles) {
    if (existsSync(join(REPO_ROOT, f))) allFiles.push(f);
  }

  for (const file of allFiles) {
    // Skip the boundary docs themselves — they enumerate the rule
    if (file === 'FORBIDDEN.md' || file === 'ALLOWLIST.md' || file.startsWith('000-docs/')) {
      continue;
    }

    const content = readFileSync(join(REPO_ROOT, file), 'utf-8');
    for (const pattern of forbidden.urlPatterns) {
      const cleanPattern = pattern
        .replace('<predicate>', '')
        .replace(/[—\s].*$/, '')
        .trim();
      if (!cleanPattern) continue;

      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (!line.includes(cleanPattern)) return;

        // Skip protective test assertions — `.not.toContain` / `.not.toMatch`
        // are EXACTLY the safety net we want consumers to keep
        if (/\.not\.(toContain|toMatch|toInclude|to[A-Z])/.test(line)) return;

        // Skip lines that explicitly document the prohibition
        const lower = line.toLowerCase();
        if (
          lower.includes('must not') ||
          lower.includes('reserved-don') ||
          lower.includes('reserved-dont') ||
          lower.includes('forbidden') ||
          lower.includes('refuse') ||
          lower.includes('never host') ||
          lower.includes('but never') ||
          lower.includes('ciso binding') ||
          lower.includes('dr-004') ||
          lower.includes('dr-010') ||
          lower.includes('only at `evals') ||
          lower.includes('only at evals') ||
          lower.includes('not labs') ||
          line.trim().startsWith('|')
        ) {
          return; // documenting the rule
        }

        // Only flag lines that look like ACTUAL URL USAGE
        const looksLikeRealUrl =
          line.includes(`https://${cleanPattern}`) ||
          line.includes(`"${cleanPattern}/`) ||
          line.includes(`'${cleanPattern}/`);

        if (!looksLikeRealUrl) return;

        violations.push({
          axis: 'URL',
          rule: 'forbidden-url-pattern',
          detail: `${file}:${idx + 1} contains forbidden URL pattern "${cleanPattern}"`,
          severity: 'REFUSE',
        });
      });
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────

function main(): void {
  const forbidden = parseForbidden();
  const allowlist = parseAllowlist();
  const violations: Violation[] = [];

  checkAxis1(forbidden, allowlist, violations);
  checkAxis2(forbidden, violations);
  checkAxis3(forbidden, allowlist, violations);
  checkAxis4(forbidden, allowlist, violations);
  checkUrls(forbidden, violations);

  if (violations.length === 0) {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as {
      dependencies?: Record<string, string>;
    };
    const runtimeDepCount = Object.keys(pkg.dependencies ?? {}).length;
    console.log('boundaries: PASS — 0 violations.');
    console.log(`  Axis 1 (package patterns):  scanned ${runtimeDepCount} runtime deps`);
    console.log(`  Axis 2 (import paths):      scanned src/ subtree`);
    console.log(`  Axis 3 (directory names):   scanned repo root`);
    console.log(`  Axis 4 (pkg categories):    informative-only at v0.1`);
    console.log(
      `  URL patterns:               scanned src/ schemas/ 000-docs/ tests/ + root MD files`,
    );
    process.exit(0);
  }

  const refuse = violations.filter((v) => v.severity === 'REFUSE');
  const challenge = violations.filter((v) => v.severity === 'CHALLENGE');

  console.error(`boundaries: FAIL — ${violations.length} violation(s).`);
  if (refuse.length > 0) {
    console.error('');
    console.error(`  REFUSE (no override path):  ${refuse.length}`);
    for (const v of refuse) {
      console.error(`    [${v.axis} / ${v.rule}] ${v.detail}`);
    }
  }
  if (challenge.length > 0) {
    console.error('');
    console.error(
      `  CHALLENGE (override possible per 000-docs/003-AT-STND-..§3): ${challenge.length}`,
    );
    for (const v of challenge) {
      console.error(`    [${v.axis} / ${v.rule}] ${v.detail}`);
    }
  }

  process.exit(refuse.length > 0 ? 2 : 1);
}

main();
