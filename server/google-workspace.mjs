function accessToken() {
  return process.env.GOOGLE_ACCESS_TOKEN || '';
}

export function workspaceConfigured() {
  return Boolean(accessToken());
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

export function buildDecisionBrief(report) {
  const lines = [
    'Enterprise Impact Navigator',
    report.question,
    '',
    'Decision summary',
    report.direct_answer,
    '',
    'Key measures',
    ...report.metrics.map((metric) => `- ${metric.label}: ${metric.format === 'currency' ? formatCurrency(metric.value) : metric.value} (${metric.context || 'governed definition'})`),
    '',
    'Recommended actions',
    ...report.recommended_actions.map((item) => `${item.priority}. ${item.action} Owner: ${item.owner}. Due: ${item.due}.`),
    '',
    'Assumptions',
    ...report.assumptions.map((assumption) => `- ${assumption}`),
    '',
    `Ontology version: ${report.ontology_version}`,
    `Generated: ${report.generated_at}`
  ];
  return lines.join('\n');
}

export function buildMitigationRows(report) {
  return [
    ['Priority', 'Action', 'Owner', 'Owner organization', 'Due date', 'Rationale', 'Status'],
    ...report.recommended_actions.map((item) => [
      item.priority,
      item.action,
      item.owner,
      item.owner_org,
      item.due,
      item.rationale,
      'Open'
    ])
  ];
}

async function googleRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google Workspace API failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  return response.json();
}

export async function createGoogleDoc(report) {
  if (!workspaceConfigured()) return null;
  const document = await googleRequest('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    body: JSON.stringify({ title: `Impact Decision Brief - ${report.scenario_id}` })
  });
  await googleRequest(`https://docs.googleapis.com/v1/documents/${document.documentId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: 1 }, text: buildDecisionBrief(report) } }]
    })
  });
  return {
    id: document.documentId,
    url: `https://docs.google.com/document/d/${document.documentId}/edit`
  };
}

export async function createGoogleSheet(report) {
  if (!workspaceConfigured()) return null;
  const spreadsheet = await googleRequest('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: `Impact Mitigation Tracker - ${report.scenario_id}` },
      sheets: [{ properties: { title: 'Mitigation actions' } }]
    })
  });
  const rows = buildMitigationRows(report);
  await googleRequest(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.spreadsheetId}/values/Mitigation%20actions!A1:G${rows.length}?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values: rows }) }
  );
  return {
    id: spreadsheet.spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}/edit`
  };
}
