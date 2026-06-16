"""Version-lockstep gate as a pytest case.

Asserts the npm `package.json#version`, `python/pyproject.toml` version, and
`intent_eval_core.__version__` all agree. Pure stdlib — always runs (no dev
toolchain needed), so a bumped-one-forgot-the-other release bug fails the
parity suite.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
LOCKSTEP = REPO_ROOT / "scripts" / "check_version_lockstep.py"


def test_version_lockstep() -> None:
    """npm package.json, pyproject.toml, and __init__.__version__ must agree."""
    result = subprocess.run(
        [sys.executable, str(LOCKSTEP)],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
    )
    assert result.returncode == 0, f"{result.stdout}\n{result.stderr}"
