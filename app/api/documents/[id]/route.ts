import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { documentAccessInput, documentStoragePath } from '@/lib/document-access';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow, noarchive' };
const failure = (status: number) => NextResponse.json({ error: 'El archivo no está disponible para este acceso.' }, { status, headers });

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const input = documentAccessInput((await context.params).id, new URL(request.url).searchParams.get('token'));
  if (!input) return failure(404);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publicKey || !secret) return failure(503);
  try {
    const jar = await cookies();
    const db = createServerClient(url, publicKey, { cookies: {
      getAll: () => jar.getAll(),
      setAll: items => items.forEach(({ name, value, options }) => jar.set(name, value, options)),
    } });
    // Authorization uses the caller's session or exact QR token, never the server key.
    const { data, error } = await db.rpc('get_portal_document', input);
    if (error || !data) return failure(404);
    const path = documentStoragePath(data);
    if (!path) return failure(404);
    const signer = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const signed = await signer.storage.from('system-documents').createSignedUrl(path, 60);
    if (signed.error || !signed.data?.signedUrl) return failure(404);
    const destination = new URL(signed.data.signedUrl);
    if (destination.origin !== new URL(url).origin || !destination.pathname.startsWith('/storage/v1/object/sign/system-documents/')) return failure(502);
    return NextResponse.redirect(destination, { status: 307, headers });
  } catch {
    return failure(502);
  }
}
