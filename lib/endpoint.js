import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const variable = 'ANTHROPIC_BASE_URL';
const maxSettingsBytes = 2 * 1024 * 1024;

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
function settingsOptions(args) {
  let sources = ['user', 'project', 'local'];
  const settings = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--') break;
    const name = arg.split('=', 1)[0];
    if (name !== '--settings' && name !== '--setting-sources') continue;
    const equals = arg.indexOf('=');
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
  return { sources, settings };
}

/** Locate the nearest Git project without running repository commands. */
function projectRoot(cwd) {
  let current = cwd;
  while (true) {
    if (existsSync(join(current, '.git'))) return current;
    const parent = dirname(current);
    if (parent === current) return cwd;
    current = parent;
  }
}

/** Return the documented local managed-settings directory for this platform. */
function managedDirectory(platform, env) {
  if (platform === 'win32') return join(env.ProgramFiles || 'C:\\Program Files', 'ClaudeCode');
  if (platform === 'darwin') return '/Library/Application Support/ClaudeCode';
  return '/etc/claude-code';
}

/** Abort when an enabled local endpoint declaration contradicts the selection. */
export function assertEndpointCompatible({ baseUrl, cwd, args, env = process.env,
  platform = process.platform, home = homedir(), managedDir = managedDirectory(platform, env) }) {
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
  const { sources, settings } = settingsOptions(args);
  const userDir = resolve(cwd, env.CLAUDE_CONFIG_DIR || join(home, '.claude'));
  if (sources.includes('user')) inspect(join(userDir, 'settings.json'));
  const roots = new Set([projectRoot(cwd), cwd]);
  for (const root of roots) {
    if (sources.includes('project')) inspect(join(root, '.claude', 'settings.json'));
    if (sources.includes('local')) inspect(join(root, '.claude', 'settings.local.json'));
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
      files = readdirSync(snippets).filter((file) => file.endsWith('.json')).sort();
    } catch {
      throw new Error(`Cannot inspect settings directory ${snippets}.`);
    }
    for (const file of files) inspect(join(snippets, file), true);
  }
}
