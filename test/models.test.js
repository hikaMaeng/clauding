import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { selectModel } from '../lib/models.js';

const first = { baseUrl: 'http://localhost:1234', model: 'first', contextTokens: 65536 };
const second = { baseUrl: 'http://localhost:5678', model: 'second', authToken: 'private-token' };

test('legacy and one-item wrapped configs select without a terminal', async () => {
  assert.equal(await selectModel(first, 'config.json'), first);
  assert.equal(await selectModel({ models: [first] }, 'config.json'), first);
});

test('explicit selectors resolve index and unique ID', async () => {
  const config = { models: [first, second] };
  assert.equal(await selectModel(config, 'config.json', '2'), second);
  assert.equal(await selectModel(config, 'config.json', 'first'), first);
  await assert.rejects(selectModel(config, 'config.json', '0'), /between 1 and 2/);
  await assert.rejects(selectModel(config, 'config.json', '3'), /between 1 and 2/);
  await assert.rejects(selectModel(config, 'config.json', 'missing'), /Unknown model/);
  await assert.rejects(selectModel({ models: [first, first] }, 'config.json', 'first'), /more than once/);
});

test('malformed models and entries fail before selection', async () => {
  for (const models of [null, {}, [], 'first']) {
    await assert.rejects(selectModel({ models }, 'config.json', '1'), /non-empty array/);
  }
  await assert.rejects(selectModel({ models: [first, { model: 'bad' }] }, 'config.json', '1'), /models\[1\]/);
  await assert.rejects(selectModel({ models: [first, { ...second, contextTokens: 0 }] }, 'config.json', '1'), /contextTokens/);
});

test('multiple configs require selection outside a terminal', async () => {
  await assert.rejects(selectModel({ models: [first, second] }, 'config.json', undefined,
    new PassThrough(), new PassThrough()), /Use --select-model/);
});

function terminal() {
  const input = new PassThrough();
  const output = new PassThrough();
  input.isTTY = true;
  output.isTTY = true;
  let text = '';
  output.on('data', (chunk) => { text += chunk.toString(); });
  return { input, output, text: () => text };
}

test('interactive picker selects a model and hides credential-bearing fields', async () => {
  const io = terminal();
  const secret = { ...second, baseUrl: 'https://user:password@localhost:5678/api?token=query-secret#fragment-secret' };
  const selected = selectModel({ models: [first, secret] }, 'config.json', undefined, io.input, io.output);
  io.input.write('2\r');
  assert.equal(await selected, secret);
  assert.match(io.text(), /second @ https:\/\/localhost:5678\/api/);
  for (const value of ['password', 'query-secret', 'fragment-secret', 'private-token']) {
    assert.equal(io.text().includes(value), false);
  }
});

test('interactive default uses first model and invalid input fails', async () => {
  const config = { models: [first, second] };
  const defaults = terminal();
  const selected = selectModel(config, 'config.json', undefined, defaults.input, defaults.output);
  defaults.input.write('\r');
  assert.equal(await selected, first);
  const invalid = terminal();
  const rejected = selectModel(config, 'config.json', undefined, invalid.input, invalid.output);
  invalid.input.write('99\r');
  await assert.rejects(rejected, /between 1 and 2/);
});

test('EOF and Ctrl+C cancel interactive selection', async () => {
  for (const action of ['eof', 'interrupt']) {
    const io = terminal();
    const selected = selectModel({ models: [first, second] }, 'config.json', undefined, io.input, io.output);
    if (action === 'eof') io.input.end();
    else io.input.write('\u0003');
    await assert.rejects(selected, /cancelled/);
  }
});
