# Changelog

All notable changes to `@intentsolutions/core` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer 2.0.0](https://semver.org/).

## [Unreleased]

### Added

- **OTel semantic-conventions pin for the runtime events** (`lineage: blueprint-b@4.3`; Gregg finding #2; bd `bd_000-projects-9pi3`). New canonical naming authority at `schemas/v1/otel-attributes.yaml` pinning the attribute names for the OTel runtime events Blueprint B (intent-eval-lab `000-docs/012-AT-ARCH-platform-runtime-blueprint.md`) § 4.3 enumerates — `runtime.dedup`, `replay.verdict`, `replay.input.drift`, `bundle.emission.refused`. Blueprint B § 4.3 locks the event CATEGORIES and names the events but DEFERS the per-attribute names (to the lab's iel-E12 `020` taxonomy, forward-ref); without a pin, the five emitters (j-rig, audit-harness, intent-rollout-gate, lab tests, the kernel) would drift on key spelling (`eval_run_id` vs `evalRunId` vs `run.id`) the moment two of them emit the same event independently. The yaml picks ONE OTel-idiomatic dotted-lowercase form per attribute (`eval.run_id`, `bundle.predicate_uri`) and pins each event's full attribute set with types + requirement level + closed enums (replay verdict, drifted-field, refused-contract). The TypeScript projection ships at the new opt-in subpath `@intentsolutions/core/otel/v1` (`src/otel/v1/`): named attribute-name constants + per-event attribute-set maps + closed-enum literal unions, all pure literals (no npm imports, no other-`src/` imports). A drift guard (`src/otel/v1/__tests__/attributes.test.ts`) parses the yaml and asserts the constants and yaml keys match bidirectionally. Blueprint B § 7.2 binds the paired normative 'must emit' attribute list on the lab side, citing this yaml as the spelling source; § 7.2 also forbids an OTel attribute namespace under `labs.intentsolutions.io` — these keys carry no domain. `FORBIDDEN.md` § Axis 2 gains the `src/otel/` allowed-src subpaths; `package.json` gains the `./otel/v1` export. The yaml is NOT a `changelog-observance`-watched schema file (not `*.schema.json` / authoring base / overlay / index), so this entry is the governing changelog record.
- **Cross-schema invariant catalog + kernel predicate helpers** (implements plan 033 § 14.B; `lineage: dr-044@d-sak-1`). New machine-readable normative register at `schemas/authoring/cross-schema-invariants.v1.json` cataloging the 7 dependency-edge invariants over the 6 authoring contracts (§ 14.B.1 edges, § 14.B.2 catalog, § 14.B.3 routing): each carries `{id, statement, edge, enforced_at, severity, class}`. The one kernel-checkable ADVISORY invariant `INV-ALLOWED-DISALLOWED` (allowed-tools ∩ disallowed-tools = ∅) ships as a WARNING-level cross-field helper in `src/validators/v1/authoring/cross-schema/cross-schema-invariants.ts` — deliberately NOT folded into the byte-frozen `SkillFrontmatterSchema` (advisory routing per § 14.B.3 must not block parse). The 6 STRUCTURAL invariants resolve across artifacts and are enforced in the deep validators named in `enforced_at`; the kernel exports one typed predicate-helper per invariant (DI'd child-validator descent) for a deep validator to import. The cross-artifact descent wiring into `validate-plugin` / `validate-marketplace` is the explicitly-scoped REMAINDER (not built here).
- **6767-h COVERAGE MAP + three CI gates** (implements plan 033 § 14.2; `lineage: dr-044@d-sak-1`). New trace artifact `schemas/authoring/v1/6767h-coverage-map.json` — the § 14.2.1 "third value" — maps every field of the composed `skill-frontmatter` authoring contract (the walking skeleton) to its provenance: 6 `anthropic-spec-derived` rows (each cites a real `6767h_section` from the vendored heading inventory `schemas/prose-anchors/6767-h.headings.json` + an `anthropic_doc` URL) and 8 `is-only-extension` rows (each carries `category` + `rationale` + `upstream_convergence_trigger`). Three new gates wired into `pnpm run check` + `.github/workflows/coverage-map-gates.yml` (§ 14.2.3): `check:coverage-map` (completeness — every composed field has an entry, no stale rows; bidirectional), `check:coverage-map-prose-anchors` (EXTENDS the PR #37 prose-anchor gate — REUSES its `loadInventory`/`resolves` machinery to validate the map's structured `6767h_section` citations against the same inventory the #37 `$comment` gate uses), and `check:is-extension-rationale` (every IS-only extension carries a non-empty rationale + convergence trigger). The other five contracts' coverage-map population is the explicitly-scoped REMAINDER; the completeness gate's `CONTRACTS` registry makes adding them mechanical. Coverage-map JSON is NOT a byte-frozen `authoring/v1` artifact and is NOT a `changelog-observance`-watched schema file (not `*.schema.json` / base / overlay / index), so this entry is the governing changelog record. `tsconfig.json` gains `allowImportingTsExtensions` (scripts-only typecheck; overridden off in `tsconfig.build.json` for emit) so gate #2 can import the #37 resolver as the `--experimental-strip-types` runtime requires.

### Pending

- Evidence Bundle predicate compatibility policy (forward/backward/mixing/deprecation rules) MUST land before first prod-Rekor anchor — bd `bd_000-projects-uprg` (P0)

## [0.6.0] - 2026-06-12

### Added

- **`authoring/v2` five-contract family** (PR #39, implements DR-062): `mcp-config`, `plugin-manifest`, `agent-definition`, `hook-config`, `marketplace-catalog` — v2 upstream-bases regenerated from the lab's captured projections (documented fields only, upstream requiredness, upstream wire forms); every IS narrowing/extension relocated to the v2 is-overlays with convergence triggers; pure-`allOf` compositions; codegen validators + fixture corpora. `authoring/v1` remains byte-frozen. Per-contract detail is canonical in `schemas/authoring/v2/CHANGELOG.md`.
- **Prose-anchor validity gate** (PR #37): vendored 6767-h heading inventory + `check-prose-anchors` CI workflow failing the build on dangling `$comment` citations.
- **Changelog-observance gate** (PR #38): any `schemas/` change without a same-PR governing-CHANGELOG entry (with lineage reference) fails CI.

### Fixed

- `ScoringConfigSchema` mirrors the open-world JSON Schema (`.strict()` → `.passthrough()`); NORMATIVE `gate_reasons` non-empty rule for `{fail, advisory, error}` now enforced in both the JSON Schema and the Zod validator (PR #36).
- Predicate-namespace gate scans the whole `schemas/authoring` family; byte-freeze test covers all seven v1 authoring validator sources (PR #36).

## [0.5.0] - 2026-06-11

The **STRICT v2 authoring fork**. Lands `schemas/authoring/v2/skill-frontmatter` — the strict IS-marketplace contract that closes the 4 CCP-shadow frontmatter gaps — as a fresh, self-contained, **immutable fork** of v1 (copy-then-tighten, zero `$ref` into v1). Purely **additive**: a new export subpath `./schemas/authoring/v2/*` + `./validators/v1/authoring/v2`; no v1 import-meaning changes. SemVer MINOR. DR-049 + the CCP kernel-shadow finding. Lifecycle **SHIPPED-INTERNAL** (not canonical yet — canonical-promotion is gated on the DR-049 recall eval + corpus migration).

### Added

- **`schemas/authoring/v2/` STRICT authoring family** — `skill-frontmatter` ALONE is forked to v2 (the other 5 contracts stay at v1/SHIPPED-INTERNAL untouched, per DR-049 D-SAK-1: the permanent structure governs, it is not a clock to author all six). The v2 tree is a full self-contained mirror: `marketplace-tier.schema.json` (3 fold tightenings), `upstream-base/skill-frontmatter.v1.json` (byte-copy of v1 base modulo `$id`), `is-overlay/skill-frontmatter.v2.json` (v1 overlay + scoped-Bash narrowing), the composed `skill-frontmatter.schema.json` (pure `allOf` of the 3 v2 layers), `index.json`, `CHANGELOG.md`, and a non-normative `MIGRATION.md`. **Zero `$ref` into v1** — a `$ref` back into the frozen v1 family would let a future v1 patch silently mutate v2 and would make a stricter v2 fold inexpressible. Importable as `@intentsolutions/core/schemas/authoring/v2/<name>.schema.json` and via the Zod barrel `@intentsolutions/core/validators/v1/authoring/v2`.
- **The 4 v2 tightenings vs frozen v1** (each catches the kernel up to the CCP prose validator `validate-skills-schema.py`):
  - **Scoped-Bash** (is-overlay NARROW) — `allowed-tools` rejects a BARE unscoped `Bash` token in BOTH the string and array forms; only `Bash(scope:*)` is accepted (`Bashful` and any non-Bash token are fine). **Structurally JSON-Schema-expressible** (string-form negative `pattern` with token-boundary anchoring + array-form `not contains const`) — proven against ajv strict mode, so a plain ajv consumer AND the CCP kernel-shadow enforce it with **no Zod-only carve-out**. An `x-scoped-tool: "Bash"` annotation drives the matching Zod check for fold agreement.
  - **Shell-substitution widen** (securityChecks fold) — `description` rejects `$(` and backticks in addition to `${` and XML tags.
  - **Reserved-name hardening** (securityChecks fold) — `name` additionally rejects any name whose lowercase contains `claude` or `anthropic` as a SUBSTRING (per-letter char-class pattern; ECMA-262 has no `(?i)` inline flag). This is a genuine NEW rule, not a v1 bug: v1's exact-word enum (`skill`/`claude`/`anthropic`/`mcp`/`plugin`/`agent`) was a deliberate, internally consistent design that PASSED `claude-reflect`; the CCP prose validator (L1706) rejects the substring, so v2 adds the conjunct on top.
  - **Description cap 1024** (disclosureMarkers fold) — token budget lowered 1536 → 1024 chars (the agentskills.io documented soft cap + the CCP prose-validator ERROR cap).
- **v1 BYTE-FROZEN at `0.4.1`** — `schemas/authoring/v1/**` + `src/validators/v1/authoring/{skill-frontmatter,marketplace-tier}.ts` are byte-frozen and machine-enforced by a new test (`src/__tests__/authoring-v1-frozen.test.ts`) that git-diffs every frozen path against the `v0.4.1` tag and fails on any change. v1 stays the looser PUBLISHED contract (it accepts bare `Bash`, 1025–1536-char descriptions, `claude-reflect`, and `$(...)`/backtick descriptions forever).
- **Codegen parameterized by authoring family** (`scripts/codegen-authoring.ts`) — `ContractSpec` gained a typed `version: 'v1' | 'v2'` field; the schema-dir / validator-dir / overlay-file / header-path resolution derive from it, and a runtime write-guard refuses to emit any path under the frozen `schemas/authoring/v1/` tree (a v2-misroute-into-v1 guard). The codegen gained a keyword-driven scoped-tool emit path (feature-gated to the exact `x-scoped-tool` + `allOf[string|array]` shape, mirroring the existing kyh9 `x-mutually-exclusive-fields` carve-out pattern), generating `src/validators/v1/authoring/v2/skill-frontmatter.ts`. **The v1 generated output is byte-identical** — adding the v2 family does not perturb v1 codegen.

### Verification

- `pnpm run check` fully green: codegen idempotency (v1 + v2), predicate-namespace isolation, **DR-049 rubric-floor self-pin** (no required field removed — v2 NARROWS a type and ADDS fold conjuncts, never demotes a field; the floor guard reads v1 only and stays green), lint, typecheck, tests, arch (0 violations), boundaries (0 violations).
- **Monotonic-additive** property test — v2 rejects a strict SUPERSET of what v1 rejects: every v1-negative fixture is also v2-rejected, AND the 4 new violation classes are v1-ACCEPTED but v2-REJECTED (proving they are genuinely new tightenings).
- **ajv ↔ Zod fold agreement** for v2 on its fixtures — all 4 v2 rules are STRUCTURALLY enforced (scoped-Bash needs no Zod-only carve-out).
- **v1 byte-frozen** vs the `v0.4.1` tag (13 frozen paths) — machine-checked.
- 100% coverage floor held; `pnpm run build` + `api:check` + `test:types` + `harness:verify` pass.

## [0.4.1] - 2026-06-11

A **non-breaking relaxation** of the `skill-frontmatter` authoring contract's `allowed-tools` type. SemVer PATCH — purely widening; every artifact valid under `0.4.0` stays valid. Acting-CTO authorization.

### Changed

- **`schemas/authoring/v1/is-overlay/skill-frontmatter.v1.json` — `allowed-tools` now accepts a CSV/space-delimited string OR a YAML array** (non-breaking relaxation; faithful to the upstream prose spec + the published-plugin corpus; resolves the 23% CCP kernel-shadow deviation — 836/838 disagreements were this one field). The overlay type changed from `{"type":"array","items":{"type":"string"}}` to `{"anyOf":[{"type":"string"},{"type":"array","items":{"type":"string"}}]}`. This is a **SUPERSET** relaxation: array-authored skills stay valid AND string-authored skills now validate too. The upstream prose form is the agentskills.io EXPERIMENTAL space-separated string + Claude-docs `6767-h §3.1`, which the entire published-plugin corpus authors; the kernel previously narrowed to array-only, which the just-merged CCP kernel-shadow measured at **23.12% deviation against the published corpus (836/838 disagreements were this single field)**. `allowed-tools` stays **required** (the marketplace-required floor is untouched — DR-049 rubric-floor guard stays green); only the accepted *type* widened. A malformed value (number, null, object, array containing a non-string) still rejects.
- **`scripts/codegen-authoring.ts`** — extended keyword-driven (feature-gated to the exact `anyOf: [string, array-of-strings]` union via `isStringOrStringArrayAnyOf`) so the generated Zod validator (`src/validators/v1/authoring/skill-frontmatter.ts`) emits the combined `string | string[]` check. The other five contracts' generated output is **byte-identical** (no contract uses `anyOf`); codegen stays idempotent under `codegen:authoring:check`.

### Verification

- `pnpm run check` fully green: codegen idempotency, predicate-namespace isolation, **DR-049 rubric-floor self-pin** (no required field removed — the relaxation widens a type, never demotes a field), lint, typecheck, 526 tests, arch (0 violations), boundaries (0 violations).
- **Monotonicity property test** (the 2026-04-28-debacle guard) stays green — loosening an OVERLAY field's accepted type is a relaxation of the overlay, not a demotion of a base-required field; `name`/`description` base requirements and the IS 8-field effective-required set are unchanged.
- **ajv ↔ Zod fold-agreement** (the D8 40-fixture backstop) stays green for both the string and array forms; the corpus carries a CSV-string positive fixture (`positive/canonical-02.json`) and a malformed-type negative (`negative/type-allowed-tools.json`).
- 100% coverage floor held; `pnpm run build` + `api:check` + `harness:verify` pass; `pnpm pack` ships `schemas/authoring/v1/` (21 files) including the relaxed overlay.

## [0.4.0] - 2026-06-11

The **bicameral kernel** release. Lands the new `schemas/authoring/v1/` family alongside the unchanged `schemas/v1/` runtime family — the kernel now serves two chambers: runtime contracts (Evidence Bundle, gate-result/v1, the 13 entities) and authoring contracts (the Spec Authority Kernel surface that validates skills, plugins, agents, MCP configs, hooks, and marketplace catalogs). Purely **additive** — no `schemas/v1/` runtime contract is changed, renamed, or removed; every prior EvidenceBundle and gate-result/v1 row stays valid. SemVer MINOR. ISEDC Session 8 charter DR-044 (Spec Authority Kernel charter) + Session 9 charter DR-049 (kernel-hardening gates). Acting-CTO publish authorization.

### Added

- **`schemas/authoring/v1/` bicameral authoring-contract family** (DR-044 D7/D8). Six per-contract schemas, each composed as an `allOf` of an upstream-base layer (authored by the open standard), the three universal folds (`deprecationRegistry`, `securityChecks`, `disclosureMarkers`), and an is-overlay layer (authored by IS). Each contract is importable as `@intentsolutions/core/schemas/authoring/v1/<name>.schema.json` and via its Zod validator under `@intentsolutions/core/validators/v1/authoring`:
  - **`skill-frontmatter`** — contract #1, the walking skeleton. **STABLE — promoted to `lifecycle: "PUBLISHED"`** (deepest upstream capture; the stable, consumer-endorsed contract). Upstream sources: agentskills.io specification + code.claude.com/docs/en/skills (per `6767-b §4`).
  - **`plugin-manifest`** — contract #2, EXPERIMENTAL (`lifecycle: "SHIPPED-INTERNAL"`). Upstream source: code.claude.com/docs/en/plugins-reference.
  - **`agent-definition`** — contract #3, EXPERIMENTAL (`lifecycle: "SHIPPED-INTERNAL"`). Upstream source: code.claude.com/docs/en/sub-agents.
  - **`mcp-config`** — contract #4, EXPERIMENTAL (`lifecycle: "SHIPPED-INTERNAL"`). Upstream sources: modelcontextprotocol.io/specification (2025-11-25) + code.claude.com/docs/en/mcp.
  - **`hook-config`** — contract #5, EXPERIMENTAL (`lifecycle: "SHIPPED-INTERNAL"`). Upstream sources: code.claude.com/docs/en/hooks + code.claude.com/docs/en/settings.
  - **`marketplace-catalog`** — contract #6, EXPERIMENTAL (`lifecycle: "SHIPPED-INTERNAL"`). Upstream sources: code.claude.com/docs/en/plugin-marketplaces + anthropics/claude-plugins-official.
- **Single-source authoring codegen** (`pnpm run codegen:authoring`, DR-044 D8) — generates each contract's composed `*.schema.json` (with the effective-required `$comment` manifest) and its Zod validator from the two composed layers, so the upstream-base + is-overlay are the single source of truth. Idempotent; the `codegen:authoring:check` gate (in `pnpm run check`) fails on stale generated output.
- **Three DR-049 kernel-hardening CI gates** (wired into `pnpm run check` + `ci.yml`):
  - **predicate-namespace isolation** (`scripts/check-predicate-namespace-isolation.ts`) — fails if any `schemas/authoring/v1/**` field, `$comment`, or `$id` references the `evals.intentsolutions.io` predicate namespace. Authoring conformance is a deterministic lint, never a signed attestation; the two namespaces stay isolated.
  - **rubric-floor self-pin** (`scripts/check-rubric-floor.ts`) — fails if a required field is removed or weakened from any contract's marketplace (is-overlay) required set or the `securityChecks` fold without an explicit `RUBRIC-FLOOR-ADR:` marker. Self-pinned in `.harness-hash` (via `.harness-hash-extra-patterns`) so the guard cannot be weakened in the same PR that weakens the floor.
  - **predicate-comment coherence** (`src/__tests__/authoring-comment-coherence.test.ts`, runs under `pnpm run test`) — mechanically verifies each contract's generated `$comment` effective-required manifest agrees with the schema's actual ajv accept/reject on the canonical fixtures (drop-one coherence) and with the validator's required constants. Proven non-vacuous by mutation.

### Lifecycle posture

- **`skill-frontmatter` is STABLE/published** (`lifecycle: "PUBLISHED"` in `schemas/authoring/v1/index.json`, CFO binding under acting-CTO sign-off) — endorsed as the stable, consumer-endorsed authoring contract.
- **Contracts #2–#6 (`plugin-manifest`, `agent-definition`, `mcp-config`, `hook-config`, `marketplace-catalog`) ship in the package but are EXPERIMENTAL** (`lifecycle: "SHIPPED-INTERNAL"`). Their `authoring/v1` stability is **pending the vendored deep-capture + the § 14.A policy-eval refinement** (planned for a future minor) before they are endorsed as stable. Treat their shape as subject to change.

### Unchanged

- The `schemas/v1/` runtime family (Evidence Bundle, `gate-result/v1`, the 13 canonical entities, and all v0.1–v0.3 predicate bodies) is **untouched**. No runtime contract is changed, renamed, or removed.

### Cross-references

- DR-044 (ISEDC Session 8 — Spec Authority Kernel charter): `intent-eval-lab/000-docs/044-AT-DECR-isedc-council-session-8-sak-charter-2026-06-09.md`.
- DR-049 (ISEDC Session 9 — kernel-hardening gates + lifecycle binding): the predicate-namespace isolation, rubric-floor self-pin, and predicate-comment coherence gates plus the `skill-frontmatter` PUBLISHED / contracts #2–#6 SHIPPED-INTERNAL lifecycle posture.
- Engineering beads: `bd_000-projects-3kye` (.5/.6/.7 DR-049 gates) + `bd_000-projects-kyh9`.

### Breaking changes

- None. New `schemas/authoring/v1/` exports + new CI gates only; the runtime surface is byte-stable.

## [0.3.1] - 2026-06-08

Release-engineering patch. **No API or schema change** — the published package is byte-identical to v0.3.0 (the fixes are CI-only). Its purpose is to emit a **dashboard-verifiable** evidence manifest, closing the loop with the intent-eval-dashboard ingest.

### Fixed

- `release.yml` emit-evidence now creates the GitHub Release if absent before uploading `report-manifest.json` (v0.3.0's emit failed "release not found" — the workflow only published to npm, never created a Release object).
- `cosign sign-blob --new-bundle-format` so the signed evidence bundle is the sigstore protobuf Bundle (`verificationMaterial` + `messageSignature`) the dashboard's `sigstore.verify()` consumes — v0.3.0 emitted the legacy `{base64Signature, cert, rekorBundle}` shape, which sigstore-js cannot parse.

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
