# CONSUMERS — what an AJV-only consumer does and does NOT get

> **Informative** (not normative). Records the ONE place where the published JSON
> Schema and the in-process Zod validator deliberately disagree, so a consumer
> that validates with a vanilla JSON-Schema engine (AJV, `jsonschema`, etc.) — and
> never imports the Zod validators — knows exactly which rule it must enforce
> itself.

`@intentsolutions/core` ships every authoring contract in two interchangeable
forms that are kept in lock-step by the codegen + the ajv ↔ Zod fold-agreement
tests (the DR-044 D8 backstop):

- **the published JSON Schema** (`schemas/authoring/<family>/<contract>.schema.json`)
  — language-agnostic, consumable by any JSON-Schema 2020-12 validator;
- **the in-process Zod validator** (`src/validators/v1/authoring/<family>/<contract>.ts`)
  — TypeScript-native, generated field-by-field from the same schemas.

The two are intended to return the **same verdict** on every artifact. The
ajv ↔ Zod fold-agreement test in each contract's `*-schema.test.ts` enforces this
across the fixture corpus. There is exactly **one documented carve-out**.

## INV-ENV-DISJOINT — Zod-only, NOT in the published JSON Schema

The skill-frontmatter overlay declares a per-variable mutual-exclusion invariant
(annotation `x-mutually-exclusive-fields`, internal id **kyh9**):

> A single environment-variable identifier MUST NOT appear in **both**
> `requires_env` and `fallback_for_env`. A variable cannot be declared
> required-present **and** simultaneously carry a fallback.

This is an **array-element-disjointness** predicate (the *intersection* of two
sibling arrays must be empty). Vanilla JSON Schema 2020-12 **cannot express it** —
there is no cross-array intersection keyword, and the only way to approximate it
(AJV's non-standard `$data` extension) would break the language-agnostic wire
contract and silently no-op for any standard validator.

By the CTO ruling recorded on the overlay's `x-mutually-exclusive-fields`
annotation, the predicate is therefore enforced **only in the Zod runtime layer**
(generated from the annotation by `scripts/codegen-authoring.ts`) and is
**intentionally not mirrored in the published JSON Schema**.

### What this means for you

| Consumer | INV-ENV-DISJOINT enforced? | Action required |
| --- | --- | --- |
| Imports the Zod validator (`SkillFrontmatter*Schema`) | **Yes** — automatically | none |
| Validates with the published JSON Schema only (AJV, `jsonschema`, the CCP Python validator, …) | **No** | enforce the disjointness yourself: reject any artifact where `requires_env ∩ fallback_for_env ≠ ∅` |

The fold-agreement tests document the asymmetry explicitly: for the
`requires_env ∩ fallback_for_env` overlap case, AJV **accepts** while Zod
**rejects** — the only fixture where the two disagree by design. Every other rule
(required fields, type narrowings, the SemVer pattern, the scoped-`Bash`
narrowing, the description token-budget cap, the **non-empty / `minLength: 1`
floor on `description` / `author` / `license` / `compatibility`**, reserved-name
and shell-substitution guards) is structurally expressible and **does** hold for
an AJV-only consumer.

### Reference

- Annotation: `schemas/authoring/v2/is-overlay/skill-frontmatter.v2.json`
  → `x-mutually-exclusive-fields` (`$comment` carries the full rationale).
- Carve-out test: `src/__tests__/skill-frontmatter-v2-schema.test.ts`
  → "the mutual-exclusion carve-out fires (… Zod-only — kyh9)".
- Codegen emit: `scripts/codegen-authoring.ts` → `mutualExclusionBlock` /
  `MUTUAL_EXCLUSION_HELPER`.
