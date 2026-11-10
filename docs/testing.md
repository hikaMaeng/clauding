# Testing

```sh
node --check bin/clauding.js
npm pack --dry-run
npm pack
npm install --global ./clauding-0.1.0.tgz
clauding --help
clauding --init
clauding -- --version
```

Confirm that the npm tarball contains the launcher, manifest, README, and documentation. For an integration check, open a folder with spaces in its name, confirm the selected model with `/status`, then send a short prompt to the configured server. With an MCP config present, inspect its tools using `/mcp`.
