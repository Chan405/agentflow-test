function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const KNOWN_TRACE_TYPES = new Set(["agent", "tool"]);

function inspectAgentResult(result) {
  if (result == null || typeof result !== "object" || Array.isArray(result)) {
    return {
      ok: false,
      error: "Agent returned an invalid result:\nresult must be an object",
    };
  }

  if (!Object.prototype.hasOwnProperty.call(result, "output") || typeof result.output !== "string") {
    return {
      ok: false,
      error: "Agent returned an invalid result:\noutput must be a string",
    };
  }

  if (!Object.prototype.hasOwnProperty.call(result, "trace") || result.trace == null || !Array.isArray(result.trace)) {
    return {
      ok: false,
      error: "Agent returned an invalid trace:\ntrace must be an array",
    };
  }

  return {
    ok: true,
    error: null,
    result: {
      output: result.output,
      trace: result.trace,
    },
  };
}

function inspectTraceEvent(step, index) {
  if (step == null || typeof step !== "object" || Array.isArray(step)) {
    return `Result trace step at index ${index} is malformed: expected an object`;
  }

  if (typeof step.type !== "string" || step.type.length === 0) {
    return `Result trace step at index ${index} is malformed: missing type`;
  }

  if (typeof step.name !== "string" || step.name.length === 0) {
    return `Result trace step at index ${index} is malformed: missing name`;
  }

  if (!KNOWN_TRACE_TYPES.has(step.type)) {
    return `Result trace step at index ${index} has unknown type "${step.type}"`;
  }

  if (step.type === "tool" && step.arguments !== undefined && !isPlainObject(step.arguments)) {
    return `Result trace step at index ${index} is malformed: tool arguments must be an object`;
  }

  return null;
}

function inspectTraceEvents(trace) {
  return trace.map((step, index) => inspectTraceEvent(step, index)).filter(Boolean);
}

module.exports = {
  inspectAgentResult,
  inspectTraceEvents,
  isPlainObject,
};
