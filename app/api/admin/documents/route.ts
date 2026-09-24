import { NextResponse } from "next/server";
import { reportAdmin } from "@/lib/service-report-auth";
import { DOCUMENT_BUCKET } from "@/lib/admin-document";

export async function DELETE(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Origen no autorizado." }, { status: 403 });
    const db = await reportAdmin();
    if (!db) return NextResponse.json({ error: "Inicia sesión como administrador." }, { status: 401 });
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !/^(?:\d{1,20}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(id)) return NextResponse.json({ error: "Archivo no válido." }, { status: 400 });
    const found = await db.from("Documentos").select("id,file_url,bucket_name,object_path,storage_provider").eq("id", id).maybeSingle();
    if (found.error) throw new Error("No fue posible consultar el archivo. No se eliminó ningún dato.");
    if (!found.data) return NextResponse.json({ ok: true });
    const doc = found.data;
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${DOCUMENT_BUCKET}/`;
    const path = doc.object_path || (doc.file_url?.startsWith(base) ? decodeURIComponent(doc.file_url.slice(base.length)) : null);
    if (path && (!doc.storage_provider || doc.storage_provider === "supabase") && (!doc.bucket_name || doc.bucket_name === DOCUMENT_BUCKET)) {
      if (path.startsWith("/") || path.split("/").some((part: string) => part === ".." || !part)) throw new Error("La ubicación del archivo no es válida. No se eliminó ningún dato.");
      // Shared objects must remain available to other document records.
      const byUrl = await db.from("Documentos").select("id").neq("id", id).eq("file_url", doc.file_url).limit(1);
      const byPath = await db.from("Documentos").select("id").neq("id", id).eq("object_path", path).eq("bucket_name", DOCUMENT_BUCKET).limit(1);
      if (byUrl.error || byPath.error) throw new Error("No pudimos verificar las referencias al archivo. Intenta nuevamente.");
      const shared = Boolean(byUrl.data?.length || byPath.data?.length);
      if (!shared) {
        const removed = await db.storage.from(DOCUMENT_BUCKET).remove([path]);
        if (removed.error) throw new Error("No se pudo eliminar el archivo del almacenamiento. Conservamos su registro; intenta nuevamente.");
      }
    }
    // Keep the record until storage succeeds, so a failed operation can be retried.
    const result = await db.from("Documentos").delete().eq("id", id).select("id");
    if (result.error || !result.data?.length) throw new Error("No se pudo retirar el registro del expediente. El archivo puede haber sido eliminado; vuelve a pulsar Eliminar para completar la operación.");
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible eliminar el archivo. Intenta nuevamente." }, { status: 500 });
  }
}
