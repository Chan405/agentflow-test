const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { evaluate } = require("../src/evaluator");
const { inspectAgentResult, inspectTraceEvents } = require("../src/result");
const localAdapter = require("../src/adapters/local");
const httpAdapter = require("../src/adapters/http");

const validResult = {
  output: "I'll troubleshoot your connection.",
  trace: [{ type: "agent", name: "orchestrator" }],
};

function assertDoesNotThrow(fn) {
  fn();
}

describe("inspectAgentResult protocol problems", () => {
  it("rejects a null result", () => {
    const inspected = inspectAgentResult(null);

    assert.equal(inspected.ok, false);
    assert.equal(inspected.error, "Agent returned an invalid result:\nresult must be an object");
  });

  it("rejects a missing output", () => {
    const inspected = inspectAgentResult({ trace: [] });

    assert.equal(inspected.ok, false);
    assert.equal(inspected.error, "Agent returned an invalid result:\noutput must be a string");
  });

  it("rejects a missing trace", () => {
    const inspected = inspectAgentResult({ output: "ok" });

    assert.equal(inspected.ok, false);
    assert.equal(inspected.error, "Agent returned an invalid trace:\ntrace must be an array");
  });

  it("rejects a null trace", () => {
    const inspected = inspectAgentResult({ output: "ok", trace: null });

    assert.equal(inspected.ok, false);
    assert.equal(inspected.error, "Agent returned an invalid trace:\ntrace must be an array");
  });

  it("rejects a non-array trace", () => {
    const inspected = inspectAgentResult({ output: "ok", trace: { type: "agent" } });

    assert.equal(inspected.ok, false);
    assert.equal(inspected.error, "Agent returned an invalid trace:\ntrace must be an array");
  });
});

describe("evaluate malformed agent responses", () => {
  it("does not throw on a null result and reports an execution error", () => {
    let evaluation;

    assertDoesNotThrow(() => {
      evaluation = evaluate(null, { agents: ["orchestrator"] });
    });

    assert.equal(evaluation.passed, false);
    assert.equal(evaluation.executionError, "Agent returned an invalid result:\nresult must be an object");
    assert.equal(
      evaluation.failures.some((failure) => failure.includes("was not called")),
      false
    );
  });

  it("does not treat a missing trace as an assertion failure", () => {
    const evaluation = evaluate({ output: "ok" }, { agents: ["orchestrator"] });

    assert.equal(evaluation.passed, false);
    assert.equal(evaluation.executionError, "Agent returned an invalid trace:\ntrace must be an array");
    assert.deepEqual(evaluation.failures, [evaluation.executionError]);
  });

  it("reports a trace item missing type", () => {
    const evaluation = evaluate(
      {
        output: "ok",
        trace: [{ name: "orchestrator" }],
      },
      { agents: ["orchestrator"] }
    );

    assert.equal(evaluation.passed, false);
    assert.equal(evaluation.executionError, null);
    assert.equal(
      evaluation.failures.includes("Result trace step at index 0 is malformed: missing type"),
      true
    );
  });

  it("reports a trace item missing name", () => {
    const evaluation = evaluate(
      {
        output: "ok",
        trace: [{ type: "agent" }],
      },
      {}
    );

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, [
      "Result trace step at index 0 is malformed: missing name",
    ]);
  });

  it("reports an unknown trace event type instead of ignoring it", () => {
    const evaluation = evaluate(
      {
        output: "ok",
        trace: [
          { type: "agent", name: "orchestrator" },
          { type: "memory", name: "scratchpad" },
        ],
      },
      { agents: ["orchestrator"] }
    );

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, [
      'Result trace step at index 1 has unknown type "memory"',
    ]);
  });

  it("reports a tool event with non-object arguments", () => {
    const evaluation = evaluate(
      {
        output: "ok",
        trace: [
          {
            type: "tool",
            name: "diagnostic_tool",
            arguments: ["internet"],
          },
        ],
      },
      { tools: ["diagnostic_tool"] }
    );

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, [
      "Result trace step at index 0 is malformed: tool arguments must be an object",
    ]);
  });

  it("still accepts a valid result", () => {
    const evaluation = evaluate(validResult, { agents: ["orchestrator"] });

    assert.equal(evaluation.passed, true);
    assert.equal(evaluation.executionError, null);
    assert.deepEqual(evaluation.failures, []);
  });
});

describe("inspectTraceEvents", () => {
  it("collects every malformed event", () => {
    const errors = inspectTraceEvents([
      null,
      { type: "agent" },
      { type: "note", name: "aside" },
    ]);

    assert.deepEqual(errors, [
      "Result trace step at index 0 is malformed: expected an object",
      "Result trace step at index 1 is malformed: missing name",
      'Result trace step at index 2 has unknown type "note"',
    ]);
  });
});

describe("local adapter protocol errors", () => {
  it("throws a protocol error for a null result", async () => {
    await assert.rejects(
      () => localAdapter.run(async () => null, { message: "hi" }),
      { message: "Agent returned an invalid result:\nresult must be an object" }
    );
  });

  it("throws a protocol error when trace is not an array", async () => {
    await assert.rejects(
      () => localAdapter.run(async () => ({ output: "ok", trace: "orchestrator" }), { message: "hi" }),
      { message: "Agent returned an invalid trace:\ntrace must be an array" }
    );
  });
});

describe("HTTP adapter protocol errors", () => {
  it("throws a protocol error when the response body has no trace", async () => {
    const originalFetch = global.fetch;

    global.fetch = async () => ({
      ok: true,
      text: async () => JSON.stringify({ output: "I'll troubleshoot your connection." }),
    });

    try {
      await assert.rejects(
        () => httpAdapter.run("http://localhost:3001/agent", { message: "internet routing" }),
        { message: "Agent returned an invalid trace:\ntrace must be an array" }
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("throws a protocol error when the response body is not JSON", async () => {
    const originalFetch = global.fetch;

    global.fetch = async () => ({
      ok: true,
      text: async () => "not-json",
    });

    try {
      await assert.rejects(
        () => httpAdapter.run("http://localhost:3001/agent", { message: "internet routing" }),
        { message: "HTTP adapter received invalid JSON" }
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
