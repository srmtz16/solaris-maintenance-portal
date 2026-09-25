import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export async function proxy', 'async function proxy').replace('export const config', 'const config');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const factory = new Function('createServerClient', 'NextResponse', 'process', `${compiled}; return proxy;`);
async function route(role, path) {
  const proxy = factory(() => ({ auth: { getClaims: async () => ({ data: { claims: { app_metadata: { role } } } }) } }), { next: () => ({ allowed: true }), redirect: url => ({ redirect: url.pathname }) }, { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test' } });
  return proxy({ url: `https://solaris.test${path}`, nextUrl: new URL(`https://solaris.test${path}`), cookies: { getAll: () => [], set() {} } });
}
test('viewer can read consultation and is redirected away from every admin screen', async () => {
  assert.deepEqual(await route('viewer', '/consulta'), { allowed: true });
  for (const path of ['/admin', '/admin/login', '/admin/documentos', '/admin/clientes/FV-0001']) assert.deepEqual(await route('viewer', path), { redirect: '/consulta' });
});
test('administrator access is preserved and unknown users cannot access consultation', async () => {
  assert.deepEqual(await route('admin', '/admin/documentos'), { allowed: true });
  assert.deepEqual(await route('admin', '/consulta'), { allowed: true });
  for (const role of [undefined, 'user', 'authenticated']) assert.deepEqual(await route(role, '/consulta'), { redirect: '/admin/login' });
});
