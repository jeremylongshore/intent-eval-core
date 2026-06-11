# Authoring tier — independent changelogs

> **Spec note.** This file is the per-fold / per-contract changelog substrate mandated by plan
> 033 § 14.10 + DR-044. Each composable `$defs` and each per-contract schema has its own section
> documenting its semver evolution. Bumping the deprecation registry (tactical) doesn't force
> consumers to re-evaluate a contract's required-fields (architectural). **Changelog observance is
> mandatory**: a schema change without a matching entry here fails the changelog-observance gate.
>
> **DR-044 D7 refactor (2026-06-09).** The foundation was decomposed so the THREE universal folds
> (`deprecationRegistry`, `securityChecks`, `disclosureMarkers`) are uniform across all six
> contracts, while `requiredFields` is specialized PER CONTRACT. `requiredFields` and the
> skill-shaped `isMarketplace` 4-fold composition were REMOVED from the foundation; each
> per-contract schema now `$ref`s `marketplace-tier.schema.json#/$defs/universalFolds` and supplies
> its own `requiredFields`. `securityChecks` is UNIVERSAL-IMMUTABLE (D7(b)).
>
> Canonical predicate (post-D7):
> `valid_universalFolds(a) := deprecationRegistry(a) ∧ securityChecks(a) ∧ disclosureMarkers(a)`;
> a per-contract `valid_C(a) := requiredFields_C(a) ∧ universalFolds(a) ∧ upstreamBase_C(a) ∧ overlay_C(a)`.
> The composition is monotone in tier (stricter ⇒ more conjuncts) and order-independent.

The JSON Schema foundation lives at [`marketplace-tier.schema.json`](./marketplace-tier.schema.json);
the hand-authored Zod mirror (canonical runtime parser) lives at
[`src/validators/v1/authoring/marketplace-tier.ts`](../../../src/validators/v1/authoring/marketplace-tier.ts).
The two MUST agree fold-for-fold.

---

## § deprecationRegistry (UNIVERSAL FOLD 1/3 — tactical)

Evolves via **autonomous validator patch** (NON-NEGOTIABLES item 6 — spec-compliance bug fixes
are OK without architectural review). Each entry maps a deprecated key to its replacement; a
present deprecated key fails the fold with a migration message.

| Version | Change |
| --- | --- |
| `1.0.0-draft` | Initial migrations: `compatible-with` → `compatibility`; `when_to_use` → `description`. |

## § securityChecks (UNIVERSAL FOLD 2/3 — CISO-driven · UNIVERSAL-IMMUTABLE)

Owned by the CISO seat. Supply-chain hardening. Per DR-044 D7(b) this fold is
**universal-immutable**: add-only, never overridable by a per-contract schema, never subtracted. A
CI meta-test asserts every contract `$ref`s it by reference.

| Version | Change |
| --- | --- |
| `1.0.0-draft` | `name` must not be a reserved word (`skill`, `claude`, `anthropic`, `mcp`, `plugin`, `agent`) and must not contain XML angle brackets; `description` must not contain XML tags or shell-substitution (`${…}`) sequences. |

## § disclosureMarkers (UNIVERSAL FOLD 3/3 — Karpathy-axis)

Progressive disclosure / token-economy.

| Version | Change |
| --- | --- |
| `1.0.0-draft` | `description` bounded to a 1536-character token budget. |

## § universalFolds (composition — architectural)

Adding/removing a fold is an architectural change requiring ISEDC review. Every per-contract schema
`$ref`s this composition.

| Version | Change |
| --- | --- |
| `1.0.0-draft` | Initial `allOf` composition of the three universal folds above. |
| `1.0.0-draft` (DR-044 D7) | Refactor: `requiredFields` removed from the foundation (now per-contract); the skill-shaped `isMarketplace` 4-fold `$def` removed (it was skill-frontmatter's composition, not the universal one). The universal composition is now exactly the 3 universal folds. |

## § requiredFields (per-contract — architectural)

**Moved out of the foundation by DR-044 D7.** No longer a shared `$def` with a single field list.
Each per-contract schema declares its own `required` array; the foundation provides a
parameterizable `requiredFieldsIssues(artifact, fields)` helper. A contract's required set evolves
under **ISEDC Class-1 ratification only** (NON-NEGOTIABLES item 1 — must not be silently reduced).

| Version | Change |
| --- | --- |
| `1.0.0-draft` | Generic 8-field set retired as a foundation constant; relocated to `skill-frontmatter` (see below). |

---

## Contract #1 — `skill-frontmatter`

Three artifacts: [`upstream-base/skill-frontmatter.v1.json`](./upstream-base/skill-frontmatter.v1.json)
(authored by the open standard), [`is-overlay/skill-frontmatter.v1.json`](./is-overlay/skill-frontmatter.v1.json)
(authored by IS), and the published [`skill-frontmatter.schema.json`](./skill-frontmatter.schema.json)
(pure `allOf`). Zod mirror at
[`src/validators/v1/authoring/skill-frontmatter.ts`](../../../src/validators/v1/authoring/skill-frontmatter.ts).
**GENERATED** per DR-044 D8 by [`scripts/codegen-authoring.ts`](../../../scripts/codegen-authoring.ts):
the Zod validator AND the inline `$comment` effective-required manifest are single-sourced from the
base + overlay JSON Schemas — never hand-typed. The walking-skeleton was originally grandfathered
hand-authored (D8 made codegen a hard precondition of contract #2, not #1); it is now promoted to
generated output, and the generated body is byte-identical to the hand-authored body (only the
file-header docstring differs). A `--check` stale-codegen gate runs in `pnpm run check` + CI.

### § upstream-base (authored by THEM)

| Version | Change |
| --- | --- |
| `1.0.0-draft` | agentskills.io v1.0 projection: required floor `[name, description]`; optional `[license, compatibility, metadata]` (+ `allowed-tools` left untyped for the overlay to narrow). Name kebab-case + ≤64; compatibility ≤500. Description length intentionally uncapped here (the universal disclosureMarkers fold is the operative cap). |

### § is-overlay (authored by US)

Evolves under **ISEDC Class-1 ratification only** — the overlay-required delta is the IS marketplace
floor and must not be silently reduced (the 2026-04-28-debacle guard). The monotonic-additive
invariant (overlay only ADDS required + NARROWS) is asserted by the property test.

| Version | Change |
| --- | --- |
| `1.0.0-draft` | Overlay-required delta `[allowed-tools, version, author, license, compatibility, tags]` (union with base floor = the IS 8-field set). `allowed-tools` narrowed to a string array; `version` strict SemVer 2.0.0; optional IS extras `requires_env`/`requires_tools`/`fallback_for_env`/`fallback_for_tools` + `required_environment_variables`. |

### § skill-frontmatter (composition)

| Version | Change |
| --- | --- |
| `1.0.0-draft` | Initial `allOf` of `[upstream-base, marketplace-tier#/$defs/universalFolds, is-overlay]`. Inline generated effective-required manifest (REQUIRED HERE / INHERITED). |
| `1.0.0-draft` (DR-044 D8) | Single-source authoring codegen landed (`scripts/codegen-authoring.ts`). The Zod validator + the inline `$comment` manifest are now GENERATED from the base + overlay schemas; the walking-skeleton is promoted from hand-authored to generated output (body byte-identical). `--check` idempotency gate wired into `pnpm run check` + CI. The remaining five contracts ride this codegen for free. |

## Contract #2 — `plugin-manifest`

The `.claude-plugin/plugin.json` manifest. Three artifacts:
[`upstream-base/plugin-manifest.v1.json`](./upstream-base/plugin-manifest.v1.json) (authored by Claude
Code), [`is-overlay/plugin-manifest.v1.json`](./is-overlay/plugin-manifest.v1.json) (authored by IS),
and the published [`plugin-manifest.schema.json`](./plugin-manifest.schema.json) (pure `allOf`). Zod
mirror at [`src/validators/v1/authoring/plugin-manifest.ts`](../../../src/validators/v1/authoring/plugin-manifest.ts).
**GENERATED** per DR-044 D8 by [`scripts/codegen-authoring.ts`](../../../scripts/codegen-authoring.ts) —
this is the FIRST contract that MUST be codegen-generated (D8 makes single-source codegen a hard
precondition of contract #2). Generating it generalized the codegen from skill-frontmatter's
hardcoded field names to a JSON-Schema-keyword-driven dispatch (object `author`, URI
`homepage`/`repository`, array `keywords`); skill-frontmatter's generated body is unchanged
(byte-identical). Upstream authority: code.claude.com/docs/en/plugins-reference §
"Plugin manifest schema". **Lifecycle: SHIPPED-INTERNAL** — schemas exist, lint, codegen-generated,
fold-agreement-tested; NO consumer cutover, NOT published. PUBLISHED promotion needs the vendored
deep-capture reconciliation + CFO per-contract sign-off (DR-049).

### § upstream-base (authored by THEM)

| Version | Change |
| --- | --- |
| `1.0.0-draft` | code.claude.com/docs/en/plugins-reference projection: "If you include a manifest, `name` is the only required field" ⇒ required floor `[name]`. Optional `[version, description, author, homepage, repository, license, keywords, commands, metadata]`. Name kebab-case + ≤64; `author` is an OBJECT (`{name}` required, `email`/`url` optional) — NOT a string (this differs from skill-frontmatter); `homepage`/`repository` URI-format; `keywords`/`commands` arrays of strings. Description length intentionally uncapped here (the universal disclosureMarkers fold is the operative cap). |

### § is-overlay (authored by US)

Evolves under **ISEDC Class-1 ratification only** — the overlay-required delta is the IS marketplace
floor and must not be silently reduced (the 2026-04-28-debacle guard). The monotonic-additive
invariant (overlay only ADDS required + NARROWS) is asserted by the property test.

| Version | Change |
| --- | --- |
| `1.0.0-draft` | Overlay-required delta `[version, description, author, homepage, license, keywords, commands]` (union with base floor `[name]` = the IS 8-field plugin set). `version` narrowed to strict SemVer 2.0.0; `commands` narrowed to a string array. `repository` stays upstream-optional (no `missing-repository` corpus negative). Decomposed against the corpus-first golden ground truth at `tests/authoring/v1/fixtures/plugin-manifest/`. |

### § plugin-manifest (composition)

| Version | Change |
| --- | --- |
| `1.0.0-draft` (DR-044 D8) | Initial `allOf` of `[upstream-base, marketplace-tier#/$defs/universalFolds, is-overlay]`, codegen-generated (Zod + inline `$comment` effective-required manifest). ajv↔Zod fold agreement proven on all 40 corpus fixtures + monotonicity property test. Registered in `index.json` as `contractIndex: 2`, `lifecycle: SHIPPED-INTERNAL`. |
