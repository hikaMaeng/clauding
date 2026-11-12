# Internals

On Windows, the launcher searches PATH for `claude.exe`, then resolves the official global npm package behind a `claude.cmd` shim. It invokes the binary or Node entry point directly so shell metacharacters in paths and arguments stay literal. On macOS and Linux it launches `claude` through PATH.

Endpoint, authentication, and context overrides are confined to the child environment. The launcher drops inherited Anthropic API keys, custom auth headers, and cloud-provider selectors when building that environment. The optional MCP file is handed to Claude Code for parsing and startup.

Endpoint conflicts are checked before child creation. Shutdown handlers stay installed until the child exits and are removed along with the escalation timer on either exit or a spawn error.
