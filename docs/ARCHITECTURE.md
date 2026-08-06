# Architecture

## Runtime

Enterprise Impact Navigator uses a dependency-free Node.js server and a browser-native ES module frontend. This minimizes supply-chain risk and allows the repository to run immediately after import into Google AI Studio Build mode.

```text
Browser application
  ├── Overview and scenario launcher
  ├── Impact explorer
  ├── Ontology graph
  ├── Mapping workbench
  └── Source catalog
          │
          ▼
Node.js HTTP server
  ├── Demo data repository
  ├── Deterministic impact engine
  ├── Gemini Interactions API adapter
  ├── Google Workspace export adapter
  └── Static file server
          │
          ├── demo-data/*.csv
          ├── demo-data/ontology/*.json
          └── agent/**/*
```

## Deterministic execution

The default engine loads the synthetic CSV package, traverses governed relationships, applies metric definitions, and returns an impact-report contract. The same scenario produces the same answer, which makes it reliable for executive demonstrations.

## Managed-agent execution

When `GEMINI_API_KEY` is present, the server invokes the Gemini Interactions API and mounts:

- `agent/AGENTS.md` at `/.agents/AGENTS.md`
- `agent/skills/**` at `/.agents/skills/**`
- `agent/requirements.txt` at `/.agents/requirements.txt`
- `demo-data/**` at `/.agents/data/**`

The deterministic report is supplied as a grounded baseline so the agent can enrich explanations without inventing metrics.

## Impact report contract

```json
{
  "report_id": "string",
  "scenario_id": "string",
  "question": "string",
  "direct_answer": "string",
  "ontology_version": "string",
  "metrics": [],
  "affected_orders": [],
  "evidence_paths": [],
  "definitions_used": [],
  "assumptions": [],
  "recommended_actions": [],
  "graph_focus": {"node_ids": [], "edge_ids": []}
}
```

## Security posture

- Gemini and Workspace credentials remain server-side.
- User input is treated as text, not executable code.
- Static paths are normalized and constrained to `public/`.
- The managed agent is configured without Google Search by default.
- The core demo performs no outbound network calls.
