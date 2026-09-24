import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../app/api/admin/documents/route.ts', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export async function DELETE', 'async function DELETE');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const handler = new Function('NextResponse', 'reportAdmin', 'DOCUMENT_BUCKET', `${compiled}; return DELETE;`);
function setup({ admin = true, storageError = false, rowError = false, shared = false, found = true } = {}) {
  const calls = [];
  const db = {
    from() {
      let deleting = false;
      const query = {
        select() { return deleting ? Promise.resolve({ data: rowError ? null : [{ id: 1 }], error: rowError }) : query; },
        eq() { return query; }, neq() { return query; },
        limit() { return Promise.resolve({ data: shared ? [{ id: 2 }] : [], error: null }); },
        maybeSingle() { return Promise.resolve({ data: found ? { id: 1, file_url: 'https://example.test/file', object_path: 'FV-0001/photos/a.jpg', bucket_name: 'system-documents', storage_provider: 'supabase' } : null, error: null }); },
        delete() { calls.push('record'); deleting = true; return query; },
      };
      return query;
    },
    storage: { from() { return { async remove(paths) { calls.push(['storage', ...paths]); return { error: storageError }; } }; } },
  };
  return { calls, run: handler(Response, async () => admin ? db : null, 'system-documents') };
}
const request = (origin = 'https://solaris.test', id = '1') => new Request(`https://solaris.test/api/admin/documents?id=${id}`, { method: 'DELETE', headers: { origin } });
test('rejects unauthenticated, cross-origin and malformed deletion requests', async () => {
  for (const [options, req, status] of [[{ admin: false }, request(), 401], [{}, request('https://other.test'), 403], [{}, request(undefined, 'all'), 400]]) {
    const { run, calls } = setup(options);
    assert.equal((await run(req)).status, status);
    assert.deepEqual(calls, []);
  }
});
test('removes storage before record and retains retry target on storage failure', async () => {
  const good = setup();
  assert.equal((await good.run(request())).status, 200);
  assert.deepEqual(good.calls, [['storage', 'FV-0001/photos/a.jpg'], 'record']);
  const failure = setup({ storageError: true });
  assert.equal((await failure.run(request())).status, 500);
  assert.equal(failure.calls.length, 1);
});
test('preserves shared objects and treats already removed records as success', async () => {
  const shared = setup({ shared: true });
  assert.equal((await shared.run(request())).status, 200);
  assert.deepEqual(shared.calls, ['record']);
  const absent = setup({ found: false });
  assert.equal((await absent.run(request())).status, 200);
  assert.deepEqual(absent.calls, []);
});
test('reports partial failure instead of claiming deletion completed', async () => {
  const { run } = setup({ rowError: true });
  const response = await run(request());
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /vuelve a pulsar Eliminar/);
});
