import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const cli = fileURLToPath(new URL('../bin/clauding.js', import.meta.url));

/** Isolate user configuration and capture the actual child launch contract. */
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'clauding-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = join(root, 'home');
  const configDir = join(home, '.clauding');
  const bin = join(root, 'bin');
  const project = join(root, 'project with spaces');
  mkdirSync(configDir, { recursive: true });
  mkdirSync(bin);
  mkdirSync(project);
  const source = `console.log(JSON.stringify({args:process.argv.slice(2),cwd:process.cwd(),url:process.env.ANTHROPIC_BASE_URL,model:process.env.ANTHROPIC_MODEL??null,token:process.env.ANTHROPIC_AUTH_TOKEN,context:process.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS??null,key:process.env.ANTHROPIC_API_KEY??null}));process.exitCode=23;`;
  if (process.platform === 'win32') {
    const packageDir = join(bin, 'node_modules', '@anthropic-ai', 'claude-code');
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(bin, 'claude.cmd'), '@exit /b 91\n');
    writeFileSync(join(packageDir, 'package.json'), '{"bin":{"claude":"fake.cjs"}}');
    writeFileSync(join(packageDir, 'fake.cjs'), source);
  } else {
    writeFileSync(join(bin, 'claude'), '#!/usr/bin/env node\n' + source);
    chmodSync(join(bin, 'claude'), 0o755);
  }
  const env = { ...process.env, HOME: home, USERPROFILE: home, ProgramFiles: join(root, 'program-files'), ANTHROPIC_API_KEY: 'inherited-secret' };
  for (const key of Object.keys(env)) {
    if (['PATH', 'CLAUDE_CODE_MAX_CONTEXT_TOKENS', 'CLAUDE_CONFIG_DIR', 'ANTHROPIC_MODEL', 'ANTHROPIC_BASE_URL'].includes(key.toUpperCase())) delete env[key];
  }
  env.PATH = [bin, dirname(process.execPath)].join(process.platform === 'win32' ? ';' : ':');
  const configPath = join(configDir, 'config.json');
  return {
    env,
    project,
    configPath,
    mcp: join(configDir, 'mcp.json'),
    config: (value) => writeFileSync(configPath, '\uFEFF' + JSON.stringify(value)),
    run: (...args) => spawnSync(process.execPath, [cli, ...args], { env, encoding: 'utf8', timeout: 5000 }),
  };
}

test('legacy BOM config preserves cwd, MCP, literal arguments, and child exit code', (t) => {
  const f = fixture(t);
  f.config({ baseUrl: 'http://localhost:1234/', model: 'legacy', contextTokens: 65536 });
  writeFileSync(f.mcp, '{"mcpServers":{}}');
  const literal = 'a "quoted" prompt & | --select-model';
  const result = f.run(f.project, '--', '-p', literal);
  assert.equal(result.status, 23, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    args: ['--mcp-config', f.mcp, '--model', 'legacy', '-p', literal],
    cwd: f.project, url: 'http://localhost:1234', model: null, token: 'lmstudio', context: '65536', key: null,
  });
});

test('endpoint conflicts abort before the Claude child is started', (t) => {
  const f = fixture(t);
  f.config({ baseUrl: 'http://localhost:1234', model: 'guarded' });
  f.env.ANTHROPIC_BASE_URL = 'http://private:secret@different/?token=never-print';
  const conflict = f.run('--version');
  assert.equal(conflict.status, 1);
  assert.equal(conflict.stdout, '');
  assert.match(conflict.stderr, /ANTHROPIC_BASE_URL.*process environment/);
  assert.equal(conflict.stderr.includes('never-print'), false);
  f.env.ANTHROPIC_BASE_URL = 'http://localhost:1234/';
  assert.equal(f.run('--version').status, 23);
});

test('prompt option values that resemble settings flags are forwarded literally', (t) => {
  const f = fixture(t);
  f.config({ baseUrl: 'http://localhost:1234', model: 'guarded' });
  const literal = '--settings={"env":{"ANTHROPIC_BASE_URL":"http://different"}}';
  for (const flag of ['--append-system-prompt', '--system-prompt']) {
    const result = f.run(flag, literal, '--version');
    assert.equal(result.status, 23, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).args, ['--model', 'guarded', flag, literal, '--version']);
  }
});

test('selected list item supplies its own URL, token and context', (t) => {
  const f = fixture(t);
  f.config({ models: [
    { baseUrl: 'http://localhost:1234', model: 'first', contextTokens: 65536 },
    { baseUrl: 'http://localhost:5678', model: 'second', authToken: 'second-token', contextTokens: 131072 },
  ] });
  const result = f.run('--select-model', '2', f.project, '--', '--version');
  assert.equal(result.status, 23, result.stderr);
  const actual = JSON.parse(result.stdout);
  assert.deepEqual(actual.args, ['--model', 'second', '--version']);
  assert.equal(actual.cwd, f.project);
  assert.equal(actual.url, 'http://localhost:5678');
  assert.equal(actual.token, 'second-token');
  assert.equal(actual.context, '131072');
  assert.equal(actual.key, null);
  assert.equal(f.run('--select-model', 'first', '--version').status, 23);
});

test('an omitted optional value is independent of another entry', (t) => {
  const f = fixture(t);
  f.config({ models: [
    { baseUrl: 'http://localhost:1234', model: 'first', authToken: 'first-token', contextTokens: 65536 },
    { baseUrl: 'http://localhost:5678', model: 'second' },
  ] });
  const actual = JSON.parse(f.run('--select-model', '2').stdout);
  assert.equal(actual.token, 'lmstudio');
  assert.equal(actual.context, null);
});

test('noninteractive multiple entries and bad selectors never launch a child', (t) => {
  const f = fixture(t);
  f.config({ models: [
    { baseUrl: 'http://localhost:1234', model: 'one' },
    { baseUrl: 'http://localhost:5678', model: 'two' },
  ] });
  for (const args of [[], ['--select-model'], ['--select-model', '99'], ['--select-model', 'missing']]) {
    const result = f.run(...args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /clauding:/);
  }
});

test('init keeps an existing wrapped config intact', (t) => {
  const f = fixture(t);
  f.config({ models: [{ baseUrl: 'http://localhost:1234', model: 'one' }] });
  const before = readFileSync(f.configPath);
  assert.equal(f.run('--init').status, 0);
  assert.deepEqual(readFileSync(f.configPath), before);
  assert.equal(f.run('--version').status, 23);
});
