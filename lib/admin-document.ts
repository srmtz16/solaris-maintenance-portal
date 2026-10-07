export const DOCUMENT_BUCKET = "system-documents";
export const ADMIN_DOCUMENT_BUCKET = "admin-documents";
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

export const documentTypes = ["Diagrama unifilar", "Reporte", "Fotografías", "Convenio de interconexión", "Contrato de contraprestación", "Acuse de trámite CFE", "Garantía", "Otro documento"] as const;
export type DocumentType = (typeof documentTypes)[number];

export function isAdministrativeDocument(type: string) {
  return documentTypes.slice(3).some((category) => category === type);
}

export function normalizeDocumentSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-MX").trim();
}

export function matchesDocumentSearch(query: string, ...fields: (string | null | undefined)[]) {
  const haystack = normalizeDocumentSearch(fields.filter(Boolean).join(" "));
  return normalizeDocumentSearch(query).split(/\s+/).every((word) => haystack.includes(word));
}

const allowedMimeTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);

export function validateAdminDocument(file: Pick<File, "size" | "type">) {
  if (!allowedMimeTypes.has(file.type)) {
    return "Solo puedes subir archivos PDF, PNG, JPG o JPEG.";
  }
  if (file.size <= 0) return "El archivo está vacío.";
  if (file.size > MAX_DOCUMENT_BYTES) return "El archivo supera el límite de 15 MB.";
  return null;
}

export function buildDocumentPath(systemCode: string, type: DocumentType, fileName: string, id = crypto.randomUUID()) {
  const extension = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const category = type.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const safeSystem = systemCode.replace(/[^a-zA-Z0-9-]/g, "");
  return `${safeSystem}/${category}/${id}.${extension}`;
}

export async function sha256ForFile(file: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
