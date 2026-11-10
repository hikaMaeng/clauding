# Constraints

- The endpoint must implement the Anthropic Messages API. Tool-driven coding also depends on the endpoint and model handling tool calls.
- Claude Code's context estimate does not change the inference server's actual token capacity. Set `contextTokens` to match the deployed model. [Custom model context windows](https://code.claude.com/docs/en/model-config#correct-the-window-for-a-gateway-or-custom-model-id)
- Claude Code features that depend on Claude account credentials or Anthropic-hosted services have their own availability and authentication rules. [Tools reference](https://code.claude.com/docs/en/tools-reference)
- The user supplies the official Claude Code CLI and is subject to its applicable terms. [Claude Code legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)
