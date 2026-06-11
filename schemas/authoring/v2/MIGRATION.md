# Migrating skill-frontmatter from authoring/v1 to authoring/v2

> **Non-normative.** This is prose guidance for authors and consumers. It carries **no `$ref` into
> v1** and is not part of the wire contract — the normative artifacts are the v2 JSON Schemas in this
> directory and their Zod mirrors under `src/validators/v1/authoring/v2/`. v1 stays the looser
> PUBLISHED contract (BYTE-FROZEN at `@intentsolutions/core@0.4.1`); migrating to v2 is opt-in and
> per-consumer.

## TL;DR

`authoring/v2/skill-frontmatter` is the STRICT IS-marketplace contract. It accepts a **strict subset**
of what v1 accepts: every artifact v1 rejects, v2 also rejects, plus four new violation classes v1 let
through. If your skill is already authored to the CCP marketplace prose validator
(`validate-skills-schema.py --marketplace`), it is almost certainly already v2-clean — v2 is the kernel
catching up to that prose validator.

Pin the family explicitly. There is **no `latest` / unversioned authoring alias** — a consumer targets
`authoring/v1` or `authoring/v2` by name, so a package bump never silently tightens you.

## The four differences (v1 → v2)

| # | v1 accepts | v2 rejects | Fix |
| --- | --- | --- | --- |
| 1 | `allowed-tools: Bash` (bare, unscoped) | bare `Bash` token in string OR array form | Scope it: `Bash(git:*)`, `Bash(npm:*)`, … |
| 2 | `description` containing `$(...)` or `` `...` `` | `$(` or a backtick anywhere in `description` | Remove the shell-substitution; describe the behaviour in prose |
| 3 | `name: claude-reflect`, `name: my-anthropic-tool` | any `name` whose lowercase contains `claude` or `anthropic` | Rename so the substring is gone (this cascades to the plugin dir + `package.json` + `marketplace.json` + cross-links — make it one atomic PR) |
| 4 | `description` of 1025–1536 chars | `description` longer than 1024 chars | Trim to ≤ 1024 chars (the agentskills.io soft cap) |

Everything else is identical: same 8-field required set, same SemVer narrowing on `version`, same
optional IS extension fields, same kyh9 `requires_env`/`fallback_for_env` mutual-exclusion.

## What did NOT change

- The required-field floor (`name, description, allowed-tools, version, author, license,
  compatibility, tags`) — unchanged; v2 is a NARROWING, not a re-floor.
- The base `name` kebab-case + 64-char surface and the 500-char `compatibility` cap — carried.
- The exact-word reserved-name enum (`skill`/`claude`/`anthropic`/`mcp`/`plugin`/`agent`) and the
  `[<>]` / XML / `${…}` guards — carried; v2 only ADDS conjuncts on top.

## Reserved-name triage note (for the curious)

v1 rejected only the exact words `skill`/`claude`/`anthropic`/`mcp`/`plugin`/`agent`; the CCP prose
validator (line 1706) rejects any name whose lowercase *contains* `claude` or `anthropic` as a
substring. So `claude-reflect` PASSED v1 but FAILS the prose validator. That is a genuine **stricter
rule** the kernel never had (not a v1 bug — v1's exact-word match was a deliberate, internally
consistent design), so v2 adds the substring conjunct rather than back-patching v1.

## For schema consumers (ajv)

Register the three v2 layers by `$id` and resolve the composition:

```
authoring/v2/marketplace-tier.schema.json
authoring/v2/upstream-base/skill-frontmatter.v1.json
authoring/v2/is-overlay/skill-frontmatter.v2.json
authoring/v2/skill-frontmatter.schema.json    ← compose this
```

All four v2 rules — including scoped-Bash — are enforced by **plain ajv** (no extension keyword needed
for enforcement). The `x-scoped-tool` and `x-mutually-exclusive-fields` keys are benign vendor
annotations; register them as no-op keywords so ajv strict mode tolerates them
(`ajv.addKeyword({ keyword: 'x-scoped-tool' })`, likewise for `x-mutually-exclusive-fields`). The
kyh9 mutual-exclusion predicate is the ONLY rule not structurally enforced — it lives in the Zod layer
as the documented carve-out (same as v1).

## For Zod consumers

```ts
import { SkillFrontmatterV2Schema } from '@intentsolutions/core/validators/v1/authoring/v2';
const result = SkillFrontmatterV2Schema.safeParse(frontmatter);
```
