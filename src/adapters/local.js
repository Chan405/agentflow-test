const { inspectAgentResult } = require("../result");

function normalizeResult(result) {
  const inspected = inspectAgentResult(result);

  if (!inspected.ok) {
    throw new Error(inspected.error);
  }

  return inspected.result;
}

async function run(agentFn, input) {
  if (typeof agentFn !== "function") {
    throw new Error("Local adapter requires an executable agent function");
  }

  const result = await agentFn(input);
  return normalizeResult(result);
}

module.exports = { run };
