"""Exercise the exact shared corpus used by AJV and public Zod validators."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import TypeAdapter, ValidationError

from intent_eval_core import EvalSpec, TrajectoryAssertion

FIXTURES = Path(__file__).resolve().parents[2] / "tests" / "fixtures"
CASES = json.loads((FIXTURES / "trajectory-assertions.json").read_text())
BASE = json.loads((FIXTURES / "v1" / "eval-spec.valid.json").read_text())


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
def test_shared_acceptance_and_roundtrip(case: dict) -> None:
    spec = {**BASE, "assertions": [case["assertion"]]}
    if not case["valid"]:
        with pytest.raises(ValidationError):
            EvalSpec.model_validate(spec)
        return
    parsed = EvalSpec.model_validate(spec)
    wire = parsed.model_dump(mode="json", by_alias=True, exclude_unset=True)
    assert wire["assertions"] == spec["assertions"]


@pytest.mark.parametrize("name", [
    "tool-called", "tool-not-called", "order-before", "file-exists", "file-matches-sha-in"
])
def test_standalone_public_assertion(name: str) -> None:
    assertion = next(case["assertion"] for case in CASES if case["name"] == name)
    parsed = TypeAdapter(TrajectoryAssertion).validate_python(assertion)
    assert parsed.model_dump(mode="json", by_alias=True, exclude_unset=True) == assertion


@pytest.mark.parametrize("marker", [1, 1.0, "true", False, None])
def test_non_boolean_extension_cannot_bypass_typed_target(marker: object) -> None:
    assertion = {"class": "tool-called", "target": None, "extension": marker}
    with pytest.raises(ValidationError):
        EvalSpec.model_validate({**BASE, "assertions": [assertion]})
