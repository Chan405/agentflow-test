const fs = require("fs");
const path = require("path");

const { fakeAgent } = require("../examples/fake-agent");
const localAdapter = require("./adapters/local");
const httpAdapter = require("./adapters/http");
const { evaluate } = require("./evaluator");
const { validateTestCase } = require("./validate");
const {
  formatAssertionDetails,
  formatConfigDetails,
  formatExecutionDetails,
  formatSummary,
  indentDetails,
} = require("./report");

const WORKFLOWS_PATH = path.join(__dirname, "..", "tests", "workflows.json");
const CONFIG_PATH = path.join(__dirname, "..", "agentflow.config.json");
const DEFAULT_CONFIG = { type: "local" };

function testDisplayName(test, index) {
  if (test && typeof test.name === "string" && test.name.length > 0) {
    return test.name;
  }

  return `test ${index}`;
}

function printLines(lines) {
  for (const line of lines) {
    console.log(line);
  }
}

function createPrinter() {
  let printed = false;

  function printPass(name) {
    console.log(`✓ ${name}`);
    printed = true;
  }

  function printIssue(name, detailLines) {
    if (printed) {
      console.log("");
    }

    console.log(`✗ ${name}`);
    console.log("");
    printLines(indentDetails(detailLines));
    printed = true;
  }

  return { printPass, printIssue };
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

  const printer = createPrinter();
  let passed = 0;
  let failed = 0;
  let configErrors = 0;
  let executionErrors = 0;

  for (let index = 0; index < tests.length; index++) {
    const test = tests[index];
    const name = testDisplayName(test, index);
    const validation = validateTestCase(test, index);

    if (!validation.valid) {
      printer.printIssue(name, formatConfigDetails(validation));
      configErrors++;
      continue;
    }

    try {
      const result = await execute(test.input);
      const evaluation = evaluate(result, test.expect);

      if (evaluation.executionError) {
        printer.printIssue(name, formatExecutionDetails(evaluation.executionError));
        executionErrors++;
      } else if (evaluation.passed) {
        printer.printPass(name);
        passed++;
      } else {
        printer.printIssue(name, formatAssertionDetails(evaluation.failures));
        failed++;
      }
    } catch (error) {
      printer.printIssue(name, formatExecutionDetails(error.message));
      executionErrors++;
    }
  }

  console.log("");
  printLines(
    formatSummary({
      passed,
      failed,
      configErrors,
      executionErrors,
    })
  );

  process.exitCode = failed > 0 || configErrors > 0 || executionErrors > 0 ? 1 : 0;
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
