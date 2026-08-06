#!/usr/bin/env python3
"""Deterministic supplier disruption analysis for the mounted demo package."""

from __future__ import annotations

import argparse
import json
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

DEMO_DATE = date(2026, 8, 6)


def read_csv(data: Path, name: str) -> pd.DataFrame:
    return pd.read_csv(data / name)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="/.agents/data")
    parser.add_argument("--duration", type=int, default=30)
    parser.add_argument("--output", default="./workspace/impact-analysis.json")
    args = parser.parse_args()

    data = Path(args.data)
    horizon = DEMO_DATE + timedelta(days=args.duration)
    allocations = read_csv(data, "part_suppliers.csv")
    bom = read_csv(data, "bill_of_materials.csv")
    orders = read_csv(data, "sales_orders.csv")
    inventory = read_csv(data, "inventory.csv")
    substitutes = read_csv(data, "approved_substitutes.csv")
    opportunities = read_csv(data, "opportunities.csv")

    nova = allocations[(allocations.site_id == "SITE-NOVA-MTY") & (allocations.approved == True)].copy()  # noqa: E712
    parts = []
    for row in nova.itertuples(index=False):
        product_ids = bom.loc[bom.part_id == row.part_id, "product_id"].unique().tolist()
        plant_ids = orders.loc[orders.product_id.isin(product_ids), "plant_id"].unique().tolist()
        coverage = inventory[(inventory.part_id == row.part_id) & inventory.plant_id.isin(plant_ids)]["coverage_days"]
        minimum_coverage = int(coverage.min()) if not coverage.empty else 0
        alternate = substitutes[substitutes.part_id == row.part_id]
        approved_capacity = 0
        if not alternate.empty and alternate.iloc[0].approval_status == "Approved":
            approved_capacity = float(alternate.iloc[0].max_capacity_pct)
        residual = max(0, float(row.allocation_pct) - approved_capacity)
        if minimum_coverage < args.duration and residual > 0:
            parts.append({"part_id": row.part_id, "products": product_ids, "minimum_coverage": minimum_coverage, "residual_pct": residual})

    affected_products = sorted({product for part in parts for product in part["products"]})
    orders["promised_date"] = pd.to_datetime(orders.promised_date).dt.date
    affected_orders = orders[
        orders.product_id.isin(affected_products)
        & (orders.status == "Confirmed")
        & (orders.promised_date >= DEMO_DATE)
        & (orders.promised_date <= horizon)
    ]
    opportunities["expected_close_date"] = pd.to_datetime(opportunities.expected_close_date).dt.date
    affected_pipeline = opportunities[
        opportunities.product_id.isin(affected_products)
        & (opportunities.expected_close_date >= DEMO_DATE)
        & (opportunities.expected_close_date <= horizon)
    ]

    finance = float(affected_orders.committed_revenue.sum())
    pipeline = float(affected_pipeline.pipeline_value.sum())
    result = {
        "duration_days": args.duration,
        "affected_part_ids": [part["part_id"] for part in parts],
        "affected_product_ids": affected_products,
        "affected_order_ids": affected_orders.order_id.tolist(),
        "finance_revenue_at_risk": finance,
        "sales_revenue_at_risk": finance + pipeline,
        "gross_margin_at_risk": float(affected_orders.gross_margin.sum()),
        "contract_penalty_exposure": float(affected_orders.penalty_exposure.sum()),
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
