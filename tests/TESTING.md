# TESTING.md — `@intentsolutions/core`

> **This is the engineer-owned policy file.** Policy sections below are hash-pinned via `@intentsolutions/audit-harness`. Lowering any threshold or removing a waiver requires `pnpm exec audit-harness init` to re-pin — and an explanation in the commit message.

## Classification

| Field | Value |
| --- | --- |
| Repo type | `library` |
| Language | TypeScript 5 (strict + every additional strict flag) |
| Module system | ESM only (`"type": "module"`) |
| Runtime | Node 20+ / pnpm 9+ |
| Public-surface posture | Pure types — no runtime dependencies in published `dist/` |
| Compliance overlay | none |

## Architectural binding

This repo applies the IS Testing SOP per `~/000-projects/CLAUDE.md` § "Intent Solutions Testing SOP". Every gate listed below references the **in-repo** `@intentsolutions/audit-harness` installation — never `~/.claude/` paths.

Architectural boundaries enforced (Blueprint A anti-goals):

- Kernel ⊃ primitives only — entities depend on primitives, predicates depend on primitives + entities; no reverse edges
- `src/predicates/` MUST NOT import from `src/entities/` (predicates are upstream of entities at the wire layer)
- No runtime dependencies in `dist/` (kernel must stay light)
- No execution code, judges, or harness logic in this repo (they live in sibling repos)

The architecture-rule enforcement lives in `.dependency-cruiser.cjs`.

## Thresholds (policy — engineer-owned, hash-pinned)

> **Machine-readable form** (audit-harness escape-scan grammar). The table
> below is the human-readable mirror.

```text
coverage.line: 100
coverage.branch: 100
coverage.function: 100
coverage.statement: 100
mutation.kill_rate: 0
```

> `mutation.kill_rate: 0` is intentional — mutation testing is waived for
> this pure-type library (see § Waived gates). The escape-scan floor still
> needs a numeric value to compare against.

| Gate | Floor | Rationale |
| --- | --- | --- |
| `coverage.line` | 100 | Pure-type library — all runtime code is state-machine transition maps and brand-discrimination helpers. 100% coverage is the realistic and observed bar. |
| `coverage.branch` | 100 | Same rationale. |
| `coverage.function` | 100 | Same. |
| `coverage.statement` | 100 | Same. |
| `architecture.violations` | 0 | Blueprint A anti-goals are non-negotiable. |
| `type-test.count` | 90 | Floor on `expectTypeOf` assertions; currently 93. New entities/predicates MUST ship type-level locks. |
| `escape-scan` | REFUSE on any | Coverage / architecture / policy edits require engineer-initiated re-pin. |

## Applicable layers (7-layer taxonomy)

| Layer | Status | Notes |
| --- | --- | --- |
| **L1** — Git hooks & CI enforcement | INSTALLED | husky pre-commit + GitHub Actions CI (`lint + typecheck + test + build` required check) |
| **L2** — Static analysis & linting | INSTALLED | ESLint 9 flat config (typed lint via projectService), Prettier 3, TypeScript 5 strict |
| **L3** — Unit & function | INSTALLED | vitest 2 (runtime + type-level via `expectTypeOf`), 100% coverage |
| **L4** — Integration & regression — architecture rules | INSTALLED | dependency-cruiser via `pnpm exec audit-harness arch` |
| **L4** — Integration (DB / IO / contract) | WAIVED | Pure-type library — no IO, no DB, no migrations, no external contracts to test |
| **L5** — System quality (perf/sec/a11y/chaos) | WAIVED | No runtime to perf-test; no UI to a11y-test; security covered by L2 + escape-scan |
| **L6** — E2E / BDD / Gherkin | WAIVED | Library, not service — no user journey to E2E. Consumers (audit-harness, j-rig) own their own BDD. |
| **L7** — Acceptance / UAT | WAIVED | Library, not product — acceptance lives at the consumer level. |

## Waived gates

| Gate | Rationale |
| --- | --- |
| Mutation testing (Stryker) | Pure-type library — "code" is type definitions + transition maps. Mutations on `as const` arrays don't add signal. Reconsider if runtime logic accumulates. |
| CRAP score | Same rationale — no algorithmic complexity to score. |
| Bias-count | No BDD scenarios. |
| Gherkin-lint | No `.feature` files. |

Removing any waiver requires an engineer commit that adds the gate AND re-pins via `pnpm exec audit-harness init`.

## Installed gates

| Layer | Gate | Tool | Invocation |
| --- | --- | --- | --- |
| L0 | enforcement harness | `@intentsolutions/audit-harness@0.1.0` | `pnpm exec audit-harness <cmd>` |
| L1 | pre-commit | `husky@9.1.7` + `lint-staged@17` | `.husky/pre-commit` |
| L1 | CI checks | GitHub Actions | `.github/workflows/ci.yml` (`lint + typecheck + test + build` required) |
| L2 | lint | ESLint 9 flat | `pnpm run lint` |
| L2 | format | Prettier 3 | `pnpm run format:check` |
| L2 | typecheck | TypeScript 5 strict | `pnpm run typecheck` |
| L3 | runtime + type tests | vitest 2 + `expectTypeOf` | `pnpm run test` |
| L3 | coverage | vitest c8 | `pnpm run test:coverage` (100% floor enforced in `vitest.config.ts`) |
| L4 | architecture rules | `dependency-cruiser@17` via harness | `pnpm exec audit-harness arch` |
| escape-scan | diff-gate | harness | `pnpm exec audit-harness escape-scan --staged` |

## Frameworks

- **Test runner**: vitest 2
- **Type-level assertions**: `expectTypeOf` from vitest 2 (in-process) + `tsd@0.33` (separate-process second-opinion via `pnpm run test:types`) — both wired in iec-E02e
- **Lint**: ESLint 9 flat + typescript-eslint 8 (typed lint via `projectService`)
- **Format**: Prettier 3
- **Coverage**: vitest c8 (`@vitest/coverage-v8@2`)
- **Architecture**: dependency-cruiser 17 (config: `.dependency-cruiser.cjs`)
- **Pre-commit**: husky 9 + lint-staged 17

## Last audit

| Field | Value |
| --- | --- |
| Date | 2026-05-16 |
| Auditor | `/audit-tests` skill (Claude Code) |
| Grade | A (96/100) — all required gates green, 100% coverage, 93 type-level assertions, only deferred items are 8 architectural beads filed for follow-up |
| Report | `TEST_AUDIT.md` (transient, at repo root) |

## Traceability

| Layer | Source of truth |
| --- | --- |
| Requirements | `tests/RTM.md` (rebuilt by `rtm-builder-agent` per `/audit-tests` cycle) |
| Personas | `tests/PERSONAS.md` |
| Journeys | `tests/JOURNEYS.md` |
| Architectural binding | Blueprint A + Blueprint B + Canonical Glossary on `intent-eval-lab` main — every entity file in `src/entities/` cites its § N section |
| Decisions | Repo-relative ADRs (none yet); upstream DR-010 + ISEDC records on `intent-eval-lab` main |
