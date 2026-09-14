const fs = require("fs");
const path = require("path");

const { fakeAgent } = require("../examples/fake-agent");
const { evaluate } = require("./evaluator");

const WORKFLOWS_PATH = path.join(__dirname, "..", "tests", "workflows.json");

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

async function run() {
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
      const result = await fakeAgent(test.input.message);
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

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
