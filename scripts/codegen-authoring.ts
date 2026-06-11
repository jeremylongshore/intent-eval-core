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
 * hook-config, marketplace-catalog) ride for free. plugin-manifest is contract
 * #2 — the FIRST contract that MUST be codegen-generated.
 *
 * What it emits, per contract C (read from the base + overlay JSON Schemas):
 *
 *   (a) src/validators/v1/authoring/<C>.ts — the FoldIssue[] Zod validator:
 *       the upstreamBase / isOverlay layer checkers + the allOf composition,
 *       generated field-by-field from the schema `required` arrays + the
 *       per-field `type` / `minLength` / `maxLength` / `pattern` / `format` /
 *       `items` / nested-`required` constraints + the optional IS-overlay
 *       extension fields. The per-field check is dispatched off JSON-Schema
 *       keywords (NOT off hardcoded field names), so a new contract whose fields
 *       differ (plugin-manifest's object `author`, URI `homepage`, array
 *       `keywords`) generates correctly with no per-field special-casing. Reuses
 *       the marketplace-tier universal-folds foundation by reference (it is
 *       itself generated-stable; this codegen does not regenerate the foundation).
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

/**
 * Authoring family — a versioned, frozen-aware addressing of the schema +
 * validator trees. `v1` is the original (now BYTE-FROZEN at
 * @intentsolutions/core@0.4.1) family; `v2` is the STRICT IS-marketplace fork
 * (DR-049). A typed union (not a free string) so a path is never concatenated
 * from an untyped value — the write-guard below refuses to emit into a frozen
 * tree, so a v2 typo can never mutate a v1 file.
 */
type AuthoringVersion = 'v1' | 'v2';

/** The schemas/authoring/<version> directory for a family. */
function authoringDir(version: AuthoringVersion): string {
  return join(REPO_ROOT, 'schemas/authoring', version);
}

/**
 * The validator output directory for a family. v1 emits at the canonical
 * `src/validators/v1/authoring`; v2 emits at the chamber-version subdir
 * `src/validators/v1/authoring/v2` (the package's runtime `schemas/v1` chamber
 * does not move — only the authoring chamber advances its internal family
 * pointer, per DR-049 D-SAK-1 per-chamber $schemaVersion).
 */
function validatorsDir(version: AuthoringVersion): string {
  const base = join(REPO_ROOT, 'src/validators/v1/authoring');
  return version === 'v1' ? base : join(base, version);
}

/**
 * The is-overlay filename suffix per family. v1 overlays are `<contract>.v1.json`;
 * the v2 skill-frontmatter overlay is `<contract>.v2.json` (it carries the
 * scoped-Bash narrowing — a distinct file from the frozen v1 overlay). The
 * upstream-base filename stays `<contract>.v1.json` in BOTH families (the v2 base
 * is a byte-copy of the v1 base modulo `$id` — same upstream projection).
 */
function overlayFileSuffix(version: AuthoringVersion): string {
  return version === 'v1' ? 'v1' : 'v2';
}

/**
 * The frozen trees the codegen must NEVER write into. Any attempt to write a path
 * inside one of these is a bug (a v2 family misrouting into v1); the write-guard
 * throws rather than mutating a byte-frozen file.
 */
const FROZEN_WRITE_PREFIXES: readonly string[] = [join(REPO_ROOT, 'schemas/authoring/v1') + '/'];

// ─── JSON-Schema subset we read (the authoring base/overlay shape) ───────────

interface FieldSchema {
  readonly $comment?: string;
  readonly type?: string;
  readonly format?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minimum?: number;
  readonly minItems?: number;
  readonly pattern?: string;
  readonly enum?: readonly string[];
  readonly items?: FieldSchema;
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, FieldSchema>>;
  /**
   * A union of accepted sub-schemas. The codegen recognizes exactly one anyOf
   * shape today (feature-gated by `isStringOrStringArrayAnyOf`): the
   * string | array-of-strings union that the overlay's `allowed-tools` uses to
   * accept BOTH the upstream CSV/space-delimited string form AND the YAML array
   * form (v0.4.1 non-breaking relaxation). Any other anyOf shape is left
   * unrecognized so it cannot silently mis-generate.
   */
  readonly anyOf?: readonly FieldSchema[];
  /**
   * An `allOf` intersection of sub-schemas. The codegen recognizes exactly one
   * allOf shape today (feature-gated by `isScopedToolAllOf`): the STRICT v2
   * `allowed-tools` narrowing = the v1 string|array union (a nested anyOf member)
   * AND the scoped-tool reject members (string-form negative pattern + array-form
   * not-contains-const). Any other allOf shape is left unrecognized so it cannot
   * silently mis-generate.
   */
  readonly allOf?: readonly FieldSchema[];
  /**
   * Vendor annotation (v2): the bare tool token this field narrows to a scoped
   * form (e.g. `"Bash"` ⇒ a bare `Bash` is rejected, only `Bash(scope:*)` is
   * accepted). Drives the codegen's scoped-tool Zod emit + records the carve-out
   * token. Structurally enforced in the JSON Schema too (NOT a Zod-only carve-out,
   * unlike kyh9) — the negative pattern + not-contains-const are ECMA-262 / ajv
   * expressible (proven). The annotation just names the token for the codegen.
   */
  readonly 'x-scoped-tool'?: string;
  readonly const?: string;
  readonly contains?: FieldSchema;
  readonly not?: FieldSchema;
}

/**
 * A declared per-variable mutual-exclusion between two (or more) array fields:
 * no element may appear in more than one of `fields`. Read from the overlay
 * schema's `x-mutually-exclusive-fields` annotation. This is an
 * array-element-disjointness predicate that vanilla JSON Schema cannot express,
 * so the codegen emits it into the Zod runtime layer as a DOCUMENTED CARVE-OUT
 * (kyh9 / CTO ruling) — the published JSON Schema does not mirror it.
 */
interface MutualExclusion {
  readonly fields: readonly string[];
  readonly $comment?: string;
}

interface LayerSchema {
  readonly $id: string;
  readonly title: string;
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, FieldSchema>>;
  readonly 'x-mutually-exclusive-fields'?: readonly MutualExclusion[];
}

/** One per-contract codegen unit. */
interface ContractSpec {
  /**
   * Authoring family this spec belongs to. Defaults conceptually to `v1` (the
   * six original contracts); a `v2` spec emits into the STRICT v2 fork tree. The
   * field parameterizes the schema-dir / validator-dir / overlay-file resolution
   * so the SAME keyword-driven codegen emits both families with no per-rule
   * branching.
   */
  readonly version: AuthoringVersion;
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
  /** 1-based position in the authoring-contract sequence (drives the header prose). */
  readonly contractIndex: number;
  /** Short descriptor appended to the module header after the contract number. */
  readonly headerSuffix: string;
  /**
   * Provenance word used in the upstream-base constant doc-comments (e.g.
   * `agentskills.io` for the skill standard, `code.claude.com plugins-reference`
   * for the plugin manifest). Keeps each generated module's constant comments
   * truthful about which upstream it projects.
   */
  readonly baseProvenance: string;
  /**
   * The inner body of the `upstreamBaseIssues` function's doc-comment — the lines
   * inside the doc-comment, each `* `-prefixed. Contract-specific provenance
   * prose, single-sourced here so the generated module is truthful per contract.
   */
  readonly baseDoc: string;
  /** The inner body of the `isOverlayIssues` function's doc-comment. */
  readonly overlayDoc: string;
}

/**
 * The authoring contracts this codegen owns. skill-frontmatter is contract #1
 * (the grandfathered walking skeleton); plugin-manifest is contract #2 (the
 * first MUST-be-generated contract — DR-044 D8).
 */
const CONTRACTS: readonly ContractSpec[] = [
  {
    version: 'v1',
    name: 'skill-frontmatter',
    symbol: 'SkillFrontmatter',
    constPrefix: 'SKILL_FRONTMATTER',
    fieldConstPrefix: 'SKILL',
    contractIndex: 1,
    headerSuffix: 'the walking skeleton',
    baseProvenance: 'agentskills.io',
    baseDoc:
      ' * The agentskills.io + Claude-docs projection. Required presence of the\n' +
      ' * standardFloor + type/format on the upstream-owned fields. Length of\n' +
      ' * `description` is intentionally NOT capped here — the universal disclosureMarkers\n' +
      ' * fold (1536) is the operative cap (encoding the agentskills.io 1024 soft cap\n' +
      ' * would violate the monotonic-additive invariant against the IS 1536 tier).',
    overlayDoc:
      ' * The IS-only delta: overlay-required presence + the type narrowings and the\n' +
      ' * optional IS extension fields. License/compatibility presence is covered by the\n' +
      ' * required check; their types are covered by the base — the overlay does not\n' +
      ' * re-type them, to keep messages single-sourced.',
  },
  {
    version: 'v1',
    name: 'plugin-manifest',
    symbol: 'PluginManifest',
    constPrefix: 'PLUGIN_MANIFEST',
    fieldConstPrefix: 'PLUGIN',
    contractIndex: 2,
    headerSuffix: 'the first codegen-generated contract',
    baseProvenance: 'code.claude.com plugins-reference',
    baseDoc:
      ' * The code.claude.com plugins-reference projection. Required presence of the\n' +
      ' * standardFloor ([name] — the only upstream-required field) + type/format on the\n' +
      ' * upstream-owned fields (kebab-case name, URI homepage/repository, object author\n' +
      ' * with a required inner name, array keywords/commands). Length of `description`\n' +
      ' * is intentionally NOT capped here — the universal disclosureMarkers fold (1536)\n' +
      ' * is the operative cap (encoding a tighter cap would violate the\n' +
      ' * monotonic-additive invariant against the IS 1536 tier).',
    overlayDoc:
      ' * The IS-only delta: the seven upstream-optional metadata fields promoted to\n' +
      ' * IS-required (version, description, author, homepage, license, keywords,\n' +
      ' * commands) + the SemVer narrowing on version. A field whose type is already\n' +
      ' * enforced by the base (the overlay only adds it to required) is not re-typed\n' +
      ' * here — its presence is the required check — to keep messages single-sourced.',
  },
  {
    version: 'v1',
    name: 'agent-definition',
    symbol: 'AgentDefinition',
    constPrefix: 'AGENT_DEFINITION',
    fieldConstPrefix: 'AGENT',
    contractIndex: 3,
    headerSuffix: 'subagent frontmatter',
    baseProvenance: 'code.claude.com sub-agents',
    baseDoc:
      ' * The code.claude.com sub-agents projection. Required presence of the\n' +
      ' * standardFloor ([name, description] — the only upstream-required fields) +\n' +
      ' * type/constraint on the upstream-owned fields (kebab-case name, array tools,\n' +
      ' * model alias enum {sonnet,opus,haiku,fable,inherit}, color enum). Length of\n' +
      ' * `description` is intentionally NOT capped here — the universal disclosureMarkers\n' +
      ' * fold (1536) is the operative cap (encoding a tighter cap would violate the\n' +
      ' * monotonic-additive invariant against the IS 1536 tier).',
    overlayDoc:
      ' * The IS-only delta: three upstream-optional fields promoted to IS-required\n' +
      ' * (tools, model, color) + three net-new IS-required tracking fields (version,\n' +
      ' * author, tags — the same trio skill-frontmatter carries) + the SemVer narrowing\n' +
      ' * on version. A field whose type is already enforced by the base (the overlay\n' +
      ' * only adds it to required) is not re-typed here — its presence is the required\n' +
      ' * check — to keep messages single-sourced.',
  },
  {
    version: 'v1',
    name: 'mcp-config',
    symbol: 'McpConfig',
    constPrefix: 'MCP_CONFIG',
    fieldConstPrefix: 'MCP',
    contractIndex: 4,
    headerSuffix: 'mcpServers entry',
    baseProvenance: 'MCP spec + code.claude.com mcp',
    baseDoc:
      ' * The MCP-spec + code.claude.com mcp projection. Required presence of the\n' +
      ' * launch surface ([name, command, args, transport, env]) + type/constraint on\n' +
      ' * the upstream-owned fields (kebab-case name, non-empty command, array args,\n' +
      ' * transport enum {stdio,http,sse,ws}, object env). Length of `description` is\n' +
      ' * intentionally NOT capped here — the universal disclosureMarkers fold (1536)\n' +
      ' * is the operative cap (encoding a tighter cap would violate the\n' +
      ' * monotonic-additive invariant against the IS 1536 tier).',
    overlayDoc:
      ' * The IS-only delta: three net-new IS-required tracking/operational fields\n' +
      ' * (description, version, enabled) + the SemVer narrowing on version. A field\n' +
      ' * whose type is already enforced by the base (the overlay only adds it to\n' +
      ' * required) is not re-typed here — its presence is the required check — to keep\n' +
      ' * messages single-sourced.',
  },
  {
    version: 'v1',
    name: 'hook-config',
    symbol: 'HookConfig',
    constPrefix: 'HOOK_CONFIG',
    fieldConstPrefix: 'HOOK',
    contractIndex: 5,
    headerSuffix: 'hooks.json handler entry',
    baseProvenance: 'code.claude.com hooks',
    baseDoc:
      ' * The code.claude.com hooks projection (one flattened handler entry). Required\n' +
      ' * presence of the trigger+handler surface ([event, matcher, type, command]) +\n' +
      ' * type/constraint on the upstream-owned fields (event enum, non-empty matcher,\n' +
      ' * type enum {command,http,mcp_tool,prompt,agent}, non-empty command). This\n' +
      ' * contract carries no `name` — a hook handler has no public identifier, so the\n' +
      ' * universal securityChecks name fold simply does not fire. Length of\n' +
      ' * `description` is intentionally NOT capped here — the universal disclosureMarkers\n' +
      ' * fold (1536) is the operative cap.',
    overlayDoc:
      ' * The IS-only delta: `timeout` promoted from upstream-optional to IS-required\n' +
      ' * (non-negative integer) + three net-new IS-required operational/tracking fields\n' +
      ' * (description, enabled, blocking). A field whose type is already enforced by the\n' +
      ' * base (the overlay only adds it to required) is not re-typed here — its presence\n' +
      ' * is the required check — to keep messages single-sourced.',
  },
  {
    version: 'v1',
    name: 'marketplace-catalog',
    symbol: 'MarketplaceCatalog',
    constPrefix: 'MARKETPLACE_CATALOG',
    fieldConstPrefix: 'MARKETPLACE',
    contractIndex: 6,
    headerSuffix: 'marketplace.json catalog',
    baseProvenance: 'code.claude.com plugin-marketplaces',
    baseDoc:
      ' * The code.claude.com plugin-marketplaces projection. Required presence of the\n' +
      ' * standardFloor ([name, owner, plugins]) + type/constraint on the upstream-owned\n' +
      ' * fields (kebab-case name, object owner with a required inner name, non-empty\n' +
      ' * array of plugin entries each requiring [name, source]). Length of `description`\n' +
      ' * is intentionally NOT capped here — the universal disclosureMarkers fold (1536)\n' +
      ' * is the operative cap (encoding a tighter cap would violate the\n' +
      ' * monotonic-additive invariant against the IS 1536 tier).',
    overlayDoc:
      ' * The IS-only delta: five fields promoted to IS-required (version, description,\n' +
      ' * license, homepage, keywords) + the SemVer narrowing on version. A field whose\n' +
      ' * type is already enforced by the base (the overlay only adds it to required) is\n' +
      ' * not re-typed here — its presence is the required check — to keep messages\n' +
      ' * single-sourced.',
  },
  {
    // ── STRICT v2 fork (DR-049 / CCP-shadow parity) ──
    // skill-frontmatter ALONE is forked to v2; the other five contracts stay at
    // v1/SHIPPED-INTERNAL untouched. The v2 overlay carries the scoped-Bash
    // narrowing (x-scoped-tool annotation) which the codegen's keyword-driven
    // dispatch emits as a structural check; the v2 marketplace-tier Zod mirror
    // (hand-authored, NOT codegen-emitted) carries the 3 fold tightenings.
    version: 'v2',
    name: 'skill-frontmatter',
    symbol: 'SkillFrontmatter',
    constPrefix: 'SKILL_FRONTMATTER',
    fieldConstPrefix: 'SKILL',
    contractIndex: 1,
    headerSuffix: 'the STRICT v2 walking skeleton',
    baseProvenance: 'agentskills.io',
    baseDoc:
      ' * The agentskills.io + Claude-docs projection (v2 base = v1 base byte-for-byte\n' +
      ' * modulo $id). Required presence of the standardFloor + type/format on the\n' +
      ' * upstream-owned fields. Length of `description` is intentionally NOT capped\n' +
      ' * here — the universal disclosureMarkers fold (v2: 1024) is the operative cap.',
    overlayDoc:
      ' * The IS-only v2 delta: overlay-required presence + the type narrowings + the\n' +
      ' * scoped-Bash narrowing on `allowed-tools` (a bare unscoped `Bash` token is\n' +
      ' * rejected; only `Bash(scope:*)` is accepted) + the optional IS extension\n' +
      ' * fields. License/compatibility presence is covered by the required check;\n' +
      ' * their types are covered by the base — the overlay does not re-type them.',
  },
];

// ─── Schema IO ───────────────────────────────────────────────────────────────

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

/** Refuse to write into a BYTE-FROZEN tree (a v2-misroute-into-v1 guard). */
function guardedWrite(path: string, contents: string): void {
  for (const frozen of FROZEN_WRITE_PREFIXES) {
    if (path.startsWith(frozen)) {
      throw new Error(
        `codegen-authoring: refusing to write a FROZEN path "${relative(REPO_ROOT, path)}" ` +
          `(under ${relative(REPO_ROOT, frozen)}). The v1 authoring family is byte-frozen at ` +
          `@intentsolutions/core@0.4.1; only the v2 family may be regenerated.`,
      );
    }
  }
  writeFileSync(path, contents);
}

/** The upstream-base is `<contract>.v1.json` in BOTH families (v2 base = v1 base modulo $id). */
function baseSchema(spec: ContractSpec): LayerSchema {
  return loadJson<LayerSchema>(
    join(authoringDir(spec.version), 'upstream-base', `${spec.name}.v1.json`),
  );
}
/** The is-overlay filename suffix is family-specific (v1 → `.v1.json`; v2 → `.v2.json`). */
function overlaySchema(spec: ContractSpec): LayerSchema {
  return loadJson<LayerSchema>(
    join(
      authoringDir(spec.version),
      'is-overlay',
      `${spec.name}.${overlayFileSuffix(spec.version)}.json`,
    ),
  );
}

// ─── (b) Effective-required manifest ($comment block) ────────────────────────

const MANIFEST_HEAD = 'EFFECTIVE-REQUIRED MANIFEST';

/**
 * Build the REQUIRED HERE / INHERITED manifest rows from the two `required`
 * arrays. A base-required field is INHERITED (the upstream standardFloor); an
 * overlay-required field is REQUIRED HERE (promoted or net-new IS).
 */
function manifestRows(base: LayerSchema, overlay: LayerSchema, baseProvenance: string): string[] {
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
    rows.push(
      `${field.padEnd(width)}  INHERITED   ${provenance(field, baseProps, 'base', baseProvenance)}`,
    );
  }
  for (const field of overlayReq) {
    rows.push(
      `${field.padEnd(width)}  REQUIRED HERE ${provenance(field, overlayProps, 'overlay', baseProvenance)}`,
    );
  }
  return rows;
}

/**
 * Human-readable provenance suffix for a manifest row, derived from whether the
 * field also exists in the base (promotion) vs is net-new in the overlay. The
 * base/INHERITED row names the contract's own upstream (`baseProvenance` from the
 * CONTRACTS table) — e.g. `agentskills.io` for skill-frontmatter,
 * `code.claude.com plugins-reference` for plugin-manifest — not a single
 * hardcoded literal.
 */
function provenance(
  field: string,
  props: Readonly<Record<string, FieldSchema>>,
  layer: 'base' | 'overlay',
  baseProvenance: string,
): string {
  if (layer === 'base') {
    return `(upstream-base · ${baseProvenance} standardFloor)`;
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
function renderSchemaComment(
  existing: string,
  base: LayerSchema,
  overlay: LayerSchema,
  baseProvenance: string,
): string {
  const rows = manifestRows(base, overlay, baseProvenance).map((r) => `  ${r}`);
  const head = existing.slice(0, existing.indexOf(MANIFEST_HEAD) + MANIFEST_HEAD.length);
  const tailIdx = existing.indexOf('Effective required');
  const tail = existing.slice(tailIdx);
  return `${head} (the answer to 'what does ${base.title.split(' —')[0]} require?' from one file — DR-044 D7(e)). This block is the generated effective-required surface; the source of truth is the \`required\` arrays of the two composed layers below.\n${rows.join('\n')}\n${tail}`;
}

function regenerateSchemaManifest(spec: ContractSpec, check: boolean): boolean {
  const path = join(authoringDir(spec.version), `${spec.name}.schema.json`);
  const raw = readFileSync(path, 'utf-8');
  const schema = JSON.parse(raw) as { $comment: string };
  const base = baseSchema(spec);
  const overlay = overlaySchema(spec);
  const nextComment = renderSchemaComment(schema.$comment, base, overlay, spec.baseProvenance);
  if (nextComment === schema.$comment) {
    return true;
  }
  if (check) {
    process.stderr.write(`DRIFT: ${relative(REPO_ROOT, path)} $comment manifest is stale\n`);
    return false;
  }
  schema.$comment = nextComment;
  guardedWrite(path, `${JSON.stringify(schema, null, 2)}\n`);
  process.stdout.write(`wrote ${relative(REPO_ROOT, path)} ($comment manifest)\n`);
  return true;
}

// ─── (a) Validator codegen — render the FoldIssue[] layer functions ──────────

/**
 * The optional IS-overlay "visibility array" extension fields (skill-frontmatter
 * only). They are looped over with a single `isStringArray` check rather than
 * emitted one-by-one. A contract that declares none of these omits the loop.
 */
const VISIBILITY_FIELDS = new Set([
  'requires_env',
  'requires_tools',
  'fallback_for_env',
  'fallback_for_tools',
]);

/** Per-field constant-name suffixes for the SCREAMING_SNAKE constant prefix. */
function constName(fieldConstPrefix: string, field: string, suffix: string): string {
  // Field is always a single JSON key; uppercase + hyphen→underscore.
  const upper = field.toUpperCase().replace(/-/g, '_');
  return `${fieldConstPrefix}_${upper}_${suffix}`;
}

/**
 * Render the per-field type/constraint checks for a base-layer field, dispatched
 * off the field's JSON-Schema keywords (type / pattern / maxLength / format /
 * items / nested-required) — NOT off the field name. This is what lets a new
 * contract's distinct fields generate without per-name special-casing.
 */
function baseFieldCheck(field: string, schema: FieldSchema, fieldConstPrefix: string): string[] {
  const lines: string[] = [];
  const access = `artifact['${field}']`;

  // String with a kebab-case pattern + a maxLength ceiling (e.g. `name`).
  if (schema.type === 'string' && schema.pattern !== undefined && schema.maxLength !== undefined) {
    const maxConst = constName(fieldConstPrefix, field, 'MAX');
    const patternConst = constName(fieldConstPrefix, field, 'PATTERN');
    lines.push(
      `  if ('${field}' in artifact) {`,
      `    const ${field} = artifact['${field}'];`,
      `    if (typeof ${field} !== 'string') {`,
      `      issues.push({ message: '${field} must be a string', path: ['${field}'] });`,
      `    } else {`,
      `      if (${field}.length > ${maxConst}) {`,
      `        issues.push({`,
      `          message: \`${field} must be at most \${${maxConst}} characters\`,`,
      `          path: ['${field}'],`,
      `        });`,
      `      }`,
      `      if (!${patternConst}.test(${field})) {`,
      `        issues.push({`,
      `          message: '${field} must be kebab-case (lowercase letters, digits, hyphens)',`,
      `          path: ['${field}'],`,
      `        });`,
      `      }`,
      `    }`,
      `  }`,
    );
    return lines;
  }

  // String with only a maxLength ceiling (e.g. `compatibility`).
  if (schema.type === 'string' && schema.maxLength !== undefined) {
    const maxConst = constName(fieldConstPrefix, field, 'MAX');
    lines.push(
      `  if ('${field}' in artifact) {`,
      `    const ${field} = artifact['${field}'];`,
      `    if (typeof ${field} !== 'string') {`,
      `      issues.push({ message: '${field} must be a string', path: ['${field}'] });`,
      `    } else if (${field}.length > ${maxConst}) {`,
      `      issues.push({`,
      `        message: \`${field} must be at most \${${maxConst}} characters\`,`,
      `        path: ['${field}'],`,
      `      });`,
      `    }`,
      `  }`,
    );
    return lines;
  }

  // String constrained to an enum (e.g. agent `model`/`color`, mcp `transport`,
  // hook `event`/`type`). Type-check + membership-check; the const carries the
  // allowed set.
  if (schema.type === 'string' && schema.enum !== undefined) {
    const enumConst = constName(fieldConstPrefix, field, 'VALUES');
    lines.push(
      `  if ('${field}' in artifact) {`,
      `    const ${field} = artifact['${field}'];`,
      `    if (typeof ${field} !== 'string') {`,
      `      issues.push({ message: '${field} must be a string', path: ['${field}'] });`,
      `    } else if (!(${enumConst} as readonly string[]).includes(${field})) {`,
      `      issues.push({`,
      `        message: \`${field} must be one of: \${${enumConst}.join(', ')}\`,`,
      `        path: ['${field}'],`,
      `      });`,
      `    }`,
      `  }`,
    );
    return lines;
  }

  // String with only a minLength floor — non-empty, no pattern/maxLength/format
  // (e.g. mcp `command`, hook `matcher`/`command`). Type-check + non-empty check.
  // `description` is excluded: it is the universal-fold-owned field (the
  // marketplace-tier foundation governs `description` AND `name` by name — see
  // securityChecksIssues / disclosureMarkersIssues), so its base-layer check is
  // type-only across every contract. This keeps the codegen keyword-driven for
  // every author-owned field while leaving the two foundation tokens to the fold.
  if (
    field !== 'description' &&
    schema.type === 'string' &&
    schema.minLength !== undefined &&
    schema.minLength > 0 &&
    schema.pattern === undefined &&
    schema.maxLength === undefined &&
    schema.format === undefined &&
    schema.enum === undefined
  ) {
    lines.push(
      `  if ('${field}' in artifact) {`,
      `    const ${field} = artifact['${field}'];`,
      `    if (typeof ${field} !== 'string') {`,
      `      issues.push({ message: '${field} must be a string', path: ['${field}'] });`,
      `    } else if (${field}.length < ${schema.minLength}) {`,
      `      issues.push({ message: '${field} must not be empty', path: ['${field}'] });`,
      `    }`,
      `  }`,
    );
    return lines;
  }

  // Boolean field (e.g. mcp `enabled`, hook `enabled`/`blocking`).
  if (schema.type === 'boolean') {
    lines.push(
      `  if ('${field}' in artifact && typeof ${access} !== 'boolean') {`,
      `    issues.push({ message: '${field} must be a boolean', path: ['${field}'] });`,
      `  }`,
    );
    return lines;
  }

  // Integer field with a numeric floor (e.g. hook `timeout` — non-negative).
  if (schema.type === 'integer') {
    const minConst = constName(fieldConstPrefix, field, 'MIN');
    lines.push(
      `  if ('${field}' in artifact) {`,
      `    const ${field} = artifact['${field}'];`,
      `    if (typeof ${field} !== 'number' || !Number.isInteger(${field})) {`,
      `      issues.push({ message: '${field} must be an integer', path: ['${field}'] });`,
      `    } else if (${field} < ${minConst}) {`,
      `      issues.push({`,
      `        message: \`${field} must be at least \${${minConst}}\`,`,
      `        path: ['${field}'],`,
      `      });`,
      `    }`,
      `  }`,
    );
    return lines;
  }

  // Array of objects, each with a nested `required` set, plus an optional
  // minItems floor (e.g. marketplace `plugins` = [{name, source}, ...], minItems 1).
  if (schema.type === 'array' && schema.items?.type === 'object') {
    const nestedRequired = (schema.items.required ?? []).map((f) => `'${f}'`).join(', ');
    const minItems = schema.minItems ?? 0;
    lines.push(
      `  if ('${field}' in artifact) {`,
      `    const ${field} = ${access};`,
      `    if (!Array.isArray(${field})) {`,
      `      issues.push({ message: '${field} must be an array', path: ['${field}'] });`,
      `    } else {`,
    );
    if (minItems > 0) {
      lines.push(
        `      if (${field}.length < ${minItems}) {`,
        `        issues.push({ message: '${field} must not be empty', path: ['${field}'] });`,
        `      }`,
      );
    }
    lines.push(
      `      ${field}.forEach((entry, index) => {`,
      `        if (!isPlainObject(entry)) {`,
      `          issues.push({`,
      `            message: '${field} entry must be an object',`,
      `            path: ['${field}', String(index)],`,
      `          });`,
      `          return;`,
      `        }`,
      `        for (const key of [${nestedRequired}] as const) {`,
      `          if (!(key in entry)) {`,
      `            issues.push({`,
      `              message: \`${field}[\${index}].\${key} is required\`,`,
      `              path: ['${field}', String(index), key],`,
      `            });`,
      `          }`,
      `        }`,
      `      });`,
      `    }`,
      `  }`,
    );
    return lines;
  }

  // String with a URI format (e.g. `homepage`, `repository`).
  if (schema.type === 'string' && schema.format === 'uri') {
    lines.push(
      `  if ('${field}' in artifact) {`,
      `    const ${field} = artifact['${field}'];`,
      `    if (typeof ${field} !== 'string') {`,
      `      issues.push({ message: '${field} must be a string', path: ['${field}'] });`,
      `    } else if (!isUri(${field})) {`,
      `      issues.push({ message: '${field} must be a valid URI', path: ['${field}'] });`,
      `    }`,
      `  }`,
    );
    return lines;
  }

  // Object with a nested `required` set (e.g. plugin `author` = {name,...}).
  if (schema.type === 'object' && schema.required !== undefined && schema.required.length > 0) {
    const nestedRequired = schema.required.map((f) => `'${f}'`).join(', ');
    lines.push(
      `  if ('${field}' in artifact) {`,
      `    const ${field} = ${access};`,
      `    if (!isPlainObject(${field})) {`,
      `      issues.push({ message: '${field} must be an object', path: ['${field}'] });`,
      `    } else {`,
      `      for (const key of [${nestedRequired}] as const) {`,
      `        if (!(key in ${field})) {`,
      `          issues.push({ message: \`${field}.\${key} is required\`, path: ['${field}', key] });`,
      `        }`,
      `      }`,
      `    }`,
      `  }`,
    );
    return lines;
  }

  // Generic object (no nested required) — e.g. `metadata`.
  if (schema.type === 'object') {
    lines.push(
      `  if ('${field}' in artifact && !isPlainObject(${access})) {`,
      `    issues.push({ message: '${field} must be an object', path: ['${field}'] });`,
      `  }`,
    );
    return lines;
  }

  // Array of strings (e.g. plugin `keywords`).
  if (schema.type === 'array' && schema.items?.type === 'string') {
    lines.push(
      `  if ('${field}' in artifact && !isStringArray(${access})) {`,
      `    issues.push({ message: '${field} must be an array of strings', path: ['${field}'] });`,
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

/**
 * Render the per-field narrowing checks for an overlay-layer field, dispatched
 * off JSON-Schema keywords. A field whose TYPE is already enforced by the base
 * (the overlay only ADDS it to `required`, re-declaring no narrowing constraint)
 * is skipped here — its presence is the required check, its type the base's — to
 * keep messages single-sourced.
 */
function overlayFieldCheck(
  field: string,
  schema: FieldSchema,
  baseProps: Readonly<Record<string, FieldSchema>>,
): string[] {
  const lines: string[] = [];
  const access = `artifact['${field}']`;

  // x-scoped-tool (v2) — the STRICT scoped-tool narrowing on a string|array field
  // (e.g. `allowed-tools` narrowed so a BARE unscoped `Bash` is rejected; only
  // `Bash(scope:*)` is accepted). Feature-gated to EXACTLY the shape the v2 overlay
  // uses: an `x-scoped-tool` annotation naming the token + an `allOf` whose first
  // member is the v1 string|array union. Emit the v1 string|array type check PLUS
  // the per-form scoped-tool reject (string-form token-boundary check + array-form
  // exact-token check) via the shared scopedToolIssues helper. Unlike kyh9, this is
  // also structurally enforced in the JSON Schema — the Zod check just mirrors it
  // for fold agreement. Any other allOf/x-scoped-tool shape is left unrecognized.
  if (isScopedToolAllOf(schema)) {
    const token = schema['x-scoped-tool']!;
    lines.push(
      `  if ('${field}' in artifact) {`,
      `    const ${camel(field)} = ${access};`,
      `    if (typeof ${camel(field)} !== 'string' && !isStringArray(${camel(field)})) {`,
      `      issues.push({`,
      `        message: '${field} must be a string or an array of strings',`,
      `        path: ['${field}'],`,
      `      });`,
      `    } else {`,
      `      issues.push(...scopedToolIssues(${camel(field)}, '${token}', '${field}'));`,
      `    }`,
      `  }`,
    );
    return lines;
  }

  // anyOf [ string, array-of-strings ] — the v0.4.1 non-breaking relaxation that
  // lets a field accept BOTH the upstream CSV/space-delimited string form AND the
  // YAML array form (e.g. `allowed-tools`). Feature-gated to exactly this union
  // shape; any other anyOf is not handled here (falls through unrecognized rather
  // than mis-generating). Emit one combined check: a string OR a string[] passes;
  // anything else (number, object, array-with-non-strings, null) is an issue.
  if (isStringOrStringArrayAnyOf(schema)) {
    lines.push(
      `  if ('${field}' in artifact) {`,
      `    const ${camel(field)} = ${access};`,
      `    if (typeof ${camel(field)} !== 'string' && !isStringArray(${camel(field)})) {`,
      `      issues.push({`,
      `        message: '${field} must be a string or an array of strings',`,
      `        path: ['${field}'],`,
      `      });`,
      `    }`,
      `  }`,
    );
    return lines;
  }

  // SemVer-narrowed string (overlay adds a `pattern` the base lacks) — e.g.
  // `version`.
  if (schema.type === 'string' && schema.pattern !== undefined) {
    lines.push(
      `  if ('${field}' in artifact) {`,
      `    const ${field} = artifact['${field}'];`,
      `    if (typeof ${field} !== 'string') {`,
      `      issues.push({ message: '${field} must be a string', path: ['${field}'] });`,
      `    } else if (!SEMVER_PATTERN.test(${field})) {`,
      `      issues.push({ message: '${field} must be strict SemVer 2.0.0', path: ['${field}'] });`,
      `    }`,
      `  }`,
    );
    return lines;
  }

  // Array of strings narrowed by the overlay — e.g. skill `allowed-tools`/`tags`,
  // plugin `commands`. Emit the type check only when the base does NOT already
  // type the field as the same array (otherwise the base's check is canonical).
  if (schema.type === 'array' && schema.items?.type === 'string') {
    const baseTypes = baseProps[field]?.type === 'array';
    if (!baseTypes) {
      lines.push(
        `  if ('${field}' in artifact && !isStringArray(${access})) {`,
        `    issues.push({ message: '${field} must be an array of strings', path: ['${field}'] });`,
        `  }`,
      );
      return lines;
    }
    return lines;
  }

  // A field whose type is enforced by the base (string with minLength only, or
  // object/uri promoted-to-required): the overlay only ADDS it to required and
  // emits no type check (single-sourced to the base).
  if (field in baseProps) {
    return lines;
  }

  // ── Net-new overlay fields (not in the base) — the overlay both ADDS them to
  // required AND owns their type. Dispatched off JSON-Schema keywords. ──

  // Net-new boolean (e.g. mcp `enabled`, hook `enabled`/`blocking`).
  if (schema.type === 'boolean') {
    lines.push(
      `  if ('${field}' in artifact && typeof ${access} !== 'boolean') {`,
      `    issues.push({ message: '${field} must be a boolean', path: ['${field}'] });`,
      `  }`,
    );
    return lines;
  }

  // Net-new integer with a numeric floor (e.g. hook `timeout` — non-negative).
  if (schema.type === 'integer') {
    const min = schema.minimum ?? 0;
    lines.push(
      `  if ('${field}' in artifact) {`,
      `    const ${field} = artifact['${field}'];`,
      `    if (typeof ${field} !== 'number' || !Number.isInteger(${field})) {`,
      `      issues.push({ message: '${field} must be an integer', path: ['${field}'] });`,
      `    } else if (${field} < ${min}) {`,
      `      issues.push({ message: '${field} must be at least ${min}', path: ['${field}'] });`,
      `    }`,
      `  }`,
    );
    return lines;
  }

  // Net-new URI string (e.g. marketplace `homepage`).
  if (schema.type === 'string' && schema.format === 'uri') {
    lines.push(
      `  if ('${field}' in artifact) {`,
      `    const ${field} = artifact['${field}'];`,
      `    if (typeof ${field} !== 'string') {`,
      `      issues.push({ message: '${field} must be a string', path: ['${field}'] });`,
      `    } else if (!isUri(${field})) {`,
      `      issues.push({ message: '${field} must be a valid URI', path: ['${field}'] });`,
      `    }`,
      `  }`,
    );
    return lines;
  }

  // Net-new overlay scalar string (e.g. skill `author`, mcp/hook/marketplace
  // `description`, marketplace `license`): type-only check. (`description` is the
  // foundation-owned token-budget field; its non-emptiness is governed by the
  // overlay required-presence check, not a base non-empty check — consistent with
  // the base layer leaving `description` to the universal folds.)
  lines.push(
    `  if ('${field}' in artifact && typeof ${access} !== 'string') {`,
    `    issues.push({ message: '${field} must be a string', path: ['${field}'] });`,
  );
  lines.push(`  }`);
  return lines;
}

/**
 * The feature-gate for the v0.4.1 `allowed-tools` relaxation: is this field an
 * `anyOf` that is EXACTLY the string | array-of-strings union? Recognizing only
 * this precise shape (two members: one bare `{type:'string'}` and one
 * `{type:'array', items:{type:'string'}}`, in either order) keeps the codegen
 * keyword-driven and prevents any other anyOf shape from silently mis-generating.
 */
function isStringOrStringArrayAnyOf(schema: FieldSchema): boolean {
  if (schema.anyOf?.length !== 2) {
    return false;
  }
  const isBareString = (s: FieldSchema): boolean =>
    s.type === 'string' &&
    s.pattern === undefined &&
    s.enum === undefined &&
    s.format === undefined &&
    s.minLength === undefined &&
    s.maxLength === undefined;
  const isStringArrayMember = (s: FieldSchema): boolean =>
    s.type === 'array' && s.items?.type === 'string';
  const [a, b] = schema.anyOf as readonly [FieldSchema, FieldSchema];
  return (isBareString(a) && isStringArrayMember(b)) || (isStringArrayMember(a) && isBareString(b));
}

/**
 * The feature-gate for the v2 scoped-tool narrowing: is this field annotated with
 * `x-scoped-tool` AND shaped as an `allOf` whose FIRST member is the v1
 * string | array-of-strings union (the narrowed string|array `allowed-tools`)?
 * Recognizing only this precise shape keeps the codegen keyword-driven and
 * prevents any other allOf shape from silently mis-generating. The remaining allOf
 * members are the structural JSON-Schema reject (string-form negative pattern +
 * array-form not-contains-const); the codegen does not re-read them — the
 * `x-scoped-tool` token drives the equivalent Zod check via scopedToolIssues.
 */
function isScopedToolAllOf(schema: FieldSchema): boolean {
  if (typeof schema['x-scoped-tool'] !== 'string' || schema['x-scoped-tool'].length === 0) {
    return false;
  }
  const first = schema.allOf?.[0];
  return first !== undefined && isStringOrStringArrayAnyOf(first);
}

/** Convert a (possibly hyphenated) JSON key into a valid camelCase JS identifier. */
function camel(field: string): string {
  return field.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}

/** Whether any overlay field constrains via SemVer (drives the SEMVER_PATTERN const). */
function usesSemver(overlayProps: Readonly<Record<string, FieldSchema>>): string | undefined {
  for (const schema of Object.values(overlayProps)) {
    if (schema.type === 'string' && schema.pattern !== undefined) {
      return schema.pattern;
    }
  }
  return undefined;
}

/** The optional `required_environment_variables` overlay extension (skill only). */
function envVarSchema(
  overlayProps: Readonly<Record<string, FieldSchema>>,
): FieldSchema | undefined {
  return overlayProps['required_environment_variables'];
}

/**
 * Render the per-variable mutual-exclusion check block (kyh9 — CTO re-scope).
 * For each declared field pair, no element may appear in more than one of the
 * arrays. This is an array-element-disjointness predicate that vanilla JSON
 * Schema 2020-12 cannot express, so it is emitted into the Zod runtime layer as
 * a DOCUMENTED CARVE-OUT — the fold-agreement (ajv ↔ Zod) backstop carves out
 * exactly these overlap cases. Keyword-driven: any contract whose overlay
 * declares `x-mutually-exclusive-fields` gets the check; one that declares none
 * emits nothing.
 */
function mutualExclusionBlock(exclusions: readonly MutualExclusion[]): string {
  if (exclusions.length === 0) {
    return '';
  }
  const groups = exclusions.map((ex) => `[${ex.fields.map((f) => `'${f}'`).join(', ')}]`);
  // Mirror prettier: collapse the for-of array header to one line when the whole
  // header fits the 100-char print width, else wrap one group per line with
  // trailing commas. Keeps the codegen idempotency gate from flapping.
  const single = `  for (const group of [${groups.join(', ')}] as const) {`;
  const header =
    single.length <= 100
      ? single
      : `  for (const group of [\n${groups.map((g) => `    ${g},`).join('\n')}\n  ] as const) {`;
  return `
${header}
    issues.push(...mutuallyExclusiveIssues(artifact, group));
  }
`;
}

/** The Zod-layer helper that implements the per-variable disjointness predicate. */
const MUTUAL_EXCLUSION_HELPER = `
function mutuallyExclusiveIssues(
  artifact: AuthoringArtifact,
  fields: readonly string[],
): FoldIssue[] {
  // Per-variable disjointness: no identifier may appear in more than one of the
  // listed array fields. Only well-formed string arrays participate — malformed
  // values are reported by their own type checks, not here.
  const issues: FoldIssue[] = [];
  const seen = new Map<string, string>();
  for (const field of fields) {
    const value = artifact[field];
    if (!isStringArray(value)) {
      continue;
    }
    for (const item of value) {
      const prior = seen.get(item);
      if (prior !== undefined && prior !== field) {
        issues.push({
          message: \`"\${item}" must not appear in both \${prior} and \${field}\`,
          path: [field],
        });
      } else {
        seen.set(item, field);
      }
    }
  }
  return issues;
}
`;

/**
 * The Zod-layer helper that implements the scoped-tool narrowing (v2). Rejects a
 * BARE, unscoped instance of `token` (e.g. `Bash`) in the string OR array form;
 * a scoped `token(scope:*)` (e.g. `Bash(git:*)`) and any non-`token` value are
 * accepted. This MIRRORS the structural JSON-Schema reject (the string-form
 * negative pattern + the array-form not-contains-const) so ajv ↔ Zod agree. The
 * value is already known to be a string or string[] (the caller's type check ran
 * first). String form: split on whitespace/comma into tokens; reject if any whole
 * token equals `token`. Array form: reject if any item equals `token`. `Bashful`
 * and `Bash(git:*)` are NOT a bare `Bash` token.
 */
const SCOPED_TOOL_HELPER = `
function scopedToolIssues(value: string | string[], token: string, field: string): FoldIssue[] {
  const tokens =
    typeof value === 'string' ? value.split(/[\\s,]+/).filter((t) => t.length > 0) : value;
  if (tokens.includes(token)) {
    return [
      {
        message: \`\${field}: bare unscoped "\${token}" is not allowed — use a scoped \${token}(scope:*)\`,
        path: [field],
      },
    ];
  }
  return [];
}
`;

/** Whether any overlay field is a scoped-tool narrowing (drives the scopedToolIssues helper). */
function usesScopedTool(overlayProps: Readonly<Record<string, FieldSchema>>): boolean {
  return Object.values(overlayProps).some((s) => isScopedToolAllOf(s));
}

/** Whether any base or overlay field is a URI string (drives the isUri helper). */
function usesUri(
  baseProps: Readonly<Record<string, FieldSchema>>,
  overlayProps: Readonly<Record<string, FieldSchema>>,
): boolean {
  const all = [...Object.values(baseProps), ...Object.values(overlayProps)];
  return all.some((s) => s.type === 'string' && s.format === 'uri');
}

/** Whether any field (base or overlay) is an array-of-strings (drives isStringArray). */
function usesStringArray(
  baseProps: Readonly<Record<string, FieldSchema>>,
  overlayProps: Readonly<Record<string, FieldSchema>>,
  visibilityFields: readonly string[],
  hasEnvVars: boolean,
): boolean {
  const all = [...Object.values(baseProps), ...Object.values(overlayProps)];
  if (all.some((s) => s.type === 'array' && s.items?.type === 'string')) {
    return true;
  }
  // The string | array-of-strings anyOf relaxation (v0.4.1 `allowed-tools`)
  // relies on isStringArray to accept the array form.
  if (all.some((s) => isStringOrStringArrayAnyOf(s))) {
    return true;
  }
  // The v2 scoped-tool narrowing wraps the same string|array union (in an allOf)
  // and likewise relies on isStringArray for its array-form type check.
  if (all.some((s) => isScopedToolAllOf(s))) {
    return true;
  }
  return visibilityFields.length > 0 || hasEnvVars;
}

/** Whether any field (base or overlay) needs the isPlainObject helper. */
function usesPlainObject(
  baseProps: Readonly<Record<string, FieldSchema>>,
  hasEnvVars: boolean,
): boolean {
  return (
    Object.values(baseProps).some(
      (s) => s.type === 'object' || (s.type === 'array' && s.items?.type === 'object'),
    ) || hasEnvVars
  );
}

/**
 * Render the full per-contract validator module. The structure mirrors the
 * walking-skeleton hand-authored shape exactly, but every field check + helper +
 * constant is emitted from the JSON Schema (not hand-typed), and the helpers
 * that a given contract does not use are omitted.
 */
function renderValidator(spec: ContractSpec, base: LayerSchema, overlay: LayerSchema): string {
  const { symbol, constPrefix, fieldConstPrefix } = spec;
  const baseReq = base.required ?? [];
  const overlayReq = overlay.required ?? [];
  const baseProps = base.properties ?? {};
  const overlayProps = overlay.properties ?? {};

  // Visibility-array + env-var extension fields present in this overlay.
  const visibilityFields = Object.keys(overlayProps).filter((f) => VISIBILITY_FIELDS.has(f));
  const envVars = envVarSchema(overlayProps);
  const hasEnvVars = envVars !== undefined;

  // kyh9: per-variable mutual-exclusion groups declared on the overlay.
  const exclusions = overlay['x-mutually-exclusive-fields'] ?? [];
  const hasExclusions = exclusions.length > 0;

  // v2: scoped-tool narrowing (e.g. allowed-tools `x-scoped-tool: Bash`).
  const hasScopedTool = usesScopedTool(overlayProps);

  const semverPattern = usesSemver(overlayProps);
  const needUri = usesUri(baseProps, overlayProps);
  // The disjointness check itself relies on isStringArray, so a contract with
  // exclusions needs the helper even if no field type-check otherwise would.
  const needStringArray =
    usesStringArray(baseProps, overlayProps, visibilityFields, hasEnvVars) || hasExclusions;
  const needPlainObject = usesPlainObject(baseProps, hasEnvVars);

  // Base-layer checks: every declared base property gets a check, in declaration
  // order (the JSON Schema's key order is the canonical order).
  const baseChecks = Object.keys(baseProps)
    .map((f) => baseFieldCheck(f, baseProps[f] ?? {}, fieldConstPrefix).join('\n'))
    .join('\n\n');

  // Overlay-layer checks: the overlay-required fields in declaration order, then
  // the visibility-array loop (if any), then required_environment_variables (if
  // present). Non-required overlay properties (none today) are not type-checked.
  const overlayCheckBlocks = overlayReq
    .map((f) => overlayFieldCheck(f, overlayProps[f] ?? {}, baseProps).join('\n'))
    .filter((s) => s.length > 0);
  const overlayChecks = overlayCheckBlocks.join('\n\n');

  // The overlay `issues` initializer: prettier collapses it to one line when it
  // fits the 100-char print width, else wraps it. Mirror that so the generated
  // output is already prettier-clean (otherwise `prettier --write` would drift
  // the codegen and the --check idempotency gate would flap).
  const overlaySingle = `  const issues: FoldIssue[] = [...requiredFieldsIssues(artifact, ${constPrefix}_OVERLAY_REQUIRED)];`;
  const overlayInit =
    overlaySingle.length <= 100
      ? overlaySingle
      : `  const issues: FoldIssue[] = [\n    ...requiredFieldsIssues(artifact, ${constPrefix}_OVERLAY_REQUIRED),\n  ];`;

  // The base `issues` initializer (same prettier wrap rule as the overlay init —
  // a long contract const name like MARKETPLACE_CATALOG_BASE_REQUIRED pushes the
  // single-line form past 100 chars).
  const baseSingle = `  const issues: FoldIssue[] = [...requiredFieldsIssues(artifact, ${constPrefix}_BASE_REQUIRED)];`;
  const baseInit =
    baseSingle.length <= 100
      ? baseSingle
      : `  const issues: FoldIssue[] = [\n    ...requiredFieldsIssues(artifact, ${constPrefix}_BASE_REQUIRED),\n  ];`;

  // The two required-field-set const declarations: prettier collapses a const
  // array to one line when the whole declaration fits 100 chars, else wraps it
  // one element per line. Mirror that for BOTH the base and overlay arrays.
  const baseReqDecl = arrayConstDecl(`${constPrefix}_BASE_REQUIRED`, baseReq);
  const overlayReqDecl = arrayConstDecl(`${constPrefix}_OVERLAY_REQUIRED`, overlayReq);

  // ── Constants block (only the constants this contract references) ──
  const constLines: string[] = [];
  const prov = spec.baseProvenance;
  for (const [field, schema] of Object.entries(baseProps)) {
    if (
      schema.type === 'string' &&
      schema.pattern !== undefined &&
      schema.maxLength !== undefined
    ) {
      constLines.push(
        `/** ${prov} kebab-case ${field} surface (upstream-base). */`,
        `export const ${constName(fieldConstPrefix, field, 'PATTERN')} = ${jsRegexLiteral(schema.pattern)};`,
        `/** ${prov} ${field} length ceiling (upstream-base). */`,
        `export const ${constName(fieldConstPrefix, field, 'MAX')} = ${schema.maxLength};`,
      );
    } else if (schema.type === 'string' && schema.maxLength !== undefined) {
      constLines.push(
        `/** ${prov} ${field} length ceiling (upstream-base). */`,
        `export const ${constName(fieldConstPrefix, field, 'MAX')} = ${schema.maxLength};`,
      );
    } else if (schema.type === 'string' && schema.enum !== undefined) {
      // Mirror prettier: a const array that fits the 100-char print width is
      // collapsed to one line, else wrapped one-element-per-line. Emitting the
      // post-prettier form here keeps the codegen idempotency gate from flapping
      // (codegen-writes ⇒ prettier-no-ops).
      const name = constName(fieldConstPrefix, field, 'VALUES');
      const single = `export const ${name} = [${schema.enum.map((v) => `'${v}'`).join(', ')}] as const;`;
      constLines.push(`/** ${prov} ${field} allowed values (upstream-base). */`);
      if (single.length <= 100) {
        constLines.push(single);
      } else {
        constLines.push(
          `export const ${name} = [`,
          ...schema.enum.map((v) => `  '${v}',`),
          `] as const;`,
        );
      }
    } else if (schema.type === 'integer') {
      const min = schema.minimum ?? 0;
      constLines.push(
        `/** ${prov} ${field} numeric floor (upstream-base). */`,
        `export const ${constName(fieldConstPrefix, field, 'MIN')} = ${min};`,
      );
    }
  }
  if (semverPattern !== undefined) {
    constLines.push(
      `/** Strict SemVer 2.0.0 (is-overlay — stricter than the legacy IS prefix match). */`,
      `export const SEMVER_PATTERN =`,
      `  ${jsRegexLiteral(semverPattern)};`,
    );
  }
  if (hasEnvVars) {
    const envNamePattern = envVars?.items?.properties?.['name']?.pattern;
    constLines.push(
      `/** UPPER_SNAKE_CASE env-var names (is-overlay optional extra). */`,
      `export const ENV_VAR_NAME_PATTERN = ${jsRegexLiteral(envNamePattern)};`,
    );
  }

  // ── Visibility-array const + loop (skill only) ──
  const visibilityConst =
    visibilityFields.length > 0
      ? `\n/** The optional IS visibility arrays (is-overlay) — each is an array of strings. */\nconst VISIBILITY_ARRAY_FIELDS = [\n${visibilityFields.map((f) => `  '${f}',`).join('\n')}\n] as const;\n`
      : '';
  const visibilityLoop =
    visibilityFields.length > 0
      ? `\n  for (const field of VISIBILITY_ARRAY_FIELDS) {\n    if (field in artifact && !isStringArray(artifact[field])) {\n      issues.push({ message: \`\${field} must be an array of strings\`, path: [field] });\n    }\n  }\n`
      : '';

  // ── Per-variable mutual-exclusion block + helper (kyh9 — CTO carve-out) ──
  const exclusionBlock = mutualExclusionBlock(exclusions);
  const exclusionHelper = hasExclusions ? MUTUAL_EXCLUSION_HELPER : '';

  // ── Scoped-tool helper (v2 — structurally enforced, mirrored in Zod) ──
  const scopedToolHelper = hasScopedTool ? SCOPED_TOOL_HELPER : '';

  // ── Env-var extension block + helper (skill only) ──
  const envVarBlock = hasEnvVars
    ? `\n  if ('required_environment_variables' in artifact) {\n    issues.push(...requiredEnvVarIssues(artifact['required_environment_variables']));\n  }\n`
    : '';
  const envVarHelper = hasEnvVars
    ? `
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
`
    : '';

  // ── Shared helper functions (only those used) ──
  const helperFns: string[] = [];
  if (needStringArray) {
    helperFns.push(
      `function isStringArray(value: unknown): value is string[] {\n  return Array.isArray(value) && value.every((item) => typeof item === 'string');\n}`,
    );
  }
  if (needPlainObject) {
    helperFns.push(
      `function isPlainObject(value: unknown): value is Record<string, unknown> {\n  return typeof value === 'object' && value !== null && !Array.isArray(value);\n}`,
    );
  }
  if (needUri) {
    helperFns.push(
      `function isUri(value: string): boolean {\n  try {\n    new URL(value);\n    return true;\n  } catch {\n    return false;\n  }\n}`,
    );
  }
  const helperBlock = helperFns.length > 0 ? `\n${helperFns.join('\n\n')}\n` : '';

  // Family-aware header paths. v1 keeps its EXACT historical strings (the v1
  // generated output must stay byte-identical); v2 references its own family tree
  // + the `.v2.json` overlay + the v2 test file.
  const schemaDir = `schemas/authoring/${spec.version}`;
  const overlayName = `${spec.name}.${overlayFileSuffix(spec.version)}.json`;
  const testName =
    spec.version === 'v1'
      ? `${spec.name}-schema.test.ts`
      : `${spec.name}-${spec.version}-schema.test.ts`;

  return `/**
 * ${spec.name} — IS marketplace-tier authoring contract #${spec.contractIndex} (${spec.headerSuffix}).
 *
 * GENERATED by scripts/codegen-authoring.ts from the three-artifact composition:
 *   ${schemaDir}/upstream-base/${spec.name}.v1.json   (authored by THEM)
 *   ${schemaDir}/marketplace-tier.schema.json#/$defs/universalFolds
 *   ${schemaDir}/is-overlay/${overlayName}      (authored by US)
 *   ⇒ ${schemaDir}/${spec.name}.schema.json           (pure allOf)
 *
 * DO NOT EDIT BY HAND — re-run \`pnpm run codegen:authoring\` after a schema edit.
 * Per DR-044 D8 the Zod validator AND the D7 inline \`$comment\` effective-required
 * manifest are single-sourced from the JSON Schema: the two layers below are
 * derived field-by-field from the base and overlay \`required\` arrays + the
 * per-field type/constraint surface; the universal folds are reused by reference
 * from marketplace-tier. The monotonic-additive invariant (the overlay only ADDS
 * required fields and NARROWS constraints on the base) is the 2026-04-28-debacle
 * guard, asserted by the property test in
 * src/__tests__/${testName}.
 */

import {
  type AuthoringArtifact,
  type FoldIssue,
  attach,
  requiredFieldsIssues,
  universalFoldsIssues,
} from './marketplace-tier.js';

// ─── Required-field sets (the source of the effective-required manifest) ─────

/** standardFloor — the upstream-base always-required fields (${prov}). */
${baseReqDecl}

/** The IS-overlay required delta (beyond the base floor). */
${overlayReqDecl}

/** Effective required = base ∪ overlay = the IS 8-field marketplace set (NON-NEGOTIABLE). */
export const ${constPrefix}_REQUIRED_FIELDS = [
  ...${constPrefix}_BASE_REQUIRED,
  ...${constPrefix}_OVERLAY_REQUIRED,
] as const;

// ─── Constraint constants (mirror the JSON Schemas exactly) ──────────────────

${constLines.join('\n')}
${visibilityConst}${helperBlock}
// ─── Layer 1: upstream base (authored by THEM) ───────────────────────────────

/**
${spec.baseDoc}
 */
export function upstreamBaseIssues(artifact: AuthoringArtifact): FoldIssue[] {
${baseInit}

${baseChecks}

  return issues;
}

// ─── Layer 3: IS overlay (authored by US) ────────────────────────────────────

/**
${spec.overlayDoc}
 */
export function isOverlayIssues(artifact: AuthoringArtifact): FoldIssue[] {
${overlayInit}

${overlayChecks}
${visibilityLoop}${envVarBlock}${exclusionBlock}
  return issues;
}
${envVarHelper}${exclusionHelper}${scopedToolHelper}
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

/**
 * Render an `export const NAME = [...] as const;` declaration prettier-clean: one
 * line when the whole declaration fits the 100-char print width, else wrapped one
 * element per line. Mirrors prettier so the codegen idempotency gate never flaps.
 */
function arrayConstDecl(name: string, items: readonly string[]): string {
  const single = `export const ${name} = [${items.map((f) => `'${f}'`).join(', ')}] as const;`;
  if (single.length <= 100) {
    return single;
  }
  return `export const ${name} = [\n${items.map((f) => `  '${f}',`).join('\n')}\n] as const;`;
}

function regenerateValidator(spec: ContractSpec, check: boolean): boolean {
  const path = join(validatorsDir(spec.version), `${spec.name}.ts`);
  const base = baseSchema(spec);
  const overlay = overlaySchema(spec);
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
  guardedWrite(path, next);
  process.stdout.write(`wrote ${relative(REPO_ROOT, path)} (validator)\n`);
  return true;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

function main(): void {
  const check = process.argv.includes('--check');
  let ok = true;
  for (const spec of CONTRACTS) {
    ok = regenerateValidator(spec, check) && ok;
    ok = regenerateSchemaManifest(spec, check) && ok;
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
