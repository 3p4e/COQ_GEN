#!/usr/bin/env python3
"""Validate api/gateway_openapi.yaml.

Always runs a structural check (valid YAML, OpenAPI 3.1, every local $ref
resolves). If `openapi-spec-validator` is installed, also runs the formal
3.1 validation. Exits non-zero on any failure.
"""
import sys, re, pathlib
import yaml

SPEC = pathlib.Path(__file__).resolve().parent.parent / "api" / "gateway_openapi.yaml"

def main() -> int:
    text = SPEC.read_text(encoding="utf-8")
    doc = yaml.safe_load(text)

    errors = []
    if not str(doc.get("openapi", "")).startswith("3.1"):
        errors.append(f"openapi version is {doc.get('openapi')!r}, expected 3.1.x")
    if not doc.get("paths"):
        errors.append("no paths defined")

    # resolve every local $ref
    refs = set(re.findall(r'\$ref:\s*"(#[^"]+)"', text))
    for r in refs:
        node = doc
        for part in r.lstrip("#/").split("/"):
            node = node.get(part) if isinstance(node, dict) else None
            if node is None:
                errors.append(f"unresolved $ref: {r}")
                break

    if errors:
        print("STRUCTURAL FAIL:")
        for e in errors:
            print("  -", e)
        return 1
    print(f"structural OK: openapi={doc['openapi']} "
          f"paths={len(doc['paths'])} schemas={len(doc['components']['schemas'])} "
          f"refs={len(refs)} (all resolve)")

    try:
        from openapi_spec_validator import validate
        validate(doc)
        print("formal OpenAPI 3.1 validation: PASS")
    except ImportError:
        print("formal validator not installed (pip install openapi-spec-validator) "
              "- structural check stands")
    except Exception as exc:  # noqa: BLE001
        print(f"formal OpenAPI validation FAIL: {exc}")
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
