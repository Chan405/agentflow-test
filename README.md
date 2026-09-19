# AgentFlow Test

Regression testing for AI agent workflows.

This project is experimental. It is a local CLI for checking a normalized agent trace against explicit assertions. It is not a production platform.

## What It Tests

- agent presence
- tool presence
- forbidden agents
- forbidden tools
- agent path
- complete agent/tool trace path
- tool arguments
- nested tool arguments
- multiple tool invocations
- deterministic output assertions

## Why AgentFlow Test

A final reply can look fine while the workflow is wrong. The agent below answers the outage, but it handed off to sales and recommended an upgrade:

```text
User: "My internet is still down after restarting"

Output: "Sorry about the downtime. I can troubleshoot that — or you could upgrade."

Trace:
  orchestrator
  → sales_agent
  → plans_tool
```

Output checks alone can miss that. AgentFlow Test also asserts the route: which agents ran, in what order, which tools were called, and with which arguments.

## Test Example

Define cases in `tests/workflows.json`.

```json
{
  "name": "support escalation workflow",
  "input": {
    "message": "My internet is still down after restarting"
  },
  "expect": {
    "agentPath": ["orchestrator", "troubleshooting_agent"],
    "tracePath": [
      { "type": "agent", "name": "orchestrator" },
      { "type": "agent", "name": "troubleshooting_agent" },
      { "type": "tool", "name": "diagnostic_tool" }
    ],
    "tools": ["diagnostic_tool"],
    "toolArguments": {
      "diagnostic_tool": {
        "call": 0,
        "arguments": {
          "connection": "internet"
        }
      }
    },
    "forbiddenAgents": ["sales_agent"],
    "output": {
      "contains": ["troubleshoot"],
      "notContains": ["upgrade"]
    }
  }
}
```

`agents` and `tools` check presence only. `agentPath` is the exact agent sequence. `tracePath` is the exact agent and tool sequence. `toolArguments` compares expected keys as a subset; extra actual properties are allowed. Nested objects are compared recursively. Arrays must match exactly. If the same tool is called more than once, use a zero-based `call` index. Unindexed `toolArguments` are only valid when that tool was called once.

`output.equals` is exact and case-sensitive. `output.contains` and `output.notContains` are case-insensitive substrings.

Unknown `expect` keys are rejected. An empty `expect` object is rejected. A malformed test is a config error, not a workflow failure.

## Normalized Trace Format

Adapters must return:

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

- `output` must be a string
- `trace` must be an array
- each step must have `type` and `name`
- `type` must be `agent` or `tool`
- tool `arguments` are optional and must be an object when present

A missing or invalid envelope is an execution error. A malformed step is reported and is not ignored.

## Local Mode

`agentflow.config.json`:

```json
{
  "type": "local"
}
```

Local mode runs `examples/fake-agent.js` in-process.

```bash
npm test
```

## HTTP Mode

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

```bash
npm test
```

The HTTP adapter `POST`s JSON `{ "message": "..." }` to the configured endpoint and expects the normalized `{ output, trace }` body. There is no authentication.

## Running Tests

```bash
npm test
```

This runs the evaluator unit tests, then `src/runner.js` against `tests/workflows.json` using the adapter in `agentflow.config.json`.

Any failed assertion, config error, or execution error exits with a non-zero status.

## Failure Example

```text
AgentFlow Test

✓ wifi issue routes to troubleshooting

✗ booking uses correct arguments

  Tool: booking_tool

  customer.name
  expected: "Alice"
  received: "Bob"

-------------------
Tests: 2
Passed: 1
Failed: 1
Config errors: 0
Execution errors: 0
-------------------
```

Config problems are labeled `CONFIG ERROR`. Invalid agent responses and HTTP protocol problems are labeled `EXECUTION ERROR`.

## Current Limitations

- Experimental. Not production-ready
- Only `local` and `http` adapters
- Project-level config only (`agentflow.config.json`)
- HTTP adapter uses Node's built-in `fetch` and expects JSON
- No authentication, retries, or per-test adapter overrides
- Output checks are exact equality or substring match, not semantic similarity
- `tracePath` ignores tool arguments
- `agentPath` ignores tools
