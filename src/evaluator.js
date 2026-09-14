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

function validateTrace(trace, failures) {
  if (!Array.isArray(trace)) {
    failures.push("Result trace must be an array");
    return;
  }

  trace.forEach((step, index) => {
    if (!isValidStep(step)) {
      failures.push(`Result trace step at index ${index} is malformed`);
    }
  });
}

function evaluate(result, expectation) {
  const failures = [];
  const trace = result && Array.isArray(result.trace) ? result.trace : null;
  const expect = expectation && typeof expectation === "object" ? expectation : {};

  if (trace === null) {
    failures.push("Result trace must be an array");
  } else {
    validateTrace(trace, failures);
  }

  const safeTrace = trace || [];

  if (expect.agents) {
    const agentNames = getStepsByType(safeTrace, "agent").map((step) => step.name);

    for (const name of expect.agents) {
      if (!agentNames.includes(name)) {
        failures.push(`Expected agent "${name}" was not called`);
      }
    }
  }

  if (expect.tools) {
    const toolNames = getStepsByType(safeTrace, "tool").map((step) => step.name);

    for (const name of expect.tools) {
      if (!toolNames.includes(name)) {
        failures.push(`Expected tool "${name}" was not called`);
      }
    }
  }

  if (expect.forbiddenAgents) {
    const agentNames = getStepsByType(safeTrace, "agent").map((step) => step.name);

    for (const name of expect.forbiddenAgents) {
      if (agentNames.includes(name)) {
        failures.push(`Forbidden agent "${name}" was called`);
      }
    }
  }

  if (expect.forbiddenTools) {
    const toolNames = getStepsByType(safeTrace, "tool").map((step) => step.name);

    for (const name of expect.forbiddenTools) {
      if (toolNames.includes(name)) {
        failures.push(`Forbidden tool "${name}" was called`);
      }
    }
  }

  if (expect.agentPath) {
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

  if (expect.toolArguments) {
    for (const [toolName, expectedArgs] of Object.entries(expect.toolArguments)) {
      if (!expectedArgs || typeof expectedArgs !== "object") {
        failures.push(`Expectation toolArguments for "${toolName}" must be an object`);
        continue;
      }

      const toolStep = getStepsByType(safeTrace, "tool").find((step) => step.name === toolName);

      if (!toolStep) {
        failures.push(`Expected tool "${toolName}" was not called`);
        continue;
      }

      const actualArgs =
        toolStep.arguments && typeof toolStep.arguments === "object" ? toolStep.arguments : {};

      for (const [key, expectedValue] of Object.entries(expectedArgs)) {
        const actualValue = actualArgs[key];

        if (actualValue !== expectedValue) {
          failures.push(
            `Tool "${toolName}" argument "${key}":\nexpected "${expectedValue}", received "${actualValue}"`
          );
        }
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

module.exports = { evaluate };
