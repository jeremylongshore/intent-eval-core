/**
 * Authoring-tier Zod validators v1 — barrel export.
 *
 * The Spec Authority Kernel (SAK) authoring contracts (DR-044). The
 * `marketplace-tier` foundation exposes the three universal folds + a
 * parameterizable `requiredFields` helper that every per-contract authoring
 * schema reuses. `skill-frontmatter` is authoring contract #1 (the walking
 * skeleton); `plugin-manifest` is authoring contract #2 (the first contract that
 * MUST be codegen-generated — DR-044 D8). Both follow the same base +
 * universal-folds + overlay composition.
 *
 * Each per-contract validator emits the SAME generic per-layer symbols
 * (`upstreamBaseIssues`, `isOverlayIssues`, `SEMVER_PATTERN`) — they are layer
 * internals, single-sourced by the codegen, and intentionally NOT re-exported
 * from this barrel (a `export *` of both would make them ambiguous). This barrel
 * re-exports each contract's contract-scoped PUBLIC surface explicitly: the
 * composed `*Schema`, its branded `*` type, its `*_REQUIRED_FIELDS` /
 * `*_BASE_REQUIRED` / `*_OVERLAY_REQUIRED` constant sets, and its contract-named
 * constraint constants. Consumers needing a layer internal import it per-file
 * (`@intentsolutions/core/validators/v1/authoring/<contract>`).
 *
 * Reachable as `@intentsolutions/core/validators/v1/authoring` (direct) or via
 * the parent `@intentsolutions/core/validators/v1` barrel.
 */

// The shared universal-fold foundation (no per-contract collisions here).
export * from './marketplace-tier.js';

// Contract #1 — skill-frontmatter (contract-scoped public surface).
export {
  SKILL_FRONTMATTER_BASE_REQUIRED,
  SKILL_FRONTMATTER_OVERLAY_REQUIRED,
  SKILL_FRONTMATTER_REQUIRED_FIELDS,
  SKILL_NAME_PATTERN,
  SKILL_NAME_MAX,
  SKILL_COMPATIBILITY_MAX,
  ENV_VAR_NAME_PATTERN,
  skillFrontmatterIssues,
  SkillFrontmatterSchema,
  type SkillFrontmatter,
} from './skill-frontmatter.js';

// Contract #2 — plugin-manifest (contract-scoped public surface).
export {
  PLUGIN_MANIFEST_BASE_REQUIRED,
  PLUGIN_MANIFEST_OVERLAY_REQUIRED,
  PLUGIN_MANIFEST_REQUIRED_FIELDS,
  PLUGIN_NAME_PATTERN,
  PLUGIN_NAME_MAX,
  pluginManifestIssues,
  PluginManifestSchema,
  type PluginManifest,
} from './plugin-manifest.js';

// Contract #3 — agent-definition (contract-scoped public surface).
export {
  AGENT_DEFINITION_BASE_REQUIRED,
  AGENT_DEFINITION_OVERLAY_REQUIRED,
  AGENT_DEFINITION_REQUIRED_FIELDS,
  AGENT_NAME_PATTERN,
  AGENT_NAME_MAX,
  AGENT_MODEL_VALUES,
  AGENT_COLOR_VALUES,
  agentDefinitionIssues,
  AgentDefinitionSchema,
  type AgentDefinition,
} from './agent-definition.js';

// Contract #4 — mcp-config (contract-scoped public surface).
export {
  MCP_CONFIG_BASE_REQUIRED,
  MCP_CONFIG_OVERLAY_REQUIRED,
  MCP_CONFIG_REQUIRED_FIELDS,
  MCP_NAME_PATTERN,
  MCP_NAME_MAX,
  MCP_TRANSPORT_VALUES,
  mcpConfigIssues,
  McpConfigSchema,
  type McpConfig,
} from './mcp-config.js';

// Contract #5 — hook-config (contract-scoped public surface).
export {
  HOOK_CONFIG_BASE_REQUIRED,
  HOOK_CONFIG_OVERLAY_REQUIRED,
  HOOK_CONFIG_REQUIRED_FIELDS,
  HOOK_EVENT_VALUES,
  HOOK_TYPE_VALUES,
  hookConfigIssues,
  HookConfigSchema,
  type HookConfig,
} from './hook-config.js';

// Contract #6 — marketplace-catalog (contract-scoped public surface).
export {
  MARKETPLACE_CATALOG_BASE_REQUIRED,
  MARKETPLACE_CATALOG_OVERLAY_REQUIRED,
  MARKETPLACE_CATALOG_REQUIRED_FIELDS,
  MARKETPLACE_NAME_PATTERN,
  MARKETPLACE_NAME_MAX,
  marketplaceCatalogIssues,
  MarketplaceCatalogSchema,
  type MarketplaceCatalog,
} from './marketplace-catalog.js';
