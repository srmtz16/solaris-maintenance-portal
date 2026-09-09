export type RequestNotificationInput = {
  reference: string;
  requestType: "maintenance" | "failure";
  systemCode: string;
  clientName: string;
  message: string;
  preferredDate: string | null;
  receivedAt: string;
};

type NotificationConfig = {
  apiKey?: string;
  recipient?: string;
  from?: string;
};

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function dateLabel(value: string, includeTime = false) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", includeTime
    ? { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" }
    : { dateStyle: "long", timeZone: "UTC" }).format(date);
}

export function buildRequestNotification(input: RequestNotificationInput) {
  const isMaintenance = input.requestType === "maintenance";
  const requestLabel = isMaintenance ? "Solicitud de mantenimiento" : "Falla reportada";
  const subject = `${isMaintenance ? "Nueva solicitud de mantenimiento" : "Nueva falla reportada"} · ${input.systemCode}`;
  const rows = [
    ["Folio", input.reference],
    ["Sistema", input.systemCode],
    ["Cliente", input.clientName],
    ["Tipo", requestLabel],
    ...(input.preferredDate ? [["Fecha solicitada", dateLabel(input.preferredDate)]] : []),
    ["Recibida", dateLabel(input.receivedAt, true)],
  ];
  const text = [subject, "", ...rows.map(([label, value]) => `${label}: ${value}`), "", "Mensaje:", input.message].join("\n");
  const htmlRows = rows.map(([label, value]) => `<tr><td style="padding:8px 12px;color:#78716c">${escapeHtml(label)}</td><td style="padding:8px 12px;font-weight:600;color:#1c1917">${escapeHtml(value)}</td></tr>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#1c1917"><p style="font-size:12px;letter-spacing:.16em;color:#9b7835;font-weight:700">SOLARIS</p><h1 style="font-size:24px">${escapeHtml(requestLabel)}</h1><table style="width:100%;border-collapse:collapse;background:#faf9f6;border-radius:16px">${htmlRows}</table><h2 style="font-size:16px;margin-top:24px">Mensaje</h2><p style="white-space:pre-wrap;line-height:1.6;background:#f5f5f4;padding:16px;border-radius:12px">${escapeHtml(input.message)}</p></div>`;
  return { subject, text, html };
}

export async function sendRequestNotification(
  input: RequestNotificationInput,
  config: NotificationConfig = {
    apiKey: process.env.RESEND_API_KEY,
    recipient: process.env.ADMIN_NOTIFICATION_EMAIL,
    from: process.env.EMAIL_FROM,
  },
  fetcher: typeof fetch = fetch,
) {
  if (!config.apiKey || !config.recipient) return false;
  const content = buildRequestNotification(input);
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: config.from || "Solaris <onboarding@resend.dev>",
        to: [config.recipient],
        subject: content.subject,
        text: content.text,
        html: content.html,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
