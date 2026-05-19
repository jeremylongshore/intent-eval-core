# TEST_AUDIT.md — `@intentsolutions/core`

**Audit run date:** 2026-05-19
**Auditor:** `/audit-tests` skill (Claude Code), grounded in `~/.claude/skills/audit-tests/`
**Auditor harness version:** `@intentsolutions/audit-harness@0.1.0` (latest at audit time)
**Repo classification:** `library` (TypeScript, pure-type kernel + opt-in Zod validators)
**Branch at audit:** `main` @ commit `7441221`

---

## Executive summary

**Grade: A** — all required layers installed and enforced. The kernel exceeds the minimum bar for a library: 100% test coverage, 0 architecture violations across 8 forbidden dep-cruiser rules + 4-axis boundary checker, dual type-test discipline (vitest `expectTypeOf` in-process + `tsd` separate process), sigstore-signed npm publishing.

The repo passes IS Testing SOP at the highest standard appropriate to its type. The /audit-tests verdict is **no P0 / no P1 gaps**; the remaining items in the "what's not done" section below are explicitly waived for a pure-type library per [`tests/TESTING.md § Waived gates`](tests/TESTING.md).

---

## Classification

| Field | Value |
|---|---|
| Repo type | `library` |
| Sub-classification | Pure-type kernel + opt-in runtime validator subpath |
| Language | TypeScript 5 (strict + every additional strict flag) |
| Module system | ESM only (`"type": "module"`) |
| Runtime | Node 20+ / pnpm 9+ |
| Public-surface posture | Types-only main entry (zero runtime cost); `zod` runtime dep loads only when consumer imports the validators subpath |
| Compliance overlay | none |

---

## 7-layer taxonomy results

| Layer | Status | Detail |
|---|---|---|
| **L0** — Enforcement harness | ✅ INSTALLED | `@intentsolutions/audit-harness@0.1.0` as devDep; `pnpm exec audit-harness verify` + `init` + `arch` + `escape-scan` all wired |
| **L1** — Git hooks + CI enforcement | ✅ INSTALLED | husky pre-commit (escape-scan + boundaries + lint-staged); GitHub Actions CI (`lint + typecheck + test + build` REQUIRED check) + dedicated boundary-check workflow |
| **L2** — Static analysis + linting | ✅ INSTALLED | ESLint 9 flat config (typed lint via `projectService`, `no-explicit-any: error`, type-imports enforced); Prettier 3; TypeScript 5 with ALL strict flags including `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature` |
| **L3** — Unit + function tests | ✅ INSTALLED, OVER-INDEXED | vitest 2 (runtime + `expectTypeOf` type-level); **154 tests across 8 files**; **100% line/branch/function/statement coverage** enforced via `vitest.config.ts`; `tsd@0.33` second-opinion type-test with ~80 negative-test assertions against published `dist/` |
| **L4** — Integration + regression — architecture rules | ✅ INSTALLED | dependency-cruiser 17 with 8 forbidden rules (`no-circular`, `no-orphans`, `no-deprecated-core`, `kernel-no-runtime-deps`, `validators-only-import-zod`, `predicates-no-entities`, `no-test-imports-in-src`, `state-machines-pure`); 0 violations. PLUS new 4-axis boundary checker (`scripts/check-boundaries.ts`) covering package patterns, import paths, directory names, npm categories, URL patterns; 0 violations |
| **L4** — Integration (DB / IO / contract) | WAIVED | Pure-type library — no IO, no DB, no migrations, no external contracts to test. `tests/TESTING.md § Waived gates` documents the rationale. |
| **L5** — System quality (perf / sec / a11y / chaos) | WAIVED | No runtime to perf-test; no UI to a11y-test; security covered by L2 + escape-scan + boundary checker URL-pattern axis. |
| **L6** — E2E / BDD / Gherkin | WAIVED | Library, not service — no user journey to E2E. Consumers (audit-harness, j-rig, intent-rollout-gate) own their own BDD. |
| **L7** — Acceptance / UAT | WAIVED | Library, not product — acceptance lives at the consumer level. |

### Additional test layers shipped (above the canonical 7)

| Layer | Status | Detail |
|---|---|---|
| **Schema validation** | ✅ INSTALLED | 31 ajv-based JSON Schema validation tests (draft 2020-12) against 16 positive + 4 negative golden fixtures + 7 cross-cutting Blueprint B invariants codified at the schema layer |
| **Validator parity** | ✅ INSTALLED | 31 Zod validator tests proving the hand-authored validators agree with ajv schema validators on the same fixtures |
| **Full ERD-walk integration** | ✅ INSTALLED | `src/integration.test.ts` constructs all 13 entities + gate-result/v1 + DSSE Statement end-to-end; locks every Blueprint B § 6.2 cross-entity invariant |
| **Type-level integration** | ✅ INSTALLED | tsd negative tests in `test-d/*.test-d.ts` proving brand non-interchangeability, state literal closed-set discipline, JudgeVerdict vs GateDecision distinctness, GateResultV1 required-field discipline |

---

## Test totals

| Metric | Value |
|---|---|
| Test files | 8 (vitest) + 3 (tsd test-d) = 11 |
| Vitest assertions | 154 across 8 files |
| Tsd negative assertions | ~80 |
| ajv schema validation tests | 31 |
| Zod validator tests | 31 |
| **Total test/assertion count** | ~295 |
| Coverage (lines) | 100% |
| Coverage (branches) | 100% |
| Coverage (functions) | 100% |
| Coverage (statements) | 100% |

---

## Architecture rules

dep-cruiser config at `.dependency-cruiser.cjs`, hash-pinned via `.harness-hash`. Per-rule status on current `main`:

| Rule | Severity | Status |
|---|---|---|
| `no-circular` | error | 0 violations |
| `no-orphans` | warn | 0 |
| `no-deprecated-core` | warn | 0 |
| `kernel-no-runtime-deps` | error | 0 (carve-out for `src/validators/` via negative lookahead `^src/(?!validators/)`) |
| `validators-only-import-zod` | error | 0 |
| `predicates-no-entities` | error | 0 |
| `no-test-imports-in-src` | error | 0 |
| `state-machines-pure` | error | 0 |

Plus the new 4-axis boundary checker (`scripts/check-boundaries.ts`):

| Axis | Status |
|---|---|
| A1 Package patterns | 1 runtime dep (zod), well below cap of 8; 0 forbidden-pattern matches |
| A2 Import paths | 0 forbidden src/ subpaths; all 8 allowed subpaths recognized |
| A3 Directory names | 0 forbidden top-level dirs; all 21 allowed top-level files recognized |
| A4 Package categories | informative-only at v0.1 (npm-keyword heuristic) |
| URL patterns | 0 `labs.intentsolutions.io` usage as a real URL (test-assertion safety-net excluded) |

---

## Gaps

**0 P0 gaps · 0 P1 gaps.**

P2 deferrals (intentional, tracked):

| Item | Bead | Why deferred |
|---|---|---|
| Pydantic codegen + Python distribution | `iec-E08` | v0.x is JS-first; Python kernel deferred to v0.3+ after Phase B kickoff |
| Rust crate distribution | (not yet beaded) | Post-Pydantic; surface via Class-2 governance when triggered |
| Mutation testing | n/a — WAIVED for pure-type library | Mutations on `as const` arrays + type definitions don't add signal |
| CRAP score | n/a — WAIVED | No algorithmic complexity to score in pure-type code |
| Bias-count | n/a — WAIVED | No BDD scenarios |
| Gherkin-lint | n/a — WAIVED | No `.feature` files |
| Property-based testing | n/a — informative-only | Could land when a runtime-effective opportunity emerges (e.g., Pydantic cross-language fuzz post-iec-E08) |

P2 architectural deferrals (filed during the v0.1.0 sprint):

| Bead | Title |
|---|---|
| `bd_000-projects-gzgj` | iec-deferral-A: AssertionExpression typed-class enum (Class-2 ISEDC) |
| `bd_000-projects-k0fj` | iec-deferral-G: tenant_id reservation (Architect W1) |
| `bd_000-projects-21re` | iec-deferral-C: ScoringConfig fields beyond aggregation_rule |
| `bd_000-projects-3sjx` | iec-deferral-F: CompositionDag wire format normative spec |
| `bd_000-projects-84li` | iec-deferral-E: ToolInvocationError.enum_class registry |
| `bd_000-projects-9xyk` | iec-deferral-D: gate-result/v1 coverage element shape lockup |
| `bd_000-projects-ra9a` | iec-deferral-B: MatcherInputPattern.structural payload spec |

---

## RTM / Personas / Journeys

| Artifact | Source of truth | State |
|---|---|---|
| `tests/RTM.md` | 24 REQ-IEC-NNN requirements derived from DR-010 + Blueprints A/B/C + Glossary + IS Testing SOP + standards-body discipline | All MUSTs covered; all SHOULDs covered; COULDs tracked as deferral beads (above) |
| `tests/PERSONAS.md` | 4 downstream-consumer personas (audit-harness, j-rig, intent-rollout-gate, methodology authors) | 100% key-flow coverage on the 3 runtime-consumer personas; methodology-author persona is non-runtime |
| `tests/JOURNEYS.md` | 3 type-level journeys (full ERD walk, NEW MM-class lifecycle, gate-result/v1 consumer parse) | All kernel-owned steps tested; runtime-owned steps marked as downstream concerns |

---

## escape-scan result

Run: `pnpm exec audit-harness escape-scan --staged`
Result: **PASS** (0 REFUSE, 0 CHALLENGE, 0 FLAG)

Hash-pin manifest at `.harness-hash` covers `.dependency-cruiser.cjs`. Future iteration: add FORBIDDEN.md + ALLOWLIST.md + CODEOWNERS + tests/TESTING.md to the harness pin set (upstream harness package will need a config option to expand the default pin set).

---

## CI gate chain

`.github/workflows/ci.yml` (required status check on main):

1. `pnpm install --frozen-lockfile`
2. `pnpm run harness:verify` (hash-pinned policy verification)
3. `pnpm run lint` (ESLint)
4. `pnpm run typecheck` (tsc --noEmit)
5. `pnpm run arch` (dependency-cruiser via audit-harness)
6. `pnpm run test` (vitest run)
7. `pnpm run test:coverage` (100% floor enforced)
8. `pnpm run build` (tsc -p tsconfig.build.json)
9. `pnpm run test:types` (tsd against published dist/)
10. Verify dist artifacts present (index.js + index.d.ts + validators + schemas)

`.github/workflows/boundary-check.yml` (additional separate workflow):

1. `pnpm run boundaries` (4-axis check)
2. Post PR comment on failure with override-detection from PR body

`.github/workflows/release.yml` (tag-triggered):

1. Full CI gate re-runs
2. Tag-vs-package version drift guard
3. `pnpm publish --provenance` (sigstore-keyless via GH OIDC — npm provenance flow)
4. Sigstore attestation attached to npm tarball; verifiable via `npm audit signatures @intentsolutions/core`

**Sigstore signing approach**: npm provenance IS the canonical sigstore-keyless OIDC flow for npm-published packages. Adding a separate `cosign sign-blob` step would only be useful for non-npm artifacts (e.g., a Rust crate or Python wheel at iec-E08). For the current JS-only kernel, npm provenance covers the cosign-keyless requirement of iec-E12f end-to-end.

---

## Recommendations

**No P0/P1 gaps.** The audit verdict is "no remediation required."

Future ratchet-ups (P2, tracked as `iec-E07/E08`):

1. SemVer regression test suite (`iec-E07`) — automated suite that catches MAJOR-bump-worthy changes BEFORE they merge, by detecting changes to the § 6.6 stability promise items in the per-repo blueprint
2. Pydantic codegen + Python distribution (`iec-E08`) — when Phase B kickoff signal arrives, JSON Schema → Pydantic models → PyPI

---

## Audit history

| Run date | Auditor | Branch | Verdict |
|---|---|---|---|
| 2026-05-16 | Inline during iec-E02e | feat branch | Initial install + scaffolds; 0 P0/P1 gaps post-install |
| 2026-05-19 | Formal `/audit-tests` (this report) | main @ 7441221 | Grade A; 0 gaps; ratify-and-close |
