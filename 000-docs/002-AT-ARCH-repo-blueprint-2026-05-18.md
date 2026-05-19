---
title: Repo Blueprint — intent-eval-core
date: 2026-05-18
authors:
  - Jeremy Longshore (Intent Solutions)
status: NORMATIVE
binding_authority: iec-E10
inherits_from:
  - intent-eval-lab/000-docs/011-AT-ARCH-ecosystem-master-blueprint.md (Blueprint A)
  - intent-eval-lab/000-docs/012-AT-ARCH-platform-runtime-blueprint.md (Blueprint B)
  - intent-eval-lab/000-docs/013-AT-SPEC-repo-blueprint-template.md (Blueprint C — this template)
related_drs:
  - intent-eval-lab/000-docs/010-AT-DECR-isedc-council-session-4-widened-scope-2026-05-13.md (DR-010)
  - intent-eval-lab/000-docs/004-AT-DECR-isedc-council-record-2026-05-10.md (DR-004)
related_glossary:
  - intent-eval-lab/000-docs/014-DR-GLOS-canonical-glossary.md
filing_standard: Document Filing Standard v4.3
---

# Repo Blueprint — `intent-eval-core`

## § 1 — Repo identity

| Field | Value |
|---|---|
| **Repo name** | `intent-eval-core` (matches `gh repo view jeremylongshore/intent-eval-core` and local working-dir name) |
| **Type** | `kernel` |
| **Owner** | `@jeremylongshore` (per `CODEOWNERS`) |
| **Maturity** | `v0.x experimental` — first public release `@intentsolutions/core@0.1.0` shipped 2026-05-17 with sigstore provenance |
| **Ecosystem role** | Canonical contracts kernel for the Intent Eval Platform — TypeScript types, JSON Schemas, Zod runtime validators, and state machines for the 13 canonical domain entities defined in Blueprint B § 2 |
| **Bead prefix** | `iec-` (per Blueprint A § 2.1 taxonomy) |
| **Plane module** | `LAB → Intent Eval Core — Kernel` (module UUID `5abf1653-c9ba-4029-8c04-76f148eb78f5`) |

### § 1.1 Dependencies (peer repos consumed)

| Peer repo | Consumed at | Pinned range | Cited blueprint path |
|---|---|---|---|
| `intent-eval-lab` | docs / spec authority | N/A — read-only spec citation | `intent-eval-lab/000-docs/011-AT-ARCH-...md` (Blueprint A), `.../012-AT-ARCH-...md` (Blueprint B), `.../014-DR-GLOS-...md` (Glossary) |
| `@intentsolutions/audit-harness` | test (dev-only) | `^0.1.0` | sibling repo `audit-harness/`; per-repo blueprint forthcoming (`iah-E01`) |
| `zod` (third-party) | runtime — validators subpath only | `^4.4.3` | npm registry (see § 4.5) |

This repo has no peer-repo dependencies at runtime — it is a leaf in the dependency graph. Consumer repos (`audit-harness`, `j-rig-skill-binary-eval`, `intent-rollout-gate`) depend on this kernel, not the reverse.

### § 1.2 Non-goals (inherited + repo-specific)

**Inherited from Blueprint A § 3** (verbatim):

- NOT a generalized autonomous agent platform
- NOT a workflow automation competitor
- NOT a distributed compute platform
- NOT a no-code builder
- NOT infinite orchestration
- NOT trying to be the union of every adjacent category
- AISE 5-domain stack is internal scope-map, NOT separate-brand surface

**Repo-specific non-goals:**

- **NOT a runtime.** This kernel ships types, schemas, validators, and state-machine transition maps. Execution of EvalRuns lives in dedicated runtime packages (forthcoming). Importing runtime concerns here triggers a Class-1 ISEDC re-convene.
- **NOT a judge.** Behavioral evaluation (LLM-judge logic, deterministic gate logic) lives in `j-rig-skill-binary-eval` and `audit-harness` respectively. The kernel defines `JudgeDecision` and `MatcherMap` shapes; it does not produce verdicts.
- **NOT a harness.** Deterministic gate logic (escape-scan, CRAP, architecture rules, hash-pinning) lives in `audit-harness`. The kernel consumes the harness as a dev-time dependency for its own quality gates; it does not produce gate logic.
- **NOT a CLI.** The kernel ships as a library — no `bin` entry, no `cli` subpath. Consumers integrate via TS imports + JSON Schema files.
- **NOT a polyglot kernel at v0.x.** v0.1 ships TS + JSON Schema only. Pydantic codegen + Python distribution are deferred to `iec-E08` (currently P2).

Scope-creep into any item above triggers ISEDC re-convene per Blueprint A § 2.3 governance routing.

---

## § 2 — Problem statement

Per Blueprint A § 1.1 mission, the Intent Eval Platform converges via a shared canonical schema — the **Evidence Bundle**. Before this repo existed, the 13 canonical domain entities (`EvalSpec`, `EvalRun`, `MatcherMap`, `EvidenceBundle`, `JudgeDecision`, `RuntimeReceipt`, `RegressionPack`, `RolloutGate`, `SkillSnapshot`, `SessionTrace`, `ToolInvocation`, `CostRecord`, `FailureTaxonomy`) had **no single source of truth**: their shapes were duplicated across `audit-harness`, `j-rig-skill-binary-eval`, and `intent-rollout-gate`, each with subtly different field names, missing fields, and incompatible validators. The lab's `gate-result/v1` v0.1.0-draft schema diverged from Blueprint B § 7.4 (the canonical normative spec). Every cross-repo integration required ad-hoc translation, and the unification thesis (DR-010 Q3 — "every validator emits Evidence Bundle") was unenforceable without a shared kernel.

This repo solves that problem by being the **single source of truth** for the 13 canonical entities and the `gate-result/v1` NORMATIVE in-toto predicate body per Blueprint B § 7.4. It ships three coordinated artifacts in one versioned package:

1. **TypeScript types** (`@intentsolutions/core`) — branded primitives + entity interfaces; zero runtime cost (pure types compile away at the TS layer).
2. **JSON Schemas** (`@intentsolutions/core/schemas/v1`) — language-agnostic wire format (draft 2020-12) so non-TS consumers (Python via Pydantic codegen in `iec-E08`, Rust, etc.) can validate against the same canonical shapes.
3. **Zod runtime validators** (`@intentsolutions/core/validators/v1/*`) — opt-in branded parsers with tree-shakable per-entity imports; consumers who need runtime validation pay only for what they import.

The boundary at which this repo hands off to peer repos: the kernel **defines** the canonical shapes. Peer repos **consume** the shapes to drive runtime behavior — `audit-harness` runs deterministic gates that emit signed `gate-result/v1` predicate bodies satisfying the kernel's schema; `j-rig-skill-binary-eval` runs behavioral evaluation that emits `JudgeDecision` rows satisfying the kernel's schema; `intent-rollout-gate` parses signed bundles and applies consumer-side policy. The kernel never imports from these peers.

---

## § 3 — Scope boundaries

### § 3.1 In scope

- TypeScript interface definitions for all 13 canonical entities per Blueprint B § 2
- The `gate-result/v1` NORMATIVE in-toto predicate body per Blueprint B § 7.4 (in-toto Statement v1 wrapping + DSSE envelope types + canonical URI constant)
- Branded primitive types (`Uuidv7`, `Sha256`, `Sha256Prefixed`, `Rfc3339`, `SemVer`, `KebabSlug`, `MicroUsd`, `StorageKey`, `OtelSpanId`, `ActorIdentity`) — both as TS brands and as Zod runtime parsers
- State-machine transition maps for the 10 entities that have lifecycles, plus the `canTransition` runtime helper
- JSON Schema definitions (draft 2020-12) at `schemas/v1/<entity>.schema.json` mirroring TS interfaces 1:1
- Zod runtime validators (`src/validators/v1/`) with discriminated unions for variant types and `superRefine` enforcement of normative conditional rules (e.g., Blueprint B § 7.4 advisory_severity if/then)
- Constants for the 5 v1 predicate URIs (`gate-result/v1`, `validation-result/v1`, `eval-verdict/v1`, `cost-attribution/v1`, `runtime-receipt/v1`) anchored at `evals.intentsolutions.io` per ISEDC CISO binding
- IS Testing SOP install (`@intentsolutions/audit-harness`, husky pre-commit, dependency-cruiser, hash-pin manifest) as the kernel's own quality-gate enforcement

### § 3.2 Out of scope (permanent, no FUTURE flag)

- **Runtime execution** — the kernel will never ship an EvalRun executor. EvalRun execution belongs in a future runtime package; importing execution code here would violate Blueprint A § 3 anti-goal "NOT a generalized autonomous agent platform."
- **LLM provider adapters** — the kernel will never invoke Anthropic, OpenAI, etc. Provider invocation lives in `j-rig` and `audit-harness`. The kernel defines `ToolInvocation` shape; it does not invoke tools.
- **Policy logic** — translating verdicts to ship/no-ship decisions lives in `@j-rig/rollout-gate` per Blueprint B § 7.6 architectural separation (predicate URI is immutable; policy evolves per-team). The kernel ships `RolloutGateDecision` enum + the gate-result/v1 schema; it never ships a policy applier.
- **DSSE signature verification logic** — cryptographic verification belongs in a sigstore client package downstream of the kernel. The kernel types the envelope; it does not verify.
- **Storage backends** — the kernel defines `StorageKey` as an opaque brand; storage adapters (S3, GCS, Rekor) live in runtime packages.

### § 3.3 Deferred (FUTURE flag required)

| Deferred item | Earliest milestone | FUTURE.md reference |
|---|---|---|
| Pydantic codegen + Python distribution | v0.3 (after Phase B kickoff) | `iec-E08` bead; will land in repo `FUTURE.md` when promoted |
| Rust crate distribution | v0.4+ (after Pydantic ships) | not yet beaded — surface via Class-2 governance when triggered |
| `assertion-class` enum for `EvalSpec.assertions` | TBD — Class-2 ISEDC pair DR required | `iec-deferral-A` bead (`bd_000-projects-gzgj`) |
| `MatcherInputPattern.structural` payload spec | TBD — engagement-defined | `iec-deferral-B` bead (`bd_000-projects-ra9a`) |
| Richer `ScoringConfig` (weights / thresholds) | TBD — ISEDC review | `iec-deferral-C` bead (`bd_000-projects-21re`) |
| `gate-result/v1.coverage` element schema lockup | v0.2 if consumer demand | `iec-deferral-D` bead (`bd_000-projects-9xyk`) |
| `ToolInvocationError.enum_class` registry | TBD — multi-tool deployment trigger | `iec-deferral-E` bead (`bd_000-projects-84li`) |
| `CompositionDag` wire-format normative spec | v0.2 if downstream forks | `iec-deferral-F` bead (`bd_000-projects-3sjx`) |
| `tenant_id` reservation (Architect W1) | TBD — ISEDC decision needed | `iec-deferral-G` bead (`bd_000-projects-k0fj`) |

### § 3.4 Anti-goals (binding-scope-control)

- **Inherited from Blueprint A § 3.1**: NOT a generalized autonomous agent platform. The kernel ships data definitions; it does not orchestrate agents.
- **Inherited from Blueprint A § 3.2**: NOT a workflow automation competitor. The kernel does not chain tools, schedule runs, or trigger downstream effects.
- **Inherited from Blueprint A § 3.4**: NOT a no-code builder. The kernel ships TS types for engineers; it does not expose a visual schema editor or non-engineer authoring surface.
- **Repo-specific — Schema duplication is forbidden.** Peer repos MUST import the canonical entity shapes from this kernel. Re-defining entity types locally in `audit-harness` / `j-rig` / `intent-rollout-gate` is the failure mode this kernel exists to prevent. The unification thesis (DR-010 Q3) is binding; locally-redefined entity types in a peer repo trigger Class-1 ISEDC re-convene.
- **Repo-specific — Runtime concerns stay out.** Any PR that adds an HTTP server, a CLI, a worker pool, a database driver, or a provider-API call MUST be rejected at review and the contributor redirected to the appropriate peer repo. This anti-goal is enforced architecturally by the `dependency-cruiser` rule `kernel-no-runtime-deps` (see § 4 and `.dependency-cruiser.cjs`).
- **Repo-specific — `labs.intentsolutions.io` is reserved-don't-touch.** Per ISEDC CISO binding (DR-004 + reaffirmed at DR-010): predicate URIs live ONLY at `evals.intentsolutions.io`. `labs.` may host blog/methodology content but never an in-toto predicate URI, OTel attribute namespace, or attestation predicate identifier. Any PR adding a predicate URI under `labs.` is rejected at review.

Scope-creep into any anti-goal above triggers ISEDC re-convene per Blueprint A § 2.3 governance routing.

---

## § 4 — Architecture

### § 4.1 Module layout

```
intent-eval-core/
├── src/
│   ├── primitives.ts                 — 10 branded primitive types (TS-only, no runtime cost)
│   ├── state-machines/types.ts       — TransitionMap<S> + canTransition helper
│   ├── entities/                     — 13 canonical entity TS interfaces + state-machine transition maps
│   ├── predicates/                   — gate-result/v1 NORMATIVE in-toto predicate body types + URI constants
│   ├── validators/v1/                — Zod runtime validators (opt-in; subpath export ./validators/v1/*)
│   │   ├── _primitives.ts            — branded Zod schemas mirroring TS brands
│   │   ├── <entity>.ts × 13          — per-entity validators
│   │   ├── gate-result-v1.ts         — predicate body validator with superRefine for if/then rule
│   │   ├── index.ts                  — barrel export (consumers SHOULD prefer per-file deep imports)
│   │   └── _generated/               — json-schema-to-zod reference output (NOT canonical, NOT exported)
│   ├── __tests__/schemas.test.ts     — ajv-based JSON Schema validation tests
│   ├── integration.test.ts           — full ERD-walk integration test
│   └── *.test.ts                     — per-module test files
├── schemas/v1/                       — JSON Schemas (draft 2020-12), the language-agnostic wire format
│   ├── _common.schema.json           — shared $defs (uuidv7, sha256, sha256Prefixed, etc.)
│   ├── <entity>.schema.json × 13     — per-entity schemas
│   ├── gate-result.schema.json       — NORMATIVE predicate body schema
│   └── index.json                    — catalog with per-schema kind/spec/uri metadata
├── tests/
│   ├── TESTING.md                    — engineer-owned policy (hash-pinned)
│   ├── RTM.md / PERSONAS.md / JOURNEYS.md — IS Testing SOP traceability artifacts
│   └── fixtures/v1/                  — golden positive + negative fixtures for ajv + Zod tests
├── test-d/                           — tsd type-test files (separate-process second-opinion)
├── 000-docs/                         — repo-local docs filed per Document Filing Standard v4.3
│   ├── 001-AA-AACR-release-v0.1.0-...md   — release AAR
│   └── 002-AT-ARCH-repo-blueprint-...md   — this file
├── .github/workflows/
│   ├── ci.yml                        — 9-step gate chain on PR + push to main
│   └── release.yml                   — tag-triggered npm publish with sigstore provenance
├── .dependency-cruiser.cjs           — 8 forbidden architecture rules (kernel-no-runtime-deps, etc.)
├── .harness-hash                     — sha256 pins for policy artifacts
├── CHANGELOG.md                      — Keep a Changelog format
├── CLAUDE.md                         — Claude-Code-specific guidance
├── AGENTS.md                         — vendor-neutral agent contract
├── README.md                         — install + import surface
├── LICENSE                           — Apache 2.0
├── package.json                      — name=@intentsolutions/core; ESM-only; Node 20+
├── tsconfig.json + tsconfig.build.json — strict TS + every additional strict flag
├── vitest.config.ts                  — 100% coverage threshold
└── eslint.config.js                  — flat config; typed lint via projectService
```

### § 4.2 Data flow

The kernel is a pure-types library with an opt-in runtime validator subpath. There is no request → response path, no daemon, no orchestration. The "flow" is the consumer's import path:

```
consumer source code
        │
        │ import type { EvalSpec, GateResultV1, Uuidv7 } from '@intentsolutions/core'
        ▼
  (types compile away — zero runtime cost)


consumer source code
        │
        │ import { GateResultV1Schema } from '@intentsolutions/core/validators/v1/gate-result-v1'
        ▼
  zod runtime parser
        │ .parse(rawPayload) — throws on invariant violation
        │ .safeParse(rawPayload) — returns { success, data | error }
        ▼
  branded, typed, normatively-valid value


consumer source code (non-TS, e.g., Python via Pydantic codegen)
        │
        │ load @intentsolutions/core/schemas/v1/gate-result.schema.json
        ▼
  any JSON Schema draft 2020-12 validator (ajv, jsonschema-py, etc.)
        │ validate(rawPayload, schema)
        ▼
  validation result
```

### § 4.3 Runtime boundaries

| Concern | Value |
|---|---|
| **Process model** | Library — runs in whatever process the consumer is in. No long-running daemon. No GitHub Action runtime in the kernel itself (the kernel is consumed BY runtime packages and Actions, not vice versa). |
| **IPC** | N/A — library import only. No inter-process communication. |
| **External services consumed** | None at runtime. The kernel does NOT invoke npm registry, GitHub, Rekor, sigstore, provider APIs, or any other external service from consumer code. (devtime: `@intentsolutions/audit-harness` runs gates against the source tree; CI runs the release workflow which calls `npm publish` — but neither is consumer-visible.) |
| **Process isolation guarantees** | Pure-types main entry has no I/O surface — cannot leak credentials, cannot read filesystem, cannot make network calls. The validators subpath has the same I/O isolation (Zod parsers are pure functions). Credential-broker boundary per Blueprint B § 4.1 is N/A: the kernel does not handle credentials. |

### § 4.4 Storage needs

**N/A — kernel defines schemas but does not persist data.** Per Blueprint C § 4.4 Author's Guide: "Kernel repos define the schemas but do not themselves persist data." Storage commitments live in the runtime/service repos that consume kernel schemas (forthcoming).

### § 4.5 External dependencies (cite by version)

| Dependency | Range | Purpose | Notes |
|---|---|---|---|
| `zod` | `^4.4.3` | Runtime validators (validators subpath only — opt-in) | Peer-dep-style: only loaded if consumer imports from `./validators/v1`. Pure-types main entry never references zod. |
| `@intentsolutions/audit-harness` | `^0.1.0` | Dev-time only — IS Testing SOP gates | NOT in published tarball. |
| `typescript` | `^5.7.2` | Dev-time only — build + typecheck | NOT in published tarball. |
| `vitest` | `^2.1.8` | Dev-time only — test runner | NOT in published tarball; produces 2 dev-only moderate vulnerabilities (vite + esbuild transitive) flagged but not in consumer surface. |
| `dependency-cruiser` | `^17.4.0` | Dev-time only — architecture rules | NOT in published tarball. |
| `ajv` + `ajv-formats` | `^8.20.0` + `^3.0.1` | Dev-time only — schema validation tests | NOT in published tarball. |
| `json-schema-to-zod` | `^2.8.1` | Dev-time only — codegen reference | NOT in published tarball. |
| `tsd` | `^0.33.0` | Dev-time only — type-test second-opinion | NOT in published tarball. |
| `husky` + `lint-staged` | `^9.1.7` + `^17.0.5` | Dev-time only — pre-commit | NOT in published tarball. |

Strict SemVer per Blueprint A § 4.2. MAJOR bumps to `zod` (the only runtime dep) require a Class-2 pair Decision Record before they land. MAJOR bumps to dev-only deps are addressed in maintenance PRs.

### § 4.6 Failure boundaries

- **Crash boundary**: Pure-types main entry cannot crash at runtime (types compile away). The validators subpath crashes only if `parse()` is called on invalid input and the consumer does not catch — by design. Use `safeParse()` for non-throwing variant. The kernel does not catch errors on the consumer's behalf.
- **Retry boundary**: N/A — pure functions; no IO; no operations to retry.
- **Isolation guarantees**: Other ecosystem components are protected from kernel failures because the kernel has no IO and no concurrency. The worst-case kernel "failure" is an invalid input rejected at `.parse()` — that error propagates synchronously to the consumer for handling.
- **Emitted FailureTaxonomy categories**: N/A — the kernel defines the `FailureTaxonomy` shape but does not emit `FailureTaxonomy` rows itself. Consumers emit rows; consumers classify against kernel-defined entries.

---

## § 5 — Canonical entities used

| Entity | Direction | Blueprint B Ref | Attributes implemented | Glossary ref |
|---|---|---|---|---|
| `EvalSpec` | **defines (source-of-truth)** | § 2.1 | TS interface + JSON Schema (draft 2020-12) + Zod validator with branded primitives; state machine `draft→published→deprecated` (reversible) | `014 § 2.1` |
| `EvalRun` | defines | § 2.2 + § 3.1 | TS interface + JSON Schema + Zod; 7-state machine with 3 terminals; `EvalRunTerminalReason` 8-element enum | `014 § 2.2` |
| `MatcherMap` | defines | § 2.3 | TS interface + JSON Schema + Zod; `MmClass` MM-1..MM-6 closed enum; discriminated `MatcherInputPattern` (regex / json-schema / structural); open-extension `MatcherExpectedBehavior` with `extension: true` marker | `014 § 2.3` |
| `EvidenceBundle` | defines | § 2.4 | TS interface + JSON Schema + Zod; 4-state machine `building→signing→signed→archived_to_rekor`; `SigningMode` + `VerificationStatus` enums | `014 § 2.4` |
| `JudgeDecision` | defines | § 2.5 | TS interface + JSON Schema + Zod; UPPERCASE `JudgeVerdict` 5-enum (deliberately distinct from lowercase `GateDecision`); `VerdictSource` 4-enum; `JudgeSeed = number\|string` | `014 § 2.5` |
| `RuntimeReceipt` | defines | § 2.6 | TS interface + JSON Schema + Zod; `ActualResourceUsage` 4-field shape (tokens_consumed, wall_clock_ms, peak_memory_mb, network_egress_bytes); single terminal state `issued` | `014 § 2.6` |
| `RegressionPack` | defines | § 2.7 | TS interface + JSON Schema + Zod; `MatcherOutcomeRow` (pass+fail required); `RegressionOutcomeSummary` as `Partial<Record<MmClass, ...>>` | `014 § 2.7` |
| `RolloutGate` | defines | § 2.8 | TS interface + JSON Schema + Zod; `RolloutGateDecision` = ship\|no_ship\|advisory\|error (deliberately distinct from `GateDecision`); `Coverage` shape imported from gate-result/v1 module | `014 § 2.8` |
| `SkillSnapshot` | defines | § 2.9 | TS interface + JSON Schema + Zod; `combined_sha` formula documented (sha256(source\|\|lock\|\|config)) with normative concatenation order | `014 § 2.9` |
| `SessionTrace` | defines | § 2.10 | TS interface + JSON Schema + Zod; open→closed state machine; 4 summary counters | `014 § 2.10` |
| `ToolInvocation` | defines | § 2.11 | TS interface + JSON Schema + Zod; `ToolInvocationError = {enum_class, message}`; HARD credential-leak rule documented as runtime concern | `014 § 2.11` |
| `CostRecord` | defines | § 2.12 | TS interface + JSON Schema + Zod; `CostAttributionClass` closed 7-element enum; both FKs nullable for system rollups; `MicroUsd` brand | `014 § 2.12` |
| `FailureTaxonomy` | defines | § 2.13 | TS interface + JSON Schema + Zod; `MmClassId` template-literal type (broader than `MmClass`); proposed→canonical→deprecated forward-only state machine | `014 § 2.13` |

**Direction note**: This kernel is the **source-of-truth** for all 13 canonical entities. It does not consume entities from any peer repo — peer repos consume from here. The "defines" direction is unique to this kernel in the ecosystem.

**Predicate URIs**: gate-result/v1 (NORMATIVE per Blueprint B § 7.4) is the only fully spec-bound predicate body at v1. Four sibling URIs are exposed as string constants (`PREDICATE_URIS.VALIDATION_RESULT_V1`, `EVAL_VERDICT_V1`, `COST_ATTRIBUTION_V1`, `RUNTIME_RECEIPT_V1`) — their body normative specs are forward-deferred per DR-010 Q3 conditional approval; bodies will land in future kernel minor versions when each predicate's SPEC.md normative section is merged on `intent-eval-lab` main.

**Entities NOT touched by this repo**: None. The kernel defines all 13.

---

## § 6 — Interfaces

### § 6.1 CLI

**N/A — this is a library, not a CLI tool.** Consumers import; there is no `bin` entry in `package.json`. Dev-time scripts (`pnpm run build`, `pnpm run check`, etc.) exist but are not part of the public consumer surface.

### § 6.2 HTTP / gRPC APIs

**N/A — library only, no network surface.**

### § 6.3 Config files

The kernel ships no consumer-facing config files. Internal dev configs (`tsconfig.json`, `vitest.config.ts`, `eslint.config.js`, `.dependency-cruiser.cjs`, `.harness-hash`, `tests/TESTING.md`) are repo-internal and not part of the public surface.

### § 6.4 Output formats

| Output | Shape | Reference |
|---|---|---|
| Evidence Bundle row (when emitted by a kernel consumer) | in-toto Statement v1 over DSSE with `predicateType = https://evals.intentsolutions.io/gate-result/v1`; predicate body per Blueprint B § 7.4 | Blueprint B § 7; kernel ships `GateResultV1Statement` + `DsseEnvelope` interfaces and `GateResultV1Schema` Zod parser |

**Note**: The kernel itself emits no rows. It defines the shape and exports the type + schema + validator. Consumer repos (`audit-harness`, `j-rig`, `intent-rollout-gate`) emit signed rows that satisfy the kernel's schema. Do NOT redefine the predicate body locally per Blueprint C § 6.4 guidance.

### § 6.5 Event schemas

The kernel does not emit OTel events itself (no runtime). It defines the `SessionTrace` and `ToolInvocation` shapes that consumer runtimes use to anchor their OTel traces. **Forward-reference `iel-E12`** (OTel RFC) — the `agent.rollout.gate.*` and `agent.evidence_bundle.*` taxonomies will be locked in that RFC; events emitted by consumer runtimes BEFORE the RFC ratifies carry a `taxonomy_status: draft` attribute per Blueprint C § 9.1 guidance.

### § 6.6 Public-API stability promise

The following surface elements are stable within minor versions (0.X.* → 0.X+1.* additive only; 0.X+1.0 may NOT break consumers of 0.X.*):

- **Entity TypeScript interface field names + types** for all 13 entities at the canonical module entry (`@intentsolutions/core`).
- **`gate-result/v1` predicate body required + optional field names + types + enums** — this is the most version-sensitive surface in the kernel; the URI `https://evals.intentsolutions.io/gate-result/v1` is **immutable** per Blueprint B § 7.2 backward-compat policy.
- **State-machine state literal unions** (`EvalSpecState`, `EvalRunState`, etc.) — adding states without breaking existing transitions is MINOR; removing/renaming is MAJOR.
- **Branded primitive type identities** (`Uuidv7`, `Sha256`, etc.) — the brand identifier strings are stable; changing one breaks every consumer that branded a value.
- **JSON Schema `$id` URLs** for all 13 entities + the predicate body — `$id` is the durable identifier; never repath an existing schema.
- **Subpath exports** (`./schemas/v1/*.json`, `./validators/v1/*`) — adding new subpaths is MINOR; removing is MAJOR.
- **Zod schema names** (`EvalSpecSchema`, `GateResultV1Schema`, etc.) — renaming is MAJOR.

Breaking changes to anything above require MAJOR bump (Blueprint A § 4.2 versioning standard) AND a Class-2 pair Decision Record (Blueprint A § 2.3) before merge.

**Not promised as stable**: any path under `_generated/`, any internal helper module not re-exported from the canonical entry, any field name in `ScoringConfig.extensions` or `MatcherMap.expected_behavior.payload` (these are explicitly unbounded extension slots per Blueprint B § 2.1 / § 2.3 STOP directives).

---

## § 7 — Testing strategy

**Layer applicability**: This is a `library` (per Blueprint C § 1 Type enum) — pure-type kernel. L1+L2+L3 apply fully; L4 applies to architecture-rule integration only; L5/L6/L7 are WAIVED per the library applicability matrix at `~/.claude/skills/audit-tests/references/layer-applicability.md`. Declared per-repo waivers in `tests/TESTING.md § Waived gates`.

### § 7.1 L0 — git hooks (pre-commit)

In-scope checks (via `.husky/pre-commit`):

- `pnpm exec audit-harness escape-scan --staged` — refuses coverage/threshold/architecture lowering, hash-pin tampering, .feature file mutation, MUST→weaker RTM drift, mass test deletion
- `lint-staged` — runs ESLint --fix + Prettier --write on staged files

Enforcement command: `pnpm exec audit-harness escape-scan --staged` (NEVER `~/.claude/` paths — enforcement travels with the code per Blueprint A § 4.2).

### § 7.2 L1–L2 — static analysis

| Tool | Command | Notes |
|---|---|---|
| ESLint 9 flat config | `pnpm run lint` | typed lint via `projectService`; type-imports enforced; `no-explicit-any: error` |
| Prettier 3 | `pnpm run format:check` | 100col, single quote, trailing commas |
| TypeScript 5 strict | `pnpm run typecheck` | strict + every additional strict flag (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`) |
| Escape-scan | `pnpm exec audit-harness escape-scan --staged` | run at pre-commit + in CI on PR + push |

### § 7.3 L3 — unit tests

| Framework | Coverage floor | Mutation kill rate | CI gate |
|---|---|---|---|
| `vitest@2` (in-process + `expectTypeOf` type-level) | **100%** lines / branches / functions / statements (enforced in `vitest.config.ts`) | N/A — WAIVED for pure-type library; see § 7.7 | `pnpm run test` + `pnpm run test:coverage` |
| `tsd@0.33` (second-opinion separate-process type-test) | ~80 negative assertions against published `dist/` | N/A | `pnpm run test:types` (runs in CI after `pnpm run build`) |

### § 7.4 L4 — integration tests

- `src/integration.test.ts` — ERD-walk: constructs all 13 entities + gate-result/v1 + in-toto Statement v1 end-to-end; locks every Blueprint B § 6.2 cross-entity invariant (content_hash freeze, SkillSnapshot anchoring via combined_sha, 1:1 cardinalities, FK fan-out, predicate body ↔ RolloutGate mapping, subject_name regex)
- `src/__tests__/schemas.test.ts` — ajv-based JSON Schema validation against golden fixtures (16 positive + 4 negative + 7 cross-cutting invariants + 4 structural)
- `src/validators/v1/validators.test.ts` — Zod validator parity with ajv: same fixtures, both validators agree
- `pnpm exec audit-harness arch` — dependency-cruiser architecture check (8 forbidden rules, 0 violations)

### § 7.5 L5 — system tests

**WAIVED.** This is a pure-type library — no external services, no IO surface, no provider invocations.

**Provider PASS/FAIL gates**: see § 8.3 — **N/A** because the kernel has no LLM provider surface. The kernel defines `ToolInvocation`/`CostRecord` shapes for consumer runtimes; consumer runtimes own provider-gate testing.

### § 7.6 L6 — acceptance tests

**WAIVED.** Library, not service — no user journeys to acceptance-test. Consumers own their own Gherkin scenarios; the kernel's traceability artifacts (`tests/RTM.md`, `tests/PERSONAS.md`, `tests/JOURNEYS.md`) document the kernel's contracts but are not Gherkin features.

| Gherkin scope | Lint | RTM path | Personas path | Journeys path |
|---|---|---|---|---|
| N/A — no .feature files | N/A | `tests/RTM.md` (24 REQs) | `tests/PERSONAS.md` (4 downstream-consumer personas) | `tests/JOURNEYS.md` (3 type-level journeys) |

### § 7.7 L7 — chaos / property / fuzz

**N/A** — pure-type library. Applicability: low. Mutation testing on `as const` arrays and TS type definitions doesn't add signal. Property-based testing on `parse()` of well-formed fixtures would be exhaustive but the discriminating-question is whether the validator catches malformed inputs (covered by the 4 negative fixtures + ~80 tsd `expectError` assertions). If a runtime-effective property-based opportunity emerges (e.g., once Pydantic codegen lands and we want cross-language fuzz), file a bead in the `iec-` prefix.

### § 7.8 CI gates

```yaml
# .github/workflows/ci.yml — exact pnpm chain run on PR + push to main:
- run: pnpm install --frozen-lockfile
- run: pnpm run harness:verify         # hash-pinned policy verification
- run: pnpm run lint                   # ESLint flat config
- run: pnpm run typecheck              # tsc --noEmit
- run: pnpm run arch                   # dependency-cruiser via audit-harness (8 forbidden rules)
- run: pnpm run test                   # vitest run
- run: pnpm run test:coverage          # 100% floor enforced in vitest.config.ts
- run: pnpm run build                  # tsc -p tsconfig.build.json
- run: pnpm run test:types             # tsd against published dist/
- run: # verify dist artifacts present (index.js + index.d.ts + validators + schemas)
```

**Hash-pin discipline**: after any policy edit in `tests/TESTING.md` or `.dependency-cruiser.cjs`, re-run `pnpm exec audit-harness init` and commit the updated `.harness-hash` in the same commit. Pre-commit refuses unsigned policy edits by design.

### § 7.9 Fixtures

| Location | Naming convention | Vendor-generic discipline |
|---|---|---|
| `tests/fixtures/v1/` | `<entity>.valid.json` (positive) / `<entity>.invalid-<reason>.json` (negative) | All fixtures vendor-generic. Identifiers use placeholder UUIDv7s, slug names, and example emails (`jeremy@intentsolutions.io` is the only real identifier in fixtures, used per-DCO). Partner-name grep guard runs on `tests/fixtures/**` in CI per the umbrella `.github/workflows/partner-name-guard.yml` pattern. |

### § 7.10 Golden files

**N/A** — no snapshot testing at v0.1. If JSON Schema generation against generated `_generated/` Zod files becomes a thing in a future minor release (the inverse direction: schema → zod codegen → JSON snapshot), add snapshot discipline + a mass-regenerate CI refusal at that point.

---

## § 8 — Security / isolation

### § 8.1 Secrets management

The kernel does not handle secrets. The broker pattern per Blueprint B § 4.1 does NOT apply because there are no credentials in the kernel's surface area.

| Secret class | Storage | Broker | Repo-specific |
|---|---|---|---|
| `NPM_TOKEN` (release-only) | GitHub Actions secret on `jeremylongshore/intent-eval-core` | N/A — used directly by `pnpm publish --provenance` step in release workflow | Sourced from `~/.npmrc` per local-engineer tooling; uploaded to GH secrets via `gh secret set NPM_TOKEN` |

SOPS+age standard does NOT apply: no `.env.sops` exists in this repo because no consumer-runtime secrets exist. (The repo's CI uses standard GitHub Actions secret injection for `NPM_TOKEN` — that's a CI infrastructure concern, not a consumer-runtime credential surface.)

### § 8.2 Sandbox model

**N/A — no user-code execution path.** The kernel does not execute user-supplied artifacts (skills, prompts, MCP servers, evaluation targets). It ships type definitions, schemas, and validator functions; the validators are pure functions over data structures and cannot escape their inputs.

| Concern | Default | Repo override |
|---|---|---|
| Filesystem | N/A — no FS access at runtime | N/A |
| Network egress | N/A — no network access at runtime | N/A |
| Wall-clock ceiling | N/A — synchronous pure functions, no long-running operations | N/A |
| Memory ceiling | N/A — bounded by input size | N/A |
| Credential boundary | N/A — no credentials in kernel surface | N/A |

### § 8.3 Provider PASS/FAIL gates

**N/A — this repo does not touch LLM providers.** Section present per Class-1 ISEDC requirement that the gate-restatement be visible even when not exercised (per Blueprint C § 8.3 author guidance and DR-010 § 10 reaffirmation of DR-004 S1Q5).

If a future kernel surface ever invokes an LLM provider (e.g., a contracts-validation LLM-judge — unlikely, would require Class-1 ISEDC), the following gates become NON-NEGOTIABLE and must be restated verbatim:

1. **Credential-redaction test** — every code path that surfaces an error, log entry, or metric containing a provider response MUST redact the credential. Test asserts the literal credential string is absent from every observable surface.
2. **Env-var spillover test** — provider credentials set in this repo's process environment MUST NOT spill into any spawned subprocess. Test spawns a subprocess and asserts the provider env vars are absent from its environment.

Removing or weakening this section is itself a Class-1 ISEDC trigger per DR-010 § 10.

### § 8.4 Audit logging

| What is logged | Append-only | Signing | Retention |
|---|---|---|---|
| `pnpm publish` release events | yes — npm registry append-only history | sigstore provenance attached to published tarball (verifiable via `npm audit signatures @intentsolutions/core`) | Indefinite per npm registry retention policy |
| GitHub Actions CI run logs | yes — GitHub-managed | N/A (CI logs not signed) | 90 days per GitHub default |
| Git commit history on `main` | yes — git-managed | DCO sign-off footer per global CLAUDE.md attribution policy | Indefinite |

The kernel itself emits no audit log records at runtime (pure types + pure functions).

### § 8.5 Threat model

An adversary with write access to the npm registry under the `@intentsolutions/*` scope can publish a poisoned version of `@intentsolutions/core`. The defenses:

- **Sigstore provenance** attached to every published tarball — consumers can verify with `npm audit signatures @intentsolutions/core`; mismatched signature flags supply-chain tampering
- **Tag-vs-package version drift guard** in the release workflow rejects publishes where the git tag doesn't match `package.json#version`
- **Branch protection on `main`** with `enforce_admins=true`, required CI status check, no force push, no deletions — even the maintainer can't bypass quality gates
- **License audit** (transitively) — strict-SemVer pins on all dev deps; runtime dep limited to `zod` (one package, MIT-licensed, well-vetted)

An adversary with write access to `jeremylongshore/intent-eval-core` repo can publish locally without going through CI by running `npm publish` directly with credentials from `~/.npmrc`. The defenses:

- **`NPM_TOKEN` is repo-secret-scoped** in CI (publish via CI ≠ publish from a maintainer laptop)
- **`.npmrc` lives outside the repo** (`~/.npmrc` is per-user, never committed)
- **First-publish discipline**: maintainer's local `npm publish` is documented as the rollback path only — primary publish path is tag-triggered CI per the release workflow

An adversary who compromises the maintainer's GitHub account can do anything — that's outside this threat model. Mitigation is account-level (2FA, hardware key, etc.) and not addressed here.

---

## § 9 — Observability

### § 9.1 OpenTelemetry events

The kernel emits no OTel events itself (no runtime). It defines the `SessionTrace` and `ToolInvocation` shapes that consumer runtimes use; consumer-emitted events forward-reference `iel-E12` (OTel RFC) and carry a `taxonomy_status: draft` attribute until the RFC ratifies.

| Event | Trigger | Attributes |
|---|---|---|
| N/A — kernel emits no events | — | — |

### § 9.2 Trace propagation

**N/A** — library only. Consumers that build tracing on top of kernel types own their own trace propagation.

### § 9.3 Lineage capture

The kernel defines lineage shapes; consumers populate them. Per Blueprint B § 2:

- `SessionTrace.root_span_id`, `total_spans`, `max_loop_depth`, `total_tool_invocations`, `total_judge_decisions` — defined here; populated by runtime consumers
- `RuntimeReceipt.provider_adapter_versions`, `tool_versions`, `actual_resource_usage`, `worker_identity`, `worker_host_fingerprint` — defined here; populated by runtime consumers
- `ToolInvocation` rows — defined here; emitted by runtime consumers

### § 9.4 Log levels

**N/A** — library has no logger. Consumers attach their own logger if they wrap kernel calls.

### § 9.5 Failure taxonomy

**N/A — kernel does not emit `FailureTaxonomy` rows.** Defines the entry shape; consumer runtimes emit rows. The kernel's own quality gates (CI failures, test failures, lint failures) are GitHub Actions / vitest reports — not Blueprint B § 2.13 categories.

---

## § 10 — Cost governance

**N/A — pure-spec/pure-library repo, no paid surface touched.** The kernel makes zero paid API calls, allocates no paid storage, and does not invoke paid signing (sigstore is free; npm registry is free for public packages).

All five sub-sections (§ 10.1 Token ceilings, § 10.2 Cost attribution, § 10.3 Retention lifecycle, § 10.4 Cache strategy, § 10.5 Budget ceilings) are N/A for the same reason. The kernel **defines** `CostRecord` shape (Blueprint B § 2.12) for consumer runtimes; consumer runtimes own per-call cost accounting against that shape.

---

## § 11 — Release strategy

### § 11.1 Versioning

Strict SemVer per Blueprint A § 4.2. **The kernel is the most version-sensitive surface in the ecosystem** because every consumer repo depends on its canonical entity shapes — a breaking change ripples through `audit-harness`, `j-rig`, `intent-rollout-gate`, and any future Pydantic / Rust consumers.

| Bump | Trigger | Example |
|---|---|---|
| **MAJOR** | Breaking change to any element of the § 6.6 stability promise | Rename a field on `EvalSpec`; remove a state from `EvalRunState`; change `Uuidv7` brand identifier; remove a subpath export |
| **MAJOR** | Canonical-contract change | Replace `JudgeVerdict.PASS` literal with `'pass'` (case change); rename `gate-result/v1` to `gate-result/v2` (URI bump per Blueprint B § 7.2 backward-compat policy) |
| **MAJOR** | Predicate URI grammar change | Change `SUBJECT_NAME_REGEX`; add a 4th edge kind to `CompositionEdgeKind` |
| **MINOR** | Additive feature; new optional field; new event emission; deprecation notice (without removal) | Add MM-7 to `MmClass` enum after `FailureTaxonomy` ratifies the new class; add `replay_fidelity_level` as optional to a new predicate body |
| **MINOR** | New subpath export | Ship `./validators/v2` alongside `./validators/v1` |
| **PATCH** | Bug fix; documentation polish; internal refactor with no public-API change | Fix a typo in a JSDoc; tighten a regex without changing accepted inputs; reorder internal imports |

No "convenience minor" for things that look like additions but break consumers. If in doubt: bump MAJOR and document the migration.

### § 11.2 Changelog

Keep a Changelog format. Sections: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`. Every PR that merges to `main` updates `CHANGELOG.md` under `## [Unreleased]`; the release commit promotes `[Unreleased]` to the new version + date.

### § 11.3 Migration notes

| Field | Value |
|---|---|
| Migration guide location | `CHANGELOG.md` § Adoption notes (per-version, hand-authored) |
| Migration generator | Hand-authored at v0.x (codegen explicitly deferred per `iec-E09` acceptance criteria — "sub-children E09b/c/d demoted to P2; hand-migration acceptable"). Automated codemod tool MAY ship at v1.0 if consumer adoption proves manual migration painful. |
| Required for | Every MAJOR bump. For MINOR bumps that deprecate a feature, the deprecation note in CHANGELOG suffices. |

### § 11.4 Compatibility guarantees

Across **minor bumps**:
- Every existing TS interface field name + type is preserved
- Every existing JSON Schema `$id` is preserved
- Every existing Zod schema name + parse-shape is preserved
- Every existing subpath export resolves to the same module
- State machine state literals are append-only (new states permitted; existing states never renamed or removed)
- Enum literals are append-only (new enum values permitted; existing values never renamed or removed)

Across **MAJOR bumps**: only items explicitly preserved in the MAJOR release notes. Consumers MUST read the migration guide and update.

### § 11.5 Evidence retention discipline

| Predicate URI | Status | SPEC.md ref | Signing mode |
|---|---|---|---|
| `evals.intentsolutions.io/gate-result/v1` | approved (NORMATIVE in Blueprint B § 7.4) | `intent-eval-lab/specs/evidence-bundle/v0.1.0-draft/SPEC.md` (will be promoted to v0.1.0 normative when filed) | At v0.1: kernel ships the schema + URI constant; first **production-Rekor** signed emission belongs to consumer runtimes once the SPEC.md normative section is merged on `intent-eval-lab` main. Until then: `sigstore_staging` per DR-010 Q3 conditional approval. |
| `evals.intentsolutions.io/validation-result/v1` | deferred (body not yet spec'd) | (forthcoming) | `sigstore_staging` |
| `evals.intentsolutions.io/eval-verdict/v1` | deferred | (forthcoming) | `sigstore_staging` |
| `evals.intentsolutions.io/cost-attribution/v1` | deferred | (forthcoming) | `sigstore_staging` |
| `evals.intentsolutions.io/runtime-receipt/v1` | deferred | (forthcoming) | `sigstore_staging` |

Per Blueprint A § 4.2 + DR-010 § 7 Q5 CISO non-negotiable: production-Rekor signing for any predicate URI is gated on that predicate's SPEC.md normative section landing. The kernel ships **only the schema and the URI constant** — it does not emit signed rows itself; consumer runtimes emit rows once their SPEC.md gates pass.

### § 11.6 License audit

Every release runs `pnpm licenses list --prod --json` on the resolved dependency tree per DR-010 § 7 Q2 GC non-negotiable. GPL / AGPL dependencies are blocked at CI absent explicit GC waiver.

At v0.1.0: the entire production dependency tree is one package (`zod`, MIT-licensed). License audit is trivial. A `LICENSES.md` file at repo root will be added in v0.2 if the production dep tree grows beyond 5 packages; until then, `package.json#dependencies` is the source of truth (1 entry).

---

## § 12 — Beads / work breakdown

| Field | Value |
|---|---|
| **Bead prefix** | `iec-` per Blueprint A § 2.1 taxonomy |
| **bd workspace** | `~/000-projects/.beads/` (umbrella default per umbrella CLAUDE.md) |
| **Epic naming** | `iec-E<NN>` (e.g., `iec-E01`, `iec-E09`, `iec-E10`) |
| **Plane project** | `LAB` (Intent Eval Lab — shared across the four convergence repos at the platform layer) |
| **Plane module** | `Intent Eval Core — Kernel` (module UUID `5abf1653-c9ba-4029-8c04-76f148eb78f5`) |
| **GH ↔ Plane mirror** | `bd-sync` per global CLAUDE.md three-layer discipline. Every bead carries `GitHub:` and `Plane:` lines in notes; every state-changing op uses `bd-sync` to mirror. |

### § 12.1 Cross-repo bead dependencies

- `iec-E10` (this blueprint) depends on `iec-E01` (scaffold ✓ closed) and `iel-E04` (Blueprint C template — landed on `intent-eval-lab` main, this blueprint inherits)
- `iah-E02` (audit-harness imports kernel types) depends on `iec-E09` (NPM publish ✓ closed)
- `iaj-E02` (j-rig migrates @j-rig/core schemas) depends on `iec-E09` ✓
- `iar-consumer-migration` (intent-rollout-gate consumes kernel) depends on `iec-E09` ✓
- `iel-link-schemas-to-kernel` (lab schema symlinks to kernel) depends on `iec-E03` ✓

### § 12.2 In-repo epic inventory

| Epic | Status | Purpose |
|---|---|---|
| `iec-E01` — Repo scaffold | ✓ closed | Initial repo + LICENSE + README + Apache 2.0 + first commit |
| `iec-E02` — 13 TS entities + gate-result/v1 + IS Testing SOP | ✓ closed | All 13 canonical entity TS interfaces + NORMATIVE predicate body + branded primitives + state machines + IS Testing SOP install + dual type-test discipline |
| `iec-E03` — JSON Schemas | ✓ closed | 13 entity schemas + gate-result/v1 + shared _common.schema.json $defs + 31 ajv validation tests |
| `iec-E04` — Zod runtime validators | ✓ closed | 15 Zod validators with branded primitives + tree-shakable subpath exports + 31 validator tests |
| `iec-E07` — SemVer regression test suite | open (P2) | Automated regression test that catches MAJOR-bump-worthy changes before they merge |
| `iec-E08` — Pydantic codegen + Python distribution | open (P2) | Generate Python entity models from JSON Schemas; publish to PyPI |
| `iec-E09` — NPM publishing v0.1.0 | ✓ closed | First public release with sigstore provenance |
| `iec-E10` — Per-repo blueprint (this doc) | in-progress | Author this blueprint applying Blueprint C |
| `iec-E11` — Boundary enforcement (FORBIDDEN/ALLOWLIST/CODEOWNERS) | open (P0) | Extend dep-cruiser rules + add CODEOWNERS + pre-commit gates for boundary discipline |
| `iec-E12` — Testing SOP + CI/CD + multi-target release pipeline | open (P1) | Multi-target = post-v1 (Python wheel + Rust crate concurrent publishing) |

**Deferral beads (filed during the v0.1.0 sprint, P1/P2):** `iec-deferral-A` through `iec-deferral-G` covering AssertionExpression class enum, MatcherInputPattern.structural payload, ScoringConfig fields, gate-result coverage element shape, ToolInvocationError enum_class registry, CompositionDag wire format, tenant_id reservation. Each carries explicit ISEDC trigger criteria and acceptance criteria in its bead description.

---

## § 13 — Definition of Done

This per-repo blueprint is **Done** when all of the following pass:

- [ ] All tests pass at the L0–L7 policy floors declared in § 7 (100% coverage, 0 architecture violations, 154+80+31+31 tests all green, tsd negative assertions all pass, ajv-Zod parity all green).
- [ ] Provider PASS/FAIL gates (§ 8.3) — N/A for this kernel (no provider surface); section present per Class-1 ISEDC requirement.
- [ ] All canonical entities defined (§ 5) have their schema versions pinned to a known-good range — at v0.1: trivially true (kernel IS the source of truth).
- [ ] License audit clean per § 11.6 — at v0.1: trivially true (one runtime dep, MIT).
- [ ] Partner-name vendor-generic grep returns 0 against all public-facing directories (src/, schemas/, tests/, 000-docs/, README.md, CHANGELOG.md, AGENTS.md, CLAUDE.md). Pattern maintained in ecosystem CLAUDE.md.
- [ ] Evidence Bundle round-trip verified when applicable — N/A for kernel (does not emit rows); consumer runtimes verify when they emit.
- [ ] `CHANGELOG.md` entry written for the next release under `## [Unreleased]` (the in-progress section between releases).
- [ ] This per-repo blueprint matches reality — `/validate-consistency` clean against this repo's `000-docs/`, `README.md`, `CHANGELOG.md`, and `package.json`.
- [ ] Acting head of board sign-off (Jeremy Longshore per `CODEOWNERS`) — captured at PR merge time.

---

## References

- **Blueprint A** — `intent-eval-lab/000-docs/011-AT-ARCH-ecosystem-master-blueprint.md` (ecosystem constitution; 12 binding principles; anti-goals)
- **Blueprint B** — `intent-eval-lab/000-docs/012-AT-ARCH-platform-runtime-blueprint.md` (13-entity canonical domain model; § 7.4 NORMATIVE `gate-result/v1` predicate body)
- **Blueprint C** — `intent-eval-lab/000-docs/013-AT-SPEC-repo-blueprint-template.md` (this template)
- **Canonical Glossary** — `intent-eval-lab/000-docs/014-DR-GLOS-canonical-glossary.md`
- **DR-010** — `intent-eval-lab/000-docs/010-AT-DECR-isedc-council-session-4-widened-scope-2026-05-13.md` (governance lock)
- **DR-004** — `intent-eval-lab/000-docs/004-AT-DECR-isedc-council-record-2026-05-10.md` (Session 1 5-binding constraints)
- **Release AAR** — `intent-eval-core/000-docs/001-AA-AACR-release-v0.1.0-2026-05-17.md`
- **Filing Standard** — `~/000-projects/002-command-bible/DOCUMENT-FILING-STANDARD-v3.0.md` (Document Filing Standard v4.3 referenced in frontmatter)
- **IS Testing SOP** — `~/000-projects/CLAUDE.md § Intent Solutions Testing SOP`
- **bd workspace + JSONL workaround** — `~/000-projects/intent-eval-platform/CLAUDE.md § bd workspace + JSONL workaround`

— Jeremy Longshore
intentsolutions.io
