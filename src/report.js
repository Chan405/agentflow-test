const TOOL_ARG_FAILURE =
  /^Tool "([^"]+)"(?: call (\d+))? argument "([^"]+)":\nexpected ([\s\S]*), received ([\s\S]*)$/;

function parseToolArgFailure(failure) {
  const match = String(failure).match(TOOL_ARG_FAILURE);

  if (!match) {
    return null;
  }

  return {
    tool: match[1],
    call: match[2] === undefined ? undefined : Number(match[2]),
    path: match[3],
    expected: match[4],
    received: match[5],
  };
}

function formatToolArgFailure(parsed) {
  const lines = [`Tool: ${parsed.tool}`];

  if (parsed.call !== undefined) {
    lines.push(`Call: ${parsed.call}`);
  }

  lines.push("");
  lines.push(parsed.path);
  lines.push(`expected: ${parsed.expected}`);
  lines.push(`received: ${parsed.received}`);
  return lines;
}

function formatAssertionDetails(failures) {
  const lines = [];

  for (const failure of failures) {
    if (lines.length > 0) {
      lines.push("");
    }

    const parsed = parseToolArgFailure(failure);
    if (parsed) {
      lines.push(...formatToolArgFailure(parsed));
    } else {
      lines.push(...String(failure).split("\n"));
    }
  }

  return lines;
}

function formatConfigDetails(validation) {
  const errors = validation && Array.isArray(validation.errors) ? validation.errors : [];

  return ["CONFIG ERROR", ...errors];
}

function formatExecutionDetails(message) {
  return ["EXECUTION ERROR", ...String(message).split("\n")];
}

function indentDetails(lines) {
  return lines.map((line) => (line === "" ? "" : `  ${line}`));
}

function formatSummary({ passed, failed, configErrors, executionErrors }) {
  const tests = passed + failed + configErrors + executionErrors;

  return [
    "-------------------",
    `Tests: ${tests}`,
    `Passed: ${passed}`,
    `Failed: ${failed}`,
    `Config errors: ${configErrors}`,
    `Execution errors: ${executionErrors}`,
    "-------------------",
  ];
}

module.exports = {
  formatAssertionDetails,
  formatConfigDetails,
  formatExecutionDetails,
  formatSummary,
  indentDetails,
  parseToolArgFailure,
};
