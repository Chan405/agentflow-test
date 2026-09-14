const fs = require("fs");
const path = require("path");

const { fakeAgent } = require("../examples/fake-agent");
const localAdapter = require("./adapters/local");
const httpAdapter = require("./adapters/http");
const { evaluate } = require("./evaluator");

const WORKFLOWS_PATH = path.join(__dirname, "..", "tests", "workflows.json");
const CONFIG_PATH = path.join(__dirname, "..", "agentflow.config.json");
const DEFAULT_CONFIG = { type: "local" };

function printFailure(failure) {
  const lines = failure.split("\n");

  console.log(`  → ${lines[0]}`);

  for (let i = 1; i < lines.length; i++) {
    console.log(`    ${lines[i]}`);
  }
}

function validateTestCase(test, index) {
  const label = `Test case at index ${index}`;

  if (!test || typeof test !== "object") {
    return `${label} must be an object`;
  }

  if (typeof test.name !== "string" || test.name.length === 0) {
    return `${label} is missing a valid "name"`;
  }

  if (!test.input || typeof test.input.message !== "string") {
    return `Test "${test.name}" is missing input.message`;
  }

  if (!test.expect || typeof test.expect !== "object") {
    return `Test "${test.name}" is missing expect`;
  }

  return null;
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

  if (!config || typeof config !== "object") {
    throw new Error("agentflow.config.json must contain an object");
  }

  const type = config.type || "local";

  if (type !== "local" && type !== "http") {
    throw new Error(`Unsupported adapter type "${type}"`);
  }

  if (type === "http" && (typeof config.endpoint !== "string" || config.endpoint.length === 0)) {
    throw new Error('HTTP adapter requires an "endpoint"');
  }

  return {
    type,
    endpoint: config.endpoint,
  };
}

function createExecutor(config) {
  if (config.type === "http") {
    return (input) => httpAdapter.run(config.endpoint, input);
  }

  return (input) =>
    localAdapter.run((agentInput) => fakeAgent(agentInput.message), input);
}

async function run() {
  const config = loadConfig();
  const execute = createExecutor(config);
  const tests = JSON.parse(fs.readFileSync(WORKFLOWS_PATH, "utf8"));

  if (!Array.isArray(tests)) {
    console.error("tests/workflows.json must contain an array of test cases");
    process.exit(1);
  }

  console.log("AgentFlow Test");
  console.log("");

  let passed = 0;
  let failed = 0;

  for (let index = 0; index < tests.length; index++) {
    const test = tests[index];
    const validationError = validateTestCase(test, index);

    if (validationError) {
      console.log(`✗ ${test && test.name ? test.name : `test ${index}`}`);
      printFailure(validationError);
      failed++;
      continue;
    }

    try {
      const result = await execute(test.input);
      const evaluation = evaluate(result, test.expect);

      if (evaluation.passed) {
        console.log(`✓ ${test.name}`);
        passed++;
      } else {
        console.log(`✗ ${test.name}`);

        for (const failure of evaluation.failures) {
          printFailure(failure);
        }

        failed++;
      }
    } catch (error) {
      console.log(`✗ ${test.name}`);
      printFailure(`Agent execution failed: ${error.message}`);
      failed++;
    }
  }

  console.log("");
  console.log("-------------------");
  console.log(`${passed} passed`);
  console.log(`${failed} failed`);
  console.log("-------------------");

  process.exitCode = failed > 0 ? 1 : 0;
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
