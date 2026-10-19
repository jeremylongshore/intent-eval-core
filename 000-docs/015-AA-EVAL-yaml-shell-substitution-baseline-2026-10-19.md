# YAML substitution policy measurement — 2026-10-19

| Field | Value |
| --- | --- |
| Bead | `bd_000-projects-h9r9` |
| Policy follow-up | `bd_000-projects-9pey` |
| GitHub | [Kernel SAK coordination #13](https://github.com/jeremylongshore/intent-eval-core/issues/13) |
| Authority | Lab Plan 033 § 14.25; quarterly review protocol 091 § 4 |
| Status | Baseline measured; **kernel targets not met** against marketplace labels |

The 100-fixture corpus required by Plan 033 exposes a difference between the
marketplace YAML checker and the kernel security folds. It does not establish
that the two policies are interchangeable. No schema, published contract,
validator, security threshold, or rollout gate changes in this measurement.

## Method

`tests/security-measurement/shell-substitution-v1/manifest.json` fixes the labels,
paths, and SHA-256 of 100 actual `SKILL.md` files. Ten legitimate values and ten
forbidden values are each placed in five locations: description, compatibility,
a metadata string, a metadata list, and a nested metadata string. Each class has
50 fixtures. Every fixture has a paired control that replaces only its labeled
string with plain text; every control must be accepted.

The legitimate labels come from the marketplace checker's existing allow-list:
the seven braced template variables, including portable skill/plugin roots,
plus combinations and repetition. Forbidden labels cover command-substitution
and backtick shapes, unknown and malformed variables, parameter defaults,
near-miss token names, and allowed tokens mixed with forbidden syntax. These
are inert synthetic strings. Neither runner executes them.

The corpus uses JSON flow mappings, a subset of YAML, as frontmatter. The kernel
runner parses that representation as JSON. The marketplace runner parses it
with PyYAML and requires identical values. This experiment measures the security
check on parsed values; it does not cover YAML quoting/block-scalar dialects,
the complete authoring contract, skill-body behavior, or runtime execution.

The kernel runner invokes the actual v1/v2 Zod security folds and the actual
JSON Schema `securityChecks` definitions. Any disagreement or control failure
aborts measurement. The separate Python runner imports an explicitly supplied,
trusted, committed marketplace validator and invokes its actual
`check_yaml_shell_substitution`; it does not copy or reimplement that checker.
The reports record corpus and implementation hashes, and the marketplace
report records its exact source revision.

## Results

Rates below are relative to the **marketplace label policy**, not violations
of the kernel's declared contract.

| Measured implementation | False positives / 50 | False negatives / 50 | FP rate | FN rate | FP < 2%, FN < 5% |
| --- | --- | --- | --- | --- | --- |
| Kernel v1 security fold | 10 | 43 | 20% | 86% | Not met |
| Kernel v2 security fold | 10 | 40 | 20% | 80% | Not met |
| Marketplace YAML checker | 0 | 0 | 0% | 0% | Met on this corpus |

JSON Schema and Zod agree for all 100 cases in both kernel versions. All paired
controls pass. At this sample size, one false positive is already 2% and fails
the strict target; two false negatives are 4% and pass, while three are 6% and
fail. The runner does not round these boundaries.

The kernel folds inspect `description` only. Both reject every braced template
there, accounting for all ten false positives. Four other locations contain
40 forbidden cases that the folds do not inspect. The v1 fold also misses three
description cases involving command-substitution/backtick syntax without a
braced variable. V2 rejects those description cases. The marketplace checker
walks nested YAML values and removes only its named allowed tokens before
checking the remaining text.

This is a curated, correlated matrix, not 100 independent samples from a
production distribution. Zero observed marketplace errors does not establish
a population error bound or prove security. The rates describe this corpus
and make policy/field-coverage disagreement visible.

## Reproduction

From the kernel checkout:

```bash
pnpm install --frozen-lockfile
pnpm exec vitest run scripts/measure-shell-substitution.test.ts
node --experimental-strip-types scripts/measure-shell-substitution.ts > /tmp/kernel-shell-measurement.json
```

The last command currently exits **1**, because the kernel profiles miss the
targets. A successful measurement test suite verifies the measurement machinery
and cross-representation agreement; it does not convert that result into PASS.

With PyYAML available and a trusted local marketplace checkout:

```bash
python3 scripts/measure_marketplace_shell_substitution.py /path/to/marketplace/scripts/validate-skills-schema.py > /tmp/marketplace-shell-measurement.json
```

That command currently exits **0**. It refuses modified validator source and
an allow-list that no longer contains the labeled legitimate tokens. The
checked-in `kernel-baseline.json` and `marketplace-baseline.json` preserve the
full per-fixture observations and per-location metrics. Compare parsed JSON
when reproducing; repository formatting can change whitespace alone.

## Disposition and quarterly review

`h9r9` remains open. `9pey` owns the policy decision: adopt compatible semantics
in an approved, versioned kernel contract, or formally revise the original
measurement requirement while retaining the discrepancy. Frozen v1 and the
universal security-fold governance remain binding. Do not edit expectations,
remove failing cases, weaken the thresholds, or treat this as authority to
change the kernel.

Quarterly bead `bd_000-projects-9k5h.21` is due **2027-01-17**. Repeat the same
corpus within 90 days and after a relevant
validator/allow-list change. Keep the previous baseline, record new source and
corpus hashes, inspect every changed classification, and file the dated review
under the lab's quarterly protocol. A corpus or label-policy change requires a
new corpus version and an explicit rationale, not a silent replacement of the
original denominator.
