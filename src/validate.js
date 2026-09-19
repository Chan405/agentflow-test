function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const EXPECT_ARRAY_FIELDS = [
  "agents",
  "tools",
  "forbiddenAgents",
  "forbiddenTools",
  "agentPath",
  "tracePath",
];

const ALLOWED_EXPECT_KEYS = new Set([...EXPECT_ARRAY_FIELDS, "toolArguments", "output"]);

function formatValidation(label, errors) {
  return {
    valid: errors.length === 0,
    label,
    errors,
    message: errors.length === 0 ? null : `${label}:\n${errors.join("\n")}`,
  };
}

function collectExpectErrors(expect, options = {}) {
  const requireAssertion = options.requireAssertion === true;
  const errors = [];

  if (!isPlainObject(expect)) {
    return ["expect must be an object"];
  }

  const keys = Object.keys(expect);

  if (requireAssertion && keys.length === 0) {
    errors.push("expect must include at least one assertion");
  }

  for (const key of keys) {
    if (!ALLOWED_EXPECT_KEYS.has(key)) {
      errors.push(`expect.${key} is not a supported assertion`);
    }
  }

  for (const field of EXPECT_ARRAY_FIELDS) {
    if (expect[field] !== undefined && !Array.isArray(expect[field])) {
      errors.push(`expect.${field} must be an array`);
    }
  }

  if (expect.toolArguments !== undefined && !isPlainObject(expect.toolArguments)) {
    errors.push("expect.toolArguments must be an object");
  } else if (isPlainObject(expect.toolArguments)) {
    for (const [toolName, expectedArgs] of Object.entries(expect.toolArguments)) {
      if (!isPlainObject(expectedArgs)) {
        errors.push(`expect.toolArguments.${toolName} must be an object`);
      }
    }
  }

  if (expect.output !== undefined) {
    if (!isPlainObject(expect.output)) {
      errors.push("expect.output must be an object");
    } else {
      for (const field of ["contains", "notContains"]) {
        if (expect.output[field] === undefined) {
          continue;
        }

        if (!Array.isArray(expect.output[field])) {
          errors.push(`expect.output.${field} must be an array`);
          continue;
        }

        if (expect.output[field].some((phrase) => phrase === "")) {
          errors.push(`expect.output.${field} must not include an empty string`);
        }
      }
    }
  }

  return errors;
}

function validateTestCase(test, index) {
  if (!isPlainObject(test)) {
    return formatValidation(`Invalid test at index ${index}`, ["test must be an object"]);
  }

  const errors = [];

  if (typeof test.name !== "string" || test.name.length === 0) {
    errors.push("name must be a string");
  }

  if (test.input === undefined) {
    errors.push("input must be an object");
  } else if (!isPlainObject(test.input)) {
    errors.push("input must be an object");
  } else if (typeof test.input.message !== "string") {
    errors.push("input.message must be a string");
  }

  if (test.expect === undefined) {
    errors.push("expect must be an object");
  } else if (!isPlainObject(test.expect)) {
    errors.push("expect must be an object");
  } else {
    errors.push(...collectExpectErrors(test.expect, { requireAssertion: true }));
  }

  const label =
    typeof test.name === "string" && test.name.length > 0
      ? `Invalid test "${test.name}"`
      : `Invalid test at index ${index}`;

  return formatValidation(label, errors);
}

module.exports = { collectExpectErrors, validateTestCase };
