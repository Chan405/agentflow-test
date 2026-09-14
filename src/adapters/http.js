function normalizeResult(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("HTTP adapter received invalid JSON");
  }

  if (!Object.prototype.hasOwnProperty.call(parsed, "trace") || parsed.trace == null) {
    throw new Error("HTTP adapter response is missing trace");
  }

  if (!Array.isArray(parsed.trace)) {
    throw new Error("HTTP adapter response trace is not an array");
  }

  return {
    output: typeof parsed.output === "string" ? parsed.output : String(parsed.output ?? ""),
    trace: parsed.trace,
  };
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
