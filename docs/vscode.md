# Official VS Code extension integration

The integration uses the installed `anthropic.claude-code` extension's existing chat panel. It adds a Claude Code Mod and a launch adapter; it ships no VSIX and edits no extension source files. The installed extension supplies its own Claude binary. Development verification targets extension 2.1.327 on native Windows.

## Commands

```sh
clauding /vscode
clauding /vscode --select-model 2
clauding /vscode --off
```

`/vscode` reads `~/.clauding/config.json` and registers `claudeCode.claudeProcessWrapper` and `claudeCode.disableLoginPrompt` in the standard VS Code user settings file. It backs up the original bytes under `~/.clauding/vscode/backups/`. It preserves the existing model choice, permission mode, environment-variable settings, and account files. Other VS Code profiles, portable installations, Cursor, remote extension hosts, and Settings Sync are not configured by this command.

With multiple entries, the first model is the initial selection. Use `--select-model` to save a different initial selection in `~/.clauding/vscode.json`. Start a new extension conversation after setup, or use VS Code's Developer: Reload Window command.

## Chat controls

The Mod opens a small Clauding pane in the official panel. Its ON/OFF button controls the current Claude process. If several models are configured, its selector chooses which entry ON uses. `/clauding` reopens the controls, and `/clauding on` or `/clauding off` switches without an AI turn.

- **OFF:** model requests use the original process environment and the model selected through the official interface.
- **ON:** requests use the selected Clauding endpoint/token/context and model ID. The original credential files are left intact.
- **No account:** the adapter checks the binary's `auth status --json`. If it reports `loggedIn: false`, it bootstraps only that child with the configured connection so the extension can start without login. The Mod enables Clauding automatically.
- **Existing account:** the adapter passes the original connection through. Clauding starts OFF; turning it OFF again restores the captured environment values.

The built-in Claude model menu remains intact. While ON, the model shown in the Clauding control handles each model request. Wait for the reply to finish before switching. The next request uses the newly selected connection and can include conversation history. Start a fresh chat to keep the histories separate.

## Runtime and restoration

The child receives an in-memory snapshot of the relevant inherited environment values so the Mod can restore them after a toggle or reload. This snapshot is not written to disk; it is part of that process's environment. The native Windows adapter relays stdin/stdout/stderr without a command shell and uses a Windows Job Object to end its descendants when the adapter exits.

The optional Clauding MCP file is added alongside the extension's own IDE MCP definitions at process startup. Those tools remain loaded in both modes. Toggling changes model routing, not the MCP server inventory or permission mode.

To disable the Mod from Claude Code's plugin manager, first turn Clauding OFF or start a fresh conversation afterwards. Removing a running Mod cannot rewind environment changes it already made. The external `/vscode --off` command restores only its two registered settings and leaves other current VS Code settings intact. If either registered value was edited afterwards, automatic restoration stops rather than overwriting the edit. Start a new conversation or reload after unregistering.

## Requirements and troubleshooting

- Install Node.js 22+, VS Code, and the official Anthropic extension first.
- On Windows, setup builds a small executable using the existing .NET Framework C# compiler. It stops before changing VS Code settings if the compiler is unavailable.
- Automatic setup currently accepts a JSON settings file; comments or trailing commas must be removed before setup. A parse failure leaves the file untouched.
- An old PowerShell shim can intercept `clauding` before the npm command. Check `Get-Command clauding -All` if `/vscode` is treated as a folder.
- If the login page persists, check that setup targeted the active VS Code profile and reload the window. Hiding the login page alone does not establish API connectivity.
- Provider protocol, streaming, tools, model quality, and response speed still depend on the selected server/model. Clauding does not supply a server or Anthropic subscription.
- Organization policy and disabled Mods can prevent activation; the integration does not bypass them.

See [the extension's documented wrapper setting](https://code.claude.com/docs/en/vs-code#extension-settings) and [official Mod support](https://code.claude.com/docs/en/plugins/mods/overview).
