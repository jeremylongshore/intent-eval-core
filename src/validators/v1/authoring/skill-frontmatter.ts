/**
 * skill-frontmatter — IS marketplace-tier authoring contract #1 (the walking skeleton).
 *
 * Hand-authored Zod mirror of the three-artifact composition:
 *   schemas/authoring/v1/upstream-base/skill-frontmatter.v1.json   (authored by THEM)
 *   schemas/authoring/v1/marketplace-tier.schema.json#/$defs/universalFolds
 *   schemas/authoring/v1/is-overlay/skill-frontmatter.v1.json      (authored by US)
 *   ⇒ schemas/authoring/v1/skill-frontmatter.schema.json           (pure allOf)
 *
 * This is contract #1 — GRANDFATHERED hand-authored per DR-044 D8 (single-source
 * codegen is a hard precondition of contract #2, not #1). The two layers below
 * mirror the base and overlay exactly; the universal folds are reused by
 * reference from marketplace-tier. The monotonic-additive invariant (the overlay
 * only ADDS required fields and NARROWS constraints on the base) is the
 * 2026-04-28-debacle guard, asserted by the property test in
 * src/__tests__/skill-frontmatter-schema.test.ts.
 */

import {
  type AuthoringArtifact,
  type FoldIssue,
  attach,
  requiredFieldsIssues,
  universalFoldsIssues,
} from './marketplace-tier.js';

// ─── Required-field sets (the source of the effective-required manifest) ─────

/** standardFloor — the upstream-base always-required fields (agentskills.io). */
export const SKILL_FRONTMATTER_BASE_REQUIRED = ['name', 'description'] as const;

/** The IS-overlay required delta (beyond the base floor). */
export const SKILL_FRONTMATTER_OVERLAY_REQUIRED = [
  'allowed-tools',
  'version',
  'author',
  'license',
  'compatibility',
  'tags',
] as const;

/** Effective required = base ∪ overlay = the IS 8-field marketplace set (NON-NEGOTIABLE). */
export const SKILL_FRONTMATTER_REQUIRED_FIELDS = [
  ...SKILL_FRONTMATTER_BASE_REQUIRED,
  ...SKILL_FRONTMATTER_OVERLAY_REQUIRED,
] as const;

// ─── Constraint constants (mirror the JSON Schemas exactly) ──────────────────

/** agentskills.io kebab-case name surface (upstream-base). */
export const SKILL_NAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
/** agentskills.io name length ceiling (upstream-base). */
export const SKILL_NAME_MAX = 64;
/** agentskills.io compatibility length ceiling (upstream-base). */
export const SKILL_COMPATIBILITY_MAX = 500;
/** Strict SemVer 2.0.0 (is-overlay — stricter than the legacy IS prefix match). */
export const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
/** UPPER_SNAKE_CASE env-var names (is-overlay optional extra). */
export const ENV_VAR_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/** The optional IS visibility arrays (is-overlay) — each is an array of strings. */
const VISIBILITY_ARRAY_FIELDS = [
  'requires_env',
  'requires_tools',
  'fallback_for_env',
  'fallback_for_tools',
] as const;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ─── Layer 1: upstream base (authored by THEM) ───────────────────────────────

/**
 * The agentskills.io + Claude-docs projection. Required presence of the
 * standardFloor + type/format on the upstream-owned fields. Length of
 * `description` is intentionally NOT capped here — the universal disclosureMarkers
 * fold (1536) is the operative cap (encoding the agentskills.io 1024 soft cap
 * would violate the monotonic-additive invariant against the IS 1536 tier).
 */
export function upstreamBaseIssues(artifact: AuthoringArtifact): FoldIssue[] {
  const issues: FoldIssue[] = [...requiredFieldsIssues(artifact, SKILL_FRONTMATTER_BASE_REQUIRED)];

  if ('name' in artifact) {
    const name = artifact['name'];
    if (typeof name !== 'string') {
      issues.push({ message: 'name must be a string', path: ['name'] });
    } else {
      if (name.length > SKILL_NAME_MAX) {
        issues.push({
          message: `name must be at most ${SKILL_NAME_MAX} characters`,
          path: ['name'],
        });
      }
      if (!SKILL_NAME_PATTERN.test(name)) {
        issues.push({
          message: 'name must be kebab-case (lowercase letters, digits, hyphens)',
          path: ['name'],
        });
      }
    }
  }

  if ('description' in artifact && typeof artifact['description'] !== 'string') {
    issues.push({ message: 'description must be a string', path: ['description'] });
  }

  if ('license' in artifact && typeof artifact['license'] !== 'string') {
    issues.push({ message: 'license must be a string', path: ['license'] });
  }

  if ('compatibility' in artifact) {
    const compatibility = artifact['compatibility'];
    if (typeof compatibility !== 'string') {
      issues.push({ message: 'compatibility must be a string', path: ['compatibility'] });
    } else if (compatibility.length > SKILL_COMPATIBILITY_MAX) {
      issues.push({
        message: `compatibility must be at most ${SKILL_COMPATIBILITY_MAX} characters`,
        path: ['compatibility'],
      });
    }
  }

  if ('metadata' in artifact && !isPlainObject(artifact['metadata'])) {
    issues.push({ message: 'metadata must be an object', path: ['metadata'] });
  }

  return issues;
}

// ─── Layer 3: IS overlay (authored by US) ────────────────────────────────────

/**
 * The IS-only delta: overlay-required presence + the type narrowings and the
 * optional IS extension fields. License/compatibility presence is covered by the
 * required check; their types are covered by the base — the overlay does not
 * re-type them, to keep messages single-sourced.
 */
export function isOverlayIssues(artifact: AuthoringArtifact): FoldIssue[] {
  const issues: FoldIssue[] = [
    ...requiredFieldsIssues(artifact, SKILL_FRONTMATTER_OVERLAY_REQUIRED),
  ];

  if ('allowed-tools' in artifact && !isStringArray(artifact['allowed-tools'])) {
    issues.push({ message: 'allowed-tools must be an array of strings', path: ['allowed-tools'] });
  }

  if ('version' in artifact) {
    const version = artifact['version'];
    if (typeof version !== 'string') {
      issues.push({ message: 'version must be a string', path: ['version'] });
    } else if (!SEMVER_PATTERN.test(version)) {
      issues.push({ message: 'version must be strict SemVer 2.0.0', path: ['version'] });
    }
  }

  if ('author' in artifact && typeof artifact['author'] !== 'string') {
    issues.push({ message: 'author must be a string', path: ['author'] });
  }

  if ('tags' in artifact && !isStringArray(artifact['tags'])) {
    issues.push({ message: 'tags must be an array of strings', path: ['tags'] });
  }

  for (const field of VISIBILITY_ARRAY_FIELDS) {
    if (field in artifact && !isStringArray(artifact[field])) {
      issues.push({ message: `${field} must be an array of strings`, path: [field] });
    }
  }

  if ('required_environment_variables' in artifact) {
    issues.push(...requiredEnvVarIssues(artifact['required_environment_variables']));
  }

  return issues;
}

function requiredEnvVarIssues(value: unknown): FoldIssue[] {
  const path = ['required_environment_variables'];
  if (!Array.isArray(value)) {
    return [{ message: 'required_environment_variables must be an array', path }];
  }
  const issues: FoldIssue[] = [];
  value.forEach((entry, index) => {
    const entryPath = [...path, String(index)];
    if (!isPlainObject(entry)) {
      issues.push({
        message: 'required_environment_variables entry must be an object',
        path: entryPath,
      });
      return;
    }
    const name = entry['name'];
    if (typeof name !== 'string' || !ENV_VAR_NAME_PATTERN.test(name)) {
      issues.push({
        message: 'env-var name must be UPPER_SNAKE_CASE',
        path: [...entryPath, 'name'],
      });
    }
    if (typeof entry['prompt'] !== 'string') {
      issues.push({ message: 'env-var prompt is required', path: [...entryPath, 'prompt'] });
    }
  });
  return issues;
}

// ─── The composition (allOf of base + universal folds + overlay) ─────────────

/** Every issue from the three composed layers, in layer order. */
export function skillFrontmatterIssues(artifact: AuthoringArtifact): FoldIssue[] {
  return [
    ...upstreamBaseIssues(artifact),
    ...universalFoldsIssues(artifact),
    ...isOverlayIssues(artifact),
  ];
}

/** The skill-frontmatter contract — pure allOf composition (base ∧ universalFolds ∧ overlay). */
export const SkillFrontmatterSchema = attach(skillFrontmatterIssues);

export type SkillFrontmatter = AuthoringArtifact;
