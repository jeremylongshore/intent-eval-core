"""Generator failures and read-only checks must preserve existing output."""

from __future__ import annotations

import importlib.util
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "codegen_pydantic.py"


def tree(path: Path) -> dict[str, tuple[bytes, int]]:
    """Capture contents and mtimes, including documentation nested below output."""
    return {
        str(p.relative_to(path)): (p.read_bytes(), p.stat().st_mtime_ns)
        for p in path.rglob("*") if p.is_file()
    }


def write_files(root: Path, files: dict[str, str]) -> None:
    for name, text in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")


@pytest.fixture
def codegen(tmp_path, monkeypatch):
    spec = importlib.util.spec_from_file_location("codegen_preservation_subject", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    schemas = tmp_path / "schemas"
    write_files(schemas, {"sample.schema.json": json.dumps({
        "$id": "https://evals.intentsolutions.io/sample.schema.json",
        "type": "object",
    })})
    monkeypatch.setattr(module, "SCHEMAS_DIR", schemas)
    monkeypatch.setattr(module, "OUT_DIR", tmp_path / "output")
    monkeypatch.setattr(module, "_verify_pin", lambda: None)
    return module


def emitter(module, monkeypatch, files):
    def emit(normalized, output):
        assert output != module.OUT_DIR
        assert "$id" not in json.loads((normalized / "sample.schema.json").read_text())
        output.mkdir(parents=True, exist_ok=True)
        write_files(output, files)
    monkeypatch.setattr(module, "_run_codegen", emit)


def seed(module):
    write_files(module.OUT_DIR, {
        "keep.py": "KEEP = 1\n",
        "changed.py": "VERSION = 1\n",
        "obsolete.py": "OLD = True\n",
        "README.md": "Reference material, not the public API.\n",
        "docs/details.md": "Keep this nested documentation.\n",
        "docs/example.py": "EXAMPLE = 'documentation'\n",
    })
    # A deterministic old timestamp makes incidental rewrites observable.
    for path in module.OUT_DIR.rglob("*"):
        if path.is_file():
            os.utime(path, ns=(1_700_000_000_000_000_000, 1_700_000_000_000_000_000))


def test_updates_modules_preserves_documentation_and_prunes_obsolete(codegen, monkeypatch):
    seed(codegen)
    before = tree(codegen.OUT_DIR)
    emitter(codegen, monkeypatch, {
        "keep.py": "KEEP = 1\n",
        "changed.py": "VERSION = 2\n",
        "new.py": "from .._common import schema\n",
    })
    codegen.generate(codegen.OUT_DIR)
    after = tree(codegen.OUT_DIR)
    for name in ("keep.py", "README.md", "docs/details.md", "docs/example.py"):
        assert after[name] == before[name]
    assert after["changed.py"][0] == b"VERSION = 2\n"
    assert after["new.py"][0] == b"from . import _common_schema as schema\n"
    assert "obsolete.py" not in after
    codegen.generate(codegen.OUT_DIR)
    assert tree(codegen.OUT_DIR) == after


@pytest.mark.parametrize("existing", [True, False])
def test_generator_failure_never_changes_output(codegen, monkeypatch, existing):
    if existing:
        seed(codegen)
    before = tree(codegen.OUT_DIR)

    def fail_after_partial_output(normalized, output):
        write_files(output, {"partial.py": "PARTIAL = True\n"})
        raise SystemExit("injected generator failure")

    monkeypatch.setattr(codegen, "_run_codegen", fail_after_partial_output)
    with pytest.raises(SystemExit, match="injected generator failure"):
        codegen.generate(codegen.OUT_DIR)
    assert tree(codegen.OUT_DIR) == before
    assert codegen.OUT_DIR.exists() is existing
    assert not list(codegen.OUT_DIR.parent.glob(".iec-codegen-*"))


@pytest.mark.parametrize("files,exception", [
    ({}, ValueError),
    ({"__init__.py": ""}, ValueError),
    ({"model.py": "class Broken(\n"}, SyntaxError),
    ({"model.py": "GOOD = True\n", "nested/model.py": "NESTED = True\n"}, ValueError),
])
def test_incomplete_or_invalid_output_cannot_replace_existing_files(
    codegen, monkeypatch, files, exception
):
    seed(codegen)
    before = tree(codegen.OUT_DIR)
    emitter(codegen, monkeypatch, files)
    with pytest.raises(exception):
        codegen.generate(codegen.OUT_DIR)
    assert tree(codegen.OUT_DIR) == before


def test_import_repair_failure_never_changes_output(codegen, monkeypatch):
    seed(codegen)
    before = tree(codegen.OUT_DIR)
    emitter(codegen, monkeypatch, {"model.py": "MODEL = True\n"})

    def fail_repair(output):
        raise OSError("injected import repair failure")

    monkeypatch.setattr(codegen, "_fix_common_import", fail_repair)
    with pytest.raises(OSError, match="injected import repair failure"):
        codegen.generate(codegen.OUT_DIR)
    assert tree(codegen.OUT_DIR) == before


def test_staged_symlink_is_rejected_before_import_repair(codegen, monkeypatch):
    seed(codegen)
    target = codegen.OUT_DIR / "changed.py"
    target.write_text("from .._common import schema\n")
    before = tree(codegen.OUT_DIR)

    def emit_symlink(normalized, output):
        output.mkdir()
        (output / "model.py").symlink_to(target)

    monkeypatch.setattr(codegen, "_run_codegen", emit_symlink)
    with pytest.raises(ValueError, match="Expected a regular generated Python file"):
        codegen.generate(codegen.OUT_DIR)
    assert tree(codegen.OUT_DIR) == before


def test_missing_schemas_cannot_erase_output(codegen):
    seed(codegen)
    before = tree(codegen.OUT_DIR)
    (codegen.SCHEMAS_DIR / "sample.schema.json").unlink()
    write_files(codegen.SCHEMAS_DIR, {"index.json": "{}"})
    with pytest.raises(ValueError, match="No input schemas"):
        codegen.generate(codegen.OUT_DIR)
    assert tree(codegen.OUT_DIR) == before


@pytest.mark.parametrize("kind", ["directory", "symlink", "broken-symlink", "root-symlink"])
def test_special_output_paths_are_refused_before_any_writes(codegen, monkeypatch, kind):
    outside = codegen.OUT_DIR.parent / "outside.py"
    outside.write_text("UNRELATED = True\n")
    if kind == "root-symlink":
        destination = codegen.OUT_DIR.parent / "real-output"
        write_files(destination, {"README.md": "preserve\n"})
        codegen.OUT_DIR.symlink_to(destination, target_is_directory=True)
    else:
        seed(codegen)
        path = codegen.OUT_DIR / "special.py"
        if kind == "directory":
            path.mkdir()
        else:
            path.symlink_to(outside if kind == "symlink" else outside.with_name("missing.py"))
    emitter(codegen, monkeypatch, {"model.py": "MODEL = True\n"})
    before = tree(codegen.OUT_DIR)
    with pytest.raises(ValueError, match="Expected a regular"):
        codegen.generate(codegen.OUT_DIR)
    assert tree(codegen.OUT_DIR) == before
    assert outside.read_text() == "UNRELATED = True\n"


def test_concurrent_edits_are_preserved_instead_of_overwritten(codegen, monkeypatch):
    seed(codegen)

    def edit_while_generating(normalized, output):
        write_files(output, {"changed.py": "VERSION = 2\n"})
        (codegen.OUT_DIR / "changed.py").write_text("USER_EDIT = True\n")

    monkeypatch.setattr(codegen, "_run_codegen", edit_while_generating)
    with pytest.raises(ValueError, match="concurrent edits"):
        codegen.generate(codegen.OUT_DIR)
    assert (codegen.OUT_DIR / "changed.py").read_text() == "USER_EDIT = True\n"
    assert (codegen.OUT_DIR / "obsolete.py").exists()
    assert (codegen.OUT_DIR / "README.md").exists()


@pytest.mark.parametrize("state", ["current", "changed", "missing", "obsolete", "absent"])
def test_check_is_non_mutating_for_current_or_stale_output(codegen, monkeypatch, state, capsys):
    expected = "MODEL = True\n"
    if state != "absent":
        write_files(codegen.OUT_DIR, {"README.md": "preserve\n"})
        if state != "missing":
            write_files(codegen.OUT_DIR, {"model.py": expected if state != "changed" else "OLD = True\n"})
        if state == "obsolete":
            write_files(codegen.OUT_DIR, {"obsolete.py": "OLD = True\n"})
    before = tree(codegen.OUT_DIR)
    emitter(codegen, monkeypatch, {"model.py": expected})
    monkeypatch.setattr(sys, "argv", [str(SCRIPT), "--check"])
    assert codegen.main() == (0 if state == "current" else 1)
    assert tree(codegen.OUT_DIR) == before
    assert codegen.OUT_DIR.exists() is (state != "absent")
    output = capsys.readouterr()
    assert ("up to date" in output.out) if state == "current" else ("STALE" in output.err)


def test_real_cli_preserves_docs_and_output_on_invalid_input(tmp_path):
    pytest.importorskip("datamodel_code_generator")
    project = tmp_path / "repo"
    script = project / "scripts" / SCRIPT.name
    script.parent.mkdir(parents=True)
    shutil.copyfile(SCRIPT, script)
    shutil.copytree(ROOT / "schemas" / "v1", project / "schemas" / "v1")
    output = project / "python" / "src" / "intent_eval_core" / "_generated"
    write_files(output, {"README.md": "reference documentation\n", "obsolete.py": "OLD = True\n"})
    doc = tree(output)["README.md"]
    result = subprocess.run([sys.executable, str(script)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    assert tree(output)["README.md"] == doc
    assert not (output / "obsolete.py").exists()
    # A real regeneration must reproduce all committed generated module bytes.
    committed = ROOT / "python" / "src" / "intent_eval_core" / "_generated"
    assert {p.name: p.read_bytes() for p in output.glob("*.py")} == {
        p.name: p.read_bytes() for p in committed.glob("*.py")
    }
    before = tree(output)
    checked = subprocess.run([sys.executable, str(script), "--check"], capture_output=True, text=True)
    assert checked.returncode == 0, checked.stdout + checked.stderr
    assert tree(output) == before
    (project / "schemas" / "v1" / "eval-spec.schema.json").write_text("{")
    failed = subprocess.run([sys.executable, str(script)], capture_output=True, text=True)
    assert failed.returncode != 0
    assert tree(output) == before
