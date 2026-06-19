#!/usr/bin/env -S node --experimental-strip-types
/**
 * check-coverage-map-prose-anchors.ts — § 14.2.3 gate #2 (prose-anchor-validity,
 * EXTENDED to the coverage map).
 *
 * PR #37 shipped scripts/check-prose-anchors.ts + the prose-anchor-validity
 * workflow: it validates every 6767-h section CITED IN A SCHEMA `$comment`. The
 * coverage map (§ 14.2.2) cites 6767-h sections in a STRUCTURED field
 * (`6767h_section`) on each `trace_kind: "anthropic-spec-derived"` entry, NOT in
 * a `$comment` — so the #37 gate does not reach them. This gate EXTENDS #37
 * (rather than rebuilding it) by REUSING #37's resolution machinery
 * (`loadInventory` + `resolves`, imported from check-prose-anchors.ts) against the
 * coverage map's structured citations. The two together cover both citation
 * surfaces against the same vendored heading inventory.
 *
 * For each anthropic-spec-derived entry, the `6767h_section` MUST be non-null and
 * MUST resolve to a real section heading in
 * schemas/prose-anchors/6767-h.headings.json. (is-only-extension entries carry a
 * null `6767h_section` by design and are not checked here.)
 *
 * Deterministic, offline, no LLM (mirrors #37's § 14.16.1 stability discipline).
 *
 * Exit codes:
 *   0 — every anthropic-spec-derived 6767h_section resolves
 *   1 — at least one dangling/absent section citation (neutral copy names each)
 *
 * Usage:
 *   node --experimental-strip-types scripts/check-coverage-map-prose-anchors.ts [--root <dir>]
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// REUSE PR #37's resolution machinery — do not reimplement section resolution.
import { loadInventory, resolves, INVENTORY_PATH } from './check-prose-anchors.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');

export const COVERAGE_MAP_PATH = 'schemas/authoring/v1/6767h-coverage-map.json';

interface CoverageMapEntry {
  readonly trace_kind: string;
  readonly '6767h_section'?: string | null;
}
interface CoverageMap {
  readonly fields: Record<string, CoverageMapEntry>;
}

export interface SectionCitation {
  readonly field: string;
  /** null/absent section on an anthropic-spec-derived entry, or a non-resolving section. */
  readonly section: string | null;
  readonly reason: 'absent-section' | 'dangling-section';
}

/**
 * Every anthropic-spec-derived coverage-map row whose `6767h_section` is absent
 * or does not resolve against the vendored inventory.
 */
export function findBadSectionCitations(root: string = REPO_ROOT): {
  checked: number;
  bad: SectionCitation[];
} {
  const inventory = loadInventory(root);
  const map = JSON.parse(readFileSync(join(root, COVERAGE_MAP_PATH), 'utf-8')) as CoverageMap;

  const bad: SectionCitation[] = [];
  let checked = 0;
  for (const [field, entry] of Object.entries(map.fields)) {
    if (entry.trace_kind !== 'anthropic-spec-derived') continue;
    checked += 1;
    const section = entry['6767h_section'] ?? null;
    if (section === null || section === '') {
      bad.push({ field, section, reason: 'absent-section' });
    } else if (!resolves(section, inventory)) {
      bad.push({ field, section, reason: 'dangling-section' });
    }
  }
  return { checked, bad };
}

function main(): void {
  const rootFlag = process.argv.indexOf('--root');
  const root = rootFlag !== -1 ? (process.argv[rootFlag + 1] ?? REPO_ROOT) : REPO_ROOT;

  if (!existsSync(join(root, COVERAGE_MAP_PATH))) {
    process.stderr.write(
      `coverage-map-prose-anchors: missing coverage map at ${COVERAGE_MAP_PATH}.\n`,
    );
    process.exit(1);
  }
  if (!existsSync(join(root, INVENTORY_PATH))) {
    process.stderr.write(
      `coverage-map-prose-anchors: missing inventory at ${INVENTORY_PATH}. Generate it ` +
        'with pnpm run codegen:prose-anchors.\n',
    );
    process.exit(1);
  }

  const { checked, bad } = findBadSectionCitations(root);

  if (bad.length === 0) {
    process.stdout.write(
      `coverage-map-prose-anchors: OK — all ${checked} anthropic-spec-derived ` +
        '6767h_section citation(s) resolve to real section headings ' +
        `(${INVENTORY_PATH}).\n`,
    );
    process.exit(0);
  }

  process.stderr.write(
    `coverage-map-prose-anchors: ${bad.length} of ${checked} anthropic-spec-derived ` +
      'coverage-map citation(s) (033-PP-PLAN v7 § 14.2.3 gate #2) do not resolve. Each ' +
      'anthropic-spec-derived entry must cite a real 6767-h section that exists in the ' +
      `vendored inventory (${INVENTORY_PATH}); if 6767-h changed, regenerate the inventory ` +
      'in the same commit (pnpm run codegen:prose-anchors). Offending entry(ies):\n',
  );
  for (const c of bad) {
    const what =
      c.reason === 'absent-section'
        ? 'anthropic-spec-derived but 6767h_section is null/empty'
        : `6767h_section §${c.section ?? ''} does not resolve`;
    process.stderr.write(`  ${c.field}: ${what}\n`);
  }
  process.exit(1);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
