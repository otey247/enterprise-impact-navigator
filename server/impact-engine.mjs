import { randomUUID } from 'node:crypto';
import { loadDemoPackage } from './data-repository.mjs';
import { toNumber, toBoolean } from './csv.mjs';

const DEMO_DATE = new Date('2026-08-06T00:00:00Z');

function indexBy(rows, key) {
  return new Map(rows.map((row) => [row[key], row]));
}

function unique(values) {
  return [...new Set(values)];
}

function withinHorizon(dateText, horizonDays) {
  const date = new Date(`${dateText}T00:00:00Z`);
  const difference = Math.ceil((date - DEMO_DATE) / 86400000);
  return difference >= 0 && difference <= horizonDays;
}

function money(value) {
  return Math.round(value * 100) / 100;
}

function displayMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function findDuration(question, defaultDays) {
  const match = String(question || '').match(/(\d+)\s*[- ]?day/i);
  return match ? Number(match[1]) : defaultDays;
}

function exposedPartContext(data, siteId, durationDays) {
  const inventoryByPartPlant = new Map();
  for (const row of data.inventory) inventoryByPartPlant.set(`${row.part_id}:${row.plant_id}`, row);

  return data.partSuppliers
    .filter((row) => row.site_id === siteId && toBoolean(row.approved))
    .map((supplierLink) => {
      const part = data.parts.find((row) => row.part_id === supplierLink.part_id);
      const substitute = data.substitutes.find((row) => row.part_id === supplierLink.part_id);
      const productIds = data.bom.filter((row) => row.part_id === supplierLink.part_id).map((row) => row.product_id);
      const plantCoverages = data.salesOrders
        .filter((order) => productIds.includes(order.product_id))
        .map((order) => inventoryByPartPlant.get(`${supplierLink.part_id}:${order.plant_id}`))
        .filter(Boolean)
        .map((inventory) => toNumber(inventory.coverage_days));
      const minimumCoverage = plantCoverages.length ? Math.min(...plantCoverages) : 0;
      const approvedCapacity = substitute && substitute.approval_status === 'Approved' ? toNumber(substitute.max_capacity_pct) : 0;
      const allocation = toNumber(supplierLink.allocation_pct);
      const residualAllocation = Math.max(0, allocation - approvedCapacity);
      return {
        part,
        supplierLink,
        substitute,
        productIds,
        minimumCoverage,
        residualAllocation,
        constrained: minimumCoverage < durationDays && residualAllocation > 0
      };
    });
}

function buildOrderEvidence(data, order, constrainedParts) {
  const customer = data.customers.find((row) => row.customer_id === order.customer_id);
  const contract = data.contracts.find((row) => row.contract_id === order.contract_id);
  const product = data.products.find((row) => row.product_id === order.product_id);
  const plant = data.plants.find((row) => row.plant_id === order.plant_id);
  const part = constrainedParts.find((item) => item.productIds.includes(order.product_id));
  const owner = data.organizations.find((row) => row.org_id === plant?.owner_org_id);

  const steps = [
    { id: 'SUP-001', type: 'Supplier', label: 'Nova Components Mexico SA', relationship: 'operates' },
    { id: 'SITE-NOVA-MTY', type: 'SupplierSite', label: 'Monterrey Electronics Campus', relationship: 'supplies' },
    { id: part?.part.part_id, type: 'Part', label: part?.part.part_name, relationship: 'component of' },
    { id: product?.product_id, type: 'Product', label: product?.product_name, relationship: 'fulfilled by' },
    { id: plant?.plant_id, type: 'Plant', label: plant?.plant_name, relationship: 'fulfills' },
    { id: order.order_id, type: 'SalesOrder', label: order.order_id, relationship: 'placed by' },
    { id: customer?.customer_id, type: 'Customer', label: customer?.finance_name || customer?.crm_name, relationship: 'governed by' },
    { id: contract?.contract_id, type: 'Contract', label: contract?.contract_name, relationship: 'owned by' },
    { id: owner?.org_id, type: 'Organization', label: owner?.org_name, relationship: null }
  ].filter((step) => step.id);

  return {
    id: `PATH-${order.order_id}`,
    claim: `${order.order_id} is exposed because ${part?.part.part_name} depends on the disrupted Monterrey site.`,
    order_id: order.order_id,
    confidence: 0.97,
    steps,
    sources: [
      'Procurement supplier master',
      'PLM bill of materials',
      'ERP inventory',
      'ERP sales orders',
      'Contract repository',
      'HRIS organization directory'
    ]
  };
}

function supplierDisruptionReport(question, durationDays) {
  const data = loadDemoPackage();
  const partContext = exposedPartContext(data, 'SITE-NOVA-MTY', durationDays);
  const constrainedParts = partContext.filter((item) => item.constrained);
  const affectedProductIds = unique(constrainedParts.flatMap((item) => item.productIds));
  const affectedOrders = data.salesOrders.filter((order) =>
    affectedProductIds.includes(order.product_id) &&
    order.status === 'Confirmed' &&
    withinHorizon(order.promised_date, durationDays)
  );

  const financeRevenue = affectedOrders.reduce((sum, order) => sum + toNumber(order.committed_revenue), 0);
  const grossMargin = affectedOrders.reduce((sum, order) => sum + toNumber(order.gross_margin), 0);
  const penalty = affectedOrders.reduce((sum, order) => sum + toNumber(order.penalty_exposure), 0);
  const pipeline = data.opportunities
    .filter((opportunity) => affectedProductIds.includes(opportunity.product_id) && withinHorizon(opportunity.expected_close_date, durationDays))
    .reduce((sum, opportunity) => sum + toNumber(opportunity.pipeline_value), 0);
  const salesExposure = financeRevenue + pipeline;

  const customers = indexBy(data.customers, 'customer_id');
  const products = indexBy(data.products, 'product_id');
  const plants = indexBy(data.plants, 'plant_id');
  const contracts = indexBy(data.contracts, 'contract_id');

  const enrichedOrders = affectedOrders.map((order) => ({
    ...order,
    committed_revenue: toNumber(order.committed_revenue),
    gross_margin: toNumber(order.gross_margin),
    penalty_exposure: toNumber(order.penalty_exposure),
    customer_name: customers.get(order.customer_id)?.finance_name || customers.get(order.customer_id)?.crm_name,
    customer_tier: customers.get(order.customer_id)?.strategic_tier,
    product_name: products.get(order.product_id)?.product_name,
    plant_name: plants.get(order.plant_id)?.plant_name,
    contract_name: contracts.get(order.contract_id)?.contract_name,
    sla_days: toNumber(contracts.get(order.contract_id)?.sla_days)
  }));

  const evidencePaths = affectedOrders.slice(0, 5).map((order) => buildOrderEvidence(data, order, constrainedParts));
  const nodeIds = unique(evidencePaths.flatMap((path) => path.steps.map((step) => step.id)));
  const edgeIds = data.ontology.edges
    .filter((edge) => nodeIds.includes(edge.source) && nodeIds.includes(edge.target))
    .map((edge) => edge.id);

  const constrainedSummary = constrainedParts.map((item) => ({
    part_id: item.part.part_id,
    part_name: item.part.part_name,
    disrupted_allocation_pct: toNumber(item.supplierLink.allocation_pct),
    minimum_inventory_coverage_days: item.minimumCoverage,
    alternate_status: item.substitute?.approval_status || 'None',
    alternate_capacity_pct: item.substitute ? toNumber(item.substitute.max_capacity_pct) : 0,
    residual_exposure_pct: item.residualAllocation
  }));

  return {
    report_id: randomUUID(),
    scenario_id: durationDays === 60 ? 'supplier-disruption-60' : 'supplier-disruption-30',
    generated_at: new Date().toISOString(),
    question,
    direct_answer: `A ${durationDays}-day outage at Nova Components' Monterrey site puts ${displayMoney(financeRevenue)} of confirmed revenue and ${displayMoney(grossMargin)} of gross margin at risk across ${affectedOrders.length} confirmed orders. Sales reports ${displayMoney(salesExposure)} because its definition also includes ${displayMoney(pipeline)} of qualified pipeline.`,
    ontology_version: data.ontology.version,
    severity: durationDays >= 60 ? 'Critical' : 'High',
    metrics: [
      { id: 'finance-revenue', label: 'Finance revenue at risk', value: money(financeRevenue), format: 'currency', definition_id: 'METRIC-REV-FIN', context: 'Confirmed orders only' },
      { id: 'sales-exposure', label: 'Sales exposure', value: money(salesExposure), format: 'currency', definition_id: 'METRIC-REV-SALES', context: 'Confirmed orders plus pipeline' },
      { id: 'gross-margin', label: 'Gross margin at risk', value: money(grossMargin), format: 'currency', definition_id: 'METRIC-MARGIN' },
      { id: 'penalty', label: 'Contract penalty exposure', value: money(penalty), format: 'currency', definition_id: 'METRIC-PENALTY' },
      { id: 'orders', label: 'Confirmed orders affected', value: affectedOrders.length, format: 'number' },
      { id: 'customers', label: 'Customers affected', value: unique(affectedOrders.map((order) => order.customer_id)).length, format: 'number' }
    ],
    constrained_parts: constrainedSummary,
    affected_orders: enrichedOrders,
    evidence_paths: evidencePaths,
    definitions_used: data.metricDefinitions.filter((definition) =>
      ['METRIC-REV-FIN', 'METRIC-REV-SALES', 'METRIC-MARGIN', 'METRIC-PENALTY'].includes(definition.metric_id)
    ).map((definition) => ({
      ...definition,
      owner: data.organizations.find((row) => row.org_id === definition.owner_org_id)?.org_name || definition.owner_org_id,
      scope: definition.decision_context
    })),
    assumptions: [
      `The disruption begins on the demonstration date, 2026-08-06, and lasts ${durationDays} calendar days.`,
      'Inventory coverage values are current as of 2026-08-05 and are assumed available for the listed plants.',
      'Pending alternates do not reduce exposure until their approval status is Approved.',
      'Penalty exposure is the maximum contractual amount, not a forecast of the amount that will be incurred.'
    ],
    unresolved_questions: [
      'Can the Queretaro site add qualified capacity for PART-1048 within the disruption window?',
      'Can Product Engineering complete emergency validation of PART-1048B before current inventory is exhausted?',
      'Which customer commitments can be resequenced without creating a contractual breach?'
    ],
    recommended_actions: [
      { priority: 1, action: 'Launch emergency validation for alternate control board PART-1048B.', owner: 'Morgan Ellis', owner_org: 'Product Engineering', due: '2026-08-09', rationale: 'The control board is single-sourced and has only 8 to 16 days of plant coverage.' },
      { priority: 2, action: 'Rebalance available PART-1048 inventory toward Tier 1 contractual commitments.', owner: 'Dana Kim', owner_org: 'Central Operations', due: '2026-08-07', rationale: 'Acme and P&G represent the largest revenue and penalty exposure.' },
      { priority: 3, action: 'Confirm surge capacity for the approved PART-2091 alternate.', owner: 'Jordan Chen', owner_org: 'Strategic Procurement', due: '2026-08-08', rationale: 'The approved alternate covers only 30% of demand and does not fully offset the 70% disrupted allocation.' },
      { priority: 4, action: 'Prepare coordinated Tier 1 customer communication and recovery commitments.', owner: 'Renee Washington', owner_org: 'Commercial Operations', due: '2026-08-10', rationale: 'Strategic customer communication requires an approved mitigation plan and executive sponsor.' }
    ],
    graph_focus: { node_ids: nodeIds, edge_ids: edgeIds }
  };
}

function metricConflictReport(question) {
  const base = supplierDisruptionReport(question, 30);
  const finance = base.metrics.find((metric) => metric.id === 'finance-revenue').value;
  const sales = base.metrics.find((metric) => metric.id === 'sales-exposure').value;
  const difference = sales - finance;
  return {
    ...base,
    scenario_id: 'metric-conflict',
    severity: 'Medium',
    direct_answer: `Both values are correct. Finance reports ${displayMoney(finance)} because it counts confirmed customer revenue due within the disruption horizon. Sales reports ${displayMoney(sales)} because it adds ${displayMoney(difference)} of qualified pipeline for affected products. Use the Finance definition for booked financial exposure and the Sales definition for commercial relationship planning.`,
    metrics: [
      { id: 'finance-revenue', label: 'Finance definition', value: money(finance), format: 'currency', definition_id: 'METRIC-REV-FIN', context: 'Confirmed orders only' },
      { id: 'sales-exposure', label: 'Sales definition', value: money(sales), format: 'currency', definition_id: 'METRIC-REV-SALES', context: 'Confirmed orders plus pipeline' },
      { id: 'definition-gap', label: 'Definition gap', value: money(difference), format: 'currency', context: 'Qualified pipeline included by Sales' }
    ],
    recommended_actions: [
      { priority: 1, action: 'Display the metric owner and formula beside every revenue-at-risk value.', owner: 'Data Governance', owner_org: 'Enterprise Data Office', due: '2026-08-14', rationale: 'The same label currently represents two valid but different calculations.' },
      { priority: 2, action: 'Adopt Finance Revenue at Risk as the executive financial metric.', owner: 'Dana Kim', owner_org: 'Central Operations', due: '2026-08-14', rationale: 'It is limited to confirmed customer commitments and avoids mixing pipeline with booked exposure.' },
      { priority: 3, action: 'Retain Sales Exposure as a separate commercial-planning metric.', owner: 'Renee Washington', owner_org: 'Commercial Operations', due: '2026-08-14', rationale: 'The broader measure remains valuable for relationship and pipeline intervention.' }
    ]
  };
}

function singleSourceReport(question) {
  const base = supplierDisruptionReport(question, 30);
  const singleSource = base.constrained_parts.filter((part) => part.residual_exposure_pct >= 65);
  const singlePartIds = singleSource.map((part) => part.part_id);
  const data = loadDemoPackage();
  const productIds = unique(data.bom.filter((row) => singlePartIds.includes(row.part_id)).map((row) => row.product_id));
  const orders = base.affected_orders.filter((order) => productIds.includes(order.product_id));
  const revenue = orders.reduce((sum, order) => sum + order.committed_revenue, 0);
  return {
    ...base,
    scenario_id: 'single-source-exposure',
    direct_answer: `${singleSource.map((part) => part.part_name).join(', ')} creates the largest single-source exposure. It supports ${productIds.length} products and ${orders.length} confirmed customer commitments representing ${displayMoney(revenue)} within the next 30 days. The available alternate is still pending engineering validation.`,
    metrics: [
      { id: 'single-source-parts', label: 'Single-source parts', value: singleSource.length, format: 'number', context: 'No approved full-capacity alternate' },
      { id: 'dependent-products', label: 'Dependent products', value: productIds.length, format: 'number' },
      { id: 'dependent-orders', label: 'Dependent orders', value: orders.length, format: 'number', context: 'Confirmed orders within 30 days' },
      { id: 'dependent-revenue', label: 'Dependent revenue', value: money(revenue), format: 'currency', context: 'Confirmed customer commitments' }
    ],
    affected_orders: orders,
    constrained_parts: singleSource
  };
}

export function runScenario({ scenarioId, question }) {
  const normalized = String(question || '').toLowerCase();
  let selected = scenarioId;
  if (!selected || selected === 'natural-language') {
    if (normalized.includes('sales') && normalized.includes('finance')) selected = 'metric-conflict';
    else if (normalized.includes('single-source') || normalized.includes('single source') || normalized.includes('alternate')) selected = 'single-source-exposure';
    else selected = normalized.includes('60') ? 'supplier-disruption-60' : 'supplier-disruption-30';
  }

  if (selected === 'metric-conflict') return metricConflictReport(question);
  if (selected === 'single-source-exposure') return singleSourceReport(question);
  const duration = selected === 'supplier-disruption-60' ? 60 : findDuration(question, 30);
  return supplierDisruptionReport(question, duration);
}

export function buildBootstrap() {
  const data = loadDemoPackage();
  return {
    application: {
      name: 'Enterprise Impact Navigator',
      version: '1.0.0',
      demo_date: '2026-08-06',
      description: 'A governed enterprise ontology for evidence-backed impact analysis.'
    },
    ontology: data.ontology,
    mappings: data.mappings,
    scenarios: data.scenarios,
    metric_definitions: data.metricDefinitions,
    source_catalog: data.sourceCatalog.map((source) => ({
      ...source,
      record_count: toNumber(source.record_count),
      quality_score: toNumber(source.quality_score)
    })),
    summary: {
      entity_types: data.ontology.entity_types.length,
      relationship_types: data.ontology.relationship_types.length,
      nodes: data.ontology.nodes.length,
      edges: data.ontology.edges.length,
      sources: data.sourceCatalog.length,
      mappings_needing_review: data.mappings.filter((mapping) => mapping.status === 'Needs Review').length,
      average_source_quality: Math.round(
        data.sourceCatalog.reduce((sum, source) => sum + toNumber(source.quality_score), 0) / data.sourceCatalog.length
      )
    }
  };
}
