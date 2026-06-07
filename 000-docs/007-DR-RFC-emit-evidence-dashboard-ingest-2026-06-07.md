# DR-RFC — Emit signed gate-result evidence for the dashboard

| Field | Value |
|---|---|
| Doc | `007-DR-RFC-emit-evidence-dashboard-ingest-2026-06-07.md` |
| Status | Accepted (acting-head, 2026-06-07) |
| Scope | `intent-eval-core` CI emit of this repo's own testing evidence |
| Bead | `nr75.4` (umbrella `bd_000-projects-nr75`, GH `intent-eval-dashboard#17`) |
| Consumes | `@intentsolutions/core` `gate-result/v1` + `EvidenceBundle` schemas (this repo) |
| Feeds | `intent-eval-dashboard` ingest (the 8-step verify-before-render worker) |

## 1. What this is

`scripts/emit-evidence.ts` + `scripts/assemble-manifest.ts` + a `release.yml` job that produce, on every tag release, a **signed `report-manifest.json`** of this repo's own testing results, in exactly the shape the dashboard ingest fetches and re-verifies. It dogfoods the kernel: intent-eval-core proves the unification thesis (DR-010 — "every validator emits Evidence Bundle") by emitting its own evidence with its own validators.

## 2. Why it lives in `intent-eval-core/scripts/`, not the kernel surface or audit-harness

- **Not the kernel published surface.** It is a CI-only `scripts/` helper (like `check-boundaries.ts`), not in `src/`, not in `files`. It does not add a runtime/harness to the package — it only *uses* the kernel validators. The boundary checker (`pnpm run boundaries`) passes; coverage floor (`src/**`) is untouched.
- **Why not audit-harness (the architecturally "correct" emit home).** audit-harness already has `scripts/emit-evidence.sh`, but it emits the **v0.1.0-draft** gate-result shape (`result`/`timestamp`, missing `gate_name`/`gate_version`/`gate_reasons`/`coverage`) wrapped as a bare in-toto Statement — NOT the kernel `gate-result/v1` (Blueprint B § 7.4) nor the dashboard's `report-manifest.json` of `EvidenceBundle`s. And audit-harness is Phase-B-gated + zero-npm-deps (cannot import the kernel Zod validators to produce kernel-schema-valid bundles in bash). So the kernel-shape emitter is implemented here first, dogfooding the kernel; generalising it into audit-harness (for all 6 repos) is a follow-up once Phase B opens.

## 3. The contract (verified against the dashboard source)

The dashboard ingest (`src/ingest/`) fetches `report-manifest.json`, then per row: (2) OIDC subject/issuer/workflow_ref vs `pinned-subjects.json`, (3) Rekor inclusion, (4) DSSE signature over `canonicalJsonBytes(row.bundle)`, (5) kernel `EvidenceBundleSchema`, (6) content-address. We match it exactly:

- **Manifest shape** = `{repo, signing:{issuer,subject,workflowRef}, rows:[{bundle, sigstoreBundle, sourceSha, gateResults}]}`. Verified locally against the dashboard's real `isReportManifestShape` (returns true) and `validateEvidenceBundle` (returns OK).
- **Canonical bytes.** `emit-evidence.ts` writes each `bundle-<i>.json` as `stableStringify(bundle)` (sorted keys, no whitespace) — byte-identical to the dashboard's `canonicalJsonBytes`. `cosign sign-blob` signs those exact bytes, so the dashboard's re-canonicalisation round-trips and the DSSE check passes.
- **Signing identity.** Cosign keyless signing in `release.yml` ⇒ Fulcio SAN `https://github.com/jeremylongshore/intent-eval-core/.github/workflows/release.yml@refs/tags/vX.Y.Z`, matching the dashboard's pinned `iec` entry (`release.yml@refs/tags/*`, `operatorConfirmed: true`). No pinned-subjects change needed.

## 4. Two contract decisions (the non-obvious bits)

- **`rekor_log_indices: []` in the signed bundle (with `signing_mode: 'rekor_production'`).** The Rekor index is assigned *when the bundle is logged*, so embedding it in the very bytes being signed+logged is circular. We keep the field empty in the signed `EvidenceBundle`; the **real** Rekor inclusion proof lives in the row's `sigstoreBundle`, which is exactly what the dashboard's step-3 Rekor check verifies. The schema permits an empty array (no `minItems`). A future enhancement can surface the index from the `sigstoreBundle` for display.
- **Gate-result bodies travel in `gateResults` (additive), not inside the EvidenceBundle.** The kernel `EvidenceBundleSchema` is strict (no slot for predicate bodies); it carries only `subject_set` ({gate_id, digest}). So each `gate-result/v1` body rides alongside its row in an additive `gateResults` field (the dashboard's `isReportManifestShape` tolerates extra keys; the current ingest ignores it; the future gate-row resolver consumes it), and its content hash is recorded in `subject_set`.

## 5. What is verified where

- **Locally (this PR):** `--self-check` (kernel-valid + canonical-stable builders), a real run over the repo's actual gates (architecture + coverage, both `pass`), and cross-repo validation against the dashboard's real `validateEvidenceBundle` + `isReportManifestShape`. `pnpm run check` green (lint + typecheck + 195 tests + arch + boundaries).
- **First tag run only (nr75.8 milestone):** the live Cosign keyless signature + Rekor entry + Release-asset publish + the dashboard's end-to-end fetch→verify→ingest. These need real CI OIDC and cannot be exercised locally.

## 6. Gates emitted (first cut)

`architecture` (audit-harness `arch`) and `coverage` (Vitest json-summary vs the configured floor). Both map to authored explainers on the dashboard's testing surface. More gates (mutation, CRAP, escape-scan) are additive — append outcomes in `collectOutcomes()`.

## 7. Operator wiring (dashboard side, follow-up)

Point the dashboard's `ManifestUrlResolver` for `iec` at
`https://github.com/jeremylongshore/intent-eval-core/releases/latest/download/report-manifest.json`,
and build the production gate-row resolver to read each row's `gateResults`. Both are dashboard-side follow-ups (the production `TestingBundleResolver` bead).
