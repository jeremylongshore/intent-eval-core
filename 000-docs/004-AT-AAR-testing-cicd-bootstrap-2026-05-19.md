---
title: After-Action Report — Testing SOP + CI/CD + Multi-Target Release Pipeline (iec-E12)
date: 2026-05-19
authors:
  - Jeremy Longshore (Intent Solutions)
status: AAR (informational)
binding_authority: iec-E12
related_drs:
  - intent-eval-lab/000-docs/010-AT-DECR-isedc-council-session-4-widened-scope-2026-05-13.md (DR-010)
filing_standard: Document Filing Standard v4.3
---

# AAR — Testing SOP + CI/CD + Multi-Target Release Pipeline (iec-E12)

## Executive summary

iec-E12 is largely a **ratify-and-close** epic. Its 7 sub-bead deliverables substantially landed during three prior epics (`iec-E02e` Testing SOP install; `iec-E09` NPM publishing; `iec-E11` boundary enforcement). This AAR ratifies what shipped, formalizes the audit artifact, and ties off the final task (boundary-check as required status check).

| Sub-bead | Acceptance criterion | Where it landed |
|---|---|---|
| **E12a** `/repo-dress --fill-gaps` pass | Repo is fully dressed; all 21 governance files present | Confirmed in § Governance file inventory below |
| **E12b** Install audit-harness + commit TESTING.md + .harness-hash | `@intentsolutions/audit-harness@0.1.0` devDep; tests/TESTING.md; .harness-hash pinning .dependency-cruiser.cjs | iec-E02e (commit `7f928d4`, refined in `3dd9c03`) |
| **E12c** Run `/audit-tests` → TEST_AUDIT.md | Audit ran; report committed | Inline audit happened during iec-E02e; formal TEST_AUDIT.md committed in this PR |
| **E12d** Run `/implement-tests` → stage gap-fill | All identified gaps closed; CI gate chain green | iec-E02e (commit `7f928d4`) |
| **E12e** Release pipeline: tag → npm publish + sigstore sign | `.github/workflows/release.yml` with `pnpm publish --provenance`; sigstore provenance verified on npm | iec-E09 (commit `c9b9f75`, release run `26002217507`) |
| **E12f** sigstore signing config (cosign keyless via GH OIDC) | OIDC-based sigstore signing in place | iec-E09 — npm provenance IS the canonical sigstore-keyless OIDC flow for npm packages; explanation in § Sigstore signing posture below |
| **E12g** Branch protection: required checks after 3 green days | Boundary-check added to required status checks | This PR — first action after the 3rd green day on `boundary-check.yml` |

## Governance file inventory (E12a confirmation)

The repo at commit `7441221` has **22 governance + policy + spec artifacts**. Inventory below (against the canonical `/repo-dress` 21-file template; this repo exceeds the floor by 1 because of the dual NORMATIVE docs at `002-AT-ARCH` + `003-AT-STND`):

### Repo-root governance (12 files)

| File | Purpose |
|---|---|
| `LICENSE` | Apache 2.0 |
| `README.md` | Package overview, install, import surface |
| `CHANGELOG.md` | Keep a Changelog format; v0.1.0 + Unreleased sections |
| `CODEOWNERS` | PR review routing (narrowed per iec-E11) |
| `FORBIDDEN.md` | 4-axis boundary forbidden set (machine-readable) |
| `ALLOWLIST.md` | Runtime + devDep + top-level files allowed set (machine-readable) |
| `CLAUDE.md` | Claude-Code-specific guidance (incl. operational rules + anti-goals) |
| `AGENTS.md` | Vendor-neutral cross-CLI agent contract |
| `.gitignore` | Standard ignore patterns |
| `.harness-hash` | Hash-pin manifest |
| `.dependency-cruiser.cjs` | Architecture rule config (hash-pinned) |
| `TEST_AUDIT.md` | Audit report (this PR adds it) |

### Per-repo NORMATIVE docs (2 files)

| File | Purpose |
|---|---|
| `000-docs/002-AT-ARCH-repo-blueprint-2026-05-18.md` | NORMATIVE per-repo blueprint applying Blueprint C |
| `000-docs/003-AT-STND-core-repo-boundaries-2026-05-18.md` | NORMATIVE boundary doctrine |

### Per-repo informational docs (3 files)

| File | Purpose |
|---|---|
| `000-docs/000-INDEX.md` | Index |
| `000-docs/001-AA-AACR-release-v0.1.0-2026-05-17.md` | v0.1.0 release AAR |
| `000-docs/004-AT-AAR-testing-cicd-bootstrap-2026-05-19.md` | This file |

### Engineering policy + traceability (5 files)

| File | Purpose |
|---|---|
| `tests/TESTING.md` | Engineer-owned testing policy (hash-pinned via harness) |
| `tests/RTM.md` | Requirements traceability matrix (24 REQ-IEC-NNN) |
| `tests/PERSONAS.md` | 4 downstream-consumer personas |
| `tests/JOURNEYS.md` | 3 type-level journeys |
| `package.json` | npm manifest + scripts catalog |

The repo IS fully dressed. **E12a is confirmed PASS.**

## Test SOP install (E12b/c/d ratification)

`@intentsolutions/audit-harness@0.1.0` installed as devDep since iec-E02e. The 9-step CI gate chain (`harness:verify → lint → typecheck → arch → test → test:coverage → build → test:types → dist-verify`) plus the dedicated boundary-check workflow + the tag-triggered release workflow constitute the full SOP.

See `TEST_AUDIT.md` at repo root for the formal audit grade (**A — 0 P0 / 0 P1 gaps**).

## Sigstore signing posture (E12f explanation)

The bead title says "sigstore signing config (cosign keyless via GH OIDC)." The literal interpretation — invoking `cosign` directly — is unnecessary for this kernel. The canonical sigstore-keyless flow for npm-published packages **IS** `pnpm publish --provenance` / `npm publish --provenance` (added to npm in Sept 2023). Under the hood that flow:

1. Uses the GitHub Actions OIDC token to authenticate to Fulcio (sigstore CA)
2. Fulcio issues a short-lived signing certificate keyed to the GH workflow identity
3. The package tarball is signed with that certificate
4. The signature + certificate are logged to Rekor (the sigstore transparency log)
5. The signed bundle is attached to the npm package as a provenance attestation
6. Consumers verify via `npm audit signatures <pkg>` which checks Fulcio + Rekor

This **is** cosign-keyless-via-OIDC. The kernel publishes via npm; npm publishes via sigstore-keyless. End-to-end, the flow satisfies the bead.

Adding a separate `cosign sign-blob` step would only matter if the kernel published artifacts OUTSIDE npm. Currently:

- npm tarball: ✅ signed via npm provenance (sigstore-keyless via GH OIDC)
- GitHub Release page: human-readable narrative; not a verifiable distribution channel
- No Python wheel, no Rust crate, no standalone binary at v0.1

When iec-E08 (Pydantic + Python wheel via PyPI) ships, PyPI's analogous provenance flow will cover the Python artifact. Until then, no additional cosign-keyless step is needed.

**Verification path consumers use today**:

```bash
npm audit signatures @intentsolutions/core
# Expected: "audited X packages in Ys" + "X packages have verified registry signatures"
```

## Multi-target release pipeline

The bead title mentions "multi-target." At v0.1 the kernel targets **npm only**. Multi-target (Python wheel + Rust crate concurrent publishing from the same release tag) is deferred to iec-E08 + a future Rust bead. The current `release.yml` is single-target by design; when Python lands, the workflow gains a second job (`publish-python`) that builds + signs + publishes the wheel from the same tag. When Rust lands, a third job (`publish-crate`). One tag → N synchronized publishes is the canonical multi-target pattern; implementing it requires the artifacts to exist first.

## Required-status-check ratchet (E12g)

After this PR merges, branch protection on `main` adds `Boundary check / 4-axis boundary check` to the required status checks. Status check matrix post-merge:

| Check name | Source workflow | Required |
|---|---|---|
| `lint + typecheck + test + build` | `ci.yml` | ✅ |
| `4-axis boundary check` | `boundary-check.yml` | ✅ (added this PR) |

This was the original bead's deferral: "minimum now; required checks after 3 green days." The 3-day window has elapsed; both workflows have run cleanly across PRs #6 and #7.

## Quality posture at AAR time

| Gate | Status |
|---|---|
| `pnpm run check` | ✓ green (lint + typecheck + test + arch + boundaries) |
| `pnpm run test:coverage` | ✓ 100% line/branch/function/statement |
| `pnpm run test:types` (tsd) | ✓ ~80 negative-test assertions pass |
| `pnpm run arch` (dep-cruiser, 8 forbidden rules) | ✓ 0 violations |
| `pnpm run boundaries` (4-axis checker) | ✓ 0 violations |
| `pnpm run harness:verify` | ✓ hash-pinned policy intact |
| npm provenance verified | ✓ `npm audit signatures @intentsolutions/core@0.1.0` shows 1 sig |
| Test totals | 154 vitest + ~80 tsd + 31 ajv + 31 Zod ≈ 295 assertions |
| Branch protection on main | ✓ `enforce_admins=true`; 2 required status checks after this PR |

## Cross-references

- Per-repo blueprint: `000-docs/002-AT-ARCH-repo-blueprint-2026-05-18.md` (NORMATIVE; § 7 testing strategy + § 11 release strategy + § 12 work breakdown)
- Boundary doctrine: `000-docs/003-AT-STND-core-repo-boundaries-2026-05-18.md` (NORMATIVE; § 5 dep-cruiser relationship + § 6 escape-scan relationship)
- Release v0.1.0 AAR: `000-docs/001-AA-AACR-release-v0.1.0-2026-05-17.md`
- Testing policy: `tests/TESTING.md`
- IS Testing SOP: `~/000-projects/CLAUDE.md § Intent Solutions Testing SOP`
- TEST_AUDIT.md: repo root

## Outcome

iec-E12 epic + 7 sub-beads closed. The kernel's testing + CI/CD + release posture is now formally ratified at production quality. Next ratchet-ups (P2) tracked at `iec-E07` (SemVer regression suite) and `iec-E08` (Pydantic + Python distribution).

— Jeremy Longshore
intentsolutions.io
