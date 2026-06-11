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
> it accepted at 0.4.1, forever). Only **`skill-frontmatter`** is forked to v2; the other five
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
