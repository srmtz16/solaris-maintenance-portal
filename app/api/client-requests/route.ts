import { NextResponse } from "next/server";
import { validateClientRequest } from "@/lib/client-request";
import { sendRequestNotification } from "@/lib/request-notification";

async function getNotificationContext(supabaseUrl: string, supabaseKey: string, publicToken: string) {
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/get_public_system`, {
      method: "POST",
      headers: { apikey: supabaseKey, "Content-Type": "application/json" },
      body: JSON.stringify({ p_public_token: publicToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const system = await response.json();
    if (!system || typeof system !== "object" || Array.isArray(system)) return null;
    return {
      systemCode: typeof system.id === "string" && system.id.trim() ? system.id.trim() : "Sistema vinculado",
      clientName: typeof system.clientName === "string" && system.clientName.trim() ? system.clientName.trim() : "Cliente vinculado",
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "El servicio aún no está conectado." }, { status: 503 });
  }
  let input: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 12000) return NextResponse.json({ error: "Solicitud demasiado grande." }, { status: 413 });
    input = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const validation = validateClientRequest(input);
  if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });

  try {
    // This restricted function may insert requests, never read customer records.
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/submit_client_request`, {
      method: "POST",
      headers: { apikey: supabaseKey, "Content-Type": "application/json" },
      body: JSON.stringify(validation.payload),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      // Do not log error details: they can contain contact data.
      if (detail.code === "PGRST202") return NextResponse.json({ error: "La recepción de solicitudes aún no está habilitada." }, { status: 503 });
      if (detail.code === "P0001") return NextResponse.json({ error: "Ya recibimos una solicitud reciente para esta vivienda. Espera cinco minutos antes de enviar otra." }, { status: 429 });
      if (detail.code === "22023") return NextResponse.json({ error: "El vínculo de esta vivienda no es válido. Vuelve a escanear el QR." }, { status: 400 });
      return NextResponse.json({ error: "No pudimos guardar la solicitud. Intenta nuevamente." }, { status: 502 });
    }
    const reference = await response.json();
    if (typeof reference !== "string" || !/^[0-9a-f-]{36}$/i.test(reference)) {
      return NextResponse.json({ error: "No se pudo confirmar el envío. Verifica con el equipo antes de reenviar." }, { status: 502 });
    }
    const context = await getNotificationContext(supabaseUrl, supabaseKey, validation.payload.p_public_token);
    await sendRequestNotification({
      reference,
      requestType: validation.payload.p_request_type,
      systemCode: context?.systemCode || "Sistema vinculado",
      clientName: context?.clientName || "Cliente vinculado",
      message: validation.payload.p_message,
      preferredDate: validation.payload.p_preferred_date,
      receivedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, reference }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo confirmar el envío por un problema de conexión. Verifica con el equipo antes de reenviar." }, { status: 502 });
  }
}
