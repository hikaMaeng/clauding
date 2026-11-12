import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const variable = 'ANTHROPIC_BASE_URL';
const maxSettingsBytes = 2 * 1024 * 1024;
const requiredOptions = new Set([
  '--agent', '--agents', '--append-system-prompt', '--append-system-prompt-file',
  '--autocompact', '--debug-file', '--effort', '--environment', '--fallback-model',
  '--input-format', '--json-schema', '--max-budget-usd', '--max-turns', '--model',
  '--name', '-n', '--output-format', '--permission-mode', '--permission-prompts',
  '--plugin-dir', '--plugin-url', '--remote-control-session-name-prefix', '--session-id',
  '--system-prompt', '--system-prompt-file', '--system-prompt-snapshot',
]);
const variadicOptions = new Set([
  '--add-dir', '--allowedTools', '--allowed-tools', '--betas', '--disallowedTools',
  '--disallowed-tools', '--file', '--mcp-config', '--tools',
]);
const optionalOptions = new Set([
  '--cloud', '--debug', '-d', '--from-pr', '--prompt-suggestions', '--remote-control',
  '--resume', '-r', '--teleport', '--worktree', '-w',
]);

/** Normalize the endpoint path while preserving credentials and query values. */
export function normalizeEndpoint(value, source = 'Clauding config') {
  if (typeof value !== 'string' || !URL.canParse(value.trim())) {
    throw new Error(`Invalid ${variable} in ${source}.`);
  }
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Invalid ${variable} in ${source}.`);
  }
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.search || url.hash ? url.toString() : url.toString().replace(/\/$/, '');
}

/** Read a local settings object without exposing parser excerpts or values. */
function readSettings(file, required = false) {
  let text;
  try {
    const stat = statSync(file, { throwIfNoEntry: false });
    if (!stat && !required) return;
    if (!stat?.isFile() || stat.size > maxSettingsBytes) throw new Error();
    text = readFileSync(file, 'utf8');
  } catch {
    throw new Error(`Cannot inspect settings file ${file}.`);
  }
  return parseSettings(text, file);
}

/** Parse relevant settings without including secret-bearing source text. */
function parseSettings(text, source) {
  let settings;
  try {
    settings = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error(`Invalid settings JSON in ${source}.`);
  }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error(`Settings must be an object in ${source}.`);
  }
  if (Object.hasOwn(settings, 'env') &&
      (!settings.env || typeof settings.env !== 'object' || Array.isArray(settings.env))) {
    throw new Error(`Invalid settings env in ${source}.`);
  }
  return settings;
}

/** Extract only settings flags; the rest remain untouched for Claude Code. */
function settingsOptions(args, env) {
  let sources = ['user', 'project', 'local'];
  let restricted = typeof env.CLAUDE_CODE_RESTRICTED === 'string' &&
    ['1', 'true', 'yes', 'on'].includes(env.CLAUDE_CODE_RESTRICTED.trim().toLowerCase());
  const settings = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--') break;
    const name = arg.split('=', 1)[0];
    const equals = arg.indexOf('=');
    if (requiredOptions.has(name)) {
      if (equals < 0) index++;
      continue;
    }
    if (variadicOptions.has(name)) {
      if (equals < 0) index++;
      while (index + 1 < args.length && !args[index + 1].startsWith('-')) index++;
      continue;
    }
    if (optionalOptions.has(name)) {
      if (equals < 0 && index + 1 < args.length && !args[index + 1].startsWith('-')) index++;
      continue;
    }
    if (arg === '--restricted') {
      restricted = true;
      continue;
    }
    if (name !== '--settings' && name !== '--setting-sources') continue;
    const value = equals >= 0 ? arg.slice(equals + 1) : args[++index];
    if (value === undefined || (equals < 0 && value.startsWith('--'))) {
      throw new Error(`Missing value for ${name}.`);
    }
    if (name === '--settings') {
      if (!value.trim()) throw new Error('Missing value for --settings.');
      settings.push(value);
    } else {
      sources = value.split(',').filter(Boolean);
      if (sources.some((source) => !['user', 'project', 'local'].includes(source))) {
        throw new Error('Invalid --setting-sources. Use user,project,local or an empty value.');
      }
    }
  }
  return { sources: restricted ? [] : sources, settings };
}

/** Find the POSIX local-settings root, including a linked worktree's main checkout. */
function localRoot(cwd, platform, home, env, uid) {
  if (platform === 'win32' || uid === undefined) return cwd;
  const result = spawnSync('git', ['-c', 'core.fsmonitor=false', '-C', cwd, 'worktree', 'list', '--porcelain', '-z'], {
    env: { ...process.env, ...env, GIT_OPTIONAL_LOCKS: '0' },
    encoding: 'utf8', timeout: 2000, maxBuffer: 1024 * 1024, windowsHide: true,
  });
  if (result.error || result.status !== 0) return cwd;
  const main = result.stdout.split('\0\0', 1)[0].split('\0');
  if (!main[0].startsWith('worktree ') || main.includes('bare')) return cwd;
  const root = main[0].slice('worktree '.length);
  try {
    if (realpathSync(root) === realpathSync(home)) return cwd;
    for (const path of [root, join(root, '.git'), join(root, '.claude')]) {
      const stat = lstatSync(path, { throwIfNoEntry: false });
      if (stat && stat.uid !== uid) return cwd;
    }
  } catch {
    return cwd;
  }
  return root;
}

/** Return the documented local managed-settings directory for this platform. */
function managedDirectory(platform, env) {
  if (platform === 'win32') return join(env.ProgramFiles || 'C:\\Program Files', 'ClaudeCode');
  if (platform === 'darwin') return '/Library/Application Support/ClaudeCode';
  return '/etc/claude-code';
}

/** Abort when an enabled local endpoint declaration contradicts the selection. */
export function assertEndpointCompatible({ baseUrl, cwd, args, env = process.env,
  platform = process.platform, home = homedir(), managedDir = managedDirectory(platform, env),
  uid = process.getuid?.() }) {
  const selected = normalizeEndpoint(baseUrl);
  const compare = (values, source) => {
    for (const [key, value] of Object.entries(values || {})) {
      if ((platform === 'win32' ? key.toUpperCase() : key) !== variable) continue;
      if (normalizeEndpoint(value, source) !== selected) {
        throw new Error(`${variable} conflicts with the selected model in ${source}. Resolve the conflict before launching Clauding.`);
      }
    }
  };
  const inspect = (file, required = false) => compare(readSettings(file, required)?.env, file);
  compare(env, 'process environment');
  const { sources, settings } = settingsOptions(args, env);
  const userDir = resolve(cwd, env.CLAUDE_CONFIG_DIR || join(home, '.claude'));
  if (sources.includes('user')) inspect(join(userDir, 'settings.json'));
  if (sources.includes('project')) inspect(join(cwd, '.claude', 'settings.json'));
  if (sources.includes('local')) {
    const roots = new Set([localRoot(cwd, platform, home, env, uid), cwd]);
    for (const root of roots) inspect(join(root, '.claude', 'settings.local.json'));
  }
  for (const value of settings) {
    if (/^[\s\uFEFF]*[\[{]/.test(value)) {
      compare(parseSettings(value, '--settings inline JSON').env, '--settings inline JSON');
    } else {
      inspect(resolve(cwd, value), true);
    }
  }
  inspect(join(managedDir, 'managed-settings.json'));
  const snippets = join(managedDir, 'managed-settings.d');
  if (existsSync(snippets)) {
    let files;
    try {
      files = readdirSync(snippets).filter((file) => !file.startsWith('.') && file.endsWith('.json')).sort();
    } catch {
      throw new Error(`Cannot inspect settings directory ${snippets}.`);
    }
    for (const file of files) inspect(join(snippets, file), true);
  }
}
