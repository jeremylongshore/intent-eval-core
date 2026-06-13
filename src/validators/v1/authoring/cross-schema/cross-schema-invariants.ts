/**
 * cross-schema-invariants — the kernel-side predicate helpers for the 7
 * cross-schema invariants (intent-eval-lab plan 033 § 14.B; DR-044 SAK charter).
 *
 * § 14.B specifies 7 invariants over the 6 authoring contracts' dependency edges
 * (§ 14.B.1): marketplace-catalog ─cites▶ plugin-manifest ─contains▶
 * {skill-frontmatter, agent-definition, mcp-config ─refers-to▶ hook-config}.
 * The catalog of record is schemas/authoring/cross-schema-invariants.v1.json.
 *
 * What lives HERE (kernel scope):
 *   - `invAllowedDisallowed` — INV-ALLOWED-DISALLOWED is the ONE kernel-checkable
 *     invariant: it is cross-FIELD on a single skill-frontmatter (allowed-tools ∩
 *     disallowed-tools = ∅), needs no cross-artifact resolution, and is ADVISORY
 *     (§ 14.B.3) — so it returns WARNINGS, never Zod parse errors. It does NOT go
 *     into SkillFrontmatterSchema (a) because that file is byte-frozen at v0.4.1
 *     and (b) because baking it into the Zod refinement would make it a blocking
 *     parse error, violating the § 14.B.3 advisory routing.
 *   - one typed predicate per STRUCTURAL invariant (`invCatPlugin`,
 *     `invPluginSkill`, `invPluginAgent`, `invPluginMcp`, `invMcpHook`,
 *     `invSkillHook`). The 6 structural invariants resolve ACROSS artifacts and
 *     are enforced in the DEEP validators named in the catalog `enforced_at`
 *     column (validate-marketplace --deep / validate-plugin / validate-mcp /
 *     validate-skillmd). The kernel does NOT statically descend into those deep
 *     validators; each structural helper takes the resolved child artifact(s) and
 *     a DI'd per-child validity function, so a deep validator imports the helper
 *     and supplies its own descent. The actual cross-artifact wiring into
 *     validate-plugin/marketplace is the explicitly-scoped REMAINDER (not built
 *     here — see this PR's summary for the re-scope note).
 */

import type { AuthoringArtifact, FoldIssue } from '../marketplace-tier.js';

// ─── INV-ALLOWED-DISALLOWED — kernel-checkable advisory (WARNING) ────────────

/**
 * A single cross-schema-invariant WARNING. Severity is `warning` for every
 * advisory invariant per § 14.B.3 — this is a SEPARATE channel from the Zod
 * `FoldIssue` error path, so an advisory hit never blocks a parse/gate.
 */
export interface CrossSchemaWarning {
  /** The invariant the warning belongs to (catalog id). */
  readonly invariant: string;
  readonly severity: 'warning';
  readonly message: string;
  readonly path: readonly string[];
}

/**
 * Normalize an `allowed-tools` / `disallowed-tools` value to a string Set. The
 * authoring contract accepts a YAML array OR a CSV/space-delimited string for
 * `allowed-tools` (the v0.4.1 relaxation); `disallowed-tools` is the symmetric
 * IS denylist. Malformed (non-string / non-array) values yield an empty set —
 * their TYPE is the per-field validator's concern, not this cross-field check.
 */
function toToolSet(value: unknown): Set<string> {
  if (Array.isArray(value)) {
    return new Set(value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()));
  }
  if (typeof value === 'string') {
    return new Set(
      value
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    );
  }
  return new Set();
}

/**
 * INV-ALLOWED-DISALLOWED — ∀ s ∈ skill-frontmatter, allowed-tools ∩
 * disallowed-tools = ∅. The one kernel-checkable invariant. Returns one WARNING
 * per tool that appears in BOTH lists (advisory, per § 14.B.3 — never an error).
 * Empty when the lists are disjoint or either is absent.
 */
export function invAllowedDisallowed(artifact: AuthoringArtifact): CrossSchemaWarning[] {
  const allowed = toToolSet(artifact['allowed-tools']);
  const disallowed = toToolSet(artifact['disallowed-tools']);
  if (allowed.size === 0 || disallowed.size === 0) return [];

  const warnings: CrossSchemaWarning[] = [];
  for (const tool of allowed) {
    if (disallowed.has(tool)) {
      warnings.push({
        invariant: 'INV-ALLOWED-DISALLOWED',
        severity: 'warning',
        message: `"${tool}" appears in both allowed-tools and disallowed-tools (cross-field consistency)`,
        path: ['allowed-tools'],
      });
    }
  }
  return warnings;
}

// ─── Structural invariant predicates — DI'd descent (the kernel surface) ─────

/**
 * The verdict a deep validator's per-child descent returns for one artifact.
 * `valid` is the gate result; `issues` carries the FoldIssue list the deep
 * validator already computed (passed through so the structural helper can
 * annotate which child failed without re-validating).
 */
export interface ChildVerdict {
  readonly valid: boolean;
  readonly issues?: readonly FoldIssue[];
}

/** A per-child validity function a deep validator supplies (its own descent). */
export type ChildValidator<T> = (child: T) => ChildVerdict;

/** A structural cross-schema-invariant violation (error class per § 14.B.3). */
export interface CrossSchemaViolation {
  readonly invariant: string;
  readonly severity: 'error';
  readonly message: string;
  readonly path: readonly string[];
}

/** A resolved marketplace-catalog plugin entry (deep validator resolves `.source`). */
export interface ResolvedCatalogEntry {
  /** The catalog `plugins[].source` reference (path / github / url). */
  readonly source: string;
  /** Whether the source resolved to a plugin-manifest on disk / over the network. */
  readonly resolved: boolean;
  /** The resolved plugin-manifest content, when `resolved`. */
  readonly manifest?: AuthoringArtifact;
}

/**
 * INV-CAT-PLUGIN — ∀ catalog entry e, plugin_manifest_resolves(e.source) ∧
 * valid_plugin_manifest(content_of(e.source), isMarketplace). Enforced at
 * `validate-marketplace --deep`. The deep validator resolves each `.source` and
 * supplies `validatePluginManifest`; this helper enforces both the resolution
 * AND the validity conjuncts and emits one error per failing entry.
 */
export function invCatPlugin(
  entries: readonly ResolvedCatalogEntry[],
  validatePluginManifest: ChildValidator<AuthoringArtifact>,
): CrossSchemaViolation[] {
  const violations: CrossSchemaViolation[] = [];
  entries.forEach((entry, index) => {
    const path = ['plugins', String(index), 'source'];
    if (!entry.resolved || entry.manifest === undefined) {
      violations.push({
        invariant: 'INV-CAT-PLUGIN',
        severity: 'error',
        message: `catalog entry source "${entry.source}" does not resolve to a plugin-manifest`,
        path,
      });
      return;
    }
    if (!validatePluginManifest(entry.manifest).valid) {
      violations.push({
        invariant: 'INV-CAT-PLUGIN',
        severity: 'error',
        message: `plugin-manifest at "${entry.source}" is not valid at the isMarketplace tier`,
        path,
      });
    }
  });
  return violations;
}

/**
 * Shared shape for the four "plugin contains child[]" invariants
 * (INV-PLUGIN-SKILL / -AGENT / -MCP) and the two "artifact refers-to hook/skill"
 * invariants — every one is: validate each child in a collection, emit an error
 * per invalid child. Parameterized by invariant id, the json path segment for
 * the collection, and the child validator.
 */
function eachChildValid(
  invariant: string,
  collectionPath: string,
  children: readonly AuthoringArtifact[],
  validateChild: ChildValidator<AuthoringArtifact>,
): CrossSchemaViolation[] {
  const violations: CrossSchemaViolation[] = [];
  children.forEach((child, index) => {
    if (!validateChild(child).valid) {
      violations.push({
        invariant,
        severity: 'error',
        message: `${collectionPath}[${index}] is not valid at the isMarketplace tier (${invariant})`,
        path: [collectionPath, String(index)],
      });
    }
  });
  return violations;
}

/**
 * INV-PLUGIN-SKILL — ∀ p, ∀ s ∈ p.skills, valid_skill_frontmatter(s,
 * isMarketplace). Enforced at `validate-plugin` per-skill descent.
 */
export function invPluginSkill(
  skills: readonly AuthoringArtifact[],
  validateSkill: ChildValidator<AuthoringArtifact>,
): CrossSchemaViolation[] {
  return eachChildValid('INV-PLUGIN-SKILL', 'skills', skills, validateSkill);
}

/**
 * INV-PLUGIN-AGENT — ∀ p, ∀ a ∈ p.agents, valid_agent_definition(a,
 * isMarketplace). Enforced at `validate-plugin` per-agent descent.
 */
export function invPluginAgent(
  agents: readonly AuthoringArtifact[],
  validateAgent: ChildValidator<AuthoringArtifact>,
): CrossSchemaViolation[] {
  return eachChildValid('INV-PLUGIN-AGENT', 'agents', agents, validateAgent);
}

/**
 * INV-PLUGIN-MCP — ∀ p, p.mcpServers[*] ⊨ valid_mcp_config. Enforced at
 * `validate-plugin` mcp descent.
 */
export function invPluginMcp(
  mcpServers: readonly AuthoringArtifact[],
  validateMcp: ChildValidator<AuthoringArtifact>,
): CrossSchemaViolation[] {
  return eachChildValid('INV-PLUGIN-MCP', 'mcpServers', mcpServers, validateMcp);
}

/**
 * INV-MCP-HOOK — ∀ m ∈ mcp-config with hook-bindings, valid_hook_config(m.hooks).
 * Enforced at `validate-mcp --with-hooks`. `hooks` absent ⇒ vacuously satisfied.
 */
export function invMcpHook(
  hooks: readonly AuthoringArtifact[] | undefined,
  validateHook: ChildValidator<AuthoringArtifact>,
): CrossSchemaViolation[] {
  if (hooks === undefined) return [];
  return eachChildValid('INV-MCP-HOOK', 'hooks', hooks, validateHook);
}

/**
 * INV-SKILL-HOOK — ∀ s ∈ skill-frontmatter with hooks block,
 * valid_hook_config(s.hooks). Enforced at `validate-skillmd` hooks descent.
 * `hooks` absent ⇒ vacuously satisfied.
 */
export function invSkillHook(
  hooks: readonly AuthoringArtifact[] | undefined,
  validateHook: ChildValidator<AuthoringArtifact>,
): CrossSchemaViolation[] {
  if (hooks === undefined) return [];
  return eachChildValid('INV-SKILL-HOOK', 'hooks', hooks, validateHook);
}
