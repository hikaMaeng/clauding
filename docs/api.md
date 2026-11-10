# CLI and configuration

| Command | Behavior |
| --- | --- |
| `clauding` | Open the current folder. |
| `clauding "<folder>"` | Open the specified folder. |
| `clauding "<folder>" -- --version` | Forward Claude Code arguments for that folder. |
| `clauding --init [base-url model-id]` | Create `~/.clauding/config.json` if absent. |
| `clauding --help` | Show launcher help. |
| `clauding -- --help` | Show Claude Code help. |

An initial argument without a leading hyphen is a folder. Use `./-name` (or `.\-name` on Windows) for a folder whose name starts with a hyphen. The Claude Code child process receives the remaining arguments.

| `config.json` key | Value |
| --- | --- |
| `baseUrl` | Required HTTP(S) API base URL, such as `http://127.0.0.1:1234`. Use the base before `/v1/messages`. |
| `model` | Required model ID served by that API. |
| `contextTokens` | Optional positive integer. Used for Claude Code's context estimate. |
| `authToken` | Optional bearer token. The default `lmstudio` value is suitable for an LM Studio endpoint with authentication disabled. |

If `~/.clauding/mcp.json` exists, it is passed as a Claude Code `--mcp-config` file. Its top-level key is `mcpServers`.
