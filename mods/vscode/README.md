Clauding connection controls inside the official Claude Code chat interface.

This Claude Code Mod is loaded by Clauding's VS Code process adapter. It does not install another VS Code extension or modify Anthropic's extension files. Its pane and `/clauding on` / `/clauding off` commands change the connection of the current Claude process between its original environment and an entry in the user's Clauding configuration.

Without a configured account, the adapter bootstraps a local connection and the Mod starts enabled. Otherwise it starts disabled. It never rewrites account credential files. The original relevant environment values remain in that process so OFF and reload can restore them; do not use the Mod as a credential-isolation boundary for untrusted tools.

Use `clauding /vscode` to register the adapter, then start a new conversation in the installed official extension. See [the integration guide](../../docs/vscode.md) for setup, restoration, platform requirements, and limitations. To disable or uninstall the Mod from a running conversation, first switch it OFF or start a fresh conversation afterwards.
