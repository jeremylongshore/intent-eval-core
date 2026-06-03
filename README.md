# `@intentsolutions/core`

Part of the **[Intent Eval Platform](https://github.com/intent-solutions-io/intent-eval-platform)** — the umbrella mapping the six repos that converge via a shared Evidence Bundle schema.

[![npm](https://img.shields.io/npm/v/@intentsolutions/core?color=cb3837&logo=npm)](https://www.npmjs.com/package/@intentsolutions/core)
[![CI](https://github.com/jeremylongshore/intent-eval-core/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/jeremylongshore/intent-eval-core/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![Provenance](https://img.shields.io/badge/sigstore-provenance-066da5)](https://www.npmjs.com/package/@intentsolutions/core)

Canonical contracts kernel for the [Intent Eval Platform](https://github.com/jeremylongshore/intent-eval-lab) — TypeScript types, JSON Schemas, Zod validators, and state machines for the 13 canonical platform entities.

> **Status — v0.1.0 (2026-05-17):** first public release. Contracts are stable at v0.1; breaking changes will bump to v0.2 per SemVer. Published with sigstore provenance — verify via `npm audit signatures`.

## Install

```bash
# Types-only (zero runtime deps)
pnpm add @intentsolutions/core

# Types + Zod runtime validators
pnpm add @intentsolutions/core zod
```

## Quick import surface

```ts
// Types
import type { EvalSpec, EvalRun, GateResultV1, Uuidv7 } from '@intentsolutions/core';

// JSON Schema (draft 2020-12) — language-agnostic
import gateResultSchema from '@intentsolutions/core/schemas/v1/gate-result.schema.json' with { type: 'json' };

// Zod validators (opt-in; tree-shakable)
import { GateResultV1Schema } from '@intentsolutions/core/validators/v1/gate-result-v1';
const parsed = GateResultV1Schema.parse(payload);

// State machine helpers
import { evalRunTransitions, canTransition } from '@intentsolutions/core';
canTransition(evalRunTransitions, 'queued', 'running'); // true
```

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
| --- | --- |
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

Phase A foundation complete (2026-05-15). First public release `v0.1.0` shipped (2026-05-17) — closes epics `iec-E01` (scaffold), `iec-E02` (13 entities + gate-result/v1), `iec-E03` (JSON Schemas), `iec-E04` (Zod validators), `iec-E09` (NPM publishing). Track progress at:

- Bead workspace: `~/000-projects/.beads/` (prefix `iec-`)
- Plane sub-module: **Intent Eval Core — Kernel** in [LAB project](https://projects.intentsolutions.io)
- Master plan: `~/.claude/plans/se-the-council-bubbly-frog.md`
