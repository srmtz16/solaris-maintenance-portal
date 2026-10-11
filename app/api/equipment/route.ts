import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { reportAdmin } from "@/lib/service-report-auth";
import { readJsonBody } from "@/lib/request-body";
import { EQUIPMENT_PHOTOS_ENABLED, EQUIPMENT_LIMIT, parseEquipmentInput, parseEquipmentService, type EquipmentPortal } from "@/lib/property-equipment";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
function connection(privileged = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = privileged ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error(privileged ? "Falta activar el almacenamiento privado de fotografías en el servidor. Puedes guardar el registro sin fotografía." : "Conexión no configurada.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function context(token: string | null, code: string | null) {
  if (code && !/^FV-\d+$/.test(code)) throw new Error("Propiedad inválida.");
  if (!code && (!token || !uuid.test(token))) throw new Error("Enlace de propiedad inválido.");
  const db = code ? await reportAdmin() : connection();
  if (!db) throw new Error("Inicia sesión como administrador.");
  const result = await db.rpc("equipment_portal", { p_token: code ? null : token, p_system_code: code });
  if (result.error || !result.data) throw new Error("No se pudo consultar Equipos. Comprueba la conexión y que el módulo esté activado.");
  return { db, portal: result.data as EquipmentPortal };
}

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    const { portal } = await context(query.get("token"), query.get("system"));
    const photo = query.get("photo");
    if (photo) {
      const allowed = portal.equipment.some(e => e.photo_path === photo || e.services.some(s => s.photo_path === photo));
      if (!allowed) return NextResponse.json({ error: "Fotografía no disponible." }, { status: 404, headers });
      const signed = await connection(true).storage.from("property-equipment").createSignedUrl(photo, 60);
      if (signed.error) throw new Error("No se pudo abrir la fotografía.");
      return NextResponse.redirect(signed.data.signedUrl, { headers });
    }
    return NextResponse.json(portal, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo abrir Equipos." }, { status: 403, headers });
  }
}

export async function POST(request: Request) {
  const uploaded: string[] = [];
  const uploadState: { storage: ReturnType<typeof connection> | null; commitAttempted: boolean } = { storage: null, commitAttempted: false };
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Origen no autorizado." }, { status: 403, headers });
    const input = await readJsonBody(request, 3_800_000) as Record<string, unknown>;
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Solicitud inválida.");
    const code = typeof input.system === "string" ? input.system : null;
    const token = typeof input.token === "string" ? input.token : null;
    const { db, portal } = await context(token, code);
    if (!code && portal.completed && (input.action === "initialize" || input.action === "skip")) throw new Error("La configuración ya está cerrada. Contacta a SOLARIS para realizar cambios.");
    async function photo(value: unknown, equipmentId: string): Promise<string | null> {
      if (!value) return null;
      if (!EQUIPMENT_PHOTOS_ENABLED) throw new Error("La carga de fotografías aún no está habilitada.");
      if (typeof value !== "string") throw new Error("Fotografía inválida.");
      const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
      if (!match) throw new Error("Usa fotografías JPG, PNG o WebP.");
      const bytes = Buffer.from(match[2], "base64");
      if (!bytes.length || bytes.length > 512_000) throw new Error("La fotografía supera el tamaño permitido.");
      const valid = match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : match[1] === "png" ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP";
      if (!valid) throw new Error("El contenido de la fotografía no es válido.");
      uploadState.storage ??= connection(true);
      const path = `${portal.systemId}/${equipmentId}/${crypto.randomUUID()}.${match[1]}`;
      const result = await uploadState.storage.storage.from("property-equipment").upload(path, bytes, { contentType: `image/${match[1]}`, upsert: false });
      if (result.error) throw new Error("No se pudo guardar la fotografía. Inténtalo nuevamente.");
      uploaded.push(path);
      return path;
    }
    let result;
    if (input.action === "skip" && !code) {
      result = await db.rpc("initialize_property_equipment", { p_token: token, p_equipment: [], p_skip: true });
    } else if (input.action === "initialize" && !code) {
      if (!Array.isArray(input.equipment) || input.equipment.length < 1 || input.equipment.length > EQUIPMENT_LIMIT) throw new Error("Tu Pasaporte incluye hasta 3 equipos. Contacta a SOLARIS para ampliar tus registros.");
      const items = input.equipment.map(item => ({ raw: item, value: parseEquipmentInput(item) }));
      const equipment = [];
      for (const item of items) {
        const id = crypto.randomUUID();
        equipment.push({ ...item.value, id, photo_path: await photo(item.raw.photo, id) });
      }
      uploadState.commitAttempted = true;
      result = await db.rpc("initialize_property_equipment", { p_token: token, p_equipment: equipment, p_skip: false });
    } else if (input.action === "save" && code) {
      const raw = input.equipment as Record<string, unknown>;
      const value = parseEquipmentInput(raw);
      const id = typeof raw.id === "string" && uuid.test(raw.id) ? raw.id : crypto.randomUUID();
      const previous = portal.equipment.find(e => e.id === id);
      if (raw.id && !previous) throw new Error("Equipo ajeno a esta propiedad.");
      const photoPath = await photo(raw.photo, id) || previous?.photo_path || null;
      uploadState.commitAttempted = true;
      result = await db.rpc("admin_save_property_equipment", { p_system_code: code, p_equipment: { ...value, id, photo_path: photoPath } });
    } else if (input.action === "service") {
      const equipmentId = String(input.equipmentId || "");
      if (!portal.equipment.some(e => e.id === equipmentId)) throw new Error("Equipo ajeno a esta propiedad.");
      const raw = input.service as Record<string, unknown>;
      const value = parseEquipmentService(raw);
      if (typeof raw.id !== "string" || !uuid.test(raw.id)) throw new Error("Identificador de registro inválido.");
      if (portal.equipment.some(e => e.services.some(s => s.id === raw.id))) return NextResponse.json({ ok: true }, { headers });
      const record = { ...value, id: raw.id, photo_path: await photo(raw.photo, equipmentId) };
      uploadState.commitAttempted = true;
      result = code
        ? await db.rpc("admin_record_equipment_service", { p_system_code: code, p_equipment_id: equipmentId, p_service: record })
        : await db.rpc("record_property_equipment_service", { p_token: token, p_equipment_id: equipmentId, p_service: record });
      if (!code && !result.error && !result.data?.ok) { uploadState.commitAttempted = false; throw new Error(result.data?.error || "No se pudo autorizar el registro."); }
    } else throw new Error("Operación no permitida.");
    if (result.error && /^[0-9A-Z]{5}$/.test(result.error.code)) uploadState.commitAttempted = false;
    if (result.error) throw new Error(result.error.code === "42501" ? "La configuración ya está cerrada o no tienes permiso para modificarla." : "No se confirmó el guardado. Actualiza la sección antes de reintentar.");
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    // A network failure may occur after commit. Never remove potentially linked images.
    if (uploaded.length && uploadState.storage && !uploadState.commitAttempted) await uploadState.storage.storage.from("property-equipment").remove(uploaded);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo guardar." }, { status: 400, headers });
  }
}
