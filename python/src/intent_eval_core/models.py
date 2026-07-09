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
from typing import Literal

from typing_extensions import Self

from pydantic import conint, model_validator

from ._generated import _common_schema as _schema

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
from ._generated.human_review_schema import (
    HumanreviewOpenEndedHumanTrustSignalOnAnEvalrunNetNewCanonicalEntityIsedcDr103D1 as _HumanReviewGenerated,  # noqa: E501
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
from ._generated.skill_refiner_pass_schema import (
    ReplayFidelityLevel as _ReplayFidelityLevel,
)
from ._generated.skill_refiner_pass_schema import (
    SkillRefinerPassV1InTotoPredicateBodyAttestingASkillversionClearedTheSkillRefinerAcceptanceGate as _SkillRefinerPassV1Generated,  # noqa: E501
)
from ._generated.skill_snapshot_schema import (
    SkillsnapshotContentAddressedPinOfASkillSSourceDepsConfigBlueprintB29 as SkillSnapshot,
)
from ._generated.usage_event_schema import (
    SourceEntityType,
)
from ._generated.usage_event_schema import (
    UsageeventAppendOnlyProductMeteringLedgerRow15ThCanonicalEntityDr103D1 as _UsageEventGenerated,
)
from ._generated.skill_version_schema import (
    SkillversionRefinementLineageRecordOfASkill14ThCanonicalEntityDr028T1Discriminator as _SkillVersionGenerated,  # noqa: E501
)
from ._generated.skill_version_schema import (
    SigningMode as _SkillVersionSigningMode,
)
from ._generated.skill_version_schema import (
    Status as _SkillVersionStatus,
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


class SkillVersion(_SkillVersionGenerated):
    """SkillVersion — 14th canonical entity (DR-028 T1), with the DR-085 D3/D5
    cross-field invariants the JSON Schema expresses via ``allOf``/``if-then``
    (which datamodel-code-generator cannot emit). Exact Python mirror of the Zod
    ``.superRefine`` block in ``src/validators/v1/skill-version.ts``:

    1. **DR-085 D3** — ``parent_content_hash`` MUST be null EXACTLY when
       ``parent_version_id`` is null. A ROOT version (null parent) forges no
       parent (null + null = provably zero-forgery); a non-root MUST carry the
       tamper-evident ``parent_content_hash`` lineage anchor.
    2. **DR-085 D5** — ``version_kind`` ∈ {``revert``, ``restore``} ⇒
       ``parent_version_id`` ≠ null (a revert/restore must point at the version
       it reverts/restores to).
    3. **AT-DECR 011 § D3 signing cross-field invariant (both directions)** —
       ``rekor_log_index`` is non-null IFF (``signing_mode == 'rekor_production'``
       AND ``status == 'active'``). An active + production row without a rekor
       index is an unverifiable production claim; a rekor index on a
       non-active/non-production row is forged provenance — both REFUSED. An
       absent/null ``rekor_log_index`` is unconstrained (every staging row).

    The generated parent already enforces ``extra="forbid"`` (closed-world), the
    ``version_kind`` enum, and the BARE ``Sha256`` patterns on ``content_hash`` /
    ``parent_content_hash`` / ``source_snapshot_hash`` (DR-085 D3 alphabet
    alignment to ``SkillSnapshot.combined_sha``).

    **DR-085 D5 optional-not-nullable parity**: the JSON Schema + Zod treat
    ``tenant_id`` as OPTIONAL but NOT NULLABLE (the schema ``$ref``s uuidv7 with
    no ``null`` branch; Zod uses ``.optional()`` not ``.nullable()``).
    datamodel-code-generator renders it ``Uuidv7 | None = None`` (nullable). The
    override re-declares it optional-but-not-nullable so an explicit ``null`` is
    rejected exactly as AJV and Zod reject it.
    """

    # DR-085 D5 optional-NOT-nullable parity (mirrors the schema $ref + Zod
    # `.optional()`): absence allowed, explicit `null` rejected.
    tenant_id: _schema.Uuidv7 = None  # type: ignore[assignment]

    # DR-085 D3 REQUIRED-but-nullable parity: `parent_version_id` +
    # `parent_content_hash` are in the schema `required` array (key MUST be
    # present) AND `oneOf[<hash/uuid>, null]` (value MAY be null). datamodel-code-
    # generator renders them `... | None = None`, which makes the KEY omittable
    # (optional) — three-way drift vs AJV + Zod, which require the key. Re-declare
    # without a default so the key is required, value still nullable.
    parent_version_id: _schema.Uuidv7 | None
    parent_content_hash: _schema.Sha256 | None

    # AT-DECR 011 OPTIONAL-NOT-NULLABLE parity for the five staging signing
    # fields. In the JSON Schema + Zod these are OPTIONAL but NOT NULLABLE
    # (`status`/`signing_mode` are bare enums; `retry_after` $refs rfc3339;
    # `retry_count` is a bare integer; `signing_downgrade_reason` a bare string —
    # none carries a `null` branch, and Zod uses `.optional()` not `.nullable()`).
    # datamodel-code-generator renders each `... | None = None` (nullable), which
    # would WRONGLY accept an explicit `null`. Re-declare each with an annotation
    # that EXCLUDES None (absence allowed via the `= None` default; explicit
    # `null` rejected) — the `models.py`-wrapper idiom, never edit `_generated/`.
    status: _SkillVersionStatus = None  # type: ignore[assignment]
    signing_mode: _SkillVersionSigningMode = None  # type: ignore[assignment]
    retry_after: _schema.Rfc3339 = None  # type: ignore[assignment]
    retry_count: conint(ge=0) = None  # type: ignore[assignment,valid-type]  # keep the generated ge=0 bound; strip only nullability
    signing_downgrade_reason: str = None  # type: ignore[assignment]
    # `rekor_log_index` is genuinely OPTIONAL-AND-NULLABLE (schema
    # `oneOf[integer,null]`, Zod `.nullable().optional()`) — the generated
    # `conint(ge=0) | None = None` is already correct, so it is NOT overridden.

    @model_validator(mode="after")
    def _enforce_dr085_lineage_invariants(self) -> Self:
        # Rule 1 (DR-085 D3): parent_content_hash null iff parent_version_id null.
        if self.parent_version_id is None and self.parent_content_hash is not None:
            raise ValueError(
                "DR-085 D3: parent_content_hash MUST be null for a ROOT version "
                "(parent_version_id is null) — a root forges no parent"
            )
        if self.parent_version_id is not None and self.parent_content_hash is None:
            raise ValueError(
                "DR-085 D3: parent_content_hash MUST be non-null when "
                "parent_version_id is set (the tamper-evident lineage anchor)"
            )

        # Rule 2 (DR-085 D5): revert/restore ⇒ non-null parent_version_id.
        kind = self.version_kind.value if hasattr(self.version_kind, "value") else self.version_kind
        if kind in ("revert", "restore") and self.parent_version_id is None:
            raise ValueError(
                f'DR-085 D5: version_kind "{kind}" requires a non-null '
                "parent_version_id (a revert/restore must point at a prior version)"
            )

        # Rule 3 (AT-DECR 011 § D3): rekor_log_index non-null IFF
        # (signing_mode='rekor_production' AND status='active') — both directions.
        status = self.status.value if hasattr(self.status, "value") else self.status
        signing_mode = (
            self.signing_mode.value if hasattr(self.signing_mode, "value") else self.signing_mode
        )
        rekor_present = self.rekor_log_index is not None
        is_active_production = signing_mode == "rekor_production" and status == "active"
        if is_active_production and not rekor_present:
            raise ValueError(
                "AT-DECR 011 § D3: an active + rekor_production SkillVersion MUST "
                "carry a non-null rekor_log_index (an active production row without "
                "a transparency-log index is an unverifiable production claim)"
            )
        if rekor_present and not is_active_production:
            raise ValueError(
                "AT-DECR 011 § D3: rekor_log_index may be non-null ONLY when "
                "signing_mode='rekor_production' AND status='active' (a rekor index "
                "on a non-active/non-production row is forged provenance)"
            )

        return self


class HumanReview(_HumanReviewGenerated):
    """HumanReview — net-new canonical entity (ISEDC DR-103 D1), with the anti-gaming
    cross-field invariants the JSON Schema expresses via ``allOf``/``if-then``
    (which datamodel-code-generator cannot emit). Exact Python mirror of the Zod
    ``.superRefine`` block in ``src/validators/v1/human-review.ts``:

    1. **DR-103 D1 B1.2 PIN** — a review MUST pin to a verified source:
       ``session_trace_id`` non-null OR ``judge_decision_id`` non-null. A review
       pinned to nothing is forgery-cost-zero and is refused.
    2. **Spec Item 2 AT-LEAST-ONE-SIGNAL** — at least one of the three orthogonal
       channels (``score_text`` / ``thumbs`` / ``annotation``) MUST be non-null.

    The HUMAN-ONLY invariant (``reviewer_is_service_account`` MUST be ``False``)
    is enforced by the generated ``Literal[False]`` field type itself — a
    service-account-authored row never parses (mirrors the Zod ``z.literal(false)``).

    The generated parent already enforces ``extra="forbid"`` (closed-world) and the
    branded ``Uuidv7``/``Sha256``/``Rfc3339``/``ActorIdentity`` patterns.

    **Optional-not-nullable parity** (DR-103 D2 / DR-085 D5): the JSON Schema + Zod
    treat ``tenant_id`` as OPTIONAL but NOT NULLABLE (the schema ``$ref``s uuidv7
    with no ``null`` branch; Zod uses ``.optional()`` not ``.nullable()``).
    datamodel-code-generator renders it ``Uuidv7 | None = None`` (nullable). The
    override re-declares it optional-but-not-nullable so an explicit ``null`` is
    rejected exactly as AJV and Zod reject it.

    **Required-but-nullable parity**: ``session_trace_id`` / ``judge_decision_id`` /
    ``supersedes_id`` AND the three orthogonal signal channels ``score_text`` /
    ``thumbs`` / ``annotation`` are ALL in the schema ``required`` array (key MUST be
    present) AND ``oneOf[<value>, null]`` (value MAY be null). The generated
    ``... | None = None`` makes the KEY omittable — drift vs AJV + Zod, which require
    the key. Re-declare each without a default so the key is required, value still
    nullable. (The at-least-one-signal invariant in ``_enforce_dr103_anti_gaming``
    constrains the VALUES; this constrains the KEYS — both are needed for parity.)
    """

    # DR-103 D2 optional-NOT-nullable parity (mirrors the schema $ref + Zod
    # `.optional()`): absence allowed, explicit `null` rejected.
    tenant_id: _schema.Uuidv7 = None  # type: ignore[assignment]

    # Required-but-nullable parity: key required, value nullable.
    session_trace_id: _schema.Uuidv7 | None
    judge_decision_id: _schema.Uuidv7 | None
    supersedes_id: _schema.Uuidv7 | None
    # Required-but-nullable parity for the three signal channels (schema `required`
    # array + oneOf[<value>, null]; Zod `.nullable()` not `.optional()`). Without
    # this, a body omitting `score_text`/`thumbs`/`annotation` is wrongly accepted
    # by Python while AJV + Zod reject the missing key (three-way drift).
    score_text: str | None
    thumbs: bool | None
    annotation: str | None

    @model_validator(mode="after")
    def _enforce_dr103_anti_gaming(self) -> Self:
        # Rule 1 (DR-103 D1 B1.2 PIN): pin to a verified source.
        if self.session_trace_id is None and self.judge_decision_id is None:
            raise ValueError(
                "DR-103 D1 B1.2: a HumanReview MUST pin to a verified source — "
                "session_trace_id OR judge_decision_id must be non-null (a review "
                "pinned to nothing is forgery-cost-zero)"
            )
        # Rule 2 (spec Item 2 AT-LEAST-ONE-SIGNAL): at least one channel non-null.
        if self.score_text is None and self.thumbs is None and self.annotation is None:
            raise ValueError(
                "DR-103 D1: a HumanReview MUST carry at least one signal — "
                "score_text, thumbs, or annotation (an empty review carries no "
                "human signal)"
            )
        return self


class UsageEvent(_UsageEventGenerated):
    """UsageEvent — net-new canonical entity (DR-103 D1), with the anti-gaming
    cross-field invariant the JSON Schema expresses via ``allOf``/``if-then``
    (which datamodel-code-generator cannot emit). Exact Python mirror of the Zod
    ``.superRefine`` block in ``src/validators/v1/usage-event.ts``:

    - **DR-103 D1 B1.2** — a metered row (``meter != "api_call"``) MUST bind to a
      VERIFIED gated source: non-null ``source_entity_type`` AND non-null
      ``source_entity_id`` AND ``source_verified is True``. An arbitrary
      hand-supplied ``quantity`` with no verified provenance is REFUSED. ``api_call``
      is the only exempt meter (the leaf action has no gated parent session).

    The generated parent already enforces ``extra="forbid"`` (closed-world), the
    ``meter`` / ``unit`` / ``source_entity_type`` enums, and the ``conint(ge=0)``
    on ``quantity`` (a count, never a fractional utility — DR-103 epic Rule 1).

    **DR-103 D2 optional-not-nullable parity**: the JSON Schema + Zod treat
    ``tenant_id`` as OPTIONAL but NOT NULLABLE (the schema ``$ref``s uuidv7 with no
    ``null`` branch; Zod uses ``.optional()`` not ``.nullable()``).
    datamodel-code-generator renders it ``Uuidv7 | None = None`` (nullable). The
    override re-declares it optional-but-not-nullable so an explicit ``null`` is
    rejected exactly as AJV and Zod reject it.

    **Required-but-nullable parity**: ``source_entity_type`` / ``source_entity_id``
    / ``cost_record_ref`` are in the schema ``required`` array (key MUST be present)
    AND nullable (value MAY be null, e.g. for an ``api_call`` row). The generated
    ``... | None = None`` makes the KEY omittable — drift vs AJV + Zod, which
    require the key. Re-declare each without a default: key required, value still
    nullable.
    """

    # DR-103 D2 optional-NOT-nullable parity (mirrors the schema $ref + Zod
    # `.optional()`): absence allowed, explicit `null` rejected.
    tenant_id: _schema.Uuidv7 = None  # type: ignore[assignment]

    # Required-but-nullable parity: these keys MUST be present (in `required`) but
    # MAY be null (for an api_call row). Re-declare without a default so the key is
    # required, value still nullable — matching AJV + Zod.
    source_entity_type: SourceEntityType | None
    source_entity_id: _schema.Uuidv7 | None
    cost_record_ref: _schema.Uuidv7 | None

    @model_validator(mode="after")
    def _enforce_dr103_anti_gaming(self) -> Self:
        # DR-103 D1 B1.2: a metered (non-`api_call`) row MUST bind to a verified
        # gated source. `api_call` is the lone exempt meter.
        meter = self.meter.value if hasattr(self.meter, "value") else self.meter
        if meter != "api_call":
            if self.source_entity_type is None:
                raise ValueError(
                    f'DR-103 D1 B1.2: a metered "{meter}" row MUST name a non-null '
                    "source_entity_type (anti-gaming: no metered count without a gated source)"
                )
            if self.source_entity_id is None:
                raise ValueError(
                    f'DR-103 D1 B1.2: a metered "{meter}" row MUST name a non-null '
                    "source_entity_id (anti-gaming: no metered count without a gated source)"
                )
            if self.source_verified is not True:
                raise ValueError(
                    f'DR-103 D1 B1.2: a metered "{meter}" row MUST carry '
                    "source_verified === true (the runtime sets it only after the source "
                    "session clears its quality gate; a hand-supplied quantity with no "
                    "verified provenance is refused)"
                )
        return self


class SkillRefinerPassV1(_SkillRefinerPassV1Generated):
    """skill-refiner-pass/v1 predicate body (Class-1 ADR DR-082, amended in place
    by DR-085 D2/D3/D4/D5).

    Layers the DR-085 D5 cross-field invariant the JSON Schema expresses via
    ``if/then`` (datamodel-code-generator cannot emit it) and the DR-085 D5
    optional-not-nullable wire-format parity overrides. Exact Python mirror of the
    Zod ``.superRefine`` block in ``src/validators/v1/skill-refiner-pass-v1.ts``:

    - **DR-085 D5** — ``verdict == "accept"`` ⇒ EVERY
      ``named_dimension_deltas[].non_regressed`` is ``True`` (an accept that
      claims a named dimension regressed is a signed falsehood with forgery cost
      zero). A ``reject`` body carries no such constraint.

    **DR-085 D5 optional-not-nullable parity** (wire-format fix): the JSON Schema
    + Zod treat ``cost_record_ref`` / ``replay_fidelity_level`` /
    ``signing_downgrade_reason`` as OPTIONAL but NOT NULLABLE (omit-or-value;
    explicit ``null`` is rejected). datamodel-code-generator renders them
    ``T | None = None`` (nullable). The overrides below re-declare each as
    optional-but-not-nullable so an explicit ``null`` is rejected exactly as AJV
    and Zod reject it — absence still defaults internally to ``None``. (The
    ``# type: ignore`` silences the non-Optional-annotated-with-None-default
    pattern, which is the intended idiom.)
    """

    # DR-085 D5 optional-NOT-nullable parity (mirrors Zod `.optional()`, not
    # `.nullable()`): absence allowed, explicit `null` rejected. The annotation
    # excludes None; the default makes the field optional.
    cost_record_ref: _schema.Uuidv7 = None  # type: ignore[assignment]
    replay_fidelity_level: _ReplayFidelityLevel = None  # type: ignore[assignment]
    signing_downgrade_reason: str = None  # type: ignore[assignment]

    # DR-085 D3 REQUIRED-but-nullable parity: `parent_version_id` is in the schema
    # `required` array (key MUST be present) AND `oneOf[uuidv7, null]` (value MAY be
    # null, for a root SkillVersion). The generated `... | None = None` makes the key
    # omittable — drift vs AJV + Zod. Re-declare without a default: key required,
    # value still nullable.
    parent_version_id: _schema.Uuidv7 | None

    @model_validator(mode="after")
    def _enforce_dr085_accept_invariant(self) -> Self:
        # DR-085 D5: accept ⇒ every named_dimension_delta.non_regressed is True.
        verdict = self.verdict.value if hasattr(self.verdict, "value") else self.verdict
        if verdict == "accept":
            for i, d in enumerate(self.named_dimension_deltas):
                if d.non_regressed is not True:
                    raise ValueError(
                        f'DR-085 D5: an "accept" verdict requires every '
                        f"named_dimension_deltas[].non_regressed === true; entry "
                        f"[{i}] (id={d.id!r}) has non_regressed={d.non_regressed!r}"
                    )
        return self


__all__ = [
    # Entities (Blueprint B § 2.1 – § 2.13 + SkillVersion 14th DR-028 T1 + UsageEvent 15th DR-103 D1)
    "EvalSpec",
    "EvalRun",
    "MatcherMap",
    "EvidenceBundle",
    "JudgeDecision",
    "RuntimeReceipt",
    "RegressionPack",
    "RolloutGate",
    "SkillSnapshot",
    "SkillVersion",
    "HumanReview",
    "SessionTrace",
    "ToolInvocation",
    "CostRecord",
    "UsageEvent",
    "FailureTaxonomy",
    # Predicate bodies
    "GateResultV1",
    "RetractionV1",
    "DashboardRenderV1",
    "SkillRefinerPassV1",
    # Constants
    "GATE_RESULT_V1_URI",
]
