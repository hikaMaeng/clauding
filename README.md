Run Claude Code against a local or self-hosted Anthropic-compatible Messages API.

# Clauding

Configure one model or a list, then run `clauding` in any project. Clauding starts your existing Claude Code installation with the selected endpoint, model, optional context window, and optional MCP config scoped to the launcher.

## Install

Install Node.js 22 or newer and put the [official Claude Code CLI](https://code.claude.com/docs/en/setup) on your PATH. Git needs access to this repository.

```sh
npm install --global "git+https://github.com/hikaMaeng/clauding.git#v0.3.0"
```

## Quick start

Start an [LM Studio server](https://lmstudio.ai/docs/integrations/claude-code) or another Anthropic-compatible server. Use the model ID advertised by that server.

```sh
clauding --init http://127.0.0.1:1234 openai/gpt-oss-20b
clauding
clauding "./my project"
```

On Windows, `clauding "F:\dev\my project"` opens a specified folder. `clauding --init` keeps an existing configuration.

Edit `~/.clauding/config.json` to change the endpoint or model. Set `contextTokens` to the server's actual context window if Claude Code assumes a different size.

```json
{
  "baseUrl": "http://127.0.0.1:1234",
  "model": "my-local-model",
  "contextTokens": 65536
}
```

For launch-only tools such as a web search server, add `~/.clauding/mcp.json`. See the [MCP example](docs/usage.md#add-mcp-tools) for a portable template.

To keep several models, wrap the same config objects in `{"models":[...]}`. `clauding` prompts for a model when the list has multiple entries. Use `clauding --select-model 2` to select an entry directly. [Model list example](docs/usage.md#choose-between-models)

If the shell or an enabled local Claude settings file declares a different `ANTHROPIC_BASE_URL`, Clauding reports the source and exits before starting Claude Code. [Endpoint checks](docs/constraints.md#endpoint-checks)

| Goal | File |
| --- | --- |
| Understand the purpose | [Overview](docs/overview.md) |
| Install and configure | [Usage](docs/usage.md) |
| Look up CLI and config keys | [API](docs/api.md) |
| Understand the launch path | [Architecture](docs/architecture.md) |
| Check provider and platform constraints | [Constraints](docs/constraints.md) |
| Troubleshoot executable resolution | [Internals](docs/internals.md) |
| Verify a build or installation | [Testing](docs/testing.md) |
