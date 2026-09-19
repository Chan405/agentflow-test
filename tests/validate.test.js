const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { validateTestCase } = require("../src/validate");

function validTest(overrides = {}) {
  return {
    name: "support routing",
    input: { message: "My internet is down" },
    expect: { agents: ["orchestrator"] },
    ...overrides,
  };
}

describe("validateTestCase required fields", () => {
  it("accepts a well-formed test", () => {
    const validation = validateTestCase(validTest(), 0);

    assert.equal(validation.valid, true);
    assert.equal(validation.message, null);
    assert.deepEqual(validation.errors, []);
  });

  it("rejects a missing name", () => {
    const test = validTest();
    delete test.name;

    const validation = validateTestCase(test, 0);

    assert.equal(validation.valid, false);
    assert.deepEqual(validation.errors, ["name must be a string"]);
    assert.equal(validation.message, "Invalid test at index 0:\nname must be a string");
  });

  it("rejects a missing input", () => {
    const test = validTest();
    delete test.input;

    const validation = validateTestCase(test, 0);

    assert.equal(validation.valid, false);
    assert.deepEqual(validation.errors, ["input must be an object"]);
    assert.equal(validation.message, 'Invalid test "support routing":\ninput must be an object');
  });

  it("rejects a missing expect", () => {
    const test = validTest();
    delete test.expect;

    const validation = validateTestCase(test, 0);

    assert.equal(validation.valid, false);
    assert.deepEqual(validation.errors, ["expect must be an object"]);
    assert.equal(validation.message, 'Invalid test "support routing":\nexpect must be an object');
  });
});

describe("validateTestCase array fields", () => {
  const arrayFields = [
    "agents",
    "tools",
    "forbiddenAgents",
    "forbiddenTools",
    "agentPath",
    "tracePath",
  ];

  for (const field of arrayFields) {
    it(`rejects expect.${field} when it is not an array`, () => {
      const validation = validateTestCase(
        validTest({
          expect: { [field]: "troubleshooting_agent" },
        }),
        0
      );

      assert.equal(validation.valid, false);
      assert.deepEqual(validation.errors, [`expect.${field} must be an array`]);
      assert.equal(
        validation.message,
        `Invalid test "support routing":\nexpect.${field} must be an array`
      );
    });
  }

  it("rejects output.contains when it is not an array", () => {
    const validation = validateTestCase(
      validTest({
        expect: { output: { contains: "troubleshoot" } },
      }),
      0
    );

    assert.equal(validation.valid, false);
    assert.deepEqual(validation.errors, ["expect.output.contains must be an array"]);
  });

  it("rejects output.notContains when it is not an array", () => {
    const validation = validateTestCase(
      validTest({
        expect: { output: { notContains: "upgrade" } },
      }),
      0
    );

    assert.equal(validation.valid, false);
    assert.deepEqual(validation.errors, ["expect.output.notContains must be an array"]);
  });

  it("allows optional array fields to be omitted", () => {
    const validation = validateTestCase(
      validTest({
        expect: {
          output: { equals: "I'll troubleshoot your connection." },
        },
      }),
      0
    );

    assert.equal(validation.valid, true);
  });
});

describe("validateTestCase reporting", () => {
  it("collects multiple field errors for one test", () => {
    const validation = validateTestCase(
      {
        name: "support routing",
        input: { message: "My internet is down" },
        expect: {
          agents: "orchestrator",
          agentPath: "orchestrator",
        },
      },
      0
    );

    assert.equal(validation.valid, false);
    assert.deepEqual(validation.errors, [
      "expect.agents must be an array",
      "expect.agentPath must be an array",
    ]);
    assert.equal(
      validation.message,
      'Invalid test "support routing":\nexpect.agents must be an array\nexpect.agentPath must be an array'
    );
  });

  it("rejects unknown expect keys so typos cannot silently pass", () => {
    const validation = validateTestCase(
      validTest({
        expect: { forbidenAgents: ["sales_agent"] },
      }),
      0
    );

    assert.equal(validation.valid, false);
    assert.deepEqual(validation.errors, ["expect.forbidenAgents is not a supported assertion"]);
  });

  it("rejects an empty expect object", () => {
    const validation = validateTestCase(validTest({ expect: {} }), 0);

    assert.equal(validation.valid, false);
    assert.deepEqual(validation.errors, ["expect must include at least one assertion"]);
  });

  it("rejects toolArguments when it is not an object", () => {
    const validation = validateTestCase(
      validTest({
        expect: { toolArguments: [] },
      }),
      0
    );

    assert.equal(validation.valid, false);
    assert.deepEqual(validation.errors, ["expect.toolArguments must be an object"]);
  });

  it("rejects an empty string in output.contains", () => {
    const validation = validateTestCase(
      validTest({
        expect: { output: { contains: [""] } },
      }),
      0
    );

    assert.equal(validation.valid, false);
    assert.deepEqual(validation.errors, ["expect.output.contains must not include an empty string"]);
  });

  it("does not treat a valid test as a config error", () => {
    const validation = validateTestCase(
      validTest({
        expect: {
          agents: ["orchestrator"],
          tools: ["diagnostic_tool"],
          forbiddenAgents: ["sales_agent"],
          forbiddenTools: ["plans_tool"],
          agentPath: ["orchestrator"],
          tracePath: [{ type: "agent", name: "orchestrator" }],
          output: {
            contains: ["troubleshoot"],
            notContains: ["upgrade"],
          },
        },
      }),
      0
    );

    assert.equal(validation.valid, true);
    assert.equal(validation.message, null);
  });
});
