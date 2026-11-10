# TEST_AUDIT.md — `@intentsolutions/core`

## Verification refresh — 2026-11-10

Base: `df2813373cf503a38e66e29306ba83f91c823384` (0.11.1).
Tracking: `bd_000-projects-h08j.6.2`, parent `bd_000-projects-h08j.6`.
The May 19 audit at `7441221` is historical; its grade, counts and Python
deferrals are not current findings. No aggregate grade is assigned here:
measured checks pass, but protection and traceability gaps remain.

## Classification and freshness

The installed harness classifies this package as a **library**, with no
unresolved classification signals. Registry hash:
`sha256:ffbc75700fb5eb501cb47f1e4038f47ab95ae1fba534b38095e1fe7820c80ed1`.
Installed harness: **1.4.0**. The separately tracked 2.0 propagation decision
remains outside this refresh; no tooling upgrade was performed.

The kernel owns contracts, schemas, validators and state machines. It ships
Zod runtime validators and a Pydantic distribution; it does not execute agents,
judge evaluations, sign evidence, or operate persistence services. The old
pure-type rationale in engineer-owned policy requires reconciliation, not an
automatic waiver change.

## Measured verification

| Check | Evidence at the audited base |
| --- | --- |
| Harness integrity | 32 pinned files verified before changes |
| Canonical check | All 16 command stages pass; 1,465 tests pass and one existing shallow-clone fallback case skips across 53 test files |
| Coverage | Vitest/V8 4.1.12: 1,373/1,373 lines, 1,141/1,141 branches, 162/162 functions, 1,415/1,415 statements; all four existing 100% floors pass |
| Architecture | dependency-cruiser reports zero violations |
| Boundary checker | Zero violations; package-category axis remains informative |
| Type/API checks | `test:types` and `api:check` run separately after build; inspect PR CI for final hosted results |
| Python | Python 3.12.3: 161 tests pass; pinned Pydantic codegen check confirms 22 generated modules |
| Python compatibility | Workflow matrix covers 3.10, 3.11 and 3.12; local results above cover only 3.12 |

Coverage includes `src/**/*.ts` and excludes test files, barrel `index.ts`
files, and non-exported runtime `_generated` reference output. Scripts and
Python are outside this coverage denominator. Therefore 100% is a statement
about that configured scope, not all repository code or downstream workflows.
No coverage exclusion or threshold changed in this refresh.

## Layers and enforcement

| Layer | Observed configuration and enforcement |
| --- | --- |
| L1 | Pre-commit runs staged escape-scan, boundaries and lint-staged. CI verifies integrity. Seven GitHub-required contexts are listed below. |
| L2 | Strict TypeScript, ESLint, formatting, runtime/authoring codegen drift, namespace/chamber isolation, rubric-floor checks, architecture and boundaries are installed. |
| L3 | Vitest runtime and type assertions, tsd, V8 coverage, and Python parity/codegen tests are installed. The Python matrix is not currently required by GitHub branch protection. |
| L4 | Cross-entity type composition, schema/Zod/Pydantic parity, architecture and provenance contract tests exist. They do not prove downstream execution or signing. |
| L5–L7 | Preserve engineer-declared waivers; no service/UI/UAT success is inferred. |

API drift is **blocking**: `ci.yml` permits the extractor step to fail so the
following conditional step can print the diff and exit 1. That diagnostic
`continue-on-error` is not an advisory bypass. Conversely, Codecov upload
failure is explicitly non-blocking.

Mutation, CRAP, bias-count and Gherkin remain waived under existing policy;
no measurement or passing result is claimed for them. The declared
`type-test.count: 90` floor has no explicit counting gate found in package
scripts, hooks or workflows.

## Required-check reconciliation proposal — pending approval

Live GitHub protection on November 10 requires these seven contexts:

- `lint + typecheck + test + build`
- `4-axis boundary check`
- `yamllint`
- `actionlint`
- `markdownlint-cli2`
- `typos`
- `lychee`

Proposed change: **retain those seven and add these ten**, nine associated
with GitHub Actions application ID `15368` and the aggregate `CodeQL` check
with GitHub Advanced Security application ID `57789`:

- `codegen-check + parity (py3.10)`
- `codegen-check + parity (py3.11)`
- `codegen-check + parity (py3.12)`
- `prose-anchor validity (6767-h citations)`
- `coverage-map completeness + prose-anchors + is-extension-rationale`
- `changelog observance (schemas/ vs governing CHANGELOG)`
- `Analyze (javascript-typescript)`
- `Analyze (python)`
- `CodeQL` (application ID `57789`)
- `gate / bd-claim-precheck`

The workflow jobs run on every PR without path filters. All ten contexts
were observed passing on the prior
release PR #123. They protect Python parity, schema citations and rationale,
change lineage, security analysis, and task-claim discipline. Scheduled CodeQL run `42612611880`
failed, so historical PR success is not a claim that all recent runs succeeded.
Inspect the audit PR's exact-head results before applying this proposal.

Keep `strict=true`, administrator enforcement, conversation resolution,
review rules and every other protection setting unchanged; force pushes and
branch deletion remain disabled. This is an additive status-check update only.
It has **not been applied**: `AGENTS.md` explicitly requires confirmation for
branch-protection modifications. The local `safe-merge` observed-check union
provides additional merge checks, but does not replace server-side protection.

## Traceability findings and follow-up

The retained RTM contains 24 original requirements: 18 MUST, five SHOULD and
one COULD. Their tags and rows are preserved. It is not a complete inventory
of the current package: Python, SAK, SkillVersion, UsageEvent and HumanReview
need explicit mapping. Persona and journey observations now distinguish typed
construction from real execution, hashing, signing and persistence; the
existing persona coverage target is unchanged, and achieved coverage is not
claimed from unmeasured flows.

`bd_000-projects-h08j.6.3` tracks the policy-rationale reconciliation, explicit
type-test-count enforcement, and expanded requirement mappings. Those findings
remain open; this refresh does not claim full traceability or a clean audit.
The protection portion of `bd_000-projects-h08j.6.2` remains pending the exact
approval above. Other repositories and the reproducible end-to-end walkthrough
remain under the parent bead.
