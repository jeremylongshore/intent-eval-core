/**
 * Schema-policy eval — skill-frontmatter contract (bead hi7e, closes audit C2).
 *
 * C2 asks: are the kernel authoring rules CORRECT against a curated corpus — not
 * merely well-formed? This eval measures the published `skill-frontmatter`
 * contract (the base + universalFolds + overlay composition) against the
 * skill-frontmatter fixture corpus (plan 033 § 14.21) and asserts a precise
 * correctness contract, so the measured behavior cannot silently drift.
 *
 * DR-044 D7 evolution (2026-06-09): this eval originally measured the
 * `marketplace-tier` FOUNDATION alone, which deferred type + name-format checks
 * to the (then-unbuilt) per-contract schema — 7 negatives were "correctly
 * deferred". Now that contract #1 (skill-frontmatter) exists, the per-contract
 * schema closes that gap: ALL 18 negatives are in-scope and rejected. There are
 * no deferrals left. This is strictly more correct.
 *
 * Human-readable scorecard:
 *   000-docs/008-AA-EVAL-schema-policy-marketplace-tier-2026-06-09.md
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SkillFrontmatterSchema } from '../validators/v1/authoring/skill-frontmatter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = join(__dirname, '../../tests/authoring/v1/fixtures/skill-frontmatter');

function listJson(cls: string): string[] {
  return readdirSync(join(SKILL_DIR, cls)).filter((f) => f.endsWith('.json'));
}

function accepts(cls: string, file: string): boolean {
  const obj: unknown = JSON.parse(readFileSync(join(SKILL_DIR, cls, file), 'utf-8'));
  return SkillFrontmatterSchema.safeParse(obj).success;
}

describe('schema-policy eval — contract soundness (no false verdicts)', () => {
  it('accepts every valid skill (zero false-rejects across positive + edge)', () => {
    for (const cls of ['positive', 'edge'] as const) {
      for (const file of listJson(cls)) {
        expect(accepts(cls, file), `${cls}/${file} should be accepted`).toBe(true);
      }
    }
  });

  it('rejects every negative (per-contract schema closes the formerly-deferred gap)', () => {
    for (const file of listJson('negative')) {
      expect(accepts('negative', file), `negative/${file} should be rejected`).toBe(false);
    }
  });
});

describe('schema-policy eval — scorecard (closes audit C2)', () => {
  it('matches the measured correctness contract', () => {
    const positives = listJson('positive');
    const edges = listJson('edge');
    const negatives = listJson('negative');

    const validAccepted = [...positives, ...edges].filter((f) =>
      accepts(positives.includes(f) ? 'positive' : 'edge', f),
    ).length;
    const negativesRejected = negatives.filter((f) => !accepts('negative', f)).length;

    const scorecard = {
      validInputs: positives.length + edges.length,
      validAccepted,
      falseRejects: positives.length + edges.length - validAccepted,
      negatives: negatives.length,
      negativesRejected,
      falseAccepts: negatives.length - negativesRejected,
    };

    // Soundness: no valid input rejected; no negative slips through.
    expect(scorecard.falseRejects).toBe(0);
    expect(scorecard.falseAccepts).toBe(0);
    // The corpus partitions exactly as documented in the scorecard doc.
    expect(scorecard.validInputs).toBe(22); // 15 positive + 7 edge
    expect(scorecard.negatives).toBe(18); // 8 missing + 5 type + 5 constraint
    expect(scorecard.validAccepted).toBe(22);
    expect(scorecard.negativesRejected).toBe(18);
  });
});
