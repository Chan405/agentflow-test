const { inspectAgentResult } = require("../result");

function normalizeResult(parsed) {
  const inspected = inspectAgentResult(parsed);

  if (!inspected.ok) {
    throw new Error(inspected.error);
  }

  return inspected.result;
}

async function run(endpoint, input) {
  if (typeof endpoint !== "string" || endpoint.length === 0) {
    throw new Error("HTTP adapter requires an endpoint URL");
  }

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Connection: "close",
      },
      body: JSON.stringify(input),
    });
  } catch (error) {
    throw new Error(`HTTP adapter network failure: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(
      `HTTP adapter received HTTP ${response.status}${
        response.statusText ? ` ${response.statusText}` : ""
      }`
    );
  }

  const body = await response.text();
  let parsed;

  try {
    parsed = JSON.parse(body);
  } catch (error) {
    throw new Error("HTTP adapter received invalid JSON");
  }

  return normalizeResult(parsed);
}

module.exports = { run };
