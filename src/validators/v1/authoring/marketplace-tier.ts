/**
 * IS marketplace authoring tier — 4-fold composable runtime validators.
 *
 * Hand-authored Zod mirror of
 * `schemas/authoring/v1/marketplace-tier.schema.json` (the canonical runtime
 * parser; the JSON Schema is the language-agnostic wire contract). Foundation
 * that all six authoring contracts (skill-frontmatter, plugin-manifest,
 * agent-definition, mcp-config, hook-config, marketplace-catalog) inherit.
 *
 * Per plan 033 § 14.10 (closes C3 / F-RH-001 / F-RH-006), the marketplace tier
 * is DECOMPOSED into four orthogonal folds so each evolves under its own
 * authority and changelog (see schemas/authoring/v1/CHANGELOG.md):
 *
 *   - requiredFields      (architectural — ISEDC Class-1)
 *   - deprecationRegistry (tactical — autonomous validator patch)
 *   - securityChecks      (CISO-driven)
 *   - disclosureMarkers   (Karpathy-axis)
 *
 * Canonical predicate (plan 033 § 14.A):
 *   valid_isMarketplace(a) := requiredFields(a) ∧ deprecationRegistry(a)
 *                             ∧ securityChecks(a) ∧ disclosureMarkers(a)
 *
 * The folds are intentionally open-world — `allOf` composition requires each
 * branch to tolerate fields the other branches add. Closed-world checks belong
 * in the per-contract schemas that apply this foundation.
 */

import { z } from 'zod';

/** An authoring artifact's parsed frontmatter/manifest object. */
type AuthoringArtifact = Record<string, unknown>;

/** A single fold finding: a human-readable message plus the offending path. */
export interface FoldIssue {
  readonly message: string;
  readonly path: readonly string[];
}

// ─── Fold constants (the spec surface; mirror the JSON Schema) ──────────────

/** FOLD 1 — the IS marketplace 8-field required set (NON-NEGOTIABLES item 1). */
export const IS_MARKETPLACE_REQUIRED_FIELDS = [
  'name',
  'description',
  'allowed-tools',
  'version',
  'author',
  'license',
  'compatibility',
  'tags',
] as const;

/** FOLD 2 — deprecated field → replacement field migrations. */
export const IS_MARKETPLACE_DEPRECATED_FIELDS: Readonly<Record<string, string>> = {
  'compatible-with': 'compatibility',
  when_to_use: 'description',
};

/** FOLD 3 — names that must not be used (reserved words). */
export const IS_MARKETPLACE_RESERVED_NAMES = [
  'skill',
  'claude',
  'anthropic',
  'mcp',
  'plugin',
  'agent',
] as const;

/** FOLD 4 — token-budget ceiling for `description`. */
export const SKILL_DESCRIPTION_MAX = 1536;

// ─── Fold checkers (pure; independently testable) ───────────────────────────

/** FOLD 1/4 — every required field MUST be present. */
export function requiredFieldsIssues(artifact: AuthoringArtifact): FoldIssue[] {
  const issues: FoldIssue[] = [];
  for (const field of IS_MARKETPLACE_REQUIRED_FIELDS) {
    if (!(field in artifact)) {
      issues.push({ message: `missing required field "${field}"`, path: [field] });
    }
  }
  return issues;
}

/** FOLD 2/4 — a present deprecated key fails; the message names the replacement. */
export function deprecationRegistryIssues(artifact: AuthoringArtifact): FoldIssue[] {
  const issues: FoldIssue[] = [];
  for (const [deprecated, replacement] of Object.entries(IS_MARKETPLACE_DEPRECATED_FIELDS)) {
    if (deprecated in artifact) {
      issues.push({
        message: `deprecated field "${deprecated}" — migrate to "${replacement}"`,
        path: [deprecated],
      });
    }
  }
  return issues;
}

/** FOLD 3/4 — reserved-word + XML + shell-substitution hardening. */
export function securityChecksIssues(artifact: AuthoringArtifact): FoldIssue[] {
  const issues: FoldIssue[] = [];
  const name = artifact['name'];
  if (typeof name === 'string') {
    if ((IS_MARKETPLACE_RESERVED_NAMES as readonly string[]).includes(name)) {
      issues.push({ message: `name "${name}" is a reserved word`, path: ['name'] });
    }
    if (/[<>]/.test(name)) {
      issues.push({ message: 'name must not contain XML angle brackets', path: ['name'] });
    }
  }
  const description = artifact['description'];
  if (typeof description === 'string') {
    if (/<[^>]+>/.test(description)) {
      issues.push({ message: 'description must not contain XML tags', path: ['description'] });
    }
    if (description.includes('${')) {
      issues.push({
        message: 'description must not contain shell-substitution sequences',
        path: ['description'],
      });
    }
  }
  return issues;
}

/** FOLD 4/4 — `description` token-budget ceiling. */
export function disclosureMarkersIssues(artifact: AuthoringArtifact): FoldIssue[] {
  const issues: FoldIssue[] = [];
  const description = artifact['description'];
  if (typeof description === 'string' && description.length > SKILL_DESCRIPTION_MAX) {
    issues.push({
      message: `description exceeds the ${SKILL_DESCRIPTION_MAX}-character token budget`,
      path: ['description'],
    });
  }
  return issues;
}

/** The composition — every fold's issues, in fold order (plan 033 § 14.A). */
export function isMarketplaceIssues(artifact: AuthoringArtifact): FoldIssue[] {
  return [
    ...requiredFieldsIssues(artifact),
    ...deprecationRegistryIssues(artifact),
    ...securityChecksIssues(artifact),
    ...disclosureMarkersIssues(artifact),
  ];
}

// ─── Zod schemas (wire the pure checkers into the validator surface) ─────────

const AuthoringArtifactSchema = z.record(z.string(), z.unknown());

function attach(
  schema: typeof AuthoringArtifactSchema,
  checker: (artifact: AuthoringArtifact) => FoldIssue[],
): z.ZodType<AuthoringArtifact> {
  return schema.superRefine((data, ctx) => {
    for (const issue of checker(data)) {
      ctx.addIssue({ code: 'custom', message: issue.message, path: [...issue.path] });
    }
  });
}

/** FOLD 1/4 schema — required-field presence. */
export const IsMarketplaceRequiredFieldsSchema = attach(
  AuthoringArtifactSchema,
  requiredFieldsIssues,
);

/** FOLD 2/4 schema — deprecation registry. */
export const IsMarketplaceDeprecationRegistrySchema = attach(
  AuthoringArtifactSchema,
  deprecationRegistryIssues,
);

/** FOLD 3/4 schema — security checks. */
export const IsMarketplaceSecurityChecksSchema = attach(
  AuthoringArtifactSchema,
  securityChecksIssues,
);

/** FOLD 4/4 schema — disclosure markers. */
export const IsMarketplaceDisclosureMarkersSchema = attach(
  AuthoringArtifactSchema,
  disclosureMarkersIssues,
);

/** The IS marketplace tier — `allOf` composition of the four folds. */
export const IsMarketplaceSchema = attach(AuthoringArtifactSchema, isMarketplaceIssues);

export type IsMarketplace = z.infer<typeof IsMarketplaceSchema>;
