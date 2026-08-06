import { buildManagedAgentSources } from './data-repository.mjs';

const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_AGENT = 'antigravity-preview-05-2026';

export function managedAgentConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function parseJsonCandidate(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  try {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function extractText(event) {
  const eventType = event?.event_type;
  if (eventType !== 'step.delta') return '';
  const delta = event?.delta || {};
  if (typeof delta.text === 'string') return delta.text;
  if (typeof delta.output_text === 'string') return delta.output_text;
  if (typeof delta.summary === 'string' && delta.type !== 'thought_summary') return delta.summary;
  return '';
}

async function parseSseResponse(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Managed Agent response did not include a readable stream.');
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let interactionId;
  let environmentId;

  const handleLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const value = trimmed.slice(5).trim();
    if (!value || value === '[DONE]') return;
    try {
      const event = JSON.parse(value);
      text += extractText(event);
      const interaction = event.interaction || event.data?.interaction;
      interactionId ||= interaction?.name || interaction?.id || event.name;
      const environment = interaction?.environment || event.environment;
      environmentId ||= environment?.env_id || environment?.environment_id || environment?.id;
    } catch {
      // Ignore malformed intermediate SSE lines and preserve the rest of the stream.
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) handleLine(line);
  }
  buffer += decoder.decode();
  if (buffer.trim()) handleLine(buffer);
  reader.releaseLock();
  return { text, interactionId, environmentId };
}

export async function runManagedAgent({ question, deterministicReport, previousInteractionId }) {
  if (!managedAgentConfigured()) {
    return {
      used: false,
      reason: 'GEMINI_API_KEY is not configured.',
      report: deterministicReport
    };
  }

  const prompt = [
    'Analyze the enterprise impact question using only the mounted synthetic enterprise package and governed ontology.',
    'The deterministic engine output below is the trusted numerical baseline. Preserve its numeric values unless you explicitly identify a data defect.',
    'Return one JSON object matching the same shape as the baseline. Improve explanation, evidence phrasing, assumptions, and recommendations without fabricating data.',
    '',
    `Question: ${question}`,
    '',
    'Deterministic baseline:',
    JSON.stringify(deterministicReport)
  ].join('\n');

  const payload = {
    agent: process.env.MANAGED_AGENT_ID || DEFAULT_AGENT,
    input: [{ type: 'text', text: prompt }],
    stream: true,
    tools: [{ type: 'code_execution' }],
    environment: {
      type: 'remote',
      sources: buildManagedAgentSources(),
      network: {
        allowlist: [
          {
            domain: 'generativelanguage.googleapis.com',
            transform: { 'x-goog-api-key': process.env.GEMINI_API_KEY }
          }
        ]
      }
    },
    ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {})
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/interactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
        'x-server-timeout': '180',
        'Api-Revision': '2026-05-20',
        'x-goog-api-client': 'enterprise-impact-navigator/1.0.0'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Managed Agent request failed (${response.status}): ${detail.slice(0, 500)}`);
  }

  const result = await parseSseResponse(response);
  const parsed = parseJsonCandidate(result.text);
  const report = parsed && Array.isArray(parsed.metrics) && Array.isArray(parsed.evidence_paths)
    ? { ...deterministicReport, ...parsed }
    : deterministicReport;

  return {
    used: true,
    report,
    raw_text: result.text,
    interaction_id: result.interactionId,
    environment_id: result.environmentId,
    parsed: report !== deterministicReport
  };
}
