---
title: Core Repo Boundary Doctrine — intent-eval-core
date: 2026-05-18
authors:
  - Jeremy Longshore (Intent Solutions)
status: NORMATIVE
binding_authority: iec-E11
inherits_from:
  - intent-eval-lab/000-docs/011-AT-ARCH-ecosystem-master-blueprint.md (Blueprint A)
  - intent-eval-core/000-docs/002-AT-ARCH-repo-blueprint-2026-05-18.md (per-repo blueprint § 3.4 anti-goals)
related_drs:
  - "`intent-eval-lab/000-docs/010-AT-DECR-isedc-council-session-4-widened-scope-2026-05-13.md` (DR-010)"
related_glossary:
  - intent-eval-lab/000-docs/014-DR-GLOS-canonical-glossary.md
filing_standard: Document Filing Standard v4.3
forward_refs:
  - iel-E13 — Architecture boundary standards (3-doc cluster) — upstream lab-side doctrine; this doc will be re-anchored against iel-E13 once it lands. Until then, this doc is the operative kernel-side standard.
---

## Core Repo Boundary Doctrine — `intent-eval-core`

## § 1 — Why this doc exists

Blueprint A § 3 + the per-repo blueprint § 3.4 declare `intent-eval-core` as the **canonical contracts kernel** — types, schemas, validators, state machines only. **No runtime execution, no orchestration, no judges, no queues, no provider adapters, no optimization engines, no runtime telemetry.**

Those are NORMATIVE anti-goals, but a NORMATIVE statement is not the same as enforcement. A contributor (or future AI agent) reading the per-repo blueprint can still author a PR that adds `express` to dependencies, drops a `src/orchestrator/` directory, or installs `@anthropic-ai/sdk` — and the per-repo blueprint alone won't stop it. The blueprint codifies the boundary; this doctrine **enforces** it.

The enforcement is **4-axis** because boundary violations come in four shapes:

| Axis | What it catches | Where it lives |
| --- | --- | --- |
| **Package patterns** | Forbidden npm packages by name (e.g., `express`, `pg`, `bullmq`, `@anthropic-ai/sdk`) | `FORBIDDEN.md` § Package patterns |
| **Import paths** | Forbidden source-code paths (e.g., `src/runtime/`, `src/orchestration/`, `src/judges/`) | `FORBIDDEN.md` § Import paths |
| **Directory names** | Forbidden repo-root directories (e.g., `services/`, `orchestrator/`, `workers/`) | `FORBIDDEN.md` § Directory names |
| **Package categories** | Forbidden npm-keyword categories (heuristic — packages tagged `web-framework`, `orchestration`, `database`, `llm-provider`, etc.) | `FORBIDDEN.md` § Package categories |

A single check (`scripts/check-boundaries.ts`) reads all four axes from `FORBIDDEN.md` and `ALLOWLIST.md`, scans the repo state, and emits violations. The check runs at three gates: pre-commit (developer laptop), CI on every PR (`.github/workflows/boundary-check.yml`), and explicitly on demand (`pnpm run boundaries`).

## § 2 — Why 4 axes (not 1)

A single-axis check would be incomplete:

- **Package-pattern-only** (`forbidden-packages.json`) misses: contributor copies code into `src/runtime/` from another repo without adding any new dep, slipping past dependency checks.
- **Import-path-only** misses: contributor adds `express` as a dependency and uses it in a "legitimate-looking" file path like `src/utils/server.ts` — the import-path check passes; the package-pattern check would catch it.
- **Directory-name-only** misses: contributor adds `bullmq` to dependencies but names the directory `src/processing/` — the directory check passes; the package-pattern check catches it.
- **Package-category-only** is fuzzy and best-effort — depends on npm `keywords` field which is consumer-self-declared. Useful as a heuristic but cannot be the sole gate.

**All 4 axes together** = defense in depth. Any single axis catches some classes of violation; the union catches all classes of "intent-eval-core absorbing runtime concerns."

## § 3 — Override process

The boundary is binding but not absolute. Edge cases will arise. The override process:

### § 3.1 What requires an override

Any addition to the repo that triggers a boundary check failure requires an explicit override. Examples:

- Adding a new runtime dependency to `package.json#dependencies` — ALLOWLIST.md cap of ≤8 is hard-coded; adding a 9th requires override
- Adding a new directory under `src/` — if dep-cruiser's allowed-list rules don't admit it, an override is required
- Adding a new top-level directory (e.g., `services/`) — `FORBIDDEN.md § Directory names` enumerates the forbidden set; additions to the directory layout require override AND a corresponding update to `FORBIDDEN.md` to redocument which dirs ARE allowed

### § 3.2 How an override is requested

1. **Pre-PR**: file a bead in the `iec-` prefix titled `iec-boundary-override-<short-description>` with the proposed exception and rationale.
2. **In the PR**: include the bead ID in the PR description AND a line in the PR body: `boundary-override: bd_000-projects-<id>`.
3. **The boundary checker** (`scripts/check-boundaries.ts`) recognizes the `boundary-override` line in the PR description as a kill switch — when the checker runs in CI, it parses the PR body via `gh pr view --json body` and accepts the override **for the offending file/dep/dir explicitly named in the bead**, no other.
4. **Class-2 ISEDC review** is REQUIRED for any override that crosses a major boundary (runtime execution, provider adapter, queue, judge logic, optimization engine). The bead must reference the ISEDC convening date + DR ID in its notes.

### § 3.3 Override expiration

Every override has an expiration date stated in the bead. Default: 30 days. If the bead remains open past expiration, the override is no longer honored and the next CI run blocks PRs that depend on it. The point is that an override is **temporary breathing room while a permanent solution lands** — typically either (a) the offending dep gets relocated to a sibling repo, (b) the boundary is permanently widened via a per-repo blueprint amendment + Class-1 ISEDC convening, or (c) the override expires and the constraint reasserts.

### § 3.4 What CANNOT be overridden

These are hard prohibitions per Blueprint A § 3 + DR-010 § 13.5 — no override path exists:

- Predicate URIs hosted at `labs.intentsolutions.io` (ISEDC CISO binding — predicate URIs MUST live at `evals.intentsolutions.io`)
- Customer-signal gates as Phase B unblockers (DR-010 § 13.5 explicit override; removed permanently)
- Partner names in public-facing artifacts without explicit written consent (DR-004 S1Q2 + DR-010 § 10 reaffirmation)

Attempting to override any of the above is itself a Class-1 ISEDC trigger.

## § 4 — Relationship to the per-repo blueprint

The per-repo blueprint (`000-docs/002-AT-ARCH-repo-blueprint-2026-05-18.md`) is the WHAT. This doctrine is the HOW.

| Per-repo blueprint says | This doctrine implements |
| --- | --- |
| § 1.2 "NOT a runtime" | Package-pattern + import-path + directory-name checks block runtime additions |
| § 3.2 "Out of scope: runtime execution" | `FORBIDDEN.md § Package patterns` lists every runtime/orchestration npm package by name |
| § 3.4 "Schema duplication is forbidden" | (Enforced elsewhere — by the kernel BEING the source of truth, peer repos importing) |
| § 3.4 "Runtime concerns stay out — enforced architecturally" | `scripts/check-boundaries.ts` + CI workflow + pre-commit hook |
| § 3.4 "labs.intentsolutions.io reserved-don't-touch" | `FORBIDDEN.md` lists `labs.intentsolutions.io` as a forbidden URL pattern (separate axis from packages) |

## § 5 — Relationship to dep-cruiser (`pnpm run arch`)

`dependency-cruiser` (`.dependency-cruiser.cjs`) enforces a related but **distinct** set of rules:

- **dep-cruiser scope**: in-repo source-code layering (e.g., `predicates-no-entities`, `validators-only-import-zod`, `state-machines-pure`, `no-circular`, `no-test-imports-in-src`). It governs the **internal architecture** of the repo.
- **Boundary doctrine scope**: external boundaries (what npm packages may exist; what directories may exist; what import paths exist at the repo root level). It governs the **external surface** of the repo.

The two complement each other:

- A PR that adds `src/runtime/` would trigger dep-cruiser's `kernel-no-runtime-deps` rule AND this doctrine's `FORBIDDEN.md § Import paths` rule. Either alone is sufficient to block; together they are defense in depth.
- A PR that adds `express` would NOT necessarily trigger dep-cruiser (depending on where it's imported) but WOULD trigger this doctrine's `FORBIDDEN.md § Package patterns` check.
- A PR that adds a directory `services/` at the repo root is NOT a dep-cruiser concern (dep-cruiser only sees the `src/` tree) but WOULD trigger this doctrine's `FORBIDDEN.md § Directory names` check.

## § 6 — Relationship to the harness escape-scan

`pnpm exec audit-harness escape-scan --staged` (run at pre-commit + in CI) catches **policy-edit violations**: lowering coverage floors, mutating hash-pinned policy files, removing test files in bulk, etc. Different concern from boundary enforcement:

- **escape-scan** — protects the quality-gate policy from erosion.
- **boundary-doctrine** — protects the repo's role/identity from drift.

The boundary-doctrine checker runs after escape-scan in pre-commit; CI runs both as separate steps.

## § 7 — How to extend the boundary set

The 4-axis set is finite by design. If a new violation class appears that none of the 4 axes catch, the response is NOT "ignore it" — the response is:

1. **File a bead** in `iec-` prefix titled `iec-boundary-extend-<short-description>` describing the gap class.
2. **Author a 5th axis** in `FORBIDDEN.md` + extend `scripts/check-boundaries.ts` to enforce it.
3. **Class-2 ISEDC review** to ratify the 5th axis as binding kernel doctrine.

This doctrine does NOT pre-enumerate hypothetical future axes. The 4 it ships with are what experience has shown matter; further axes ratchet up via ISEDC.

## § 8 — How to retire a boundary

Boundaries can be widened (rules relaxed) or narrowed (rules tightened). Both move via Class-2 ISEDC pair Decision Record:

- **Widening** (e.g., removing `bullmq` from `FORBIDDEN.md § Package patterns` because the kernel is now allowed to define a queue interface as a canonical entity): requires DR explaining why the boundary's failure mode no longer applies.
- **Narrowing** (e.g., adding `node-cron` to forbidden because a new failure mode was observed): requires DR explaining the failure mode being prevented + a migration plan if any existing code depends on the newly-forbidden item.

Boundary changes do NOT happen via PR comment, Slack thread, or "I'm refactoring." They happen via DR.

## § 9 — Operational reference

| Operation | Command |
| --- | --- |
| Manual run | `pnpm run boundaries` |
| Pre-commit | Runs automatically via `.husky/pre-commit` |
| CI gate | `.github/workflows/boundary-check.yml` runs on every PR + push to main |
| Read the forbidden set | `cat FORBIDDEN.md` |
| Read the allowed set | `cat ALLOWLIST.md` |
| File an override | `bd create --title "iec-boundary-override-<desc>" --type=task --priority=1 --description "..."` |

## § 10 — Acknowledgments

This doctrine inherits the IS Testing SOP's enforcement-travels-with-the-code principle (hooks + CI reference in-repo scripts, never `~/.claude/` paths). It applies the same principle to boundary discipline: the checker lives in this repo, the rules are committed to this repo, the enforcement gates run in this repo's CI. A consumer who clones the repo and runs `pnpm run boundaries` gets the same verdict the maintainer gets.

— Jeremy Longshore
intentsolutions.io
