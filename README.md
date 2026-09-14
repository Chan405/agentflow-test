# AgentFlow Test

Lightweight regression testing for AI agent workflows.

## Quick start

```bash
npm test
```

## How it works

1. Define test cases in `tests/workflows.json`.
2. Choose an adapter in `agentflow.config.json` (`local` or `http`).
3. Each case provides `input.message` and `expect` rules against a normalized execution `trace`.
4. `src/runner.js` sends the test input through the selected adapter, then evaluates the returned trace.

## Local agent example

`agentflow.config.json`:

```json
{
  "type": "local"
}
```

Local mode runs `examples/fake-agent.js` in-process. Then:

```bash
npm test
```

## HTTP agent example

Start the mock server:

```bash
node examples/mock-server.js
```

`agentflow.config.json`:

```json
{
  "type": "http",
  "endpoint": "http://localhost:3001/agent"
}
```

Then:

```bash
npm test
```

## Expected HTTP request

`POST /agent`

```json
{
  "message": "My wifi keeps dropping every few minutes"
}
```

## Expected response format

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

`trace` must be an array. Each step has `type` and `name`. Tool steps may include `arguments`.

## Expect rules

| Field | Description |
|-------|-------------|
| `agents` | Required agent names that must appear somewhere in the trace |
| `tools` | Required tool names that must appear somewhere in the trace |
| `toolArguments` | Expected argument values per tool name (exact match) |
| `forbiddenAgents` | Agents that must not appear |
| `forbiddenTools` | Tools that must not appear |
| `agentPath` | Exact ordered sequence of agent names |

## Current limitations

- Only `local` and `http` adapters
- Project-level config only (`agentflow.config.json`)
- HTTP adapter uses Node's built-in `fetch` and expects JSON
- No authentication, retries, or per-test adapter overrides
- Evaluator checks the trace, not the output string
