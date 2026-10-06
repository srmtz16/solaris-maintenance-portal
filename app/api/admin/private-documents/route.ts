import { NextResponse } from "next/server";
import { reportAdmin } from "@/lib/service-report-auth";
import { ADMIN_DOCUMENT_BUCKET } from "@/lib/admin-document";

export async function DELETE(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Origen no autorizado." }, { status: 403 });
    const db = await reportAdmin();
    if (!db) return NextResponse.json({ error: "Inicia sesión como administrador." }, { status: 401 });
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "Archivo no válido." }, { status: 400 });
    const found = await db.from("admin_documents").select("id,object_path").eq("id", id).maybeSingle();
    if (found.error) throw new Error("No fue posible consultar el documento privado.");
    if (!found.data) return NextResponse.json({ ok: true });
    const removed = await db.storage.from(ADMIN_DOCUMENT_BUCKET).remove([found.data.object_path]);
    if (removed.error) throw new Error("No pudimos eliminar el archivo. Conservamos su registro para que puedas reintentar.");
    const result = await db.from("admin_documents").delete().eq("id", id).select("id");
    if (result.error || !result.data?.length) throw new Error("El archivo se retiró, pero falta eliminar su registro. Vuelve a pulsar Eliminar para completar la operación.");
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible eliminar el archivo." }, { status: 500 });
  }
}
