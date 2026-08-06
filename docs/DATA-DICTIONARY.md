# Synthetic Data Dictionary

The package is intentionally inconsistent so the ontology has meaningful work to perform.

| File | Domain | Purpose |
| --- | --- | --- |
| `suppliers.csv` | Procurement | Supplier legal entities and risk |
| `supplier_sites.csv` | Supply chain | Supplier sites and locations |
| `parts.csv` | Product master | Components and demand |
| `part_suppliers.csv` | Procurement | Part-to-site allocations |
| `products.csv` | Product | Finished goods and margins |
| `bill_of_materials.csv` | Engineering | Product dependencies |
| `plants.csv` | Operations | Internal facilities |
| `inventory.csv` | ERP | On-hand quantities and coverage |
| `customers.csv` | CRM | Customer master and tier |
| `sales_orders.csv` | ERP | Customer commitments |
| `contracts.csv` | Legal | Obligations and penalties |
| `opportunities.csv` | CRM | Qualified pipeline |
| `organizations.csv` | HR | Owners and responsibilities |
| `approved_substitutes.csv` | Engineering | Alternate readiness |
| `metric_definitions.csv` | Semantic layer | Governed metric formulas |
| `aliases.csv` | Master data | Cross-system aliases |
| `source_catalog.csv` | Governance | Source metadata |

Deliberate inconsistencies include `Nova MX`, `Nova Components Mexico SA`, `Nova Components Group`, `P&G`, two revenue-at-risk formulas, and a pending alternate-part approval.
