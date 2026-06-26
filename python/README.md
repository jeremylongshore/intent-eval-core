# intent-eval-core (Python)

Python (Pydantic v2) distribution of
[`@intentsolutions/core`](https://www.npmjs.com/package/@intentsolutions/core) —
the canonical contracts kernel for the
[Intent Eval Platform](https://github.com/jeremylongshore/intent-eval-lab).

The **same** entity + predicate contracts the TypeScript package exposes as Zod
validators and JSON Schemas, here as **Pydantic v2 models** for Python
consumers. The models are code-generated from the canonical `schemas/v1/*.json`
JSON Schemas and validated for parity against the same golden fixtures the
TypeScript/AJV side validates — a payload accepted by the Zod validator is
accepted here, and one rejected there is rejected here.

## Install

```bash
pip install intent-eval-core
```

Requires Python 3.10+. Runtime dependency: `pydantic>=2.5,<3`.

## Usage

```python
from intent_eval_core import GateResultV1, EvalSpec
from pydantic import ValidationError

row = {
    "gate_id": "audit-harness:ci:escape-scan",
    "gate_name": "escape-scan",
    "gate_version": "0.3.0",
    "gate_decision": "pass",
    "gate_reasons": [],
    "coverage": {"dimensions_evaluated": ["credential-leak"], "dimensions_skipped": []},
    "policy_ref": "sha256:" + "e" * 64 + ":tests/TESTING.md",
    "policy_hash": "sha256:" + "e" * 64,
    "input_hash": "sha256:" + "3" * 64,
    "evaluated_at": "2026-05-17T00:00:10Z",
    "runner": "audit-harness@0.3.0",
    "commit_sha": "abc1234",
}

gate = GateResultV1.model_validate(row)   # raises pydantic.ValidationError on drift
print(gate.gate_decision)                 # GateDecision.pass_
```

## What's exported

15 canonical entities + 3 predicate bodies (Blueprint B § 2 / § 7 + SkillVersion DR-028 T1 + UsageEvent DR-103 D1):

| Entity models | Predicate-body models |
| --- | --- |
| `EvalSpec`, `EvalRun`, `MatcherMap`, `EvidenceBundle`, `JudgeDecision`, `RuntimeReceipt`, `RegressionPack`, `RolloutGate`, `SkillSnapshot`, `SessionTrace`, `ToolInvocation`, `CostRecord`, `FailureTaxonomy` | `GateResultV1`, `RetractionV1`, `DashboardRenderV1` |

Plus `GATE_RESULT_V1_URI` (the canonical predicate URI at
`evals.intentsolutions.io`).

## How it stays in lockstep with the TypeScript kernel

- **Codegen, not hand-port** — `scripts/codegen_pydantic.py` runs
  `datamodel-code-generator` (pinned) over the canonical
  `schemas/v1/*.json`. The output lives in `intent_eval_core/_generated/`
  (reference material; never import from it directly).
- **Cross-field rules** — the JSON Schema `allOf`/`if-then` conditional rules
  (e.g. gate-result/v1's "advisory requires advisory_severity",
  "fail/advisory/error requires a non-empty reason") cannot be expressed by the
  generator, so the canonical public surface (`intent_eval_core/models.py`)
  layers a hand-written Pydantic `model_validator` on top — the exact mirror of
  the Zod `.superRefine()` blocks in the TypeScript validators.
- **Parity tests** — `tests/test_parity.py` runs the **shared** golden fixtures
  (`tests/fixtures/v1/`, the same set the TypeScript suite consumes) through the
  Python models and asserts identical accept/reject behavior.
- **Version lockstep** — the package version tracks the npm
  `@intentsolutions/core` `package.json#version` (the JSON Schemas are the
  shared source of truth). CI gate: `scripts/check_version_lockstep.py`.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.
