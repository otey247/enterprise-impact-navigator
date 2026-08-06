import { icon } from './icons.js';
import { bindGraph, entityInspectorMarkup, graphMarkup } from './graph.js';
import { escapeHtml, formatCurrency, formatDate, formatNumber, metricValue, titleCase } from './utils.js';

const scenarioIcons = ['alert', 'scale', 'link', 'clock'];

function panel(title, subtitle, body, actions = '') {
  return `
    <section class="panel">
      <div class="panel-header">
        <div><h2 class="panel-title">${escapeHtml(title)}</h2>${subtitle ? `<p class="panel-subtitle">${escapeHtml(subtitle)}</p>` : ''}</div>
        ${actions ? `<div class="panel-actions">${actions}</div>` : ''}
      </div>
      ${body}
    </section>
  `;
}

function badge(label, tone = '') {
  return `<span class="badge ${tone}"><span class="dot"></span>${escapeHtml(label)}</span>`;
}

function runtimeBadge(execution) {
  const mode = execution?.mode || 'deterministic';
  if (mode === 'managed-agent') return badge('Managed Agent', 'approved');
  if (mode === 'deterministic-fallback') return badge('Deterministic fallback', 'medium');
  return badge('Deterministic engine', 'proposed');
}

export function overviewView(state) {
  const { bootstrap } = state;
  const summary = bootstrap.summary;
  const kpis = [
    ['Entity types', summary.entity_types, 'Canonical business concepts'],
    ['Relationship types', summary.relationship_types, 'Governed semantic links'],
    ['Ontology nodes', summary.nodes, 'Demo knowledge graph'],
    ['Source systems', summary.sources, 'Cross-domain inputs'],
    ['Needs review', summary.mappings_needing_review, 'Material governance decisions'],
    ['Source quality', `${summary.average_source_quality}%`, 'Average catalog score']
  ];

  const hero = `
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">FROM DISCONNECTED RECORDS TO GOVERNED ACTION</p>
        <h2>Trace enterprise impact across suppliers, products, customers, contracts, and owners.</h2>
        <p>Ask a consequential business question. The navigator resolves enterprise meaning, traverses cross-domain dependencies, reconciles competing metrics, and exposes the evidence behind every decision.</p>
        <div class="hero-actions">
          <button class="button button-primary" type="button" data-run-scenario="supplier-disruption-30">${icon('bolt')} Run flagship scenario</button>
          <button class="button button-secondary" type="button" data-navigate="ontology">${icon('network')} Explore ontology</button>
        </div>
      </div>
      <div class="hero-diagram" aria-hidden="true">
        <div class="hero-orbit one"></div><div class="hero-orbit two"></div>
        <div class="hero-core">${icon('network')}</div>
        <div class="orbit-node a">SUPPLIERS</div><div class="orbit-node b">CUSTOMERS</div>
        <div class="orbit-node c">PRODUCTS</div><div class="orbit-node d">CONTRACTS</div>
      </div>
    </section>
  `;

  const kpiGrid = `<section class="kpi-grid">${kpis.map(([label, value, context]) => `
    <div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-context">${context}</div></div>
  `).join('')}</section>`;

  const flow = panel('How the ontology operates', 'The managed agent uses governed semantic artifacts rather than relying on one unstructured prompt.', `
    <div class="flow-list">
      ${[
        ['01', 'PROFILE', 'Inspect source schemas, quality, keys, and business terms.'],
        ['02', 'RESOLVE', 'Map aliases and duplicates into canonical enterprise entities.'],
        ['03', 'COMPILE', 'Create typed relationships, definitions, and validation rules.'],
        ['04', 'REASON', 'Traverse dependencies and calculate impact using governed metrics.'],
        ['05', 'ACT', 'Generate owner-specific mitigation and decision artifacts.']
      ].map(([number, title, description]) => `<div class="flow-step"><div class="flow-number">${number}</div><h3>${title}</h3><p>${description}</p></div>`).join('')}
    </div>
  `);

  const scenarios = panel('Guided enterprise scenarios', 'Each scenario demonstrates a different ontology capability.', `
    <div class="scenario-list">
      ${bootstrap.scenarios.map((scenario, index) => `
        <button class="scenario-row" type="button" data-run-scenario="${escapeHtml(scenario.id)}">
          <span class="scenario-icon">${icon(scenarioIcons[index] || 'target')}</span>
          <span><span class="scenario-title">${escapeHtml(scenario.title)}</span><span class="scenario-description">${escapeHtml(scenario.description)}</span></span>
          <span class="scenario-category">${escapeHtml(scenario.category)}</span>
        </button>
      `).join('')}
    </div>
  `);

  const governance = panel('Governance queue', 'High-consequence semantic decisions remain visible and reviewable.', `
    <div class="panel-body">
      <div class="plain-list">
        ${bootstrap.mappings.filter((mapping) => mapping.status === 'Needs Review').map((mapping) => `
          <div class="definition">
            <div class="definition-name">${escapeHtml(mapping.source_value)} → ${escapeHtml(mapping.proposed_label)}</div>
            <div class="definition-meta">${escapeHtml(mapping.entity_type)} · ${escapeHtml(mapping.source_system)} · ${Math.round(mapping.confidence * 100)}% confidence · ${escapeHtml(mapping.risk)} risk</div>
          </div>
        `).join('')}
      </div>
      <button class="button button-secondary" type="button" data-navigate="mappings" style="margin-top:14px">Review mappings ${icon('arrow')}</button>
    </div>
  `);

  return `<div class="view-stack">${hero}${kpiGrid}${flow}<div class="two-column">${scenarios}${governance}</div></div>`;
}

function questionPanel(state) {
  const enabled = state.bootstrap.capabilities.managed_agent;
  return `
    <section class="panel question-panel">
      <form class="question-form" data-question-form>
        <input class="question-input" name="question" value="${escapeHtml(state.question)}" aria-label="Enterprise impact question" autocomplete="off" />
        <button class="button button-primary" type="submit">${icon('bolt')} Analyze impact</button>
      </form>
      <div class="question-options">
        <label class="toggle" title="Use the Google Gemini Managed Agent to enrich the deterministic result">
          <input type="checkbox" data-managed-agent-toggle ${state.useManagedAgent ? 'checked' : ''} ${enabled ? '' : 'disabled'} />
          <span class="toggle-track"><span class="toggle-knob"></span></span>
          Use Gemini Managed Agent ${enabled ? '' : '(API key not configured)'}
        </label>
        <span class="execution-note">All numerical outputs are grounded in the synthetic data package and ontology version ${escapeHtml(state.bootstrap.ontology.version)}.</span>
      </div>
    </section>
  `;
}

function reportKpis(report) {
  return `<section class="kpi-grid">${report.metrics.map((metric) => `
    <div class="kpi">
      <div class="kpi-label">${escapeHtml(metric.label)}</div>
      <div class="kpi-value">${escapeHtml(metricValue(metric, true))}</div>
      <div class="kpi-context">${escapeHtml(metric.context || '')}</div>
    </div>
  `).join('')}</section>`;
}

function evidencePanel(report) {
  return panel('Evidence paths', 'Each claim is linked to typed entities, relationships, and source systems.', `
    <div class="panel-body evidence-list">
      ${report.evidence_paths.map((path, index) => `
        <div class="evidence-item ${index === 0 ? 'open' : ''}">
          <button class="evidence-trigger" type="button" data-evidence-toggle>
            <span class="evidence-claim">${escapeHtml(path.claim)}</span>
            <span class="confidence">${Math.round(path.confidence * 100)}% confidence</span>
          </button>
          <div class="evidence-path">
            <div class="path-chain">
              ${path.steps.map((step, stepIndex) => `${stepIndex ? `<span class="path-arrow">${escapeHtml(path.steps[stepIndex - 1].relationship || 'links to')} →</span>` : ''}<button class="path-node" type="button" data-select-node="${escapeHtml(step.id)}">${escapeHtml(step.type)}: ${escapeHtml(step.label)}</button>`).join('')}
            </div>
            <div class="path-sources">Sources: ${path.sources.map(escapeHtml).join(' · ')}</div>
          </div>
        </div>
      `).join('') || '<div class="inspector-empty">No evidence paths were generated.</div>'}
    </div>
  `);
}

function ordersPanel(report) {
  return panel('Affected customer commitments', 'Confirmed orders reached through the ontology dependency path.', `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th>Order</th><th>Customer</th><th>Product</th><th>Plant</th><th>Promise</th><th class="numeric">Revenue</th><th class="numeric">Penalty</th></tr></thead>
        <tbody>${report.affected_orders.map((order) => `
          <tr>
            <td class="primary-cell">${escapeHtml(order.order_id)}<span class="sub-cell">${escapeHtml(order.contract_name)}</span></td>
            <td>${escapeHtml(order.customer_name)}<span class="sub-cell">${escapeHtml(order.customer_tier)}</span></td>
            <td>${escapeHtml(order.product_name)}</td>
            <td>${escapeHtml(order.plant_name)}</td>
            <td>${escapeHtml(formatDate(order.promised_date))}<span class="sub-cell">${formatNumber(order.sla_days)}-day SLA</span></td>
            <td class="numeric">${escapeHtml(formatCurrency(order.committed_revenue))}</td>
            <td class="numeric">${escapeHtml(formatCurrency(order.penalty_exposure))}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    </div>
  `);
}

function actionsPanel(report) {
  return panel('Recommended actions', 'Ranked by immediacy, dependency reduction, and customer consequence.', `
    <div class="action-list">
      ${report.recommended_actions.map((item) => `
        <div class="action-item">
          <div class="action-priority">${item.priority}</div>
          <div><div class="action-title">${escapeHtml(item.action)}</div><div class="action-rationale">${escapeHtml(item.rationale)}</div></div>
          <div class="action-owner">${escapeHtml(item.owner)}<span>${escapeHtml(item.owner_org)} · Due ${escapeHtml(formatDate(item.due))}</span></div>
        </div>
      `).join('')}
    </div>
  `, `
    <button class="button button-secondary" type="button" data-export="brief">${icon('file')} Decision brief</button>
    <button class="button button-secondary" type="button" data-export="tracker">${icon('sheet')} Mitigation tracker</button>
  `);
}

function definitionsPanel(report) {
  return panel('Governed definitions', 'The formulas and owners used for this answer.', `
    <div class="panel-body definition-grid">
      ${report.definitions_used.map((definition) => `
        <div class="definition">
          <div class="definition-name">${escapeHtml(definition.metric_name || definition.name || definition.metric_id)}</div>
          <div class="definition-formula">${escapeHtml(definition.formula || definition.definition || 'Governed semantic calculation')}</div>
          <div class="definition-meta">Owner: ${escapeHtml(definition.owner)} · Scope: ${escapeHtml(definition.scope || definition.business_context || 'Enterprise')}</div>
        </div>
      `).join('')}
    </div>
  `);
}

export function impactView(state) {
  const report = state.report;
  if (!report) {
    return `<div class="view-stack">${questionPanel(state)}<section class="panel empty-state">${icon('impact')}<h2>Run an impact scenario</h2><p>Ask about supplier disruption, single-source exposure, or conflicting enterprise metrics to generate a governed cross-domain analysis.</p></section></div>`;
  }
  const selectedNode = state.bootstrap.ontology.nodes.find((node) => node.id === state.selectedNodeId);
  const graph = panel('Impact dependency graph', 'Highlighted nodes and links support the current result.', `
    <div class="graph-layout">
      ${graphMarkup({ ontology: state.bootstrap.ontology, focusNodeIds: report.graph_focus?.node_ids, focusEdgeIds: report.graph_focus?.edge_ids, selectedNodeId: state.selectedNodeId, compact: true })}
      <aside class="entity-inspector" data-entity-inspector>${entityInspectorMarkup(selectedNode, state.bootstrap.ontology)}</aside>
    </div>
  `);
  const summary = `
    <section class="panel answer-summary">
      <h2>Decision summary</h2>
      <p>${escapeHtml(report.direct_answer)}</p>
      <div class="answer-meta">
        ${runtimeBadge(state.execution)}
        ${badge(`${titleCase(report.severity)} severity`, String(report.severity).toLowerCase())}
        <span class="meta-chip"><strong>Ontology</strong> v${escapeHtml(report.ontology_version)}</span>
        <span class="meta-chip"><strong>Generated</strong> ${escapeHtml(formatDate(report.generated_at, true))}</span>
      </div>
    </section>
  `;
  const assumptions = panel('Assumptions and open questions', 'The model makes uncertainty explicit rather than hiding it.', `
    <div class="panel-body two-column">
      <div><div class="inspector-type">ASSUMPTIONS</div><div class="plain-list" style="margin-top:12px">${report.assumptions.map((item) => `<div class="plain-list-item">${escapeHtml(item)}</div>`).join('')}</div></div>
      <div><div class="inspector-type">UNRESOLVED</div><div class="plain-list" style="margin-top:12px">${report.unresolved_questions.map((item) => `<div class="plain-list-item">${escapeHtml(item)}</div>`).join('')}</div></div>
    </div>
  `);
  return `<div class="view-stack">${questionPanel(state)}${reportKpis(report)}${summary}${graph}<div class="two-column">${evidencePanel(report)}${definitionsPanel(report)}</div>${ordersPanel(report)}${actionsPanel(report)}${assumptions}</div>`;
}

export function ontologyView(state) {
  const selectedNode = state.bootstrap.ontology.nodes.find((node) => node.id === state.selectedNodeId);
  const ontology = state.bootstrap.ontology;
  const stats = [
    ['Version', ontology.version, 'Effective enterprise model'],
    ['Entity types', ontology.entity_types.length, 'Canonical classes'],
    ['Relationships', ontology.relationship_types.length, 'Typed predicates'],
    ['Nodes', ontology.nodes.length, 'Demonstration entities'],
    ['Edges', ontology.edges.length, 'Cross-domain dependencies'],
    ['Effective', formatDate(ontology.effective_date), 'Current model date']
  ];
  return `<div class="view-stack">
    <section class="kpi-grid">${stats.map(([label, value, context]) => `<div class="kpi"><div class="kpi-label">${escapeHtml(label)}</div><div class="kpi-value">${escapeHtml(value)}</div><div class="kpi-context">${escapeHtml(context)}</div></div>`).join('')}</section>
    ${panel('Enterprise ontology', 'Select a node to inspect provenance, confidence, aliases, and connected relationships.', `
      <div class="graph-layout">
        ${graphMarkup({ ontology, selectedNodeId: state.selectedNodeId })}
        <aside class="entity-inspector" data-entity-inspector>${entityInspectorMarkup(selectedNode, ontology)}</aside>
      </div>
    `)}
    ${panel('Semantic contract', ontology.description, `
      <div class="panel-body two-column">
        <div><div class="inspector-type">ENTITY TYPES</div><div class="mapping-filters" style="margin-top:12px">${ontology.entity_types.map((type) => badge(type)).join('')}</div></div>
        <div><div class="inspector-type">RELATIONSHIP TYPES</div><div class="mapping-filters" style="margin-top:12px">${ontology.relationship_types.map((type) => badge(type)).join('')}</div></div>
      </div>
    `)}
  </div>`;
}

export function mappingsView(state) {
  const allMappings = state.bootstrap.mappings.map((mapping) => ({
    ...mapping,
    effectiveStatus: state.mappingDecisions[mapping.id] || mapping.status
  }));
  const statuses = ['All', 'Needs Review', 'Proposed', 'Approved', 'Rejected'];
  const mappings = state.mappingFilter === 'All' ? allMappings : allMappings.filter((mapping) => mapping.effectiveStatus === state.mappingFilter);
  return `<div class="view-stack">
    ${panel('Semantic mapping workbench', 'Review how source-system values resolve to canonical enterprise entities.', `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Source value</th><th>Canonical entity</th><th>Type</th><th>Evidence</th><th>Confidence</th><th>Risk</th><th>Status</th><th>Decision</th></tr></thead>
          <tbody>${mappings.map((mapping) => `
            <tr>
              <td class="primary-cell">${escapeHtml(mapping.source_value)}<span class="sub-cell">${escapeHtml(mapping.source_system)}</span></td>
              <td>${escapeHtml(mapping.proposed_label)}<span class="sub-cell">${escapeHtml(mapping.proposed_canonical_id)}</span></td>
              <td>${escapeHtml(mapping.entity_type)}</td>
              <td>${mapping.evidence.map(escapeHtml).join('<br>')}</td>
              <td>${Math.round(mapping.confidence * 100)}%</td>
              <td>${badge(mapping.risk, mapping.risk.toLowerCase())}</td>
              <td>${badge(mapping.effectiveStatus, mapping.effectiveStatus === 'Needs Review' ? 'review' : mapping.effectiveStatus.toLowerCase())}</td>
              <td><div class="mapping-actions">
                <button class="icon-button" type="button" data-mapping-decision="Approved" data-mapping-id="${escapeHtml(mapping.id)}" title="Approve">${icon('check')}</button>
                <button class="icon-button" type="button" data-mapping-decision="Rejected" data-mapping-id="${escapeHtml(mapping.id)}" title="Reject">${icon('x')}</button>
              </div></td>
            </tr>
          `).join('') || '<tr><td colspan="8">No mappings match this filter.</td></tr>'}</tbody>
        </table>
      </div>
    `, `<div class="mapping-filters">${statuses.map((status) => `<button class="filter-button ${state.mappingFilter === status ? 'active' : ''}" type="button" data-mapping-filter="${escapeHtml(status)}">${escapeHtml(status)}</button>`).join('')}</div>`)}
  </div>`;
}

export function sourcesView(state) {
  const domains = ['All', ...new Set(state.bootstrap.source_catalog.map((source) => source.domain))];
  const sources = state.sourceFilter === 'All'
    ? state.bootstrap.source_catalog
    : state.bootstrap.source_catalog.filter((source) => source.domain === state.sourceFilter);
  return `<div class="view-stack">
    ${panel('Enterprise source catalog', 'Operational systems that contribute evidence to the ontology and impact model.', `
      <div class="panel-body source-grid">
        ${sources.map((source) => `
          <article class="source-card">
            <div class="source-card-top"><div><div class="source-system">${escapeHtml(source.system_type)}</div><h3>${escapeHtml(source.source_name)}</h3></div><div><div class="quality-score">${source.quality_score}</div><div class="quality-label">QUALITY</div></div></div>
            <div class="quality-bar"><span style="width:${Math.max(0, Math.min(100, source.quality_score))}%"></span></div>
            <div class="source-meta">
              <div>Domain<strong>${escapeHtml(source.domain)}</strong></div>
              <div>Owner<strong>${escapeHtml(source.owner)}</strong></div>
              <div>Records<strong>${formatNumber(source.record_count)}</strong></div>
              <div>Refresh<strong>${escapeHtml(source.refresh_cadence)}</strong></div>
              <div style="grid-column:1/-1">Last refreshed<strong>${escapeHtml(formatDate(source.last_refresh, true))}</strong></div>
            </div>
          </article>
        `).join('')}
      </div>
    `, `<div class="source-filters">${domains.map((domain) => `<button class="filter-button ${state.sourceFilter === domain ? 'active' : ''}" type="button" data-source-filter="${escapeHtml(domain)}">${escapeHtml(domain)}</button>`).join('')}</div>`)}
  </div>`;
}

export function renderActiveView(state) {
  if (!state.bootstrap) return '<section class="panel empty-state"><h2>Loading enterprise model</h2><p>Preparing the ontology, source catalog, and guided scenarios.</p></section>';
  if (state.activeView === 'impact') return impactView(state);
  if (state.activeView === 'ontology') return ontologyView(state);
  if (state.activeView === 'mappings') return mappingsView(state);
  if (state.activeView === 'sources') return sourcesView(state);
  return overviewView(state);
}

export function bindView(container, state, actions) {
  container.querySelectorAll('[data-navigate]').forEach((button) => button.addEventListener('click', () => actions.navigate(button.dataset.navigate)));
  container.querySelectorAll('[data-run-scenario]').forEach((button) => button.addEventListener('click', () => {
    const scenario = state.bootstrap.scenarios.find((item) => item.id === button.dataset.runScenario);
    actions.runScenario(button.dataset.runScenario, scenario?.prompt);
  }));
  container.querySelector('[data-question-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    actions.analyze(String(form.get('question') || ''));
  });
  container.querySelector('[data-managed-agent-toggle]')?.addEventListener('change', (event) => actions.setManagedAgent(event.currentTarget.checked));
  container.querySelectorAll('[data-evidence-toggle]').forEach((button) => button.addEventListener('click', () => button.closest('.evidence-item')?.classList.toggle('open')));
  container.querySelectorAll('[data-select-node]').forEach((button) => button.addEventListener('click', () => actions.selectNode(button.dataset.selectNode)));
  container.querySelectorAll('[data-export]').forEach((button) => button.addEventListener('click', () => actions.exportReport(button.dataset.export)));
  container.querySelectorAll('[data-mapping-decision]').forEach((button) => button.addEventListener('click', () => actions.mappingDecision(button.dataset.mappingId, button.dataset.mappingDecision)));
  container.querySelectorAll('[data-mapping-filter]').forEach((button) => button.addEventListener('click', () => actions.mappingFilter(button.dataset.mappingFilter)));
  container.querySelectorAll('[data-source-filter]').forEach((button) => button.addEventListener('click', () => actions.sourceFilter(button.dataset.sourceFilter)));
  bindGraph(container, { onSelectNode: actions.selectNode });
}
