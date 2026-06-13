/**
 * Authoring-tier Zod validators v2 (STRICT profile) — barrel export.
 *
 * The STRICT v2 fork of the Spec Authority Kernel (SAK) authoring contracts
 * (DR-049 + the CCP kernel-shadow finding). `skill-frontmatter` was forked first
 * (closes the 4 CCP-shadow frontmatter gaps: scoped-Bash, widened
 * shell-substitution detection, description cap 1024, reserved-name substring
 * hardening); per DR-062 the five remaining contracts gain v2 siblings whose
 * upstream bases are REGENERATED from the captured projections (documented
 * fields only, upstream requiredness, upstream wire forms) with every IS
 * narrowing relocated to the overlay. v1 is BYTE-FROZEN at
 * `@intentsolutions/core@0.4.1`.
 *
 * The v2 `marketplace-tier` foundation is a self-contained, HAND-AUTHORED copy of
 * the v1 foundation with three fold tightenings (it has zero import from the v1
 * validators — copy-then-tighten). The v2 `skill-frontmatter` validator is
 * codegen-generated from the v2 base + overlay.
 *
 * The composed `SkillFrontmatterSchema` is re-exported under the **`*V2`**-suffixed
 * name (`SkillFrontmatterV2Schema`, etc.) so it does not collide with the v1
 * surface when both are pulled into the package. The generic per-layer symbols
 * (`upstreamBaseIssues`, `isOverlayIssues`, `SEMVER_PATTERN`, …) are layer
 * internals — single-sourced by the codegen and intentionally NOT re-exported
 * (a consumer needing one imports it per-file).
 *
 * Reachable as `@intentsolutions/core/validators/v1/authoring/v2`.
 */

// The shared v2 universal-fold foundation (STRICT). Re-exported under V2-suffixed
// names so it does not collide with the v1 foundation's identical symbol names.
export {
  type AuthoringArtifact,
  type FoldIssue,
  IS_MARKETPLACE_DEPRECATED_FIELDS as IS_MARKETPLACE_DEPRECATED_FIELDS_V2,
  IS_MARKETPLACE_RESERVED_NAMES as IS_MARKETPLACE_RESERVED_NAMES_V2,
  IS_MARKETPLACE_RESERVED_NAME_SUBSTRINGS,
  SKILL_DESCRIPTION_MAX as SKILL_DESCRIPTION_MAX_V2,
  DeprecationRegistrySchema as DeprecationRegistrySchemaV2,
  SecurityChecksSchema as SecurityChecksSchemaV2,
  DisclosureMarkersSchema as DisclosureMarkersSchemaV2,
  UniversalFoldsSchema as UniversalFoldsSchemaV2,
} from './marketplace-tier.js';

// Contract #1 — skill-frontmatter (STRICT v2; contract-scoped public surface).
export {
  SKILL_FRONTMATTER_BASE_REQUIRED as SKILL_FRONTMATTER_V2_BASE_REQUIRED,
  SKILL_FRONTMATTER_OVERLAY_REQUIRED as SKILL_FRONTMATTER_V2_OVERLAY_REQUIRED,
  SKILL_FRONTMATTER_REQUIRED_FIELDS as SKILL_FRONTMATTER_V2_REQUIRED_FIELDS,
  SKILL_NAME_PATTERN as SKILL_NAME_PATTERN_V2,
  SKILL_NAME_MAX as SKILL_NAME_MAX_V2,
  SKILL_COMPATIBILITY_MAX as SKILL_COMPATIBILITY_MAX_V2,
  ENV_VAR_NAME_PATTERN as ENV_VAR_NAME_PATTERN_V2,
  skillFrontmatterIssues as skillFrontmatterV2Issues,
  SkillFrontmatterSchema as SkillFrontmatterV2Schema,
  type SkillFrontmatter as SkillFrontmatterV2,
} from './skill-frontmatter.js';

// Contract #4 — mcp-config (DR-062 projection-mirrored v2 base; contract-scoped
// public surface). The v2 base mirrors the captured projection (selector wire
// name `type`, `streamable-http` alias, per-transport conditional shapes, `type`
// optional with the stdio default); the relocated IS narrowings bind via the
// overlay + composition.
export {
  MCP_CONFIG_BASE_REQUIRED as MCP_CONFIG_V2_BASE_REQUIRED,
  MCP_CONFIG_OVERLAY_REQUIRED as MCP_CONFIG_V2_OVERLAY_REQUIRED,
  MCP_CONFIG_REQUIRED_FIELDS as MCP_CONFIG_V2_REQUIRED_FIELDS,
  MCP_NAME_PATTERN as MCP_NAME_PATTERN_V2,
  MCP_NAME_MAX as MCP_NAME_MAX_V2,
  MCP_TYPE_VALUES as MCP_TYPE_VALUES_V2,
  mcpConfigIssues as mcpConfigV2Issues,
  McpConfigSchema as McpConfigV2Schema,
  type McpConfig as McpConfigV2,
} from './mcp-config.js';

// Contract #2 — plugin-manifest (DR-062 projection-mirrored v2 base;
// contract-scoped public surface). The v2 base mirrors the captured projection
// (the full documented 23-field surface incl. the 11 component-path fields and
// $schema/defaultEnabled/displayName; `commands` carries upstream's
// string|array union; `name` is a bare string — kebab-case is prose-only
// upstream); the relocated IS narrowings (commands array form, kebab name
// pattern + 64-char cap, the `metadata` extension) bind via the overlay +
// composition.
export {
  PLUGIN_MANIFEST_BASE_REQUIRED as PLUGIN_MANIFEST_V2_BASE_REQUIRED,
  PLUGIN_MANIFEST_OVERLAY_REQUIRED as PLUGIN_MANIFEST_V2_OVERLAY_REQUIRED,
  PLUGIN_MANIFEST_REQUIRED_FIELDS as PLUGIN_MANIFEST_V2_REQUIRED_FIELDS,
  PLUGIN_NAME_PATTERN as PLUGIN_NAME_PATTERN_V2,
  PLUGIN_NAME_MAX as PLUGIN_NAME_MAX_V2,
  pluginManifestIssues as pluginManifestV2Issues,
  PluginManifestSchema as PluginManifestV2Schema,
  type PluginManifest as PluginManifestV2,
} from './plugin-manifest.js';

// Contract #3 — agent-definition (DR-062 projection-mirrored v2 base;
// contract-scoped public surface). The v2 base mirrors the captured projection
// (the full documented 16-field surface incl. the 11 fields v1 never modeled;
// `tools` carries upstream's comma-separated-string|array union; `model`
// carries the documented full-model-ID latitude; `name` is a bare string —
// kebab-case is prose-only upstream); the relocated IS narrowings (tools array
// form, model closed alias enum, kebab name pattern + 64-char cap, the
// `metadata` extension) bind via the overlay + composition. The sample-only
// `color: magenta` tolerance is NOT adopted (DR-062 C4, 059 #6).
export {
  AGENT_DEFINITION_BASE_REQUIRED as AGENT_DEFINITION_V2_BASE_REQUIRED,
  AGENT_DEFINITION_OVERLAY_REQUIRED as AGENT_DEFINITION_V2_OVERLAY_REQUIRED,
  AGENT_DEFINITION_REQUIRED_FIELDS as AGENT_DEFINITION_V2_REQUIRED_FIELDS,
  AGENT_NAME_PATTERN as AGENT_NAME_PATTERN_V2,
  AGENT_NAME_MAX as AGENT_NAME_MAX_V2,
  AGENT_MODEL_VALUES as AGENT_MODEL_VALUES_V2,
  AGENT_COLOR_VALUES as AGENT_COLOR_VALUES_V2,
  AGENT_PERMISSIONMODE_VALUES as AGENT_PERMISSIONMODE_VALUES_V2,
  AGENT_MEMORY_VALUES as AGENT_MEMORY_VALUES_V2,
  AGENT_EFFORT_VALUES as AGENT_EFFORT_VALUES_V2,
  AGENT_ISOLATION_VALUES as AGENT_ISOLATION_VALUES_V2,
  agentDefinitionIssues as agentDefinitionV2Issues,
  AgentDefinitionSchema as AgentDefinitionV2Schema,
  type AgentDefinition as AgentDefinitionV2,
} from './agent-definition.js';

// Contract #5 — hook-config (DR-062 projection-mirrored v2 base;
// contract-scoped public surface). The v2 base mirrors the captured projection
// (the documented 3-level nesting — event → [{matcher, hooks:[handler…]}] —
// replaces v1's flattened single-handler shape; the 18 documented handler
// fields with per-type conditional requiredness for all five handler types;
// `matcher` accepts the documented match-all forms). The relocated IS
// narrowings (explicit non-empty matcher, the per-handler IS quartet, the
// `metadata` extension) bind via the overlay + composition — the deep nested
// constraints are enforced by the published JSON Schema (ajv); the generated
// Zod layer checks the top-level surface (depth boundary documented in the
// generated module). The sample-only rewakeMessage/rewakeSummary fields are
// NOT adopted (DR-062 C4, 060 #6).
export {
  HOOK_CONFIG_BASE_REQUIRED as HOOK_CONFIG_V2_BASE_REQUIRED,
  HOOK_CONFIG_OVERLAY_REQUIRED as HOOK_CONFIG_V2_OVERLAY_REQUIRED,
  HOOK_CONFIG_REQUIRED_FIELDS as HOOK_CONFIG_V2_REQUIRED_FIELDS,
  hookConfigIssues as hookConfigV2Issues,
  HookConfigSchema as HookConfigV2Schema,
  type HookConfig as HookConfigV2,
} from './hook-config.js';

// Contract #6 — marketplace-catalog (DR-062 projection-mirrored v2 base;
// contract-scoped public surface). The v2 base mirrors the captured projection
// (the documented top-level optionals incl. the upstream-documented `metadata`
// surface; all 18 documented plugin-entry optionals; the 5 documented source
// forms under the `source` discriminator; NO minItems on plugins — the doc
// states no minimum; `name` is a bare string guarded by the documented 14-name
// reserved blocklist, the 061 #5 carve-out). The relocated IS narrowings
// (plugins minItems 1, kebab name pattern + 64-char cap) bind via the overlay +
// composition — the per-entry depth (entry field types, source forms) is
// enforced by the published JSON Schema (ajv); the generated Zod layer checks
// the entry floor + the top-level surface (depth boundary documented in the
// generated module). The sample-only tolerances (`commit` on github sources,
// `path` on url sources, wordpress.com) are NOT adopted (DR-062 C4, 061 #6).
export {
  MARKETPLACE_CATALOG_BASE_REQUIRED as MARKETPLACE_CATALOG_V2_BASE_REQUIRED,
  MARKETPLACE_CATALOG_OVERLAY_REQUIRED as MARKETPLACE_CATALOG_V2_OVERLAY_REQUIRED,
  MARKETPLACE_CATALOG_REQUIRED_FIELDS as MARKETPLACE_CATALOG_V2_REQUIRED_FIELDS,
  MARKETPLACE_NAME_PATTERN as MARKETPLACE_NAME_PATTERN_V2,
  MARKETPLACE_NAME_MAX as MARKETPLACE_NAME_MAX_V2,
  MARKETPLACE_NAME_RESERVED as MARKETPLACE_NAME_RESERVED_V2,
  marketplaceCatalogIssues as marketplaceCatalogV2Issues,
  MarketplaceCatalogSchema as MarketplaceCatalogV2Schema,
  type MarketplaceCatalog as MarketplaceCatalogV2,
} from './marketplace-catalog.js';
