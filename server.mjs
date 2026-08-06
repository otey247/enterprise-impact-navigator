import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBootstrap, runScenario } from './server/impact-engine.mjs';
import { managedAgentConfigured, runManagedAgent } from './server/managed-agent.mjs';
import {
  buildDecisionBrief,
  buildMitigationRows,
  createGoogleDoc,
  createGoogleSheet,
  workspaceConfigured
} from './server/google-workspace.mjs';
import {
  applySecurityHeaders,
  readJsonBody,
  sendJson,
  sendText,
  serveStatic
} from './server/http-utils.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));

function loadLocalEnvironment() {
  for (const filename of ['.env', '.env.local']) {
    const path = join(ROOT, filename);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separator = trimmed.indexOf('=');
      if (separator < 1) continue;
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if ((value.startsWith('\"') && value.endsWith('\"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

loadLocalEnvironment();

const PUBLIC_DIRECTORY = join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

const server = createServer(async (req, res) => {
  applySecurityHeaders(res);
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, 200, {
        status: 'ok',
        service: 'enterprise-impact-navigator',
        managed_agent_configured: managedAgentConfigured(),
        google_workspace_configured: workspaceConfigured(),
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/bootstrap') {
      return sendJson(res, 200, {
        ...buildBootstrap(),
        capabilities: {
          deterministic_analysis: true,
          managed_agent: managedAgentConfigured(),
          google_workspace: workspaceConfigured()
        }
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/demo-report') {
      const report = runScenario({
        scenarioId: 'supplier-disruption-30',
        question: "If Nova Components' Monterrey facility is unavailable for 30 days, what is our exposure?"
      });
      return sendJson(res, 200, { report, execution: { mode: 'deterministic' } });
    }

    if (req.method === 'POST' && url.pathname === '/api/analyze') {
      const body = await readJsonBody(req);
      const question = String(body.question || '').trim();
      if (!question) return sendJson(res, 400, { error: 'A business question is required.' });
      const deterministicReport = runScenario({ scenarioId: body.scenario_id, question });

      if (body.use_managed_agent) {
        try {
          const agentResult = await runManagedAgent({
            question,
            deterministicReport,
            previousInteractionId: body.previous_interaction_id
          });
          return sendJson(res, 200, {
            report: agentResult.report,
            execution: {
              mode: agentResult.used ? 'managed-agent' : 'deterministic',
              managed_agent_used: agentResult.used,
              parsed_agent_output: agentResult.parsed || false,
              interaction_id: agentResult.interaction_id,
              environment_id: agentResult.environment_id,
              fallback_reason: agentResult.reason
            }
          });
        } catch (error) {
          return sendJson(res, 200, {
            report: deterministicReport,
            execution: {
              mode: 'deterministic-fallback',
              managed_agent_used: false,
              warning: error.message
            }
          });
        }
      }

      return sendJson(res, 200, { report: deterministicReport, execution: { mode: 'deterministic' } });
    }

    if (req.method === 'POST' && url.pathname === '/api/export/brief') {
      const body = await readJsonBody(req);
      if (!body.report) return sendJson(res, 400, { error: 'A report is required.' });
      const document = await createGoogleDoc(body.report);
      if (document) return sendJson(res, 200, { mode: 'google-doc', ...document });
      const text = buildDecisionBrief(body.report);
      return sendText(res, 200, text, 'text/plain; charset=utf-8', {
        'Content-Disposition': `attachment; filename="impact-decision-brief-${body.report.scenario_id}.txt"`
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/export/tracker') {
      const body = await readJsonBody(req);
      if (!body.report) return sendJson(res, 400, { error: 'A report is required.' });
      const spreadsheet = await createGoogleSheet(body.report);
      if (spreadsheet) return sendJson(res, 200, { mode: 'google-sheet', ...spreadsheet });
      const csv = rowsToCsv(buildMitigationRows(body.report));
      return sendText(res, 200, csv, 'text/csv; charset=utf-8', {
        'Content-Disposition': `attachment; filename="impact-mitigation-tracker-${body.report.scenario_id}.csv"`
      });
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && serveStatic(req, res, PUBLIC_DIRECTORY)) return;
    sendJson(res, 404, { error: 'Not found.' });
  } catch (error) {
    console.error(error);
    sendJson(res, error.statusCode || 500, {
      error: error.statusCode ? error.message : 'The request could not be completed.',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Enterprise Impact Navigator listening on http://${HOST}:${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received. Closing server.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
