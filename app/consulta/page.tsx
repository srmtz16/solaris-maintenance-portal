"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, ExternalLink, LoaderCircle, LogOut, RefreshCw } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { installedPower, mapAdminSystem, type AdminSystem } from "@/lib/admin-system";

type Row = Record<string, string | number | null>;
const date = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value)) : "Sin registro";
const safeUrl = (value: unknown) => typeof value === "string" && /^https?:\/\//i.test(value) ? value : undefined;

export default function ConsultationPage() {
  const router = useRouter();
  const [systems, setSystems] = useState<AdminSystem[]>([]);
  const [rows, setRows] = useState<{ documents: Row[]; maintenance: Row[]; requests: Row[]; systems: Row[] }>({ documents: [], maintenance: [], requests: [], systems: [] });
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const db = getSupabaseBrowserClient();
      const result = await db.rpc("viewer_get_portal_data");
      if (result.error || !result.data) throw new Error("No pudimos consultar la información. Revisa tu sesión e intenta nuevamente.");
      const data = result.data;
      const mapped = (data.systems || []).map(mapAdminSystem).filter(Boolean) as AdminSystem[];
      setSystems(mapped);
      setRows({ systems: data.systems || [], documents: data.documents || [], maintenance: data.maintenance || [], requests: data.requests || [] });
      setSelected(current => mapped.some(s => s.systemCode === current) ? current : mapped[0]?.systemCode || "");
    } catch (caught) {
      setSystems([]); setRows({ systems: [], documents: [], maintenance: [], requests: [] });
      setError(caught instanceof Error ? caught.message : "No se pudo consultar el portal.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  async function logout() {
    const { error } = await getSupabaseBrowserClient().auth.signOut();
    if (error) { setError("No pudimos cerrar la sesión. Intenta nuevamente."); return; }
    router.replace("/admin/login"); router.refresh();
  }
  const system = systems.find(s => s.systemCode === selected);
  const docs = rows.documents.filter(d => d.system_id === selected);
  const history = rows.maintenance.filter(m => m.system_id === selected);
  const requests = rows.requests.filter(r => r.system_id === selected);
  const filtered = systems.filter(s => `${s.systemCode} ${s.client.fullName}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
  const panel = "rounded-2xl border border-stone-200 bg-white p-5 sm:p-6";
  return <div className="min-h-screen bg-[#F5F7FA] text-[#0B1F2A]">
    <header className="bg-[#0B1F2A] px-5 py-5 text-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4"><div><p className="font-semibold tracking-[.2em]">SOLARIS</p><p className="mt-1 flex items-center gap-2 text-sm text-[#F4B400]"><Eye size={16} />Acceso de solo lectura</p></div><div className="flex gap-3"><button disabled={loading} onClick={() => void load()} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-3 text-sm disabled:opacity-50"><RefreshCw size={16} />Actualizar</button><button onClick={() => void logout()} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-3 text-sm"><LogOut size={16} />Salir</button></div></div></header>
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-8"><div><h1 className="text-3xl font-semibold">Consulta de expedientes</h1><p className="mt-2 text-sm text-stone-600">Clientes, sistemas, mantenimientos y archivos publicados. Esta cuenta no permite modificar información.</p></div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {loading ? <p role="status" className="flex items-center gap-2 py-12"><LoaderCircle className="animate-spin" size={20} />Consultando información…</p> : <>
        <section className={panel} aria-label="Seleccionar expediente"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Buscar cliente o sistema<input value={search} onChange={e => setSearch(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 px-3" placeholder="Nombre o FV-0001" /></label><label className="text-sm font-medium">Expediente<select value={selected} onChange={e => setSelected(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3"><option value="">Selecciona un sistema</option>{filtered.map(s => <option key={s.id} value={s.systemCode}>{s.systemCode} · {s.client.fullName}</option>)}</select></label></div>{filtered.length === 0 && <p className="mt-4 text-sm text-stone-500">No hay expedientes que coincidan.</p>}</section>
        {system && <>
          <section className={panel}><div className="flex flex-wrap justify-between gap-3"><h2 className="text-xl font-semibold">{system.systemCode} · {system.client.fullName}</h2><span className="text-sm">{system.status}</span></div><dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3">{[
            ["Teléfono", system.client.phone], ["Correo", system.client.email], ["Ubicación", system.address], ["Módulos", system.numPanels], ["Potencia instalada", installedPower(system)], ["Marca de módulos", system.panelBrand], ["Inversor", system.inverterModel], ["Serie de inversor", system.inverterSerial], ["Instalación", date(system.installationDate)], ["Próximo mantenimiento", date(rows.systems.find(s => s.system_code === selected)?.scheduled_maintenance_date)], ["Notas del cliente", system.client.notes],
          ].map(([label, value]) => <div key={String(label)}><dt className="text-stone-500">{label}</dt><dd className="mt-1 break-words whitespace-pre-wrap font-medium">{value || "Sin registro"}</dd></div>)}</dl></section>
          <section className={panel}><h2 className="text-xl font-semibold">Mantenimientos realizados</h2>{history.length ? <div className="mt-4 space-y-5">{history.map(item => <article key={item.id} className="border-t border-stone-100 pt-4"><h3 className="font-semibold">{item.service_type} · {date(item.service_Date)}</h3><p className="mt-1 text-sm text-stone-500">Técnico: {item.technician_name || "Sin registro"}</p>{[item.work_performed, item.findings, item.recommendations].map((value, i) => value ? <p key={i} className="mt-3 whitespace-pre-wrap text-sm"><strong>{["Trabajo realizado", "Hallazgos", "Recomendaciones"][i]}: </strong>{value}</p> : null)}</article>)}</div> : <p className="mt-4 text-sm text-stone-500">Sin mantenimientos registrados.</p>}</section>
          <section className={panel}><h2 className="text-xl font-semibold">Documentos y fotografías</h2>{docs.length ? <div className="mt-4 divide-y divide-stone-100">{docs.map(doc => <article key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><h3 className="break-words font-medium">{doc.description || doc.original_name || doc.document_type}</h3><p className="mt-1 text-xs text-stone-500">{doc.document_type} · {date(doc.created_at)}</p></div>{safeUrl(doc.file_url) && <a href={safeUrl(doc.file_url)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 px-4 text-sm font-semibold">Abrir archivo <ExternalLink size={15} /></a>}</article>)}</div> : <p className="mt-4 text-sm text-stone-500">Sin archivos publicados.</p>}</section>
          <section className={panel}><h2 className="text-xl font-semibold">Solicitudes</h2>{requests.length ? <ul className="mt-4 space-y-3">{requests.map(item => <li key={item.id} className="flex flex-wrap justify-between gap-2 border-t border-stone-100 pt-3 text-sm"><span>{item.request_type} · {date(item.created_at)}</span><span>{item.status}</span></li>)}</ul> : <p className="mt-4 text-sm text-stone-500">Sin solicitudes registradas.</p>}</section>
        </>}
      </>}
    </main>
  </div>;
}
