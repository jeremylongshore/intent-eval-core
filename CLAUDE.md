# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@intentsolutions/core` — the canonical contracts kernel for the [Intent Eval Platform](https://github.com/jeremylongshore/intent-eval-lab). TypeScript types, JSON Schemas, Zod validators, and state machines for the 16 canonical platform entities (the 13 from Blueprint B § 2 + `SkillVersion` per DR-028 T1 + `UsageEvent` and `HumanReview` per ISEDC DR-103 D1; per DR-103 D1 B1.5 no fixed ordinal is claimed for either DR-103 entity). **Every** validator in the platform (`audit-harness`, `j-rig`, `intent-rollout-gate`) depends on this package for canonical contract definitions.

This repo is **kernel-only**:

- ✅ Type definitions, schemas, validators, state machines
- ❌ Runtime execution
- ❌ Judges or behavioral evaluation logic
- ❌ Deterministic gates or harness scripts

The role separation is **binding** (Blueprint A § anti-goals). Adding execution code here will be rejected.

## Architectural binding

Phase A foundation is on `main` of [`intent-eval-lab`](https://github.com/jeremylongshore/intent-eval-lab). Every decision in this repo must be consistent with:

| Source                 | Path on intent-eval-lab                                                    | Role                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **DR-010**             | `000-docs/010-AT-DECR-isedc-council-session-4-widened-scope-2026-05-13.md` | Governance lock; TS-primary signing surfaces; unification thesis (every validator emits Evidence Bundle) |
| **Blueprint A**        | `000-docs/011-AT-ARCH-ecosystem-master-blueprint.md`                       | 12 binding principles, 5-repo taxonomy, anti-goals                                                       |
| **Blueprint B**        | `000-docs/012-AT-ARCH-platform-runtime-blueprint.md`                       | 13-entity canonical domain model; **NORMATIVE** `gate-result/v1` predicate spec (§ 7)                    |
| **Blueprint C**        | `000-docs/013-AT-SPEC-repo-blueprint-template.md`                          | Template this repo's blueprint applies (epic `iec-E10`)                                                  |
| **Canonical Glossary** | `000-docs/014-DR-GLOS-canonical-glossary.md`                               | Single source of truth for terminology                                                                   |

If a change in this repo would require a change in any of the above, **stop** — coordinate via `intent-eval-lab` first (or open an ADR here that references the binding doc explicitly).

## Source-of-truth hierarchy

When sources disagree, the higher tier wins:

| Tier  | Source                                                | Authority                                                    |
| ----- | ----------------------------------------------------- | ------------------------------------------------------------ |
| **1** | bd workspace `~/000-projects/.beads/` (prefix `iec-`) | task state, dependencies, sub-bead clusters                  |
| **2** | DR-010                                                | governance bindings, override addenda § 13.5 + § 13.6        |
| **3** | Blueprint A                                           | ecosystem principles, repo taxonomy, anti-goals              |
| **4** | Blueprint B                                           | runtime architecture, 13-entity domain model, gate-result/v1 |
| **5** | Canonical glossary                                    | platform terminology                                         |
| **6** | Repo blueprint (`iec-E10`)                            | this repo's specific architecture choices                    |
| **7** | This `CLAUDE.md`                                      | operational rules for working in this directory              |

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
pnpm run boundaries       # kernel anti-goal boundary checker (FORBIDDEN.md/ALLOWLIST.md)
pnpm run arch             # audit-harness architecture rules (Blueprint A anti-goals)
pnpm run harness:verify   # hash-pinned policy verification (audit-harness verify)
pnpm run codegen:validators  # regen src/validators/v1/_generated/ Zod from schemas/v1/*.json
pnpm run codegen:authoring   # regen authoring-tier codegen (:check for stale-gate)
pnpm run codegen:pydantic    # regen Python Pydantic mirror (:check for drift)
pnpm run api:check        # api-extractor SemVer surface regression gate (iec-E07)
pnpm run test:coverage    # vitest --coverage, 100% floor (NOT 80%)
```

`pnpm run check` is the **canonical pre-commit gate** — a 15-step chain, NOT just lint+typecheck+test:
codegen:authoring:check → check:{predicate-namespace,chamber-isolation,rubric-floor,prose-anchors,
coverage-map,coverage-map-prose-anchors,is-extension-rationale} → check:version-lockstep →
format:check → lint → typecheck → test → arch → boundaries. CI (`.github/workflows/ci.yml`,
job "lint + typecheck + test + build") additionally runs build + test:coverage (100% floor) +
test:types (tsd) + harness:verify + api:check/api:diff + Codecov upload.

## Project structure

Published as **`@intentsolutions/core@0.9.0`** (sigstore provenance). The kernel is **bicameral** — a runtime tier and an authoring tier:

```text
intent-eval-core/
├── src/
│   ├── entities/           ← TS interfaces + state machines for the 16 canonical entities
│   │                          (Blueprint B § 2's 13 + SkillVersion per DR-028 T1
│   │                          + UsageEvent and HumanReview per ISEDC DR-103 D1):
│   │                          EvalSpec, EvalRun, EvidenceBundle, JudgeDecision, RuntimeReceipt,
│   │                          SessionTrace, ToolInvocation, CostRecord, FailureTaxonomy,
│   │                          MatcherMap, RegressionPack, RolloutGate, SkillSnapshot, SkillVersion,
│   │                          UsageEvent, HumanReview
│   │                          (+ EvidenceBundlePayload — the wire format EvidenceBundle resolves to)
│   ├── validators/v1/       ← Zod validators (runtime tier) + validators/v1/authoring/ (SAK tier)
│   └── index.ts             ← public surface (re-exports stable contracts)
├── schemas/
│   ├── v1/                  ← runtime-tier JSON Schemas (draft 2020-12) — one per entity
│   │                          + gate-result, retraction, dashboard-render, skill-refiner-pass
│   ├── authoring/v1/        ← Spec Authority Kernel (SAK): authoring-artifact contracts
│   │                          (skill-frontmatter [PUBLISHED], plugin-manifest, agent-definition,
│   │                           mcp-config, hook-config, marketplace-catalog) — each composes
│   │                           upstream-base/ + 3 universal folds + is-overlay/
│   └── authoring/v2/        ← STRICT IS-marketplace profile (DR-062/DR-049); all 6 contracts
│                              forked; SHIPPED-INTERNAL, not yet canonical (zero $ref into v1)
├── python/                ← Pydantic mirror of the kernel entities (codegen:pydantic);
│                              AJV/Zod/Pydantic three-way parity tests; CI: .github/workflows/python.yml
├── dist/                   ← build output (gitignored)
├── tsconfig.json           ← base TS config (noEmit, for editor + lint)
├── tsconfig.build.json     ← emit-only build config (rootDir=src)
├── eslint.config.js        ← flat-config ESLint, typed lint enabled
├── vitest.config.ts        ← vitest with 100% coverage floor enforced (CI test:coverage step)
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

| Layer        | Where                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Bead         | `~/000-projects/.beads/` (canonical state)                                                                                   |
| GitHub issue | <https://github.com/jeremylongshore/intent-eval-core/issues> — one per epic (label `epic`); sub-beads share the parent issue |
| Plane        | **Intent Eval Core — Kernel** sub-module under LAB project                                                                   |

Use `bd-sync link/note/close` for every state change. After bulk operations, JSONL stays fresh via `export.interval=1s` in the umbrella `.beads/config.yaml` (the earlier "auto-flush drops writes" framing was closed as mischaracterized — the real cause was bd's 60s throttle window).

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

## AI code review — BOTH REVIEWERS ARE DARK (do not wait for one)

**As of 2026-07-22 no AI reviewer runs on this repo.** Verified by surveying the
last four PRs across all six Intent Eval Platform repos: `gemini-code-assist`
now posts only a sunset notice, and `greptile` has zero activity anywhere.

- **Gemini Code Assist** — **SUNSET, permanently.** The consumer version on
  GitHub has ceased all review activity; the bot says so verbatim on live PRs.
  `.gemini/config.yaml` + `.gemini/styleguide.md` are retained but INERT. This
  is a vendor decision — it is not a quota that resets and it is not coming back.
- **Greptile** (`.greptile/config.json` + `rules.md` + `files.json`) — configured
  to the platform-unified schema (`strictness: 3`, `commentTypes:
["logic","syntax"]`, `statusCheck: false`, a universal `no-gate-weakening`
  rule, plus this repo's scoped invariant rules) but **not observed reviewing
  any PR**. The config stays so the App works if it is reinstalled; do not treat
  it as an expected reviewer today.

**Operationally: never block a merge waiting for an AI review.** Check whether
one arrived, read it if so, and otherwise proceed on CI. The deterministic merge gate is this repo's own CI (`lint + typecheck + test + build`) plus CodeQL. That was
always the required gate; it is now the only one. Installing or uninstalling the
GitHub Apps is an admin (UI) action — the in-repo config here does not do it.

**Replacement (decided 2026-07-22, not yet activated):** stand up the advisory
lane we already run on the marketplace repo —
`claude-code-plugins/.github/workflows/minimax-review.yml`. The action is
[`tarmojussila/minimax-code-review`](https://github.com/tarmojussila/minimax-code-review)
(the upstream mechanism), consumed via our own fork
`jeremylongshore/minimax-code-review` **pinned to an immutable SHA** — the right
supply-chain posture for a small single-maintainer action: we do not auto-track
upstream. It is fork-safe by construction (`pull_request`, not
`pull_request_target`, plus a same-repo guard, so a forked PR never receives the
API key) and kill-switched by repo variable.

**Do not copy CCPI's prompts.** The mechanism is generic; the value is prompts
grounded in the consuming repo's own invariants — CCPI's three lanes are written
against its validators and its A-grade bar and would be noise here. For this
repo the reviewer should be pointed at kernel contract integrity — `FORBIDDEN.md` anti-goals and `ALLOWLIST.md`, three-layer JSON-Schema/Zod/Pydantic parity, cross-field invariants, and any change to a signed one-way-door shape.

Activation needs owner secret actions: repo secret `MINIMAX_API_KEY` + repo
variable `ENABLE_MINIMAX_REVIEW=true` (+ `MINIMAX_MODEL`). Until then this repo
is CI-only, deliberately.

## Anti-goals (binding scope control)

These are the kernel's NORMATIVE boundaries. Each is enforced architecturally — not just documented. The full boundary doctrine is at [`000-docs/003-AT-STND-core-repo-boundaries-2026-05-18.md`](000-docs/003-AT-STND-core-repo-boundaries-2026-05-18.md). The machine-readable enumeration is at [`FORBIDDEN.md`](FORBIDDEN.md). The allowlist counterpart is at [`ALLOWLIST.md`](ALLOWLIST.md). The unified checker is at [`scripts/check-boundaries.ts`](scripts/check-boundaries.ts) (`pnpm run boundaries`).

| Anti-goal                        | What it prevents                                                      | Enforcement                                                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **NOT a runtime**                | Adding orchestration / agents / job queues / schedulers to the kernel | FORBIDDEN.md Axis 1 (npm packages) + Axis 2 (src/runtime/, src/orchestrator/) + Axis 3 (services/, workers/)                                                 |
| **NOT a judge**                  | Adding LLM-judge logic or behavioral evaluation primitives            | FORBIDDEN.md Axis 1 (LLM provider adapters) + Axis 2 (src/judges/, src/agents/)                                                                              |
| **NOT a harness**                | Adding deterministic gate logic (that belongs in audit-harness)       | FORBIDDEN.md Axis 2 (src/adapters/, src/optimization/) + dep-cruiser `validators-only-import-zod`                                                            |
| **NOT a service**                | Adding HTTP servers / gRPC / REST APIs / websockets                   | FORBIDDEN.md Axis 1 (web frameworks) + Axis 2 (src/server/, src/api/) + Axis 3 (services/, api/)                                                             |
| **NOT a database**               | Adding DB drivers / ORMs / storage SDKs                               | FORBIDDEN.md Axis 1 (pg, mysql, mongodb, prisma, etc.) + Axis 2 (src/db/, src/persistence/)                                                                  |
| **Predicate URIs are scoped**    | Using `labs.intentsolutions.io` as a predicate URI host               | FORBIDDEN.md URL-pattern axis — REFUSE, no override path; CISO binding DR-004 + DR-010 § 10                                                                  |
| **Schema duplication forbidden** | Peer repos redefining canonical entity types locally                  | Architectural: the kernel IS the source-of-truth; peer repos import — this is enforced via the unification thesis, validated by `/audit-tests` on peer repos |

**Override process for everything except CISO-binding URL patterns**: file a bead in `iec-` prefix, reference it in PR body as `boundary-override: bd_000-projects-<id>`. See doctrine § 3 for details. Class-2 ISEDC review is required for major-boundary crossings.

**No override exists** for:

- Predicate URIs at `labs.intentsolutions.io` (CISO binding)
- Partner names in public-facing artifacts without explicit written consent (DR-004 S1Q2 + DR-010 § 10)
- Customer-signal gates as Phase B unblockers (DR-010 § 13.5 — removed permanently)

## When in doubt

- Check the bead description: `bd show bd_000-projects-<id>`
- Check the binding doc (DR-010, Blueprint A/B/C, glossary) on `intent-eval-lab` main
- Check the umbrella `CLAUDE.md` at `~/000-projects/intent-eval-platform/CLAUDE.md`
- Open a question issue on this repo with the `question` label
