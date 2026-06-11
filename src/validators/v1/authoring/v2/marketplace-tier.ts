/**
 * IS marketplace authoring tier v2 (STRICT profile) — universal-fold composable
 * runtime validators.
 *
 * HAND-AUTHORED Zod mirror of
 * `schemas/authoring/v2/marketplace-tier.schema.json` (the canonical runtime
 * parser; the JSON Schema is the language-agnostic wire contract). A
 * self-contained COPY of the v1 marketplace-tier Zod foundation with THREE fold
 * tightenings — it has ZERO import from the v1 validators (copy-then-tighten),
 * mirroring the schema family's zero-`$ref`-into-v1 rule. v1 stays BYTE-FROZEN at
 * `@intentsolutions/core@0.4.1`.
 *
 * The three universal folds (uniform across contracts, per DR-044 D7):
 *
 *   - deprecationRegistry (tactical)               — carried byte-identical from v1
 *   - securityChecks      (CISO-driven, immutable) — v2 ADDS 2 conjuncts:
 *       • name: reject lowercase-substring `claude`/`anthropic` (stricter than the
 *         v1 exact-word enum — catches `claude-reflect`, `anthropic-tool`, …)
 *       • description: reject `$(` and backtick shell-substitution in addition to
 *         `${` and XML tags
 *   - disclosureMarkers   (Karpathy-axis)          — v2 TIGHTENS the description
 *       token budget from 1536 to 1024 chars
 *
 * Canonical predicate:
 *   valid_universalFolds_v2(a) := deprecationRegistry(a) ∧ securityChecks_v2(a)
 *                                 ∧ disclosureMarkers_v2(a)
 *
 * securityChecks_v2 ⊇ securityChecks_v1 (add-only within v2). The folds are
 * intentionally open-world — `allOf` composition requires each branch to tolerate
 * fields the other branches add. Closed-world checks belong in the per-contract
 * schemas. DR-049 + the CCP kernel-shadow finding.
 */

import { z } from 'zod';

/** An authoring artifact's parsed frontmatter/manifest object. */
export type AuthoringArtifact = Record<string, unknown>;

/** A single fold finding: a human-readable message plus the offending path. */
export interface FoldIssue {
  readonly message: string;
  readonly path: readonly string[];
}

// ─── Universal-fold constants (the spec surface; mirror the v2 JSON Schema) ───

/** deprecationRegistry — deprecated field → replacement field migrations (carried from v1). */
export const IS_MARKETPLACE_DEPRECATED_FIELDS: Readonly<Record<string, string>> = {
  'compatible-with': 'compatibility',
  when_to_use: 'description',
};

/** securityChecks — names that must not be used (exact reserved words; carried from v1). */
export const IS_MARKETPLACE_RESERVED_NAMES = [
  'skill',
  'claude',
  'anthropic',
  'mcp',
  'plugin',
  'agent',
] as const;

/**
 * securityChecks v2 — substrings that must not appear (case-insensitively) in a
 * `name`. Stricter than the exact-word enum above: a name whose lowercase
 * CONTAINS one of these is rejected (catches `claude-reflect`, `my-anthropic-x`),
 * matching the CCP prose validator (validate-skills-schema.py L1706).
 */
export const IS_MARKETPLACE_RESERVED_NAME_SUBSTRINGS = ['claude', 'anthropic'] as const;

/** disclosureMarkers — token-budget ceiling for `description` (v2: lowered to 1024). */
export const SKILL_DESCRIPTION_MAX = 1024;

// ─── requiredFields — parameterizable per-contract helper (D7) ──────────────

/**
 * Required-field presence check, parameterized by the contract's own required
 * set. Returns one issue per missing field, in declaration order.
 */
export function requiredFieldsIssues(
  artifact: AuthoringArtifact,
  requiredFields: readonly string[],
): FoldIssue[] {
  const issues: FoldIssue[] = [];
  for (const field of requiredFields) {
    if (!(field in artifact)) {
      issues.push({ message: `missing required field "${field}"`, path: [field] });
    }
  }
  return issues;
}

// ─── Universal-fold checkers (pure; independently testable) ─────────────────

/** UNIVERSAL FOLD 1/3 — a present deprecated key fails; the message names the replacement. */
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

/**
 * UNIVERSAL FOLD 2/3 — v2 STRICT reserved-word + XML + shell-substitution
 * hardening. v2 ADDS the lowercase-substring reserved-name check and the
 * `$(`/backtick shell-substitution checks on top of the v1 conjuncts.
 */
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
    const lower = name.toLowerCase();
    for (const substr of IS_MARKETPLACE_RESERVED_NAME_SUBSTRINGS) {
      if (lower.includes(substr)) {
        issues.push({
          message: `name must not contain the reserved word "${substr}"`,
          path: ['name'],
        });
      }
    }
  }
  const description = artifact['description'];
  if (typeof description === 'string') {
    if (/<[^>]+>/.test(description)) {
      issues.push({ message: 'description must not contain XML tags', path: ['description'] });
    }
    if (description.includes('${') || description.includes('$(') || description.includes('`')) {
      issues.push({
        message: 'description must not contain shell-substitution sequences',
        path: ['description'],
      });
    }
  }
  return issues;
}

/** UNIVERSAL FOLD 3/3 — `description` token-budget ceiling (v2: 1024). */
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

/** The universal-folds composition — every universal fold's issues, in fold order. */
export function universalFoldsIssues(artifact: AuthoringArtifact): FoldIssue[] {
  return [
    ...deprecationRegistryIssues(artifact),
    ...securityChecksIssues(artifact),
    ...disclosureMarkersIssues(artifact),
  ];
}

// ─── Zod schemas (wire the pure checkers into the validator surface) ─────────

const AuthoringArtifactSchema = z.record(z.string(), z.unknown());

/** Attach a pure fold checker to the base artifact schema as a Zod refinement. */
export function attach(
  checker: (artifact: AuthoringArtifact) => FoldIssue[],
): z.ZodType<AuthoringArtifact> {
  return AuthoringArtifactSchema.superRefine((data, ctx) => {
    for (const issue of checker(data)) {
      ctx.addIssue({ code: 'custom', message: issue.message, path: [...issue.path] });
    }
  });
}

/** A required-fields Zod schema for a given contract's required set. */
export function makeRequiredFieldsSchema(
  requiredFields: readonly string[],
): z.ZodType<AuthoringArtifact> {
  return attach((artifact) => requiredFieldsIssues(artifact, requiredFields));
}

/** UNIVERSAL FOLD 1/3 schema — deprecation registry. */
export const DeprecationRegistrySchema = attach(deprecationRegistryIssues);

/** UNIVERSAL FOLD 2/3 schema — security checks (v2 STRICT, UNIVERSAL-IMMUTABLE). */
export const SecurityChecksSchema = attach(securityChecksIssues);

/** UNIVERSAL FOLD 3/3 schema — disclosure markers (v2: 1024 budget). */
export const DisclosureMarkersSchema = attach(disclosureMarkersIssues);

/** The universal-folds composition schema — the three v2 universal folds. */
export const UniversalFoldsSchema = attach(universalFoldsIssues);
