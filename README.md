# intent-eval-core

Canonical contracts kernel for the [Intent Eval Platform](https://github.com/jeremylongshore/intent-eval-lab) — TypeScript types, JSON Schemas, Zod validators, and state machines for the 13 canonical platform entities.

> **Status:** scaffolding (epic `iec-E01`). Contracts are not yet stable. Do not depend on this package outside the Intent Eval Platform until v0.1.0 ships.

## What this is

`intent-eval-core` is the **kernel** of the Intent Eval Platform:

- **TypeScript interfaces** for every entity in the 13-entity canonical domain model (Blueprint B § 4)
- **JSON Schemas** as the language-neutral wire format
- **Zod validators** for runtime validation at every trust boundary
- **State machines** governing entity transitions

It is **not**:

- A runtime — execution lives in dedicated runtime packages
- A judge — behavioral evaluation lives in `@j-rig/*`
- A harness — deterministic gates live in `audit-harness`

Every validator in the platform — `audit-harness` deterministic gates, `j-rig` behavioral evaluators, `intent-rollout-gate` decision shell — depends on this package for canonical contract definitions. One source of truth, many consumers.

## Architecture

This package is bound by the Intent Eval Platform's Phase A foundation, all on `main` of `intent-eval-lab`:

| Document | Role |
|---|---|
| **DR-010** — ISEDC Session 4 widened-scope lock | Governance, TS-primary signing surfaces, unification thesis (every validator emits Evidence Bundle) |
| **Blueprint A** — Ecosystem Master Blueprint | 12 binding principles, 5-repo taxonomy, anti-goals |
| **Blueprint B** — Platform Runtime Blueprint | 13-entity canonical domain model, `gate-result/v1` predicate contract |
| **Blueprint C** — Repo Blueprint Template | The template this repo's blueprint applies |
| **Canonical Glossary** | Platform terminology — every doc cites here |

The per-repo blueprint for `intent-eval-core` itself ships under epic `iec-E10` (Blueprint C application).

## License

Apache License 2.0 — see [LICENSE](LICENSE).

The kernel is permissively licensed so every downstream consumer (commercial, OSS, internal) can depend on it without friction. The platform's enforcement scripts (`audit-harness`) ship under MIT for the same reason.

## Status

Phase A foundation complete (2026-05-15). This repo is at epic `iec-E01` (scaffold). Track progress at:

- Bead workspace: `~/000-projects/.beads/` (prefix `iec-`)
- Plane sub-module: **Intent Eval Core — Kernel** in [LAB project](https://projects.intentsolutions.io)
- Master plan: `~/.claude/plans/se-the-council-bubbly-frog.md`
