# Authoring tier v2 (STRICT profile) — independent changelogs

> **Spec note.** This file is the per-fold / per-contract changelog substrate for the STRICT v2
> authoring family (DR-049 + the CCP kernel-shadow finding). Each composable `$defs` and each
> per-contract schema has its own section. **Changelog observance is mandatory**: a v2 schema change
> without a matching entry here fails the changelog-observance gate.
>
> **What v2 is (2026-06-11).** `authoring/v2` is the STRICT IS-marketplace contract that closes the
> 4 CCP-shadow frontmatter gaps. It is a fresh, self-contained sibling of `authoring/v1` with **zero
> `$ref` into v1** (copy-then-tighten). `authoring/v1` is **BYTE-FROZEN at
> `@intentsolutions/core@0.4.1`** and stays the looser PUBLISHED contract (it accepts every artifact
> it accepted at 0.4.1, forever). As of 0.6.0 (DR-062, PR #39) all six contracts are forked to v2; originally only **`skill-frontmatter`** was, and the other five
> contracts stay at v1/SHIPPED-INTERNAL untouched (per DR-049 D-SAK-1: the permanent structure
> governs, it is not a clock to author all six).
>
> **Lifecycle.** `skill-frontmatter` v2 ships **SHIPPED-INTERNAL** — schemas exist, lint,
> codegen-generated, fold-agreement-tested; NO consumer cutover, NOT canonical. Canonical-promotion
> is gated on the DR-049 recall eval (recall ≥ 0.95 / precision ≥ 0.90 against ≥100 real community
> plugins) + the corpus migration.

The JSON Schema foundation lives at [`marketplace-tier.schema.json`](./marketplace-tier.schema.json);
the hand-authored Zod mirror (canonical runtime parser) lives at
[`src/validators/v1/authoring/v2/marketplace-tier.ts`](../../../src/validators/v1/authoring/v2/marketplace-tier.ts).
The two MUST agree fold-for-fold. (The Zod mirrors live under `src/validators/v1/authoring/v2/` — the
package's runtime `schemas/v1` chamber does not move; only the authoring chamber advances its internal
family pointer v1 → v2.)

---

## [Unreleased]

### Codegen / Zod — non-empty (`minLength: 1`) fold-agreement parity (all v2 contracts)

> **Acting-CTO call from the 2026-06-14 umbrella review.** The v2 STRICT schemas already
> declared `minLength: 1` on `description` (upstream-base) and on
> `author` / `license` / `compatibility` (is-overlay), and ajv enforced those floors — but the
> codegen-generated v2 Zod validators checked those string fields by TYPE only, never the floor.
> So an empty string (`{description:''}` / `{author:''}` / `{license:''}` / `{compatibility:''}`)
> PASSED Zod while ajv REJECTED it — an ajv ↔ Zod fold-agreement gap (the DR-044 D8 backstop). This
> is a Zod-side parity fix to an existing schema constraint, **not a schema tightening** — **no v2
> schema file changed**; the floors were already present.

| Layer | Change |
| --- | --- |
| `scripts/codegen-authoring.ts` | The keyword-driven codegen now emits a non-empty check for a `minLength >= 1` string field in two v2-gated spots: (a) the universal-fold-owned `description` (its TYPE is the base's, its MAX cap is the disclosureMarkers fold's, but its FLOOR is the base schema's `minLength` — now mirrored); (b) an overlay field that NARROWS a base string with `minLength` the base does not floor (`author` net-new; `license`/`compatibility` promoted from a base that types but does not floor them). Both emits are **gated to `version === 'v2'`** so the BYTE-FROZEN v1 generated Zod is untouched (mirroring the floor into v1 would be a forbidden tightening of the `@intentsolutions/core@0.4.1` contract). Feature-gated: regenerating leaves every v1 output byte-identical (the authoring-v1-frozen guard stays green). lineage: dr-049@authoring-v2-zod-minlength-parity |
| `src/validators/v1/authoring/v2/skill-frontmatter.ts` | REGENERATED: `description` / `author` / `license` / `compatibility` now reject an empty string, agreeing with ajv. lineage: dr-049@authoring-v2-zod-minlength-parity |
| `src/validators/v1/authoring/v2/{mcp-config,plugin-manifest,agent-definition,marketplace-catalog}.ts` | REGENERATED: the same v2-gated `description` non-empty floor (their v2 bases declare `minLength: 1` on `description`). `hook-config` has no top-level `description` floor (nested handler shape), so it is unaffected. lineage: dr-049@authoring-v2-zod-minlength-parity |
| tests | `src/__tests__/skill-frontmatter-v2-schema.test.ts` gains a non-empty fold-agreement block asserting BOTH ajv (composed v2 schema) AND v2 Zod reject each empty-string case, that a 1-char value is accepted (floor is exactly `minLength 1`), and that the floor is a genuine v2-only tightening (v1 ACCEPTS empty, v2 REJECTS). lineage: dr-049@authoring-v2-zod-minlength-parity |

The one remaining documented ajv ↔ Zod disagreement (INV-ENV-DISJOINT / kyh9 — Zod-only, not
JSON-Schema-expressible) is recorded for AJV-only consumers in the root
[`CONSUMERS.md`](../../../CONSUMERS.md).

### Contract #4 — `mcp-config` (DR-062 projection-mirrored v2 base — tier-3 reconciliation)

> **DR-062 family note.** Per `062-AT-DECR-tier3-reconciliation-authoring-v2-bases-2026-06-12`
> (acting-CTO adjudication of the 27 tier-3 deep-capture findings), the five remaining contracts
> gain v2 siblings whose upstream bases are **REGENERATED from the captured projections** at
> intent-eval-lab `specs/_vendor/upstream/<contract>/projection.json` — documented fields only,
> upstream requiredness, upstream wire forms — with every IS narrowing/extension relocated to the
> is-overlay under a convergence trigger. This supersedes the 2026-06-11 spec note above that only
> skill-frontmatter would fork to v2.

Three artifacts: [`upstream-base/mcp-config.v2.json`](./upstream-base/mcp-config.v2.json)
(REGENERATED from the captured projection — NOT a byte-copy of the frozen v1 base),
[`is-overlay/mcp-config.v2.json`](./is-overlay/mcp-config.v2.json) (the relocated IS narrowings +
the carried IS tracking trio, each with a convergence trigger), and the published
[`mcp-config.schema.json`](./mcp-config.schema.json) (pure `allOf` of the three v2 layers). Zod
mirror at [`src/validators/v1/authoring/v2/mcp-config.ts`](../../../src/validators/v1/authoring/v2/mcp-config.ts)
(GENERATED by `scripts/codegen-authoring.ts` from the v2 base + overlay; the codegen gained
per-contract `baseFileSuffix` resolution, layer-level if/then/else conditional-required emission,
and optional-overlay-extension-field checks — all feature-gated, v1 output byte-identical).

| Layer | Change |
| --- | --- |
| `upstream-base` (`2.0.0-draft`) | Mirrors the captured projection (spec-projection/v1, spec_version 2025-11-25, sha256 `fe9e2193…7195b` cited in the base `$comment`). **C1 adoptions (056 #2/#3/#4):** selector takes upstream's wire name `type` (v1 misnamed it `transport`); the `streamable-http` alias joins the enum {stdio, http, streamable-http, sse, ws}; per-transport if/then/else shapes replace the v1 flat shape (stdio ⇒ `command` required; URL-bearing transports ⇒ `url` required — `url` is a new documented base field, non-empty string, NOT format:uri because upstream documents env-var expansion placeholders in url values); enum provenance re-attributed to the Claude Code page — the machine-readable MCP schema defines neither the enum nor the server-config shape, and `ws` is Claude-Code-only. **C2 widening (056 #1):** `type` is OPTIONAL with the stdio default (upstream's standardized-format example omits it); base `required` shrinks to the flat floor `[name]`. `args`/`env` are upstream-optional. The kernel-only `metadata` object is REMOVED from the base (documented fields only). lineage: code.claude.com/docs/en/mcp@2025-11-25 · lineage: modelcontextprotocol.io/specification@2025-11-25 |
| `is-overlay` (`2.0.0-draft`) | Carries the v1 IS trio verbatim (`description`, `version` strict-SemVer, `enabled`) + the RELOCATED flat all-required projection choice (056 #1, DR-062 C2): `type`, `command`, `args`, `env` are IS-required explicitly — presence-only promotions, types stay single-sourced in the base — each with a CONVERGENCE TRIGGER + the RELOCATED kernel-only `metadata` extension object (DR-062 C3 prose; optional, must be an object). Overlay required delta = `[type, command, args, env, description, version, enabled]`. lineage: dr-062@mcp-config |
| composition (`2.0.0-draft`) | Initial v2 `allOf` of `[v2 upstream-base, v2 marketplace-tier#/$defs/universalFolds, v2 is-overlay]`. Effective required = base ∪ overlay = the IS 8-field set, preserved from the v1 composition verbatim **modulo the selector wire-name fix `transport` → `type`** (a BREAKING wire-name change vs v1 — v1 stays the PUBLISHED contract; v2 ships SHIPPED-INTERNAL). C2-widening + C3-relocation proofs + ajv↔Zod fold agreement on the v2 fixture corpus in `src/__tests__/mcp-config-v2-schema.test.ts`. Registered in `index.json` as contract #4. lineage: dr-062@mcp-config |

### Contract #2 — `plugin-manifest` (DR-062 projection-mirrored v2 base — tier-3 reconciliation)

Three artifacts: [`upstream-base/plugin-manifest.v2.json`](./upstream-base/plugin-manifest.v2.json)
(REGENERATED from the captured projection — NOT a byte-copy of the frozen v1 base),
[`is-overlay/plugin-manifest.v2.json`](./is-overlay/plugin-manifest.v2.json) (the relocated IS
narrowings + the carried IS promotions, each with a convergence trigger), and the published
[`plugin-manifest.schema.json`](./plugin-manifest.schema.json) (pure `allOf` of the three v2
layers). Zod mirror at
[`src/validators/v1/authoring/v2/plugin-manifest.ts`](../../../src/validators/v1/authoring/v2/plugin-manifest.ts)
(GENERATED by `scripts/codegen-authoring.ts` from the v2 base + overlay).

| Layer | Change |
| --- | --- |
| `upstream-base` (`2.0.0-draft`) | Mirrors the captured projection (spec-projection/v1, spec_version unversioned-2026-06-12, sha256 `a6a67a15…0d632` cited in the base `$comment`). **C1 adoptions (058 #1/#3):** the 11 unmodeled component-path fields join the base — `commands`/`agents`/`skills`/`outputStyles` as the documented `string\|array` unions, `hooks`/`mcpServers`/`lspServers` as `string\|array\|object`, `channels`/`dependencies` as bare arrays (no documented item shape), the dotted `experimental.monitors` + `experimental.themes` rows folded into one `experimental` object, `userConfig` as an object — plus the documented metadata fields `$schema`, `defaultEnabled`, `displayName`. **C2 widening (058 #2):** `commands` accepts upstream's documented `string\|array` union (the v1 base hard-coded array-only). **C3 removals:** the structural kebab pattern + 64-char cap on `name` (prose-only upstream — `name` is a bare string here) and the kernel-only `metadata` extension are REMOVED from the base (documented fields only). Upstream requiredness preserved: `required: [name]` ('name is the only required field'). lineage: code.claude.com/docs/en/plugins-reference@unversioned-2026-06-12 |
| `is-overlay` (`2.0.0-draft`) | Carries the seven v1 IS promotions verbatim (`version` strict-SemVer, `description`, `author`, `homepage`, `license`, `keywords`, `commands`) + the RELOCATED `commands` array-only narrowing (058 #2, DR-062 C2) + the RELOCATED structural `name` encoding (kebab pattern + 64-char cap; 058 #5, DR-062 C3) + the RELOCATED kernel-only `metadata` extension object (058 #4, DR-062 C3; optional, must be an object) — each with a CONVERGENCE TRIGGER. Overlay required delta = `[version, description, author, homepage, license, keywords, commands]`. lineage: dr-062@plugin-manifest |
| composition (`2.0.0-draft`) | Initial v2 `allOf` of `[v2 upstream-base, v2 marketplace-tier#/$defs/universalFolds, v2 is-overlay]`. Effective required = base ∪ overlay = the IS 8-field plugin-manifest set `{name, version, description, author, homepage, license, keywords, commands}`, preserved from the v1 composition VERBATIM (the DR-062 relocation changes WHERE the narrowings live, not what the composed IS marketplace tier requires). C1-adoption + C2-widening + C3-relocation proofs + ajv↔Zod fold agreement on the v2 fixture corpus in `src/__tests__/plugin-manifest-v2-schema.test.ts`. Registered in `index.json` as contract #2. lineage: dr-062@plugin-manifest |

### Contract #3 — `agent-definition` (DR-062 projection-mirrored v2 base — tier-3 reconciliation)

Three artifacts: [`upstream-base/agent-definition.v2.json`](./upstream-base/agent-definition.v2.json)
(REGENERATED from the captured projection — NOT a byte-copy of the frozen v1 base),
[`is-overlay/agent-definition.v2.json`](./is-overlay/agent-definition.v2.json) (the relocated IS
narrowings + the carried IS promotions and tracking trio, each with a convergence trigger), and the
published [`agent-definition.schema.json`](./agent-definition.schema.json) (pure `allOf` of the
three v2 layers). Zod mirror at
[`src/validators/v1/authoring/v2/agent-definition.ts`](../../../src/validators/v1/authoring/v2/agent-definition.ts)
(GENERATED by `scripts/codegen-authoring.ts` from the v2 base + overlay; the codegen gained a
feature-gated overlay closed-enum-narrowing emission — branch + VALUES const — for the relocated
`model` alias set; no v1 overlay declares an enum, so the v1 output stays byte-identical).

| Layer | Change |
| --- | --- |
| `upstream-base` (`2.0.0-draft`) | Mirrors the captured projection (spec-projection/v1, spec_version unversioned-2026-06-12, sha256 `7ff25f14…852a56` cited in the base `$comment`). **C1 adoption (059 #1):** the 11 unmodeled documented fields join the base — `permissionMode`/`memory`/`effort` as the documented enums, `isolation` as the single-documented-value enum `[worktree]`, `background` boolean, `maxTurns` non-negative integer, `skills` array of strings, `mcpServers` as a bare array (string\|object entries — no single documented item shape, the channels/dependencies precedent), `hooks` generic object, `disallowedTools`/`initialPrompt` strings (the disallowedTools documented wire form is the comma-separated string; no array latitude is documented or adjudicated for it). **C2 widenings (059 #3/#4):** `tools` accepts the documented comma-separated string AND the array form (the v1 base hard-coded array-only); `model` is a bare string admitting the documented full-model-ID latitude alongside the aliases + `inherit` (the v1 base hard-coded the closed alias enum). **C3 removals:** the structural kebab pattern + 64-char cap on `name` (prose-only upstream — `name` is a bare string here) and the kernel-only `metadata` extension are REMOVED from the base (documented fields only). **C4 not adopted (059 #6):** the official sample's `color: magenta` stays outside the documented 8-value enum (documented-vs-observed provenance rule). Upstream requiredness preserved: `required: [name, description]` ('Only name and description are required'). lineage: code.claude.com/docs/en/sub-agents@unversioned-2026-06-12 |
| `is-overlay` (`2.0.0-draft`) | Carries the v1 IS promotions verbatim (`tools`, `model`, `color` promoted to IS-required; `version` strict-SemVer, `author`, `tags` net-new tracking trio) + the RELOCATED `tools` array-only narrowing (059 #3, DR-062 C2) + the RELOCATED `model` closed alias-enum narrowing `{sonnet, opus, haiku, fable, inherit}` (059 #4, DR-062 C2) + the RELOCATED structural `name` encoding (kebab pattern + 64-char cap; 059 #5, DR-062 C3) + the RELOCATED kernel-only `metadata` extension object (059 #2, DR-062 C3; optional, must be an object) — each with a CONVERGENCE TRIGGER. Overlay required delta = `[tools, model, color, version, author, tags]`. lineage: dr-062@agent-definition |
| composition (`2.0.0-draft`) | Initial v2 `allOf` of `[v2 upstream-base, v2 marketplace-tier#/$defs/universalFolds, v2 is-overlay]`. Effective required = base ∪ overlay = the IS 8-field agent-definition set `{name, description, tools, model, color, version, author, tags}`, preserved from the v1 composition VERBATIM (the DR-062 relocation changes WHERE the narrowings live, not what the composed IS marketplace tier requires). C1-adoption + C2-widening + C3-relocation + C4-non-adoption proofs + ajv↔Zod fold agreement on the v2 fixture corpus in `src/__tests__/agent-definition-v2-schema.test.ts`. Registered in `index.json` as contract #3. lineage: dr-062@agent-definition |

### Contract #5 — `hook-config` (DR-062 projection-mirrored v2 base — tier-3 reconciliation)

Three artifacts: [`upstream-base/hook-config.v2.json`](./upstream-base/hook-config.v2.json)
(REGENERATED from the captured projection — NOT a byte-copy of the frozen v1 base),
[`is-overlay/hook-config.v2.json`](./is-overlay/hook-config.v2.json) (the relocated IS narrowings +
the carried per-handler IS quartet, each with a convergence trigger), and the published
[`hook-config.schema.json`](./hook-config.schema.json) (pure `allOf` of the three v2 layers). Zod
mirror at [`src/validators/v1/authoring/v2/hook-config.ts`](../../../src/validators/v1/authoring/v2/hook-config.ts)
(GENERATED by `scripts/codegen-authoring.ts` from the v2 base + overlay; the codegen gained a
feature-gated empty-constraint-constants section collapse — contracts WITH constants produce
byte-identical output). **DEPTH BOUNDARY (documented in the generated module):** the nested
matcher-group / handler constraints are enforced by the published JSON Schema (ajv); the
keyword-driven codegen emits top-level-surface checks only for the `hooks` object (the same posture
as agent-definition's generic `hooks` field), so the v2 test spec asserts the deep branches via ajv
and holds the ajv↔Zod D8 backstop on the Zod-visible surface.

| Layer | Change |
| --- | --- |
| `upstream-base` (`2.0.0-draft`) | Mirrors the captured projection (spec-projection/v1, spec_version unversioned-2026-06-12, sha256 `58b4c144…cfde09` cited in the base `$comment`). **C1 adoptions (060 #1/#3/#5):** the documented 3-LEVEL NESTING — event → [{matcher, hooks:[handler…]}] — REPLACES v1's flattened single-handler shape (the document is `{hooks: {<Event>: [matcherGroup…]}}`, the 30-event enum enforced via `propertyNames`); 16 of 18 documented handler fields the v1 base never modeled join the handler shape (`allowedEnvVars`, `args`, `async`, `asyncRewake`, `headers`, `if`, `input`, `model`, `once`, `prompt`, `server`, `shell` enum {bash, powershell}, `statusMessage`, `timeout` bare number — upstream documents per-type defaults, no integer/floor constraint, `tool`, `url`); per-type required fields modeled for ALL FIVE handler types via handler-level if/then members — command ⇒ `[command]`, http ⇒ `[url]`, mcp_tool ⇒ `[server, tool]`, prompt\|agent ⇒ `[prompt]` (v1 modeled command only). **C2 widening (060 #2):** `matcher` accepts the documented match-all forms (omitted / `''` / `'*'`) — a bare string, no required-membership, no minLength; the projection's 10 no-matcher-support events + the regex fallback are recorded as prose, not structurally encoded (no DR-062 row adjudicates them). **C3 removal:** the kernel-only `metadata` extension is REMOVED from the base (documented fields only). **C4 not adopted (060 #6):** `rewakeMessage`/`rewakeSummary` (one official plugin, documented nowhere) enter neither base nor overlay (documented-vs-observed provenance rule). Upstream requiredness: `required: [hooks]` at the top level; `[type]` + the per-type conditional at the handler level. lineage: code.claude.com/docs/en/hooks@unversioned-2026-06-12 |
| `is-overlay` (`2.0.0-draft`) | Adds NO top-level required fields — the IS requiredness binds INSIDE the nesting the v2 base adopted, via deep narrowing on the `hooks` member: the RELOCATED explicit-non-empty-matcher requirement (060 #2, DR-062 C2 — per-group `required: [matcher]` + `minLength: 1`; `'*'` is the explicit match-all spelling) + the per-handler IS quartet carried from the v1 overlay (`description` non-empty string, `enabled` boolean, `timeout` NARROWED number → integer ≥ 0, `blocking` boolean — per-handler `required: [description, enabled, timeout, blocking]`) + the RELOCATED kernel-only `metadata` extension object at the top level (060 #4, DR-062 C3; optional, must be an object) — each with a CONVERGENCE TRIGGER. Union with the base's handler floor reproduces the v1 composed 8-field per-handler surface `{event, matcher, type, command, description, enabled, timeout, blocking}` under the adopted nesting (event = the level-1 map key; matcher = the level-2 group field). lineage: dr-062@hook-config |
| composition (`2.0.0-draft`) | Initial v2 `allOf` of `[v2 upstream-base, v2 marketplace-tier#/$defs/universalFolds, v2 is-overlay]`. Effective TOP-LEVEL required = base ∪ overlay = `[hooks]` (deep/conditional requiredness is not a manifest row — the mcp-config per-transport precedent). C1-nesting + C2-widening + relocation proofs (matcher + quartet + metadata, base-valid/composition-invalid) + per-type conditional branch probes (ajv) + ajv↔Zod fold agreement on the v2 fixture corpus in `src/__tests__/hook-config-v2-schema.test.ts`. Registered in `index.json` as contract #5. lineage: dr-062@hook-config |

### Contract #6 — `marketplace-catalog` (DR-062 projection-mirrored v2 base — tier-3 reconciliation)

Three artifacts: [`upstream-base/marketplace-catalog.v2.json`](./upstream-base/marketplace-catalog.v2.json)
(REGENERATED from the captured projection — NOT a byte-copy of the frozen v1 base),
[`is-overlay/marketplace-catalog.v2.json`](./is-overlay/marketplace-catalog.v2.json) (the relocated
IS narrowings + the carried IS promotions, each with a convergence trigger), and the published
[`marketplace-catalog.schema.json`](./marketplace-catalog.schema.json) (pure `allOf` of the three
v2 layers). Zod mirror at
[`src/validators/v1/authoring/v2/marketplace-catalog.ts`](../../../src/validators/v1/authoring/v2/marketplace-catalog.ts)
(GENERATED by `scripts/codegen-authoring.ts` from the v2 base + overlay; the codegen gained two
feature-gated emissions — a reserved-name blocklist check for a bare-string `not.enum` base field,
and a bare-array `minItems` floor for the relocated overlay narrowing; no v1 schema declares
either shape, so all other generated outputs stay byte-identical). **DEPTH BOUNDARY (documented in
the generated module):** the 18 per-entry optionals and the 5 source forms are enforced by the
published JSON Schema (ajv); the keyword-driven codegen emits the entry floor (`[name, source]` on
every `plugins` item) + the top-level surface — the hook-config posture.

| Layer | Change |
| --- | --- |
| `upstream-base` (`2.0.0-draft`) | Mirrors the captured projection (spec-projection/v1, spec_version unversioned-2026-06-12, sha256 `01d24b53…664092` cited in the base `$comment`). **C1 adoptions (061 #2/#3/#4):** the 4 documented top-level optionals join the base (`$schema`, `allowCrossMarketplaceDependenciesOn` bare array, `description`, `version`) + the DOCUMENTED `metadata` surface (`metadata.pluginRoot` + the description/version back-compat keys — unlike the sibling contracts, upstream DOCUMENTS a top-level `metadata` field here, so it lives in the BASE); all 18 documented plugin-entry optionals join the item shape (author object; category/description/displayName/homepage/license/repository/version strings; keywords/tags bare arrays; defaultEnabled/strict booleans — strict defaults true upstream; commands/agents/skills string\|array; hooks/mcpServers/lspServers string\|object); the 5 documented source forms join `source` (the `./`-prefixed relative-path string + github/url/git-subdir/npm object types with per-type requireds github⇒repo, url⇒url, git-subdir⇒path+url, npm⇒package and optionals ref/sha + registry/version under the `source` discriminator); `plugins` carries NO `minItems`, matching the doc. **C1 carve-out (within 061 #5):** the doc's 14 RESERVED marketplace names — documented upstream — adopt into the base as a negated enum on `name` (`not.enum`). **C3 removals:** the corpus-rationalized `minItems: 1` (061 #1) and the structural kebab pattern + 64-char cap on `name` (061 #5 — kebab-case is prose-only upstream; `name` is a bare string here) are REMOVED from the base (documented fields only). **C4 not adopted (061 #6):** `commit` on github sources, `path` on url sources, and the non-kebab plugin name wordpress.com (official-catalog tolerances, documented nowhere) enter neither base nor overlay (documented-vs-observed provenance rule). Upstream requiredness preserved: `required: [name, owner, plugins]`; owner shape (inner `name` required, `email` optional) carried verbatim — an exact-match AGREEMENT in the 061 cross-check. lineage: code.claude.com/docs/en/plugin-marketplaces@unversioned-2026-06-12 |
| `is-overlay` (`2.0.0-draft`) | Carries the five v1 IS promotions verbatim (`version` strict-SemVer, `description`, `license`, `homepage` URI, `keywords`) + the RELOCATED `plugins` `minItems: 1` (061 #1, DR-062 C3 — the corpus-rationalized minimum the doc does not state; the overlay re-states only the array form + the floor) + the RELOCATED structural `name` encoding (kebab pattern + 64-char cap; 061 #5, DR-062 C3 — prose-only upstream) — each with a CONVERGENCE TRIGGER. **NO `metadata` entry:** the documented metadata surface lives in the v2 base (the sibling overlays' metadata convergence condition is already satisfied for this contract). Overlay required delta = `[version, description, license, homepage, keywords]`. lineage: dr-062@marketplace-catalog |
| composition (`2.0.0-draft`) | Initial v2 `allOf` of `[v2 upstream-base, v2 marketplace-tier#/$defs/universalFolds, v2 is-overlay]`. Effective required = base ∪ overlay = the IS 8-field marketplace-catalog set `{name, owner, plugins, version, description, license, homepage, keywords}`, preserved from the v1 composition VERBATIM (the DR-062 relocation changes WHERE the narrowings live, not what the composed IS marketplace tier requires). The base ADDITIONALLY carries the per-entry floor + per-source-form conditional requiredness (nested, so not manifest rows — the mcp-config precedent). C1-adoption + base-widening (v1-base-rejected empty-plugins/non-kebab-name, v2-base-accepted) + reserved-name carve-out + C3-relocation + C4-non-adoption proofs + per-source-form branch probes (ajv) + ajv↔Zod fold agreement on the v2 fixture corpus in `src/__tests__/marketplace-catalog-v2-schema.test.ts`. Registered in `index.json` as contract #6. lineage: dr-062@marketplace-catalog |

---

## The 4 v2 tightenings (vs frozen v1)

| # | Rule | Surface | CCP prose-validator parity |
| --- | --- | --- | --- |
| 1 | Scoped-Bash: reject a bare unscoped `Bash` token (only `Bash(scope:*)` permitted) | `is-overlay` `allowed-tools` (NARROW) | `validate-skills-schema.py` ~L1843 (unscoped `Bash` is an enterprise-tier ERROR) |
| 2 | Shell-substitution widen: `description` rejects `$(` and backticks in addition to `${` and XML | `securityChecks` fold (ADD conjunct) | `RE_YAML_SHELL_SUBST` at L199 (catches `$(` and backticks) |
| 3 | Reserved-name hardening: reject `name` whose lowercase contains `claude`/`anthropic` as a substring | `securityChecks` fold (ADD conjunct) | L1706 (`"claude"`/`"anthropic"` substring in name → ERROR) |
| 4 | Description cap 1024: token budget lowered 1536 → 1024 | `disclosureMarkers` fold (TIGHTEN) | L1729-1730 (`len(desc) > 1024` → ERROR); also the agentskills.io documented soft cap |

All four are **structurally expressible in vanilla JSON Schema 2020-12 / ECMA-262** (verified against
ajv strict mode) — including scoped-Bash (a string-form negative `pattern` with token-boundary
anchoring plus an array-form `not contains const`). So a plain ajv consumer AND the CCP kernel-shadow
enforce every v2 rule **without a Zod-only carve-out**. (Contrast the kyh9 `x-mutually-exclusive-fields`
annotation, which is the one predicate that is genuinely not JSON-Schema-expressible and stays
Zod-only.)

---

## § deprecationRegistry (UNIVERSAL FOLD 1/3 — tactical)

Carried byte-identical from v1 (no v2 tightening).

| Version | Change |
| --- | --- |
| `2.0.0-draft` | Initial v2 carry: `compatible-with` → `compatibility`; `when_to_use` → `description` (identical to v1). |

## § securityChecks (UNIVERSAL FOLD 2/3 — CISO-driven · UNIVERSAL-IMMUTABLE within a version)

Add-only within v2. v2 ADDS two conjuncts relative to the frozen v1 fold; nothing is subtracted.

| Version | Change |
| --- | --- |
| `2.0.0-draft` | Carries every v1 securityChecks conjunct: `name` not a reserved word (`skill`/`claude`/`anthropic`/`mcp`/`plugin`/`agent`) and no angle brackets; `description` no XML and no `${…}`. **ADDS (v2):** (a) `name` additionally rejects any name whose lowercase contains `claude` or `anthropic` as a substring (per-letter char-class pattern — ECMA-262 has no `(?i)` inline flag); (b) `description` shell-substitution detection widened to also catch `$(` and backtick sequences (v1 caught only `${` and XML tags). |

## § disclosureMarkers (UNIVERSAL FOLD 3/3 — Karpathy-axis)

| Version | Change |
| --- | --- |
| `2.0.0-draft` | `description` token budget lowered from 1536 (v1) to **1024** chars (the agentskills.io documented soft cap + the CCP prose-validator ERROR cap). v2's tier IS 1024, so v2 may legitimately encode it without violating the monotonic-additive invariant (v1 deliberately omitted the 1024 cap to avoid conflicting with its 1536 tier). |

## § universalFolds (composition — architectural)

| Version | Change |
| --- | --- |
| `2.0.0-draft` | Initial v2 `allOf` composition of the three v2 universal folds. Same fold set as v1; two folds tightened (securityChecks, disclosureMarkers), one carried (deprecationRegistry). |

---

## Contract #1 — `skill-frontmatter` (STRICT v2)

Three artifacts: [`upstream-base/skill-frontmatter.v1.json`](./upstream-base/skill-frontmatter.v1.json)
(byte-copy of the v1 base modulo `$id`), [`is-overlay/skill-frontmatter.v2.json`](./is-overlay/skill-frontmatter.v2.json)
(v1 overlay + scoped-Bash narrowing), and the published
[`skill-frontmatter.schema.json`](./skill-frontmatter.schema.json) (pure `allOf` of the three v2
layers). Zod mirror at
[`src/validators/v1/authoring/v2/skill-frontmatter.ts`](../../../src/validators/v1/authoring/v2/skill-frontmatter.ts)
(GENERATED by [`scripts/codegen-authoring.ts`](../../../scripts/codegen-authoring.ts) from the v2
base + overlay).

### § upstream-base (authored by THEM)

| Version | Change |
| --- | --- |
| `2.0.0-draft` | Byte-copy of `authoring/v1/upstream-base/skill-frontmatter.v1.json` with only the `$id` rewritten `/v1/` → `/v2/`. The upstream projection is identical (a CI/test check asserts equal-modulo-`$id`); only the IS-overlay + folds tighten. The operative 1024 description cap is enforced by the v2 disclosureMarkers fold. |

### § is-overlay (authored by US)

| Version | Change |
| --- | --- |
| `2.0.0-draft` | Identical to the v1 overlay (same required set `[allowed-tools, version, author, license, compatibility, tags]`, same field types, same optional IS extras, same kyh9 `x-mutually-exclusive-fields` carve-out) EXCEPT for one NARROW: `allowed-tools` rejects a bare unscoped `Bash` token (string-form negative `pattern` + array-form `not contains const`); an `x-scoped-tool: "Bash"` annotation records the narrowed token for the codegen. Monotonic-additive over the base: every v1-accepted artifact except a bare-`Bash` author stays accepted. |

### § skill-frontmatter (composition)

| Version | Change |
| --- | --- |
| `2.0.0-draft` (pkg `0.5.0`) | Initial STRICT v2 `allOf` of `[v2 upstream-base, v2 marketplace-tier#/$defs/universalFolds, v2 is-overlay]`. Closes the 4 CCP-shadow frontmatter gaps. Monotonic-additive over frozen v1 (every v1-rejected input is v2-rejected, plus the 4 new violation classes). ajv↔Zod fold agreement proven on the v2 fixtures + the v1 corpus. Lifecycle SHIPPED-INTERNAL. |
