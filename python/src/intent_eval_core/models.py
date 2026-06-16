"""Canonical Pydantic v2 model surface for ``@intentsolutions/core`` (Python).

This is the **hand-authored public surface** — the Python analogue of the
TypeScript ``src/validators/v1/*.ts`` canonical validators. It re-exports the
``_generated/`` datamodel-code-generator output under stable canonical names
(``GateResultV1``, ``EvalSpec``, …) and, for the schemas whose JSON Schema
carries ``allOf``/``if-then`` conditional rules, layers a hand-written
cross-field ``model_validator`` on top so the Python models accept/reject
**exactly** what AJV (the JSON-Schema reference) and Zod (the TypeScript
reference) accept/reject. No drift from the canonical kernel.

The ``_generated/`` package is reference material, NOT the public API — never
import from it directly (mirrors the Zod ``_generated/`` README discipline).
Import from here:

    from intent_eval_core import GateResultV1, EvalSpec
    from intent_eval_core.models import GATE_RESULT_V1_URI

Codegen handles the STRUCTURAL floor (fields, types, enums, ``constr`` patterns,
``extra="forbid"`` closed-world). The cross-field rules below are the exact
Python mirror of the Zod ``.superRefine()`` blocks in
``src/validators/v1/gate-result-v1.ts`` — the only place where the JSON Schema's
``allOf``/``if-then`` semantics live (datamodel-code-generator cannot emit them).
"""

from __future__ import annotations

# `typing.Self` is 3.11+; import from typing_extensions (a guaranteed transitive
# dependency of pydantic v2) so the 3.10 floor keeps working. The annotation
# itself is a string at runtime via `from __future__ import annotations`; this
# only guards the import statement.
from typing_extensions import Self

from pydantic import model_validator

# ── Generated root models, re-exported under canonical names ──────────────────
#
# datamodel-code-generator derives class names from each schema's `title`, which
# produces verbose names (e.g. EvalspecDeclarativeEvaluationSpecificationBlueprintB21).
# We alias them to the canonical entity names used across the platform.

from ._generated.cost_record_schema import (
    CostrecordSingleCostResourceAttributionRowBlueprintB212 as CostRecord,
)
from ._generated.dashboard_render_schema import (
    DashboardRenderV1InTotoPredicateBodyAttestingARenderedDashboardArtifact as DashboardRenderV1,
)
from ._generated.eval_run_schema import (
    EvalrunSingleExecutionOfAnEvalspecAgainstASkillsnapshotBlueprintB22 as EvalRun,
)
from ._generated.eval_spec_schema import (
    EvalspecDeclarativeEvaluationSpecificationBlueprintB21 as EvalSpec,
)
from ._generated.evidence_bundle_schema import (
    EvidencebundleAppendOnlyCollectionOfSignedPredicateRowsBlueprintB24 as EvidenceBundle,
)
from ._generated.failure_taxonomy_schema import (
    FailuretaxonomyCanonicalRegistryOfFailureModeClassesBlueprintB213 as FailureTaxonomy,
)
from ._generated.gate_result_schema import (
    GateResultV1NormativeInTotoPredicateBody as _GateResultV1Generated,
)
from ._generated.judge_decision_schema import (
    JudgedecisionSingleJudgeSVerdictOnAnEvalrunForAMatchermapBlueprintB25 as JudgeDecision,
)
from ._generated.matcher_map_schema import (
    MatchermapReusableInputBehaviorPatternDefinitionBlueprintB23 as MatcherMap,
)
from ._generated.regression_pack_schema import (
    RegressionpackFrozenBundleOfEvalrunsProvingABehaviorContractBlueprintB27 as RegressionPack,
)
from ._generated.retraction_schema import (
    RetractionV1InTotoPredicateBodyForRetractingAPriorAttestation as RetractionV1,
)
from ._generated.rollout_gate_schema import (
    RolloutgateEvaluationOfAnEvidencebundleAgainstADeploymentPolicyBlueprintB28 as RolloutGate,
)
from ._generated.runtime_receipt_schema import (
    RuntimereceiptSignedRecordOfHowAnEvalrunExecutedBlueprintB26 as RuntimeReceipt,
)
from ._generated.session_trace_schema import (
    SessiontraceOtelCompatibleExecutionTraceForAnEvalrunBlueprintB210 as SessionTrace,
)
from ._generated.skill_snapshot_schema import (
    SkillsnapshotContentAddressedPinOfASkillSSourceDepsConfigBlueprintB29 as SkillSnapshot,
)
from ._generated.tool_invocation_schema import (
    ToolinvocationSingleToolProviderCallRecordedUnderASessiontraceBlueprintB211 as ToolInvocation,
)

# ── Canonical predicate URI (CISO binding: evals.intentsolutions.io, never labs) ─
GATE_RESULT_V1_URI = "https://evals.intentsolutions.io/gate-result/v1"


class GateResultV1(_GateResultV1Generated):
    """gate-result/v1 NORMATIVE predicate body (Blueprint B § 7.4).

    Subclasses the generated structural model and adds the cross-field rules the
    JSON Schema expresses via ``allOf``/``if-then`` — which
    datamodel-code-generator cannot emit. This is the exact Python mirror of the
    ``GateResultV1Schema.superRefine(...)`` block in
    ``src/validators/v1/gate-result-v1.ts``:

    1. ``gate_decision == "advisory"`` REQUIRES ``advisory_severity``
       (Blueprint B § 7.4 conditional rule).
    2. Empty ``gate_reasons`` is permitted ONLY for an unconditional ``pass`` —
       ``fail`` / ``advisory`` / ``error`` MUST carry at least one reason
       (Blueprint B § 7.4 line 829, ``[f-iec-validators-3]``).
    3. Every ``coverage_detail`` entry's ``id`` MUST appear in the matching
       ``coverage`` array (``evaluated`` -> ``dimensions_evaluated``,
       ``skipped`` -> ``dimensions_skipped``) — deferral-D cross-field invariant
       (``bd_000-projects-9xyk``).

    The generated parent already enforces ``extra="forbid"`` (closed-world),
    the ``gate_decision`` / ``advisory_severity`` enums, and the
    ``policy_ref`` / ``policy_hash`` / ``input_hash`` patterns.
    """

    @model_validator(mode="after")
    def _enforce_blueprint_b_7_4(self) -> Self:
        decision = (
            self.gate_decision.value
            if hasattr(self.gate_decision, "value")
            else self.gate_decision
        )

        # Rule 1: advisory => advisory_severity present.
        if decision == "advisory" and self.advisory_severity is None:
            raise ValueError(
                'gate_decision="advisory" requires advisory_severity per '
                "Blueprint B § 7.4 conditional rule"
            )

        # Rule 2: empty gate_reasons permitted ONLY for pass.
        if decision in ("fail", "advisory", "error") and len(self.gate_reasons) == 0:
            raise ValueError(
                'gate_reasons MUST be non-empty when gate_decision is "fail", '
                '"advisory", or "error" per Blueprint B § 7.4 line 829 '
                "(empty permitted ONLY for pass)"
            )

        # Rule 3: coverage_detail id must be a member of the matching coverage array.
        if self.coverage_detail is not None:
            evaluated = set(self.coverage.dimensions_evaluated)
            skipped = set(self.coverage.dimensions_skipped)
            for i, detail in enumerate(self.coverage_detail):
                status = detail.status.value if hasattr(detail.status, "value") else detail.status
                pool = evaluated if status == "evaluated" else skipped
                if detail.id not in pool:
                    raise ValueError(
                        f'coverage_detail[{i}].id "{detail.id}" (status={status}) is '
                        f"not in coverage.dimensions_{status} (deferral-D cross-field "
                        "invariant)"
                    )

        return self


__all__ = [
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
    # Constants
    "GATE_RESULT_V1_URI",
]
