"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, FileImage, FileText, ListFilter, LoaderCircle, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { ADMIN_DOCUMENT_BUCKET, buildDocumentPath, DOCUMENT_BUCKET, documentTypes, isAdministrativeDocument, matchesDocumentSearch, sha256ForFile, type DocumentType, validateAdminDocument } from "@/lib/admin-document";
import { mapAdminSystem } from "@/lib/admin-system";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type SystemRow = { system_code: string; clientId: string; clientName: string };
type DocumentRow = {
  id: string | number;
  created_at: string;
  system_id: string;
  document_type: string | null;
  file_url: string;
  description: string | null;
  storage_provider?: string | null;
  original_name?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  administrative?: boolean;
  object_path?: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function AdminDocuments({ fixedSystemCode }: { fixedSystemCode?: string } = {}) {
  const [systems, setSystems] = useState<SystemRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [systemCode, setSystemCode] = useState("");
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [privateReady, setPrivateReady] = useState(false);
  const [opening, setOpening] = useState<string | number | null>(null);
  const [type, setType] = useState<DocumentType>("Reporte");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | number | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const supabase = getSupabaseBrowserClient();
    const result = await supabase.rpc("admin_get_portal_data");
    if (result.error || !result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
      setSystems([]);
      setDocuments([]);
      setMessage({ kind: "error", text: "No fue posible consultar los documentos. Ejecuta la migración 006 y vuelve a iniciar sesión." });
    } else {
      const data = result.data as Record<string, unknown>;
      const allSystems = (Array.isArray(data.systems) ? data.systems : []).flatMap((item) => {
        const system = mapAdminSystem(item as Record<string, unknown>);
        return system ? [{ system_code: system.systemCode, clientId: String(system.client.id), clientName: system.client.fullName }] : [];
      });
      const realSystems = fixedSystemCode ? allSystems.filter((item) => item.system_code === fixedSystemCode) : allSystems;
      const allDocuments = (Array.isArray(data.documents) ? data.documents : []) as DocumentRow[];
      setSystems(realSystems);
      const privateResult = await supabase.from("admin_documents").select("id,created_at,system_id,document_type,description,original_name,file_size_bytes,object_path").order("created_at", { ascending: false });
      setPrivateReady(!privateResult.error);
      const combined = [...allDocuments, ...(privateResult.data || []).map((document: Omit<DocumentRow, "file_url">) => ({ ...document, id: `private:${document.id}`, administrative: true, file_url: "", storage_provider: "Supabase" }))]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      setDocuments(fixedSystemCode ? combined.filter((document) => document.system_id === fixedSystemCode) : combined);
      if (privateResult.error) setMessage({ kind: "error", text: "El archivo administrativo privado no está disponible. Los documentos compartidos siguen disponibles; intenta recargar." });
      setSystemCode(fixedSystemCode || realSystems.find((item) => item.system_code === "FV-0001")?.system_code || realSystems[0]?.system_code || "");
      if (realSystems.length === 0) setMessage({ kind: "error", text: fixedSystemCode ? `No encontramos ${fixedSystemCode} en Supabase.` : "No hay sistemas disponibles para esta cuenta administrativa." });
    }
    setLoading(false);
  }, [fixedSystemCode]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const systemByCode = new Map(systems.map((system) => [system.system_code, system]));
  const clients = Array.from(new Map(systems.map((system) => [system.clientId, system])).values())
    .sort((a, b) => a.clientName.localeCompare(b.clientName, "es"));
  const visibleDocuments = documents.filter((document) => {
    const system = systemByCode.get(document.system_id);
    return (!clientFilter || system?.clientId === clientFilter)
      && (!typeFilter || document.document_type === typeFilter)
      && matchesDocumentSearch(search, system?.clientName, document.system_id, document.document_type, document.original_name, document.description);
  });

  function openUpload(documentType?: DocumentType) {
    if (documentType) setType(documentType);
    if (!fixedSystemCode && clientFilter) {
      setSystemCode(systems.find((system) => system.clientId === clientFilter)?.system_code || "");
    }
    setOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setOpen(false);
    setFile(null);
    setDescription("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!systemCode || !file) {
      setMessage({ kind: "error", text: "Selecciona un sistema y un archivo." });
      return;
    }
    const validationError = validateAdminDocument(file);
    if (validationError) {
      setMessage({ kind: "error", text: validationError });
      return;
    }

    const administrative = isAdministrativeDocument(type);
    if (administrative && !privateReady) {
      setMessage({ kind: "error", text: "El archivo privado aún no está disponible. No se ha subido ningún archivo." });
      return;
    }

    setSaving(true);
    const supabase = getSupabaseBrowserClient();
    const path = buildDocumentPath(systemCode, type, file.name);
    let checksum: string;
    try {
      checksum = await sha256ForFile(file);
    } catch {
      setMessage({ kind: "error", text: "No pudimos verificar la integridad del archivo. Intenta nuevamente." });
      setSaving(false);
      return;
    }
    const bucket = administrative ? ADMIN_DOCUMENT_BUCKET : DOCUMENT_BUCKET;
    const uploadResult = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });

    if (uploadResult.error) {
      setMessage({ kind: "error", text: "No se pudo subir el archivo. Revisa el permiso del bucket en Supabase." });
      setSaving(false);
      return;
    }

    const { data: publicFile } = supabase.storage.from(DOCUMENT_BUCKET).getPublicUrl(path);
    const insertResult = administrative ? await supabase.from("admin_documents").insert({
      system_id: systemCode, document_type: type, description: description.trim() || file.name,
      object_path: path, original_name: file.name, mime_type: file.type,
      file_size_bytes: file.size, checksum_sha256: checksum,
    }) : await supabase.rpc("admin_register_document_v2", {
      p_system_code: systemCode,
      p_document_type: type,
      p_file_url: publicFile.publicUrl,
      p_description: description.trim() || file.name,
      p_storage_provider: "supabase",
      p_bucket_name: DOCUMENT_BUCKET,
      p_object_path: path,
      p_original_name: file.name,
      p_mime_type: file.type,
      p_file_size_bytes: file.size,
      p_checksum_sha256: checksum,
    });

    if (insertResult.error) {
      await supabase.storage.from(bucket).remove([path]);
      setMessage({ kind: "error", text: "El archivo no pudo vincularse al expediente; la carga fue revertida de forma segura." });
      setSaving(false);
      return;
    }

    setSaving(false);
    closeDialog();
    await load();
    setMessage({ kind: "ok", text: administrative ? `Documento guardado en ${systemCode}. Solo visible en administración.` : `Documento publicado en ${systemCode}. Ya está visible para el cliente.` });
  }

  async function openPrivateDocument(document: DocumentRow) {
    setOpening(document.id);
    setMessage(null);
    const result = await getSupabaseBrowserClient().storage.from(ADMIN_DOCUMENT_BUCKET).createSignedUrl(document.object_path || "", 60);
    setOpening(null);
    if (result.error || !result.data?.signedUrl) {
      setMessage({ kind: "error", text: "No pudimos abrir el documento privado. Comprueba tu sesión e intenta nuevamente." });
      return;
    }
    window.location.assign(result.data.signedUrl);
  }

  async function removeDocument(document: DocumentRow) {
    if (deleting !== null) return;
    const name = document.original_name || document.description || "Archivo";
    if (!window.confirm(document.administrative ? `¿Eliminar "${name}" del archivo administrativo de ${document.system_id}? Se eliminarán el archivo digital y su registro. Esta acción no se puede deshacer.` : `¿Eliminar "${name}" del expediente ${document.system_id}?\n\nDejará de aparecer para el cliente. El archivo publicado se eliminará del almacenamiento si no está compartido con otro registro. Los enlaces externos se desvinculan solamente. Esta acción no se puede deshacer. El historial del mantenimiento y las versiones privadas de reportes se conservan.`)) return;
    setDeleting(document.id);
    setMessage(null);
    try {
      const endpoint = document.administrative ? "/api/admin/private-documents" : "/api/admin/documents";
      const id = document.administrative ? String(document.id).replace(/^private:/, "") : document.id;
      const response = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "No fue posible eliminar el archivo.");
      setDocuments(current => current.filter(item => item.id !== document.id));
      setMessage({ kind: "ok", text: `Archivo eliminado del expediente ${document.system_id}.` });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "No se pudo completar la eliminación. Revisa tu conexión e intenta nuevamente." });
    } finally {
      setDeleting(null);
    }
  }

  return <div className="space-y-8">
    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#8A6200]">Archivos reales{fixedSystemCode ? ` · ${fixedSystemCode}` : ""}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.035em] md:text-4xl">Documentos</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">{fixedSystemCode ? `Todo archivo cargado aquí quedará vinculado exclusivamente a ${fixedSystemCode}.` : "Busca por cliente y organiza su expediente. Los convenios, trámites y garantías se guardan solo en administración."}</p></div>
      <button onClick={() => openUpload()} disabled={!systems.length} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-4" />Subir documento</button>
    </div>

    {message && <p role="status" className={`rounded-2xl px-4 py-3 text-sm ${message.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>}

    <section aria-label="Buscar y filtrar documentos" className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><span className="sr-only">Buscar por nombre del cliente o documento</span><Search aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-stone-400" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, sistema o documento" className="h-11 w-full rounded-xl border border-stone-200 pl-10 pr-3 text-sm" /></label>
        <button type="button" aria-expanded={filtersOpen} aria-controls="document-filters" onClick={() => setFiltersOpen(!filtersOpen)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 px-4 text-sm font-semibold"><ListFilter className="size-4" />Filtrar{(clientFilter || typeFilter) ? " · Activo" : ""}</button>
      </div>
      {filtersOpen && <div id="document-filters" className="grid gap-4 sm:grid-cols-2">
        {!fixedSystemCode && <label className="text-sm font-medium">Cliente<select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white px-3"><option value="">Todos los clientes</option>{clients.map((client) => <option key={client.clientId} value={client.clientId}>{client.clientName || "Cliente sin nombre"}</option>)}</select></label>}
        <label className="text-sm font-medium">Tipo de documento<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-white px-3"><option value="">Todos los tipos</option>{Array.from(new Set([...documentTypes, ...documents.map((document) => document.document_type).filter((value): value is string => Boolean(value))])).map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500"><p role="status">{loading ? "Cargando documentos…" : visibleDocuments.length + " de " + documents.length + " documentos"}</p>{(search || clientFilter || typeFilter) && <button type="button" onClick={() => { setSearch(""); setClientFilter(""); setTypeFilter(""); }} className="min-h-11 px-2 font-semibold text-[#8A6200]">Limpiar filtros</button>}</div>
    </section>

    <details className="rounded-2xl border border-stone-200 bg-white px-4 py-3"><summary className="cursor-pointer py-2 text-sm font-semibold">Subir por tipo de documento</summary><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{documentTypes.map((documentType) => <button key={documentType} type="button" onClick={() => openUpload(documentType)} disabled={!systems.length} className="flex min-h-12 items-center gap-2 rounded-xl bg-[#FFF6D9] px-3 py-2 text-left text-sm font-medium text-[#8A6200] hover:bg-[#ffedb3] disabled:opacity-50"><Plus className="size-4 shrink-0" />{documentType}</button>)}</div></details>

    {loading ? <div className="flex min-h-56 items-center justify-center rounded-3xl border border-stone-200 bg-white text-sm text-stone-500"><LoaderCircle className="mr-2 size-5 animate-spin" />Consultando Supabase…</div> : visibleDocuments.length === 0 ? <div className="rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center"><FileText className="mx-auto size-8 text-stone-300" /><h3 className="mt-4 font-semibold">{documents.length ? "No encontramos documentos" : "Aún no hay documentos"}</h3><p className="mt-2 text-sm text-stone-500">{documents.length ? "Prueba con otro nombre o limpia los filtros." : "Sube un archivo para comenzar el expediente digital."}</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleDocuments.map((document) => {
      const image = document.document_type?.toLowerCase().includes("foto");
      const Icon = image ? FileImage : FileText;
      return <article key={document.id} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_12px_35px_rgba(28,25,20,.04)]"><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-[#FFF6D9] text-[#8A6200]"><Icon className="size-5" /></span><span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600">{document.system_id}</span></div><p className="mt-4 text-xs font-medium text-stone-500">{systemByCode.get(document.system_id)?.clientName || "Cliente sin identificar"}</p><p className="mt-1 text-xs text-[#8A6200]">{document.document_type || "Documento"} · {document.administrative ? "Solo administración" : "Compartido con cliente"}</p><h3 className="mt-2 break-words text-sm font-semibold">{document.description || document.document_type || "Documento"}</h3><p className="mt-1 truncate text-xs text-stone-400">{document.original_name || document.document_type || "Archivo"}</p>{document.file_size_bytes ? <p className="mt-1 text-[11px] text-stone-400">{(document.file_size_bytes / 1024 / 1024).toFixed(2)} MB · {document.storage_provider || "Supabase"}</p> : null}<div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4"><time className="text-xs text-stone-500">{formatDate(document.created_at)}</time>{document.administrative ? <button type="button" disabled={opening !== null} onClick={() => void openPrivateDocument(document)} className="flex min-h-11 items-center gap-1 text-xs font-semibold text-[#8a692e] disabled:opacity-50">{opening === document.id ? "Abriendo…" : "Abrir"}<ExternalLink className="size-3" /></button> : <a href={document.file_url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-1 text-xs font-semibold text-[#8a692e]">Abrir <ExternalLink className="size-3" /></a>}</div><button type="button" disabled={deleting !== null} onClick={() => void removeDocument(document)} aria-label={`Eliminar ${document.original_name || document.description || "archivo"} de ${document.system_id}`} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50">{deleting === document.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}{deleting === document.id ? "Eliminando…" : "Eliminar"}</button></article>;
    })}</div>}

    {open && <div role="dialog" aria-modal="true" aria-labelledby="upload-title" className="fixed inset-0 z-[80] grid place-items-center bg-stone-950/45 px-4 py-8 backdrop-blur-sm"><div className="max-h-full w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#8A6200]">Nuevo archivo</p><h3 id="upload-title" className="mt-2 text-2xl font-semibold">{isAdministrativeDocument(type) ? "Guardar documento privado" : "Publicar documento"}</h3></div><button type="button" onClick={closeDialog} aria-label="Cerrar" className="grid size-10 place-items-center rounded-xl bg-stone-100"><X className="size-4" /></button></div><p className="mt-3 text-sm leading-6 text-stone-500">{isAdministrativeDocument(type) ? "Archivo privado: solo administración puede consultarlo. No aparece en el portal ni en el QR del cliente. Conserva el original físico firmado." : "La copia digital se compartirá en el expediente del cliente."}</p><form onSubmit={submit} className="mt-7 space-y-5"><label className="block text-sm font-medium">Cliente / sistema<select required disabled={Boolean(fixedSystemCode)} value={systemCode} onChange={(event) => setSystemCode(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-stone-200 bg-white px-4 disabled:bg-stone-100 disabled:text-stone-600">{systems.map((system) => <option key={system.system_code} value={system.system_code}>{system.clientName} · {system.system_code}</option>)}</select>{fixedSystemCode && <span className="mt-2 block text-xs text-stone-500">Sistema bloqueado para evitar guardar el archivo en otro cliente.</span>}</label><label className="block text-sm font-medium">Tipo<select value={type} onChange={(event) => setType(event.target.value as DocumentType)} className="mt-2 h-12 w-full rounded-xl border border-stone-200 bg-white px-4">{documentTypes.map((item) => <option key={item}>{item}</option>)}</select></label><label className="block text-sm font-medium">Título o descripción<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ej. Convenio firmado · septiembre 2026" className="mt-2 h-12 w-full rounded-xl border border-stone-200 px-4" /></label><label className="block text-sm font-medium">Archivo<input ref={inputRef} required type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border border-dashed border-stone-300 p-4 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-stone-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" /><span className="mt-2 block text-xs text-stone-400">PDF, PNG, JPG o JPEG · máximo 15 MB</span></label>{message?.kind === "error" && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message.text}</p>}<button disabled={saving || (isAdministrativeDocument(type) && !privateReady)} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 font-semibold text-white disabled:opacity-60">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}{saving ? "Guardando…" : isAdministrativeDocument(type) ? `Guardar privado en ${systemCode}` : `Publicar en ${systemCode}`}</button></form></div></div>}
  </div>;
}

