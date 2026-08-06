# Google AI Studio Setup

Import the repository from GitHub into Google AI Studio Build mode. The server entrypoint is `server.mjs` and browser assets are under `public/`.

Add `GEMINI_API_KEY` in the Secrets panel. The server reads it only at runtime.

Optional:

- `MANAGED_AGENT_ID` for a separately registered agent
- `GOOGLE_ACCESS_TOKEN` for Google Docs and Sheets export

The app can invoke the base Antigravity agent with inline sources, so agent registration is optional. The included Dockerfile runs the same server on Cloud Run port 8080.
