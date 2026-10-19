"""Measure an explicitly supplied, trusted local marketplace checker; never run fixture text."""

import argparse
import hashlib
import importlib.util
import json
import re
import subprocess
from pathlib import Path

import yaml


def metrics(rows):
    legitimate = [row for row in rows if row["label"] == "legitimate"]
    forbidden = [row for row in rows if row["label"] == "forbidden"]
    if not legitimate or not forbidden:
        raise ValueError("Both classes are required")
    fp = [row["id"] for row in legitimate if row["flagged"]]
    fn = [row["id"] for row in forbidden if not row["flagged"]]
    return {
        "legitimate": len(legitimate),
        "forbidden": len(forbidden),
        "falsePositives": fp,
        "falseNegatives": fn,
        "fpRate": len(fp) / len(legitimate),
        "fnRate": len(fn) / len(forbidden),
        "targetsMet": len(fp) / len(legitimate) < 0.02
        and len(fn) / len(forbidden) < 0.05,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "validator", type=Path, help="Trusted local scripts/validate-skills-schema.py"
    )
    args = parser.parse_args()
    source = args.validator.resolve(strict=True)
    source_repo = source.parent.parent
    relative = source.relative_to(source_repo).as_posix()
    # Refuse dirty source: report a committed implementation, not an unrecorded edit.
    if subprocess.check_output(
        ["git", "-C", str(source_repo), "status", "--porcelain", "--", relative]
    ):
        raise ValueError("Marketplace validator has uncommitted changes")
    revision = subprocess.check_output(
        ["git", "-C", str(source_repo), "rev-parse", "HEAD"], text=True
    ).strip()
    committed = subprocess.check_output(
        ["git", "-C", str(source_repo), "show", f"HEAD:{relative}"]
    )
    if committed != source.read_bytes():
        raise ValueError("Marketplace validator does not match committed bytes")
    spec = importlib.util.spec_from_file_location(
        "measured_marketplace_validator", source
    )
    if spec is None or spec.loader is None:
        raise ValueError("Cannot load supplied validator")
    validator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(validator)

    corpus = (
        Path(__file__).resolve().parent.parent
        / "tests/security-measurement/shell-substitution-v1"
    )
    manifest_bytes = (corpus / "manifest.json").read_bytes()
    manifest = json.loads(manifest_bytes)
    if not set(manifest["allowedBracedTokens"]).issubset(
        validator.YAML_VALUE_ALLOWED_VARS
    ):
        raise ValueError(
            "Corpus label policy no longer matches the marketplace allow-list"
        )
    rows = []
    seen = set()
    for entry in manifest["fixtures"]:
        ident = entry["id"]
        if not re.fullmatch(r"[a-z0-9-]+", ident) or ident in seen:
            raise ValueError("Invalid or duplicate fixture ID")
        seen.add(ident)
        content = (corpus / ident / "SKILL.md").read_bytes()
        if hashlib.sha256(content).hexdigest() != entry["sha256"]:
            raise ValueError(f"Fixture digest mismatch: {ident}")
        match = re.match(r"^---\n([\s\S]*?)\n---\n", content.decode())
        if match is None:
            raise ValueError(f"Missing frontmatter: {ident}")
        frontmatter = yaml.safe_load(match[1])
        if frontmatter != json.loads(match[1]):
            raise ValueError(f"YAML/JSON parser disagreement: {ident}")
        findings = validator.check_yaml_shell_substitution(frontmatter)
        # Independent paired control rules out failures from untouched fields.
        control = json.loads(json.dumps(frontmatter))
        target = control
        for part in entry["path"][:-1]:
            target = target[part]
        key = entry["path"][-1]
        if not isinstance(target[key], str):
            raise TypeError("Labeled value is not a string")
        target[key] = "Offline fixture text."
        if validator.check_yaml_shell_substitution(control):
            raise ValueError(f"Unrelated control failure: {ident}")
        rows.append(
            {
                "id": ident,
                "label": entry["label"],
                "context": entry["context"],
                "flagged": bool(findings),
            }
        )
    result = metrics(rows)
    if len(rows) != 100 or result["legitimate"] != 50 or result["forbidden"] != 50:
        raise ValueError("Expected exactly 50 cases per class")
    report = {
        "measurementVersion": 1,
        "profile": "marketplace-yaml-shell-substitution",
        "sourceRevision": revision,
        "sourcePath": relative,
        "validatorSha256": hashlib.sha256(committed).hexdigest(),
        "corpusSha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "scope": "Actual checker on the same synthetic corpus; not full authoring conformance or a population error-rate estimate.",
        "metrics": result,
        "contexts": {
            context: metrics([row for row in rows if row["context"] == context])
            for context in sorted({row["context"] for row in rows})
        },
        "rows": rows,
    }
    print(json.dumps(report, indent=2))
    return 0 if result["targetsMet"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
