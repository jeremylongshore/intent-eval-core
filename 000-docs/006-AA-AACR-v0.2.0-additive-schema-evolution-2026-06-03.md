# After-Action / Change Record — `@intentsolutions/core` v0.2.0 additive schema evolution

**Type:** After-Action Critical Review (AACR)
**Date:** 2026-06-03
**Release type:** MINOR (0.1.1 → 0.2.0) — purely additive schema evolution
**Status:** Additive surface landed on PR branch; **npm publish + git tag HELD pending `iec-E12` reconciliation**
**Repo:** [`jeremylongshore/intent-eval-core`](https://github.com/jeremylongshore/intent-eval-core)
**Package:** [`@intentsolutions/core`](https://www.npmjs.com/package/@intentsolutions/core)
**Bead:** `ied-schema-evolution` (amber-lighthouse Epic 2.1)
**Plan:** `~/.claude/plans/intent-solutions-lab-reports-amber-lighthouse.md` § Epic 2.1

---

## Executive summary

Purely **additive** evolution of the canonical contracts kernel for the public lab-reports dashboard work (amber-lighthouse Phase 2). No v0.1 contract is changed, renamed, or removed — every v0.1.0 / v0.1.1 EvidenceBundle and `gate-result/v1` row remains valid against the v0.2.0 schemas. Three deliverables, each carried consistently across all three representations (TS type · JSON Schema · Zod validator):

1. **`EvidenceBundle.pre_registration_hash`** — optional + nullable pre-registration commitment hash (D2 binding).
2. **`retraction/v1` predicate body** — append-only retraction record with a closed `reason_class` enum (B4 binding).
3. **`dashboard-render/v1` predicate body** — attests a rendered dashboard artifact was produced from a content-addressed set of evidence inputs (B3 binding, sequenced).

All three predicate URIs live at `evals.intentsolutions.io` and NEVER at `labs.intentsolutions.io` (CISO binding, DR-004 + DR-010).

---

## Predicate URIs declared (exact)

| Predicate | URI |
|---|---|
| retraction/v1 | `https://evals.intentsolutions.io/retraction/v1` |
| dashboard-render/v1 | `https://evals.intentsolutions.io/dashboard-render/v1` |

`gate-result/v1` (`https://evals.intentsolutions.io/gate-result/v1`) is unchanged.

---

## Changes included

### 1. `EvidenceBundle.pre_registration_hash` (D2 binding)

- TS: `readonly pre_registration_hash?: Sha256Prefixed | null` on `EvidenceBundle` (`src/entities/EvidenceBundle.ts`).
- JSON Schema: `pre_registration_hash` property, `oneOf` `sha256Prefixed` / `null`, NOT in `required` (`schemas/v1/evidence-bundle.schema.json`).
- Zod: `pre_registration_hash: Sha256PrefixedSchema.nullable().optional()` (`src/validators/v1/evidence-bundle.ts`).
- Semantics: `sha256:<hex>` of the pre-registration commitment artifact when the run was pre-registered; `null` when not; absent ≡ `null` (v0.1 producers stay valid). Drives pre-registration rendering symmetry — a present, non-null hash proves the result arm was committed-to before the data was seen.

### 2. `retraction/v1` (B4 binding)

- Schema: `schemas/v1/retraction.schema.json` — modeled on `gate-result.schema.json` ($schema draft 2020-12, $id at `evals.intentsolutions.io`, `additionalProperties: false`, full `$ref` to `_common.schema.json` $defs).
- TS: `src/predicates/retraction-v1.ts` — `RetractionV1`, `RetractionReasonClass`, `RetractedSubject`, `RetractionV1Statement`, `RETRACTION_V1_URI`, `RetractionV1Uri`.
- Zod: `src/validators/v1/retraction-v1.ts` — `RetractionV1Schema`, `RetractionReasonClassSchema`, `RetractedSubjectSchema`.
- `reason_class` is a CLOSED 6-element enum exactly: `partner-request | methodology-error | data-quality | consent-withdrawn | legal-hold | pre-publication-recall` (open text rejected — GC refusal binding).
- `retracted_subject` carries `bundle_id` / `storage_key` / `content_hash`; the validator + schema (`minProperties: 1`) require at least one so the retraction resolves to a concrete artifact.
- Free-text `reason` is optional context; `retracted_at` (RFC 3339) required; optional `retracted_by` actor identity.

### 3. `dashboard-render/v1` (B3 binding, sequenced)

- Schema: `schemas/v1/dashboard-render.schema.json` — modeled on `gate-result.schema.json`.
- TS: `src/predicates/dashboard-render-v1.ts` — `DashboardRenderV1`, `RenderedArtifact`, `DashboardInputBundle`, `DashboardRenderV1Statement`, `DASHBOARD_RENDER_V1_URI`, `DashboardRenderV1Uri`.
- Zod: `src/validators/v1/dashboard-render-v1.ts` — `DashboardRenderV1Schema`, `RenderedArtifactSchema`, `DashboardInputBundleSchema`.
- Fields: `rendered_artifact` (`content_hash` required; optional `uri` + `media_type`), `input_bundles` (non-empty array, each entry requires `bundle_id` and/or `content_hash`), `rendered_at`, `renderer` (`<kebab-slug>@<semver>`, mirroring gate-result's `runner`), optional `renderer_config_hash`.
- **Field-choice note (plan under-specified B3 minimal fields):** the plan named the artifact reference (path/url + sha256), input bundle ids/digests, `rendered_at`, and renderer identity+version. Where the plan left shape open, the minimal sound set above was chosen, mirroring the other predicates: `content_hash` is authoritative (uri is convenience); `renderer` reuses the `runnerIdentifier` primitive; `renderer_config_hash` was added optionally so a verifier can pin templates, not just tool version (supports the sign-your-own-homework reproduction path the predicate exists for).

### Registry + catalog wiring

- `PREDICATE_URIS` (in `src/predicates/gate-result-v1.ts`) gains `RETRACTION_V1` + `DASHBOARD_RENDER_V1`.
- `src/predicates/index.ts` + `src/validators/v1/index.ts` re-export the new modules.
- `schemas/v1/index.json` catalogs both new predicate schemas with `signing_mode: sigstore_staging`.
- `package.json` `exports` already cover the new files via the `./schemas/v1/*.json` + `./validators/v1/*` wildcard subpaths — no new explicit subpath entries needed; consumers import `@intentsolutions/core/validators/v1/retraction-v1`, `.../schemas/v1/retraction.schema.json`, etc. exactly as they do for gate-result.

---

## Files added / changed

**Added (8):**
- `schemas/v1/retraction.schema.json`
- `schemas/v1/dashboard-render.schema.json`
- `src/predicates/retraction-v1.ts` + `src/predicates/retraction-v1.test.ts`
- `src/predicates/dashboard-render-v1.ts` + `src/predicates/dashboard-render-v1.test.ts`
- `src/validators/v1/retraction-v1.ts`
- `src/validators/v1/dashboard-render-v1.ts`
- `tests/fixtures/v1/{retraction.valid,retraction.invalid-bad-reason-class,dashboard-render.valid,dashboard-render.invalid-empty-inputs,evidence-bundle.with-prereg.valid}.json`
- `src/validators/v1/_generated/{retraction,dashboard-render}.ts` (codegen reference)
- This AAR.

**Changed:**
- `src/entities/EvidenceBundle.ts`, `schemas/v1/evidence-bundle.schema.json`, `src/validators/v1/evidence-bundle.ts` (pre_registration_hash)
- `src/predicates/index.ts`, `src/predicates/gate-result-v1.ts` (PREDICATE_URIS), `src/validators/v1/index.ts`, `schemas/v1/index.json`
- `src/__tests__/schemas.test.ts`, `src/validators/v1/validators.test.ts`, `src/predicates/gate-result-v1.test.ts`, `test-d/predicates.test-d.ts` (new tests + updated structural counts 16→18 files / 1→3 predicates)
- `src/validators/v1/_generated/*` (codegen re-run; idempotent)
- `api/intentsolutions-core.api.md` (golden snapshot regenerated via `pnpm run api:extract`)
- `package.json` (0.1.1 → 0.2.0), `CHANGELOG.md`

---

## Quality posture

| Gate | Result |
|---|---|
| `pnpm run check` (lint + typecheck + test + arch + boundaries) | PASS — 195 tests |
| `pnpm run test:coverage` (100% floor) | PASS — 100% line/branch/function/statement, incl. all new files |
| `pnpm run codegen:validators` | Clean + idempotent (two consecutive runs produce byte-identical output) |
| `pnpm run build` | PASS |
| `pnpm run test:types` (tsd) | PASS |
| `pnpm run api:check` (SemVer regression gate) | PASS after `api:extract` regenerated the golden snapshot |
| `pnpm run harness:verify` (hash-pinned policy) | OK (no policy file touched) |

---

## Release hold — coordination with iec-E12

The `package.json` bump to 0.2.0 + this changelog entry are committed, but **the npm publish and the `v0.2.0` git tag are intentionally NOT performed here.** `iec-E12` adds `EvidenceBundlePayload` shape + cross-field invariants to the same v0.2.0 line. Both bodies of work must ship as one coordinated v0.2.0 so consumers see a single, complete minor release rather than two partial ones. When iec-E12 reconciles: re-run the full gate, tag `v0.2.0`, push `--follow-tags`, and let `release.yml` publish with sigstore provenance.

---

## References

- Plan: `~/.claude/plans/intent-solutions-lab-reports-amber-lighthouse.md` § Epic 2.1 (`ied-schema-evolution`)
- v0.1.0 release AAR: `001-AA-AACR-release-v0.1.0-2026-05-17.md`
- Binding docs (intent-eval-lab main): DR-010, Blueprint A/B/C, Canonical Glossary
- Umbrella governance: `~/000-projects/intent-eval-platform/CLAUDE.md`

— Jeremy Longshore
intentsolutions.io
