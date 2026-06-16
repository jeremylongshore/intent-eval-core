#!/usr/bin/env python3
"""Gate: the Python distribution version must match the npm package version.

The npm ``@intentsolutions/core`` ``package.json#version`` is the source of
truth. The Python distribution version appears in TWO places that must agree
with it:

  - ``python/pyproject.toml``  -> ``[project] version``
  - ``python/src/intent_eval_core/__init__.py`` -> ``__version__``

Both JSON-Schema-driven distributions ship the same contracts, so they release
together. This check fails CI if any of the three drift, defending against the
"bumped npm, forgot Python" (or vice-versa) class of release bug.

Usage:
    python scripts/check_version_lockstep.py        # exit 0 if all agree, 1 otherwise
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def npm_version() -> str:
    pkg = json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))
    return str(pkg["version"])


def pyproject_version() -> str:
    text = (REPO_ROOT / "python" / "pyproject.toml").read_text(encoding="utf-8")
    # Match the [project] table's `version = "X.Y.Z"` (first such line).
    m = re.search(r'(?m)^\s*version\s*=\s*"([^"]+)"', text)
    if not m:
        raise SystemExit("could not find version in python/pyproject.toml")
    return m.group(1)


def init_version() -> str:
    text = (
        REPO_ROOT / "python" / "src" / "intent_eval_core" / "__init__.py"
    ).read_text(encoding="utf-8")
    m = re.search(r'(?m)^__version__\s*=\s*"([^"]+)"', text)
    if not m:
        raise SystemExit("could not find __version__ in __init__.py")
    return m.group(1)


def main() -> int:
    npm = npm_version()
    pyproject = pyproject_version()
    init = init_version()

    versions = {
        "package.json": npm,
        "python/pyproject.toml": pyproject,
        "python/src/intent_eval_core/__init__.py": init,
    }

    if len({npm, pyproject, init}) == 1:
        print(f"Version lockstep OK: all at {npm}")
        return 0

    sys.stderr.write("Version lockstep BROKEN — these must all match:\n")
    for where, v in versions.items():
        sys.stderr.write(f"  {v:<14} {where}\n")
    sys.stderr.write(
        "\nThe npm package.json#version is the source of truth. Update "
        "python/pyproject.toml + python/src/intent_eval_core/__init__.py to match.\n"
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
