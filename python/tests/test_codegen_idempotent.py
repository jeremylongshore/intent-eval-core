"""Codegen idempotency gate as a pytest case.

Wraps the standalone `scripts/codegen_pydantic.py --check` so the python lane
(`pytest`) enforces it: a stale `_generated/` fails the suite rather than
slipping through. Requires the pinned `datamodel-code-generator` (dev toolchain),
so the module is collection-time guarded with `pytest.importorskip` — a consumer
running only the runtime deps skips it cleanly; `pip install intent-eval-core[dev]`
is the path to running it. (Module-level importorskip is an import guard, not a
test-skip marker.)
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

# Collection-time guard: the codegen check needs datamodel-code-generator. If
# the dev toolchain is absent, skip this module without flagging a per-test
# skip marker.
pytest.importorskip(
    "datamodel_code_generator",
    reason="datamodel-code-generator not installed (pip install intent-eval-core[dev])",
)

REPO_ROOT = Path(__file__).resolve().parents[2]
CODEGEN = REPO_ROOT / "scripts" / "codegen_pydantic.py"


def test_generated_models_are_up_to_date() -> None:
    """The committed _generated/ must equal a fresh codegen run (no drift)."""
    result = subprocess.run(
        [sys.executable, str(CODEGEN), "--check"],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
    )
    assert result.returncode == 0, (
        "Pydantic codegen is stale — run `pnpm run codegen:pydantic`.\n"
        f"{result.stdout}\n{result.stderr}"
    )
