#!/usr/bin/env python3
"""Validate and compile the Enterprise Impact Navigator ontology package."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="/.agents/data")
    parser.add_argument("--output", default="./workspace")
    args = parser.parse_args()

    data = Path(args.data)
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)

    ontology = load_json(data / "ontology" / "seed-ontology.json")
    mappings = load_json(data / "ontology" / "mapping-candidates.json")
    nodes = ontology.get("nodes", [])
    edges = ontology.get("edges", [])
    node_ids = [node["id"] for node in nodes]
    edge_ids = [edge["id"] for edge in edges]
    declared_entities = set(ontology.get("entity_types", []))
    declared_relationships = set(ontology.get("relationship_types", []))

    errors: list[str] = []
    warnings: list[str] = []
    if len(node_ids) != len(set(node_ids)):
        errors.append("Duplicate ontology node IDs detected.")
    if len(edge_ids) != len(set(edge_ids)):
        errors.append("Duplicate ontology edge IDs detected.")

    known_nodes = set(node_ids)
    for node in nodes:
        if node.get("type") not in declared_entities:
            errors.append(f"Node {node.get('id')} uses undeclared type {node.get('type')}.")
    for edge in edges:
        if edge.get("source") not in known_nodes or edge.get("target") not in known_nodes:
            errors.append(f"Edge {edge.get('id')} references an unknown node.")
        if edge.get("type") not in declared_relationships:
            errors.append(f"Edge {edge.get('id')} uses undeclared type {edge.get('type')}.")

    review_items = [item for item in mappings.get("mapping_candidates", []) if item.get("status") == "Needs Review"]
    if review_items:
        warnings.append(f"{len(review_items)} mapping candidates require human review.")

    validation = {
        "valid": not errors,
        "ontology_id": ontology.get("ontology_id"),
        "version": ontology.get("version"),
        "node_count": len(nodes),
        "edge_count": len(edges),
        "errors": errors,
        "warnings": warnings,
        "review_mapping_ids": [item["id"] for item in review_items],
    }
    compiled = {**ontology, "mapping_candidates": mappings.get("mapping_candidates", []), "validation": validation}

    (output / "ontology-validation.json").write_text(json.dumps(validation, indent=2), encoding="utf-8")
    (output / "compiled-ontology.json").write_text(json.dumps(compiled, indent=2), encoding="utf-8")
    print(json.dumps(validation))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
