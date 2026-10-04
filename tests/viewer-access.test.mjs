import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '').replace('export async function proxy', 'async function proxy').replace('export const config', 'const config');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const factory = new Function('createServerClient', 'NextResponse', 'process', `${compiled}; return proxy;`);
async function route(role, path, { error = null, configured = true, refresh = false } = {}) {
  const cookies = () => { const values = []; return { getAll: () => values, set: (...args) => values.push(args.length === 1 ? args[0] : { name: args[0], value: args[1] }) }; };
  const proxy = factory((_url, _key, options) => ({ auth: { getUser: async () => {
    if (refresh) options.cookies.setAll([{ name: 'session', value: 'refreshed', options: {} }]);
    return { data: { user: { app_metadata: { role } } }, error };
  } } }), { next: () => ({ allowed: true, cookies: cookies() }), redirect: url => ({ redirect: url.pathname, cookies: cookies() }) }, { env: configured ? { NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test' } : {} });
  const result = await proxy({ url: `https://solaris.test${path}`, nextUrl: new URL(`https://solaris.test${path}`), cookies: { getAll: () => [], set() {} } });
  return { allowed: result.allowed, redirect: result.redirect, cookies: result.cookies.getAll() };
}
test('viewer can read consultation but cannot enter admin screens', async () => {
  assert.equal((await route('viewer', '/consulta')).allowed, true);
  for (const path of ['/admin', '/admin/login', '/admin/documentos', '/admin/clientes/FV-0001']) assert.equal((await route('viewer', path)).redirect, '/consulta');
});
test('current administrator retains access, missing and revoked roles are denied', async () => {
  assert.equal((await route('admin', '/admin/documentos')).allowed, true);
  for (const role of [undefined, 'user', 'authenticated']) assert.equal((await route(role, '/consulta')).redirect, '/admin/login');
  assert.equal((await route('admin', '/admin', { error: new Error('Session revoked') })).redirect, '/admin/login');
});
test('auth refresh cookies survive role redirects', async () => {
  assert.deepEqual((await route('viewer', '/admin', { refresh: true })).cookies, [{ name: 'session', value: 'refreshed' }]);
});
test('missing configuration does not cause login redirect loop; brand icon remains public', async () => {
  assert.equal((await route(undefined, '/admin/login', { configured: false })).allowed, true);
  assert.equal((await route(undefined, '/admin', { configured: false })).redirect, '/admin/login');
  assert.equal((await route(undefined, '/admin/icon.ico', { configured: false })).allowed, true);
});
