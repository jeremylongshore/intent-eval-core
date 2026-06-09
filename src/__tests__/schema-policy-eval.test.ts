/**
 * Schema-policy eval — marketplace-tier foundation (bead hi7e, closes audit C2).
 *
 * C2 asks: are the kernel `$defs.isMarketplace` rules CORRECT against a curated
 * corpus — not merely well-formed? This eval measures the foundation against the
 * skill-frontmatter fixture corpus (plan 033 § 14.21) and asserts a precise
 * correctness contract, so the measured behavior cannot silently drift.
 *
 * skill-frontmatter is the contract whose 8 required fields ARE the isMarketplace
 * required set, so the foundation applies in full. (The other five contracts
 * specialize `requiredFields` in their own per-contract schemas — charter-gated
 * bead 8vq0 — so the foundation alone is not their complete validator.)
 *
 * Coverage boundary measured here:
 *   - IN SCOPE for the foundation (must reject): every missing-required negative
 *     (requiredFields fold) + reserved-word / XML name + over-budget description
 *     (securityChecks + disclosureMarkers folds).
 *   - DEFERRED to the per-contract schema (foundation does NOT reject): type
 *     errors (requiredFields checks presence, not type) + name-format violations
 *     (kebab-case is a per-contract concern, not one of the four folds).
 *
 * Human-readable scorecard:
 *   000-docs/008-AA-EVAL-schema-policy-marketplace-tier-2026-06-09.md
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IsMarketplaceSchema } from '../validators/v1/authoring/marketplace-tier.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = join(__dirname, '../../tests/authoring/v1/fixtures/skill-frontmatter');

/**
 * Negatives the foundation is NOT responsible for — they exercise checks that
 * belong to the per-contract skill-frontmatter schema (type validation +
 * kebab-case name format), not the cross-contract marketplace-tier foundation.
 */
const DEFERRED_TO_PER_CONTRACT = new Set([
  'type-version.json',
  'type-tags.json',
  'type-allowed-tools.json',
  'type-name.json',
  'type-compatibility.json',
  'constraint-name-uppercase.json',
  'constraint-name-spaces.json',
]);

function listJson(cls: string): string[] {
  return readdirSync(join(SKILL_DIR, cls)).filter((f) => f.endsWith('.json'));
}

function accepts(cls: string, file: string): boolean {
  const obj: unknown = JSON.parse(readFileSync(join(SKILL_DIR, cls, file), 'utf-8'));
  return IsMarketplaceSchema.safeParse(obj).success;
}

describe('schema-policy eval — foundation soundness (no false verdicts)', () => {
  it('accepts every valid skill (zero false-rejects across positive + edge)', () => {
    for (const cls of ['positive', 'edge'] as const) {
      for (const file of listJson(cls)) {
        expect(accepts(cls, file), `${cls}/${file} should be accepted`).toBe(true);
      }
    }
  });

  it('rejects every in-scope negative (missing-required + security + disclosure)', () => {
    for (const file of listJson('negative')) {
      if (DEFERRED_TO_PER_CONTRACT.has(file)) continue;
      expect(accepts('negative', file), `negative/${file} should be rejected`).toBe(false);
    }
  });

  it('defers out-of-scope negatives to the per-contract schema (foundation accepts)', () => {
    for (const file of listJson('negative')) {
      if (!DEFERRED_TO_PER_CONTRACT.has(file)) continue;
      expect(accepts('negative', file), `negative/${file} is out-of-scope for the foundation`).toBe(
        true,
      );
    }
  });
});

describe('schema-policy eval — scorecard (closes audit C2)', () => {
  it('matches the measured correctness contract', () => {
    const positives = listJson('positive');
    const edges = listJson('edge');
    const negatives = listJson('negative');

    const inScopeNeg = negatives.filter((f) => !DEFERRED_TO_PER_CONTRACT.has(f));
    const deferredNeg = negatives.filter((f) => DEFERRED_TO_PER_CONTRACT.has(f));

    const validAccepted = [...positives, ...edges].filter((f) =>
      accepts(positives.includes(f) ? 'positive' : 'edge', f),
    ).length;
    const inScopeRejected = inScopeNeg.filter((f) => !accepts('negative', f)).length;
    const deferredAccepted = deferredNeg.filter((f) => accepts('negative', f)).length;

    const scorecard = {
      validInputs: positives.length + edges.length,
      validAccepted,
      falseRejects: positives.length + edges.length - validAccepted,
      inScopeNegatives: inScopeNeg.length,
      inScopeRejected,
      falseAcceptsInScope: inScopeNeg.length - inScopeRejected,
      deferredNegatives: deferredNeg.length,
      deferredAccepted,
    };

    // Soundness: no valid input is rejected; no in-scope negative slips through.
    expect(scorecard.falseRejects).toBe(0);
    expect(scorecard.falseAcceptsInScope).toBe(0);
    // The corpus partitions exactly as documented in the scorecard doc.
    expect(scorecard.validInputs).toBe(22); // 15 positive + 7 edge
    expect(scorecard.inScopeNegatives).toBe(11); // 8 missing + 3 security/disclosure
    expect(scorecard.deferredNegatives).toBe(7); // 5 type + 2 name-format
    expect(scorecard.inScopeRejected).toBe(11);
    expect(scorecard.deferredAccepted).toBe(7);
  });
});
