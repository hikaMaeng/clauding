Run Claude Code against a local or self-hosted Anthropic-compatible Messages API.

# Clauding

**Your coding workflow, your model endpoint.**

[한국어 안내](README.ko.md) · [VS Code setup](#use-the-official-vs-code-chat-panel) · [Configuration reference](docs/api.md) · [Troubleshooting](docs/usage.md#troubleshooting)

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
| Official VS Code chat integration | Run `clauding /vscode` to add Clauding ON/OFF controls inside the installed Anthropic extension, including use without an Anthropic login. |
| Your existing Claude Code workflow | Continue using its terminal UI, project instructions, installed skills, tools, and permission controls under their normal loading rules. |
| A check for conflicting endpoints | Stop before launching when an inspected environment variable or local settings file points to a different server. |
| Child-scoped connection settings | Apply API credentials and connection overrides to the Claude Code child without rewriting your shell profile or Claude settings. |
| A small npm package | Use Node.js 22+ with no runtime npm dependencies. Claude Code, model servers, and MCP servers are supplied separately. |

For example, use a model served on your workstation for one project and a model on another machine for the next. Each saved entry can have its own URL, token, and context estimate. Clauding selects that connection; Claude Code runs the coding session, and your server performs inference.

## Before you start

You need:

1. **Node.js 22 or newer** and npm.
2. **Claude Code for the interface you use.** The terminal launcher needs the official CLI on PATH. Check it with `claude --version`. The VS Code chat integration uses the executable bundled with the official extension. [Claude Code CLI setup](https://code.claude.com/docs/en/setup)
3. **A running Anthropic-compatible Messages API**, such as [LM Studio](https://lmstudio.ai/docs/integrations/claude-code) or a compatible gateway, with a model loaded.
4. **Git access to this repository** for the installation command below.

The server must accept `POST /v1/messages`. An endpoint that only implements OpenAI Chat Completions needs a compatible adapter or gateway. For coding tasks, the model and server must also handle tool calls correctly; model quality and supported features remain provider-dependent.

## Get started

### 1. Install the launcher

```sh
npm install --global "git+https://github.com/hikaMaeng/clauding.git#main"
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

## Use the official VS Code chat panel

Clauding adds a connection control to Anthropic's graphical Claude Code chat. The same chat can send requests through your original Claude connection or through the Messages API you configure. The packaged Claude Code Mod runs inside the official extension.

### 1. Install the extension and launcher

1. Open **Extensions** in VS Code and install **Claude Code for VS Code** by **Anthropic**, extension ID `anthropic.claude-code`. Use a local VS Code window with the default profile. The integration was exercised on Windows with extension version `2.1.327`. [Official Marketplace listing](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code)
2. Install or update Clauding from this repository using Node.js 22 or newer. Keep the launcher installed while the integration is registered.

   ```sh
   npm install --global "git+https://github.com/hikaMaeng/clauding.git#main"
   clauding --help
   ```

   The help output should list `/vscode`. On Windows, registration uses the existing .NET Framework C# compiler to build the launch adapter.

### 2. Configure the model connection

Start your model server and load the model. In a terminal, create your Clauding configuration with the server's base URL and exact model ID:

```sh
clauding --init http://127.0.0.1:1234 my-local-model
```

Use the URL prefix before `/v1/messages`. For example, if the Messages endpoint is `http://127.0.0.1:1234/v1/messages`, enter `http://127.0.0.1:1234`. Replace `my-local-model` with the ID your server serves. The integrated chat uses the same [single-model configuration](#configure-a-model) or [models array](#choose-between-models-or-servers) as the terminal launcher.

`--init` creates `~/.clauding/config.json` when it is absent. On Windows, edit `%USERPROFILE%\.clauding\config.json` if you already have a configuration. Set `authToken` if the server requires a Bearer token and match `contextTokens` to the server's deployed window.

### 3. Register the integration

Run this once from a regular terminal or VS Code's integrated terminal:

```sh
clauding /vscode
```

The command prints the selected model, VS Code settings path, and backup directory. It registers `claudeCode.claudeProcessWrapper` and `claudeCode.disableLoginPrompt` in the default profile's user settings. On Windows that file is `%APPDATA%\Code\User\settings.json`. Backups are in `~/.clauding/vscode/backups/`. [Official extension settings](https://code.claude.com/docs/en/vs-code#extension-settings)

Open the Command Palette and run **Developer: Reload Window**, then open Claude Code from the Activity Bar and start a **new** chat. If the extension opens a terminal, turn off **Claude Code: Use Terminal** in VS Code Settings to use the graphical panel.

### 4. Choose the connection and send a test prompt

Look for the **Clauding** control above the prompt box. Its label shows the current mode. Click it between replies or type the corresponding slash command in the official chat.

| Mode | Where the next model request goes |
| --- | --- |
| **Clauding OFF** | The original Claude connection, using the extension's Claude model selection. A signed-in Claude session starts in this mode. |
| **Clauding ON** | The URL, token, model ID, and optional context size in the selected Clauding entry. When the launcher detects a signed-out session, Clauding starts in this mode. |

`/clauding` opens the control. `/clauding on` and `/clauding off` change the mode without calling the model. In **ON** mode, read the model ID beside the Clauding control. That ID determines the target even if the extension's own model menu shows a Claude model.

With **Clauding ON**, send `Reply with exactly VSCODE_CLAUDING_OK.` and confirm the reply. If your server exposes a request log, check that it received a Messages request for the selected model. You can switch back to **OFF** after the reply when your original connection is available.

Switching applies to the next request in the same conversation and can send earlier chat context to the selected server. Start a separate chat when you want to keep the histories separate. The extension's project permissions still apply. If present, `~/.clauding/mcp.json` is loaded when the chat process starts and its tools are available in both modes.

### 5. Choose another model or update the connection

With several model entries, use the **Clauding model** selector in the chat. The first entry is the initial selection unless you have saved another one. Set the default for new chats by index or by unique model ID:

```sh
clauding /vscode --select-model 2
clauding /vscode --select-model my-local-model
```

Indices start at 1. The default is saved as `modelSelector` in `~/.clauding/vscode.json`. To change the server, token, model ID, or context size, edit `config.json` and open a new chat. The runtime also rereads the model configuration when you turn Clauding ON. If a saved model no longer exists, register again with a valid selection.

### Troubleshoot VS Code setup

| Symptom | What to check |
| --- | --- |
| `/vscode` is treated as a folder or missing from help | Update Clauding. In Windows PowerShell, run `Get-Command clauding -All` to see whether an older script is taking precedence over the npm launcher. |
| Setup rejects VS Code's `settings.json` | Automatic registration currently requires strict JSON. Remove comments and trailing commas from the user settings file after saving a copy, then retry. |
| The toggle is missing | Check the official extension and the default local profile. Turn off **Claude Code: Use Terminal**, reload the window, open a new chat, and try `/clauding`. Extension or organization policy can restrict Mods. |
| Sign-in is offered, or the account check times out | If offered, choose **Continue without Signing In**, then open a new chat and check that Clauding is ON. If the panel reports an unresolved account check, select **Clauding ON** manually. Verify that the active profile has the two settings printed by setup. |
| Clauding is ON and the prompt fails | Check that the server is running and reachable from the VS Code host, its `POST /v1/messages` route accepts your token, and it serves the exact model ID in the control. |

Use the default desktop VS Code profile for automatic registration. Other profiles, portable installations, Cursor, and remote extension hosts are outside this setup command's scope.

### Remove the integration

```sh
clauding /vscode --off
```

This restores the previous values of the two registered VS Code settings. If you changed either setting after registration, the command reports the conflict so you can use the backup. Reload the VS Code window after removal. Use the chat's **OFF** button for a temporary switch. [Integration details and restoration](docs/vscode.md)

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
| `clauding /vscode [--select-model <index\|model-id>]` | Register the official VS Code chat integration and optionally save its initial model. |
| `clauding /vscode --off` | Unregister the VS Code integration. |
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
| Configure the official VS Code chat integration | [VS Code](docs/vscode.md) |
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
