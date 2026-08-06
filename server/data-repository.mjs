import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DATA_DIR = join(ROOT, 'demo-data');
const AGENT_DIR = join(ROOT, 'agent');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readCsv(name) {
  return parseCsv(readFileSync(join(DATA_DIR, name), 'utf8'));
}

let cache;

export function loadDemoPackage() {
  if (cache) return cache;
  cache = {
    suppliers: readCsv('suppliers.csv'),
    supplierSites: readCsv('supplier_sites.csv'),
    parts: readCsv('parts.csv'),
    partSuppliers: readCsv('part_suppliers.csv'),
    products: readCsv('products.csv'),
    bom: readCsv('bill_of_materials.csv'),
    plants: readCsv('plants.csv'),
    inventory: readCsv('inventory.csv'),
    customers: readCsv('customers.csv'),
    contracts: readCsv('contracts.csv'),
    salesOrders: readCsv('sales_orders.csv'),
    opportunities: readCsv('opportunities.csv'),
    organizations: readCsv('organizations.csv'),
    substitutes: readCsv('approved_substitutes.csv'),
    metricDefinitions: readCsv('metric_definitions.csv'),
    aliases: readCsv('aliases.csv'),
    sourceCatalog: readCsv('source_catalog.csv'),
    ontology: readJson(join(DATA_DIR, 'ontology', 'seed-ontology.json')),
    mappings: readJson(join(DATA_DIR, 'ontology', 'mapping-candidates.json')).mapping_candidates,
    scenarios: readJson(join(DATA_DIR, 'scenarios', 'scenarios.json')).scenarios,
    policies: {
      supplierRisk: readFileSync(join(DATA_DIR, 'policies', 'supplier-risk-policy.md'), 'utf8'),
      alternatePart: readFileSync(join(DATA_DIR, 'policies', 'alternate-part-policy.md'), 'utf8'),
      strategicCustomer: readFileSync(join(DATA_DIR, 'policies', 'strategic-customer-policy.md'), 'utf8')
    }
  };
  return cache;
}

function walk(directory) {
  const entries = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) entries.push(...walk(path));
    else entries.push(path);
  }
  return entries;
}

export function buildManagedAgentSources() {
  const sources = [];
  for (const path of walk(AGENT_DIR)) {
    const relativePath = relative(AGENT_DIR, path).replaceAll('\\', '/');
    let target = `/.agents/${relativePath}`;
    if (relativePath === 'agent.yaml') target = '/workspace/agent.yaml';
    sources.push({ type: 'inline', target, content: readFileSync(path, 'utf8') });
  }
  for (const path of walk(DATA_DIR)) {
    const relativePath = relative(DATA_DIR, path).replaceAll('\\', '/');
    sources.push({ type: 'inline', target: `/.agents/data/${relativePath}`, content: readFileSync(path, 'utf8') });
  }
  return sources;
}
