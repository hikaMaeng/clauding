# Architecture

The npm `bin` entry invokes Node.js. The launcher reads and validates the user's single config or model list, selects one model and a working directory, and starts Claude Code as a child process with the same terminal. It passes the model and optional MCP config as arguments and the selected API URL and credentials as environment variables.

Claude Code loads its own user and project settings. The model responds through the configured Messages API. Any MCP server is launched or connected by Claude Code using that server's own configuration.
