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
 * v2 overlays are `<contract>.v2.json` (distinct files from the frozen v1
 * overlays). The upstream-base filename is per-contract (`baseFileSuffix`): the
 * v2 skill-frontmatter base stays `<contract>.v1.json` (a byte-copy of the v1
 * base modulo `$id` — same upstream projection), while the DR-062
 * projection-mirrored v2 contracts read `<contract>.v2.json` (a REGENERATED
 * base derived from the captured projection, not a copy).
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

/**
 * A layer-level `allOf` member — the ONE recognized shape is the DR-062
 * per-transport conditional requiredness: `if(selector ∈ enum)` /
 * `then(required)` / `else(required)`. See parseConditionalRequires.
 */
interface ConditionalRequireMember {
  readonly $comment?: string;
  readonly if?: {
    readonly properties?: Readonly<Record<string, FieldSchema>>;
    readonly required?: readonly string[];
  };
  readonly then?: { readonly required?: readonly string[] };
  readonly else?: { readonly required?: readonly string[] };
}

interface LayerSchema {
  readonly $id: string;
  readonly title: string;
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, FieldSchema>>;
  readonly allOf?: readonly ConditionalRequireMember[];
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
  /**
   * Upstream-base filename suffix (defaults to `v1`). The v2 skill-frontmatter
   * fork keeps the `v1` base file (byte-copy modulo `$id`); the DR-062
   * projection-mirrored v2 contracts carry a `v2` base file regenerated from
   * the captured projection.
   */
  readonly baseFileSuffix?: AuthoringVersion;
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
  {
    // ── DR-062 projection-mirrored v2 (tier-3 reconciliation) ──
    // mcp-config is the first of the five contracts whose v2 base is REGENERATED
    // from the captured projection (intent-eval-lab
    // specs/_vendor/upstream/mcp-config/projection.json) rather than byte-copied
    // from v1: the selector takes upstream's wire name `type` (OPTIONAL, stdio
    // default), the enum gains the `streamable-http` alias, and the
    // per-transport if/then/else shapes replace the v1 flat shape. The relocated
    // IS narrowings (the flat all-required projection choice + the `metadata`
    // extension object) live in the v2 overlay with convergence triggers.
    version: 'v2',
    baseFileSuffix: 'v2',
    name: 'mcp-config',
    symbol: 'McpConfig',
    constPrefix: 'MCP_CONFIG',
    fieldConstPrefix: 'MCP',
    contractIndex: 4,
    headerSuffix: 'mcpServers entry — DR-062 projection-mirrored v2 base',
    baseProvenance: 'code.claude.com mcp',
    baseDoc:
      ' * The DR-062 projection-mirrored v2 base (REGENERATED from the captured\n' +
      ' * projection, spec_version 2025-11-25 — not a byte-copy of v1). Required\n' +
      " * presence of upstream's flat floor ([name] only) + the per-transport\n" +
      ' * conditional requiredness (URL-bearing transports require `url`; the stdio\n' +
      " * shape — `type` absent per the documented default, or `type: 'stdio'` —\n" +
      ' * requires `command`) + type/constraint on the upstream-owned fields\n' +
      ' * (kebab-case name, selector enum {stdio,http,streamable-http,sse,ws} under\n' +
      " * upstream's wire name `type`, non-empty command/url, array args, object\n" +
      ' * env). Enum provenance: the Claude Code page, NOT the machine-readable MCP\n' +
      ' * schema (056 finding 4); `ws` is Claude-Code-only; `sse` is deprecated.',
    overlayDoc:
      ' * The IS-only v2 delta: the RELOCATED flat all-required projection choice\n' +
      ' * (type, command, args, env — DR-062 C2 from 056 #1, each carrying a\n' +
      ' * convergence trigger) + the three net-new IS tracking/operational fields\n' +
      ' * carried from the v1 overlay (description, version, enabled) + the SemVer\n' +
      ' * narrowing on version + the RELOCATED optional `metadata` extension object\n' +
      ' * (DR-062 C3 prose). A field whose type is already enforced by the base is\n' +
      ' * not re-typed here — its presence is the required check — to keep messages\n' +
      ' * single-sourced.',
  },
  {
    // ── DR-062 projection-mirrored v2 (tier-3 reconciliation) ──
    // plugin-manifest is the second of the five contracts whose v2 base is
    // REGENERATED from the captured projection (intent-eval-lab
    // specs/_vendor/upstream/plugin-manifest/projection.json) rather than
    // byte-copied from v1: the full documented surface lands in the base (the
    // 11 unmodeled component-path fields + $schema/defaultEnabled/displayName,
    // 058 #1/#3 C1), `commands` widens to upstream's string|array union (058 #2
    // C2), and the IS-only structural encodings relocate to the v2 overlay with
    // convergence triggers (the kebab name pattern + 64-char cap, 058 #5 C3;
    // the `metadata` extension object, 058 #4 C3).
    version: 'v2',
    baseFileSuffix: 'v2',
    name: 'plugin-manifest',
    symbol: 'PluginManifest',
    constPrefix: 'PLUGIN_MANIFEST',
    fieldConstPrefix: 'PLUGIN',
    contractIndex: 2,
    headerSuffix: 'plugin.json manifest — DR-062 projection-mirrored v2 base',
    baseProvenance: 'code.claude.com plugins-reference',
    baseDoc:
      ' * The DR-062 projection-mirrored v2 base (REGENERATED from the captured\n' +
      ' * projection, spec_version unversioned-2026-06-12 — not a byte-copy of the\n' +
      " * frozen v1 base). Required presence of upstream's standardFloor ([name] —\n" +
      " * 'name is the only required field') + type/format on the FULL documented\n" +
      ' * surface: the metadata table ($schema, version, description, displayName,\n' +
      ' * author object with a required inner name, homepage/repository URIs,\n' +
      ' * license, keywords, defaultEnabled) + the component-path table\n' +
      ' * (commands/agents/skills/outputStyles string|array; hooks/mcpServers/\n' +
      ' * lspServers string|array|object; channels/dependencies arrays;\n' +
      ' * experimental {monitors, themes} each string|array; userConfig object).\n' +
      ' * The kebab-case name pattern + 64-char cap are NOT here — upstream\n' +
      ' * documents kebab-case in prose only, so the structural encoding lives in\n' +
      ' * the overlay (DR-062 C3, 058 #5). Length of `description` is intentionally\n' +
      ' * NOT capped here — the universal disclosureMarkers fold (v2: 1024) is the\n' +
      ' * operative cap.',
    overlayDoc:
      ' * The IS-only v2 delta: the seven upstream-optional metadata fields promoted\n' +
      ' * to IS-required (version, description, author, homepage, license, keywords,\n' +
      ' * commands) + the SemVer narrowing on version + the RELOCATED commands\n' +
      " * array-only narrowing (DR-062 C2, 058 #2 — the v2 base carries upstream's\n" +
      ' * string|array union) + the RELOCATED structural name encoding (kebab\n' +
      ' * pattern + 64-char cap; DR-062 C3, 058 #5 — prose-only upstream) + the\n' +
      ' * RELOCATED optional `metadata` extension object (DR-062 C3, 058 #4). A\n' +
      ' * field whose type is already enforced by the base is not re-typed here —\n' +
      ' * its presence is the required check — to keep messages single-sourced.',
  },
  {
    // ── DR-062 projection-mirrored v2 (tier-3 reconciliation) ──
    // agent-definition is the third of the five contracts whose v2 base is
    // REGENERATED from the captured projection (intent-eval-lab
    // specs/_vendor/upstream/agent-definition/projection.json) rather than
    // byte-copied from v1: the 11 unmodeled documented fields land in the base
    // (background, disallowedTools, effort, hooks, initialPrompt, isolation,
    // maxTurns, mcpServers, memory, permissionMode, skills — 059 #1 C1),
    // `tools` widens to the documented comma-separated-string|array union
    // (059 #3 C2), `model` widens to the documented full-model-ID latitude
    // (059 #4 C2), and the IS-only encodings relocate to the v2 overlay with
    // convergence triggers (the `metadata` extension object, 059 #2 C3; the
    // kebab name pattern + 64-char cap, 059 #5 C3). The sample-only
    // `color: magenta` tolerance is NOT adopted (059 #6 C4 — the
    // documented-vs-observed provenance rule).
    version: 'v2',
    baseFileSuffix: 'v2',
    name: 'agent-definition',
    symbol: 'AgentDefinition',
    constPrefix: 'AGENT_DEFINITION',
    fieldConstPrefix: 'AGENT',
    contractIndex: 3,
    headerSuffix: 'subagent frontmatter — DR-062 projection-mirrored v2 base',
    baseProvenance: 'code.claude.com sub-agents',
    baseDoc:
      ' * The DR-062 projection-mirrored v2 base (REGENERATED from the captured\n' +
      ' * projection, spec_version unversioned-2026-06-12 — not a byte-copy of the\n' +
      " * frozen v1 base). Required presence of upstream's standardFloor\n" +
      " * ([name, description] — 'Only name and description are required') +\n" +
      ' * type/constraint on the FULL documented surface: name as a bare string\n' +
      ' * (kebab-case is prose-only upstream — the structural encoding lives in\n' +
      ' * the overlay per DR-062 C3, 059 #5); tools as the documented\n' +
      ' * comma-separated-string|array union (059 #3 C2); model as a bare string\n' +
      ' * (the documented full-model-ID latitude — 059 #4 C2); the documented\n' +
      ' * enums permissionMode/memory/effort/isolation/color (magenta NOT\n' +
      ' * adopted — 059 #6 C4); maxTurns as a non-negative integer; skills as an\n' +
      ' * array of strings; mcpServers as a bare array (string|object entries —\n' +
      ' * no single documented item shape); hooks as a generic object;\n' +
      ' * disallowedTools/initialPrompt as strings. Length of `description` is\n' +
      ' * intentionally NOT capped here — the universal disclosureMarkers fold\n' +
      ' * (v2: 1024) is the operative cap.',
    overlayDoc:
      ' * The IS-only v2 delta: three upstream-optional fields promoted to\n' +
      ' * IS-required (tools, model, color) + three net-new IS-required tracking\n' +
      ' * fields (version, author, tags — the same trio skill-frontmatter\n' +
      ' * carries) + the SemVer narrowing on version + the RELOCATED tools\n' +
      " * array-only narrowing (DR-062 C2, 059 #3 — the v2 base carries upstream's\n" +
      ' * string|array union) + the RELOCATED model closed-enum narrowing\n' +
      ' * (DR-062 C2, 059 #4 — the v2 base carries the documented full-model-ID\n' +
      ' * latitude) + the RELOCATED structural name encoding (kebab pattern +\n' +
      ' * 64-char cap; DR-062 C3, 059 #5 — prose-only upstream) + the RELOCATED\n' +
      ' * optional `metadata` extension object (DR-062 C3, 059 #2). A field whose\n' +
      ' * type is already enforced by the base is not re-typed here — its\n' +
      ' * presence is the required check — to keep messages single-sourced.',
  },
  {
    // ── DR-062 projection-mirrored v2 (tier-3 reconciliation) ──
    // hook-config is the fourth of the five contracts whose v2 base is
    // REGENERATED from the captured projection (intent-eval-lab
    // specs/_vendor/upstream/hook-config/projection.json) rather than
    // byte-copied from v1: the documented 3-LEVEL NESTING (event →
    // [{matcher, hooks:[handler…]}]) replaces v1's flattened single-handler
    // shape (060 #1 C1), the 18 documented handler fields land in the base
    // with per-type conditional requiredness for all five handler types
    // (060 #3/#5 C1), `matcher` widens to the documented match-all forms —
    // omitted / empty / star (060 #2 C2), and the IS-only encodings relocate
    // to the v2 overlay with convergence triggers (the explicit-non-empty-
    // matcher requirement, 060 #2 C2; the `metadata` extension object,
    // 060 #4 C3). The sample-only rewakeMessage/rewakeSummary fields are NOT
    // adopted (060 #6 C4 — the documented-vs-observed provenance rule).
    // DEPTH BOUNDARY: the nested matcher-group/handler shapes are enforced by
    // the published JSON Schema (ajv); this keyword-driven codegen emits the
    // generic-object check for `hooks` (same posture as agent-definition's
    // `hooks` field), so the deep narrowings are ajv-side — documented in the
    // baseDoc/overlayDoc below.
    version: 'v2',
    baseFileSuffix: 'v2',
    name: 'hook-config',
    symbol: 'HookConfig',
    constPrefix: 'HOOK_CONFIG',
    fieldConstPrefix: 'HOOK',
    contractIndex: 5,
    headerSuffix: 'hooks-block document — DR-062 projection-mirrored v2 base',
    baseProvenance: 'code.claude.com hooks',
    baseDoc:
      ' * The DR-062 projection-mirrored v2 base (REGENERATED from the captured\n' +
      ' * projection, spec_version unversioned-2026-06-12 — not a byte-copy of the\n' +
      " * frozen v1 base). The documented 3-LEVEL NESTING replaces v1's flattened\n" +
      ' * single-handler shape (060 #1 C1): the document is {hooks: {<Event>:\n' +
      " * [{matcher?, hooks: [handler…]}]}}. Required presence of upstream's floor\n" +
      ' * ([hooks]) + the object type check. DEPTH BOUNDARY: the nested 30-event\n' +
      ' * propertyNames enum, the matcher match-all forms (omitted / empty / star\n' +
      ' * — 060 #2 C2), the 18 documented handler fields (060 #3 C1), and the\n' +
      ' * per-type conditional requireds for all five handler types (060 #5 C1)\n' +
      ' * are enforced by the published JSON Schema (ajv); this generated layer\n' +
      ' * checks the top-level surface only (keyword-driven codegen, no\n' +
      " * deep-nesting emit — same posture as agent-definition's generic `hooks`\n" +
      ' * object). This contract carries no `name` — a hooks document has no\n' +
      ' * public identifier, so the universal securityChecks name fold simply\n' +
      ' * does not fire.',
    overlayDoc:
      ' * The IS-only v2 delta: the RELOCATED optional `metadata` extension object\n' +
      ' * (DR-062 C3, 060 #4) at the top level — the only codegen-visible overlay\n' +
      ' * field. The RELOCATED explicit-non-empty-matcher requirement (DR-062 C2,\n' +
      ' * 060 #2) and the per-handler IS quartet carried from the v1 overlay\n' +
      ' * (description, enabled, timeout integer >= 0, blocking) bind as DEEP\n' +
      " * narrowings inside the overlay's `hooks` member — enforced by the\n" +
      ' * published JSON Schema (ajv) via composition; this generated layer emits\n' +
      " * no deep checks (the `hooks` field's type is the base's). The overlay\n" +
      ' * adds NO top-level required fields — the IS requiredness on this contract\n' +
      ' * lives inside the nesting the v2 base adopted.',
  },
  {
    // ── DR-062 projection-mirrored v2 (tier-3 reconciliation) ──
    // marketplace-catalog is the fifth and last of the five contracts whose v2
    // base is REGENERATED from the captured projection (intent-eval-lab
    // specs/_vendor/upstream/marketplace-catalog/projection.json) rather than
    // byte-copied from v1: the 4 documented top-level optionals + the
    // documented `metadata` surface (pluginRoot + the description/version
    // back-compat keys), all 18 documented plugin-entry optionals, and the 5
    // documented source forms join the base (061 #2/#3/#4 C1); `plugins`
    // carries NO minItems (the doc states no minimum — the corpus-rationalized
    // minItems 1 relocates to the overlay, 061 #1 C3); the structural kebab
    // name pattern + 64-char cap relocate to the overlay (prose-only upstream,
    // 061 #5 C3) while the doc's 14 RESERVED NAMES — documented upstream —
    // adopt into the base as a negated enum (the 061 #5 carve-out, C1). The
    // sample-only tolerances (`commit` on github sources, `path` on url
    // sources, the non-kebab plugin name wordpress.com) are NOT adopted
    // (061 #6 C4 — the documented-vs-observed provenance rule). DEPTH
    // BOUNDARY: the per-entry field shapes and the 5 source forms are enforced
    // by the published JSON Schema (ajv); this keyword-driven codegen emits
    // the array-of-objects nested-required check for `plugins` (entry floor
    // [name, source]) and the top-level surface only — same posture as
    // hook-config's nesting.
    version: 'v2',
    baseFileSuffix: 'v2',
    name: 'marketplace-catalog',
    symbol: 'MarketplaceCatalog',
    constPrefix: 'MARKETPLACE_CATALOG',
    fieldConstPrefix: 'MARKETPLACE',
    contractIndex: 6,
    headerSuffix: 'marketplace.json catalog — DR-062 projection-mirrored v2 base',
    baseProvenance: 'code.claude.com plugin-marketplaces',
    baseDoc:
      ' * The DR-062 projection-mirrored v2 base (REGENERATED from the captured\n' +
      ' * projection, spec_version unversioned-2026-06-12 — not a byte-copy of the\n' +
      " * frozen v1 base). Required presence of upstream's standardFloor\n" +
      ' * ([name, owner, plugins]) + type/constraint on the FULL documented\n' +
      ' * surface: name as a bare string guarded by the documented 14-entry\n' +
      ' * reserved-name blocklist (the 061 #5 carve-out — kebab-case is prose-only\n' +
      ' * upstream, so the structural encoding lives in the overlay per DR-062 C3);\n' +
      ' * owner as an object with a required inner name; plugins as an array of\n' +
      ' * entry objects each requiring [name, source] with NO minItems (the doc\n' +
      ' * states no minimum); the documented top-level optionals $schema,\n' +
      ' * description, version, allowCrossMarketplaceDependenciesOn; and the\n' +
      ' * DOCUMENTED metadata surface (metadata.pluginRoot + the\n' +
      ' * description/version back-compat keys) — unlike the sibling contracts,\n' +
      " * this contract's metadata is upstream-documented, so it lives in the\n" +
      ' * BASE. The 18 documented entry optionals + the 5 documented source forms\n' +
      ' * (./-prefixed relative-path string; github/url/git-subdir/npm object\n' +
      ' * types under the `source` discriminator) are enforced by the published\n' +
      ' * JSON Schema (ajv); this generated layer checks the entry floor + the\n' +
      ' * top-level surface only (depth boundary — the hook-config posture).',
    overlayDoc:
      ' * The IS-only v2 delta: two upstream-optional fields promoted to\n' +
      ' * IS-required (version — NARROWED to strict SemVer 2.0.0 — and\n' +
      ' * description) + three net-new IS-required fields (license, homepage URI,\n' +
      ' * keywords) + the RELOCATED plugins minItems 1 (DR-062 C3, 061 #1 — the\n' +
      ' * corpus-rationalized minimum the doc does not state) + the RELOCATED\n' +
      ' * structural name encoding (kebab pattern + 64-char cap; DR-062 C3,\n' +
      ' * 061 #5 — prose-only upstream). NO metadata entry here: the documented\n' +
      ' * metadata surface lives in the v2 base (the 061 #2 convergence condition\n' +
      ' * is already satisfied upstream). A field whose type is already enforced\n' +
      ' * by the base is not re-typed here — its presence is the required check —\n' +
      ' * to keep messages single-sourced.',
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

/** The upstream-base filename is `<contract>.<baseFileSuffix>.json` (default v1; see ContractSpec). */
function baseSchema(spec: ContractSpec): LayerSchema {
  const file = `${spec.name}.${spec.baseFileSuffix ?? 'v1'}.json`;
  return loadJson<LayerSchema>(join(authoringDir(spec.version), 'upstream-base', file));
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
 * The non-empty (minLength >= 1) emit for the universal-fold-owned `description`
 * field. Across every contract the base leaves `description`'s TYPE to itself
 * (type-only check) and its TOKEN-BUDGET CAP to the disclosureMarkers fold — but
 * the fold only caps the MAXimum, so a base schema that declares `minLength: 1`
 * on `description` (every authoring base does, per agentskills.io "1-1024 chars,
 * non-empty") needs the FLOOR mirrored somewhere for the Zod layer to agree with
 * ajv (which enforces it from the base schema). v1 is BYTE-FROZEN at 0.4.1 and its
 * Zod was authored without this floor, so the emit is GATED to the v2 family —
 * adding it to v1 would be a forbidden tightening of the frozen contract.
 */
function descriptionNonEmptyCheck(): string[] {
  return [
    `  if ('description' in artifact) {`,
    `    const description = artifact['description'];`,
    `    if (typeof description !== 'string') {`,
    `      issues.push({ message: 'description must be a string', path: ['description'] });`,
    `    } else if (description.length < 1) {`,
    `      issues.push({ message: 'description must not be empty', path: ['description'] });`,
    `    }`,
    `  }`,
  ];
}

/**
 * Render the per-field type/constraint checks for a base-layer field, dispatched
 * off the field's JSON-Schema keywords (type / pattern / maxLength / format /
 * items / nested-required) — NOT off the field name. This is what lets a new
 * contract's distinct fields generate without per-name special-casing.
 *
 * `version` gates the v2-only `description` non-empty floor (see
 * descriptionNonEmptyCheck): the v1 family is byte-frozen, so a tightening of its
 * generated Zod is forbidden — only the v2 family mirrors the base `minLength`.
 */
function baseFieldCheck(
  field: string,
  schema: FieldSchema,
  fieldConstPrefix: string,
  version: AuthoringVersion,
): string[] {
  const lines: string[] = [];
  const access = `artifact['${field}']`;

  // v2-only: the `description` non-empty floor. The base schema declares
  // `minLength: 1` on `description` (agentskills.io "non-empty"); ajv enforces it,
  // and the disclosureMarkers fold caps only the MAXimum — so the v2 Zod mirrors
  // the FLOOR here to keep ajv ↔ Zod fold-agreement. v1 stays type-only (frozen):
  // mirroring the floor into v1 would tighten the byte-frozen 0.4.1 contract.
  if (
    version === 'v2' &&
    field === 'description' &&
    schema.type === 'string' &&
    (schema.minLength ?? 0) >= 1
  ) {
    return descriptionNonEmptyCheck();
  }

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

  // anyOf [ string, array-of-strings ] — the documented string|array latitude on
  // a BASE field (DR-062 projection-mirrored v2: plugin-manifest component-path
  // fields like `commands`/`agents`/`skills`/`outputStyles`, and the
  // `experimental` sub-fields). Same feature-gated union shape the overlay
  // branch recognizes (isStringOrStringArrayAnyOf); accepts a string OR a
  // string[]; everything else is an issue.
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

  // anyOf [ string, array-of-strings, object ] — the documented
  // string|array|object latitude on a BASE field (DR-062 projection-mirrored
  // v2: plugin-manifest `hooks`/`mcpServers`/`lspServers` — a config file path,
  // an array of paths, or an inline object). Feature-gated to exactly this
  // 3-member union (isStringOrStringArrayOrObjectAnyOf).
  if (isStringOrStringArrayOrObjectAnyOf(schema)) {
    const v = camel(field);
    const cond = `typeof ${v} !== 'string' && !isStringArray(${v}) && !isPlainObject(${v})`;
    const single = `    if (${cond}) {`;
    const condLines =
      single.length <= 100
        ? [single]
        : [
            `    if (`,
            `      typeof ${v} !== 'string' &&`,
            `      !isStringArray(${v}) &&`,
            `      !isPlainObject(${v})`,
            `    ) {`,
          ];
    lines.push(
      `  if ('${field}' in artifact) {`,
      `    const ${v} = ${access};`,
      ...condLines,
      `      issues.push({`,
      `        message: '${field} must be a string, an array of strings, or an object',`,
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

  // Bare array with a minItems floor and NO item shape (DR-062 relocated
  // narrowing: marketplace-catalog overlay `plugins` minItems 1 — 061 #1, the
  // corpus-rationalized minimum relocated from the v1 base; the v2 base carries
  // the full documented item shape, the overlay re-states only the array form +
  // the floor). Feature-gated: no v1 schema declares a bare minItems array, so
  // all other generated outputs are byte-identical.
  if (schema.type === 'array' && schema.items === undefined && (schema.minItems ?? 0) > 0) {
    lines.push(
      `  if ('${field}' in artifact) {`,
      `    const ${field} = ${access};`,
      `    if (!Array.isArray(${field})) {`,
      `      issues.push({ message: '${field} must be an array', path: ['${field}'] });`,
      `    } else if (${field}.length < ${schema.minItems}) {`,
      `      issues.push({ message: '${field} must not be empty', path: ['${field}'] });`,
      `    }`,
      `  }`,
    );
    return lines;
  }

  // Generic array — NO documented item shape (DR-062 projection-mirrored v2:
  // plugin-manifest `channels`/`dependencies`, whose projection type is the
  // bare `array`). The base mirrors the projection: Array.isArray only —
  // inventing an item type would exceed the documented surface. Prettier-aware:
  // a long field name (e.g. marketplace-catalog
  // `allowCrossMarketplaceDependenciesOn`) pushes the single-line forms past
  // the 100-char print width, so emit the wrapped forms prettier produces.
  if (schema.type === 'array' && schema.items === undefined) {
    const single = `  if ('${field}' in artifact && !Array.isArray(${access})) {`;
    const pushSingle = `    issues.push({ message: '${field} must be an array', path: ['${field}'] });`;
    if (single.length <= 100 && pushSingle.length <= 100) {
      lines.push(single, pushSingle, `  }`);
    } else {
      lines.push(
        `  if (`,
        `    '${field}' in artifact &&`,
        `    !Array.isArray(${access})`,
        `  ) {`,
        `    issues.push({`,
        `      message: '${field} must be an array',`,
        `      path: ['${field}'],`,
        `    });`,
        `  }`,
      );
    }
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

  // Object whose declared properties are ALL optional string|array unions and
  // which has no nested required (DR-062 projection-mirrored v2: plugin-manifest
  // `experimental` = {monitors?, themes?}, each string|array per the projection's
  // dotted `experimental.monitors`/`experimental.themes` rows). Emits the nested
  // per-key union checks so the Zod layer mirrors ajv's nested validation.
  if (isObjectOfUnionProps(schema)) {
    const v = camel(field);
    const keys = Object.keys(schema.properties ?? {})
      .map((k) => `'${k}'`)
      .join(', ');
    lines.push(
      `  if ('${field}' in artifact) {`,
      `    const ${v} = ${access};`,
      `    if (!isPlainObject(${v})) {`,
      `      issues.push({ message: '${field} must be an object', path: ['${field}'] });`,
      `    } else {`,
      `      for (const key of [${keys}] as const) {`,
      `        const value = ${v}[key];`,
      `        if (key in ${v} && typeof value !== 'string' && !isStringArray(value)) {`,
      `          issues.push({`,
      `            message: \`${field}.\${key} must be a string or an array of strings\`,`,
      `            path: ['${field}', key],`,
      `          });`,
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

  // Bare string with an upstream-documented RESERVED-NAME blocklist — a negated
  // enum (`not.enum`) on a string field (DR-062 C1, the 061 #5 carve-out:
  // marketplace-catalog's 14 reserved names are DOCUMENTED upstream, so the
  // blocklist adopts into the v2 BASE while the prose-only kebab encoding
  // relocates to the overlay). Feature-gated to exactly the bare-string +
  // not.enum shape; no v1 schema declares one, so all other generated outputs
  // are byte-identical.
  if (
    schema.type === 'string' &&
    schema.not?.enum !== undefined &&
    schema.pattern === undefined &&
    schema.maxLength === undefined &&
    schema.enum === undefined
  ) {
    const reservedConst = constName(fieldConstPrefix, field, 'RESERVED');
    lines.push(
      `  if ('${field}' in artifact) {`,
      `    const ${field} = artifact['${field}'];`,
      `    if (typeof ${field} !== 'string') {`,
      `      issues.push({ message: '${field} must be a string', path: ['${field}'] });`,
      `    } else if ((${reservedConst} as readonly string[]).includes(${field})) {`,
      `      issues.push({`,
      `        message: '${field} must not be an upstream-reserved marketplace name',`,
      `        path: ['${field}'],`,
      `      });`,
      `    }`,
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
 * Whether an overlay STRING field NARROWS the base with a non-empty floor that the
 * base layer does not already enforce — i.e. the overlay declares `minLength >= 1`
 * on a plain scalar string (no pattern / format / enum / SemVer / scoped-tool /
 * union shape, which carry their own dedicated emit) AND the base either does not
 * declare that field or declares it without the same `minLength` floor. This is
 * the v2 `author` (net-new, minLength 1), `license`/`compatibility` (promoted from
 * the base, which types them but does NOT floor them) case — the ajv ↔ Zod
 * fold-agreement gap the v2 Zod must close. v1 is byte-frozen, so this emit is
 * GATED to the v2 family by the caller.
 */
function overlayNarrowsNonEmpty(
  field: string,
  schema: FieldSchema,
  baseProps: Readonly<Record<string, FieldSchema>>,
): boolean {
  if (
    schema.type !== 'string' ||
    (schema.minLength ?? 0) < 1 ||
    schema.pattern !== undefined ||
    schema.format !== undefined ||
    schema.enum !== undefined ||
    schema.maxLength !== undefined
  ) {
    return false;
  }
  const baseFloor = baseProps[field]?.minLength ?? 0;
  return (schema.minLength ?? 0) > baseFloor;
}

/**
 * Render the per-field narrowing checks for an overlay-layer field, dispatched
 * off JSON-Schema keywords. A field whose TYPE is already enforced by the base
 * (the overlay only ADDS it to `required`, re-declaring no narrowing constraint)
 * is skipped here — its presence is the required check, its type the base's — to
 * keep messages single-sourced.
 *
 * `version` gates the v2-only non-empty narrowing (overlayNarrowsNonEmpty): the v1
 * family is byte-frozen, so its generated Zod must not gain a tightening — only the
 * v2 family mirrors the overlay's `minLength` floor on `author`/`license`/
 * `compatibility`.
 */
function overlayFieldCheck(
  field: string,
  schema: FieldSchema,
  baseProps: Readonly<Record<string, FieldSchema>>,
  fieldConstPrefix: string,
  version: AuthoringVersion,
): string[] {
  const lines: string[] = [];
  const access = `artifact['${field}']`;

  // v2-only: the overlay non-empty floor. When the overlay narrows a plain scalar
  // string with `minLength >= 1` that the base does not floor (v2 `author` —
  // net-new — and `license`/`compatibility` — promoted from a base that types but
  // does not floor them), emit the type + non-empty check so the v2 Zod agrees
  // with ajv (which enforces the floor from the overlay schema). This runs BEFORE
  // the `field in baseProps` single-sourcing short-circuit below, because for a
  // promoted field the FLOOR is the overlay's narrowing — not a base constraint —
  // so it would otherwise be silently dropped. v1 stays as-is (frozen): mirroring
  // the floor into v1 would tighten the byte-frozen 0.4.1 contract.
  if (version === 'v2' && overlayNarrowsNonEmpty(field, schema, baseProps)) {
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

  // String NARROWED to a closed enum by the overlay while the base carries the
  // documented wider latitude (DR-062 projection-mirrored v2: agent-definition
  // `model` — the v2 base admits the documented full-model-ID latitude; the IS
  // closed alias-enum narrowing relocates here per DR-062 C2, 059 #4). Emits the
  // same type + membership check as the base enum branch, against the
  // overlay-emitted VALUES const, so ajv and the generated Zod agree on the
  // narrowing. Feature-gated: no v1 overlay declares an enum, so the v1 output
  // is byte-identical.
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
 * The feature-gate for the DR-062 string|array|object base latitude (plugin-manifest
 * `hooks`/`mcpServers`/`lspServers`): is this field an `anyOf` that is EXACTLY the
 * 3-member union of a bare string, an array-of-strings, and a bare object (no
 * nested required/properties)? Recognizing only this precise shape keeps the
 * codegen keyword-driven; any other 3-member anyOf falls through unrecognized
 * rather than silently mis-generating.
 */
function isStringOrStringArrayOrObjectAnyOf(schema: FieldSchema): boolean {
  if (schema.anyOf?.length !== 3) {
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
  const isBareObject = (s: FieldSchema): boolean =>
    s.type === 'object' && s.required === undefined && s.properties === undefined;
  const members = schema.anyOf;
  return (
    members.some(isBareString) && members.some(isStringArrayMember) && members.some(isBareObject)
  );
}

/**
 * The feature-gate for the DR-062 nested-union object (plugin-manifest
 * `experimental`): an object field with NO nested required whose declared
 * properties are ALL the string|array union. Drives the nested per-key union
 * emit in baseFieldCheck (the ajv ↔ Zod fold-agreement mirror for the nested
 * property types). An object with a nested `required` (e.g. `author`) or with
 * non-union properties is NOT recognized here.
 */
function isObjectOfUnionProps(schema: FieldSchema): boolean {
  if (schema.type !== 'object' || schema.properties === undefined) {
    return false;
  }
  if (schema.required !== undefined && schema.required.length > 0) {
    return false;
  }
  const props = Object.values(schema.properties);
  return props.length > 0 && props.every((p) => isStringOrStringArrayAnyOf(p));
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

// ─── Layer-level conditional requiredness (DR-062 per-transport shapes) ──────

interface ParsedConditionalRequire {
  readonly selector: string;
  readonly values: readonly string[];
  readonly thenRequired: readonly string[];
  readonly elseRequired: readonly string[];
}

/**
 * The feature-gate for the DR-062 per-transport conditional requiredness: a
 * base-layer `allOf` member is recognized IFF it is exactly the
 * if(ONE selector property constrained by a bare enum, `required: [selector]`)
 * / then(required) / else(required) shape. The `required: [selector]` on the
 * `if` makes an ABSENT selector fall to the else branch — mirroring upstream's
 * documented default (e.g. mcp-config: `type` absent ⇒ stdio ⇒ `command`
 * required). Any other layer-level allOf member THROWS rather than silently
 * mis-generating — a silently ignored base constraint would break the
 * ajv ↔ Zod fold agreement the D8 backstop asserts.
 */
function parseConditionalRequires(layer: LayerSchema): ParsedConditionalRequire[] {
  return (layer.allOf ?? []).map((member) => {
    const props = member.if?.properties ?? {};
    const keys = Object.keys(props);
    const selector = keys[0];
    const values = selector !== undefined ? props[selector]?.enum : undefined;
    const thenRequired = member.then?.required ?? [];
    const elseRequired = member.else?.required ?? [];
    const recognized =
      keys.length === 1 &&
      selector !== undefined &&
      values !== undefined &&
      values.length > 0 &&
      member.if?.required?.length === 1 &&
      member.if.required[0] === selector &&
      thenRequired.length > 0 &&
      elseRequired.length > 0;
    if (!recognized || selector === undefined || values === undefined) {
      throw new Error(
        `codegen-authoring: unrecognized layer-level allOf member in ${layer.$id} — only the ` +
          'if(selector ∈ enum)/then(required)/else(required) conditional-require shape is supported.',
      );
    }
    return { selector, values, thenRequired, elseRequired };
  });
}

/**
 * Render the conditional-required block(s) for `upstreamBaseIssues`, mirroring
 * ajv's if/then/else semantics exactly: the then-branch fires IFF the selector
 * is present AND a string AND in the enum; everything else (absent selector —
 * the documented upstream default — or any other value, whose own enum/type
 * check reports separately) falls to the else branch.
 */
function conditionalRequiredBlock(conditionals: readonly ParsedConditionalRequire[]): string {
  if (conditionals.length === 0) {
    return '';
  }
  const blocks = conditionals.map((c) => {
    const values = `[${c.values.map((v) => `'${v}'`).join(', ')}]`;
    const thenArr = `[${c.thenRequired.map((v) => `'${v}'`).join(', ')}]`;
    const elseArr = `[${c.elseRequired.map((v) => `'${v}'`).join(', ')}]`;
    return [
      `  // Conditional requiredness (the base schema's if/then/else allOf): when`,
      `  // '${c.selector}' is one of the then-branch selector values the then-required`,
      `  // fields apply; otherwise (selector absent — the documented upstream default —`,
      `  // or any other value) the else-required fields apply.`,
      `  {`,
      `    const selector = artifact['${c.selector}'];`,
      `    const inThen =`,
      `      typeof selector === 'string' &&`,
      `      (${values} as readonly string[]).includes(selector);`,
      `    issues.push(...requiredFieldsIssues(artifact, inThen ? ${thenArr} : ${elseArr}));`,
      `  }`,
    ].join('\n');
  });
  return `\n${blocks.join('\n\n')}\n`;
}

/**
 * Whether any overlay field constrains via SemVer (drives the SEMVER_PATTERN
 * const). A pattern-bearing string field that ALSO carries a maxLength is NOT a
 * SemVer narrowing — it is the DR-062-relocated structural name encoding (kebab
 * pattern + length cap), which emits via the base-shaped kebab branch + its own
 * per-field constants, never via SEMVER_PATTERN.
 */
function usesSemver(overlayProps: Readonly<Record<string, FieldSchema>>): string | undefined {
  for (const schema of Object.values(overlayProps)) {
    if (
      schema.type === 'string' &&
      schema.pattern !== undefined &&
      schema.maxLength === undefined
    ) {
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
  // The DR-062 3-member union + the nested-union object both emit isStringArray
  // calls (the array-form member / the nested per-key union checks).
  if (all.some((s) => isStringOrStringArrayOrObjectAnyOf(s) || isObjectOfUnionProps(s))) {
    return true;
  }
  return visibilityFields.length > 0 || hasEnvVars;
}

/** Whether any field (base or overlay) needs the isPlainObject helper. */
function usesPlainObject(
  baseProps: Readonly<Record<string, FieldSchema>>,
  overlayProps: Readonly<Record<string, FieldSchema>>,
  hasEnvVars: boolean,
): boolean {
  const all = [...Object.values(baseProps), ...Object.values(overlayProps)];
  return (
    all.some(
      (s) =>
        s.type === 'object' ||
        (s.type === 'array' && s.items?.type === 'object') ||
        // The DR-062 3-member union's object-form check needs isPlainObject too.
        isStringOrStringArrayOrObjectAnyOf(s),
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
  const needPlainObject = usesPlainObject(baseProps, overlayProps, hasEnvVars);

  // Base-layer checks: every declared base property gets a check, in declaration
  // order (the JSON Schema's key order is the canonical order).
  const baseChecks = Object.keys(baseProps)
    .map((f) => baseFieldCheck(f, baseProps[f] ?? {}, fieldConstPrefix, spec.version).join('\n'))
    .join('\n\n');

  // Layer-level conditional requiredness on the base (DR-062 per-transport
  // shapes). Parsed feature-gated; unrecognized base allOf shapes throw.
  const conditionalBlock = conditionalRequiredBlock(parseConditionalRequires(base));

  // Overlay-layer checks: the overlay-required fields in declaration order, then
  // the OPTIONAL (non-required) overlay extension fields (e.g. the DR-062
  // relocated `metadata` object) — the skill-only visibility arrays + env-var
  // extension are handled by their dedicated loops below, so they are excluded
  // here — then the visibility-array loop (if any), then
  // required_environment_variables (if present).
  const overlayCheckBlocks = overlayReq
    .map((f) =>
      overlayFieldCheck(f, overlayProps[f] ?? {}, baseProps, fieldConstPrefix, spec.version).join(
        '\n',
      ),
    )
    .filter((s) => s.length > 0);
  const optionalOverlayBlocks = Object.keys(overlayProps)
    .filter(
      (f) =>
        !overlayReq.includes(f) &&
        !VISIBILITY_FIELDS.has(f) &&
        f !== 'required_environment_variables',
    )
    .map((f) => baseFieldCheck(f, overlayProps[f] ?? {}, fieldConstPrefix, spec.version).join('\n'))
    .filter((s) => s.length > 0);
  const overlayChecks = [...overlayCheckBlocks, ...optionalOverlayBlocks].join('\n\n');

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
    } else if (schema.type === 'string' && schema.not?.enum !== undefined) {
      // The upstream-documented reserved-name blocklist (DR-062 C1, 061 #5
      // carve-out — a negated enum in the BASE). One element per line (the
      // blocklist never fits the 100-char print width).
      const name = constName(fieldConstPrefix, field, 'RESERVED');
      constLines.push(
        `/** ${prov} ${field} reserved-name blocklist (upstream-base — documented, not.enum). */`,
        `export const ${name} = [`,
        ...schema.not.enum.map((v) => `  '${v}',`),
        `] as const;`,
      );
    }
  }
  // DR-062-relocated structural encodings on the OVERLAY (e.g. plugin-manifest
  // v2 `name`: the kebab pattern + 64-char cap live in the overlay because
  // upstream documents kebab-case in prose only — DR-062 C3). Same const shape
  // as the base kebab emission, provenance-labelled as overlay policy.
  for (const [field, schema] of Object.entries(overlayProps)) {
    if (
      schema.type === 'string' &&
      schema.pattern !== undefined &&
      schema.maxLength !== undefined
    ) {
      constLines.push(
        `/** IS kebab-case ${field} surface (is-overlay — DR-062 relocated structural encoding). */`,
        `export const ${constName(fieldConstPrefix, field, 'PATTERN')} = ${jsRegexLiteral(schema.pattern)};`,
        `/** IS ${field} length ceiling (is-overlay — DR-062 relocated structural encoding). */`,
        `export const ${constName(fieldConstPrefix, field, 'MAX')} = ${schema.maxLength};`,
      );
    } else if (schema.type === 'string' && schema.enum !== undefined) {
      // DR-062-relocated closed-enum narrowing on the OVERLAY (e.g.
      // agent-definition v2 `model`: the alias set lives in the overlay because
      // the documented surface carries the full-model-ID latitude — DR-062 C2).
      // Same prettier-aware emission shape as the base enum const.
      const name = constName(fieldConstPrefix, field, 'VALUES');
      const single = `export const ${name} = [${schema.enum.map((v) => `'${v}'`).join(', ')}] as const;`;
      constLines.push(
        `/** IS ${field} allowed values (is-overlay — DR-062 relocated closed-enum narrowing). */`,
      );
      if (single.length <= 100) {
        constLines.push(single);
      } else {
        constLines.push(
          `export const ${name} = [`,
          ...schema.enum.map((v) => `  '${v}',`),
          `] as const;`,
        );
      }
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

  // The constraint-constants section. A contract whose base+overlay declare no
  // pattern/enum/length constants (hook-config v2 — its constraint surface is
  // the deep ajv-side nesting) omits the section header entirely rather than
  // emitting an empty block prettier would collapse; contracts WITH constants
  // produce byte-identical output to the pre-gate template.
  const constSection =
    constLines.length > 0
      ? `// ─── Constraint constants (mirror the JSON Schemas exactly) ──────────────────\n\n${constLines.join('\n')}\n${visibilityConst}${helperBlock}`
      : `${visibilityConst}${helperBlock}`.replace(/^\n/, '');

  // Family-aware header paths. v1 keeps its EXACT historical strings (the v1
  // generated output must stay byte-identical); v2 references its own family tree
  // + the `.v2.json` overlay + the v2 test file.
  const schemaDir = `schemas/authoring/${spec.version}`;
  const baseName = `${spec.name}.${spec.baseFileSuffix ?? 'v1'}.json`;
  const overlayName = `${spec.name}.${overlayFileSuffix(spec.version)}.json`;
  const testName =
    spec.version === 'v1'
      ? `${spec.name}-schema.test.ts`
      : `${spec.name}-${spec.version}-schema.test.ts`;

  return `/**
 * ${spec.name} — IS marketplace-tier authoring contract #${spec.contractIndex} (${spec.headerSuffix}).
 *
 * GENERATED by scripts/codegen-authoring.ts from the three-artifact composition:
 *   ${schemaDir}/upstream-base/${baseName}   (authored by THEM)
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

${constSection}
// ─── Layer 1: upstream base (authored by THEM) ───────────────────────────────

/**
${spec.baseDoc}
 */
export function upstreamBaseIssues(artifact: AuthoringArtifact): FoldIssue[] {
${baseInit}

${baseChecks}
${conditionalBlock}
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
