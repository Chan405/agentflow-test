const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  formatAssertionDetails,
  formatConfigDetails,
  formatExecutionDetails,
  formatSummary,
  indentDetails,
} = require("../src/report");

describe("formatAssertionDetails", () => {
  it("formats a nested tool argument failure compactly", () => {
    const lines = formatAssertionDetails([
      'Tool "booking_tool" argument "customer.name":\nexpected "Alice", received "Bob"',
    ]);

    assert.deepEqual(lines, [
      "Tool: booking_tool",
      "",
      "customer.name",
      'expected: "Alice"',
      'received: "Bob"',
    ]);
  });

  it("includes a call index when a specific invocation failed", () => {
    const lines = formatAssertionDetails([
      'Tool "search_tool" call 1 argument "query":\nexpected "connection", received "modem"',
    ]);

    assert.deepEqual(lines, [
      "Tool: search_tool",
      "Call: 1",
      "",
      "query",
      'expected: "connection"',
      'received: "modem"',
    ]);
  });

  it("keeps other assertion messages intact", () => {
    const lines = formatAssertionDetails(['Expected output to contain "troubleshoot"']);

    assert.deepEqual(lines, ['Expected output to contain "troubleshoot"']);
  });
});

describe("formatConfigDetails and formatExecutionDetails", () => {
  it("labels config errors without treating them as assertion text", () => {
    assert.deepEqual(
      formatConfigDetails({
        errors: ["expect.agentPath must be an array"],
      }),
      ["CONFIG ERROR", "expect.agentPath must be an array"]
    );
  });

  it("labels execution errors with the protocol message", () => {
    assert.deepEqual(
      formatExecutionDetails("Agent returned an invalid trace:\ntrace must be an array"),
      ["EXECUTION ERROR", "Agent returned an invalid trace:", "trace must be an array"]
    );
  });
});

describe("formatSummary and indentDetails", () => {
  it("prints compact counts", () => {
    assert.deepEqual(
      formatSummary({
        passed: 11,
        failed: 1,
        configErrors: 0,
        executionErrors: 0,
      }),
      [
        "-------------------",
        "Tests: 12",
        "Passed: 11",
        "Failed: 1",
        "Config errors: 0",
        "Execution errors: 0",
        "-------------------",
      ]
    );
  });

  it("indents detail lines and leaves blanks empty", () => {
    assert.deepEqual(indentDetails(["Tool: booking_tool", "", "customer.name"]), [
      "  Tool: booking_tool",
      "",
      "  customer.name",
    ]);
  });
});
