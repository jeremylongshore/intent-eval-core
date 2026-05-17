# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@intentsolutions/core` — the canonical contracts kernel for the [Intent Eval Platform](https://github.com/jeremylongshore/intent-eval-lab). TypeScript types, JSON Schemas, Zod validators, and state machines for the 13 canonical platform entities. **Every** validator in the platform (`audit-harness`, `j-rig`, `intent-rollout-gate`) depends on this package for canonical contract definitions.

This repo is **kernel-only**:

- ✅ Type definitions, schemas, validators, state machines
- ❌ Runtime execution
- ❌ Judges or behavioral evaluation logic
- ❌ Deterministic gates or harness scripts

The role separation is **binding** (Blueprint A § anti-goals). Adding execution code here will be rejected.

## Architectural binding

Phase A foundation is on `main` of [`intent-eval-lab`](https://github.com/jeremylongshore/intent-eval-lab). Every decision in this repo must be consistent with:

| Source | Path on intent-eval-lab | Role |
|---|---|---|
| **DR-010** | `000-docs/010-AT-DECR-isedc-council-session-4-widened-scope-2026-05-13.md` | Governance lock; TS-primary signing surfaces; unification thesis (every validator emits Evidence Bundle) |
| **Blueprint A** | `000-docs/011-AT-ARCH-ecosystem-master-blueprint.md` | 12 binding principles, 5-repo taxonomy, anti-goals |
| **Blueprint B** | `000-docs/012-AT-ARCH-platform-runtime-blueprint.md` | 13-entity canonical domain model; **NORMATIVE** `gate-result/v1` predicate spec (§ 7) |
| **Blueprint C** | `000-docs/013-AT-SPEC-repo-blueprint-template.md` | Template this repo's blueprint applies (epic `iec-E10`) |
| **Canonical Glossary** | `000-docs/014-DR-GLOS-canonical-glossary.md` | Single source of truth for terminology |

If a change in this repo would require a change in any of the above, **stop** — coordinate via `intent-eval-lab` first (or open an ADR here that references the binding doc explicitly).

## Source-of-truth hierarchy

When sources disagree, the higher tier wins:

| Tier | Source | Authority |
|---|---|---|
| **1** | bd workspace `~/000-projects/.beads/` (prefix `iec-`) | task state, dependencies, sub-bead clusters |
| **2** | DR-010 | governance bindings, override addenda § 13.5 + § 13.6 |
| **3** | Blueprint A | ecosystem principles, repo taxonomy, anti-goals |
| **4** | Blueprint B | runtime architecture, 13-entity domain model, gate-result/v1 |
| **5** | Canonical glossary | platform terminology |
| **6** | Repo blueprint (`iec-E10`) | this repo's specific architecture choices |
| **7** | This `CLAUDE.md` | operational rules for working in this directory |

## Tooling commands

```bash
pnpm install              # install deps (frozen-lockfile in CI)
pnpm run check            # lint + typecheck + test (full gate)
pnpm run build            # tsc -p tsconfig.build.json → dist/
pnpm run test             # vitest run
pnpm run test:watch       # vitest watch mode
pnpm run lint             # eslint .
pnpm run lint:fix         # eslint . --fix
pnpm run typecheck        # tsc --noEmit
pnpm run format           # prettier --write .
pnpm run format:check     # prettier --check .
```

`pnpm run check` is the **canonical pre-commit gate**. CI runs the same chain plus build + dist-artifact verification.

## Project structure

```
intent-eval-core/
├── src/
│   ├── index.ts            ← public surface (currently empty by design)
│   └── index.test.ts       ← smoke test
├── dist/                   ← build output (gitignored)
├── tsconfig.json           ← base TS config (noEmit, for editor + lint)
├── tsconfig.build.json     ← emit-only build config (rootDir=src)
├── eslint.config.js        ← flat-config ESLint, typed lint enabled
├── vitest.config.ts        ← vitest with 80% coverage thresholds
├── package.json            ← @intentsolutions/core, ESM, Node 20+, pnpm 9+
├── .nvmrc                  ← Node 22
└── .github/workflows/ci.yml ← lint+typecheck+test+build on PR + push to main
```

## TypeScript discipline

- **strict: true** plus every additional strictness flag (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`)
- **No `any`** — `@typescript-eslint/no-explicit-any: error`
- **Type-only imports must use `import type`** — `consistent-type-imports: error`
- **ESM only** — `"type": "module"` in package.json, `.js` extensions in relative imports per NodeNext resolution

The strictness floor is **non-negotiable**. Loosening any strict flag requires explicit ADR + binding-doc update.

## Task tracking (beads)

Canonical bd workspace is **`~/000-projects/.beads/`** (umbrella, prefix `iec-`). This repo does **not** have its own `.beads/` directory — every IEP task is tracked at the umbrella level so cross-repo dependencies are visible.

Three-layer mirror (per umbrella `CLAUDE.md`):

| Layer | Where |
|---|---|
| Bead | `~/000-projects/.beads/` (canonical state) |
| GitHub issue | https://github.com/jeremylongshore/intent-eval-core/issues — one per epic (label `epic`); sub-beads share the parent issue |
| Plane | **Intent Eval Core — Kernel** sub-module under LAB project |

Use `bd-sync link/note/close` for every state change. After bulk operations, apply the JSONL workaround from umbrella CLAUDE.md (tracked at `bd_000-projects-ufc`; upstream issues #3848 + #3970).

## Branch + PR conventions

- Branch naming: `feat/iec-eN-<short-description>` for epics, `fix/iec-eNX-<short-description>` for sub-beads
- Every PR references the bead ID in the body (e.g., "Refs bead `bd_000-projects-3mv`")
- Conventional Commits: `chore:`, `feat:`, `fix:`, `docs:`, `test:`, `ci:`, `refactor:`
- Required CI check: **`lint + typecheck + test + build`** — branch protection enforces

## Operational rules

1. **Kernel-only** — execution / judges / harness logic do not belong here. If a feature feels like runtime, it goes in a runtime package.
2. **Every new contract emits Evidence Bundle compatibility** — per DR-010 unification thesis. Add the JSON Schema + Zod validator + state machine before the consuming code lands.
3. **No partial strictness** — TS strict flags ratcheted up are never ratcheted down without ADR.
4. **No transient surface** — `src/index.ts` re-exports only stable contracts. WIP types live in internal modules and are not re-exported until promotion.
5. **CI is the source of truth for "passes"** — local `pnpm run check` is necessary but not sufficient; main-branch protection requires the CI status check to pass.
6. **PRs go through review even from the owner** — the canonical contracts kernel earns its weight from review discipline. No direct pushes to main.

## When in doubt

- Check the bead description: `bd show bd_000-projects-<id>`
- Check the binding doc (DR-010, Blueprint A/B/C, glossary) on `intent-eval-lab` main
- Check the umbrella `CLAUDE.md` at `~/000-projects/intent-eval-platform/CLAUDE.md`
- Open a question issue on this repo with the `question` label
