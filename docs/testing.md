# Testing

```sh
node --check bin/clauding.js
npm test
npm pack --dry-run
npm pack
npm install --global ./clauding-0.2.0.tgz
clauding --help
clauding --init
clauding -- --version
```

Confirm that the npm tarball contains the launcher, manifest, README, and documentation. For an integration check, open a folder with spaces in its name, confirm the selected model with `/status`, then send a short prompt to the configured server. With an MCP config present, inspect its tools using `/mcp`.

The test suite checks legacy and wrapped configs, selection, per-entry environment values, literal argument forwarding, and cancellation. CLI tests use an isolated home and a fake Claude Code process, so they verify the launch contract independently of an inference server.
