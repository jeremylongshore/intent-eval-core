# Release Report — `@intentsolutions/core` v0.1.0

**Type:** After-Action Report (AACR)
**Date:** 2026-05-17
**Release type:** MINOR (0.0.0 → 0.1.0) — first public release
**Approved by:** Jeremy Longshore
**Repo:** [`jeremylongshore/intent-eval-core`](https://github.com/jeremylongshore/intent-eval-core)
**Package:** [`@intentsolutions/core@0.1.0`](https://www.npmjs.com/package/@intentsolutions/core)

---

## Executive summary

First public release of the canonical contracts kernel for the Intent Eval Platform. Ships pure TypeScript types, JSON Schemas, and opt-in Zod validators for the 13 canonical platform entities + the `gate-result/v1` NORMATIVE in-toto predicate body per Blueprint B § 7.4. Published from CI with sigstore provenance.

**Scope context:** v0.1.0 closes **five epics** authored across a single multi-session sprint:

| Epic | Result |
|---|---|
| `iec-E01` — Repo scaffold | ✓ |
| `iec-E02` — 13 TS entities + `gate-result/v1` + IS Testing SOP | ✓ |
| `iec-E03` — JSON Schemas (draft 2020-12) | ✓ |
| `iec-E04` — Zod runtime validators | ✓ |
| `iec-E09` — NPM publishing + adoption guide | ✓ |

---

## Pre-release state

### PRs

- 0 open PRs at release time
- 0 merged into the release (single-author sprint; all work landed directly on `main` with branch-protection admin-bypass during pre-1.0 scaffold phase per `bd_000-projects-8t7m`)

### Working tree

- Clean
- 0 stashes
- 0 unpushed commits

### Security

- 0 secrets detected in `src/`
- 0 prod vulnerabilities (`pnpm audit --prod`)
- 2 moderate dev-only vulnerabilities (vite + esbuild via vitest transitive) — not in published tarball, monitored

### Beads

- 0 in-progress at release time
- 5 epics + their children closed during the sprint
- 8 deferral beads filed during the sprint (tracked for post-1.0 follow-up)

---

## Changes included

### Added — public surface

- **13 canonical entity TS interfaces** per Blueprint B § 2:
  `EvalSpec`, `EvalRun`, `MatcherMap`, `EvidenceBundle`, `JudgeDecision`, `RuntimeReceipt`, `RegressionPack`, `RolloutGate`, `SkillSnapshot`, `SessionTrace`, `ToolInvocation`, `CostRecord`, `FailureTaxonomy`
- **`gate-result/v1` NORMATIVE in-toto predicate body** per Blueprint B § 7.4 — first predicate URI with normative SPEC; URI `https://evals.intentsolutions.io/gate-result/v1`
- **10 branded primitive types**: `Uuidv7`, `Sha256`, `Sha256Prefixed`, `Rfc3339`, `SemVer`, `KebabSlug`, `MicroUsd`, `StorageKey`, `OtelSpanId`, `ActorIdentity`
- **State-machine transition maps** for 10 entities with lifecycles, plus `canTransition` helper
- **13 JSON Schema definitions** at `schemas/v1/` (draft 2020-12)
- **15 Zod runtime validators** (`./validators/v1/*`) — tree-shakable subpath exports; branded primitives mirror TS brands; `superRefine` enforcement of § 7.4 `advisory_severity` conditional rule

### Added — infrastructure

- IS Testing SOP install (`@intentsolutions/audit-harness@0.1.0`, husky pre-commit, dependency-cruiser 17 with 8 forbidden architecture rules)
- CI workflow (`.github/workflows/ci.yml`) — 9-step gate chain: harness:verify, lint, typecheck, arch, test, test:coverage, build, test:types, dist artifact verification
- Release workflow (`.github/workflows/release.yml`) — tag-triggered, sigstore provenance via `pnpm publish --provenance`, tag-vs-package version drift guard
- ERD-walk integration test locking every Blueprint B § 6.2 cross-entity invariant
- `tests/{TESTING,RTM,PERSONAS,JOURNEYS}.md` scaffolds — 24 REQs, 4 personas, 3 journeys, all kernel-owned steps tested
- `CHANGELOG.md` with v0.1.0 surface + adoption guide

### Architectural bindings

- **DR-010** (ISEDC Session 4 widened-scope lock) — governance binding
- **Blueprint A** (Ecosystem Master Blueprint) — 12 binding principles, kernel-only anti-goals
- **Blueprint B** (Platform Runtime Blueprint) — runtime architecture, 13-entity domain model, `gate-result/v1` NORMATIVE spec
- **Blueprint C** (Repo Blueprint Template) — applied per `iec-E10` (forthcoming)
- **Canonical Glossary** — single source of truth for platform terminology

### Breaking changes

- N/A (first public release)

---

## Documentation updates

### CHANGELOG.md

- New v0.1.0 section with full surface listing + architectural bindings + adoption guide

### README.md

- Renamed header from old dir name to package name (`@intentsolutions/core`)
- Added 4 status badges (npm version, CI, License, Provenance)
- Added `## Install` section with pnpm commands for types-only vs validators
- Added quick import-surface example block (types, schemas, validators, state machines)
- Status updated from "scaffold" to "v0.1.0 shipped"

### Docs sweep (`/validate-consistency` findings)

| Drift | Severity | Resolution |
|---|---|---|
| `README.md:79` — "This repo is at epic iec-E01 (scaffold)" | 🟡 Warning | FIXED — replaced with v0.1.0 shipped + closed-epic list |
| `tests/TESTING.md:99` — "tsd planned" | 🟡 Warning | FIXED — replaced with "tsd installed + wired" |

All other consistency checks PASSED:
- Version: package.json 0.1.0 = CHANGELOG 0.1.0 = git tag v0.1.0 = README v0.1.0
- License: Apache-2.0 across package.json + LICENSE + README badge
- Repo URL: package.json `repository.url` matches git remote
- Capability claims: README's 13-entity claim matches actual entity files
- Cross-doc facts: no contradictions
- Broken refs: none

---

## Quality posture at release

| Gate | Result |
|---|---|
| `pnpm run lint` | ✓ |
| `pnpm run typecheck` | ✓ |
| `pnpm run arch` (dependency-cruiser, 8 forbidden rules) | ✓ 0 violations |
| `pnpm run test` (vitest) | ✓ 154 tests across 8 files |
| `pnpm run test:coverage` (vitest c8) | ✓ 100% line/branch/function/statement |
| `pnpm run test:types` (tsd against published `dist/`) | ✓ ~80 negative-test assertions |
| `pnpm run build` (TypeScript) | ✓ dist artifacts emit cleanly |
| Schema validation tests (ajv draft 2020-12) | ✓ 31 tests (16 positive + 4 negative + 7 cross-cutting + 4 structural) |
| Zod validator tests | ✓ 31 tests |
| `pnpm run harness:verify` (hash-pinned policy) | ✓ |
| Release CI (`.github/workflows/release.yml`) | ✓ green in 38s |
| Sigstore provenance | ✓ 1 signature on dist tarball |

---

## Metrics

| Metric | Value |
|---|---|
| Commits since initial scaffold | 24 |
| Files in published tarball | 159 |
| Tarball size | ~280 KB unpacked |
| Source files in `src/` | 30 |
| JSON Schemas | 16 (13 entity + 1 predicate + 1 common + 1 index) |
| Zod validators | 16 (15 schema-mirroring + 1 primitives + 1 index) |
| TS entity interfaces | 14 (13 entities + barrel) |
| Test files | 8 |
| Total assertions | 154 vitest + ~80 tsd + 31 ajv + 31 Zod ≈ 295 |
| Lines added | ~12,600 |
| Test:source ratio | high (test files exceed entity files; multiple test layers) |
| CI run time (release workflow) | 38s |

---

## Three-layer mirror

Per umbrella `intent-eval-platform/CLAUDE.md` discipline, every epic carries cross-references in all three layers:

| Epic | Bead | GH | Plane |
|---|---|---|---|
| iec-E01 | `bd_000-projects-3mv` | `intent-eval-core#1` (closed) | LAB-82 (Done) |
| iec-E02 | `bd_000-projects-3sj` | `#2` (closed) | LAB-83 (Done) |
| iec-E03 | `bd_000-projects-u2y` | `#3` (closed) | LAB-84 (Done) |
| iec-E04 | `bd_000-projects-10n` | `#4` (closed) | LAB-85 (Done) |
| iec-E09 | `bd_000-projects-00t` | `#5` (closed) | LAB-86 (Done) |

---

## Deferral beads filed during the sprint

8 architectural deferrals captured for post-1.0 follow-up:

| Bead | Title | Priority | Trigger to act |
|---|---|---|---|
| `bd_000-projects-gzgj` | iec-deferral-A: AssertionExpression typed-class enum | P1 | Class-2 ISEDC pair DR needed before enumeration |
| `bd_000-projects-k0fj` | iec-deferral-G: tenant_id reservation (Architect W1) | P1 | ISEDC decision: reserve now (cheap) or decline (explicit) |
| `bd_000-projects-8t7m` | iec-tighten-branch-protection (flip enforce_admins=true) | P1 | NOW (scaffold phase complete) |
| `bd_000-projects-21re` | iec-deferral-C: ScoringConfig fields beyond aggregation_rule | P2 | ISEDC review before any addition |
| `bd_000-projects-3sjx` | iec-deferral-F: CompositionDag wire format normative spec | P2 | Downstream consumer needs the format locked |
| `bd_000-projects-84li` | iec-deferral-E: ToolInvocationError.enum_class registry | P2 | Multi-tool deployment encounters class collisions |
| `bd_000-projects-9xyk` | iec-deferral-D: gate-result/v1 coverage element shape lockup | P2 | Consumer wants richer per-dimension metadata |
| `bd_000-projects-ra9a` | iec-deferral-B: MatcherInputPattern.structural payload spec | P2 | Engagement defines a structural matcher |
| `bd iel-link-schemas-to-kernel` | Lab-side: symlink `intent-eval-lab/specs/.../schema/` → kernel | P1 | NOW (cross-repo, lab-side session) |

---

## Release artifacts

| Artifact | Location |
|---|---|
| npm tarball | https://registry.npmjs.org/@intentsolutions/core/-/core-0.1.0.tgz |
| npm package page | https://www.npmjs.com/package/@intentsolutions/core |
| GH release | https://github.com/jeremylongshore/intent-eval-core/releases/tag/v0.1.0 |
| Git tag | `v0.1.0` at commit `c9b9f75` |
| CI publish run | https://github.com/jeremylongshore/intent-eval-core/actions/runs/26002217507 |
| Sigstore provenance | Embedded in tarball; verify via `npm audit signatures @intentsolutions/core` |

---

## Adoption — downstream consumers

Three sibling platform repos consume this kernel. Per the bead's "hand-migration acceptable" acceptance, no automated codemod ships in v0.1.0. The migration recipe lives in `CHANGELOG.md § Adoption notes` and the GH release notes.

| Sibling repo | Tracking bead | Migration shape |
|---|---|---|
| `audit-harness` | `iah-E02` — Import @intentsolutions/core types | Replace local gate-result types with `GateResultV1Schema`; brand existing identifier strings via Zod parsers; emit signed rows whose predicate body satisfies the schema |
| `j-rig-skill-binary-eval` | `iaj-E02` — Migrate @j-rig/core schemas → @intentsolutions/core | Move existing entity types into this package; map UPPERCASE `JudgeVerdict` → lowercase `RolloutGateDecision` through the `@j-rig/rollout-gate` policy translator |
| `intent-rollout-gate` | (forthcoming) | Replace local schema definitions with the canonical `GateResultV1Schema`; verify DSSE signatures externally; apply consumer-side policy from `tests/TESTING.md` per § 7.6 architectural separation |

---

## What did NOT go in v0.1.0

By design — these belong in later epics:

- `iec-E05` — Lifecycle state machines (the kernel ships transition maps; richer state-machine framework deferred)
- `iec-E06` — UUID + event ID standards (kernel uses UUIDv7 with regex validation; standardization deferred)
- `iec-E07` — SemVer regression test suite (manual SemVer discipline at v0.1; automation deferred)
- `iec-E08` — Pydantic codegen + Python distribution (JS-first release; Python kernel deferred)
- `iec-E10` — Per-repo Blueprint C application (the repo follows Blueprint C in spirit but the explicit application doc is deferred)
- `iec-E11` — Boundary enforcement (FORBIDDEN/ALLOWLIST/CODEOWNERS/pre-commit/CI) — partial coverage via current dep-cruiser rules; full boundary enforcement deferred
- `iec-E12` — Testing SOP + CI/CD + multi-target release pipeline (CI + release pipeline shipped; multi-target = post-v1)

---

## Rollback procedure

If v0.1.0 surfaces a blocking defect, the rollback path:

```bash
# 1. Mark v0.1.0 deprecated on npm
npm deprecate '@intentsolutions/core@0.1.0' 'Deprecated due to <reason>; use 0.1.1+ instead'

# 2. Tag the fix as v0.1.1
git tag -a v0.1.1 -m "Release v0.1.1 — fix for <reason>"
git push origin v0.1.1
# (release.yml fires, publishes 0.1.1, latest auto-points to 0.1.1)

# Note: npm packages cannot be UNPUBLISHED after 72 hours.
# Deprecation is the supported recovery path.
```

For pre-72-hour catastrophic issues (secret leak, malware), `npm unpublish @intentsolutions/core@0.1.0` is available — but treat as last resort because it breaks every consumer that already pinned the version.

---

## Post-release checklist

- [x] Tag pushed locally + remote
- [x] CI publish workflow green
- [x] npm package verified live (`npm view`)
- [x] Sigstore provenance signature present
- [x] GH release page created with rich notes
- [x] CHANGELOG.md committed + pushed
- [x] README install block + badges added
- [x] All 5 epics' three-layer mirror closed (bead ↔ GH ↔ Plane)
- [x] `/validate-consistency` post-release sweep + 2 drift fixes
- [x] `/security-review` against published surface — clean
- [x] AAR document (this file) committed to `000-docs/`
- [ ] Umbrella `intent-eval-platform/CLAUDE.md` updated to reference v0.1.0 (next)
- [ ] Sibling-repo migration beads primed with concrete content (next)
- [ ] Branch protection `enforce_admins` flipped to `true` for post-scaffold posture (per `bd_000-projects-8t7m`)
- [ ] Monitor npm download / consumer issues for 1 week

---

## References

- Sprint plan: `~/.claude/plans/se-the-council-bubbly-frog.md`
- Epic + bead plan v2.1: `~/.claude/plans/se-the-council-bubbly-frog-epics-and-beads-for-review-v2.1.md`
- Umbrella governance: `intent-eval-platform/CLAUDE.md`
- IS Testing SOP: `~/000-projects/CLAUDE.md § Intent Solutions Testing SOP`
- Phase A foundation (on intent-eval-lab main): DR-010, Blueprint A/B/C, Canonical Glossary

— Jeremy Longshore
intentsolutions.io
