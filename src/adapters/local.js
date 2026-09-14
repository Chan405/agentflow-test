function normalizeResult(result) {
  if (!result || typeof result !== "object") {
    throw new Error("Local adapter result must be an object");
  }

  if (!Object.prototype.hasOwnProperty.call(result, "trace") || result.trace == null) {
    throw new Error("Local adapter result is missing trace");
  }

  if (!Array.isArray(result.trace)) {
    throw new Error("Local adapter result trace is not an array");
  }

  return {
    output: typeof result.output === "string" ? result.output : String(result.output ?? ""),
    trace: result.trace,
  };
}

async function run(agentFn, input) {
  if (typeof agentFn !== "function") {
    throw new Error("Local adapter requires an executable agent function");
  }

  const result = await agentFn(input);
  return normalizeResult(result);
}

module.exports = { run };
