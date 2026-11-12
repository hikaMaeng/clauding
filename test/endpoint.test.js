import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { assertEndpointCompatible, normalizeEndpoint } from '../lib/endpoint.js';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'clauding-endpoint-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const options = { baseUrl: 'http://localhost:1234/api', cwd: join(root, 'project'),
    args: [], env: {}, platform: process.platform, home: join(root, 'home'), managedDir: join(root, 'managed') };
  mkdirSync(options.cwd, { recursive: true });
  mkdirSync(options.home, { recursive: true });
  const put = (file, value) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const conflict = { env: { ANTHROPIC_BASE_URL: 'http://username:password@different/api?key=secret' } };
  return { options, put, conflict };
}

function git(cwd, ...args) {
  const result = spawnSync('git', ['-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${join(cwd, 'no-hooks')}`,
    '-C', cwd, ...args], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
}

test('normalization ignores endpoint path trailing slashes and preserves query credentials', () => {
  assert.equal(normalizeEndpoint('http://LOCALHOST:80/api///'), 'http://localhost/api');
  assert.equal(normalizeEndpoint('http://localhost/api/?key=secret/'), 'http://localhost/api?key=secret/');
});

test('process conflicts abort with source and variable only', (t) => {
  const { options, conflict } = fixture(t);
  options.env = conflict.env;
  assert.throws(() => assertEndpointCompatible(options), (error) => {
    assert.match(error.message, /ANTHROPIC_BASE_URL.*process environment/);
    for (const secret of ['username', 'password', 'different', 'secret', '1234']) assert.equal(error.message.includes(secret), false);
    return true;
  });
  options.env.ANTHROPIC_BASE_URL = 'http://localhost:1234/api/';
  assert.doesNotThrow(() => assertEndpointCompatible(options));
});

test('Windows endpoint names are compared without case sensitivity', (t) => {
  const { options, put } = fixture(t);
  options.platform = 'win32';
  options.env = { Anthropic_Base_Url: 'http://different/' };
  assert.throws(() => assertEndpointCompatible(options), /conflicts/);
  options.env = {};
  put(join(options.home, '.claude', 'settings.json'), { env: { anthropic_base_url: 'http://different/' } });
  assert.throws(() => assertEndpointCompatible(options), /conflicts/);
});

test('user, project and local settings are checked when enabled', (t) => {
  const { options, put, conflict } = fixture(t);
  const paths = [join(options.home, '.claude', 'settings.json'),
    join(options.cwd, '.claude', 'settings.json'), join(options.cwd, '.claude', 'settings.local.json')];
  for (const file of paths) {
    put(file, conflict);
    assert.throws(() => assertEndpointCompatible(options), /conflicts/);
    put(file, {});
  }
  put(paths[0], conflict);
  options.args = ['--setting-sources=project,local'];
  assert.doesNotThrow(() => assertEndpointCompatible(options));
  put(paths[1], conflict);
  options.args = ['--setting-sources', ''];
  assert.doesNotThrow(() => assertEndpointCompatible(options));
});

test('custom user config directory is inspected', (t) => {
  const { options, put, conflict } = fixture(t);
  options.env.CLAUDE_CONFIG_DIR = join(options.home, 'custom');
  put(join(options.env.CLAUDE_CONFIG_DIR, 'settings.json'), conflict);
  assert.throws(() => assertEndpointCompatible(options), /conflicts/);
});

test('shared project files and Windows local files come from cwd only', (t) => {
  const { options, put, conflict } = fixture(t);
  git(options.cwd, 'init');
  const repo = options.cwd;
  put(join(repo, '.claude', 'settings.json'), conflict);
  put(join(repo, '.claude', 'settings.local.json'), conflict);
  options.cwd = join(repo, 'nested');
  mkdirSync(options.cwd);
  options.platform = 'win32';
  assert.doesNotThrow(() => assertEndpointCompatible(options));
  options.platform = 'linux';
  options.args = ['--setting-sources=project'];
  assert.doesNotThrow(() => assertEndpointCompatible(options));
  put(join(options.cwd, '.claude', 'settings.json'), conflict);
  assert.throws(() => assertEndpointCompatible(options), /conflicts/);
});

test('POSIX local settings follow the main checkout and keep legacy cwd files', (t) => {
  const { options, put, conflict } = fixture(t);
  git(options.cwd, 'init');
  git(options.cwd, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-m', 'fixture');
  const repo = options.cwd;
  const linked = join(dirname(repo), 'linked');
  git(repo, 'worktree', 'add', '--detach', linked);
  options.platform = 'linux';
  options.uid = lstatSync(repo).uid;
  options.args = ['--setting-sources=local'];
  options.cwd = join(linked, 'nested');
  mkdirSync(options.cwd);
  const mainLocal = join(repo, '.claude', 'settings.local.json');
  put(mainLocal, conflict);
  assert.throws(() => assertEndpointCompatible(options), /conflicts/);
  put(mainLocal, {});
  put(join(options.cwd, '.claude', 'settings.local.json'), conflict);
  assert.throws(() => assertEndpointCompatible(options), /conflicts/);
});

test('POSIX home-root and ownership exceptions keep local settings in cwd', (t) => {
  const { options, put, conflict } = fixture(t);
  git(options.cwd, 'init');
  const repo = options.cwd;
  put(join(repo, '.claude', 'settings.local.json'), conflict);
  options.cwd = join(repo, 'nested');
  mkdirSync(options.cwd);
  options.platform = 'linux';
  options.args = ['--setting-sources=local'];
  options.uid = lstatSync(repo).uid;
  options.home = repo;
  assert.doesNotThrow(() => assertEndpointCompatible(options));
  options.home = dirname(repo);
  options.uid += 1;
  assert.doesNotThrow(() => assertEndpointCompatible(options));
});

test('explicit file, inline JSON and equals settings forms are inspected', (t) => {
  const { options, put, conflict } = fixture(t);
  put(join(options.cwd, 'extra.json'), conflict);
  for (const args of [['--settings', 'extra.json'], ['--settings=extra.json'],
    ['--settings', JSON.stringify(conflict)], ['--settings=' + JSON.stringify(conflict)]]) {
    options.args = args;
    assert.throws(() => assertEndpointCompatible(options), /conflicts/);
  }
  options.args = ['--setting-sources=', '--settings', JSON.stringify(conflict)];
  assert.throws(() => assertEndpointCompatible(options), /conflicts/);
});

test('required option values are not reinterpreted as settings flags', (t) => {
  const { options, conflict } = fixture(t);
  const literal = '--settings=' + JSON.stringify(conflict);
  for (const flag of ['--append-system-prompt', '--system-prompt', '--append-system-prompt-file', '--system-prompt-file', '--model']) {
    options.args = [flag, literal];
    const before = [...options.args];
    assert.doesNotThrow(() => assertEndpointCompatible(options));
    assert.deepEqual(options.args, before);
    options.args = [flag, literal, '--settings', JSON.stringify(conflict)];
    assert.throws(() => assertEndpointCompatible(options), /conflicts/);
  }
});

test('managed files and fragments apply independently of setting sources', (t) => {
  const { options, put, conflict } = fixture(t);
  options.args = ['--setting-sources='];
  const main = join(options.managedDir, 'managed-settings.json');
  put(main, conflict);
  assert.throws(() => assertEndpointCompatible(options), /conflicts/);
  put(main, {});
  put(join(options.managedDir, 'managed-settings.d', 'endpoint.json'), conflict);
  assert.throws(() => assertEndpointCompatible(options), /conflicts/);
});

test('hidden managed fragments are ignored even when malformed or conflicting', (t) => {
  const { options, put, conflict } = fixture(t);
  const snippets = join(options.managedDir, 'managed-settings.d');
  put(join(snippets, '.backup.json'), conflict);
  put(join(snippets, '.broken.json'), '{not JSON');
  put(join(snippets, 'visible.txt'), conflict);
  assert.doesNotThrow(() => assertEndpointCompatible(options));
  put(join(snippets, 'visible.json'), conflict);
  assert.throws(() => assertEndpointCompatible(options), /conflicts/);
});

test('malformed relevant settings fail without parser excerpts', (t) => {
  const { options, put } = fixture(t);
  const file = join(options.cwd, '.claude', 'settings.local.json');
  for (const malformed of ['{"secret":"do-not-print",', { env: null },
    { env: { ANTHROPIC_BASE_URL: 123 } }, { env: { ANTHROPIC_BASE_URL: '' } }]) {
    put(file, malformed);
    assert.throws(() => assertEndpointCompatible(options), (error) => {
      assert.equal(error.message.includes('do-not-print'), false);
      return true;
    });
  }
});
