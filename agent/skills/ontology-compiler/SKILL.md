---
name: ontology-compiler
description: Validate and compile the seed ontology, mappings, aliases, and operational source keys into a consistent graph artifact.
---

# Ontology Compiler

Use this skill when validating the ontology package or when a question requires graph traversal.

## Inputs

- `/.agents/data/ontology/seed-ontology.json`
- `/.agents/data/ontology/mapping-candidates.json`
- `/.agents/data/aliases.csv`
- relevant source tables

## Procedure

1. Validate unique node IDs and edge IDs.
2. Validate every edge source and target against known nodes.
3. Validate entity and relationship types against the declared semantic contract.
4. Preserve mapping confidence, status, and evidence.
5. Add operational entities to an analysis graph only when source records provide stable IDs.
6. Write `./workspace/compiled-ontology.json` and `./workspace/ontology-validation.json`.

Use `scripts/compile_ontology.py` for deterministic package validation.

## Governance

- `Needs Review` mappings remain unresolved unless the user or a supplied decision approves them.
- A parent organization must not be collapsed into a legal supplier entity.
- Two metrics with the same label remain separate when formulas or owners differ.
