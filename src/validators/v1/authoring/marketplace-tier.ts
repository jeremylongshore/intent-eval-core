/**
 * IS marketplace authoring tier — universal-fold composable runtime validators.
 *
 * Hand-authored Zod mirror of
 * `schemas/authoring/v1/marketplace-tier.schema.json` (the canonical runtime
 * parser; the JSON Schema is the language-agnostic wire contract). The shared
 * foundation that every per-contract authoring schema (skill-frontmatter,
 * plugin-manifest, agent-definition, mcp-config, hook-config,
 * marketplace-catalog) inherits BY REFERENCE.
 *
 * Per ISEDC Session 8 charter DR-044 decision D7
 * (intent-eval-lab/000-docs/044-AT-DECR-isedc-council-session-8-sak-charter-2026-06-09.md),
 * the marketplace tier is decomposed so the THREE universal folds are uniform
 * across all six contracts, while `requiredFields` is specialized PER CONTRACT:
 *
 *   - deprecationRegistry (tactical — autonomous validator patch)
 *   - securityChecks      (CISO-driven — UNIVERSAL-IMMUTABLE: add-only, never overridable)
 *   - disclosureMarkers   (Karpathy-axis — token budget)
 *
 * Canonical predicate:
 *   valid_universalFolds(a) := deprecationRegistry(a) ∧ securityChecks(a)
 *                              ∧ disclosureMarkers(a)
 *
 * `requiredFields` is NO LONGER part of this foundation — it was removed in the
 * D7 refactor and now lives in each per-contract schema. This module instead
 * exposes a parameterizable `requiredFieldsIssues(artifact, fields)` helper that
 * each contract calls with its own required-field list.
 *
 * The folds are intentionally open-world — `allOf` composition requires each
 * branch to tolerate fields the other branches add. Closed-world checks belong
 * in the per-contract schemas that apply this foundation.
 */

import { z } from 'zod';

/** An authoring artifact's parsed frontmatter/manifest object. */
export type AuthoringArtifact = Record<string, unknown>;

/** A single fold finding: a human-readable message plus the offending path. */
export interface FoldIssue {
  readonly message: string;
  readonly path: readonly string[];
}

// ─── Universal-fold constants (the spec surface; mirror the JSON Schema) ─────

/** deprecationRegistry — deprecated field → replacement field migrations. */
export const IS_MARKETPLACE_DEPRECATED_FIELDS: Readonly<Record<string, string>> = {
  'compatible-with': 'compatibility',
  when_to_use: 'description',
};

/** securityChecks — names that must not be used (reserved words). */
export const IS_MARKETPLACE_RESERVED_NAMES = [
  'skill',
  'claude',
  'anthropic',
  'mcp',
  'plugin',
  'agent',
] as const;

/** disclosureMarkers — token-budget ceiling for `description`. */
export const SKILL_DESCRIPTION_MAX = 1536;

// ─── requiredFields — parameterizable per-contract helper (D7) ──────────────

/**
 * Required-field presence check, parameterized by the contract's own required
 * set. `requiredFields` moved out of the foundation in the D7 refactor; each
 * per-contract schema supplies its own list (a plugin-manifest's set is not a
 * skill's). Returns one issue per missing field, in declaration order.
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

/** UNIVERSAL FOLD 2/3 — UNIVERSAL-IMMUTABLE reserved-word + XML + shell-substitution hardening. */
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

/** UNIVERSAL FOLD 3/3 — `description` token-budget ceiling. */
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

/** UNIVERSAL FOLD 2/3 schema — security checks (UNIVERSAL-IMMUTABLE). */
export const SecurityChecksSchema = attach(securityChecksIssues);

/** UNIVERSAL FOLD 3/3 schema — disclosure markers. */
export const DisclosureMarkersSchema = attach(disclosureMarkersIssues);

/** The universal-folds composition schema — the three universal folds. */
export const UniversalFoldsSchema = attach(universalFoldsIssues);
