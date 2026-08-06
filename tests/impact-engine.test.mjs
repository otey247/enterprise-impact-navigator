import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBootstrap, runScenario } from '../server/impact-engine.mjs';

const flagshipQuestion = "If Nova Components' Monterrey facility is unavailable for 30 days, what is our exposure?";

test('bootstrap exposes the governed ontology and source catalog', () => {
  const bootstrap = buildBootstrap();
  assert.equal(bootstrap.ontology.version, '1.0.0');
  assert.equal(bootstrap.summary.entity_types, 11);
  assert.equal(bootstrap.summary.relationship_types, 10);
  assert.equal(bootstrap.summary.nodes, 24);
  assert.equal(bootstrap.summary.sources, 11);
  assert.equal(bootstrap.summary.mappings_needing_review, 2);
});

test('30-day supplier disruption produces expected governed metrics', () => {
  const report = runScenario({ scenarioId: 'supplier-disruption-30', question: flagshipQuestion });
  const metrics = Object.fromEntries(report.metrics.map((metric) => [metric.id, metric.value]));
  assert.equal(metrics['finance-revenue'], 12452400);
  assert.equal(metrics['sales-exposure'], 18202400);
  assert.equal(metrics['gross-margin'], 4737684);
  assert.equal(metrics.penalty, 1100240);
  assert.equal(metrics.orders, 5);
  assert.equal(metrics.customers, 4);
  assert.equal(report.affected_orders.length, 5);
  assert.ok(report.evidence_paths.length >= 3);
  assert.equal(report.ontology_version, '1.0.0');
});

test('metric conflict preserves the Finance and Sales definitions', () => {
  const report = runScenario({
    scenarioId: 'metric-conflict',
    question: 'Why does Sales report more revenue at risk than Finance?'
  });
  const metrics = Object.fromEntries(report.metrics.map((metric) => [metric.id, metric.value]));
  assert.equal(metrics['finance-revenue'], 12452400);
  assert.equal(metrics['sales-exposure'], 18202400);
  assert.equal(metrics['definition-gap'], 5750000);
  assert.match(report.direct_answer, /Both values are correct/);
});

test('natural language routing identifies a 60-day stress test', () => {
  const report = runScenario({ scenarioId: 'natural-language', question: 'What changes if the disruption lasts 60 days?' });
  assert.equal(report.scenario_id, 'supplier-disruption-60');
  assert.equal(report.severity, 'Critical');
  assert.ok(report.affected_orders.length >= 5);
});

test('single-source analysis narrows the report to the unapproved full-capacity alternate', () => {
  const report = runScenario({
    scenarioId: 'single-source-exposure',
    question: 'Which strategic customer commitments depend on single-source parts?'
  });
  assert.equal(report.constrained_parts.length, 1);
  assert.equal(report.constrained_parts[0].part_id, 'PART-1048');
  assert.ok(report.affected_orders.length > 0);
});
