"""Security pin, schema rejection, and published Python compatibility checks."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

import intent_eval_core as core

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def generator():
    spec = importlib.util.spec_from_file_location(
        "codegen_security_subject", ROOT / "scripts" / "codegen_pydantic.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("installed", ["0.25.9", "0.64.0", "0.86.1", "unknown"])
def test_off_pin_refuses_before_generating(generator, monkeypatch, tmp_path, installed):
    output = tmp_path / "generated"
    output.mkdir()
    document = output / "README.md"
    document.write_text("retain existing output")
    monkeypatch.setattr(generator, "OUT_DIR", output)
    monkeypatch.setattr(generator, "version", lambda name: installed)
    monkeypatch.setattr(sys, "argv", [str(ROOT / "scripts" / "codegen_pydantic.py")])
    with pytest.raises(SystemExit, match="Refusing generation"):
        generator.main()
    assert list(output.iterdir()) == [document]
    assert document.read_text() == "retain existing output"


def test_missing_generator_is_explicit(generator, monkeypatch):
    def missing(name):
        raise generator.PackageNotFoundError(name)
    monkeypatch.setattr(generator, "version", missing)
    with pytest.raises(SystemExit, match="not installed"):
        generator._verify_pin()


def test_exact_installed_pin_is_accepted(generator):
    generator._verify_pin()


@pytest.mark.parametrize("schema", [
    {"type": "object", "properties": {
        "value": {"type": "string", "default_factory": "str(1)"}
    }},
    {"type": "object", "properties": {
        "value": {"type": "string", "customTypePath": "builtins.str\nprint('unexpected')"}
    }},
    {"type": "object", "properties": {"value": {"$ref": "#/$defs/Value"}},
     "$defs": {"Value": {"type": "object", "x-python-import": {
         "module": "builtins", "name": "str\nprint('unexpected')"
     }}}},
    {"type": "object", "properties": {
        "value": {"$ref": "https://schema.example.invalid/external.json"}
    }},
])
def test_unsafe_schema_inputs_fail_without_replacing_output(
    generator, monkeypatch, tmp_path, schema, capsys
):
    schemas = tmp_path / "schemas"
    schemas.mkdir()
    (schemas / "sample.schema.json").write_text(json.dumps(schema))
    output = tmp_path / "generated"
    output.mkdir()
    (output / "model.py").write_text("EXISTING = True\n")
    (output / "README.md").write_text("retain documentation\n")
    before = {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in output.iterdir()}
    monkeypatch.setattr(generator, "SCHEMAS_DIR", schemas)
    with pytest.raises(SystemExit, match="datamodel-codegen failed"):
        generator.generate(output)
    encoded = json.dumps(schema)
    if "default_factory" in encoded:
        expected = "default_factory must be one of: dict, list, set"
    elif "customTypePath" in encoded:
        expected = "customTypePath must be a dotted Python identifier path"
    elif "x-python-import" in encoded:
        expected = "x-python-import must be a dotted Python identifier path"
    else:
        expected = "Fetching remote $ref is disabled"
    assert expected in capsys.readouterr().err
    assert {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in output.iterdir()} == before


# These omissions were accepted by the published 0.11.0 Python distribution.
# The JSON Schemas require them; wcze.11 owns the separate breaking-contract
# decision. A security-only generator update must not silently tighten them.
LEGACY_OMISSIONS = [
    ("CostRecord", "cost-record", "eval_run_id provider_id tool_invocation_id"),
    ("EvalRun", "eval-run", "archived_at evidence_bundle_id judged_at lease_expires_at "
     "parent_run_id reported_at started_at terminal_reason worker_id"),
    ("JudgeDecision", "judge-decision", "confidence reasoning seed"),
    ("RegressionPack", "regression-pack", "ancestor_pack_id"),
    ("RolloutGate", "rollout-gate", "rekor_log_index"),
    ("SessionTrace", "session-trace", "closed_at"),
    ("SkillSnapshot", "skill-snapshot", "version_label"),
    ("ToolInvocation", "tool-invocation", "error result_storage_key"),
]


@pytest.mark.parametrize("model_name,fixture_name,field", [
    (model, fixture, field)
    for model, fixture, fields in LEGACY_OMISSIONS
    for field in fields.split()
])
def test_published_nullable_omission_behavior_is_preserved(model_name, fixture_name, field):
    payload = json.loads((ROOT / "tests/fixtures/v1" / f"{fixture_name}.valid.json").read_text())
    schema = json.loads((ROOT / "schemas/v1" / f"{fixture_name}.schema.json").read_text())
    assert field in schema["required"]  # Keep the known parity gap explicit.
    payload.pop(field)
    model = getattr(core, model_name)
    assert getattr(model.model_validate(payload), field) is None
