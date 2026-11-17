# Overview

Clauding makes a saved model connection available as a global command for an existing [Claude Code](https://code.claude.com/docs/en/setup) installation. Use it when you want to keep the same coding workflow across local models, remote inference machines, or a self-hosted Messages API gateway.

## Responsibilities

| Component | Responsibility |
| --- | --- |
| Clauding | Read and validate the saved connection, select a model, check local endpoint declarations, and launch Claude Code in the chosen folder. |
| Claude Code | Load its own instructions, skills, settings, permissions, and tools; run the session and communicate with the API. |
| Model server or gateway | Accept the Anthropic Messages protocol, route the selected model ID, and provide inference and supported tool-call/streaming behavior. |
| Optional MCP servers | Provide extra tools under their own configuration and authentication requirements. |

## A typical session

1. Start the inference server and load a model.
2. Save its connection in `~/.clauding/config.json` once.
3. Run `clauding` from a project, or pass a folder path.
4. If several connections are saved, choose one from the menu or use `--select-model`.
5. Work in Claude Code as usual; start a new Clauding session to select another saved connection.

The original single-object config and a `models` array use the same entry format. The optional `~/.clauding/mcp.json` adds tools to Clauding launches. These files keep launcher connection choices separate from ordinary Claude Code settings while retaining Claude Code's normal configuration loading rules.

The npm package ships the launcher and this documentation. Claude Code, the inference server, and MCP servers are installed separately and carry their respective terms.
