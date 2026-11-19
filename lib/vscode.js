import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { selectModel } from './models.js';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { makeEnvironment } from './environment.js';

const connectionVariables = new Set(['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY',
  'ANTHROPIC_CUSTOM_HEADERS', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY', 'CLAUDE_CODE_MAX_CONTEXT_TOKENS', 'CLAUDE_CODE_ATTRIBUTION_HEADER',
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC']);

/** Read launcher configuration without exposing credential-bearing JSON excerpts. */
export function readVSCodeJson(file, optional = false) {
  if (optional && !statSync(file, { throwIfNoEntry: false })) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    throw new Error(`Cannot read valid JSON from ${file}.`);
  }
}

/** Resolve a connection without displaying a picker on the extension protocol. */
export async function vscodeModel(home = homedir(), selector) {
  const directory = join(home, '.clauding');
  const selection = readVSCodeJson(join(directory, 'vscode.json'), true);
  selector ??= selection.modelSelector ?? '1';
  if (typeof selector !== 'string' || !selector.trim()) {
    throw new Error('Set modelSelector to a non-empty index or model ID in .clauding/vscode.json.');
  }
  return selectModel(readVSCodeJson(join(directory, 'config.json')), join(directory, 'config.json'),
    selector, { isTTY: false }, { isTTY: false });
}

/** Honor the extension binary, working directory, protocol streams, and IDE MCP. */
export async function vscodeLaunch(args, { cwd = process.cwd(), home = homedir(), env = process.env } = {}) {
  const [command, ...forwarded] = args;
  if (!command || !isAbsolute(command) || !statSync(command, { throwIfNoEntry: false })?.isFile()) {
    throw new Error('The VS Code wrapper requires the extension-supplied absolute Claude executable path.');
  }
  const selection = readVSCodeJson(join(home, '.clauding', 'vscode.json'), true);
  let childEnv = { ...env };
  childEnv.CLAUDING_CONFIG_PATH = join(home, '.clauding', 'config.json');
  if (selection.modelSelector) childEnv.CLAUDING_VSCODE_SELECTOR = selection.modelSelector;
  const originals = {};
  for (const [key, value] of Object.entries(env)) {
    const name = process.platform === 'win32' ? key.toUpperCase() : key;
    if (connectionVariables.has(name) && value != null) originals[name] = value;
  }
  // Process-local snapshot supports restoration after Mod reloads; never written to disk.
  childEnv.CLAUDING_VSCODE_ORIGINAL_ENV = JSON.stringify(originals);
  const isSession = forwarded.includes('--print') || forwarded.includes('-p') || forwarded.some((arg, index) =>
    arg === '--input-format=stream-json' || arg === '--input-format' && forwarded[index + 1] === 'stream-json');
  if (isSession) {
    const status = spawnSync(command, ['auth', 'status', '--json'], {
      cwd, env, encoding: 'utf8', windowsHide: true, timeout: 45000, maxBuffer: 1024 * 1024,
    });
    try {
      const { loggedIn } = JSON.parse(status.stdout);
      if (typeof loggedIn !== 'boolean') throw new Error();
      childEnv.CLAUDING_VSCODE_NO_ACCOUNT = loggedIn ? '0' : '1';
    } catch {
      childEnv.CLAUDING_VSCODE_NO_ACCOUNT = '0';
      childEnv.CLAUDING_VSCODE_AUTH_UNKNOWN = '1';
    }
    // The extension checks authentication before the first prompt runs the Mod.
    // Bootstrap only an account-less child; the Mod holds the untouched snapshot.
    if (childEnv.CLAUDING_VSCODE_NO_ACCOUNT === '1') childEnv = makeEnvironment(await vscodeModel(home), childEnv);
    const mod = fileURLToPath(new URL('../mods/vscode', import.meta.url));
    forwarded.unshift('--plugin-dir', mod);
    const mcp = join(home, '.clauding', 'mcp.json');
    if (statSync(mcp, { throwIfNoEntry: false })?.isFile()) {
      const index = forwarded.indexOf('--mcp-config');
      if (index >= 0) forwarded.splice(index + 1, 0, mcp);
      else forwarded.unshift('--mcp-config', mcp);
    }
  }
  return { command, args: forwarded, cwd, env: childEnv };
}
