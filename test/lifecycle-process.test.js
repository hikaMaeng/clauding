import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';

const supervisor = new URL('../lib/lifecycle.js', import.meta.url).href;

test('a parent-only POSIX shutdown waits for and reaps the child',
  { skip: process.platform === 'win32', timeout: 6000 }, async (t) => {
    const code = `process.on('SIGTERM', () => process.exit(37)); console.log(process.pid); setInterval(() => {}, 1000);`;
    const source = `import { spawn } from 'node:child_process';
      import { superviseChild } from ${JSON.stringify(supervisor)};
      const child = spawn(process.execPath, ['-e', ${JSON.stringify(code)}], { stdio: ['ignore', 'inherit', 'inherit'] });
      process.exitCode = await superviseChild(child, { terminal: false });`;
    const parent = spawn(process.execPath, ['--input-type=module', '-e', source], { stdio: ['ignore', 'pipe', 'pipe'] });
    let childPid;
    t.after(() => {
      if (parent.exitCode == null) parent.kill('SIGKILL');
      if (childPid) {
        try { process.kill(childPid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      }
    });
    const [ready] = await once(parent.stdout, 'data');
    childPid = Number(ready.toString().trim());
    assert.ok(childPid > 0);
    const exited = once(parent, 'exit');
    parent.kill('SIGTERM');
    assert.deepEqual(await exited, [37, null]);
    assert.throws(() => process.kill(childPid, 0), { code: 'ESRCH' });
  });
