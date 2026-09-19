const { inspectAgentResult, inspectTraceEvents, isPlainObject } = require("./result");
const { collectExpectErrors } = require("./validate");

function isValidStep(step) {
  return (
    step &&
    typeof step === "object" &&
    typeof step.type === "string" &&
    typeof step.name === "string"
  );
}

function getStepsByType(trace, type) {
  return trace.filter((step) => isValidStep(step) && step.type === type);
}

function formatPath(names) {
  return names.join(" -> ");
}

function isAgentOrToolStep(step) {
  return isValidStep(step) && (step.type === "agent" || step.type === "tool");
}

function getTracePath(trace) {
  return trace.filter(isAgentOrToolStep).map((step) => ({
    type: step.type,
    name: step.name,
  }));
}

function formatTracePath(steps) {
  return steps.map((step) => `${step.type}:${step.name}`).join("\n→ ");
}

function tracePathsMatch(expected, actual) {
  return (
    expected.length === actual.length &&
    expected.every(
      (step, index) => step && step.type === actual[index].type && step.name === actual[index].name
    )
  );
}

function formatArgValue(value) {
  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    return `"${value}"`;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function valuesExactlyEqual(expected, actual) {
  if (Object.is(expected, actual)) {
    return true;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || expected.length !== actual.length) {
      return false;
    }

    return expected.every((item, index) => valuesExactlyEqual(item, actual[index]));
  }

  if (isPlainObject(expected)) {
    if (!isPlainObject(actual)) {
      return false;
    }

    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);

    if (expectedKeys.length !== actualKeys.length) {
      return false;
    }

    return expectedKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(actual, key) &&
        valuesExactlyEqual(expected[key], actual[key])
    );
  }

  return false;
}

function formatToolArgLabel(toolName, path, callIndex) {
  if (callIndex === undefined) {
    return `Tool "${toolName}" argument "${path}"`;
  }

  return `Tool "${toolName}" call ${callIndex} argument "${path}"`;
}

function pushArgFailure(failures, toolName, path, expected, actual, callIndex) {
  failures.push(
    `${formatToolArgLabel(toolName, path, callIndex)}:\nexpected ${formatArgValue(expected)}, received ${formatArgValue(actual)}`
  );
}

function compareExpectedValue(expected, actual, toolName, path, failures, callIndex) {
  if (Array.isArray(expected)) {
    if (!valuesExactlyEqual(expected, actual)) {
      pushArgFailure(failures, toolName, path, expected, actual, callIndex);
    }
    return;
  }

  if (isPlainObject(expected)) {
    if (!isPlainObject(actual)) {
      pushArgFailure(failures, toolName, path, expected, actual, callIndex);
      return;
    }

    for (const key of Object.keys(expected)) {
      const nextPath = path ? `${path}.${key}` : key;

      if (!Object.prototype.hasOwnProperty.call(actual, key)) {
        pushArgFailure(failures, toolName, nextPath, expected[key], undefined, callIndex);
        continue;
      }

      compareExpectedValue(expected[key], actual[key], toolName, nextPath, failures, callIndex);
    }
    return;
  }

  if (expected !== actual) {
    pushArgFailure(failures, toolName, path, expected, actual, callIndex);
  }
}

function isIndexedToolExpectation(expectedArgs) {
  return (
    isPlainObject(expectedArgs) &&
    Object.prototype.hasOwnProperty.call(expectedArgs, "call") &&
    isPlainObject(expectedArgs.arguments)
  );
}

function evaluateToolArguments(safeTrace, toolArguments, failures) {
  for (const [toolName, expectedArgs] of Object.entries(toolArguments)) {
    const toolSteps = getStepsByType(safeTrace, "tool").filter((step) => step.name === toolName);

    if (isIndexedToolExpectation(expectedArgs)) {
      const callIndex = expectedArgs.call;

      if (!Number.isInteger(callIndex) || callIndex < 0) {
        failures.push(`Expectation toolArguments for "${toolName}" call must be a non-negative integer`);
        continue;
      }

      if (callIndex >= toolSteps.length) {
        failures.push(
          `Tool "${toolName}" call ${callIndex} was not made (${toolSteps.length} call(s) found)`
        );
        continue;
      }

      if (
        toolSteps[callIndex].arguments !== undefined &&
        !isPlainObject(toolSteps[callIndex].arguments)
      ) {
        continue;
      }

      const actualArgs = isPlainObject(toolSteps[callIndex].arguments)
        ? toolSteps[callIndex].arguments
        : {};
      compareExpectedValue(expectedArgs.arguments, actualArgs, toolName, "", failures, callIndex);
      continue;
    }

    if (!isPlainObject(expectedArgs)) {
      failures.push(`Expectation toolArguments for "${toolName}" must be an object`);
      continue;
    }

    if (toolSteps.length === 0) {
      failures.push(`Expected tool "${toolName}" was not called`);
      continue;
    }

    if (toolSteps.length > 1) {
      failures.push(
        `Tool "${toolName}" was called ${toolSteps.length} time(s); specify expect.toolArguments.${toolName}.call to choose an invocation`
      );
      continue;
    }

    if (toolSteps[0].arguments !== undefined && !isPlainObject(toolSteps[0].arguments)) {
      continue;
    }

    const actualArgs = isPlainObject(toolSteps[0].arguments) ? toolSteps[0].arguments : {};
    compareExpectedValue(expectedArgs, actualArgs, toolName, "", failures);
  }
}

function includesInsensitive(haystack, needle) {
  return String(haystack).toLowerCase().includes(String(needle).toLowerCase());
}

function evaluateOutput(result, outputExpect, failures) {
  if (!outputExpect || typeof outputExpect !== "object" || Array.isArray(outputExpect)) {
    failures.push("Expectation output must be an object");
    return;
  }

  const hasEquals = Object.prototype.hasOwnProperty.call(outputExpect, "equals");
  const hasContains = outputExpect.contains !== undefined;
  const hasNotContains = outputExpect.notContains !== undefined;

  if (!hasEquals && !hasContains && !hasNotContains) {
    return;
  }

  if (!result || typeof result.output !== "string") {
    failures.push("Result output must be a string");
    return;
  }

  const actual = result.output;

  if (hasEquals && actual !== outputExpect.equals) {
    failures.push(`Expected output:\n"${outputExpect.equals}"\n\nActual output:\n"${actual}"`);
  }

  if (hasContains) {
    if (!Array.isArray(outputExpect.contains)) {
      failures.push("Expectation output.contains must be an array");
    } else {
      for (const phrase of outputExpect.contains) {
        if (phrase === "") {
          continue;
        }

        if (!includesInsensitive(actual, phrase)) {
          failures.push(`Expected output to contain "${phrase}"`);
        }
      }
    }
  }

  if (hasNotContains) {
    if (!Array.isArray(outputExpect.notContains)) {
      failures.push("Expectation output.notContains must be an array");
    } else {
      for (const phrase of outputExpect.notContains) {
        if (phrase === "") {
          continue;
        }

        if (includesInsensitive(actual, phrase)) {
          failures.push(`Output contained forbidden text "${phrase}"`);
        }
      }
    }
  }
}

function evaluate(result, expectation) {
  const inspected = inspectAgentResult(result);

  if (!inspected.ok) {
    return {
      passed: false,
      failures: [inspected.error],
      executionError: inspected.error,
    };
  }

  const failures = inspectTraceEvents(inspected.result.trace);
  const expect = isPlainObject(expectation) ? expectation : {};
  const safeTrace = inspected.result.trace;
  result = inspected.result;

  failures.push(...collectExpectErrors(expect, { requireAssertion: false }));

  if (Array.isArray(expect.agents)) {
    const agentNames = getStepsByType(safeTrace, "agent").map((step) => step.name);

    for (const name of expect.agents) {
      if (!agentNames.includes(name)) {
        failures.push(`Expected agent "${name}" was not called`);
      }
    }
  }

  if (Array.isArray(expect.tools)) {
    const toolNames = getStepsByType(safeTrace, "tool").map((step) => step.name);

    for (const name of expect.tools) {
      if (!toolNames.includes(name)) {
        failures.push(`Expected tool "${name}" was not called`);
      }
    }
  }

  if (Array.isArray(expect.forbiddenAgents)) {
    const agentNames = getStepsByType(safeTrace, "agent").map((step) => step.name);

    for (const name of expect.forbiddenAgents) {
      if (agentNames.includes(name)) {
        failures.push(`Forbidden agent "${name}" was called`);
      }
    }
  }

  if (Array.isArray(expect.forbiddenTools)) {
    const toolNames = getStepsByType(safeTrace, "tool").map((step) => step.name);

    for (const name of expect.forbiddenTools) {
      if (toolNames.includes(name)) {
        failures.push(`Forbidden tool "${name}" was called`);
      }
    }
  }

  if (Array.isArray(expect.agentPath)) {
    const actualPath = getStepsByType(safeTrace, "agent").map((step) => step.name);
    const pathsMatch =
      actualPath.length === expect.agentPath.length &&
      actualPath.every((name, index) => name === expect.agentPath[index]);

    if (!pathsMatch) {
      failures.push(
        `Expected agent path:\n${formatPath(expect.agentPath)}\n\nActual agent path:\n${formatPath(actualPath)}`
      );
    }
  }

  if (Array.isArray(expect.tracePath)) {
    const actualPath = getTracePath(safeTrace);

    if (!tracePathsMatch(expect.tracePath, actualPath)) {
      failures.push(
        `Expected trace:\n${formatTracePath(expect.tracePath)}\n\nActual trace:\n${formatTracePath(actualPath)}`
      );
    }
  }

  if (isPlainObject(expect.output)) {
    evaluateOutput(result, expect.output, failures);
  }

  if (isPlainObject(expect.toolArguments)) {
    evaluateToolArguments(safeTrace, expect.toolArguments, failures);
  }

  return {
    passed: failures.length === 0,
    failures,
    executionError: null,
  };
}

module.exports = { evaluate };
