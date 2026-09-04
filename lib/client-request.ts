export type ClientRequestPayload = {
  p_public_token: string;
  p_request_type: "maintenance" | "failure";
  p_message: string;
  p_preferred_date: string | null;
};

type Validation = { payload: ClientRequestPayload } | { error: string };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateClientRequest(input: unknown): Validation {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Solicitud inválida." };
  const body = input as Record<string, unknown>;
  for (const field of ["portalKey", "requestType", "message", "preferredDate", "website"]) {
    if (body[field] !== undefined && body[field] !== null && typeof body[field] !== "string") return { error: "Solicitud inválida." };
  }
  const value = (field: string) => typeof body[field] === "string" ? body[field].trim() : "";
  const portalKey = value("portalKey");
  const requestType = value("requestType");
  const message = value("message");
  const preferredDate = value("preferredDate");
  if (value("website")) return { error: "No se pudo validar el envío." };
  if (!uuidPattern.test(portalKey)) return { error: "El vínculo de esta vivienda no es válido. Vuelve a escanear el QR." };
  if (!["maintenance", "failure"].includes(requestType)) return { error: "Tipo de solicitud inválido." };
  if (message.length < 5 || message.length > 1500) return { error: "El mensaje debe contener entre 5 y 1,500 caracteres." };
  if (preferredDate) {
    const parsed = new Date(`${preferredDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== preferredDate) return { error: "La fecha preferida no es válida." };
    if (requestType !== "maintenance") return { error: "La fecha preferida solo aplica a mantenimientos." };
  }
  return { payload: {
    p_public_token: portalKey,
    p_request_type: requestType as ClientRequestPayload["p_request_type"],
    p_message: message,
    p_preferred_date: preferredDate || null,
  } };
}
