# Quick start

AgentFlow Test checks that an AI agent took the expected route: which agents ran, which tools they called, with which arguments, and what they said.

This repo includes a tiny fake support agent so you can see that happen without wiring up your own system first.

## 1. Requirements

- Node.js 18 or later (`fetch` and `node:test`)
- Git

No npm packages. There are no dependencies.

## 2. Clone

```bash
git clone https://github.com/Chan405/agentflow-test.git
cd agentflow-test
```

Run every command below from that directory.

## 3. Run the local example

The checked-in `agentflow.config.json` points at HTTP. For the in-process demo, set it to:

```json
{
  "target": {
    "type": "local",
    "module": "./examples/local/fake-agent.js"
  },
  "tests": "./tests/workflows.json"
}
```

Then:

```bash
node src/runner.js
```

That loads `examples/local/fake-agent.js` and runs `tests/workflows.json`.

`npm test` also works. It runs the library unit tests first, then the same runner.

## 4. Run the HTTP example

In a second terminal:

```bash
node examples/http/mock-server.js
```

You should see `Mock agent server listening on http://localhost:3001`.

Point config back at HTTP (this is the repo default):

```json
{
  "target": {
    "type": "http",
    "endpoint": "http://localhost:3001/agent"
  },
  "tests": "./tests/workflows.json"
}
```

```bash
node src/runner.js
```

The runner `POST`s each test `input` as JSON to that endpoint. No authentication.

## 5. What a passing run looks like

```text
AgentFlow Test

✓ wifi issue routes to troubleshooting
✓ plan inquiry selects plans tool
✓ connection outage passes internet argument
✓ troubleshooting never invokes sales agent
✓ upgrade request follows sales handoff path
✓ off-topic question stays at orchestrator without tools

-------------------
Tests: 6
Passed: 6
Failed: 0
Config errors: 0
Execution errors: 0
-------------------
```

Each line is one case from `tests/workflows.json`. A pass means the fake agent's `{ output, trace }` matched that case's `expect` block. Failed assertions print a diff. Bad config is `CONFIG ERROR`. A bad agent response or HTTP failure is `EXECUTION ERROR`. Any of those exits non-zero.

## 6. One test definition

From `tests/workflows.json`:

```json
{
  "name": "wifi issue routes to troubleshooting",
  "input": {
    "message": "My wifi keeps dropping every few minutes"
  },
  "expect": {
    "agents": ["orchestrator", "troubleshooting_agent"],
    "agentPath": ["orchestrator", "troubleshooting_agent"],
    "tracePath": [
      { "type": "agent", "name": "orchestrator" },
      { "type": "agent", "name": "troubleshooting_agent" },
      { "type": "tool", "name": "diagnostic_tool" }
    ],
    "output": {
      "contains": ["troubleshoot"],
      "notContains": ["upgrade"]
    }
  }
}
```

`agents` is presence. `agentPath` is the exact agent sequence. `tracePath` is the exact agent and tool sequence.

## 7. One normalized trace

That wifi input makes the demo agent return:

```json
{
  "output": "I'll troubleshoot your connection.",
  "trace": [
    { "type": "agent", "name": "orchestrator" },
    { "type": "agent", "name": "troubleshooting_agent" },
    {
      "type": "tool",
      "name": "diagnostic_tool",
      "arguments": { "connection": "internet" }
    }
  ]
}
```

`output` must be a string. `trace` must be an array of `{ "type": "agent"|"tool", "name": "..." }`. Tool `arguments` are optional and must be an object when present.

## 8. Connect your own HTTP agent

Keep `target.type` as `"http"`. Change `endpoint` to your URL. Change `tests` if your cases live in another JSON file.

Your server must:

- accept `POST` with `Content-Type: application/json`
- read a body like `{ "message": "..." }` (the test `input`)
- respond `200` with `{ "output": "...", "trace": [ ... ] }` as above

There is no auth, retries, or per-test adapter override. Then edit `tests/workflows.json` so `expect` matches *your* agents and tools, not the fake support demo.

## 9. Common first-run errors

| What you see | Usual cause |
|---|---|
| `HTTP adapter network failure: ...` on every case | HTTP target, but `node examples/http/mock-server.js` is not running |
| `Missing agentflow.config.json` | Command was not run from the repo root |
| `Unsupported target type "...". Use "local" or "http".` | `target.type` is not `local` or `http` |
| `HTTP target requires an "endpoint"` / `Local target requires a "module"` | That field is missing from `target` |
| `Tests file not found: ...` | `tests` path in config is wrong |
| `Agent returned an invalid result` / `invalid trace` / `HTTP adapter received invalid JSON` | Response is not `{ output, trace }` JSON |
| `HTTP adapter received HTTP 404` | Endpoint path is not the one the server serves (`/agent` on the mock) |
| `EADDRINUSE` on port 3001 | Something else is already bound to the mock port |
| `fetch is not defined` or `Cannot find module 'node:test'` | Node is older than 18 |
