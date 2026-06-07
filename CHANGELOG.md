# Changelog

All notable changes to `@intentsolutions/core` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer 2.0.0](https://semver.org/).

## [Unreleased]

### Pending

- Evidence Bundle predicate compatibility policy (forward/backward/mixing/deprecation rules) MUST land before first prod-Rekor anchor — bd `bd_000-projects-uprg` (P0)
- OTel semantic conventions pinned in `schemas/v1/otel-attributes.yaml` to prevent attribute drift across consumer emitters — bd `bd_000-projects-9pi3` (P0)

## [0.3.0] - 2026-06-07

`iec-E12` (ISEDC Session 5 Q2 / DR-018). Purely **additive** — no v0.1/v0.2 contract changes; every prior EvidenceBundle + gate-result/v1 row stays valid. SemVer MINOR. The v0.2.0 line shipped the EvidenceBundle field surface (`pre_registration_hash`); this release lands the deferred `EvidenceBundlePayload` wire format + the cross-field invariants.

### Added

- **`EvidenceStatement`** (entity type + `EvidenceStatementSchema` Zod validator) — the in-toto Statement v1 row shape carrying a `gate-result/v1` predicate, folded from j-rig. Pins `_type` to `https://in-toto.io/Statement/v1` and `predicateType` to the canonical `gate-result/v1` URI.
- **Cross-field invariants** (Blueprint B § 7.3 line 792, enumerated for `iec-E12a`) enforced as Zod refinements on `EvidenceStatementSchema`: **I1** `subject[0].name === predicate.gate_id`; **I2** `subject[0].digest.sha256 === predicate.input_hash` (compared without the `sha256:` prefix). These bind the in-toto subject to the predicate body so a row cannot claim a subject it did not evaluate. (Invariants are inherently cross-field and live in the Zod validator — they are not expressible in JSON Schema.)
- **`EvidenceBundlePayload`** (entity type + `EvidenceBundlePayloadSchema` Zod validator) — the JSON-array wire format an `EvidenceBundle`'s `storage_key` content-addresses: an ordered array of `EvidenceStatement` rows.
- **`extensions?: Record<string, unknown>`** escape hatch on `EvidenceStatement` for experimental, non-normative fields — kept OUT of the closed-world `gate-result/v1` predicate body. Consumers MUST NOT use it for ship/no-ship decisions.
- **`IN_TOTO_STATEMENT_V1_TYPE`** constant exported from `@intentsolutions/core/validators/v1`.

### Changed

- `api/intentsolutions-core.api.md` regenerated for the additive `.`-surface exports (`EvidenceStatement`, `EvidenceBundlePayload`).

### Breaking changes

- None. New exports only; the normative `gate-result/v1` body is untouched.

## [0.2.0] - 2026-06-04

Purely **additive** schema-evolution release (amber-lighthouse Epic 2.1 / bead `ied-schema-evolution`). No v0.1 contract is changed, renamed, or removed — every v0.1.0 / v0.1.1 EvidenceBundle and gate-result/v1 row remains valid against v0.2.0. SemVer MINOR. Published to npm with sigstore provenance via tag `v0.2.0`.

### Added — public surface

- **`EvidenceBundle.pre_registration_hash?: Sha256Prefixed | null`** (D2 binding) — optional + nullable pre-registration commitment hash. `sha256:<hex>` when the run was pre-registered, `null` when it was not, absent ≡ `null` (v0.1 producers stay valid). Lets the lab-reports dashboard render pre-registered null results with the same visual weight as positive results. Added consistently across the TS interface, the JSON Schema (`schemas/v1/evidence-bundle.schema.json`), and the Zod validator (`validators/v1/evidence-bundle`).
- **`retraction/v1` predicate body** (B4 binding) — predicate URI `https://evals.intentsolutions.io/retraction/v1`. Append-only signed record that the platform has chosen NOT to surface a prior subject, with a CLOSED-SET `reason_class` enum (`partner-request | methodology-error | data-quality | consent-withdrawn | legal-hold | pre-publication-recall`; open text rejected — GC refusal binding), a resolvable `retracted_subject` reference, optional free-text `reason`, and `retracted_at`. New JSON Schema (`schemas/v1/retraction.schema.json`), TS types (`RetractionV1`, `RetractionReasonClass`, `RetractedSubject`, `RetractionV1Statement`, `RETRACTION_V1_URI`), and Zod validator (`validators/v1/retraction-v1`).
- **`dashboard-render/v1` predicate body** (B3 binding, sequenced) — predicate URI `https://evals.intentsolutions.io/dashboard-render/v1`. Attests that a rendered dashboard HTML artifact (`rendered_artifact` with `content_hash`) was produced from a content-addressed set of evidence inputs (`input_bundles`, non-empty), plus `rendered_at` and a `<kebab-slug>@<semver>` `renderer` identity. Enables sign-your-own-homework reproduction. New JSON Schema (`schemas/v1/dashboard-render.schema.json`), TS types (`DashboardRenderV1`, `RenderedArtifact`, `DashboardInputBundle`, `DashboardRenderV1Statement`, `DASHBOARD_RENDER_V1_URI`), and Zod validator (`validators/v1/dashboard-render-v1`).
- **`PREDICATE_URIS` registry** extended with `RETRACTION_V1` + `DASHBOARD_RENDER_V1` constants; both predicate schemas registered in `schemas/v1/index.json` with `signing_mode: sigstore_staging` (they run in staging until production-Rekor unlock per DR-010 Q3).

### Predicate URI discipline

All three predicate URIs in this release live at `evals.intentsolutions.io` and NEVER at `labs.intentsolutions.io` (CISO binding, DR-004 + DR-010). Enforced by schema tests + the boundary checker's URL-pattern axis.

### Breaking changes

- None. Purely additive (the field is optional+nullable; the predicates are net-new URIs per § 7.2 backward-compat).

### Architectural bindings

- amber-lighthouse plan Epic 2.1 (`ied-schema-evolution`) — D2 / B3 / B4 bindings
- DR-010 (ISEDC Session 4 widened-scope lock) — predicate-URI host discipline, sigstore_staging default
- Blueprint B § 7 — in-toto + DSSE predicate-body wrapping; § 7.2 backward-compat (adding a predicate URI is allowed)

## [0.1.1] — 2026-05-25

Maintenance release. No new exported API surface — additions are CI/architecture posture, governance/documentation, and repo-scaffolding hygiene.

### Added

- **CI: SemVer regression suite** (`iec-E07`) — api-extractor golden snapshot + CI gate that fails on undocumented API drift + migration-notes generator. Downstream consumers can now trust that `0.x.y → 0.x.(y+1)` will NEVER silently rename or remove a public-surface export.
- **Architecture: 4-axis boundary enforcement** (`iec-E11`) — `FORBIDDEN.md` + `ALLOWLIST.md` + `CODEOWNERS` + checker + CI. Codifies kernel anti-goals (no runtime, no judges, no execution) as enforced rules rather than aspirational prose.
- **Repo scaffolding**: `SECURITY.md` (vulnerability-disclosure policy + threat model for kernel-of-contracts), `CONTRIBUTING.md` (dev setup + schema-as-canon discipline + architectural bindings), `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1).

### Changed

- **Documentation: per-repo blueprint** (`iec-E10`) — applies Blueprint C template to this repo; lands at `000-docs/`.
- **Documentation: testing SOP + CI/CD bootstrap AAR** (`iec-E12` partial — ratify-and-close on testing scaffolding) — includes `TEST_AUDIT.md`.
- **Documentation: IEP /appaudit baseline** — operator-grade snapshot of the IEP ecosystem as of 2026-05-20, filed at `000-docs/`.
- **Documentation: post-v0.1.0 polish** — README install block, badges, status banners, `/validate-consistency` drift fixes.
- **Documentation: v0.1.0 release AAR** — `/release` Phase 8 deliverable filed at `000-docs/001-AA-AACR-release-v0.1.0-2026-05-17.md`.

### Security

- No security fixes in this release. Routine sigstore-provenance discipline preserved (every release tarball signed; consumers verify with `npm audit signatures`).

### Architectural bindings

- [DR-010](https://github.com/jeremylongshore/intent-eval-lab/blob/main/000-docs/010-AT-DECR-isedc-council-session-4-widened-scope-2026-05-13.md) — ISEDC Session 4 widened-scope lock (BINDING)
- [Blueprint A § 1.2 principle 10](https://github.com/jeremylongshore/intent-eval-lab/blob/main/000-docs/011-AT-ARCH-ecosystem-master-blueprint.md) — schema is canon; this release adds the SemVer-regression CI gate that enforces it
- [Blueprint C](https://github.com/jeremylongshore/intent-eval-lab/blob/main/000-docs/013-AT-SPEC-repo-blueprint-template.md) — repo template applied via `iec-E10`

### Quality posture (unchanged from v0.1.0)

- 100% line/branch/function/statement coverage on consumer-facing code
- 0 architecture violations across 8 forbidden dep-cruiser rules
- 154+ vitest tests + ~80 tsd negative assertions
- 31 ajv-based JSON Schema validation tests; 31 Zod validator tests
- `@intentsolutions/audit-harness@1.1.4` wired (escape-scan + arch + harness-hash)
- sigstore provenance attached to published tarball

## [0.1.0] — 2026-05-17

First public release. The canonical contracts kernel for the [Intent Eval Platform](https://github.com/jeremylongshore/intent-eval-lab) — TypeScript types, JSON Schemas, Zod validators, and state machines for the 13 canonical entities.

### Added

#### Public surface

- **`@intentsolutions/core`** (main entry) — pure types only, zero runtime dependencies
  - 13 canonical entity interfaces per [Blueprint B § 2](https://github.com/jeremylongshore/intent-eval-lab/blob/main/000-docs/012-AT-ARCH-platform-runtime-blueprint.md): `EvalSpec`, `EvalRun`, `MatcherMap`, `EvidenceBundle`, `JudgeDecision`, `RuntimeReceipt`, `RegressionPack`, `RolloutGate`, `SkillSnapshot`, `SessionTrace`, `ToolInvocation`, `CostRecord`, `FailureTaxonomy`
  - **`gate-result/v1` NORMATIVE in-toto predicate body** per Blueprint B § 7.4 — the only fully spec-bound predicate at v1
  - 10 branded primitive types: `Uuidv7`, `Sha256`, `Sha256Prefixed`, `Rfc3339`, `SemVer`, `KebabSlug`, `MicroUsd`, `StorageKey`, `OtelSpanId`, `ActorIdentity`
  - State-machine transition maps + `canTransition` helper
  - Composition DAG types with closed edge-kind enum (`feeds` / `gates` / `enriches`)

- **`@intentsolutions/core/schemas/v1`** — JSON Schema definitions (draft 2020-12)
  - 13 entity schemas at `schemas/v1/<entity>.schema.json`
  - `gate-result.schema.json` with `$id = https://evals.intentsolutions.io/gate-result/v1.schema.json`
  - `_common.schema.json` with 14 shared `$defs`
  - `index.json` catalog
  - Use with any JSON Schema validator (ajv, jsonschema-py, etc.)

- **`@intentsolutions/core/validators/v1`** — opt-in Zod runtime parsers
  - Per-entity validators at `validators/v1/<entity>` for tree-shaking
  - Branded Zod primitives mirroring the TS brands
  - Discriminated unions for variant types
  - `superRefine` enforcement of the Blueprint B § 7.4 `advisory_severity` conditional rule
  - Requires `zod ^4.x` as a peer

### Architectural bindings

- [DR-010](https://github.com/jeremylongshore/intent-eval-lab/blob/main/000-docs/010-AT-DECR-isedc-council-session-4-widened-scope-2026-05-13.md) — ISEDC Session 4 widened-scope lock; TS-primary signing surfaces; unification thesis binding
- [Blueprint A](https://github.com/jeremylongshore/intent-eval-lab/blob/main/000-docs/011-AT-ARCH-ecosystem-master-blueprint.md) — 12 binding principles, kernel-only anti-goals
- [Blueprint B](https://github.com/jeremylongshore/intent-eval-lab/blob/main/000-docs/012-AT-ARCH-platform-runtime-blueprint.md) — runtime architecture, 13-entity domain model, `gate-result/v1` NORMATIVE spec
- [Blueprint C](https://github.com/jeremylongshore/intent-eval-lab/blob/main/000-docs/013-AT-SPEC-repo-blueprint-template.md) — repo template (this repo's blueprint per `iec-E10`)
- [Canonical Glossary](https://github.com/jeremylongshore/intent-eval-lab/blob/main/000-docs/014-DR-GLOS-canonical-glossary.md) — single source of truth for platform terminology

### Quality posture

- **100% line/branch/function/statement coverage** on all consumer-facing code
- **0 architecture violations** across 8 forbidden dep-cruiser rules (kernel-no-runtime-deps, predicates-no-entities, state-machines-pure, validators-only-import-zod, …)
- **154 vitest tests + ~80 tsd negative assertions** ≈ 170 type-level + runtime assertions
- **31 ajv-based JSON Schema validation tests** with positive + negative golden fixtures
- **31 Zod validator tests** with positive + negative fixtures
- **Full ERD-walk integration test** locks every Blueprint B § 6.2 cross-entity invariant
- **`@intentsolutions/audit-harness@0.1.0`** wired (escape-scan + arch + harness-hash via husky pre-commit + GitHub Actions CI)
- **sigstore provenance** attached to the published tarball — verify with `npm audit signatures`

### Adoption notes for downstream consumers

Three sibling platform repos will migrate to this package:

| Repo | What to import | Migration shape |
| --- | --- | --- |
| `audit-harness` | `@intentsolutions/core` types for entities the harness emits predicate rows about; `@intentsolutions/core/validators/v1/gate-result-v1` for runtime parsing | Replace any local `gate-result/v1`-shaped types; brand existing identifier strings via the Zod parsers; emit signed rows whose predicate body satisfies `GateResultV1Schema` |
| `j-rig-skill-binary-eval` | `@intentsolutions/core` for `JudgeDecision`, `EvalRun`, `SessionTrace`, `ToolInvocation`; `@intentsolutions/core/validators/v1` for runtime parsing | Move existing entity types into this package; map judge verdicts (UPPERCASE `JudgeVerdict`) through the `@j-rig/rollout-gate` translator to RolloutGate decisions (lowercase `RolloutGateDecision`) |
| `intent-rollout-gate` | `@intentsolutions/core/validators/v1/gate-result-v1` for parsing DSSE-wrapped predicate bodies | Replace local schema definitions with the canonical `GateResultV1Schema`; verify DSSE signatures externally (out of kernel scope); apply consumer-side policy from `tests/TESTING.md` per § 7.6 architectural separation |

**Codegen tooling**: the consuming codemod work was scoped down to "hand-migration acceptable" per iec-E09 acceptance criteria (sub-children E09b/c/d demoted to P2). No automated codemod ships in v0.1.0; the migration shape above is the documented manual recipe.

### Tracking

- Bead epic: `bd_000-projects-00t` (iec-E09)
- Plane: LAB-86
- GH epic issue: jeremylongshore/intent-eval-core#5

[0.1.0]: https://github.com/jeremylongshore/intent-eval-core/releases/tag/v0.1.0
