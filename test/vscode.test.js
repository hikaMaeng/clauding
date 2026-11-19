import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { vscodeLaunch, vscodeModel } from '../lib/vscode.js';
import { createVSCodeWrapper, setupVSCode } from '../lib/vscode-setup.js';

function fixture(t) {
  const home = mkdtempSync(join(tmpdir(), 'clauding-vscode-'));
  t.after(() => rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 30 }));
  mkdirSync(join(home, '.clauding'));
  writeFileSync(join(home, '.clauding', 'config.json'), JSON.stringify({ baseUrl: 'http://localhost:1234', model: 'local', contextTokens: 65536 }));
  return home;
}

test('VS Code launch preserves native protocol arguments and the original connection', async t => {
  const home = fixture(t);
  writeFileSync(join(home, '.clauding', 'mcp.json'), '{"mcpServers":{}}');
  const ideMcp = '{"mcpServers":{"ide":{"command":"literal & |"}}}';
  const original = { ...process.env, ANTHROPIC_BASE_URL: 'http://original', ANTHROPIC_AUTH_TOKEN: 'original-token', ANTHROPIC_CUSTOM_HEADERS: 'X-Fixture: original' };
  const launch = await vscodeLaunch([process.execPath, '-p', '--model', 'opus', '--input-format', 'stream-json', '--mcp-config', ideMcp], { home, cwd: home, env: original });
  assert.equal(launch.command, process.execPath);
  assert.equal(launch.cwd, home);
  assert.equal(launch.env.ANTHROPIC_BASE_URL, original.ANTHROPIC_BASE_URL);
  assert.equal(launch.env.ANTHROPIC_AUTH_TOKEN, original.ANTHROPIC_AUTH_TOKEN);
  assert.equal(JSON.parse(launch.env.CLAUDING_VSCODE_ORIGINAL_ENV).ANTHROPIC_AUTH_TOKEN, 'original-token');
  assert.equal(JSON.parse(launch.env.CLAUDING_VSCODE_ORIGINAL_ENV).ANTHROPIC_CUSTOM_HEADERS, 'X-Fixture: original');
  assert.deepEqual(launch.args.slice(-2), [join(home, '.clauding', 'mcp.json'), ideMcp]);
  assert.deepEqual(launch.args.slice(2, 7), ['-p', '--model', 'opus', '--input-format', 'stream-json']);
  assert.match(launch.args[1], /mods[\\/]vscode$/);
});

test('VS Code auxiliary commands are forwarded without a picker or Mod flags', async t => {
  const home = fixture(t);
  const launch = await vscodeLaunch([process.execPath, '--version'], { home, cwd: home });
  assert.deepEqual(launch.args, ['--version']);
  await assert.rejects(vscodeLaunch(['missing.exe'], { home }), /absolute Claude executable/);
});

test('the extension SDK stream launch without --print still loads the Mod', async t => {
  const home = fixture(t);
  const launch = await vscodeLaunch([process.execPath, '--input-format', 'stream-json', '--output-format', 'stream-json'], { home, cwd: home });
  assert.equal(launch.args[0], '--plugin-dir');
  assert.match(launch.args[1], /mods[\\/]vscode$/);
});

test('setup changes only official integration keys, preserves account/model settings, and can undo', async t => {
  const home = fixture(t);
  const file = join(home, 'settings.json');
  const before = { 'claudeCode.selectedModel': 'opus', 'claudeCode.initialPermissionMode': 'default', 'editor.fontSize': 17 };
  writeFileSync(file, JSON.stringify(before));
  const result = await setupVSCode([], { home, settingsPath: file });
  const after = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(after['claudeCode.selectedModel'], 'opus');
  assert.equal(after['claudeCode.initialPermissionMode'], 'default');
  assert.equal(after['editor.fontSize'], 17);
  assert.equal(after['claudeCode.claudeProcessWrapper'], result.wrapper);
  assert.equal(after['claudeCode.disableLoginPrompt'], true);
  assert.deepEqual(JSON.parse(readFileSync(join(result.backup, 'settings.json'), 'utf8')), before);
  await setupVSCode(['--off'], { home, settingsPath: file });
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), before);
});

test('multiple models default to the first, support a saved choice, and keep the model configuration intact', async t => {
  const home = fixture(t);
  const config = join(home, '.clauding', 'config.json');
  const models = { models: [{ baseUrl: 'http://localhost:1234', model: 'one' }, { baseUrl: 'http://localhost:5678', model: 'two' }] };
  writeFileSync(config, JSON.stringify(models));
  assert.equal((await vscodeModel(home)).model, 'one');
  await setupVSCode(['--select-model', '2'], { home, settingsPath: join(home, 'settings.json') });
  assert.equal(JSON.parse(readFileSync(join(home, '.clauding', 'vscode.json'), 'utf8')).modelSelector, '2');
  assert.equal((await vscodeModel(home)).model, 'two');
  assert.deepEqual(JSON.parse(readFileSync(config, 'utf8')), models);
});

test('the Windows native adapter preserves literal argv, piped Unicode bytes, stderr, and exit status', { skip: process.platform !== 'win32' }, t => {
  const home = fixture(t);
  const entry = join(home, 'fake child.cjs');
  writeFileSync(entry, `let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>{console.log(JSON.stringify({argv:process.argv.slice(2),input:s}));console.error('stderr-marker');process.exitCode=23;});`);
  const wrapper = createVSCodeWrapper(join(home, 'native'), { entry });
  const args = ['', 'a "quoted" value', 'x & | y', 'trailing\\', '--settings={"x":"a b"}'];
  const result = spawnSync(wrapper, args, { input: '한글\n{"type":"control"}\n', encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 23, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { argv: args, input: '한글\n{"type":"control"}\n' });
  assert.match(result.stderr, /stderr-marker/);
});

test('closing the Windows adapter ends its owned descendants', { skip: process.platform !== 'win32' }, async t => {
  const home = fixture(t);
  const entry = join(home, 'owned-child.cjs');
  writeFileSync(entry, `const child=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});console.log(JSON.stringify({parent:process.pid,child:child.pid}));setInterval(()=>{},1000);`);
  const wrapper = createVSCodeWrapper(join(home, 'native'), { entry });
  const processTree = spawn(wrapper, [], { stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = createInterface({ input: processTree.stdout });
  const [line] = await once(lines, 'line');
  const owned = Object.values(JSON.parse(line));
  t.after(() => { processTree.kill(); for (const pid of owned) { try { process.kill(pid, 'SIGKILL'); } catch {} } });
  const exited = once(processTree, 'exit');
  processTree.kill();
  await exited;
  const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
  for (let count = 0; count < 40 && owned.some(alive); count++) await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(owned.some(alive), false, 'The adapter must not leave its Node/Claude descendants running.');
  lines.close();
});

test('the Windows adapter flushes SDK frames while stdin remains open', { skip: process.platform !== 'win32' }, async t => {
  const home = fixture(t);
  const entry = join(home, 'interactive-child.cjs');
  writeFileSync(entry, `require('node:readline').createInterface({input:process.stdin}).on('line',line=>console.log('echo:'+line));`);
  const wrapper = createVSCodeWrapper(join(home, 'native'), { entry });
  const child = spawn(wrapper, [], { stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  const lines = createInterface({ input: child.stdout });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = once(lines, 'line', { signal: controller.signal });
    child.stdin.write('{"type":"initialize"}\n');
    const [line] = await response;
    assert.equal(line, 'echo:{"type":"initialize"}');
  } finally {
    clearTimeout(timer);
    lines.close();
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
});
