# ALLOWLIST — `@intentsolutions/core` permitted dependencies + top-level files

> **NORMATIVE.** Machine-readable by `scripts/check-boundaries.ts`. Hash-pinned. Edits require `pnpm exec audit-harness init`.
>
> **Cap**: runtime deps ≤ **8**. Soft cap on devDeps (current count documented; growth requires PR review).
>
> Authority: [`FORBIDDEN.md`](FORBIDDEN.md) enumerates what's blocked; this file enumerates what's explicitly permitted.

## Runtime dep allowlist (`package.json#dependencies`)

**Hard cap: ≤8 entries.** Each entry must have a documented rationale that ties to a Blueprint A / Blueprint B / per-repo blueprint § 6.6 stability promise. Adding a 9th runtime dep requires a Class-2 ISEDC pair Decision Record per the per-repo blueprint § 11 release strategy.

| Package | Range | Rationale | Promised by |
| --- | --- | --- | --- |
| `zod` | `^4.4.3` | Runtime validators (validators subpath only — opt-in). The kernel ships pure types in its main entry; consumers who need runtime validation import from `./validators/v1` which loads zod. Tree-shakable per-file subpath exports mean types-only consumers pay zero zod bundle cost. | Per-repo blueprint § 4.5 (External dependencies); enforced by `.dependency-cruiser.cjs` `validators-only-import-zod` rule |

**Current count: 1 / 8.** 7 slots remaining; each addition requires a PR landing the dep AND updating this table AND surviving boundary-check CI.

## DevDep allowlist (`package.json#devDependencies`)

DevDeps don't count against the runtime cap — they don't ship in the published tarball — but they ARE subject to FORBIDDEN.md Axis 1 (forbidden patterns) and Axis 4 (forbidden categories). A devDep matching a forbidden pattern requires an explicit waiver here with rationale.

| Package | Range | Purpose | Why permitted (in case it matches a forbidden pattern) |
| --- | --- | --- | --- |
| `@eslint/js` | `^9.17.0` | ESLint flat-config recommended rules | n/a — no forbidden-pattern match |
| `@intentsolutions/audit-harness` | `^0.1.0` | IS Testing SOP enforcement (escape-scan, arch-check, harness-hash, gherkin-lint, CRAP, bias-count) | n/a — Intent Solutions internal tooling, sibling repo |
| `@types/node` | `^22.10.0` | TypeScript types for Node.js | n/a |
| `@typescript-eslint/eslint-plugin` | `^8.19.0` | ESLint plugin for TypeScript rules | n/a |
| `@typescript-eslint/parser` | `^8.19.0` | ESLint parser for TypeScript | n/a |
| `@vitest/coverage-v8` | `^2.1.8` | Coverage instrumentation via V8 native API | n/a |
| `ajv` | `^8.20.0` | JSON Schema (draft 2020-12) validation in tests | n/a |
| `ajv-formats` | `^3.0.1` | Date-time / URI format validators for ajv | n/a |
| `dependency-cruiser` | `^17.4.0` | Architecture rule enforcement (`pnpm run arch`) | n/a |
| `eslint` | `^9.17.0` | Linter | n/a |
| `eslint-config-prettier` | `^9.1.0` | Disables ESLint rules that conflict with Prettier | n/a |
| `husky` | `^9.1.7` | Git hooks (pre-commit) | n/a |
| `json-schema-to-zod` | `^2.8.1` | Codegen reference output at `src/validators/v1/_generated/` | n/a |
| `lint-staged` | `^17.0.5` | Run linters on staged files only | n/a |
| `prettier` | `^3.4.2` | Code formatter | n/a |
| `tsd` | `^0.33.0` | Second-opinion TypeScript type test framework | n/a |
| `typescript` | `^5.7.2` | The compiler | n/a |
| `typescript-eslint` | `^8.19.0` | typescript-eslint convenience flat-config entry | n/a |
| `vitest` | `^2.1.8` | Test runner | n/a |

**Current count: 19 devDeps.** Soft growth target: ≤ 25 by end-of-v0.x. Hard cap will land in v1.0 boundary doctrine.

## Top-level files allowlist

Files allowed at repo root (anything not in this list triggers a BLOCK on the Axis 3 directory check, extended to files):

```text
.audit-harness
.dependency-cruiser.cjs
.gemini
.gitignore
.greptile
.harness-hash
.harness-hash-extra-patterns
.npmrc
.nvmrc
.prettierignore
.markdownlint-cli2.jsonc
.prettierrc.json
.typos.toml
.vale
.vale.ini
AGENTS.md
ALLOWLIST.md
CHANGELOG.md
CLAUDE.md
CODE_OF_CONDUCT.md
CODEOWNERS
CONSUMERS.md
CONTRIBUTING.md
FORBIDDEN.md
LICENSE
README.md
SECURITY.md
TEST_AUDIT.md
api-extractor.json
codecov.yml
eslint.config.js
lefthook.yml
lychee.toml
package.json
pnpm-lock.yaml
tsconfig.build.json
tsconfig.json
vitest.config.ts
```

Annotations (what each is):

- `.audit-harness` — vendored audit-harness configs (the `configs/.yamllint.yml` rule set consumed by `lint.yml`); same pattern as the sibling IEP repos
- `.greptile` — Greptile reviewer config directory (`config.json` scoped semantic-review rules encoding the kernel's architectural invariants + `files.json` grounding-doc pointers); the AI code-review layer, non-overlapping with CodeQL security scanning and the deterministic L1 lint lanes
- `.gemini` — Gemini Code Assist reviewer config directory (`config.yaml` review settings + `styleguide.md` cross-artifact review priorities); re-instated 2026-06-24 as the active fallback reviewer while the Greptile review quota is exhausted; advisory, non-overlapping with CodeQL
- `.dependency-cruiser.cjs` — dep-cruiser config (hash-pinned)
- `.gitignore` — git ignore patterns
- `.harness-hash` — hash-pinned policy manifest
- `.harness-hash-extra-patterns` — extra harness-hash glob patterns (self-pins the DR-049 rubric-floor guard)
- `.npmrc` — (optional) npm registry config; MUST NOT contain tokens
- `.nvmrc` — Node version pin
- `.prettierignore` / `.prettierrc.json` — Prettier
- `.typos.toml` — crate-ci/typos config (IEP domain-term ignore-list) consumed by the advisory `typos.yml` lane
- `AGENTS.md` — vendor-neutral agent contract (cross-CLI)
- `ALLOWLIST.md` — this file
- `CHANGELOG.md` — Keep a Changelog
- `CLAUDE.md` — Claude-Code-specific guidance
- `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1
- `CODEOWNERS` — codeowner routing for PR review
- `CONSUMERS.md` — informative consumer note: the one AJV-only-vs-Zod carve-out (INV-ENV-DISJOINT / kyh9) an AJV-only consumer must enforce itself
- `CONTRIBUTING.md` — contribution guidelines + architectural bindings
- `FORBIDDEN.md` — boundary forbidden set
- `LICENSE` — Apache 2.0
- `README.md` — package overview + install
- `SECURITY.md` — vulnerability-disclosure policy + threat model
- `eslint.config.js` — ESLint flat config
- `lefthook.yml` — opt-in fast local git-hooks config (mirrors the husky pre-commit staged-only subset: escape-scan + boundaries + lint-staged). Advisory; husky remains the default installer (last-installer-wins on `.git/hooks`).
- `lychee.toml` — lychee link-checker config (doc-quality lane)
- `package.json` / `pnpm-lock.yaml` — npm manifest + lockfile
- `tsconfig.json` / `tsconfig.build.json` — TypeScript configs
- `vitest.config.ts` — vitest config

Files NOT in this list trigger a BLOCK. The boundary checker also flags files that match common-but-undesired patterns (`.env`, `*.local.*`, `credentials.*`, `*.pem`, etc.) regardless of position.

## Hash-pin discipline

This file is hash-pinned. After any edit:

```bash
# 1. Make the edit
# 2. Stage + commit the edit
git add ALLOWLIST.md

# 3. Re-pin the hash manifest
pnpm exec audit-harness init

# 4. Stage the updated .harness-hash + commit (same commit if pre-commit; separate is OK)
git add .harness-hash
git commit --amend --no-edit  # or separate commit
```

Pre-commit refuses unsigned policy edits by design — that's the whole point of hash-pinning. Don't try to work around it; respect the gate.

## Override process

See [`000-docs/003-AT-STND-core-repo-boundaries-2026-05-18.md § 3`](000-docs/003-AT-STND-core-repo-boundaries-2026-05-18.md). Overrides require:

1. Bead in `iec-` prefix with rationale + expiration
2. Bead ID in PR description as `boundary-override: bd_000-projects-<id>`
3. Class-2 ISEDC review for major-boundary crossings
