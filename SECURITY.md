# Security Policy

## Supported Versions

`@intentsolutions/core` is pre-1.0; per SemVer, the 0.x surface is still
evolving and only the current minor receives security fixes.

| Version | Supported |
| --- | --- |
| v0.8.x (current) | Yes |
| < v0.8 | Best effort — upgrade to the current line |

## Reporting a Vulnerability

**Please do NOT open public issues for security concerns.**

Email **<security@intentsolutions.io>** with:

- Type of issue (e.g., schema-validation bypass, branded-type forgery, supply-chain vulnerability in dependencies, sigstore signature forgery, codegen drift bypass)
- Full paths of related source files
- Location of the affected code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce
- Step-by-step instructions to reproduce
- Proof-of-concept or exploit code (if possible)
- Impact assessment — particularly important for the supply-chain dimension since `@intentsolutions/core` is the canonical-contracts kernel that downstream Intent Eval Platform consumers (j-rig, audit-harness, intent-rollout-gate, intent-eval-lab) import

### Response Timeline

| Stage | Timeframe |
| --- | --- |
| Acknowledgment | 24 hours |
| Initial assessment | 48 hours |
| Status update | 5 business days |
| Resolution | Depends on severity |

### Severity Levels

| Severity | CVSS | Examples | Target Resolution |
| --- | --- | --- | --- |
| Critical | 9.0–10.0 | Schema-validation bypass that lets a forged Evidence Bundle row pass a downstream gate; arbitrary code execution via crafted Zod schema | 24 hours |
| High | 7.0–8.9 | Branded-type forgery (e.g., constructing a `Sha256` from an unhashed string); signature-mode escalation in `gate-result/v1`; type-narrowing bypass | 7 days |
| Medium | 4.0–6.9 | Denial of service via malformed JSON Schema; partial codegen-drift bypass; non-exploitable parser issues | 30 days |
| Low | 0.1–3.9 | Information disclosure in error messages; documentation that overstates compatibility guarantees | 90 days |

## Threat Model

`@intentsolutions/core` is the canonical-contracts kernel for the Intent Eval Platform. Its security posture must consider:

- **Adversary downstream** — consumer attempts to forge an Evidence Bundle row by constructing branded types directly. Mitigation: branded types are exported as opaque; consumers must use the Zod validators in `validators/v1/` which run real hash/format checks. Per Blueprint A § 1.2 principle 11 ("schema is canon"), all validation flows through the schema.
- **Adversary upstream** — supply-chain attack on this npm package itself. Mitigation: sigstore provenance attached to every release tarball; consumers verify with `npm audit signatures`. CI release workflow uses OIDC for keyless signing (no maintainer-held key to compromise).
- **Adversary in consumer CI** — attempt to forge a passed `gate-result/v1` payload by hand-constructing JSON. Mitigation: the predicate URI grammar is locked at `https://evals.intentsolutions.io/<predicate-type>/v<version>`; consumers verifying against sigstore + Rekor will detect any payload whose predicate body doesn't match a legitimately-signed envelope.

### Schema-as-canon discipline

Edits to `schemas/v1/*.schema.json` go through codegen — never hand-edit `src/validators/v1/_generated/*` files. The `pnpm run codegen:validators` step regenerates from the JSON Schema sources; the CI gate fails if generated files drift. **A PR that modifies generated code without re-running codegen IS a vulnerability** (it indicates the JSON Schema and the Zod validators are out of sync, weakening every downstream consumer's runtime check). Report such PRs as a High severity finding.

## Disclosure Process

1. **Report** — You email the details to <security@intentsolutions.io>
2. **Triage** — We assess severity and impact
3. **Fix** — We develop and test a patch
4. **Notify** — We inform affected consumer repos (4 sibling IEP repos + downstream Intent Solutions consumers) via the npm advisory feed + a CHANGELOG entry tagged `SECURITY`
5. **Release** — We publish the fix with a patch-version bump; MAJOR if the fix requires breaking schema changes (rare; documented per principle 11)
6. **Post-Mortem** — We document lessons learned and any policy updates in `intent-eval-lab/000-docs/`

## Security Best Practices

When contributing to this project:

- Never hardcode credentials or secrets — this package has zero runtime deps and never reaches network anyway
- Validate all input at system boundaries — the boundary IS this package's schemas and Zod validators
- Keep dev dependencies up to date (dependabot opens weekly PRs)
- Follow the principle of least surface — exports stay minimal; tree-shaking matters
- Do not log sensitive information in test output
- Write tests for security-critical paths — every Zod refinement (e.g., `gate-result/v1`'s `advisory_severity` conditional) must have positive AND negative fixtures

## Recognition

We appreciate responsible disclosure. Reporters who follow this policy will receive:

- Credit in security advisories (unless anonymity is preferred)
- Mention in `CHANGELOG.md` under the affected release's `### Security` section
- Our sincere gratitude

## Contact

- **Security reports**: <security@intentsolutions.io>
- **General inquiries**: <jeremy@intentsolutions.io>
- **Response time**: 24 hours for initial acknowledgment
