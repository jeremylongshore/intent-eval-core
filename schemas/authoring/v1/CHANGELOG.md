# Authoring tier — `marketplace-tier` independent changelogs

> **Spec note.** This file is the per-fold changelog substrate mandated by plan 033 § 14.10
> ("Independent changelogs. Each composable `$defs` has its own `$comment` documenting its
> semver evolution. Bumping the deprecation registry (tactical) doesn't force consumers to
> re-evaluate required-fields (architectural). Each gets its own SCHEMA_CHANGELOG section.").
>
> The IS marketplace tier is the `allOf` **composition** of four orthogonal folds. Each fold
> versions independently. A consumer that only wants the required-fields tier may
> `$ref: marketplace-tier.schema.json#/$defs/requiredFields` without inheriting deprecation
> parsing. The internal CCP validator targets the full `#/$defs/isMarketplace` composition.
>
> Canonical predicate (plan 033 § 14.A):
> `valid_isMarketplace(artifact) := requiredFields ∧ deprecationRegistry ∧ securityChecks ∧ disclosureMarkers`.
> The composition is monotone in tier (stricter ⇒ more conjuncts) and order-independent.

The JSON Schema lives at [`marketplace-tier.schema.json`](./marketplace-tier.schema.json); the
hand-authored Zod mirror (canonical runtime parser) lives at
[`src/validators/v1/authoring/marketplace-tier.ts`](../../../src/validators/v1/authoring/marketplace-tier.ts).
The two MUST agree fold-for-fold.

---

## § requiredFields (FOLD 1/4 — architectural)

Evolves under **ISEDC Class-1 ratification only** (SCHEMA_CHANGELOG NON-NEGOTIABLES item 1 —
the 8-field set is the IS marketplace floor and must not be silently reduced).

| Version | Change |
| --- | --- |
| `1.0.0-draft` | Initial 8-field required set: `name`, `description`, `allowed-tools`, `version`, `author`, `license`, `compatibility`, `tags`. |

## § deprecationRegistry (FOLD 2/4 — tactical)

Evolves via **autonomous validator patch** (NON-NEGOTIABLES item 6 — spec-compliance bug fixes
are OK without architectural review). Each entry maps a deprecated key to its replacement; a
present deprecated key fails the fold with a migration message.

| Version | Change |
| --- | --- |
| `1.0.0-draft` | Initial migrations: `compatible-with` → `compatibility`; `when_to_use` → `description`. |

## § securityChecks (FOLD 3/4 — CISO-driven)

Owned by the CISO seat (plan 033 § 14.12). Supply-chain hardening.

| Version | Change |
| --- | --- |
| `1.0.0-draft` | `name` must not be a reserved word (`skill`, `claude`, `anthropic`, `mcp`, `plugin`, `agent`) and must not contain XML angle brackets; `description` must not contain XML tags or shell-substitution (`${…}`) sequences. |

## § disclosureMarkers (FOLD 4/4 — Karpathy-axis)

Progressive disclosure / token-economy.

| Version | Change |
| --- | --- |
| `1.0.0-draft` | `description` bounded to a 1536-character token budget. |

## § isMarketplace (composition — architectural)

Adding/removing a fold is an architectural change requiring ISEDC review.

| Version | Change |
| --- | --- |
| `1.0.0-draft` | Initial `allOf` composition of the four folds above. |
