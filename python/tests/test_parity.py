"""Cross-language parity tests for the Pydantic v2 models.

These run the **same golden fixtures** the TypeScript/AJV side validates in
``src/__tests__/schemas.test.ts`` through the Python Pydantic models and assert
the Python models accept/reject **exactly** what AJV (the JSON-Schema reference)
and Zod (the TypeScript reference) accept/reject. The whole point of the kernel
is one source of truth — if these drift, the Python distribution is lying about
being the same contracts.

The fixtures live at the REPO-LEVEL ``tests/fixtures/v1/`` (shared with the
TypeScript test suite), NOT under ``python/`` — there is exactly one fixture set
and both languages consume it.

Mirrors the structure of ``src/__tests__/schemas.test.ts``:
  - every valid fixture validates against its canonical model
  - every negative fixture is rejected
  - the Blueprint B cross-entity invariants hold (enum non-crossing, etc.)
  - the gate-result/v1 ``allOf``/``if-then`` conditional rules hold (the
    cross-field rules the Zod ``.superRefine()`` enforces)
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

import intent_eval_core as iec

# Repo root = python/tests/ -> python/ -> repo. Shared fixture dir.
REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURES = REPO_ROOT / "tests" / "fixtures" / "v1"


def load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def accepts(model, data: dict) -> bool:
    try:
        model.model_validate(data)
        return True
    except ValidationError:
        return False


# Canonical model -> valid fixture stem. One entry per shipped schema.
VALID_FIXTURES = {
    iec.EvalSpec: "eval-spec",
    iec.EvalRun: "eval-run",
    iec.MatcherMap: "matcher-map",
    iec.EvidenceBundle: "evidence-bundle",
    iec.JudgeDecision: "judge-decision",
    iec.RuntimeReceipt: "runtime-receipt",
    iec.RegressionPack: "regression-pack",
    iec.RolloutGate: "rollout-gate",
    iec.SkillSnapshot: "skill-snapshot",
    iec.SkillVersion: "skill-version",
    iec.SessionTrace: "session-trace",
    iec.ToolInvocation: "tool-invocation",
    iec.CostRecord: "cost-record",
    iec.FailureTaxonomy: "failure-taxonomy",
    iec.GateResultV1: "gate-result",
    iec.RetractionV1: "retraction",
    iec.DashboardRenderV1: "dashboard-render",
    iec.SkillRefinerPassV1: "skill-refiner-pass",
}


class TestPackageSurface:
    def test_version_is_exported(self) -> None:
        assert isinstance(iec.__version__, str)
        assert iec.__version__.count(".") == 2  # X.Y.Z SemVer core

    def test_all_canonical_models_exported(self) -> None:
        # 14 entities + 4 predicate bodies = 18 models, all importable by name.
        # skill-refiner-pass/v1 added staging-first by Class-1 ADR DR-082.
        # SkillVersion is the 14th canonical entity (DR-028 T1 DISCRIMINATOR).
        for name in (
            "EvalSpec EvalRun MatcherMap EvidenceBundle JudgeDecision "
            "RuntimeReceipt RegressionPack RolloutGate SkillSnapshot SkillVersion "
            "SessionTrace ToolInvocation CostRecord FailureTaxonomy "
            "GateResultV1 RetractionV1 DashboardRenderV1 SkillRefinerPassV1"
        ).split():
            assert hasattr(iec, name), f"missing export: {name}"

    def test_predicate_uri_is_evals_not_labs(self) -> None:
        # CISO binding (DR-004 + DR-010): predicate URIs NEVER on labs.*
        assert iec.GATE_RESULT_V1_URI == "https://evals.intentsolutions.io/gate-result/v1"
        assert "labs.intentsolutions.io" not in iec.GATE_RESULT_V1_URI


class TestValidFixtures:
    @pytest.mark.parametrize(
        ("model", "stem"),
        [(m, s) for m, s in VALID_FIXTURES.items()],
        ids=[s for s in VALID_FIXTURES.values()],
    )
    def test_valid_fixture_validates(self, model, stem: str) -> None:
        assert accepts(model, load(f"{stem}.valid.json")), (
            f"{model.__name__} rejected its valid fixture {stem}.valid.json"
        )

    def test_gate_result_minimal_required_only(self) -> None:
        assert accepts(iec.GateResultV1, load("gate-result.valid.json"))

    def test_gate_result_advisory_full_optional_fields(self) -> None:
        assert accepts(iec.GateResultV1, load("gate-result.advisory.valid.json"))

    def test_evidence_bundle_with_prereg(self) -> None:
        assert accepts(iec.EvidenceBundle, load("evidence-bundle.with-prereg.valid.json"))


class TestNegativeFixtures:
    def test_gate_result_missing_gate_name_rejected(self) -> None:
        assert not accepts(iec.GateResultV1, load("gate-result.invalid-missing-gate_name.json"))

    def test_gate_result_bad_decision_ship_rejected(self) -> None:
        # ship is RolloutGate.decision, not gate-result/v1.gate_decision.
        assert not accepts(iec.GateResultV1, load("gate-result.invalid-bad-decision.json"))

    def test_gate_result_md5_hash_prefix_rejected(self) -> None:
        # Only sha256: prefix accepted.
        assert not accepts(iec.GateResultV1, load("gate-result.invalid-bad-hash-format.json"))

    def test_eval_spec_bad_aggregation_rejected(self) -> None:
        # plurality is not in the closed aggregation_rule enum.
        assert not accepts(iec.EvalSpec, load("eval-spec.invalid-bad-aggregation.json"))

    def test_retraction_bad_reason_class_rejected(self) -> None:
        # closed enum, GC binding.
        assert not accepts(iec.RetractionV1, load("retraction.invalid-bad-reason-class.json"))

    def test_dashboard_render_empty_inputs_rejected(self) -> None:
        # minItems: 1 on input_bundles.
        assert not accepts(iec.DashboardRenderV1, load("dashboard-render.invalid-empty-inputs.json"))

    def test_skill_refiner_pass_bad_test_kind_rejected(self) -> None:
        # test_statistic_kind is a const (one-sided-z) for v1, DR-082 Q2.
        assert not accepts(
            iec.SkillRefinerPassV1, load("skill-refiner-pass.invalid-bad-test-kind.json")
        )

    def test_skill_refiner_pass_missing_strategy_id_rejected(self) -> None:
        # refiner_strategy_id is required (DR-028 mechanism-traceability binding).
        base = load("skill-refiner-pass.valid.json")
        base.pop("refiner_strategy_id")
        assert not accepts(iec.SkillRefinerPassV1, base)

    def test_skill_version_bad_version_kind_rejected(self) -> None:
        # version_kind is a CLOSED enum (edit|revert|restore); DR-028 T1.
        assert not accepts(
            iec.SkillVersion, load("skill-version.invalid-bad-version-kind.json")
        )

    def test_skill_version_root_null_parent_accepted(self) -> None:
        # parent_version_id is nullable for a ROOT version (DR-028 T1).
        assert accepts(iec.SkillVersion, load("skill-version.root.valid.json"))

    def test_skill_version_missing_strategy_id_rejected(self) -> None:
        # refiner_strategy_id is required (DR-028 P0-RATIFY-5 CISO mechanism-traceability).
        base = load("skill-version.valid.json")
        base.pop("refiner_strategy_id")
        assert not accepts(iec.SkillVersion, base)

    def test_skill_version_bad_source_snapshot_hash_prefix_rejected(self) -> None:
        # source_snapshot_hash is Sha256Prefixed (sha256:<64-hex>); a bare digest is rejected.
        base = load("skill-version.valid.json")
        base["source_snapshot_hash"] = "7" * 64
        assert not accepts(iec.SkillVersion, base)


class TestClosedWorld:
    """additionalProperties: false on entities => extra='forbid'."""

    def test_gate_result_extra_unknown_key_rejected(self) -> None:
        base = load("gate-result.valid.json")
        assert not accepts(iec.GateResultV1, {**base, "totally_unknown_field": 1})

    def test_eval_spec_extra_top_level_key_rejected(self) -> None:
        base = load("eval-spec.valid.json")
        assert not accepts(iec.EvalSpec, {**base, "surprise": True})

    def test_skill_version_extra_unknown_key_rejected(self) -> None:
        base = load("skill-version.valid.json")
        assert not accepts(iec.SkillVersion, {**base, "status": "active"})

    def test_eval_spec_scoring_extra_key_accepted(self) -> None:
        # scoring is the OPEN object (additionalProperties default) — a
        # tool-emitted extra key is accepted (matches AJV; § 7.4 metadata rule).
        base = load("eval-spec.valid.json")
        mutated = {**base, "scoring": {**base["scoring"], "pass_threshold": 0.8}}
        assert accepts(iec.EvalSpec, mutated)


class TestGateResultConditionalRules:
    """The allOf/if-then rules — the exact Python mirror of the Zod superRefine
    block in gate-result-v1.ts. datamodel-code-generator cannot emit these; the
    hand-written model_validator in models.py supplies them."""

    def test_advisory_requires_severity(self) -> None:
        base = load("gate-result.valid.json")
        assert not accepts(
            iec.GateResultV1,
            {**base, "gate_decision": "advisory", "gate_reasons": ["x"]},
        )

    def test_fail_empty_reasons_rejected(self) -> None:
        base = load("gate-result.valid.json")
        assert not accepts(iec.GateResultV1, {**base, "gate_decision": "fail"})

    def test_error_empty_reasons_rejected(self) -> None:
        base = load("gate-result.valid.json")
        assert not accepts(iec.GateResultV1, {**base, "gate_decision": "error"})

    def test_advisory_severity_but_empty_reasons_rejected(self) -> None:
        base = load("gate-result.valid.json")
        assert not accepts(
            iec.GateResultV1,
            {**base, "gate_decision": "advisory", "advisory_severity": "warn"},
        )

    def test_fail_with_one_reason_accepted(self) -> None:
        base = load("gate-result.valid.json")
        assert accepts(
            iec.GateResultV1,
            {**base, "gate_decision": "fail", "gate_reasons": ["escape.detected"]},
        )

    def test_coverage_missing_dimensions_skipped_rejected(self) -> None:
        # NOT_APPLICABLE encoding requires both arrays present even if empty.
        base = load("gate-result.valid.json")
        bad = {**base, "coverage": {"dimensions_evaluated": base["coverage"]["dimensions_evaluated"]}}
        assert not accepts(iec.GateResultV1, bad)

    def test_coverage_detail_id_not_in_coverage_rejected(self) -> None:
        # deferral-D cross-field invariant: a coverage_detail id must appear in
        # the matching coverage array.
        base = load("gate-result.valid.json")
        bad = {
            **base,
            "coverage": {
                "dimensions_evaluated": ["credential-leak"],
                "dimensions_skipped": [],
            },
            "coverage_detail": [{"id": "not-declared", "status": "evaluated"}],
        }
        assert not accepts(iec.GateResultV1, bad)

    def test_coverage_detail_id_in_coverage_accepted(self) -> None:
        base = load("gate-result.valid.json")
        good = {
            **base,
            "coverage": {
                "dimensions_evaluated": ["credential-leak"],
                "dimensions_skipped": [],
            },
            "coverage_detail": [{"id": "credential-leak", "status": "evaluated"}],
        }
        assert accepts(iec.GateResultV1, good)


class TestBlueprintBInvariants:
    """The cross-entity invariants from schemas.test.ts § 'Blueprint B
    invariants codified in schemas'."""

    def test_judge_verdict_uppercase_does_not_cross_with_gate_lowercase(self) -> None:
        judge = load("judge-decision.valid.json")
        # Swap UPPERCASE verdict for lowercase 'pass' — must fail.
        assert not accepts(iec.JudgeDecision, {**judge, "verdict": "pass"})

    def test_rollout_decision_ship_rejected_on_gate_result(self) -> None:
        gate = load("gate-result.valid.json")
        assert not accepts(iec.GateResultV1, {**gate, "gate_decision": "ship"})

    def test_rollout_decision_pass_rejected_on_rollout_gate(self) -> None:
        rollout = load("rollout-gate.valid.json")
        assert not accepts(iec.RolloutGate, {**rollout, "decision": "pass"})

    def test_failure_taxonomy_accepts_mm7(self) -> None:
        # FailureTaxonomy.mm_class accepts MM-7+ (broader than MmClass enum).
        fix = load("failure-taxonomy.valid.json")
        assert accepts(iec.FailureTaxonomy, {**fix, "mm_class": "MM-7", "status": "proposed"})

    def test_matcher_map_rejects_mm7(self) -> None:
        # MatcherMap.mm_class REJECTS MM-7 (kernel enum lags taxonomy).
        fix = load("matcher-map.valid.json")
        assert not accepts(iec.MatcherMap, {**fix, "mm_class": "MM-7"})

    def test_evidence_bundle_subject_name_regex_enforced(self) -> None:
        fix = json.loads(json.dumps(load("evidence-bundle.valid.json")))
        if fix.get("subject_set"):
            fix["subject_set"][0]["name"] = "INVALID UPPERCASE"
        assert not accepts(iec.EvidenceBundle, fix)

    def test_evidence_bundle_prereg_nullable(self) -> None:
        fix = load("evidence-bundle.valid.json")
        assert accepts(iec.EvidenceBundle, {**fix, "pre_registration_hash": None})

    def test_evidence_bundle_prereg_malformed_rejected(self) -> None:
        fix = load("evidence-bundle.valid.json")
        assert not accepts(iec.EvidenceBundle, {**fix, "pre_registration_hash": "not-a-hash"})


class TestEvalSpecOneOfUnion:
    """eval-spec's assertions oneOf discriminated union — AJV exactly-one
    semantics must hold under Pydantic's union resolution."""

    def test_named_class_assertion_accepted(self) -> None:
        es = load("eval-spec.valid.json")
        assert accepts(iec.EvalSpec, {**es, "assertions": [{"class": "output-equals", "target": "x"}]})

    def test_extension_assertion_accepted(self) -> None:
        es = load("eval-spec.valid.json")
        assert accepts(
            iec.EvalSpec,
            {**es, "assertions": [{"class": "my-custom", "target": "x", "extension": True}]},
        )

    def test_arbitrary_class_without_extension_rejected(self) -> None:
        es = load("eval-spec.valid.json")
        # Arbitrary class that is NOT in the named enum AND lacks extension:true
        # matches neither oneOf branch.
        assert not accepts(iec.EvalSpec, {**es, "assertions": [{"class": "my-custom", "target": "x"}]})
