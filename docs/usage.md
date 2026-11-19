# Usage

Run `clauding --init <base-url> <model-id>` once, then use `clauding` in the desired folder. With no arguments, `--init` creates an LM Studio example targeting `127.0.0.1:1234` and `openai/gpt-oss-20b`. Match the model to your server before launching.

The config folder is `%USERPROFILE%\.clauding` on Windows and `$HOME/.clauding` on macOS and Linux. Start a new session after changing either JSON file.

## First launch

Install Node.js 22+, Git, and the official Claude Code CLI, then install Clauding:

```sh
npm install --global "git+https://github.com/hikaMaeng/clauding.git#main"
clauding --help
claude --version
```

Start a server that supports `POST /v1/messages` and load the model. Replace `my-local-model` with its actual advertised model ID:

```sh
clauding --init http://127.0.0.1:1234 my-local-model
clauding "./my project"
```

Use the API base URL before `/v1/messages`. For a server on another machine, use that machine's host and port. An OpenAI-only endpoint needs an Anthropic-compatible adapter or gateway.

At startup, inspect the model name and `/status`, then send a short prompt. `clauding --init` never replaces an existing config: edit `config.json` directly if it already exists.

## Single model and authentication

```json
{
  "baseUrl": "http://127.0.0.1:1234",
  "model": "my-local-model",
  "contextTokens": 65536,
  "authToken": "replace-with-your-server-token"
}
```

Only `baseUrl` and `model` are required. Omit `authToken` for a server that accepts the default `lmstudio` bearer value. A server with authentication enabled needs its own valid token. Keep real tokens in your user config rather than in repository examples.

`contextTokens` is an optional positive integer used for the client's context estimate. Match the server's actual model window; this setting does not increase server capacity. See [the configuration reference](api.md) for validation rules.

## Choose between models

The original single-object config remains supported. To keep multiple endpoints or models, wrap those same objects in a `models` array.

```json
{
  "models": [
    {
      "baseUrl": "http://127.0.0.1:1234",
      "model": "model-a",
      "contextTokens": 65536
    },
    {
      "baseUrl": "http://127.0.0.1:5678",
      "model": "model-b",
      "contextTokens": 131072,
      "authToken": "your-server-token"
    }
  ]
}
```

Run `clauding` and enter an index at the prompt, or select explicitly.

```sh
clauding --select-model 2
clauding --select-model model-a "./my project"
clauding --select-model 2 -- -p "Explain this project"
```

Each launch uses the selected entry's URL, credentials, and context size. Re-run Clauding to choose another entry. The picker shows model IDs and endpoints while omitting token fields, URL credentials, query strings, and fragments. Model selection leaves the JSON file as written.

## Add MCP tools

Save a standard Claude Code MCP config as `~/.clauding/mcp.json`. Clauding adds these tools to its sessions alongside Claude Code's existing MCP configuration. Run `/mcp` in the session to inspect the connection.

For a separately installed Python `websearch` server that uses the Codex CLI, replace both paths with your own absolute executable paths.

```json
{
  "mcpServers": {
    "websearch": {
      "command": "C:/path/to/venv/Scripts/python.exe",
      "args": ["-m", "websearch"],
      "env": {
        "CODEX_MCP_CODEX_BIN": "C:/path/to/codex.exe"
      },
      "alwaysLoad": true
    }
  }
}
```

The `alwaysLoad` setting makes the tool available from the start of the session in supported Claude Code versions. [MCP configuration](https://code.claude.com/docs/en/mcp#exempt-a-server-from-deferral)

This file adds MCP servers to the normal Claude Code configuration. To ask Claude Code to load only the supplied MCP configuration, forward its `--strict-mcp-config` option:

```sh
clauding -- --strict-mcp-config
```

This limits MCP configuration sources, not the whole Claude Code settings or skills environment. The extra file must exist for this example. Ordinary `claude` launches do not receive it through Clauding. MCP server binaries, Python modules, credentials, and any external services are your separately installed dependencies.

## Forward Claude Code options

An initial argument without a leading hyphen is a folder. Place Claude Code options after the optional folder, using `--` to make the boundary clear:

```sh
clauding -- -p "Summarize this project's architecture"
clauding "./my project" -- -p "Explain the test setup"
clauding --select-model 2 -- -p "Explain the main entry point"
clauding -- --help
clauding -- --version
```

The package forwards these options to the installed CLI. Its permissions, instructions, and installed skills continue to follow Claude Code's normal rules. The package does not turn on permission bypass by default; a pre-existing local launcher script may add its own options.

## Install from GitHub

For a private repository, authenticate Git for HTTPS using your existing credential manager or `gh auth login` followed by `gh auth setup-git`. Then run the npm command from the README.

On Windows, if an earlier PowerShell launcher takes precedence on PATH, invoke the npm-installed command explicitly.

```powershell
& (Join-Path (npm.cmd prefix --global) 'clauding.cmd') --help
```

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `Claude Code was not found on PATH` | Install the official CLI, reopen the terminal if PATH changed, and check `claude --version`. On Windows, Clauding supports a native executable or the official npm package behind `claude.cmd`. |
| `Configuration not found` | Run `clauding --init <base-url> <model-id>`, or check the config location under the current user's home. |
| `--init` says the file already exists | Edit that file; initialization deliberately preserves existing single-model and model-list configs. |
| `ANTHROPIC_BASE_URL conflicts` | Resolve the differing declaration in the source named by the error. The check runs before the Claude child starts. See [scope and limits](constraints.md#endpoint-checks). |
| `ECONNREFUSED` or a connection timeout | Check that the configured host/port is reachable and the server is listening. Health URLs are provider-specific. A firewall hint in an error is not proof of the cause. |
| HTTP 404 or an unsupported API error | Check the base path and that the endpoint implements the Anthropic Messages API, not only Chat Completions. |
| Authentication fails | Supply the token expected by that server in `authToken`; changing the model ID does not provide credentials. |
| An unknown-model/context warning | Check the server's accepted model ID and set `contextTokens` to the deployed window. A Claude Code warning does not alone establish that the server rejected the request. |
| A model menu fails in a script | Put `--select-model <index\|model-id>` before the folder/options. Non-interactive multi-model runs need an explicit choice. |
| A prompt is treated as a folder | Use `clauding -- -p "your prompt"`. |
| MCP tools are missing | Run `/mcp`; check the JSON's `mcpServers` key, executable paths, separately installed dependencies, and server credentials. |
| An older Windows script runs instead of the npm launcher | Run `Get-Command clauding -All` and inspect the first result. The explicit npm command above helps compare behavior. |
| Windows image paste does nothing | Try `Alt+V`, the Claude Code Windows image-paste shortcut. Windows Terminal may consume `Ctrl+V`. Image understanding also requires model/server support. [Keyboard reference](https://code.claude.com/docs/en/interactive-mode#general-controls) |

To separate launcher problems from inference problems, start with `clauding --help`, then `clauding -- --version`, then a short prompt. With several saved connections, include `--select-model` in the latter two commands. See [Testing](testing.md) for automated checks and the [Constraints](constraints.md) for what the launcher does and does not inspect.
