# Testing

```sh
node --check bin/clauding.js
npm test
npm pack --dry-run
npm pack
npm install --global ./clauding-0.4.0.tgz
clauding --help
clauding --init
clauding -- --version
```

Confirm that the npm tarball contains the launcher, manifest, README, and documentation. For an integration check, open a folder with spaces in its name, confirm the selected model with `/status`, then send a short prompt to the configured server. With an MCP config present, inspect its tools using `/mcp`.

The test suite checks legacy and wrapped configs, selection, per-entry environment values, literal argument forwarding, and cancellation. CLI tests use an isolated home and a fake Claude Code process, so they verify the launch contract independently of an inference server.

VS Code tests cover the SDK's streaming launch without a `--print` flag, literal protocol arguments, preserving the original connection, additive IDE MCP configuration, setup/undo, and model selection. On Windows they compile the adapter and verify piped Unicode bytes without a BOM, quoted/empty arguments, stderr/exit-code preservation, and descendant cleanup after the adapter is killed. Live extension UI, login-free startup, and real model inference are separate integration checks; passing the Node suite does not establish those outcomes.

Endpoint tests cover process, user, project, local, custom-directory, explicit, and managed declarations, source filtering, matching trailing slashes, and value-free errors. Signal tests exercise forwarding, child exit status, cleanup escalation, and terminal cancellation. A POSIX-only real-process test sends a signal to the launcher process and verifies child exit; Windows uses lifecycle event tests because native forced process termination is not a catchable POSIX signal.
