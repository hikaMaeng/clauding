import { normalizeEndpoint } from './endpoint.js';

/** Apply connection overrides only to the Claude Code subprocess. */
export function makeEnvironment(config, inherited = process.env, platform = process.platform) {
  const settings = {
    ANTHROPIC_BASE_URL: normalizeEndpoint(config.baseUrl),
    ANTHROPIC_AUTH_TOKEN: config.authToken?.trim() || 'lmstudio',
    ANTHROPIC_API_KEY: null,
    ANTHROPIC_CUSTOM_HEADERS: null,
    CLAUDE_CODE_OAUTH_TOKEN: null,
    CLAUDE_CODE_USE_BEDROCK: null,
    CLAUDE_CODE_USE_VERTEX: null,
    CLAUDE_CODE_USE_FOUNDRY: null,
    CLAUDE_CODE_ATTRIBUTION_HEADER: '0',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  };
  if (config.contextTokens != null) settings.CLAUDE_CODE_MAX_CONTEXT_TOKENS = String(config.contextTokens);
  const env = { ...inherited };
  for (const key of Object.keys(env)) {
    if (Object.hasOwn(settings, platform === 'win32' ? key.toUpperCase() : key)) delete env[key];
  }
  for (const [key, value] of Object.entries(settings)) {
    if (value != null) env[key] = value;
  }
  return env;
}
