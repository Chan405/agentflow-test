const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { evaluate } = require("../src/evaluator");

const troubleshootingResult = {
  output: "I'll troubleshoot your connection.",
  trace: [
    { type: "agent", name: "orchestrator" },
    { type: "agent", name: "troubleshooting_agent" },
    { type: "tool", name: "diagnostic_tool", arguments: { connection: "internet" } },
  ],
};

const salesResult = {
  output: "Let me show you our available plans.",
  trace: [
    { type: "agent", name: "orchestrator" },
    { type: "agent", name: "sales_agent" },
    { type: "tool", name: "plans_tool" },
  ],
};

describe("output.equals", () => {
  it("passes on exact string equality", () => {
    const evaluation = evaluate(troubleshootingResult, {
      output: { equals: "I'll troubleshoot your connection." },
    });

    assert.equal(evaluation.passed, true);
    assert.deepEqual(evaluation.failures, []);
  });

  it("fails when the output differs", () => {
    const evaluation = evaluate({ output: "Hi", trace: [] }, { output: { equals: "Hello" } });

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, ['Expected output:\n"Hello"\n\nActual output:\n"Hi"']);
  });

  it("is case-sensitive", () => {
    const evaluation = evaluate(troubleshootingResult, {
      output: { equals: "i'll troubleshoot your connection." },
    });

    assert.equal(evaluation.passed, false);
    assert.equal(evaluation.failures.length, 1);
    assert.match(evaluation.failures[0], /Expected output:/);
    assert.match(evaluation.failures[0], /Actual output:/);
  });
});

describe("output.contains", () => {
  it("passes when every phrase appears", () => {
    const evaluation = evaluate(troubleshootingResult, {
      output: { contains: ["troubleshoot", "connection"] },
    });

    assert.equal(evaluation.passed, true);
    assert.deepEqual(evaluation.failures, []);
  });

  it("is case-insensitive", () => {
    const evaluation = evaluate(troubleshootingResult, {
      output: { contains: ["TROUBLESHOOT"] },
    });

    assert.equal(evaluation.passed, true);
    assert.deepEqual(evaluation.failures, []);
  });

  it("fails when a phrase is missing", () => {
    const evaluation = evaluate(salesResult, {
      output: { contains: ["troubleshoot"] },
    });

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, ['Expected output to contain "troubleshoot"']);
  });

  it("reports each missing phrase", () => {
    const evaluation = evaluate(salesResult, {
      output: { contains: ["troubleshoot", "restart"] },
    });

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, [
      'Expected output to contain "troubleshoot"',
      'Expected output to contain "restart"',
    ]);
  });
});

describe("output.notContains", () => {
  it("passes when none of the phrases appear", () => {
    const evaluation = evaluate(troubleshootingResult, {
      output: { notContains: ["upgrade", "pricing"] },
    });

    assert.equal(evaluation.passed, true);
    assert.deepEqual(evaluation.failures, []);
  });

  it("is case-insensitive", () => {
    const evaluation = evaluate(salesResult, {
      output: { notContains: ["UPGRADE"] },
    });

    assert.equal(evaluation.passed, true);
    assert.deepEqual(evaluation.failures, []);
  });

  it("fails when forbidden text appears", () => {
    const evaluation = evaluate(
      { output: "You should upgrade now.", trace: [] },
      { output: { notContains: ["upgrade"] } }
    );

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, ['Output contained forbidden text "upgrade"']);
  });

  it("reports each forbidden phrase that appears", () => {
    const evaluation = evaluate(salesResult, {
      output: { notContains: ["plans", "available"] },
    });

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, [
      'Output contained forbidden text "plans"',
      'Output contained forbidden text "available"',
    ]);
  });
});

describe("output fields are optional", () => {
  it("passes when output is an empty object", () => {
    const evaluation = evaluate(troubleshootingResult, { output: {} });

    assert.equal(evaluation.passed, true);
    assert.deepEqual(evaluation.failures, []);
  });

  it("can use equals, contains, and notContains together", () => {
    const evaluation = evaluate(troubleshootingResult, {
      output: {
        equals: "I'll troubleshoot your connection.",
        contains: ["troubleshoot"],
        notContains: ["upgrade"],
      },
    });

    assert.equal(evaluation.passed, true);
    assert.deepEqual(evaluation.failures, []);
  });

  it("does not require output assertions when expect.output is omitted", () => {
    const evaluation = evaluate({ output: "anything", trace: [] }, { agents: [] });

    assert.equal(evaluation.passed, true);
  });

  it("treats a missing output as an execution error, not an assertion miss", () => {
    const evaluation = evaluate({ trace: [] }, { output: { contains: ["troubleshoot"] } });

    assert.equal(evaluation.passed, false);
    assert.equal(
      evaluation.executionError,
      "Agent returned an invalid result:\noutput must be a string"
    );
    assert.deepEqual(evaluation.failures, [evaluation.executionError]);
  });
});

describe("output assertions preserve existing checks", () => {
  it("still evaluates agents when output assertions are present", () => {
    const evaluation = evaluate(salesResult, {
      agents: ["troubleshooting_agent"],
      output: { contains: ["plans"] },
    });

    assert.equal(evaluation.passed, false);
    assert.equal(evaluation.failures.includes('Expected agent "troubleshooting_agent" was not called'), true);
    assert.equal(evaluation.failures.some((failure) => failure.startsWith("Expected output")), false);
  });

  it("collects output and trace failures together", () => {
    const evaluation = evaluate(salesResult, {
      forbiddenAgents: ["sales_agent"],
      output: { contains: ["troubleshoot"] },
    });

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, [
      'Forbidden agent "sales_agent" was called',
      'Expected output to contain "troubleshoot"',
    ]);
  });
});

const bookingResult = {
  output: "Booked.",
  trace: [
    {
      type: "tool",
      name: "booking_tool",
      arguments: {
        customer: {
          name: "Alice",
          contact: {
            email: "alice@example.com",
            phone: "555-0100",
          },
        },
        date: "2026-09-20",
        partySize: 2,
      },
    },
  ],
};

describe("toolArguments nested comparison", () => {
  it("passes when expected nested properties match and extra actual properties exist", () => {
    const evaluation = evaluate(bookingResult, {
      toolArguments: {
        booking_tool: {
          customer: {
            name: "Alice",
          },
        },
      },
    });

    assert.equal(evaluation.passed, true);
    assert.deepEqual(evaluation.failures, []);
  });

  it("passes when a deeper nested property is selected", () => {
    const evaluation = evaluate(bookingResult, {
      toolArguments: {
        booking_tool: {
          customer: {
            contact: {
              email: "alice@example.com",
            },
          },
          date: "2026-09-20",
        },
      },
    });

    assert.equal(evaluation.passed, true);
    assert.deepEqual(evaluation.failures, []);
  });

  it("still matches a flat argument exactly", () => {
    const evaluation = evaluate(troubleshootingResult, {
      toolArguments: {
        diagnostic_tool: {
          connection: "internet",
        },
      },
    });

    assert.equal(evaluation.passed, true);
    assert.deepEqual(evaluation.failures, []);
  });

  it("fails a nested value with a property path", () => {
    const evaluation = evaluate(bookingResult, {
      toolArguments: {
        booking_tool: {
          customer: {
            name: "Bob",
          },
        },
      },
    });

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, [
      'Tool "booking_tool" argument "customer.name":\nexpected "Bob", received "Alice"',
    ]);
  });

  it("fails a missing nested property with a property path", () => {
    const evaluation = evaluate(bookingResult, {
      toolArguments: {
        booking_tool: {
          customer: {
            contact: {
              slack: "alice",
            },
          },
        },
      },
    });

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, [
      'Tool "booking_tool" argument "customer.contact.slack":\nexpected "alice", received undefined',
    ]);
  });

  it("fails when an expected object is not an object in the actual arguments", () => {
    const evaluation = evaluate(
      {
        output: "",
        trace: [{ type: "tool", name: "booking_tool", arguments: { customer: "Alice" } }],
      },
      {
        toolArguments: {
          booking_tool: {
            customer: {
              name: "Alice",
            },
          },
        },
      }
    );

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, [
      'Tool "booking_tool" argument "customer":\nexpected {"name":"Alice"}, received "Alice"',
    ]);
  });

  it("uses exact array equality and allows extra sibling properties", () => {
    const result = {
      output: "",
      trace: [
        {
          type: "tool",
          name: "booking_tool",
          arguments: {
            tags: ["vip", "return"],
            notes: "window seat",
          },
        },
      ],
    };

    const matching = evaluate(result, {
      toolArguments: {
        booking_tool: {
          tags: ["vip", "return"],
        },
      },
    });

    assert.equal(matching.passed, true);
    assert.deepEqual(matching.failures, []);

    const extraItem = evaluate(result, {
      toolArguments: {
        booking_tool: {
          tags: ["vip"],
        },
      },
    });

    assert.equal(extraItem.passed, false);
    assert.deepEqual(extraItem.failures, [
      'Tool "booking_tool" argument "tags":\nexpected ["vip"], received ["vip","return"]',
    ]);
  });

  it("requires exact object equality for objects inside arrays", () => {
    const result = {
      output: "",
      trace: [
        {
          type: "tool",
          name: "booking_tool",
          arguments: {
            guests: [{ name: "Alice", age: 30 }],
          },
        },
      ],
    };

    const exact = evaluate(result, {
      toolArguments: {
        booking_tool: {
          guests: [{ name: "Alice", age: 30 }],
        },
      },
    });

    assert.equal(exact.passed, true);

    const subsetInArray = evaluate(result, {
      toolArguments: {
        booking_tool: {
          guests: [{ name: "Alice" }],
        },
      },
    });

    assert.equal(subsetInArray.passed, false);
    assert.deepEqual(subsetInArray.failures, [
      'Tool "booking_tool" argument "guests":\nexpected [{"name":"Alice"}], received [{"name":"Alice","age":30}]',
    ]);
  });

  it("collects multiple nested argument failures", () => {
    const evaluation = evaluate(bookingResult, {
      toolArguments: {
        booking_tool: {
          customer: { name: "Bob" },
          date: "2026-01-01",
        },
      },
    });

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, [
      'Tool "booking_tool" argument "customer.name":\nexpected "Bob", received "Alice"',
      'Tool "booking_tool" argument "date":\nexpected "2026-01-01", received "2026-09-20"',
    ]);
  });
});

const multiSearchResult = {
  output: "Checked nearby devices.",
  trace: [
    { type: "agent", name: "orchestrator" },
    { type: "tool", name: "search_tool", arguments: { query: "router" } },
    { type: "tool", name: "search_tool", arguments: { query: "modem" } },
    { type: "tool", name: "search_tool", arguments: { query: "connection" } },
  ],
};

describe("toolArguments multiple invocations", () => {
  it("asserts arguments on the first invocation", () => {
    const evaluation = evaluate(multiSearchResult, {
      toolArguments: {
        search_tool: {
          call: 0,
          arguments: { query: "router" },
        },
      },
    });

    assert.equal(evaluation.passed, true);
    assert.deepEqual(evaluation.failures, []);
  });

  it("asserts arguments on the second invocation", () => {
    const evaluation = evaluate(multiSearchResult, {
      toolArguments: {
        search_tool: {
          call: 1,
          arguments: { query: "modem" },
        },
      },
    });

    assert.equal(evaluation.passed, true);
    assert.deepEqual(evaluation.failures, []);
  });

  it("fails when the requested invocation does not exist", () => {
    const evaluation = evaluate(multiSearchResult, {
      toolArguments: {
        search_tool: {
          call: 3,
          arguments: { query: "wifi" },
        },
      },
    });

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, [
      'Tool "search_tool" call 3 was not made (3 call(s) found)',
    ]);
  });

  it("fails when the second invocation has incorrect arguments", () => {
    const evaluation = evaluate(multiSearchResult, {
      toolArguments: {
        search_tool: {
          call: 1,
          arguments: { query: "connection" },
        },
      },
    });

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, [
      'Tool "search_tool" call 1 argument "query":\nexpected "connection", received "modem"',
    ]);
  });

  it("does not let an unindexed assertion ignore later calls", () => {
    const evaluation = evaluate(multiSearchResult, {
      toolArguments: {
        search_tool: { query: "router" },
      },
    });

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, [
      'Tool "search_tool" was called 3 time(s); specify expect.toolArguments.search_tool.call to choose an invocation',
    ]);
  });
});

const expectedTroubleshootingTracePath = [
  { type: "agent", name: "orchestrator" },
  { type: "agent", name: "troubleshooting_agent" },
  { type: "tool", name: "diagnostic_tool" },
];

describe("tracePath", () => {
  it("passes when agents and tools follow the expected order", () => {
    const evaluation = evaluate(troubleshootingResult, {
      tracePath: expectedTroubleshootingTracePath,
    });

    assert.equal(evaluation.passed, true);
    assert.deepEqual(evaluation.failures, []);
  });

  it("ignores tool arguments when comparing the path", () => {
    const evaluation = evaluate(troubleshootingResult, {
      tracePath: [
        { type: "agent", name: "orchestrator" },
        { type: "agent", name: "troubleshooting_agent" },
        { type: "tool", name: "diagnostic_tool", arguments: { connection: "wifi" } },
      ],
    });

    assert.equal(evaluation.passed, true);
    assert.deepEqual(evaluation.failures, []);
  });

  it("fails when a tool runs before the next agent", () => {
    const evaluation = evaluate(
      {
        output: "",
        trace: [
          { type: "agent", name: "orchestrator" },
          { type: "tool", name: "diagnostic_tool" },
          { type: "agent", name: "troubleshooting_agent" },
        ],
      },
      { tracePath: expectedTroubleshootingTracePath }
    );

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, [
      "Expected trace:\nagent:orchestrator\n→ agent:troubleshooting_agent\n→ tool:diagnostic_tool\n\nActual trace:\nagent:orchestrator\n→ tool:diagnostic_tool\n→ agent:troubleshooting_agent",
    ]);
  });

  it("fails when the path is missing a step", () => {
    const evaluation = evaluate(
      {
        output: "",
        trace: [
          { type: "agent", name: "orchestrator" },
          { type: "agent", name: "troubleshooting_agent" },
        ],
      },
      { tracePath: expectedTroubleshootingTracePath }
    );

    assert.equal(evaluation.passed, false);
    assert.match(evaluation.failures[0], /Expected trace:/);
    assert.match(evaluation.failures[0], /Actual trace:/);
    assert.match(evaluation.failures[0], /agent:troubleshooting_agent$/);
  });

  it("does not change agentPath, which still compares agents only", () => {
    const matchingAgents = evaluate(troubleshootingResult, {
      agentPath: ["orchestrator", "troubleshooting_agent"],
    });

    assert.equal(matchingAgents.passed, true);

    const wrongAgentOrder = evaluate(troubleshootingResult, {
      agentPath: ["troubleshooting_agent", "orchestrator"],
    });

    assert.equal(wrongAgentOrder.passed, false);
    assert.match(wrongAgentOrder.failures[0], /Expected agent path:/);
    assert.equal(
      wrongAgentOrder.failures[0].includes("Expected trace:"),
      false
    );
  });
});

describe("false-pass guards", () => {
  it("fails unknown expect keys instead of ignoring them", () => {
    const evaluation = evaluate(salesResult, {
      forbidenAgents: ["sales_agent"],
    });

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, ["expect.forbidenAgents is not a supported assertion"]);
  });

  it("fails when toolArguments is not an object", () => {
    const evaluation = evaluate(troubleshootingResult, { toolArguments: [] });

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, ["expect.toolArguments must be an object"]);
  });

  it("fails an empty contains string instead of treating it as always present", () => {
    const evaluation = evaluate(troubleshootingResult, {
      output: { contains: [""] },
    });

    assert.equal(evaluation.passed, false);
    assert.deepEqual(evaluation.failures, ["expect.output.contains must not include an empty string"]);
  });
});
