# Greptile reviewer orientation — `@intentsolutions/core`

> This file is repo context handed to the AI reviewer. It briefs a principal reviewer
> who has never seen this platform. Read it before reviewing any PR here. The
> deterministic scoped rules live in `.greptile/config.json`; the grounding-doc map
> lives in `.greptile/files.json`. This file is the prose that makes both make sense.

---

## 1. Platform context — what this repo IS

The **Intent Eval Platform** is an agent-native evaluation platform built as a set of
independent OSS repos that converge on one shared **Evidence Bundle** schema. The
six repos in scope:

| Repo | Role |
| --- | --- |
| **`intent-eval-core` (THIS repo, `@intentsolutions/core`)** | The canonical **contracts kernel** — the single source of truth for the platform's shared shapes. |
| `intent-eval-lab` | Methodology, specs, the Blueprints (A/B/C), the glossary, and the binding Decision Records. The kernel is *downstream* of the lab. |
| `audit-harness` (`@intentsolutions/audit-harness`) | Deterministic gates (escape-scan, crap-score, arch-check, gherkin-lint, …) that **emit** Evidence Bundles. |
| `j-rig` (`j-rig-skill-binary-eval`) | Behavioral / LLM-judge evaluation + rollout-gate decision logic + provider adapters. |
| `intent-rollout-gate` | A thin GitHub Action that consumes an Evidence Bundle + policy and renders a ship/no-ship decision. |
| `intent-eval-dashboard` / reports-hub | Ingests signed evidence and renders it (verify-before-render). |

**This repo is the kernel.** It defines — in three coordinated, lockstep forms — every
shared shape that flows between those repos:

1. **TypeScript interfaces** (`src/entities/`, `src/predicates/`, `src/primitives.ts`)
2. **JSON Schemas**, draft 2020-12 (`schemas/v1/`, `schemas/authoring/v1/`, `schemas/authoring/v2/`)
3. **Zod validators** (`src/validators/v1/`) — an opt-in subpath so types-only consumers pay zero zod cost

It defines the **14 canonical entities** (Blueprint B § 2's 13 + `SkillVersion`, the 14th
per DR-028 T1): EvalSpec, EvalRun, EvidenceBundle, JudgeDecision, RuntimeReceipt,
SessionTrace, ToolInvocation, CostRecord, FailureTaxonomy, MatcherMap, RegressionPack,
RolloutGate, SkillSnapshot, SkillVersion. It defines the fully-NORMATIVE
`gate-result/v1` in-toto predicate body (Blueprint B § 7.4) and the additional predicate
bodies (retraction/v1, dashboard-render/v1, skill-refiner-pass/v1). And it defines the
state machines that govern entity transitions.

Every other repo **imports** these contracts. None of them redefines them. The kernel's
entire reason to exist is that, before it, the same entities were redefined locally in
three sibling repos — with divergent field names, missing fields, and mutually
incompatible validators — and the lab's `gate-result/v1` had drifted from Blueprint B.
This package replaced that drift with one source of truth. A review that lets drift back
in defeats the whole point of the repo.

---

## 2. The source-of-truth hierarchy

When sources disagree, the **higher tier wins**. A change here that would require a change
in a higher tier must stop and coordinate upstream (in `intent-eval-lab`) first — or open
an ADR in `000-docs/` that cites the binding doc explicitly.

| Tier | Source | Authority |
| --- | --- | --- |
| **1** | bd workspace (`~/000-projects/.beads/`, prefix `iec-`) | Task state, dependencies, sub-bead clusters |
| **2** | **DR-010** (ISEDC Session 4 widened-scope lock) | Governance bindings; TS-primary signing surfaces; the **unification thesis** (every validator emits an Evidence Bundle) |
| **3** | **Blueprint A** (ecosystem master blueprint) | 12 binding principles, 5-repo taxonomy, anti-goals |
| **4** | **Blueprint B** (platform runtime blueprint) | The 13-entity canonical domain model + the NORMATIVE `gate-result/v1` predicate spec (§ 7) |
| **5** | Canonical glossary | Platform terminology — every other doc cites it |
| **6** | This repo's per-repo blueprint (`000-docs/002-AT-ARCH-...`) | This repo's specific architecture choices |
| **7** | This repo's `CLAUDE.md` | Operational rules for working in this directory |

Practical consequence for review: if a PR's justification is "the glossary / a Blueprint
says X", that *outranks* a local convenience argument. If a PR changes a contract in a way
that contradicts Blueprint B, that is a **constitutional** drift, not a style nit — flag it
as blocking and ask for the upstream coordination (lab PR or ADR) before merge.

---

## 3. The kernel's role and boundaries (the part most likely to be violated)

The kernel's role is **types, schemas, validators, state machines — and nothing else.**
The boundaries below are NORMATIVE (Blueprint A anti-goals) and enforced architecturally
by `scripts/check-boundaries.ts` (`pnpm run boundaries`) reading `FORBIDDEN.md` +
`ALLOWLIST.md`. A review here is a second line of defense behind that checker — catch the
intent of a violation even when it is shaped to slip past the regex.

**Kernel-only — these do NOT belong here (they live in sibling repos):**

- **NOT a runtime.** No orchestration, agents, job queues, schedulers, execution loops.
  The kernel defines the *shapes* of runtime events (e.g. OTel attribute-name constants in
  `src/otel/v1/`); it never *runs* them. Forbidden src/ paths: `src/runtime/`,
  `src/orchestrator/`, `src/scheduler/`, `src/queues/`, `src/worker(s)/`, `src/cli/`,
  `src/bin/`, `src/commands/`. Forbidden top-level dirs: `services/`, `runtime/`,
  `workers/`, `orchestrator/`. If a change feels like a runtime, it belongs in
  `audit-harness`, `j-rig`, or `intent-rollout-gate`.
- **NOT a judge.** No LLM-judge logic, no behavioral-eval primitives, no provider adapters.
  Forbidden: `src/judges/`, `src/agents/`, `src/adapters/`, `src/providers/`, `src/llm/`,
  and any LLM provider SDK (`openai`, `@anthropic-ai/*`, `cohere-ai`, `groq-sdk`, …).
- **NOT a harness.** Deterministic gate logic belongs in `audit-harness`. Forbidden:
  `src/optimization/`, `src/optimizer/`.
- **NOT a service.** No HTTP/gRPC/REST/websocket servers. Forbidden: `src/server/`,
  `src/api/`, `src/http/`, `src/grpc/`, and any web framework (`express`, `fastify`,
  `hono`, `next`, …) or HTTP client (`axios`, `got`, `undici`, `node-fetch`).
- **NOT a database.** No DB drivers/ORMs/storage SDKs. Forbidden: `src/db/`,
  `src/persistence/`, `src/cache/`, and packages like `pg`, `prisma`, `drizzle-orm`,
  `@aws-sdk/*`, `@google-cloud/storage`.

**Dependency discipline.** Runtime deps are hard-capped at **8** and must be listed in
`ALLOWLIST.md` with a Blueprint-tied rationale. Currently there is exactly **1** (`zod`),
and it is loaded only from the `validators/v1` subpath so the main types entry stays
zero-dependency. A 9th runtime dep requires a Class-2 ISEDC pair Decision Record. DevDeps
don't count against the cap but are still subject to the forbidden-pattern axes and need a
waiver row in `ALLOWLIST.md` if they match a forbidden pattern.

**The bicameral kernel — two tiers, kept apart.** The kernel has two chambers:

- the **runtime tier** — `schemas/v1/` + `src/entities/` + `src/validators/v1/` (the eval
  runtime's 14 entities + predicate bodies), and
- the **authoring tier / Spec Authority Kernel (SAK)** — `schemas/authoring/v1/` +
  `schemas/authoring/v2/` + `src/validators/v1/authoring/` (the contracts that define what a
  valid *authoring* artifact is: skill-frontmatter, plugin-manifest, agent-definition,
  mcp-config, hook-config, marketplace-catalog — each composed as `upstream-base` + 3
  universal folds + `is-overlay`).

These two tiers must not cross-contaminate. `src/index.ts` re-exports only stable,
promoted contracts, and a runtime-tier symbol must not be exported from an authoring-tier
path (or vice versa). Note authoring **v2** is BYTE-FROZEN-against-v1 by design: it has
**zero `$ref` into v1** (copy-then-tighten), because v1 is byte-frozen at
`@intentsolutions/core@0.4.1`. A PR that adds a `$ref` from v2 into v1 breaks that
isolation — flag it.

**Why schema duplication by consumers is forbidden.** The kernel IS the source of truth;
sibling repos import. If a peer repo (or a change in this repo) locally re-declares a
canonical entity, copies a kernel JSON Schema instead of referencing it, or forks the
`gate-result/v1` shape, the three forms can silently drift and every downstream runtime
check weakens. Within this repo, watch for duplicate/divergent definitions of the same
entity across `src/entities`, `schemas`, and `validators` that would let the three
representations drift apart.

**Predicate URIs live at `evals.*`, NEVER `labs.*`.** Predicate URIs, in-toto predicate
identifiers, OTel attribute namespaces, and attestation predicate hosts MUST use
`evals.intentsolutions.io` and MUST NEVER use `labs.intentsolutions.io` as a live host.
This is a **CISO binding** (DR-004 + DR-010 § 10) with **no override path** — there is no
bead, no ADR, no sign-off that re-opens it. `labs.*` may host blog/methodology content but
never a predicate/attestation/namespace identifier. (Lines that merely *document the
prohibition*, like this one, are fine.) Flag any schema `$id`, predicate constant, URL
literal, or fixture that uses `labs.intentsolutions.io` as a predicate host.

**The TypeScript strict floor only ratchets UP.** `strict: true` plus every additional
flag (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
`noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`). No `any` (explicit or via
`eslint-disable` of `no-explicit-any`). Type-only imports must use `import type`
(`consistent-type-imports`). ESM-only — `.js` extensions on relative imports under
NodeNext. Loosening any of this requires an explicit ADR, never an inline edit — a PR that
silently relaxes a strict flag, drops a `.js` extension, or smuggles in an `any` is a
blocking finding.

---

## 4. What a high-quality review here catches

Because this is the contracts kernel, the highest-value findings are about **contract
integrity and consumer-facing impact**, not local style. Look hard for:

1. **A consumer-facing contract change missing the lockstep triplet.** Per the DR-010
   unification thesis, every canonical contract ships as a coherent triplet: the JSON
   Schema (`schemas/v1/*.schema.json`, draft 2020-12) + the Zod validator
   (`src/validators/v1/`) + the entity type + state machine (`src/entities/`,
   `src/state-machines/`). Flag a new entity type added without its schema + validator; a
   schema added without a matching validator; a state machine whose transition map diverges
   from the entity it governs. The schema, the Zod validator, and the TS type must describe
   the **same** shape.

2. **A breaking change to a published contract.** This package is published with sigstore
   provenance and imported by every sibling repo. Schema evolution is expected to be
   **additive** (see `000-docs/006-...`): no v0.1 contract renamed/removed, every prior
   EvidenceBundle + `gate-result/v1` row stays valid. A field removal, a rename, a
   type-narrowing on an existing field, a new *required* field, or a tightened enum on a
   published contract is a **breaking** change and needs a MAJOR bump + explicit call-out —
   flag any such change that is presented as additive/minor.

3. **Schema-as-canon discipline breaks.** NEVER hand-edit
   `src/validators/v1/_generated/*` — those are codegen output from the JSON Schema. A PR
   that edits generated code without re-running `pnpm run codegen:validators`, or that
   changes a schema without regenerating, means the Schema and the Zod validators are out of
   sync. `SECURITY.md` classifies this as a **High-severity vulnerability** because it
   silently weakens every downstream consumer's runtime check. Also watch the authoring
   codegen (`scripts/codegen-authoring.ts`) and the one documented ajv-vs-Zod carve-out
   (`CONSUMERS.md` — INV-ENV-DISJOINT / kyh9: a `requires_env ∩ fallback_for_env` mutual
   exclusion that lives in Zod only and is intentionally absent from the published JSON
   Schema).

4. **Boundary violations.** Anything that takes the kernel out of role (§ 3): a new runtime
   dep, a forbidden `src/` path or top-level dir, an LLM/DB/HTTP/server/queue package, or a
   new top-level file not in the `ALLOWLIST.md` allowlist. The boundary checker catches the
   obvious cases; you catch the ones shaped to evade it and the ones where the *intent* is a
   runtime even if the *name* looks innocent.

5. **Predicate-URI host drift** (§ 3) — any `labs.intentsolutions.io` predicate/namespace
   host. No override path; always blocking.

6. **Strictness-floor regressions** (§ 3) — any quiet loosening of the TS strict config,
   an introduced `any`, a non-`import type` for a type-only symbol, or a dropped `.js`
   extension.

7. **Branded-type / security invariants** (`SECURITY.md`) — code that lets a branded type
   (e.g. `Sha256`) be constructed from un-validated input, or that escalates a signing mode
   in `gate-result/v1`. Branded types are opaque on purpose; construction must flow through
   the Zod validators that run real hash/format checks.

When a finding touches a contract, prefer the grounding docs in `.greptile/files.json`
(FORBIDDEN.md, ALLOWLIST.md, the boundary STND `000-docs/003`, the per-repo blueprint
`000-docs/002`, SECURITY.md, CONSUMERS.md, `tests/TESTING.md`, and the schema index files)
to anchor the comment in the binding rule rather than a general opinion. Richer context =
deeper review — cite the doc and the tier it sits at.


## Review priorities — what to weight, what to skip

Greptile is **advisory** here. The deterministic merge gate is this repo's own
required CI (typecheck, lint, tests, coverage/mutation where applicable, the
audit-harness self-check, and CodeQL). Greptile's job is the semantic layer those
gates structurally cannot see — weight findings accordingly.

**Prioritize** (worth a comment): correctness and logic errors; security and
supply-chain / credential exposure; data-integrity and signed-evidence invariants;
concurrency and ordering hazards; input validation; auth / authorization
boundaries; secret handling; and regressions against the scoped invariants in
`config.json`.

**Deprioritize** (do not spend a comment here): style and naming; formatting;
churn in generated or build artifacts; and anything the L1 linters or CodeQL
already report. Never restate a deterministic gate — state the problem, the
`file:line`, and the concrete fix.
