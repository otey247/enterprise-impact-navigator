import { api } from './js/api.js';
import { icon } from './js/icons.js';
import { bindView, renderActiveView } from './js/views.js';
import { saveMappingDecision, state, subscribe, updateState } from './js/state.js';
import { downloadBlob } from './js/utils.js';

const main = document.querySelector('#main-content');
const nav = document.querySelector('#primary-nav');
const pageTitle = document.querySelector('#page-title');
const commandButton = document.querySelector('#command-button');
const toastRegion = document.querySelector('#toast-region');

const viewTitles = {
  overview: 'Overview',
  impact: 'Impact Explorer',
  ontology: 'Ontology',
  mappings: 'Mappings',
  sources: 'Sources'
};

const navItems = [
  ['overview', 'Overview', 'overview'],
  ['impact', 'Impact Explorer', 'impact'],
  ['ontology', 'Ontology', 'ontology'],
  ['mappings', 'Mappings', 'mappings'],
  ['sources', 'Sources', 'sources']
];

function countFor(view) {
  if (!state.bootstrap) return '';
  if (view === 'ontology') return state.bootstrap.summary.nodes;
  if (view === 'mappings') return state.bootstrap.summary.mappings_needing_review;
  if (view === 'sources') return state.bootstrap.summary.sources;
  return '';
}

function renderNavigation() {
  nav.innerHTML = navItems.map(([view, label, iconName]) => `
    <button class="nav-button" type="button" data-nav-view="${view}" ${state.activeView === view ? 'aria-current="page"' : ''} title="${label}">
      ${icon(iconName)}
      <span class="nav-label">${label}</span>
      ${countFor(view) !== '' ? `<span class="nav-count">${countFor(view)}</span>` : ''}
    </button>
  `).join('');
  nav.querySelectorAll('[data-nav-view]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.navView)));
}

function injectTopbarIcons() {
  commandButton.querySelector('[data-icon="search"]')?.replaceWith(document.createRange().createContextualFragment(icon('search')));
}

function render() {
  const title = viewTitles[state.activeView] || viewTitles.overview;
  pageTitle.textContent = title;
  document.title = `${title} | Impact Navigator`;
  renderNavigation();
  if (state.bootstrap) document.querySelector('#sidebar-version').textContent = state.bootstrap.ontology.version;
  main.innerHTML = renderActiveView(state);
  bindView(main, state, actions);
}

function navigate(view) {
  updateState({ activeView: view });
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(title, message, duration = 4200) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
  toastRegion.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

function showLoading(useManagedAgent) {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-card" role="status">
      <div class="loading-title">Analyzing impact</div>
      <div class="loading-step" data-loading-step>Finding affected suppliers and parts</div>
      <div class="loading-bar"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  const steps = [
    'Finding affected suppliers and parts',
    'Matching orders and contracts',
    'Calculating exposure',
    useManagedAgent ? 'Asking Gemini' : 'Preparing recommendations'
  ];
  let index = 0;
  const timer = setInterval(() => {
    index = Math.min(index + 1, steps.length - 1);
    const label = overlay.querySelector('[data-loading-step]');
    if (label) label.textContent = steps[index];
  }, 900);
  return () => {
    clearInterval(timer);
    overlay.remove();
  };
}

async function analyze(question, scenarioId = state.selectedScenarioId) {
  const cleanQuestion = String(question || '').trim();
  if (!cleanQuestion) {
    showToast('Enter a question', 'Type something to analyze.');
    return;
  }
  updateState({ question: cleanQuestion, selectedScenarioId: scenarioId, activeView: 'impact' });
  const hideLoading = showLoading(state.useManagedAgent);
  try {
    const result = await api.analyze({
      question: cleanQuestion,
      scenarioId,
      useManagedAgent: state.useManagedAgent,
      previousInteractionId: state.interactionId
    });
    updateState({
      report: result.report,
      execution: result.execution,
      interactionId: result.execution?.interaction_id || state.interactionId,
      selectedNodeId: result.report.graph_focus?.node_ids?.[0] || null
    });
    if (result.execution?.warning) {
      showToast('Gemini unavailable', result.execution.warning);
    } else {
      showToast('Analysis complete', `${result.report.metrics.length} measures and ${result.report.evidence_paths.length} evidence paths.`);
    }
  } catch (error) {
    showToast('Analysis failed', error.message);
  } finally {
    hideLoading();
  }
}

async function runScenario(scenarioId, prompt) {
  const scenario = state.bootstrap.scenarios.find((item) => item.id === scenarioId);
  await analyze(prompt || scenario?.prompt || state.question, scenarioId);
}

async function exportReport(type) {
  if (!state.report) return;
  try {
    const result = type === 'brief' ? await api.exportBrief(state.report) : await api.exportTracker(state.report);
    if (result instanceof Blob) {
      const extension = type === 'brief' ? 'txt' : 'csv';
      downloadBlob(result, `enterprise-impact-${type}-${state.report.scenario_id}.${extension}`);
      showToast('Downloaded', `${type === 'brief' ? 'Decision brief' : 'Mitigation tracker'} saved.`);
      return;
    }
    if (result.url) {
      const anchor = document.createElement('a');
      anchor.href = result.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.click();
      showToast(`Created in Google ${result.mode === 'google-doc' ? 'Docs' : 'Sheets'}`, 'Opened in a new tab.');
    }
  } catch (error) {
    showToast('Export failed', error.message);
  }
}

function selectNode(nodeId) {
  if (!state.bootstrap.ontology.nodes.some((node) => node.id === nodeId)) {
    showToast('Not in the graph', `${nodeId} isn't part of the demo graph.`);
    return;
  }
  updateState({ selectedNodeId: nodeId });
}

function mappingDecision(mappingId, decision) {
  saveMappingDecision(mappingId, decision);
  showToast(`Mapping ${decision.toLowerCase()}`, 'Saved in this browser.');
}

const actions = {
  navigate,
  analyze,
  runScenario,
  exportReport,
  selectNode,
  setManagedAgent: (value) => updateState({ useManagedAgent: value }),
  mappingDecision,
  mappingFilter: (value) => updateState({ mappingFilter: value }),
  sourceFilter: (value) => updateState({ sourceFilter: value })
};

function closeCommandPalette() {
  document.querySelector('[data-command-dialog]')?.remove();
}

function openCommandPalette() {
  if (!state.bootstrap || document.querySelector('[data-command-dialog]')) return;
  const dialog = document.createElement('div');
  dialog.className = 'command-dialog';
  dialog.dataset.commandDialog = '';
  dialog.innerHTML = `
    <div class="command-box" role="dialog" aria-modal="true" aria-label="Ask a question">
      <form data-command-form>
        <div class="command-input-wrap">${icon('search')}<input name="question" aria-label="Question" placeholder="Ask a question" autocomplete="off" /></div>
      </form>
      <div class="command-scenarios">
        ${state.bootstrap.scenarios.map((scenario) => `
          <button class="command-scenario" type="button" data-command-scenario="${scenario.id}">
            <span class="command-scenario-title">${scenario.title}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  const input = dialog.querySelector('input');
  input.focus();
  dialog.addEventListener('click', (event) => { if (event.target === dialog) closeCommandPalette(); });
  dialog.querySelector('[data-command-form]').addEventListener('submit', (event) => {
    event.preventDefault();
    const question = new FormData(event.currentTarget).get('question');
    closeCommandPalette();
    analyze(question, 'natural-language');
  });
  dialog.querySelectorAll('[data-command-scenario]').forEach((button) => button.addEventListener('click', () => {
    const scenario = state.bootstrap.scenarios.find((item) => item.id === button.dataset.commandScenario);
    closeCommandPalette();
    runScenario(scenario.id, scenario.prompt);
  }));
}

commandButton.addEventListener('click', openCommandPalette);
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    openCommandPalette();
  }
  if (event.key === 'Escape') closeCommandPalette();
});

subscribe(render);
injectTopbarIcons();
render();

async function initialize() {
  try {
    const [bootstrap, demo] = await Promise.all([api.bootstrap(), api.demoReport()]);
    updateState({
      bootstrap,
      report: demo.report,
      execution: demo.execution,
      useManagedAgent: Boolean(bootstrap.capabilities.managed_agent)
    });
  } catch (error) {
    main.innerHTML = `<section class="panel empty-state">${icon('alert')}<h2>Couldn't load the app</h2><p>${error.message}</p></section>`;
    showToast("Couldn't load the app", error.message, 8000);
  }
}

initialize();
