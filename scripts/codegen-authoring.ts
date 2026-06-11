#!/usr/bin/env -S node --experimental-strip-types
/**
 * codegen-authoring.ts — the SINGLE-SOURCE authoring codegen (DR-044 D8 / SAK
 * directive ID-2).
 *
 * The Spec Authority Kernel (SAK) authoring family is a base+overlay JSON-Schema
 * composition: each per-contract contract is three artifacts —
 *
 *   schemas/authoring/v1/upstream-base/<contract>.v1.json   (authored by THEM)
 *   schemas/authoring/v1/marketplace-tier.schema.json#/$defs/universalFolds
 *   schemas/authoring/v1/is-overlay/<contract>.v1.json      (authored by US)
 *   ⇒ schemas/authoring/v1/<contract>.schema.json           (pure allOf)
 *
 * Per DR-044 D8 the Zod validator AND the D7 inline `$comment` effective-required
 * manifest are GENERATED from those JSON Schemas — never hand-typed. Contract #1
 * (skill-frontmatter) was the GRANDFATHERED hand-authored walking skeleton (D8
 * makes single-source codegen a hard precondition of contract #2, not #1). This
 * script promotes the walking skeleton to generated output and is the codegen the
 * remaining five contracts (plugin-manifest, agent-definition, mcp-config,
 * hook-config, marketplace-catalog) ride for free.
 *
 * What it emits, per contract C (read from the base + overlay JSON Schemas):
 *
 *   (a) src/validators/v1/authoring/<C>.ts — the FoldIssue[] Zod validator:
 *       the upstreamBase / isOverlay layer checkers + the allOf composition,
 *       generated field-by-field from the schema `required` arrays + the
 *       per-field `type` / `maxLength` / `pattern` / `items` constraints + the
 *       optional IS-overlay extension fields. Reuses the marketplace-tier
 *       universal-folds foundation by reference (it is itself generated-stable;
 *       this codegen does not regenerate the foundation).
 *
 *   (b) the inline `$comment` EFFECTIVE-REQUIRED MANIFEST in the published
 *       schemas/authoring/v1/<C>.schema.json — one "REQUIRED HERE / INHERITED"
 *       row per effective-required field, derived from base.required ∪
 *       overlay.required (D7(e): "what does this contract require?" answered from
 *       one file). The block between the two sentinel markers is replaced
 *       in-place; the rest of the schema file is untouched.
 *
 * ── Why this lives in `scripts/`, not `src/` ──
 *
 * It is a build-time tool (reads node:fs, writes generated files). Everything it
 * EMITS lands under `src/validators/v1/authoring/` and obeys the kernel boundary
 * rules (validators import only zod). The script itself is excluded from the
 * published package and from the `src/` boundary checks.
 *
 * ── Determinism / CI ──
 *
 * Idempotent: same schemas in ⇒ byte-identical output. `--check` re-generates to
 * memory and diffs against the committed files, exiting non-zero on any drift
 * (the stale-codegen CI gate). `--write` (default) writes the files.
 *
 * Usage:
 *   node --experimental-strip-types scripts/codegen-authoring.ts          # write
 *   node --experimental-strip-types scripts/codegen-authoring.ts --check  # verify
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');
const AUTHORING_DIR = join(REPO_ROOT, 'schemas/authoring/v1');
const VALIDATORS_DIR = join(REPO_ROOT, 'src/validators/v1/authoring');

// ─── JSON-Schema subset we read (the authoring base/overlay shape) ───────────

interface FieldSchema {
  readonly $comment?: string;
  readonly type?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly items?: FieldSchema;
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, FieldSchema>>;
}

interface LayerSchema {
  readonly $id: string;
  readonly title: string;
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, FieldSchema>>;
}

/** One per-contract codegen unit. */
interface ContractSpec {
  /** kebab-case contract name (= file basenames). */
  readonly name: string;
  /** UpperCamel symbol prefix (e.g. `SkillFrontmatter`). */
  readonly symbol: string;
  /** SCREAMING_SNAKE prefix for the required-field-set constants (e.g. `SKILL_FRONTMATTER`). */
  readonly constPrefix: string;
  /**
   * Shorter SCREAMING_SNAKE prefix for the per-field constraint constants
   * (e.g. `SKILL` ⇒ `SKILL_NAME_PATTERN`, `SKILL_COMPATIBILITY_MAX`). Keeps the
   * public exported-constant surface stable across the hand-authored → generated
   * promotion.
   */
  readonly fieldConstPrefix: string;
}

/** The authoring contracts this codegen owns. skill-frontmatter is contract #1. */
const CONTRACTS: readonly ContractSpec[] = [
  {
    name: 'skill-frontmatter',
    symbol: 'SkillFrontmatter',
    constPrefix: 'SKILL_FRONTMATTER',
    fieldConstPrefix: 'SKILL',
  },
];

// ─── Schema IO ───────────────────────────────────────────────────────────────

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function baseSchema(contract: string): LayerSchema {
  return loadJson<LayerSchema>(join(AUTHORING_DIR, 'upstream-base', `${contract}.v1.json`));
}
function overlaySchema(contract: string): LayerSchema {
  return loadJson<LayerSchema>(join(AUTHORING_DIR, 'is-overlay', `${contract}.v1.json`));
}

// ─── (b) Effective-required manifest ($comment block) ────────────────────────

const MANIFEST_HEAD = 'EFFECTIVE-REQUIRED MANIFEST';

/**
 * Build the REQUIRED HERE / INHERITED manifest rows from the two `required`
 * arrays. A base-required field is INHERITED (the upstream standardFloor); an
 * overlay-required field is REQUIRED HERE (promoted or net-new IS).
 */
function manifestRows(base: LayerSchema, overlay: LayerSchema): string[] {
  const baseReq = base.required ?? [];
  const overlayReq = overlay.required ?? [];
  const overlayProps = overlay.properties ?? {};
  const baseProps = base.properties ?? {};
  const width = Math.max(...[...baseReq, ...overlayReq].map((f) => f.length));

  // Field column padded to `maxWidth`, then 2 spaces, then the status keyword.
  // INHERITED is followed by 3 spaces, REQUIRED HERE by 1 — the two groups'
  // provenance columns are independently spaced (matching the D7 manifest).
  const rows: string[] = [];
  for (const field of baseReq) {
    rows.push(`${field.padEnd(width)}  INHERITED   ${provenance(field, baseProps, 'base')}`);
  }
  for (const field of overlayReq) {
    rows.push(
      `${field.padEnd(width)}  REQUIRED HERE ${provenance(field, overlayProps, 'overlay')}`,
    );
  }
  return rows;
}

/**
 * Human-readable provenance suffix for a manifest row, derived from whether the
 * field also exists in the base (promotion) vs is net-new in the overlay.
 */
function provenance(
  field: string,
  props: Readonly<Record<string, FieldSchema>>,
  layer: 'base' | 'overlay',
): string {
  if (layer === 'base') {
    return '(upstream-base · agentskills.io standardFloor)';
  }
  // Overlay row: classify from the field's own $comment provenance keywords.
  const comment = props[field]?.$comment ?? '';
  if (/promoted/i.test(comment)) {
    return '(is-overlay · promoted from upstream-optional)';
  }
  if (/ZERO upstream provenance|pure IS invention/i.test(comment)) {
    return '(is-overlay · pure IS invention, zero upstream provenance)';
  }
  return '(is-overlay · net-new IS tracking field)';
}

/**
 * Regenerate the `$comment` of the published <contract>.schema.json so its
 * EFFECTIVE-REQUIRED MANIFEST block matches the current base+overlay required
 * arrays. Only the manifest block (head sentence → "Effective required") is
 * regenerated; the surrounding prose is preserved verbatim.
 */
function renderSchemaComment(existing: string, base: LayerSchema, overlay: LayerSchema): string {
  const rows = manifestRows(base, overlay).map((r) => `  ${r}`);
  const head = existing.slice(0, existing.indexOf(MANIFEST_HEAD) + MANIFEST_HEAD.length);
  const tailIdx = existing.indexOf('Effective required');
  const tail = existing.slice(tailIdx);
  return `${head} (the answer to 'what does ${base.title.split(' —')[0]} require?' from one file — DR-044 D7(e)). This block is the generated effective-required surface; the source of truth is the \`required\` arrays of the two composed layers below.\n${rows.join('\n')}\n${tail}`;
}

function regenerateSchemaManifest(contract: string, check: boolean): boolean {
  const path = join(AUTHORING_DIR, `${contract}.schema.json`);
  const raw = readFileSync(path, 'utf-8');
  const schema = JSON.parse(raw) as { $comment: string };
  const base = baseSchema(contract);
  const overlay = overlaySchema(contract);
  const nextComment = renderSchemaComment(schema.$comment, base, overlay);
  if (nextComment === schema.$comment) {
    return true;
  }
  if (check) {
    process.stderr.write(`DRIFT: ${relative(REPO_ROOT, path)} $comment manifest is stale\n`);
    return false;
  }
  schema.$comment = nextComment;
  writeFileSync(path, `${JSON.stringify(schema, null, 2)}\n`);
  process.stdout.write(`wrote ${relative(REPO_ROOT, path)} ($comment manifest)\n`);
  return true;
}

// ─── (a) Validator codegen — render the FoldIssue[] layer functions ──────────

const HELPER_FIELDS = new Set([
  'requires_env',
  'requires_tools',
  'fallback_for_env',
  'fallback_for_tools',
]);

/** Render the per-field type/constraint checks for a base-layer field. */
function baseFieldCheck(field: string, schema: FieldSchema, fieldConstPrefix: string): string[] {
  const lines: string[] = [];
  const access = `artifact['${field}']`;
  if (field === 'name') {
    lines.push(
      `  if ('name' in artifact) {`,
      `    const name = artifact['name'];`,
      `    if (typeof name !== 'string') {`,
      `      issues.push({ message: 'name must be a string', path: ['name'] });`,
      `    } else {`,
      `      if (name.length > ${fieldConstPrefix}_NAME_MAX) {`,
      `        issues.push({`,
      `          message: \`name must be at most \${${fieldConstPrefix}_NAME_MAX} characters\`,`,
      `          path: ['name'],`,
      `        });`,
      `      }`,
      `      if (!${fieldConstPrefix}_NAME_PATTERN.test(name)) {`,
      `        issues.push({`,
      `          message: 'name must be kebab-case (lowercase letters, digits, hyphens)',`,
      `          path: ['name'],`,
      `        });`,
      `      }`,
      `    }`,
      `  }`,
    );
    return lines;
  }
  if (field === 'compatibility') {
    lines.push(
      `  if ('compatibility' in artifact) {`,
      `    const compatibility = artifact['compatibility'];`,
      `    if (typeof compatibility !== 'string') {`,
      `      issues.push({ message: 'compatibility must be a string', path: ['compatibility'] });`,
      `    } else if (compatibility.length > ${fieldConstPrefix}_COMPATIBILITY_MAX) {`,
      `      issues.push({`,
      `        message: \`compatibility must be at most \${${fieldConstPrefix}_COMPATIBILITY_MAX} characters\`,`,
      `        path: ['compatibility'],`,
      `      });`,
      `    }`,
      `  }`,
    );
    return lines;
  }
  if (schema.type === 'object') {
    lines.push(
      `  if ('${field}' in artifact && !isPlainObject(${access})) {`,
      `    issues.push({ message: '${field} must be an object', path: ['${field}'] });`,
      `  }`,
    );
    return lines;
  }
  // Plain scalar-string base field (description, license): type-only check.
  lines.push(
    `  if ('${field}' in artifact && typeof ${access} !== 'string') {`,
    `    issues.push({ message: '${field} must be a string', path: ['${field}'] });`,
    `  }`,
  );
  return lines;
}

/** Render the per-field narrowing checks for an overlay-layer field. */
function overlayFieldCheck(field: string, schema: FieldSchema): string[] {
  const lines: string[] = [];
  const access = `artifact['${field}']`;
  if (schema.type === 'array' && schema.items?.type === 'string') {
    lines.push(
      `  if ('${field}' in artifact && !isStringArray(${access})) {`,
      `    issues.push({ message: '${field} must be an array of strings', path: ['${field}'] });`,
      `  }`,
    );
    return lines;
  }
  if (field === 'version') {
    lines.push(
      `  if ('version' in artifact) {`,
      `    const version = artifact['version'];`,
      `    if (typeof version !== 'string') {`,
      `      issues.push({ message: 'version must be a string', path: ['version'] });`,
      `    } else if (!SEMVER_PATTERN.test(version)) {`,
      `      issues.push({ message: 'version must be strict SemVer 2.0.0', path: ['version'] });`,
      `    }`,
      `  }`,
    );
    return lines;
  }
  // Plain scalar-string overlay field (author): type-only check (license/
  // compatibility are typed by the base; their presence is the required check).
  lines.push(
    `  if ('${field}' in artifact && typeof ${access} !== 'string') {`,
    `    issues.push({ message: '${field} must be a string', path: ['${field}'] });`,
    `  }`,
  );
  return lines;
}

/**
 * Render the full per-contract validator module. The structure mirrors the
 * walking-skeleton hand-authored shape exactly, but every field check is
 * emitted from the JSON Schema (not hand-typed).
 */
function renderValidator(spec: ContractSpec, base: LayerSchema, overlay: LayerSchema): string {
  const { symbol, constPrefix, fieldConstPrefix } = spec;
  const baseReq = base.required ?? [];
  const overlayReq = overlay.required ?? [];
  const baseProps = base.properties ?? {};
  const overlayProps = overlay.properties ?? {};

  // Base-layer checks: required fields first carry their type/constraint checks,
  // then any base-optional typed field (e.g. metadata) that the base declares.
  // Mirror the hand-authored order: name, description, license, compatibility,
  // metadata.
  const baseCheckOrder = ['name', 'description', 'license', 'compatibility', 'metadata'].filter(
    (f) => f in baseProps,
  );
  const baseChecks = baseCheckOrder
    .map((f) => baseFieldCheck(f, baseProps[f] ?? {}, fieldConstPrefix).join('\n'))
    .join('\n\n');

  // Overlay-layer checks: the typed required fields in declaration order
  // (allowed-tools, version, author, tags), then the visibility arrays loop,
  // then required_environment_variables.
  const overlayCheckOrder = ['allowed-tools', 'version', 'author', 'tags'].filter(
    (f) => f in overlayProps,
  );
  const overlayChecks = overlayCheckOrder
    .map((f) => overlayFieldCheck(f, overlayProps[f] ?? {}).join('\n'))
    .join('\n\n');

  return `/**
 * ${spec.name} — IS marketplace-tier authoring contract #1 (the walking skeleton).
 *
 * GENERATED by scripts/codegen-authoring.ts from the three-artifact composition:
 *   schemas/authoring/v1/upstream-base/${spec.name}.v1.json   (authored by THEM)
 *   schemas/authoring/v1/marketplace-tier.schema.json#/$defs/universalFolds
 *   schemas/authoring/v1/is-overlay/${spec.name}.v1.json      (authored by US)
 *   ⇒ schemas/authoring/v1/${spec.name}.schema.json           (pure allOf)
 *
 * DO NOT EDIT BY HAND — re-run \`pnpm run codegen:authoring\` after a schema edit.
 * Per DR-044 D8 the Zod validator AND the D7 inline \`$comment\` effective-required
 * manifest are single-sourced from the JSON Schema: the two layers below are
 * derived field-by-field from the base and overlay \`required\` arrays + the
 * per-field type/constraint surface; the universal folds are reused by reference
 * from marketplace-tier. The monotonic-additive invariant (the overlay only ADDS
 * required fields and NARROWS constraints on the base) is the 2026-04-28-debacle
 * guard, asserted by the property test in
 * src/__tests__/${spec.name}-schema.test.ts.
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
export const ${constPrefix}_BASE_REQUIRED = [${baseReq.map((f) => `'${f}'`).join(', ')}] as const;

/** The IS-overlay required delta (beyond the base floor). */
export const ${constPrefix}_OVERLAY_REQUIRED = [
${overlayReq.map((f) => `  '${f}',`).join('\n')}
] as const;

/** Effective required = base ∪ overlay = the IS 8-field marketplace set (NON-NEGOTIABLE). */
export const ${constPrefix}_REQUIRED_FIELDS = [
  ...${constPrefix}_BASE_REQUIRED,
  ...${constPrefix}_OVERLAY_REQUIRED,
] as const;

// ─── Constraint constants (mirror the JSON Schemas exactly) ──────────────────

/** agentskills.io kebab-case name surface (upstream-base). */
export const ${fieldConstPrefix}_NAME_PATTERN = ${jsRegexLiteral(baseProps['name']?.pattern)};
/** agentskills.io name length ceiling (upstream-base). */
export const ${fieldConstPrefix}_NAME_MAX = ${baseProps['name']?.maxLength ?? 64};
/** agentskills.io compatibility length ceiling (upstream-base). */
export const ${fieldConstPrefix}_COMPATIBILITY_MAX = ${baseProps['compatibility']?.maxLength ?? 500};
/** Strict SemVer 2.0.0 (is-overlay — stricter than the legacy IS prefix match). */
export const SEMVER_PATTERN =
  ${jsRegexLiteral(overlayProps['version']?.pattern)};
/** UPPER_SNAKE_CASE env-var names (is-overlay optional extra). */
export const ENV_VAR_NAME_PATTERN = ${jsRegexLiteral(
    overlayProps['required_environment_variables']?.items?.properties?.['name']?.pattern,
  )};

/** The optional IS visibility arrays (is-overlay) — each is an array of strings. */
const VISIBILITY_ARRAY_FIELDS = [
${[...HELPER_FIELDS]
  .filter((f) => f in overlayProps)
  .map((f) => `  '${f}',`)
  .join('\n')}
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
 * \`description\` is intentionally NOT capped here — the universal disclosureMarkers
 * fold (1536) is the operative cap (encoding the agentskills.io 1024 soft cap
 * would violate the monotonic-additive invariant against the IS 1536 tier).
 */
export function upstreamBaseIssues(artifact: AuthoringArtifact): FoldIssue[] {
  const issues: FoldIssue[] = [...requiredFieldsIssues(artifact, ${constPrefix}_BASE_REQUIRED)];

${baseChecks}

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
    ...requiredFieldsIssues(artifact, ${constPrefix}_OVERLAY_REQUIRED),
  ];

${overlayChecks}

  for (const field of VISIBILITY_ARRAY_FIELDS) {
    if (field in artifact && !isStringArray(artifact[field])) {
      issues.push({ message: \`\${field} must be an array of strings\`, path: [field] });
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
export function ${lowerFirst(symbol)}Issues(artifact: AuthoringArtifact): FoldIssue[] {
  return [
    ...upstreamBaseIssues(artifact),
    ...universalFoldsIssues(artifact),
    ...isOverlayIssues(artifact),
  ];
}

/** The ${spec.name} contract — pure allOf composition (base ∧ universalFolds ∧ overlay). */
export const ${symbol}Schema = attach(${lowerFirst(symbol)}Issues);

export type ${symbol} = AuthoringArtifact;
`;
}

/** Render a JS RegExp literal from a JSON-Schema `pattern` string. */
function jsRegexLiteral(pattern: string | undefined): string {
  if (pattern === undefined) {
    throw new Error('codegen: expected a `pattern` on a regex-constrained field');
  }
  // JSON-Schema patterns are ECMA-262 source already; wrap in `/.../`.
  return `/${pattern}/`;
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function regenerateValidator(spec: ContractSpec, check: boolean): boolean {
  const path = join(VALIDATORS_DIR, `${spec.name}.ts`);
  const base = baseSchema(spec.name);
  const overlay = overlaySchema(spec.name);
  const next = renderValidator(spec, base, overlay);
  const existing = (() => {
    try {
      return readFileSync(path, 'utf-8');
    } catch {
      return '';
    }
  })();
  if (next === existing) {
    return true;
  }
  if (check) {
    process.stderr.write(`DRIFT: ${relative(REPO_ROOT, path)} validator is stale\n`);
    return false;
  }
  writeFileSync(path, next);
  process.stdout.write(`wrote ${relative(REPO_ROOT, path)} (validator)\n`);
  return true;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

function main(): void {
  const check = process.argv.includes('--check');
  let ok = true;
  for (const spec of CONTRACTS) {
    ok = regenerateValidator(spec, check) && ok;
    ok = regenerateSchemaManifest(spec.name, check) && ok;
  }
  if (!ok) {
    if (check) {
      process.stderr.write(
        '\ncodegen-authoring --check FAILED: generated output is stale.\n' +
          'Run `pnpm run codegen:authoring` and commit the result.\n',
      );
    }
    process.exit(1);
  }
  if (check) {
    process.stdout.write('codegen-authoring --check: generated output is up to date.\n');
  }
}

main();
