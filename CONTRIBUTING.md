# Contributing

This is an experimental alpha. Small, focused changes are welcome.

## Install

Node.js 18 or later. There are no npm dependencies.

```bash
git clone https://github.com/Chan405/agentflow-test.git
cd agentflow-test
```

Run commands from the repo root. See [docs/QUICKSTART.md](docs/QUICKSTART.md) if you want the bundled fake-agent demo.

## Tests

`agentflow.config.json` in this repo targets HTTP. Start the mock agent first:

```bash
node examples/http/mock-server.js
```

Then:

```bash
npm test
```

That runs the library unit tests, then `src/runner.js` against `tests/workflows.json`.

To run only the workflow runner (after config is set):

```bash
node src/runner.js
```

For in-process runs, set `target.type` to `"local"` and `target.module` to `./examples/local/fake-agent.js`.

## Report bugs

Open an issue: https://github.com/Chan405/agentflow-test/issues

Include Node version, the command you ran, `agentflow.config.json` (redact secrets), and the full CLI output.

## Propose changes

1. Open an issue if the change is more than a small fix.
2. Fork, branch, and open a pull request against this repo.
3. Keep the PR focused: one problem, one change. Do not mix refactors with behavior changes.
4. If you change behavior, add or update tests in `tests/` so `npm test` covers it. A PR that changes evaluator, adapter, config, or reporting behavior without tests will not be merged.

No CLA. By contributing you agree the work is licensed under the MIT License in `LICENSE`.
