/**
 * Structural integrity test for the authoring fixture corpus.
 *
 * Guards the Phase 1 test corpus (plan 033 § 14.21, closes C2 / F-KB-002)
 * against silent drift: 240 fixtures = 40 per contract × 6 contracts, with the
 * 15/18/7 (positive/negative/edge) split and the per-sub-class composition from
 * § 14.21.1. Every fixture must parse as JSON.
 *
 * The full validating harness (running each fixture through
 * valid_C(fixture, isMarketplace)) is a follow-on bead — see
 * tests/authoring/v1/FIXTURES.md § scope note.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../../tests/authoring/v1/fixtures');

const CONTRACTS = [
  'skill-frontmatter',
  'plugin-manifest',
  'agent-definition',
  'mcp-config',
  'hook-config',
  'marketplace-catalog',
] as const;

/** Per-sub-class counts per contract (plan 033 § 14.21.1). */
const COMPOSITION = {
  positive: { total: 15, prefixes: { canonical: 10, edge: 5 } },
  negative: { total: 18, prefixes: { missing: 8, type: 5, constraint: 5 } },
  edge: { total: 7, prefixes: { ambiguity: 5, frontier: 2 } },
} as const;

function jsonFiles(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith('.json'));
}

describe('authoring fixture corpus — structure', () => {
  it('ships all 6 authoring contracts', () => {
    const dirs = readdirSync(FIXTURES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(dirs).toEqual([...CONTRACTS].sort());
  });

  it('totals exactly 240 fixtures (40 per contract × 6)', () => {
    let total = 0;
    for (const contract of CONTRACTS) {
      for (const cls of ['positive', 'negative', 'edge'] as const) {
        total += jsonFiles(join(FIXTURES_DIR, contract, cls)).length;
      }
    }
    expect(total).toBe(240);
  });

  it.each(CONTRACTS)('%s has the 15/18/7 class split (40 total)', (contract) => {
    const positive = jsonFiles(join(FIXTURES_DIR, contract, 'positive'));
    const negative = jsonFiles(join(FIXTURES_DIR, contract, 'negative'));
    const edge = jsonFiles(join(FIXTURES_DIR, contract, 'edge'));
    expect(positive).toHaveLength(COMPOSITION.positive.total);
    expect(negative).toHaveLength(COMPOSITION.negative.total);
    expect(edge).toHaveLength(COMPOSITION.edge.total);
    expect(positive.length + negative.length + edge.length).toBe(40);
  });

  it.each(CONTRACTS)('%s has the per-sub-class counts from § 14.21.1', (contract) => {
    for (const [cls, spec] of Object.entries(COMPOSITION)) {
      const files = jsonFiles(join(FIXTURES_DIR, contract, cls));
      for (const [prefix, count] of Object.entries(spec.prefixes)) {
        const matching = files.filter((f) => f.startsWith(`${prefix}-`));
        expect(matching, `${contract}/${cls}/${prefix}-*`).toHaveLength(count);
      }
    }
  });
});

describe('authoring fixture corpus — every fixture is valid JSON', () => {
  it.each(CONTRACTS)('%s fixtures all parse', (contract) => {
    for (const cls of ['positive', 'negative', 'edge'] as const) {
      const dir = join(FIXTURES_DIR, contract, cls);
      for (const file of jsonFiles(dir)) {
        const raw = readFileSync(join(dir, file), 'utf-8');
        expect(() => {
          JSON.parse(raw);
        }, `${contract}/${cls}/${file}`).not.toThrow();
      }
    }
  });
});
