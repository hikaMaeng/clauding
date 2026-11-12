# Constraints

- The endpoint must implement the Anthropic Messages API. Tool-driven coding also depends on the endpoint and model handling tool calls.
- Claude Code's context estimate does not change the inference server's actual token capacity. Set `contextTokens` to match the deployed model. [Custom model context windows](https://code.claude.com/docs/en/model-config#correct-the-window-for-a-gateway-or-custom-model-id)
- Claude Code features that depend on Claude account credentials or Anthropic-hosted services have their own availability and authentication rules. [Tools reference](https://code.claude.com/docs/en/tools-reference)
- The user supplies the official Claude Code CLI and is subject to its applicable terms. [Claude Code legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)

## Endpoint checks

Before launching Claude Code, Clauding compares the selected URL with `ANTHROPIC_BASE_URL` in the process environment and enabled local settings. It checks the user settings directory (including `CLAUDE_CONFIG_DIR`), shared project settings in the working directory, explicit `--settings` files or inline JSON, and local `managed-settings.json` plus non-hidden `managed-settings.d/*.json`.

On Windows, local settings also come from the working directory. On POSIX, Git identifies the main checkout root for local settings, including linked worktrees. The working directory is used outside Git, when that root is the user's home, or when the root or its `.git`/`.claude` entries have another owner. Legacy local files in the working directory are also checked. Git discovery failure falls back to the working directory. [Local settings location](https://code.claude.com/docs/en/settings#where-claude-code-keeps-the-local-file-in-a-git-repository)

`--setting-sources` controls user, project, and local inspection. `--restricted` disables those three sources regardless of option order. `CLAUDE_CODE_RESTRICTED` enables the same mode for trimmed, case-insensitive values of `1`, `true`, `yes`, or `on`. Process environment, explicit settings, and local managed files are still checked. Every discovered declaration must match the selection, even when a higher-precedence declaration would override it. The argument inspector skips values for known Claude Code options, preserving literal prompt text that resembles settings flags. URL path trailing slashes are equivalent. Malformed relevant settings fail before launch, and errors name the variable and source without printing endpoint or credential values.

This preflight is a snapshot of local files. Claude Code also supports dynamic server-managed settings, registry or MDM policy, and runtime reloads. Those sources and changes after the check are outside the preflight. Claude Code remains responsible for its final settings resolution. [Settings sources](https://code.claude.com/docs/en/settings)

## Process shutdown

Clauding forwards `SIGTERM`, `SIGHUP`, and non-interactive `SIGINT` to its Claude child and waits for the child to exit. After two seconds, it sends `SIGKILL` if shutdown has not finished. A second shutdown signal also requests immediate forced termination. Numeric child exit codes are preserved, and a signal exit uses `128 + signal number`.

Interactive Ctrl+C is delivered through the shared foreground console, so Clauding does not duplicate that signal or force an exit during Claude Code's own cancellation flow. On Windows, Node handles console events where the OS delivers them. Native Windows `TerminateProcess` and forced supervisor termination cannot be intercepted by JavaScript. The shutdown guarantee applies to signals the launcher receives and its direct child.
