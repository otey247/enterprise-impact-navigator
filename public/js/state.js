const listeners = new Set();

export const state = {
  bootstrap: null,
  report: null,
  execution: null,
  activeView: 'overview',
  selectedNodeId: null,
  selectedScenarioId: 'supplier-disruption-30',
  question: "If Nova Components' Monterrey facility is unavailable for 30 days, what is our exposure?",
  useManagedAgent: false,
  interactionId: null,
  mappingFilter: 'All',
  sourceFilter: 'All',
  mappingDecisions: JSON.parse(localStorage.getItem('impact-navigator-mapping-decisions') || '{}')
};

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateState(patch) {
  Object.assign(state, patch);
  listeners.forEach((listener) => listener(state));
}

export function saveMappingDecision(mappingId, decision) {
  state.mappingDecisions[mappingId] = decision;
  localStorage.setItem('impact-navigator-mapping-decisions', JSON.stringify(state.mappingDecisions));
  listeners.forEach((listener) => listener(state));
}
