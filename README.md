# AgentFlow Test

Lightweight regression testing for AI agent workflows.

## Quick start

```bash
npm test
```

## How it works

1. Define test cases in `tests/workflows.json`.
2. Each case provides `input.message` and `expect` rules against a normalized execution `trace`.
3. `examples/fake-agent.js` is a Day 2 stub that returns canned traces. Replace it with your real agent runner later.
4. `src/runner.js` loads cases, runs the agent, evaluates results, and prints a summary.

## Trace format

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

## Expect rules

| Field | Description |
|-------|-------------|
| `agents` | Required agent names that must appear somewhere in the trace |
| `tools` | Required tool names that must appear somewhere in the trace |
| `toolArguments` | Expected argument values per tool name (exact match) |
| `forbiddenAgents` | Agents that must not appear |
| `forbiddenTools` | Tools that must not appear |
| `agentPath` | Exact ordered sequence of agent names |
