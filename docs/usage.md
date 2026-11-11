# Usage

Run `clauding --init <base-url> <model-id>` once, then use `clauding` in the desired folder. With no arguments, `--init` creates an LM Studio example targeting `127.0.0.1:1234` and `openai/gpt-oss-20b`. Match the model to your server before launching.

The config folder is `%USERPROFILE%\.clauding` on Windows and `$HOME/.clauding` on macOS and Linux. Start a new session after changing either JSON file.

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

## Install from GitHub

For a private repository, authenticate Git for HTTPS using your existing credential manager or `gh auth login` followed by `gh auth setup-git`. Then run the npm command from the README.

On Windows, if an earlier PowerShell launcher takes precedence on PATH, invoke the npm-installed command explicitly.

```powershell
& (Join-Path (npm.cmd prefix --global) 'clauding.cmd') --help
```
