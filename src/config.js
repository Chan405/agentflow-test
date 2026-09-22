const fs = require("fs");
const path = require("path");

const CONFIG_NAME = "agentflow.config.json";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolveFromConfig(configDir, value) {
  return path.isAbsolute(value) ? value : path.join(configDir, value);
}

function loadConfig(cwd = process.cwd()) {
  const configPath = path.join(cwd, CONFIG_NAME);

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Missing ${CONFIG_NAME}. Create one in the project root with a "target" and a "tests" path.`
    );
  }

  let config;

  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`${CONFIG_NAME} contains invalid JSON`);
  }

  return normalizeConfig(config, configPath);
}

function normalizeConfig(config, configPath) {
  if (!isPlainObject(config)) {
    throw new Error(`${CONFIG_NAME} must contain an object`);
  }

  if (!isPlainObject(config.target)) {
    throw new Error(`${CONFIG_NAME} requires a "target" object`);
  }

  if (typeof config.tests !== "string" || config.tests.length === 0) {
    throw new Error(`${CONFIG_NAME} requires a "tests" path`);
  }

  const type = config.target.type;

  if (typeof type !== "string" || type.length === 0) {
    throw new Error("target.type is required");
  }

  if (type !== "local" && type !== "http") {
    throw new Error(`Unsupported target type "${type}". Use "local" or "http".`);
  }

  if (type === "http" && (typeof config.target.endpoint !== "string" || config.target.endpoint.length === 0)) {
    throw new Error('HTTP target requires an "endpoint"');
  }

  if (type === "local" && (typeof config.target.module !== "string" || config.target.module.length === 0)) {
    throw new Error('Local target requires a "module"');
  }

  const configDir = path.dirname(configPath);
  const testsPath = resolveFromConfig(configDir, config.tests);

  if (!fs.existsSync(testsPath)) {
    throw new Error(`Tests file not found: ${config.tests}`);
  }

  return {
    type,
    endpoint: config.target.endpoint,
    module: type === "local" ? resolveFromConfig(configDir, config.target.module) : undefined,
    tests: config.tests,
    testsPath,
  };
}

module.exports = { loadConfig };
