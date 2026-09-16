"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, ChevronRight, CircleAlert, ClipboardCheck, Copy, Gauge, LoaderCircle, Pencil, Search, Users, Wrench } from "lucide-react";
import { installedPower, mapAdminSystem, type AdminSystem } from "@/lib/admin-system";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type RealAdminView = "dashboard" | "sistemas" | "mantenimientos" | "clientes";
type Maintenance = { id: number; systemId: string; date: string; type: string; technician: string; nextDate: string };
type RequestRow = { id: string; status: string; request_type: string; system_id: string; created_at: string };

function dateLabel(value: string) {
  if (!value) return "Sin registro";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#8A6200]">{eyebrow}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.035em] text-stone-900 md:text-4xl">{title}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">{description}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center text-sm text-stone-500">{text}</div>;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Some browsers expose Clipboard API but deny it; use the compatible fallback.
    }
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("Clipboard unavailable");
}

function SystemsTable({ systems, onEdit, compact = false }: { systems: AdminSystem[]; onEdit: (system: AdminSystem) => void; compact?: boolean }) {
  const [search, setSearch] = useState("");
  const filtered = systems.filter((system) => `${system.systemCode} ${system.client.fullName} ${system.address}`.toLowerCase().includes(search.toLowerCase()));
  const shown = compact ? filtered.slice(0, 5) : filtered;
  return <article className="overflow-hidden rounded-3xl border border-stone-200 bg-white"><div className="flex flex-col gap-4 border-b border-stone-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8A6200]">Supabase</p><h3 className="mt-1 text-xl font-semibold">Sistemas registrados</h3></div><div className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-stone-400"><Search className="size-4" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar sistema" className="w-40 bg-transparent text-sm outline-none" /></div></div>{shown.length === 0 ? <div className="px-5 py-12 text-center text-sm text-stone-500">No hay sistemas que coincidan.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-stone-50 text-[10px] uppercase tracking-[.14em] text-stone-400"><tr><th className="px-5 py-3">Sistema / cliente</th><th className="px-5 py-3">Ubicación</th><th className="px-5 py-3">Potencia</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3">Acciones</th></tr></thead><tbody>{shown.map((system) => <tr key={system.id} className="border-t border-stone-100 text-sm"><td className="px-5 py-4"><div className="font-semibold">{system.systemCode}</div><div className="mt-1 text-xs text-stone-500">{system.client.fullName}</div></td><td className="max-w-64 px-5 py-4 text-stone-600"><span className="line-clamp-2">{system.address || "Sin dirección"}</span></td><td className="px-5 py-4 text-stone-600">{installedPower(system)}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${system.status === "Activo" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{system.status}</span></td><td className="px-5 py-4"><div className="flex items-center gap-2"><button onClick={() => onEdit(system)} className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 px-3 text-xs font-semibold hover:bg-stone-50"><Pencil className="size-3" />Editar</button>{system.publicToken && <Link href={`/s/${system.publicToken}`} target="_blank" className="grid size-9 place-items-center rounded-lg border border-stone-200 text-stone-500" aria-label={`Abrir ${system.systemCode}`}><ChevronRight className="size-4" /></Link>}</div></td></tr>)}</tbody></table></div>}{compact && systems.length > 0 && <Link href="/admin/sistemas" className="flex items-center justify-center gap-2 border-t border-stone-100 py-4 text-sm font-semibold text-stone-600">Administrar sistemas <ChevronRight className="size-4" /></Link>}</article>;
}

export function AdminRecords({ view, refreshKey, onEdit }: { view: RealAdminView; refreshKey: number; onEdit: (system: AdminSystem) => void }) {
  const [systems, setSystems] = useState<AdminSystem[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [copiedSystem, setCopiedSystem] = useState("");

  async function copyPortalLink(system: AdminSystem) {
    if (!system.publicToken) {
      setCopyMessage(`${system.systemCode} todavía no tiene un QR configurado.`);
      return;
    }
    try {
      await copyText(`${window.location.origin}/s/${system.publicToken}`);
      setCopiedSystem(system.systemCode);
      setCopyMessage(`Enlace QR de ${system.systemCode} copiado.`);
    } catch {
      setCopiedSystem("");
      setCopyMessage("El navegador bloqueó el portapapeles. Abre el expediente y copia la dirección manualmente.");
    }
    window.setTimeout(() => { setCopyMessage(""); setCopiedSystem(""); }, 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const result = await supabase.rpc("admin_get_portal_data");
    if (result.error || !result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
      setSystems([]);
      setMaintenance([]);
      setRequests([]);
      setError("No fue posible cargar el panel. Ejecuta la migración 006 y vuelve a iniciar sesión.");
      setLoading(false);
      return;
    }
    const data = result.data as Record<string, unknown>;
    const systemRows = Array.isArray(data.systems) ? data.systems as Record<string, unknown>[] : [];
    const maintenanceRows = Array.isArray(data.maintenance) ? data.maintenance as Record<string, unknown>[] : [];
    const requestRows = Array.isArray(data.requests) ? data.requests as RequestRow[] : [];
    setSystems(systemRows.map(mapAdminSystem).filter((item): item is AdminSystem => Boolean(item)));
    setMaintenance(maintenanceRows.map((item) => ({ id: Number(item.id), systemId: String(item.system_id || ""), date: String(item.service_Date || ""), type: String(item.service_type || "Servicio"), technician: String(item.technician_name || "Sin asignar"), nextDate: String(item.next_service_date || "") })));
    setRequests(requestRows);
    setLoading(false);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load, refreshKey]);

  const uniqueClients = useMemo(() => new Map(systems.map((system) => [system.client.id, system.client])).size, [systems]);
  if (loading) return <div className="flex min-h-64 items-center justify-center rounded-3xl border border-stone-200 bg-white text-sm text-stone-500"><LoaderCircle className="mr-2 size-5 animate-spin" />Consultando Supabase…</div>;
  if (error && systems.length === 0) return <p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>;

  if (view === "dashboard") {
    const metrics = [
      { label: "Sistemas registrados", value: systems.length, icon: Gauge },
      { label: "Clientes activos", value: uniqueClients, icon: Users },
      { label: "Servicios registrados", value: maintenance.length, icon: ClipboardCheck },
      { label: "Solicitudes nuevas", value: requests.filter((request) => request.status === "new").length, icon: CalendarClock },
    ];
    return <div className="space-y-8"><PageTitle eyebrow="Datos en tiempo real" title="Panel Solaris" description="Todo lo mostrado en esta vista proviene directamente de Supabase." />{error && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, icon: Icon }) => <article key={label} className="rounded-3xl border border-stone-200 bg-white p-5"><span className="grid size-10 place-items-center rounded-2xl bg-[#FFF6D9] text-[#8A6200]"><Icon className="size-5" /></span><div className="mt-5 text-3xl font-semibold">{value}</div><div className="mt-1 text-sm text-stone-500">{label}</div></article>)}</div>{systems.length ? <SystemsTable systems={systems} onEdit={onEdit} compact /> : <Empty text="Aún no hay sistemas registrados. Usa “Nuevo sistema” para crear el primero." />}<article id="solicitudes" className="overflow-hidden rounded-3xl border border-stone-200 bg-white scroll-mt-24"><div className="border-b border-stone-100 p-5"><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8A6200]">Bandeja</p><h3 className="mt-1 text-xl font-semibold">Solicitudes de clientes</h3></div>{requests.length === 0 ? <div className="p-10 text-center text-sm text-stone-500">No hay solicitudes recibidas.</div> : <div className="divide-y divide-stone-100">{requests.slice(0, 10).map((request) => <div key={request.id} className="grid gap-2 p-5 sm:grid-cols-[110px_1fr_140px_120px] sm:items-center"><time className="text-xs text-stone-500">{dateLabel(request.created_at)}</time><div><p className="text-sm font-semibold">{request.request_type === "failure" ? "Falla reportada" : "Solicitud de mantenimiento"}</p><p className="mt-1 text-xs text-[#8a692e]">{request.system_id}</p></div><span className="text-xs text-stone-500">Folio {request.id.slice(0, 8).toUpperCase()}</span><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${request.status === "new" ? "bg-amber-50 text-amber-700" : "bg-stone-100 text-stone-600"}`}>{request.status === "new" ? "Nueva" : request.status}</span></div>)}</div>}</article></div>;
  }

  if (view === "sistemas") return <div className="space-y-8"><PageTitle eyebrow="Portafolio real" title="Sistemas fotovoltaicos" description="Crea, consulta y actualiza los expedientes existentes en Supabase." />{systems.length ? <SystemsTable systems={systems} onEdit={onEdit} /> : <Empty text="No existen sistemas registrados." />}</div>;

  if (view === "clientes") return <div className="space-y-8"><PageTitle eyebrow="Directorio real" title="Clientes" description="Abre una ficha para administrar exclusivamente el sistema, contacto y documentos de ese cliente." />{copyMessage && <p role="status" aria-live="polite" className={`rounded-2xl px-4 py-3 text-sm ${copiedSystem ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{copyMessage}</p>}{systems.length === 0 ? <Empty text="No existen clientes vinculados a sistemas." /> : <div className="grid gap-4 lg:grid-cols-2">{systems.map((system) => <article key={system.id} className="rounded-3xl border border-stone-200 bg-white p-5"><div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-stone-900 text-sm font-semibold text-[#F4B400]">{system.client.fullName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CL"}</span><div className="min-w-0 flex-1"><Link href={`/admin/clientes/${encodeURIComponent(system.systemCode)}`} className="font-semibold hover:text-[#8a692e]">{system.client.fullName}</Link><p className="mt-1 text-xs text-stone-500">{system.client.email || "Sin correo"} · {system.client.phone}</p><p className="mt-2 text-xs font-semibold text-[#8a692e]">{system.systemCode}</p></div><button onClick={() => onEdit(system)} aria-label={`Editar ${system.client.fullName}`} className="grid size-9 place-items-center rounded-lg border border-stone-200"><Pencil className="size-4" /></button></div>{system.client.notes && <p className="mt-4 rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-500">{system.client.notes}</p>}<div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void copyPortalLink(system)} className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 px-3 text-xs font-semibold"><Copy className="size-3" />{copiedSystem === system.systemCode ? "Enlace copiado" : "Copiar enlace QR"}</button><Link href={`/admin/clientes/${encodeURIComponent(system.systemCode)}`} className="flex h-9 items-center gap-1.5 rounded-lg bg-stone-900 px-3 text-xs font-semibold" style={{ color: "white" }}>Abrir expediente <ChevronRight className="size-3" /></Link></div></article>)}</div>}</div>;

  return <div className="space-y-8"><PageTitle eyebrow="Historial real" title="Mantenimientos" description="Servicios almacenados en la tabla Maintainance de Supabase." /><div className="grid gap-4 sm:grid-cols-3"><article className="rounded-3xl border border-stone-200 bg-white p-5"><Wrench className="size-5 text-[#8A6200]" /><div className="mt-4 text-2xl font-semibold">{maintenance.length}</div><p className="text-sm text-stone-500">Servicios totales</p></article><article className="rounded-3xl border border-stone-200 bg-white p-5"><CheckCircle2 className="size-5 text-emerald-600" /><div className="mt-4 text-2xl font-semibold">{new Set(maintenance.map((item) => item.systemId)).size}</div><p className="text-sm text-stone-500">Sistemas atendidos</p></article><article className="rounded-3xl border border-stone-200 bg-white p-5"><CircleAlert className="size-5 text-amber-600" /><div className="mt-4 text-2xl font-semibold">{maintenance.filter((item) => item.nextDate && new Date(item.nextDate) < new Date()).length}</div><p className="text-sm text-stone-500">Próximos vencidos</p></article></div>{maintenance.length === 0 ? <Empty text="No hay mantenimientos registrados." /> : <article className="overflow-hidden rounded-3xl border border-stone-200 bg-white"><div className="divide-y divide-stone-100">{maintenance.map((item) => <div key={item.id} className="grid gap-3 p-5 sm:grid-cols-[110px_1fr_150px_160px] sm:items-center"><time className="text-xs text-stone-500">{dateLabel(item.date)}</time><div><p className="text-sm font-semibold">{item.type}</p><p className="mt-1 text-xs text-[#8a692e]">{item.systemId}</p></div><p className="text-sm text-stone-500">{item.technician}</p><p className="text-xs text-stone-500">Próximo: {dateLabel(item.nextDate)}</p></div>)}</div></article>}</div>;
}
