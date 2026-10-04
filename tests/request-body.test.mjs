import test from 'node:test';
import assert from 'node:assert/strict';
import { readJsonBody } from '../lib/request-body.ts';
const request = body => new Request('https://solaris.test', { method: 'POST', body });
test('valid Unicode JSON is preserved, malformed and missing bodies rejected', async () => {
  assert.deepEqual(await readJsonBody(request('{"zona":"Mérida ☀"}'), 100), { zona: 'Mérida ☀' });
  for (const body of ['', '{', null]) await assert.rejects(readJsonBody(request(body), 100), { status: 400 });
});
test('oversized streaming bodies are cancelled without consuming remaining chunks', async () => {
  let cancelled = false;
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(30)); }, cancel() { cancelled = true; } });
  await assert.rejects(readJsonBody(new Request('https://solaris.test', { method: 'POST', body, duplex: 'half' }), 20), { status: 413 });
  assert.equal(cancelled, true);
});
test('size is counted as bytes, and dishonest Content-Length cannot bypass the limit', async () => {
  await assert.rejects(readJsonBody(request('"ééé"'), 6), { status: 413 });
  await assert.rejects(readJsonBody(new Request('https://solaris.test', { method: 'POST', body: '123456', headers: { 'Content-Length': '1' } }), 5), { status: 413 });
});
