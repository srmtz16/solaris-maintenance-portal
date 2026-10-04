const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function documentAccessInput(id: string, token: string | null) {
  if (!/^[1-9][0-9]{0,18}$/.test(id) || (token !== null && !uuid.test(token))) return null;
  return { p_document_id: id, p_public_token: token };
}

export function documentStoragePath(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.bucket !== 'system-documents' || typeof row.path !== 'string') return null;
  const path = row.path;
  if (path.length > 1024 || !path || /[\\\x00-\x1f?#]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) return null;
  return path;
}

export function isPortalDocumentUrl(value: unknown): value is string {
  return typeof value === 'string' && /^\/api\/documents\/[1-9][0-9]{0,18}(?:\?token=[0-9a-f-]{36})?$/i.test(value);
}
