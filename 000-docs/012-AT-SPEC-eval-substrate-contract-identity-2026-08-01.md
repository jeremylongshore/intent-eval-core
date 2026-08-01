# Eval-substrate contract identity

**Status:** IMPLEMENTATION APPLICATION OF MASTER BLUEPRINT
**Date:** 2026-08-01
**Plan:** `IEP-EVAL-EVOLUTION-001`
**Master bead:** `bd_000-projects-htjt`
**Repo bead:** `bd_000-projects-htjt.1`
**Owning repo:** `intent-eval-core`

## Decision

The `EvalSpec` exported by `@intentsolutions/core` remains the one canonical
kernel evaluation-spec contract. It is the declarative entity identified by
`(id, version, content_hash)` and backed by the three required artifacts:

- the TypeScript `EvalSpec` interface;
- `schemas/v1/eval-spec.schema.json`; and
- `src/validators/v1/eval-spec.ts`.

No sibling repository may publish a second unrelated schema or type named
`EvalSpec` and treat it as the platform contract.

J-Rig's existing skill-shaped document is a profile, not a competing kernel
entity. It will be named `SkillEvalSpec` in the J-Rig surface and will retain
its skill-specific vocabulary (`criteria`, `test_cases`, trigger expectations,
model targets, judge settings, and sibling context). A versioned adapter in
J-Rig will map that profile to the canonical kernel `EvalSpec` identity before
cross-repo evidence or rollout claims are emitted.

This keeps the kernel generic without forcing skill-specific criteria and test
case semantics into the kernel. It also gives generic benchmarks and governed
skill evaluations a common `EvalSpec`/`EvalRun`/evidence lineage.

## Identity and adapter rules

1. `EvalSpec` means the kernel contract everywhere in cross-repo documents,
   Evidence Bundles, and runtime references.
2. `SkillEvalSpec` means the J-Rig profile. Its profile version is independent
   from the kernel package version and must be recorded in the adapter output.
3. The adapter must preserve the source profile hash, canonical spec hash,
   profile version, kernel version, and mapping revision. A consumer must be
   able to determine exactly which profile produced a canonical spec.
4. A profile validation failure is a submission error; it must not produce a
   partially populated canonical `EvalSpec` or an unverified report.
5. Existing skill fixtures remain readable through an explicit migration path.
   Silent reinterpretation of old `eval-spec.yaml` files is not allowed.
6. The kernel does not own J-Rig execution, graders, sampling, or storage.
   Those remain in the runtime repo; the kernel owns only stable contract
   shapes and validation.

## Currency baseline

The current kernel release is `@intentsolutions/core@0.10.0`, with the Python
distribution at `intent-eval-core==0.10.0`. Consumers participating in the
first substrate migration must pin or range against `0.10.0` intentionally and
must record the chosen version in their PR and compatibility fixture. A package
pin below `0.10.0` is a drift finding, not a harmless documentation mismatch.

## Explicit non-decisions

- This document does not add a new canonical entity or predicate URI.
- This document does not move J-Rig's criteria/test-case schema into the
  kernel.
- This document does not add execution or grading logic to the kernel.
- Promoting `SkillEvalSpec` into a public kernel profile is a follow-up design
  decision after the adapter fixture has proven the boundary; until then the
  profile is owned by J-Rig and the kernel remains the authority for
  `EvalSpec`.

## Acceptance evidence for the next PRs

- J-Rig no longer exports or imports its skill-shaped schema as `EvalSpec`.
- A generic kernel `EvalSpec` fixture and a skill-profile fixture have distinct
  names and both validate at their intended boundary.
- The adapter emits canonical identity plus source-profile lineage.
- All affected packages consume the intended `@intentsolutions/core` version.
- Evidence and rollout fixtures remain valid, and the cross-repo drift gate
  fails on a reintroduced duplicate name or stale kernel pin.
