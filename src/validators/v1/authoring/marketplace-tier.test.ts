/**
 * Tests for the 4-fold IS marketplace authoring-tier validators.
 *
 * Covers every fold checker (pure functions) across all branches, the
 * composition, and the Zod schema surface (positive + negative). Mirrors the
 * golden behavior documented in schemas/authoring/v1/CHANGELOG.md.
 */

import { describe, it, expect } from 'vitest';
import {
  IS_MARKETPLACE_REQUIRED_FIELDS,
  IS_MARKETPLACE_DEPRECATED_FIELDS,
  IS_MARKETPLACE_RESERVED_NAMES,
  SKILL_DESCRIPTION_MAX,
  requiredFieldsIssues,
  deprecationRegistryIssues,
  securityChecksIssues,
  disclosureMarkersIssues,
  isMarketplaceIssues,
  IsMarketplaceRequiredFieldsSchema,
  IsMarketplaceDeprecationRegistrySchema,
  IsMarketplaceSecurityChecksSchema,
  IsMarketplaceDisclosureMarkersSchema,
  IsMarketplaceSchema,
} from './marketplace-tier.js';

/** A canonical artifact that passes all four folds. */
function validArtifact(): Record<string, unknown> {
  return {
    name: 'my-skill',
    description: 'A perfectly valid skill description.',
    'allowed-tools': ['Read'],
    version: '1.0.0',
    author: 'Jeremy Longshore <jeremy@intentsolutions.io>',
    license: 'Apache-2.0',
    compatibility: 'claude-code',
    tags: ['testing'],
  };
}

describe('fold constants', () => {
  it('requiredFields is exactly the IS 8-field set', () => {
    expect([...IS_MARKETPLACE_REQUIRED_FIELDS]).toEqual([
      'name',
      'description',
      'allowed-tools',
      'version',
      'author',
      'license',
      'compatibility',
      'tags',
    ]);
  });

  it('deprecation registry maps deprecated → replacement', () => {
    expect(IS_MARKETPLACE_DEPRECATED_FIELDS['compatible-with']).toBe('compatibility');
    expect(IS_MARKETPLACE_DEPRECATED_FIELDS['when_to_use']).toBe('description');
  });

  it('reserved names + description budget are exported', () => {
    expect(IS_MARKETPLACE_RESERVED_NAMES).toContain('claude');
    expect(SKILL_DESCRIPTION_MAX).toBe(1536);
  });
});

describe('FOLD 1 — requiredFieldsIssues', () => {
  it('passes a complete artifact (no issues)', () => {
    expect(requiredFieldsIssues(validArtifact())).toEqual([]);
  });

  it('flags every missing field on an empty artifact', () => {
    const issues = requiredFieldsIssues({});
    expect(issues).toHaveLength(IS_MARKETPLACE_REQUIRED_FIELDS.length);
    expect(issues[0]).toEqual({ message: 'missing required field "name"', path: ['name'] });
  });

  it('flags exactly the one missing field', () => {
    const artifact = validArtifact();
    delete artifact['license'];
    const issues = requiredFieldsIssues(artifact);
    expect(issues).toEqual([{ message: 'missing required field "license"', path: ['license'] }]);
  });
});

describe('FOLD 2 — deprecationRegistryIssues', () => {
  it('passes an artifact with no deprecated keys', () => {
    expect(deprecationRegistryIssues(validArtifact())).toEqual([]);
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

describe('FOLD 3 — securityChecksIssues', () => {
  it('passes a clean artifact', () => {
    expect(securityChecksIssues(validArtifact())).toEqual([]);
  });

  it('flags a reserved name', () => {
    const issues = securityChecksIssues({ name: 'skill' });
    expect(issues).toEqual([{ message: 'name "skill" is a reserved word', path: ['name'] }]);
  });

  it('flags XML angle brackets in name', () => {
    const issues = securityChecksIssues({ name: 'a<b' });
    expect(issues).toEqual([
      { message: 'name must not contain XML angle brackets', path: ['name'] },
    ]);
  });

  it('ignores a non-string name', () => {
    expect(securityChecksIssues({ name: 123 })).toEqual([]);
  });

  it('flags XML tags in description', () => {
    const issues = securityChecksIssues({ description: 'has <tag> markup' });
    expect(issues).toEqual([
      { message: 'description must not contain XML tags', path: ['description'] },
    ]);
  });

  it('flags shell-substitution in description', () => {
    const issues = securityChecksIssues({ description: 'uses ${HOME}' });
    expect(issues).toEqual([
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

describe('FOLD 4 — disclosureMarkersIssues', () => {
  it('passes a description within budget', () => {
    expect(disclosureMarkersIssues(validArtifact())).toEqual([]);
  });

  it('flags a description over the token budget', () => {
    const issues = disclosureMarkersIssues({ description: 'x'.repeat(SKILL_DESCRIPTION_MAX + 1) });
    expect(issues).toEqual([
      {
        message: `description exceeds the ${SKILL_DESCRIPTION_MAX}-character token budget`,
        path: ['description'],
      },
    ]);
  });

  it('ignores a non-string description (short-circuits length check)', () => {
    expect(disclosureMarkersIssues({ description: 99 })).toEqual([]);
  });
});

describe('composition — isMarketplaceIssues', () => {
  it('returns no issues for a fully valid artifact', () => {
    expect(isMarketplaceIssues(validArtifact())).toEqual([]);
  });

  it('aggregates issues across all four folds in fold order', () => {
    const issues = isMarketplaceIssues({
      name: 'claude',
      description: 'has <xml>',
      'compatible-with': 'x',
    });
    const messages = issues.map((i) => i.message);
    // FOLD 1 (missing required) come first, then FOLD 2, then FOLD 3.
    expect(messages).toContain('missing required field "version"');
    expect(messages).toContain('deprecated field "compatible-with" — migrate to "compatibility"');
    expect(messages).toContain('name "claude" is a reserved word');
    expect(messages).toContain('description must not contain XML tags');
  });
});

describe('Zod schema surface', () => {
  it('IsMarketplaceSchema.parse returns the artifact when valid', () => {
    const artifact = validArtifact();
    expect(IsMarketplaceSchema.parse(artifact)).toEqual(artifact);
  });

  it('IsMarketplaceSchema.safeParse fails with fold issues when invalid', () => {
    const result = IsMarketplaceSchema.safeParse({ name: 'skill' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('name "skill" is a reserved word');
      expect(messages).toContain('missing required field "version"');
    }
  });

  it('each fold schema parses a clean artifact and rejects its own violation', () => {
    const ok = validArtifact();
    expect(IsMarketplaceRequiredFieldsSchema.safeParse(ok).success).toBe(true);
    expect(IsMarketplaceDeprecationRegistrySchema.safeParse(ok).success).toBe(true);
    expect(IsMarketplaceSecurityChecksSchema.safeParse(ok).success).toBe(true);
    expect(IsMarketplaceDisclosureMarkersSchema.safeParse(ok).success).toBe(true);

    expect(IsMarketplaceRequiredFieldsSchema.safeParse({}).success).toBe(false);
    expect(IsMarketplaceDeprecationRegistrySchema.safeParse({ when_to_use: 'x' }).success).toBe(
      false,
    );
    expect(IsMarketplaceSecurityChecksSchema.safeParse({ name: 'mcp' }).success).toBe(false);
    expect(
      IsMarketplaceDisclosureMarkersSchema.safeParse({ description: 'y'.repeat(2000) }).success,
    ).toBe(false);
  });
});
