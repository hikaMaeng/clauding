Run Claude Code against a local or self-hosted Anthropic-compatible Messages API.

# Clauding

**Your coding workflow, your model endpoint.**

[한국어 안내](README.ko.md) · [Configuration reference](docs/api.md) · [Troubleshooting](docs/usage.md#troubleshooting)

Clauding starts your installed Claude Code with the endpoint and model you choose. Save the connection once, then type `clauding` in any project to start working with it. Keep several models or servers in one file, choose one at launch, and add MCP tools specifically for Clauding sessions.

```sh
clauding                       # work in the current folder
clauding "./my project"        # work in a specific folder
clauding --select-model 2      # choose a saved connection directly
```

## What you get

| Feature | What it lets you do |
| --- | --- |
| A global `clauding` command | Open the current project or a folder with spaces in its path. |
| One editable JSON file | Set a server URL, model ID, optional token, and context window in `~/.clauding/config.json`. |
| Several saved models and servers | Keep the same config objects in a `models` array; select from a menu or by index/model ID. |
| Additional MCP tools | Load `~/.clauding/mcp.json` for Clauding sessions, alongside Claude Code's existing MCP configuration. |
| Your existing Claude Code workflow | Continue using its terminal UI, project instructions, installed skills, tools, and permission controls under their normal loading rules. |
| A check for conflicting endpoints | Stop before launching when an inspected environment variable or local settings file points to a different server. |
| Child-scoped connection settings | Apply API credentials and connection overrides to the Claude Code child without rewriting your shell profile or Claude settings. |
| A small npm package | Use Node.js 22+ with no runtime npm dependencies. Claude Code, model servers, and MCP servers are supplied separately. |

For example, use a model served on your workstation for one project and a model on another machine for the next. Each saved entry can have its own URL, token, and context estimate. Clauding selects that connection; Claude Code runs the coding session, and your server performs inference.

## Before you start

You need:

1. **Node.js 22 or newer** and npm.
2. **The official [Claude Code CLI](https://code.claude.com/docs/en/setup)** installed and available as `claude` on PATH. Check with `claude --version`.
3. **A running Anthropic-compatible Messages API**, such as [LM Studio](https://lmstudio.ai/docs/integrations/claude-code) or a compatible gateway, with a model loaded.
4. **Git access to this repository** for the installation command below.

The server must accept `POST /v1/messages`. An endpoint that only implements OpenAI Chat Completions needs a compatible adapter or gateway. For coding tasks, the model and server must also handle tool calls correctly; model quality and supported features remain provider-dependent.

## Get started

### 1. Install the launcher

```sh
npm install --global "git+https://github.com/hikaMaeng/clauding.git#v0.3.0"
clauding --help
```

This installs the launcher command. Install Claude Code and start your model server separately.

### 2. Save your connection

Use the exact model ID advertised by your server. Replace `my-local-model` in this example:

```sh
clauding --init http://127.0.0.1:1234 my-local-model
```

This creates `~/.clauding/config.json`. On Windows, that is `%USERPROFILE%\.clauding\config.json`. If the file already exists, `--init` keeps it intact; edit the file to change the connection.

Use the base URL before `/v1/messages`, for example `http://127.0.0.1:1234`. Put a remote server's host and port here when inference runs on another machine.

### 3. Start a session in your project

```sh
clauding
clauding "./my project"
```

On Windows:

```powershell
clauding "F:\dev\my project"
```

Check the displayed model and `/status`, then send a short prompt. Edit `config.json` whenever you want a different connection and launch a new session to use it.

## Configure a model

A single-model configuration looks like this:

```json
{
  "baseUrl": "http://127.0.0.1:1234",
  "model": "my-local-model",
  "contextTokens": 65536
}
```

| Key | Required | Meaning |
| --- | --- | --- |
| `baseUrl` | Yes | HTTP(S) base URL for the Messages API. |
| `model` | Yes | The model ID your server accepts. |
| `contextTokens` | No | Positive integer for Claude Code's context estimate; match the actual deployed model. |
| `authToken` | No | Bearer token for a server that requires authentication. Defaults to `lmstudio`. |

`contextTokens` adjusts the client's estimate; it does not allocate a larger context window on the server. Tokens are stored in your local JSON file, so keep real credentials out of project commits.

## Choose between models or servers

Wrap the same configuration objects in a `models` array. There is no separate profile format to learn:

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
      "authToken": "replace-with-your-server-token"
    }
  ]
}
```

With several entries, `clauding` shows a numbered menu. Press Enter for the first entry, or skip the menu:

```sh
clauding --select-model 2
clauding --select-model model-a "./my project"
```

Selection happens at startup and leaves the file unchanged. Start Clauding again to choose another saved connection. Indices start at **1**; use an index if several entries share a model ID. Scripts and other non-interactive runs must select explicitly when several models are configured.

## Add tools with MCP

MCP connects Claude Code to separately installed tools, such as a web search service. Save a standard MCP configuration in `~/.clauding/mcp.json`; Clauding passes it to Claude Code on each launch.

For an independently installed Python `websearch` server that uses a Codex executable, the file can look like this. Replace both executable paths with your own:

```json
{
  "mcpServers": {
    "websearch": {
      "command": "C:/path/to/venv/Scripts/python.exe",
      "args": ["-m", "websearch"],
      "env": {
        "CODEX_MCP_CODEX_BIN": "C:/path/to/codex.exe"
      }
    }
  }
}
```

Start Clauding and run `/mcp` to inspect the connection. This example requires that Python module and its dependencies to be installed separately. Clauding does not bundle a search service.

The extra file is used by Clauding launches; ordinary `claude` launches do not load it through this launcher. Existing Claude Code user/project MCP settings still apply. See [MCP setup and isolation](docs/usage.md#add-mcp-tools) if you want to use only the supplied MCP file.

## Use Claude Code options

Place the folder first, then `--` and the Claude Code arguments. For a single prompt without an interactive chat:

```sh
clauding -- -p "Summarize this project's architecture"
clauding "./my project" -- -p "Explain the test setup"
clauding --select-model 2 -- -p "Explain the main entry point"
```

A bare initial argument is treated as a folder, so use `-p` for a prompt. Permissions follow Claude Code's settings and the arguments you supply; this package does not automatically enable permission bypass.

| Command | Result |
| --- | --- |
| `clauding --init [base-url model-id]` | Create a configuration if it is absent. |
| `clauding [folder]` | Start an interactive coding session. |
| `clauding --select-model <index\|model-id> [folder]` | Pick a saved connection before starting. |
| `clauding --help` | Show launcher help. |
| `clauding -- --help` | Show Claude Code help. |
| `clauding -- --version` | Check the Claude Code installation resolved by the launcher. |

`--select-model` belongs before the folder and Claude Code options. [Full CLI reference](docs/api.md)

## Common questions

**Will my instructions, skills, and tools still work?** Claude Code loads them under its normal settings, project trust, and permission rules. Clauding configures the connection and adds the optional MCP file. It does not create a separate skills installation or a separate Claude settings home.

**Can I connect any model?** The server needs the Messages API, and reliable coding requires working tool calls. Streaming, images, context size, and other features also depend on the server and model. Test a short task before relying on a new combination.

**Does this add web search automatically?** Search needs a tool and a compatible backend. You can configure a search MCP server as above; choosing a local model alone does not provide a search service.

**Why does startup report an endpoint conflict?** An inspected `ANTHROPIC_BASE_URL` differs from your selected connection. Resolve it in the source named by the error. Clauding stops before starting Claude Code rather than silently discarding that declaration. [Check scope and limits](docs/constraints.md#endpoint-checks)

**Why does image paste do nothing on Windows?** Windows Terminal can consume `Ctrl+V` itself. Claude Code's Windows image-paste shortcut is **Alt+V**. Image interpretation still requires a model/server that supports images. [Official keyboard shortcuts](https://code.claude.com/docs/en/interactive-mode#general-controls)

For connection errors, MCP failures, context warnings, and old Windows launcher shims, see [Troubleshooting](docs/usage.md#troubleshooting).

## Documentation and development

| Goal | File |
| --- | --- |
| Understand the purpose and responsibilities | [Overview](docs/overview.md) |
| Install, configure, and troubleshoot | [Usage](docs/usage.md) |
| Look up CLI and configuration keys | [API](docs/api.md) |
| Understand the launch path | [Architecture](docs/architecture.md) |
| Check provider and platform constraints | [Constraints](docs/constraints.md) |
| Understand executable resolution and environment handling | [Internals](docs/internals.md) |
| Run tests and verify the npm package | [Testing](docs/testing.md) |

```sh
git clone https://github.com/hikaMaeng/clauding.git
cd clauding
npm test
npm pack --dry-run
```

Tests use an isolated home and a fake Claude Code process to check launcher behavior without a model server. Real model quality and API compatibility require a separate integration check. [Test coverage](docs/testing.md)

Clauding, Claude Code, model providers, and MCP servers have separate distribution terms. See the package's `UNLICENSED` declaration and [Claude Code's terms](https://code.claude.com/docs/en/legal-and-compliance).
