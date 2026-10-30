import { escapeHtml, humanizeType } from './utils.js';
import { icon } from './icons.js';

const TYPE_COLUMNS = {
  Supplier: 0,
  SupplierSite: 1,
  Part: 2,
  Product: 3,
  Plant: 4,
  SalesOrder: 5,
  Customer: 6,
  Contract: 7,
  Organization: 8,
  Metric: 8,
  Policy: 8
};

const WIDTH = 1420;
const HEIGHT = 560;
const LEFT = 80;
const RIGHT = 80;
const TOP = 64;
const BOTTOM = 48;

function truncate(value, length = 22) {
  const text = String(value || '');
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function buildPositions(nodes) {
  const groups = new Map();
  for (const node of nodes) {
    const column = TYPE_COLUMNS[node.type] ?? 8;
    if (!groups.has(column)) groups.set(column, []);
    groups.get(column).push(node);
  }

  const positions = new Map();
  const availableWidth = WIDTH - LEFT - RIGHT;
  for (const [column, group] of groups.entries()) {
    const x = LEFT + (availableWidth * column) / 8;
    const availableHeight = HEIGHT - TOP - BOTTOM;
    const spacing = availableHeight / Math.max(group.length, 1);
    group.forEach((node, index) => {
      positions.set(node.id, {
        x,
        y: TOP + spacing * index + spacing / 2
      });
    });
  }
  return positions;
}

function curvePath(source, target) {
  const delta = Math.max(60, Math.abs(target.x - source.x) * 0.42);
  return `M ${source.x + 33} ${source.y} C ${source.x + delta} ${source.y}, ${target.x - delta} ${target.y}, ${target.x - 33} ${target.y}`;
}

export function graphMarkup({ ontology, focusNodeIds = [], focusEdgeIds = [], selectedNodeId, compact = false }) {
  if (!ontology?.nodes?.length) return '<div class="inspector-empty">Ontology data is not available.</div>';
  const focusNodes = new Set(focusNodeIds);
  const focusEdges = new Set(focusEdgeIds);
  const visibleNodes = compact && focusNodes.size
    ? ontology.nodes.filter((node) => focusNodes.has(node.id))
    : ontology.nodes;
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = ontology.edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
  const positions = buildPositions(visibleNodes);

  const edges = visibleEdges.map((edge) => {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) return '';
    const focused = focusEdges.has(edge.id) || (focusNodes.has(edge.source) && focusNodes.has(edge.target));
    const middleX = (source.x + target.x) / 2;
    const middleY = (source.y + target.y) / 2 - 7;
    return `
      <path class="graph-edge ${focused ? 'focus' : ''}" d="${curvePath(source, target)}"></path>
      ${focused ? `<text class="graph-edge-label" x="${middleX}" y="${middleY}">${escapeHtml(edge.label)}</text>` : ''}
    `;
  }).join('');

  const nodes = visibleNodes.map((node) => {
    const position = positions.get(node.id);
    const focused = focusNodes.has(node.id);
    const selected = selectedNodeId === node.id;
    return `
      <g class="graph-node ${focused ? 'focus' : ''} ${selected ? 'selected' : ''}" data-node-id="${escapeHtml(node.id)}" transform="translate(${position.x} ${position.y})" tabindex="0" role="button" aria-label="Inspect ${escapeHtml(node.label)}">
        <circle r="33"></circle>
        <text class="node-label" y="-2">${escapeHtml(truncate(node.label))}</text>
        <text class="node-type" y="14">${escapeHtml(humanizeType(node.type))}</text>
      </g>
    `;
  }).join('');

  return `
    <div class="graph-stage" data-graph>
      <div class="graph-toolbar" aria-label="Graph controls">
        <button class="button button-secondary" type="button" data-graph-zoom="in" aria-label="Zoom in">${icon('plus')}</button>
        <button class="button button-secondary" type="button" data-graph-zoom="out" aria-label="Zoom out">${icon('minus')}</button>
        <button class="button button-secondary" type="button" data-graph-zoom="reset" aria-label="Reset graph">${icon('reset')}</button>
      </div>
      <svg class="graph-canvas" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Enterprise ontology graph">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#47525e"></path>
          </marker>
        </defs>
        <g class="graph-content" data-graph-content>
          ${edges}
          ${nodes}
        </g>
      </svg>
    </div>
  `;
}

export function entityInspectorMarkup(node, ontology) {
  if (!node) {
    return `<div class="inspector-empty">Select an entity to see its details.</div>`;
  }
  const outgoing = ontology.edges.filter((edge) => edge.source === node.id);
  const incoming = ontology.edges.filter((edge) => edge.target === node.id);
  const relationships = [...outgoing, ...incoming];
  const labelFor = (id) => ontology.nodes.find((item) => item.id === id)?.label || id;
  const none = 'None';
  return `
    <div class="inspector-content">
      <div class="inspector-type">${escapeHtml(humanizeType(node.type))}</div>
      <h3>${escapeHtml(node.label)}</h3>
      ${node.subtitle ? `<div class="inspector-subtitle">${escapeHtml(node.subtitle)}</div>` : ''}
      <div class="detail-list">
        <div class="detail-item"><div class="detail-label">ID</div><div class="detail-value">${escapeHtml(node.id)}</div></div>
        <div class="detail-item"><div class="detail-label">Source system</div><div class="detail-value">${escapeHtml(node.source || 'Not listed')}</div></div>
        <div class="detail-item"><div class="detail-label">Confidence</div><div class="detail-value">${Math.round(Number(node.confidence || 0) * 100)}%</div></div>
        <div class="detail-item"><div class="detail-label">Also known as</div><div class="detail-value">${node.aliases?.length ? node.aliases.map(escapeHtml).join(', ') : none}</div></div>
        <div class="detail-item"><div class="detail-label">Relationships</div><div class="detail-value">${relationships.length ? relationships.map((edge) => escapeHtml(`${humanizeType(edge.type)}: ${labelFor(edge.source === node.id ? edge.target : edge.source)}`)).join('<br>') : none}</div></div>
      </div>
    </div>
  `;
}

export function bindGraph(container, { onSelectNode }) {
  const graph = container.querySelector('[data-graph]');
  if (!graph) return;
  const content = graph.querySelector('[data-graph-content]');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  const applyTransform = () => {
    content?.setAttribute('transform', `translate(${offsetX} ${offsetY}) scale(${scale})`);
  };

  graph.querySelectorAll('[data-graph-zoom]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.graphZoom;
      if (action === 'in') scale = Math.min(1.7, scale + .15);
      if (action === 'out') scale = Math.max(.65, scale - .15);
      if (action === 'reset') { scale = 1; offsetX = 0; offsetY = 0; }
      applyTransform();
    });
  });

  graph.querySelectorAll('[data-node-id]').forEach((node) => {
    const select = () => onSelectNode?.(node.dataset.nodeId);
    node.addEventListener('click', select);
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });
  });
}
