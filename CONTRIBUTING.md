# Contributing to @intentsolutions/core

Thank you for your interest in contributing to **`@intentsolutions/core`** — the canonical contracts kernel for the [Intent Eval Platform](https://github.com/jeremylongshore/intent-eval-lab). This package ships TypeScript types, JSON Schemas, Zod validators, and state machines for the 13 canonical entities; four downstream IEP repos consume it.

## Getting Started

### Prerequisites

- Node 20+ (CI runs on 20 and 22)
- pnpm 9+
- Git
- GitHub account

### Development Setup

```bash
git clone https://github.com/jeremylongshore/intent-eval-core.git
cd intent-eval-core
pnpm install
pnpm run check          # full 9-step gate chain
```

### Quick self-check

```bash
pnpm run build          # tsup all entry points
pnpm run typecheck      # tsc --noEmit across src/ and tests/
pnpm run test           # vitest (154+ tests)
pnpm run lint           # eslint
pnpm exec audit-harness verify  # hash-pinned policy verification
```

## How to Contribute

### Reporting Bugs

1. Search [existing issues](https://github.com/jeremylongshore/intent-eval-core/issues) first
2. Open a bug report with: kernel version (`cat package.json | jq .version`), Node version, OS, reproduction steps, and the failing schema or validator output
3. For schema-validation regressions, include the offending JSON payload as a minimal repro

### Suggesting Enhancements

1. Check existing feature requests
2. Open a feature request
3. For new entities or schema fields, link to the upstream Blueprint B section that necessitates the change — kernel changes follow `intent-eval-lab` spec, not the other way around (per Blueprint A § 1.2 principle 10)

### Pull Requests

1. Fork the repository
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-change-name
   ```
3. Make your changes — schemas are the source of truth; never hand-edit generated Zod validators
4. Run `pnpm run codegen:validators` if you touched any `schemas/v1/*.schema.json` file
5. Verify locally: `pnpm run check` must pass green
6. Commit with [conventional commit messages](#commit-messages)
7. Push and open a PR

## Development Process

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code; npm-publish source on tag push `v*.*.*` |
| `feat/*` | New features (additive — new entities, new schemas, new validators) |
| `fix/*` | Bug fixes (no shape changes; just behavior corrections) |
| `docs/*` | Documentation changes |
| `chore/*` | Tooling, CI, dependency bumps |

### Stability promise

`@intentsolutions/core` is consumed by 4 sibling IEP repos plus downstream Intent Solutions consumers. **Backward-compatible additions only on minor releases.** Breaking changes (schema field removals, type-signature changes, runtime validator stricter than v1, predicate URI rename) wait for a major bump and are documented in `CHANGELOG.md` with a migration recipe.

Per Blueprint A § 1.2 principle 10 ("schema is canon"), every breaking schema change requires a MAJOR version bump — there is no convenience-minor exception. Per principle 11 ("expand-contract for additions"), every additive change lands as `optional` first, ages for at least one consumer release, then becomes `required` only after a deprecation warning fires against the still-optional shape.

### Schema as canon

- Edit `schemas/v1/*.schema.json` first; regenerate validators via `pnpm run codegen:validators`
- The CI gate fails if generated files drift from schemas (intentional — keeps the relationship enforced)
- Every Zod refinement (e.g., `gate-result/v1`'s `advisory_severity` conditional rule) needs positive AND negative test fixtures

### Testing

```bash
pnpm run test                       # full vitest run (154+ tests + ~80 tsd negative assertions)
pnpm run test:types                 # tsd-only type-level assertions
pnpm run test:watch                 # vitest watch mode
pnpm vitest run path/to/file.test.ts  # single file
```

### Code Review

- All PRs require at least 1 maintainer approval
- CI must pass — 9-step gate chain: lint → typecheck → test → arch → coverage → build → test:types → audit-harness verify → boundary-check
- Gemini review fires automatically on PR open; address findings or explain why before merge
- Keep PRs focused — one entity or one validator per PR
- Document any schema changes in the PR body — if the change requires consumer repos to bump kernel dep, **state that explicitly**

## Style Guides

### Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]
[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf`

**Examples:**
- `feat(gate-result): add advisory_severity conditional refinement`
- `fix(branded-types): tighten Sha256Prefixed regex to reject mixed case`
- `docs(readme): clarify consumer-side import patterns`
- `chore(release): v0.1.1`

### Code Style

- Follow the project's existing conventions (eslint enforces; `pnpm run lint` to check)
- TypeScript strict mode + `verbatimModuleSyntax` + `isolatedModules`
- No new runtime dependencies in the published package without explicit discussion (zero runtime deps is a kernel posture)
- Zod is the only runtime dep allowed via direct dependency
- 2-space indent, double quotes (per existing files)

### License-aware contributions

The package is Apache 2.0-licensed. By contributing, you agree to license your contributions under the same Apache 2.0 terms. Don't introduce dependencies under copyleft licenses (GPL/AGPL) — even as devDependencies, prefer permissively-licensed equivalents.

## Architectural Bindings

Every kernel change MUST be consistent with:

- [DR-010](https://github.com/jeremylongshore/intent-eval-lab/blob/main/000-docs/010-AT-DECR-isedc-council-session-4-widened-scope-2026-05-13.md) — ISEDC Session 4 widened-scope lock; TS-primary; unification thesis
- [Blueprint A](https://github.com/jeremylongshore/intent-eval-lab/blob/main/000-docs/011-AT-ARCH-ecosystem-master-blueprint.md) — 12 binding principles
- [Blueprint B](https://github.com/jeremylongshore/intent-eval-lab/blob/main/000-docs/012-AT-ARCH-platform-runtime-blueprint.md) — runtime architecture + 13-entity domain model + `gate-result/v1` NORMATIVE spec
- [Canonical Glossary](https://github.com/jeremylongshore/intent-eval-lab/blob/main/000-docs/014-DR-GLOS-canonical-glossary.md) — terminology source of truth

When in doubt about whether a change is in scope: this package is the kernel of CONTRACTS. It has NO execution, NO judges, NO runtime. Anything that touches behavior belongs in `j-rig-binary-eval`, `audit-harness`, or `intent-rollout-gate`.

## Community

- **Questions**: [GitHub Discussions](https://github.com/jeremylongshore/intent-eval-core/discussions)
- **Bugs**: [Issue Tracker](https://github.com/jeremylongshore/intent-eval-core/issues)
- **Email**: jeremy@intentsolutions.io

## License

By contributing, you agree that your contributions will be licensed under the project's [Apache 2.0 License](LICENSE).

---

*Thank you for helping improve `@intentsolutions/core`!*
