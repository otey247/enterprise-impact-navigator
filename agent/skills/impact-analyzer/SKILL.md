---
name: impact-analyzer
description: Calculate cross-domain operational, customer, financial, and contractual impact for an enterprise scenario.
---

# Impact Analyzer

Use this skill for supplier disruptions, single-source exposure, metric conflicts, and scenario stress tests.

## Supplier disruption logic

1. Resolve the supplier and affected site.
2. Find approved part-supplier allocations at that site.
3. Find all products using those parts through the bill of materials.
4. Determine minimum inventory coverage by affected plant.
5. Subtract only approved alternate capacity from disrupted allocation.
6. A part is constrained when inventory coverage is less than the disruption duration and residual allocation is greater than zero.
7. Find confirmed sales orders for constrained products with promise dates inside the horizon.
8. Calculate governed metrics from those orders.
9. Add qualified pipeline only for the Sales definition.
10. Join customers, contracts, plants, and organizational owners.

## Required checks

- Do not count cancelled or unconfirmed orders.
- Do not count dates before the demo date or beyond the scenario horizon.
- Do not count pending alternates as available capacity.
- Show both absolute impact and affected entity counts.
- Preserve source IDs in all result tables.

Use `scripts/analyze_impact.py` when a deterministic local calculation is needed.
