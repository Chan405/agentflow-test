const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadConfig } = require("../src/config");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "agentflow-config-"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value));
}

function writeProject(config) {
  const cwd = tempDir();
  writeJson(path.join(cwd, "workflows.json"), []);
  writeJson(path.join(cwd, "agentflow.config.json"), {
    tests: "./workflows.json",
    ...config,
  });
  return cwd;
}

describe("loadConfig missing and malformed files", () => {
  it("errors when agentflow.config.json is missing", () => {
    assert.throws(
      () => loadConfig(tempDir()),
      /Missing agentflow.config.json\. Create one in the project root with a "target" and a "tests" path\./
    );
  });

  it("errors when the file is not JSON", () => {
    const cwd = tempDir();
    fs.writeFileSync(path.join(cwd, "agentflow.config.json"), "not-json");

    assert.throws(() => loadConfig(cwd), /agentflow.config.json contains invalid JSON/);
  });

  it("errors when the file is not an object", () => {
    const cwd = tempDir();
    writeJson(path.join(cwd, "agentflow.config.json"), []);

    assert.throws(() => loadConfig(cwd), /agentflow.config.json must contain an object/);
  });
});

describe("loadConfig required fields", () => {
  it("errors when target is missing", () => {
    const cwd = tempDir();
    writeJson(path.join(cwd, "workflows.json"), []);
    writeJson(path.join(cwd, "agentflow.config.json"), { tests: "./workflows.json" });

    assert.throws(() => loadConfig(cwd), /agentflow.config.json requires a "target" object/);
  });

  it("errors when tests is missing", () => {
    const cwd = tempDir();
    writeJson(path.join(cwd, "agentflow.config.json"), {
      target: { type: "http", endpoint: "http://localhost:3001/agent" },
    });

    assert.throws(() => loadConfig(cwd), /agentflow.config.json requires a "tests" path/);
  });

  it("errors when the tests file does not exist", () => {
    const cwd = tempDir();
    writeJson(path.join(cwd, "agentflow.config.json"), {
      target: { type: "http", endpoint: "http://localhost:3001/agent" },
      tests: "./missing.json",
    });

    assert.throws(() => loadConfig(cwd), /Tests file not found: \.\/missing\.json/);
  });
});

describe("loadConfig target types", () => {
  it("errors when target.type is missing", () => {
    const cwd = writeProject({ target: { endpoint: "http://localhost:3001/agent" } });

    assert.throws(() => loadConfig(cwd), /target.type is required/);
  });

  it("errors for an unsupported target type", () => {
    const cwd = writeProject({ target: { type: "grpc" } });

    assert.throws(
      () => loadConfig(cwd),
      /Unsupported target type "grpc"\. Use "local" or "http"\./
    );
  });

  it("errors when an HTTP target has no endpoint", () => {
    const cwd = writeProject({ target: { type: "http" } });

    assert.throws(() => loadConfig(cwd), /HTTP target requires an "endpoint"/);
  });

  it("errors when a local target has no module", () => {
    const cwd = writeProject({ target: { type: "local" } });

    assert.throws(() => loadConfig(cwd), /Local target requires a "module"/);
  });

  it("loads an HTTP target and resolves the tests path", () => {
    const cwd = writeProject({
      target: { type: "http", endpoint: "http://localhost:3001/agent" },
    });
    const config = loadConfig(cwd);

    assert.equal(config.type, "http");
    assert.equal(config.endpoint, "http://localhost:3001/agent");
    assert.equal(config.module, undefined);
    assert.equal(config.tests, "./workflows.json");
    assert.equal(config.testsPath, path.join(cwd, "workflows.json"));
  });

  it("loads a local target and resolves the module path", () => {
    const cwd = writeProject({
      target: { type: "local", module: "./agent.js" },
    });
    const config = loadConfig(cwd);

    assert.equal(config.type, "local");
    assert.equal(config.module, path.join(cwd, "agent.js"));
    assert.equal(config.testsPath, path.join(cwd, "workflows.json"));
  });
});
