---
name: source-profiler
description: Profile the mounted enterprise source package before semantic mapping or impact analysis.
---

# Source Profiler

Use this skill whenever a question depends on one or more mounted CSV tables.

## Procedure

1. Enumerate `/.agents/data/*.csv` and load the relevant files with Pandas.
2. Capture row count, columns, inferred types, null count, unique count, and sample identifiers.
3. Identify likely primary keys and shared foreign keys by exact name and value overlap.
4. Compare the profile against `source_catalog.csv` for freshness and quality.
5. Detect aliases, spelling variants, mixed units, inconsistent dates, and metric-label collisions.
6. Write `./workspace/source-profile.json` when a reusable profile does not already exist.

## Rules

- Do not infer relationships solely from similar column names when values do not overlap.
- Do not coerce missing values to zero without a business rule.
- Parse currency and percentages deliberately.
- Use the demo date from `AGENTS.md` for horizon calculations.
- Report data limitations rather than inventing missing records.
