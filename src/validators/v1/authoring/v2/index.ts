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
