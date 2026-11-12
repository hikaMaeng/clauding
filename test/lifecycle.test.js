import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { superviseChild } from '../lib/lifecycle.js';

function fixture() {
  const child = new EventEmitter();
  const parent = new EventEmitter();
  parent.stderr = { write() {} };
  child.signals = [];
  child.kill = (signal) => { child.signals.push(signal); return true; };
  return { child, parent };
}

test('normal child exit code is preserved and handlers are removed', async () => {
  const { child, parent } = fixture();
  const result = superviseChild(child, { parent });
  child.emit('exit', 23, null);
  assert.equal(await result, 23);
  assert.equal(parent.listenerCount('SIGTERM'), 0);
  assert.equal(parent.listenerCount('SIGHUP'), 0);
  assert.equal(parent.listenerCount('SIGINT'), 0);
});

test('shutdown forwards the signal and waits for child exit', async () => {
  for (const signal of ['SIGTERM', 'SIGHUP', 'SIGINT']) {
    const { child, parent } = fixture();
    let completed = false;
    const result = superviseChild(child, { parent, terminal: false });
    result.then(() => { completed = true; });
    parent.emit(signal);
    await Promise.resolve();
    assert.equal(completed, false);
    assert.deepEqual(child.signals, [signal]);
    child.emit('exit', 12, null);
    assert.equal(await result, 12);
  }
});

test('a signal-ignoring child is force-killed after the grace period', async () => {
  const { child, parent } = fixture();
  const result = superviseChild(child, { parent, terminal: false, graceMs: 10 });
  parent.emit('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(child.signals, ['SIGTERM', 'SIGKILL']);
  child.emit('exit', null, 'SIGKILL');
  assert.equal(await result, 137);
});

test('terminal Ctrl+C does not send a duplicate signal or force a cancellation exit', async () => {
  const { child, parent } = fixture();
  const result = superviseChild(child, { parent, terminal: true, graceMs: 10 });
  parent.emit('SIGINT');
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(child.signals, []);
  child.emit('exit', 0, null);
  assert.equal(await result, 0);
});

test('spawn errors remove signal handlers and reject', async () => {
  const { child, parent } = fixture();
  const result = superviseChild(child, { parent });
  child.emit('error', new Error('spawn failed'));
  await assert.rejects(result, /spawn failed/);
  assert.equal(parent.listenerCount('SIGTERM'), 0);
});
