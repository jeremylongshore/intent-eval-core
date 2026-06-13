#!/usr/bin/env -S node --experimental-strip-types
/**
 * check-coverage-map-completeness.ts — § 14.2.3 gate #1 (coverage-map-completeness).
 *
 * "every schema field in the skill-frontmatter composed schema has a coverage-map
 *  entry — missing = red." (033-PP-PLAN-skill-refiner-sak-amendment-v7 § 14.2.3).
 *
 * For each AUTHORING CONTRACT in the registry below, this gate:
 *   1. resolves the contract's composed-schema FIELD SET — the union of the
 *      `properties` keys across the layers the composition allOf-refs
 *      (upstream-base + is-overlay). The universal folds (marketplace-tier
 *      universalFolds) add NO new field NAMES — they only constrain `name` /
 *      `description`, which the base already declares — so they contribute no
 *      rows;
 *   2. reads the coverage map (schemas/authoring/v1/6767h-coverage-map.json);
 *   3. FAILS if any composed field lacks a `<contract>.<field>` entry, OR if the
 *      map carries an entry for a field the composed schema does not declare
 *      (a stale row — bidirectional completeness).
 *
 * The CONTRACTS registry is the extension seam: skill-frontmatter was the walking
 * skeleton; [2t2p] extended the registry to ALL SIX authoring contracts
 * (plugin-manifest / agent-definition / mcp-config / hook-config /
 * marketplace-catalog) — each row names the v2 composed-schema layers whose
 * top-level `properties` union is the contract's field set, and each contract's
 * `<contract>.<field>` rows are populated in the coverage map. The completeness
 * check is identical per contract.
 *
 * Deterministic, offline, no LLM. Scripts do not cross-import (mirrors
 * check-prose-anchors.ts).
 *
 * Exit codes:
 *   0 — every composed field of every registered contract has a coverage-map entry
 *       (and no stale entries)
 *   1 — at least one missing or stale entry (neutral error copy names each)
 *
 * Usage:
 *   node --experimental-strip-types scripts/check-coverage-map-completeness.ts [--root <dir>]
 *
 * `--root` points the gate at a repo-shaped fixture tree (test-harness use).
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');

/** Repo-relative path of the coverage map. */
export const COVERAGE_MAP_PATH = 'schemas/authoring/v1/6767h-coverage-map.json';

/**
 * The authoring-contract registry. Each entry names the contract and the
 * composed-schema LAYER files whose `properties` keys form the field set.
 * [2t2p] All six authoring contracts are registered + populated. To add another:
 * append a row here AND populate its `<contract>.<field>` rows in the coverage map.
 */
export interface ContractDef {
  readonly contract: string;
  /** Layer schema files (repo-relative) whose `properties` keys are unioned. */
  readonly layers: readonly string[];
}

export const CONTRACTS: readonly ContractDef[] = [
  {
    contract: 'skill-frontmatter',
    layers: [
      'schemas/authoring/v1/upstream-base/skill-frontmatter.v1.json',
      'schemas/authoring/v1/is-overlay/skill-frontmatter.v1.json',
    ],
  },
  // [2t2p] The remaining five authoring contracts. Their composed field set is
  // the v2 layers' top-level `properties` union (the v2 bases are the captured
  // upstream projections per DR-062; the v1 authoring family is byte-frozen).
  {
    contract: 'plugin-manifest',
    layers: [
      'schemas/authoring/v2/upstream-base/plugin-manifest.v2.json',
      'schemas/authoring/v2/is-overlay/plugin-manifest.v2.json',
    ],
  },
  {
    contract: 'agent-definition',
    layers: [
      'schemas/authoring/v2/upstream-base/agent-definition.v2.json',
      'schemas/authoring/v2/is-overlay/agent-definition.v2.json',
    ],
  },
  {
    contract: 'mcp-config',
    layers: [
      'schemas/authoring/v2/upstream-base/mcp-config.v2.json',
      'schemas/authoring/v2/is-overlay/mcp-config.v2.json',
    ],
  },
  {
    contract: 'hook-config',
    layers: [
      'schemas/authoring/v2/upstream-base/hook-config.v2.json',
      'schemas/authoring/v2/is-overlay/hook-config.v2.json',
    ],
  },
  {
    contract: 'marketplace-catalog',
    layers: [
      'schemas/authoring/v2/upstream-base/marketplace-catalog.v2.json',
      'schemas/authoring/v2/is-overlay/marketplace-catalog.v2.json',
    ],
  },
];

/** The coverage-map shape (§ 14.2.2). */
export interface CoverageMap {
  readonly $schemaVersion: string;
  readonly fields: Record<string, { readonly trace_kind: string; readonly [k: string]: unknown }>;
}

interface LayerSchema {
  readonly properties?: Record<string, unknown>;
}

/** The dotted-path field set a contract's composed schema declares. */
export function composedFieldSet(contract: ContractDef, root: string = REPO_ROOT): Set<string> {
  const fields = new Set<string>();
  for (const layer of contract.layers) {
    const parsed = JSON.parse(readFileSync(join(root, layer), 'utf-8')) as LayerSchema;
    for (const field of Object.keys(parsed.properties ?? {})) {
      fields.add(`${contract.contract}.${field}`);
    }
  }
  return fields;
}

/** Load the coverage map under `root`. */
export function loadCoverageMap(root: string = REPO_ROOT): CoverageMap {
  return JSON.parse(readFileSync(join(root, COVERAGE_MAP_PATH), 'utf-8')) as CoverageMap;
}

export interface CompletenessResult {
  /** Composed fields with no coverage-map entry. */
  readonly missing: string[];
  /** Coverage-map entries for a field no registered composed schema declares. */
  readonly stale: string[];
}

/** Bidirectional completeness over the whole registry. */
export function evaluateCompleteness(root: string = REPO_ROOT): CompletenessResult {
  const map = loadCoverageMap(root);
  const mapped = new Set(Object.keys(map.fields));

  const declared = new Set<string>();
  for (const contract of CONTRACTS) {
    for (const field of composedFieldSet(contract, root)) declared.add(field);
  }

  const registeredContracts = new Set(CONTRACTS.map((c) => c.contract));

  const missing = [...declared].filter((f) => !mapped.has(f)).sort();
  // A map entry is stale only if it belongs to a REGISTERED contract yet is not
  // declared — entries for not-yet-registered contracts are the scoped remainder,
  // not stale.
  const stale = [...mapped]
    .filter((f) => registeredContracts.has(f.split('.')[0] ?? '') && !declared.has(f))
    .sort();

  return { missing, stale };
}

function main(): void {
  const rootFlag = process.argv.indexOf('--root');
  const root = rootFlag !== -1 ? (process.argv[rootFlag + 1] ?? REPO_ROOT) : REPO_ROOT;

  if (!existsSync(join(root, COVERAGE_MAP_PATH))) {
    process.stderr.write(
      `coverage-map-completeness: missing coverage map at ${COVERAGE_MAP_PATH}. ` +
        'Author it per 033-PP-PLAN v7 § 14.2.2.\n',
    );
    process.exit(1);
  }

  const { missing, stale } = evaluateCompleteness(root);

  if (missing.length === 0 && stale.length === 0) {
    const total = CONTRACTS.reduce((n, c) => n + composedFieldSet(c, root).size, 0);
    process.stdout.write(
      `coverage-map-completeness: OK — all ${total} composed field(s) across ` +
        `${CONTRACTS.length} registered authoring contract(s) have a coverage-map entry ` +
        '(no missing, no stale).\n',
    );
    process.exit(0);
  }

  process.stderr.write(
    'coverage-map-completeness: the coverage map (033-PP-PLAN v7 § 14.2.3 gate #1) is ' +
      `out of sync with the composed authoring schema(s) (${COVERAGE_MAP_PATH}). Every ` +
      'composed-schema field must have a coverage-map entry, and every entry of a ' +
      'registered contract must name a real composed field.\n',
  );
  for (const field of missing) {
    process.stderr.write(`  MISSING entry: ${field} (declared in a composed schema, not in map)\n`);
  }
  for (const field of stale) {
    process.stderr.write(`  STALE entry: ${field} (in map, not declared by the composed schema)\n`);
  }
  process.exit(1);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
