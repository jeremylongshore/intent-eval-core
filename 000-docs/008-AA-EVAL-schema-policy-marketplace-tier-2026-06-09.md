# Schema-policy eval — `marketplace-tier` foundation

| Field | Value |
|---|---|
| Doc | `008-AA-EVAL-schema-policy-marketplace-tier-2026-06-09.md` |
| Bead | `bd_000-projects-hi7e` (closes audit **C2**) |
| Subject | `schemas/authoring/v1/marketplace-tier.schema.json` + `src/validators/v1/authoring/marketplace-tier.ts` (the 4-fold `isMarketplace` foundation, bead `iec-E11-decomp` / PR #23) |
| Corpus | `tests/authoring/v1/fixtures/skill-frontmatter/` (40 fixtures, bead `iec-E11-fixtures-discipline` / PR #24) |
| Harness | `src/__tests__/schema-policy-eval.test.ts` (CI-enforced — the scorecard below cannot drift) |
| Plan | 033 § 14.A.5 + § 14.21 |

## Question (audit C2)

Are the `$defs.isMarketplace` rules **correct** against a curated corpus — not merely
well-formed? "Correct" = accepts every valid skill, rejects every negative the
foundation is responsible for, and does not over-reach into checks that belong to the
per-contract schema.

## Why skill-frontmatter

`skill-frontmatter` is the contract whose 8 required fields **are** the `isMarketplace`
required set (`name`, `description`, `allowed-tools`, `version`, `author`, `license`,
`compatibility`, `tags`). The foundation therefore applies to it in full. The other five
contracts (`plugin-manifest`, `agent-definition`, `mcp-config`, `hook-config`,
`marketplace-catalog`) specialize `requiredFields` in their own per-contract schemas
(charter-gated bead `8vq0`), so the foundation alone is not their complete validator —
measuring it against them would conflate two distinct contracts.

## Scorecard

| Class | n | Foundation verdict | Result |
|---|---|---|---|
| Valid (positive + edge) | 22 | accept | **22/22 accepted — 0 false-rejects** |
| In-scope negatives | 11 | reject | **11/11 rejected — 0 false-accepts** |
| Deferred negatives (out-of-scope) | 7 | accept (by design) | **7/7 correctly deferred** |

**In-scope negatives (foundation must reject) — 11:**

- 8 × `missing-<field>` → caught by the `requiredFields` fold.
- `constraint-name-reserved-word`, `constraint-name-xml-tag` → caught by `securityChecks`.
- `constraint-description-over-budget` → caught by `disclosureMarkers`.

**Deferred negatives (handled by the per-contract schema, not the foundation) — 7:**

- 5 × `type-<field>` → `requiredFields` checks **presence**, not type. Type validation
  is a per-contract concern (a `version` that is a number is still *present*).
- `constraint-name-uppercase`, `constraint-name-spaces` → kebab-case **name format** is a
  per-contract concern, not one of the four cross-contract folds.

## Findings

1. **The foundation is sound.** Zero false-rejects of valid skills; zero false-accepts of
   negatives within its scope. The 4-fold `isMarketplace` rules are correct, not just
   well-formed. **Audit C2 is closed** for the foundation.
2. **The coverage boundary is explicit and intentional.** Type validation and name-format
   checks are deferred to the per-contract schemas. This is the correct separation: the
   cross-contract foundation enforces the universal marketplace concerns (required-field
   presence, deprecation, security hygiene, token budget); per-contract schemas add
   contract-specific type + format constraints on top.
3. **Charter input — `requiredFields` is skill-shaped.** The 8-field required set is the
   skill marketplace set. Non-skill contracts (e.g. a plugin manifest has
   `homepage`/`commands`, not `allowed-tools`/`compatibility`) need their **own**
   `requiredFields` while inheriting the universal `deprecationRegistry` / `securityChecks`
   / `disclosureMarkers` folds. The ISEDC Class-1 charter (`8vq0`) should ratify how
   per-contract `requiredFields` specialization composes with the shared folds before the
   six per-contract schemas are authored.

## Scope

This eval covers the `marketplace-tier` foundation against `skill-frontmatter`. The full
per-contract correctness evals (one per contract) follow once those schemas land on the
foundation (charter-gated). The harness pattern here is reusable for them.
