# AgentFlow Test

Regression testing for AI agent workflows.

Expected:

```text
user
→ orchestrator
→ troubleshooting_agent
→ diagnostic_tool
```

After a prompt or model change:

```text
user
→ orchestrator
→ sales_agent
```

❌ regression

The final reply can still look helpful. AgentFlow Test verifies execution behavior, not just the final natural-language response: which agents ran, in what order, which tools they called, and with which arguments.

## Why AgentFlow Test?

A passing string check on the answer does not mean the workflow is intact. If support starts handing off to sales, or a tool is called with the wrong arguments, you want that to fail the same way a unit test fails.

This repo is a local runner. You write JSON cases, point them at an agent, and assert on a normalized `{ output, trace }`.

## What Can It Test?

- agent and tool presence
- forbidden agents and tools
- exact `agentPath` (agents only)
- exact `tracePath` (agents and tools)
- tool arguments, including nested objects and a specific invocation via `call`
- output `equals`, `contains`, and `notContains`
- malformed tests (unknown `expect` keys, empty `expect`) as config errors
- invalid agent envelopes and HTTP protocol problems as execution errors

`toolArguments` checks expected keys as a subset; extra actual properties are allowed. Nested objects recurse. Arrays must match exactly.

## Quick Start

Node.js 18+. No npm dependencies.

```bash
git clone https://github.com/Chan405/agentflow-test.git
cd agentflow-test
```

The included fake agent can run in-process or through the mock HTTP server. Commands, config, and first-run errors: [docs/QUICKSTART.md](docs/QUICKSTART.md).

## Example Test

Cases live in the JSON file named by `tests` in `agentflow.config.json`.

```json
{
  "name": "wifi issue routes to troubleshooting",
  "input": {
    "message": "My wifi keeps dropping every few minutes"
  },
  "expect": {
    "agentPath": ["orchestrator", "troubleshooting_agent"],
    "forbiddenAgents": ["sales_agent"]
  }
}
```

## Example Failure

```text
AgentFlow Test

✗ wifi issue routes to troubleshooting

  Forbidden agent "sales_agent" was called

  Expected agent path:
  orchestrator -> troubleshooting_agent

  Actual agent path:
  orchestrator -> sales_agent

-------------------
Tests: 1
Passed: 0
Failed: 1
Config errors: 0
Execution errors: 0
-------------------
```

Config problems are labeled `CONFIG ERROR`. Invalid agent responses and HTTP failures are labeled `EXECUTION ERROR`. Any of those exits non-zero.

## How It Works

```text
test definition
→ agent adapter
→ normalized trace
→ evaluator
→ report
```

Each case sends `input` to the configured target. The adapter must return:

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

The evaluator compares that against `expect`. The reporter prints passes, failures, and a summary.

## Supported Targets

Configured in `agentflow.config.json`:

- **local** — a Node module that exports `run(input)` (or the function itself)
- **http** — `POST` JSON `input` to `target.endpoint`; response body must be `{ output, trace }`

There is no authentication.

## Current Limitations

- Experimental. Not production-ready
- Not an installable CLI yet (`node src/runner.js` or `npm test`)
- Only `local` and `http` targets
- One project-level config file; no per-test adapter overrides
- HTTP uses Node `fetch`, expects JSON, no retries
- Output checks are exact or substring match, not semantic similarity
- `agentPath` ignores tools; `tracePath` ignores tool arguments

## Status

v0.1.0 experimental alpha.
