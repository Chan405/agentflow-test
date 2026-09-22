const fs = require("fs");

const { loadConfig } = require("./config");
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

function loadLocalAgent(modulePath) {
  const agentModule = require(modulePath);
  const agentFn = typeof agentModule === "function" ? agentModule : agentModule && agentModule.run;

  if (typeof agentFn !== "function") {
    throw new Error("Local adapter requires an executable agent function");
  }

  return agentFn;
}

function createExecutor(config) {
  if (config.type === "http") {
    return (input) => httpAdapter.run(config.endpoint, input);
  }

  const agentFn = loadLocalAgent(config.module);
  return (input) => localAdapter.run(agentFn, input);
}

async function run() {
  const config = loadConfig();
  const execute = createExecutor(config);
  let tests;

  try {
    tests = JSON.parse(fs.readFileSync(config.testsPath, "utf8"));
  } catch (error) {
    throw new Error(`${config.tests} contains invalid JSON`);
  }

  if (!Array.isArray(tests)) {
    throw new Error(`${config.tests} must contain an array of test cases`);
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
