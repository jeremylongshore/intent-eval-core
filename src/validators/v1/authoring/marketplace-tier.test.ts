/**
 * Tests for the universal-fold IS marketplace authoring foundation (post-DR-044 D7).
 *
 * Covers the three universal fold checkers (every branch), the universalFolds
 * composition, the parameterizable requiredFields helper, and the Zod schema
 * surface. Mirrors the golden behavior in schemas/authoring/v1/CHANGELOG.md.
 */

import { describe, it, expect } from 'vitest';
import {
  IS_MARKETPLACE_DEPRECATED_FIELDS,
  IS_MARKETPLACE_RESERVED_NAMES,
  SKILL_DESCRIPTION_MAX,
  requiredFieldsIssues,
  deprecationRegistryIssues,
  securityChecksIssues,
  disclosureMarkersIssues,
  universalFoldsIssues,
  makeRequiredFieldsSchema,
  DeprecationRegistrySchema,
  SecurityChecksSchema,
  DisclosureMarkersSchema,
  UniversalFoldsSchema,
} from './marketplace-tier.js';

/** A canonical artifact that passes all three universal folds. */
function cleanArtifact(): Record<string, unknown> {
  return {
    name: 'my-skill',
    description: 'A perfectly valid skill description.',
  };
}

describe('universal-fold constants', () => {
  it('deprecation registry maps deprecated → replacement', () => {
    expect(IS_MARKETPLACE_DEPRECATED_FIELDS['compatible-with']).toBe('compatibility');
    expect(IS_MARKETPLACE_DEPRECATED_FIELDS['when_to_use']).toBe('description');
  });

  it('reserved names + description budget are exported', () => {
    expect(IS_MARKETPLACE_RESERVED_NAMES).toContain('claude');
    expect(SKILL_DESCRIPTION_MAX).toBe(1536);
  });
});

describe('requiredFields — parameterizable helper (D7)', () => {
  it('passes when every supplied field is present', () => {
    expect(requiredFieldsIssues({ a: 1, b: 2 }, ['a', 'b'])).toEqual([]);
  });

  it('flags each missing field in declaration order', () => {
    const issues = requiredFieldsIssues({ a: 1 }, ['a', 'b', 'c']);
    expect(issues).toEqual([
      { message: 'missing required field "b"', path: ['b'] },
      { message: 'missing required field "c"', path: ['c'] },
    ]);
  });

  it('an empty required list never fails', () => {
    expect(requiredFieldsIssues({}, [])).toEqual([]);
  });
});

describe('UNIVERSAL FOLD 1 — deprecationRegistryIssues', () => {
  it('passes an artifact with no deprecated keys', () => {
    expect(deprecationRegistryIssues(cleanArtifact())).toEqual([]);
  });

  it('flags each deprecated key with its replacement', () => {
    const issues = deprecationRegistryIssues({ 'compatible-with': 'x', when_to_use: 'y' });
    expect(issues).toEqual([
      {
        message: 'deprecated field "compatible-with" — migrate to "compatibility"',
        path: ['compatible-with'],
      },
      {
        message: 'deprecated field "when_to_use" — migrate to "description"',
        path: ['when_to_use'],
      },
    ]);
  });
});

describe('UNIVERSAL FOLD 2 — securityChecksIssues (universal-immutable)', () => {
  it('passes a clean artifact', () => {
    expect(securityChecksIssues(cleanArtifact())).toEqual([]);
  });

  it('flags a reserved name', () => {
    expect(securityChecksIssues({ name: 'skill' })).toEqual([
      { message: 'name "skill" is a reserved word', path: ['name'] },
    ]);
  });

  it('flags XML angle brackets in name', () => {
    expect(securityChecksIssues({ name: 'a<b' })).toEqual([
      { message: 'name must not contain XML angle brackets', path: ['name'] },
    ]);
  });

  it('ignores a non-string name', () => {
    expect(securityChecksIssues({ name: 123 })).toEqual([]);
  });

  it('flags XML tags in description', () => {
    expect(securityChecksIssues({ description: 'has <tag> markup' })).toEqual([
      { message: 'description must not contain XML tags', path: ['description'] },
    ]);
  });

  it('flags shell-substitution in description', () => {
    expect(securityChecksIssues({ description: 'uses ${HOME}' })).toEqual([
      {
        message: 'description must not contain shell-substitution sequences',
        path: ['description'],
      },
    ]);
  });

  it('ignores a non-string description', () => {
    expect(securityChecksIssues({ description: 42 })).toEqual([]);
  });
});

describe('UNIVERSAL FOLD 3 — disclosureMarkersIssues', () => {
  it('passes a description within budget', () => {
    expect(disclosureMarkersIssues(cleanArtifact())).toEqual([]);
  });

  it('passes a description exactly at the budget boundary', () => {
    expect(disclosureMarkersIssues({ description: 'x'.repeat(SKILL_DESCRIPTION_MAX) })).toEqual([]);
  });

  it('flags a description over the token budget', () => {
    expect(disclosureMarkersIssues({ description: 'x'.repeat(SKILL_DESCRIPTION_MAX + 1) })).toEqual(
      [
        {
          message: `description exceeds the ${SKILL_DESCRIPTION_MAX}-character token budget`,
          path: ['description'],
        },
      ],
    );
  });

  it('ignores a non-string description (short-circuits length check)', () => {
    expect(disclosureMarkersIssues({ description: 99 })).toEqual([]);
  });
});

describe('composition — universalFoldsIssues', () => {
  it('returns no issues for a clean artifact', () => {
    expect(universalFoldsIssues(cleanArtifact())).toEqual([]);
  });

  it('aggregates issues across all three universal folds in fold order', () => {
    const messages = universalFoldsIssues({
      name: 'claude',
      description: 'has <xml>',
      'compatible-with': 'x',
    }).map((i) => i.message);
    expect(messages).toContain('deprecated field "compatible-with" — migrate to "compatibility"');
    expect(messages).toContain('name "claude" is a reserved word');
    expect(messages).toContain('description must not contain XML tags');
  });
});

describe('Zod schema surface', () => {
  it('UniversalFoldsSchema.parse returns the artifact when valid', () => {
    const artifact = cleanArtifact();
    expect(UniversalFoldsSchema.parse(artifact)).toEqual(artifact);
  });

  it('UniversalFoldsSchema.safeParse fails with fold issues when invalid', () => {
    const result = UniversalFoldsSchema.safeParse({ name: 'skill', when_to_use: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('name "skill" is a reserved word');
      expect(messages).toContain('deprecated field "when_to_use" — migrate to "description"');
    }
  });

  it('each universal fold schema parses a clean artifact and rejects its own violation', () => {
    const ok = cleanArtifact();
    expect(DeprecationRegistrySchema.safeParse(ok).success).toBe(true);
    expect(SecurityChecksSchema.safeParse(ok).success).toBe(true);
    expect(DisclosureMarkersSchema.safeParse(ok).success).toBe(true);

    expect(DeprecationRegistrySchema.safeParse({ when_to_use: 'x' }).success).toBe(false);
    expect(SecurityChecksSchema.safeParse({ name: 'mcp' }).success).toBe(false);
    expect(DisclosureMarkersSchema.safeParse({ description: 'y'.repeat(2000) }).success).toBe(
      false,
    );
  });

  it('makeRequiredFieldsSchema builds a per-contract required-fields schema', () => {
    const schema = makeRequiredFieldsSchema(['name', 'description']);
    expect(schema.safeParse(cleanArtifact()).success).toBe(true);
    expect(schema.safeParse({ name: 'x' }).success).toBe(false);
  });
});
