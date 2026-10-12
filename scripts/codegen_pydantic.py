#!/usr/bin/env python3
"""Codegen pipeline: schemas/v1/*.json -> Pydantic v2 models.

Mirrors the TypeScript `codegen:validators` pattern (json-schema-to-zod over the
same schemas). The output lands in `python/src/intent_eval_core/_generated/` and
is **reference material**, not the canonical public surface — exactly as the Zod
`_generated/` dir is reference-only. The canonical Python surface lives one level
up (`python/src/intent_eval_core/models.py`), re-exporting the generated models
under stable names + adding hand-written cross-field validators for the
allOf/if-then rules that datamodel-code-generator cannot express (mirroring the
Zod `.superRefine()` blocks).

Why a preprocessing step:
  The kernel schemas mix two `$ref` styles — entity schemas use *relative* refs
  (`_common.schema.json#/$defs/uuidv7`), predicate schemas use *absolute* refs
  (`https://github.com/.../schemas/v1/_common.schema.json#/$defs/...` and
  `https://evals.intentsolutions.io/...`). datamodel-code-generator resolves the
  absolute form by trying to treat the URL host/path as a local file, which
  fails (`KeyError: '$defs'`). The fix is to normalize every absolute ref that
  targets a kernel-local schema down to a bare relative filename ref, and to drop
  the absolute `$id` so codegen treats each file as a sibling in one directory.
  AJV resolves these refs against the containing schema's `$id` base; we resolve
  them by collapsing to relative paths. Both arrive at the same target file.

Usage:
    python scripts/codegen_pydantic.py            # regenerate _generated/
    python scripts/codegen_pydantic.py --check     # idempotency gate (CI)

The pinned datamodel-code-generator version is DCG_PIN below — bump it
deliberately, never float, so generated output is reproducible across machines
and CI (same input + same pinned generator => byte-identical output).
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

# Pinned generator version. Reproducibility contract: same schemas + this exact
# version => byte-identical _generated/ output. Bump deliberately (and re-run
# codegen) — never let it float.
DCG_PIN = "0.25.9"

REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMAS_DIR = REPO_ROOT / "schemas" / "v1"
OUT_DIR = REPO_ROOT / "python" / "src" / "intent_eval_core" / "_generated"

# Absolute base prefixes that point at kernel-local schemas. Any `$ref` starting
# with one of these is rewritten to the bare relative remainder so codegen
# resolves it to the sibling file. Entity schemas already use the relative form;
# predicate-body schemas (gate-result, retraction, dashboard-render) use the
# evals.intentsolutions.io absolute form.
ABS_PREFIXES = (
    "https://github.com/jeremylongshore/intent-eval-core/schemas/v1/",
    "https://evals.intentsolutions.io/",
)


def _normalize_refs(obj: object) -> object:
    """Recursively rewrite absolute kernel-local `$ref`s to relative + drop `$id`."""
    if isinstance(obj, dict):
        out: dict[str, object] = {}
        for k, v in obj.items():
            if k == "$ref" and isinstance(v, str):
                nv = v
                for prefix in ABS_PREFIXES:
                    if nv.startswith(prefix):
                        nv = nv[len(prefix):]
                        break
                out[k] = nv
            elif k == "$id":
                # Drop the absolute $id so codegen treats files as local siblings.
                continue
            else:
                out[k] = _normalize_refs(v)
        return out
    if isinstance(obj, list):
        return [_normalize_refs(x) for x in obj]
    return obj


def _normalize_into(dst: Path) -> None:
    """Copy schemas/v1/*.json into dst with refs normalized. Skips index.json
    (a catalog, not an entity/predicate schema — codegen has nothing to emit
    for it and its $id is informational)."""
    files = sorted(f for f in SCHEMAS_DIR.glob("*.json") if f.name != "index.json")
    if not files:
        raise ValueError(f"No input schemas found in {SCHEMAS_DIR}")
    dst.mkdir(parents=True, exist_ok=True)
    for f in files:
        data = json.loads(f.read_text(encoding="utf-8"))
        normalized = _normalize_refs(data)
        (dst / f.name).write_text(
            json.dumps(normalized, indent=2) + "\n", encoding="utf-8"
        )


def _run_codegen(src: Path, out: Path) -> None:
    """Invoke datamodel-codegen over the normalized schema dir."""
    out.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        "-m",
        "datamodel_code_generator",
        "--input",
        str(src),
        "--input-file-type",
        "jsonschema",
        "--output",
        str(out),
        "--output-model-type",
        "pydantic_v2.BaseModel",
        # 3.10 floor: union operator + standard collections are clean there.
        "--target-python-version",
        "3.10",
        "--use-standard-collections",
        "--use-union-operator",
        "--use-schema-description",
        "--use-double-quotes",
        "--use-field-description",
        # Deterministic output: no embedded timestamp header, stable field order.
        "--disable-timestamp",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        sys.stderr.write(result.stdout)
        sys.stderr.write(result.stderr)
        raise SystemExit(
            f"datamodel-codegen failed (exit {result.returncode}). "
            "Is the pinned version installed? "
            f"`pip install 'datamodel-code-generator[http]=={DCG_PIN}'`"
        )


def _verify_pin() -> None:
    """Fail fast with a clear message if the generator is missing or off-pin."""
    try:
        import datamodel_code_generator as dcg  # type: ignore
    except ImportError:
        raise SystemExit(
            "datamodel-code-generator is not installed. Install the pinned "
            f"version: pip install 'datamodel-code-generator[http]=={DCG_PIN}'"
        )
    have = getattr(dcg, "version", None) or getattr(dcg, "__version__", None)
    if have and have != DCG_PIN:
        sys.stderr.write(
            f"WARNING: datamodel-code-generator {have} installed, pin is {DCG_PIN}. "
            "Generated output may differ; install the pin for reproducibility.\n"
        )


def _fix_common_import(out_dir: Path) -> None:
    """Repair datamodel-code-generator's cross-module `_common` import.

    The generator emits `from .._common import schema` (and references
    `schema.Uuidv7` etc.) on the assumption the `_common.schema.json` input
    becomes a `_common/` SUBPACKAGE with a `schema` module one level UP. We
    instead generate everything flat into `_generated/`, where the shared
    primitives land in `_common_schema.py` as a SIBLING. Rewrite the broken
    import to a working sibling alias so `schema.Uuidv7` keeps resolving. This
    rewrite is deterministic (same broken line -> same fixed line), so it does
    not perturb codegen idempotency.
    """
    broken = "from .._common import schema"
    fixed = "from . import _common_schema as schema"
    for p in out_dir.glob("*.py"):
        text = p.read_text(encoding="utf-8")
        if broken in text:
            p.write_text(text.replace(broken, fixed), encoding="utf-8")


def generate(out_dir: Path) -> None:
    """Render and validate the full output before replacing owned Python files.

    The pinned generator emits a flat package. Only top-level ``*.py`` files
    are owned here; README, other documentation, and nested directories are
    preserved. Replacements are atomic per file, not a whole-directory swap.
    """
    before = _snapshot(out_dir)
    out_dir.parent.mkdir(parents=True, exist_ok=True)
    # A sibling temporary directory keeps os.replace on the same filesystem.
    with tempfile.TemporaryDirectory(prefix=".iec-codegen-", dir=out_dir.parent) as td:
        norm = Path(td) / "schemas"
        staged = Path(td) / "generated"
        _normalize_into(norm)
        _run_codegen(norm, staged)
        # Refuse special paths before import repair can follow a staged symlink.
        after = _snapshot(staged)
        if not after or not any(name != "__init__.py" for name in after):
            raise ValueError("Generator produced no model modules; existing output preserved")
        if any(path.is_dir() for path in staged.iterdir()):
            raise ValueError("Expected flat generated modules; existing output preserved")
        _fix_common_import(staged)
        after = _snapshot(staged)
        for name, content in after.items():
            ast.parse(content, filename=name)
        if _snapshot(out_dir) != before:
            raise ValueError("Output changed during generation; refusing to overwrite concurrent edits")

        out_dir.mkdir(exist_ok=True)
        for name, content in after.items():
            if before.get(name) != content:
                os.replace(staged / name, out_dir / name)
        # Prune only obsolete owned modules, after successful generation and writes.
        for name in before.keys() - after.keys():
            (out_dir / name).unlink()


def _snapshot(d: Path) -> dict[str, bytes]:
    """Read owned flat Python modules without following output symlinks."""
    if d.is_symlink() or (d.exists() and not d.is_dir()):
        raise ValueError(f"Expected a regular output directory: {d}")
    snap: dict[str, bytes] = {}
    for p in sorted(d.glob("*.py")):
        if p.is_symlink() or not p.is_file():
            raise ValueError(f"Expected a regular generated Python file: {p}")
        snap[p.name] = p.read_bytes()
    return snap


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Pydantic v2 models from kernel schemas")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Idempotency gate: regenerate into a temp dir and fail if it "
        "differs from the committed _generated/ (CI use).",
    )
    args = parser.parse_args()

    _verify_pin()

    if args.check:
        before = _snapshot(OUT_DIR) if OUT_DIR.exists() else {}
        with tempfile.TemporaryDirectory(prefix="iec-codegen-check-") as td:
            tmp_out = Path(td) / "_generated"
            generate(tmp_out)
            after = _snapshot(tmp_out)
        if before != after:
            added = sorted(set(after) - set(before))
            removed = sorted(set(before) - set(after))
            changed = sorted(k for k in (set(after) & set(before)) if before[k] != after[k])
            sys.stderr.write("Pydantic codegen is STALE — regenerate with `pnpm run codegen:pydantic`.\n")
            if added:
                sys.stderr.write(f"  added:   {', '.join(added)}\n")
            if removed:
                sys.stderr.write(f"  removed: {', '.join(removed)}\n")
            if changed:
                sys.stderr.write(f"  changed: {', '.join(changed)}\n")
            return 1
        print(f"Pydantic codegen is up to date ({len(after)} generated module(s)).")
        return 0

    generate(OUT_DIR)
    n = len(_snapshot(OUT_DIR))
    print(f"Generated {n} Pydantic module(s) into {OUT_DIR.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
