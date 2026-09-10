"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, FileImage, FileText, LoaderCircle, Plus, Upload, X } from "lucide-react";
import { buildDocumentPath, DOCUMENT_BUCKET, documentTypes, type DocumentType, validateAdminDocument } from "@/lib/admin-document";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type SystemRow = { system_code: string };
type DocumentRow = {
  id: string | number;
  created_at: string;
  system_id: string;
  document_type: string | null;
  file_url: string;
  description: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function AdminDocuments({ fixedSystemCode }: { fixedSystemCode?: string } = {}) {
  const [systems, setSystems] = useState<SystemRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [systemCode, setSystemCode] = useState("");
  const [type, setType] = useState<DocumentType>("Reporte");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      const allSystems = (Array.isArray(data.systems) ? data.systems : []).map((item) => ({ system_code: String((item as Record<string, unknown>).system_code || "") })).filter((item) => item.system_code) as SystemRow[];
      const realSystems = fixedSystemCode ? allSystems.filter((item) => item.system_code === fixedSystemCode) : allSystems;
      const allDocuments = (Array.isArray(data.documents) ? data.documents : []) as DocumentRow[];
      setSystems(realSystems);
      setDocuments(fixedSystemCode ? allDocuments.filter((document) => document.system_id === fixedSystemCode) : allDocuments);
      setSystemCode(fixedSystemCode || realSystems.find((item) => item.system_code === "FV-0001")?.system_code || realSystems[0]?.system_code || "");
      if (realSystems.length === 0) setMessage({ kind: "error", text: fixedSystemCode ? `No encontramos ${fixedSystemCode} en Supabase.` : "No hay sistemas disponibles para esta cuenta administrativa." });
    }
    setLoading(false);
  }, [fixedSystemCode]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

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

    setSaving(true);
    const supabase = getSupabaseBrowserClient();
    const path = buildDocumentPath(systemCode, type, file.name);
    const uploadResult = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file, { contentType: file.type, upsert: false });

    if (uploadResult.error) {
      setMessage({ kind: "error", text: "No se pudo subir el archivo. Revisa el permiso del bucket en Supabase." });
      setSaving(false);
      return;
    }

    const { data: publicFile } = supabase.storage.from(DOCUMENT_BUCKET).getPublicUrl(path);
    const insertResult = await supabase.rpc("admin_register_document", {
      p_system_code: systemCode,
      p_document_type: type,
      p_file_url: publicFile.publicUrl,
      p_description: description.trim() || file.name,
    });

    if (insertResult.error) {
      await supabase.storage.from(DOCUMENT_BUCKET).remove([path]);
      setMessage({ kind: "error", text: "El archivo no pudo vincularse al expediente; la carga fue revertida de forma segura." });
      setSaving(false);
      return;
    }

    setSaving(false);
    closeDialog();
    await load();
    setMessage({ kind: "ok", text: `Documento publicado en ${systemCode}. Ya está visible para el cliente.` });
  }

  return <div className="space-y-8">
    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#9b7835]">Archivos reales{fixedSystemCode ? ` · ${fixedSystemCode}` : ""}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.035em] md:text-4xl">Documentos</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">{fixedSystemCode ? `Todo archivo cargado aquí quedará vinculado exclusivamente a ${fixedSystemCode}.` : "Sube diagramas, reportes y fotografías al expediente correcto. El cliente los verá inmediatamente desde su mismo QR."}</p></div>
      <button onClick={() => setOpen(true)} disabled={!systems.length} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-4" />Subir documento</button>
    </div>

    {message && <p role="status" className={`rounded-2xl px-4 py-3 text-sm ${message.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>}

    <div className="grid gap-4 sm:grid-cols-3">{documentTypes.map((documentType) => { const PhotoIcon = documentType === "Fotografías" ? FileImage : FileText; return <button key={documentType} onClick={() => { setType(documentType); setOpen(true); }} disabled={!systems.length} className="group flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 text-left transition hover:border-[#c6a75f] hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f4efe4] text-[#9b7835]"><PhotoIcon className="size-5" /></span><span><span className="block text-sm font-semibold">{documentType}</span><span className="mt-1 block text-xs text-stone-500">Seleccionar archivo</span></span></button>; })}</div>

    {loading ? <div className="flex min-h-56 items-center justify-center rounded-3xl border border-stone-200 bg-white text-sm text-stone-500"><LoaderCircle className="mr-2 size-5 animate-spin" />Consultando Supabase…</div> : documents.length === 0 ? <div className="rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center"><FileText className="mx-auto size-8 text-stone-300" /><h3 className="mt-4 font-semibold">Aún no hay documentos</h3><p className="mt-2 text-sm text-stone-500">Sube el primer archivo para {systemCode || "un sistema"}.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{documents.map((document) => {
      const image = document.document_type?.toLowerCase().includes("foto");
      const Icon = image ? FileImage : FileText;
      return <article key={document.id} className="rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_12px_35px_rgba(28,25,20,.04)]"><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-2xl bg-[#f4efe4] text-[#9b7835]"><Icon className="size-5" /></span><span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600">{document.system_id}</span></div><h3 className="mt-5 text-sm font-semibold">{document.description || document.document_type || "Documento"}</h3><p className="mt-1 text-xs text-stone-400">{document.document_type || "Archivo"}</p><div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4"><time className="text-xs text-stone-500">{formatDate(document.created_at)}</time><a href={document.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-semibold text-[#8a692e]">Abrir <ExternalLink className="size-3" /></a></div></article>;
    })}</div>}

    {open && <div role="dialog" aria-modal="true" aria-labelledby="upload-title" className="fixed inset-0 z-[80] grid place-items-center bg-stone-950/45 px-4 py-8 backdrop-blur-sm"><div className="max-h-full w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#9b7835]">Nuevo archivo</p><h3 id="upload-title" className="mt-2 text-2xl font-semibold">Publicar documento</h3></div><button type="button" onClick={closeDialog} aria-label="Cerrar" className="grid size-10 place-items-center rounded-xl bg-stone-100"><X className="size-4" /></button></div><form onSubmit={submit} className="mt-7 space-y-5"><label className="block text-sm font-medium">Sistema<select required disabled={Boolean(fixedSystemCode)} value={systemCode} onChange={(event) => setSystemCode(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-stone-200 bg-white px-4 disabled:bg-stone-100 disabled:text-stone-600">{systems.map((system) => <option key={system.system_code}>{system.system_code}</option>)}</select>{fixedSystemCode && <span className="mt-2 block text-xs text-stone-500">Sistema bloqueado para evitar guardar el archivo en otro cliente.</span>}</label><label className="block text-sm font-medium">Tipo<select value={type} onChange={(event) => setType(event.target.value as DocumentType)} className="mt-2 h-12 w-full rounded-xl border border-stone-200 bg-white px-4">{documentTypes.map((item) => <option key={item}>{item}</option>)}</select></label><label className="block text-sm font-medium">Título o descripción<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ej. Diagrama unifilar final" className="mt-2 h-12 w-full rounded-xl border border-stone-200 px-4" /></label><label className="block text-sm font-medium">Archivo<input ref={inputRef} required type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border border-dashed border-stone-300 p-4 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-stone-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" /><span className="mt-2 block text-xs text-stone-400">PDF, PNG, JPG o JPEG · máximo 15 MB</span></label>{message?.kind === "error" && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message.text}</p>}<button disabled={saving} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 font-semibold text-white disabled:opacity-60">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}{saving ? "Publicando…" : `Publicar en ${systemCode}`}</button></form></div></div>}
  </div>;
}
