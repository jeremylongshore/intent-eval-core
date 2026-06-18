"""intent-eval-core — Python distribution of the Intent Eval Platform contracts kernel.

The same canonical contracts the TypeScript ``@intentsolutions/core`` package
exposes as Zod validators + JSON Schemas, here as **Pydantic v2 models** for
Python consumers (LLM-harness lab, agent-runtime sandbox, ``validate-*`` skill
emit-evidence retrofits).

The models are codegen'd from the canonical ``schemas/v1/*.json`` JSON Schemas
(``datamodel-code-generator``) and validated for byte-for-byte parity against the
same golden fixtures the TypeScript/AJV side validates — so a payload accepted by
the Zod validator is accepted here, and one rejected there is rejected here.

Usage::

    from intent_eval_core import GateResultV1, EvalSpec

    gate = GateResultV1.model_validate(some_dict)   # raises ValidationError on drift

Version is kept in lockstep with the npm ``@intentsolutions/core`` ``package.json``
version (the JSON Schemas are the shared source of truth for both).
"""

from __future__ import annotations

from .models import (
    GATE_RESULT_V1_URI,
    CostRecord,
    DashboardRenderV1,
    EvalRun,
    EvalSpec,
    EvidenceBundle,
    FailureTaxonomy,
    GateResultV1,
    JudgeDecision,
    MatcherMap,
    RegressionPack,
    RetractionV1,
    RolloutGate,
    RuntimeReceipt,
    SessionTrace,
    SkillRefinerPassV1,
    SkillSnapshot,
    ToolInvocation,
)

# Kept in lockstep with npm package.json#version by scripts/check_version_lockstep.py
# (CI-gated). The JSON Schemas under schemas/v1/ are the shared source of truth.
__version__ = "0.7.0"

__all__ = [
    "__version__",
    # Entities (Blueprint B § 2.1 – § 2.13)
    "EvalSpec",
    "EvalRun",
    "MatcherMap",
    "EvidenceBundle",
    "JudgeDecision",
    "RuntimeReceipt",
    "RegressionPack",
    "RolloutGate",
    "SkillSnapshot",
    "SessionTrace",
    "ToolInvocation",
    "CostRecord",
    "FailureTaxonomy",
    # Predicate bodies
    "GateResultV1",
    "RetractionV1",
    "DashboardRenderV1",
    "SkillRefinerPassV1",
    # Constants
    "GATE_RESULT_V1_URI",
]
