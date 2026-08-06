async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    const errorPayload = contentType.includes('json') ? await response.json() : { error: await response.text() };
    throw new Error(errorPayload.error || `Request failed with status ${response.status}`);
  }
  return contentType.includes('json') ? response.json() : response.blob();
}

export const api = {
  bootstrap: () => request('/api/bootstrap'),
  demoReport: () => request('/api/demo-report'),
  analyze: ({ question, scenarioId, useManagedAgent, previousInteractionId }) => request('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({
      question,
      scenario_id: scenarioId,
      use_managed_agent: useManagedAgent,
      previous_interaction_id: previousInteractionId
    })
  }),
  exportBrief: (report) => request('/api/export/brief', {
    method: 'POST',
    body: JSON.stringify({ report })
  }),
  exportTracker: (report) => request('/api/export/tracker', {
    method: 'POST',
    body: JSON.stringify({ report })
  })
};
