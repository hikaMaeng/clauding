#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { constants, homedir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { selectModel, validateConfig } from '../lib/models.js';

const configDir = join(homedir(), '.clauding');
const configPath = join(configDir, 'config.json');
const mcpPath = join(configDir, 'mcp.json');
const isWindows = process.platform === 'win32';

/** Read JSON written by either npm-era or PowerShell-era setups. */
function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`Cannot read ${file}: ${error.message}`);
  }
}

/** Create a user config once, leaving an existing config intact. */
function initConfig(args) {
  if (args.length !== 0 && args.length !== 2) {
    throw new Error('Usage: clauding --init [base-url model-id]');
  }
  const [baseUrl = 'http://127.0.0.1:1234', model = 'openai/gpt-oss-20b'] = args;
  const config = { baseUrl, model };
  validateConfig(config, configPath);
  mkdirSync(configDir, { recursive: true });
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    console.log(`Created ${configPath}`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log(`Already exists: ${configPath}`);
  }
}

/** Resolve the official native or npm entry point without a command shell. */
function findClaude() {
  if (!isWindows) return { command: 'claude', prefix: [] };

  const pathDirs = (process.env.PATH ?? '').split(delimiter)
    .map((entry) => entry.replace(/^"|"$/g, ''))
    .filter(Boolean);
  for (const dir of pathDirs) {
    const executable = join(dir, 'claude.exe');
    if (statSync(executable, { throwIfNoEntry: false })?.isFile()) {
      return { command: executable, prefix: [] };
    }
  }
  for (const dir of pathDirs) {
    if (!existsSync(join(dir, 'claude.cmd'))) continue;
    const packageDir = join(dir, 'node_modules', '@anthropic-ai', 'claude-code');
    const manifest = join(packageDir, 'package.json');
    if (!existsSync(manifest)) continue;
    const bin = readJson(manifest).bin;
    const entry = typeof bin === 'string' ? bin : bin?.claude;
    if (typeof entry !== 'string') continue;
    const file = join(packageDir, entry);
    if (!statSync(file, { throwIfNoEntry: false })?.isFile()) continue;
    if (/\.exe$/i.test(file)) return { command: file, prefix: [] };
    if (/\.[cm]?js$/i.test(file)) return { command: process.execPath, prefix: [file] };
  }
  throw new Error('Claude Code was not found on PATH. Install it first: https://code.claude.com/docs/en/setup');
}

/** Apply launcher overrides only to the Claude Code subprocess. */
function makeEnvironment(config) {
  const settings = {
    ANTHROPIC_BASE_URL: config.baseUrl.trim().replace(/\/+$/, ''),
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
  if (config.contextTokens != null) {
    settings.CLAUDE_CODE_MAX_CONTEXT_TOKENS = String(config.contextTokens);
  }
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (Object.hasOwn(settings, isWindows ? key.toUpperCase() : key)) delete env[key];
  }
  for (const [key, value] of Object.entries(settings)) {
    if (value != null) env[key] = value;
  }
  return env;
}

/** Start the CLI with the selected working directory and inherited terminal. */
async function main(args) {
  if (args[0] === '--help' || args[0] === '-h') {
    console.log(`Usage: clauding [--select-model <index|model-id>] [folder] [--] [Claude Code options]
       clauding --init [base-url model-id]

Config: ${configPath}
Optional MCP config: ${mcpPath}
Claude Code help: clauding -- --help`);
    return;
  }
  if (args[0] === '--init') {
    initConfig(args.slice(1));
    return;
  }
  let selector;
  if (args[0] === '--select-model') {
    selector = args[1];
    if (!selector || selector.startsWith('-')) {
      throw new Error('Usage: clauding --select-model <index|model-id> [folder] [Claude Code options]');
    }
    args = args.slice(2);
  }
  if (!existsSync(configPath)) {
    throw new Error(`Configuration not found: ${configPath}. Run clauding --init first.`);
  }
  const hasFolder = args.length > 0 && !args[0].startsWith('-');
  const cwd = hasFolder ? resolve(args[0]) : process.cwd();
  if (!statSync(cwd, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Folder not found: ${cwd}`);
  }
  const config = await selectModel(readJson(configPath), configPath, selector);
  const remaining = args.slice(hasFolder ? 1 : 0);
  const passthrough = remaining[0] === '--' ? remaining.slice(1) : remaining;
  const mcp = existsSync(mcpPath) ? ['--mcp-config', mcpPath] : [];
  const { command, prefix } = findClaude();
  const child = spawn(command, [...prefix, ...mcp, '--model', config.model.trim(), ...passthrough], {
    cwd,
    env: makeEnvironment(config),
    stdio: 'inherit',
  });
  child.once('error', (error) => {
    fail(error.code === 'ENOENT' ? 'Claude Code was not found on PATH.' : error.message);
  });
  child.once('exit', (code, signal) => {
    process.exitCode = code ?? 128 + (constants.signals[signal] ?? 1);
  });
}

function fail(message) {
  console.error(`clauding: ${message}`);
  process.exitCode = 1;
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  fail(error.message);
}
