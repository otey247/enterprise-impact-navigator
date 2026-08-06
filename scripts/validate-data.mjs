import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, toNumber } from '../server/csv.mjs';
import { loadDemoPackage } from '../server/data-repository.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DATA = join(ROOT, 'demo-data');
const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function unique(rows, key, table) {
  const values = rows.map((row) => row[key]);
  assert(values.every(Boolean), `${table}.${key} contains an empty value.`);
  assert(new Set(values).size === values.length, `${table}.${key} must be unique.`);
}

function foreignKey(rows, key, targetRows, targetKey, table) {
  const targets = new Set(targetRows.map((row) => row[targetKey]));
  for (const row of rows) {
    assert(targets.has(row[key]), `${table}.${key} references unknown value ${row[key]}.`);
  }
}

const requiredFiles = [
  'suppliers.csv', 'supplier_sites.csv', 'parts.csv', 'part_suppliers.csv', 'products.csv',
  'bill_of_materials.csv', 'plants.csv', 'inventory.csv', 'customers.csv', 'contracts.csv',
  'sales_orders.csv', 'opportunities.csv', 'organizations.csv', 'approved_substitutes.csv',
  'metric_definitions.csv', 'aliases.csv', 'source_catalog.csv',
  'ontology/seed-ontology.json', 'ontology/mapping-candidates.json', 'scenarios/scenarios.json',
  'policies/supplier-risk-policy.md', 'policies/alternate-part-policy.md', 'policies/strategic-customer-policy.md'
];
requiredFiles.forEach((file) => assert(existsSync(join(DATA, file)), `Required demo package file is missing: ${file}`));

if (!errors.length) {
  const data = loadDemoPackage();
  unique(data.suppliers, 'supplier_id', 'suppliers');
  unique(data.supplierSites, 'site_id', 'supplier_sites');
  unique(data.parts, 'part_id', 'parts');
  unique(data.products, 'product_id', 'products');
  unique(data.plants, 'plant_id', 'plants');
  unique(data.customers, 'customer_id', 'customers');
  unique(data.contracts, 'contract_id', 'contracts');
  unique(data.salesOrders, 'order_id', 'sales_orders');
  unique(data.organizations, 'org_id', 'organizations');

  foreignKey(data.supplierSites, 'supplier_id', data.suppliers, 'supplier_id', 'supplier_sites');
  foreignKey(data.partSuppliers, 'part_id', data.parts, 'part_id', 'part_suppliers');
  foreignKey(data.partSuppliers, 'site_id', data.supplierSites, 'site_id', 'part_suppliers');
  foreignKey(data.bom, 'part_id', data.parts, 'part_id', 'bill_of_materials');
  foreignKey(data.bom, 'product_id', data.products, 'product_id', 'bill_of_materials');
  foreignKey(data.inventory, 'part_id', data.parts, 'part_id', 'inventory');
  foreignKey(data.inventory, 'plant_id', data.plants, 'plant_id', 'inventory');
  foreignKey(data.salesOrders, 'product_id', data.products, 'product_id', 'sales_orders');
  foreignKey(data.salesOrders, 'plant_id', data.plants, 'plant_id', 'sales_orders');
  foreignKey(data.salesOrders, 'customer_id', data.customers, 'customer_id', 'sales_orders');
  foreignKey(data.salesOrders, 'contract_id', data.contracts, 'contract_id', 'sales_orders');

  const nodeIds = data.ontology.nodes.map((node) => node.id);
  const edgeIds = data.ontology.edges.map((edge) => edge.id);
  assert(new Set(nodeIds).size === nodeIds.length, 'Ontology node IDs must be unique.');
  assert(new Set(edgeIds).size === edgeIds.length, 'Ontology edge IDs must be unique.');
  const nodeSet = new Set(nodeIds);
  for (const edge of data.ontology.edges) {
    assert(nodeSet.has(edge.source), `Ontology edge ${edge.id} has unknown source ${edge.source}.`);
    assert(nodeSet.has(edge.target), `Ontology edge ${edge.id} has unknown target ${edge.target}.`);
    assert(data.ontology.relationship_types.includes(edge.type), `Ontology edge ${edge.id} has undeclared type ${edge.type}.`);
  }
  for (const node of data.ontology.nodes) {
    assert(data.ontology.entity_types.includes(node.type), `Ontology node ${node.id} has undeclared type ${node.type}.`);
  }
  for (const mapping of data.mappings) {
    const known = nodeSet.has(mapping.proposed_canonical_id);
    assert(known || mapping.status === 'Needs Review', `Mapping ${mapping.id} points to an unknown approved canonical ID.`);
  }

  assert(data.metricDefinitions.length >= 4, 'At least four governed metric definitions are required.');
  assert(data.sourceCatalog.length === 11, 'The synthetic package must expose 11 source catalog entries.');
  assert(data.scenarios.length === 4, 'The synthetic package must include four guided scenarios.');
  assert(data.sourceCatalog.every((source) => toNumber(source.quality_score) >= 0 && toNumber(source.quality_score) <= 100), 'Source quality scores must be between 0 and 100.');

  const aliases = parseCsv(readFileSync(join(DATA, 'aliases.csv'), 'utf8'));
  assert(aliases.length >= 6, 'The alias package must include at least six semantic variants.');
}

if (errors.length) {
  console.error(`Synthetic package validation failed with ${errors.length} issue(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Synthetic enterprise package is valid.');
