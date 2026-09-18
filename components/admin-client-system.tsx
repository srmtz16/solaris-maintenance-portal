"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, ExternalLink, Gauge, LoaderCircle, MapPin, Pencil, Save, Trash2, UserRound } from "lucide-react";
import { AdminMaintenanceForm } from "@/components/admin-maintenance-form";
import { AdminDocuments } from "@/components/admin-documents";
import { installedPower, mapAdminSystem, type AdminSystem } from "@/lib/admin-system";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function todayForDateInput() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export function AdminClientSystem({ systemCode, refreshKey, onEdit }: { systemCode: string; refreshKey: number; onEdit: (system: AdminSystem) => void }) {
  const [system, setSystem] = useState<AdminSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = getSupabaseBrowserClient();
    const [result, scheduleResult] = await Promise.all([
      supabase.rpc("admin_get_portal_data"),
      supabase.rpc("admin_get_scheduled_maintenance", { p_system_code: systemCode }),
    ]);
    if (result.error || !result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
      setError("No fue posible abrir el expediente administrativo.");
      setLoading(false);
      return;
    }
    const rows = Array.isArray((result.data as Record<string, unknown>).systems) ? (result.data as Record<string, unknown>).systems as Record<string, unknown>[] : [];
    const match = rows.map(mapAdminSystem).find((item) => item?.systemCode === systemCode) ?? null;
    setSystem(match);
    setScheduledDate(typeof scheduleResult.data === "string" ? scheduleResult.data.slice(0, 10) : "");
    if (!match) setError(`${systemCode} no existe o no tiene un cliente vinculado.`);
    else if (scheduleResult.error) setError("El expediente abrió, pero falta instalar la programación de mantenimientos.");
    setLoading(false);
  }, [systemCode]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load, refreshKey]);

  async function saveSchedule(date: string | null) {
    setScheduleSaving(true);
    setScheduleMessage("");
    const result = await getSupabaseBrowserClient().rpc("admin_schedule_maintenance", {
      p_system_code: systemCode,
      p_scheduled_date: date || null,
    });
    if (result.error) {
      setScheduleMessage("No fue posible guardar la fecha. Verifica que no sea una fecha pasada.");
      setScheduleSaving(false);
      return;
    }
    setScheduledDate(typeof result.data === "string" ? result.data.slice(0, 10) : "");
    setScheduleMessage(date ? "Mantenimiento programado. El cliente verá la fecha en Próximo recomendado." : "La programación fue eliminada.");
    setScheduleSaving(false);
  }

  if (loading) return <div className="flex min-h-64 items-center justify-center rounded-3xl border border-stone-200 bg-white text-sm text-stone-500"><LoaderCircle className="mr-2 size-5 animate-spin" />Abriendo {systemCode}…</div>;
  if (!system) return <div className="space-y-5"><Link href="/admin/clientes" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600"><ArrowLeft className="size-4" />Volver a clientes</Link><p role="alert" className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p></div>;

  return <div className="space-y-10"><div><Link href="/admin/clientes" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600"><ArrowLeft className="size-4" />Todos los clientes</Link><div className="mt-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#8A6200]">Expediente administrativo · {system.systemCode}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.035em] md:text-4xl">{system.client.fullName}</h2><p className="mt-3 text-sm text-stone-500">Los cambios y archivos de esta vista pertenecen exclusivamente a este sistema.</p></div><div className="flex gap-2"><button onClick={() => onEdit(system)} className="flex h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold"><Pencil className="size-4" />Editar datos</button><Link href={`/s/${system.publicToken}`} target="_blank" className="flex h-11 items-center gap-2 rounded-xl bg-stone-900 px-4 text-sm font-semibold" style={{ color: "white" }}>Portal del cliente <ExternalLink className="size-4" /></Link></div></div></div><div className="grid gap-4 lg:grid-cols-3"><article className="rounded-3xl border border-stone-200 bg-white p-5"><span className="grid size-10 place-items-center rounded-2xl bg-[#FFF6D9] text-[#8A6200]"><UserRound className="size-5" /></span><h3 className="mt-4 font-semibold">Contacto</h3><p className="mt-2 text-sm text-stone-600">{system.client.phone}</p><p className="mt-1 text-sm text-stone-500">{system.client.email || "Sin correo"}</p></article><article className="rounded-3xl border border-stone-200 bg-white p-5"><span className="grid size-10 place-items-center rounded-2xl bg-[#FFF6D9] text-[#8A6200]"><MapPin className="size-5" /></span><h3 className="mt-4 font-semibold">Ubicación</h3><p className="mt-2 text-sm leading-6 text-stone-600">{system.address}</p></article><article className="rounded-3xl border border-stone-200 bg-white p-5"><span className="grid size-10 place-items-center rounded-2xl bg-[#FFF6D9] text-[#8A6200]"><Gauge className="size-5" /></span><h3 className="mt-4 font-semibold">Sistema</h3><p className="mt-2 text-sm text-stone-600">{installedPower(system)} · {system.numPanels || "Sin"} paneles</p><p className="mt-1 text-sm text-stone-500">{system.inverterModel || "Inversor sin configurar"}</p></article></div><section className="rounded-3xl border border-stone-200 bg-white p-5 md:p-6"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#FFF6D9] text-[#8A6200]"><CalendarDays className="size-5" /></span><div><h3 className="font-semibold">Próximo mantenimiento recomendado</h3><p className="mt-1 text-sm text-stone-500">Selecciona la fecha que aparecerá en el portal de {system.client.fullName}.</p></div></div><div className="mt-5 flex flex-col gap-3 sm:flex-row"><input type="date" min={todayForDateInput()} value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} className="h-11 rounded-xl border border-stone-200 bg-white px-4 text-sm outline-none focus:border-[#8A6200]" /><button type="button" disabled={scheduleSaving || !scheduledDate} onClick={() => void saveSchedule(scheduledDate)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 text-sm font-semibold text-white disabled:opacity-50">{scheduleSaving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}Guardar fecha</button>{scheduledDate && <button type="button" disabled={scheduleSaving} onClick={() => void saveSchedule(null)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 px-4 text-sm font-semibold text-stone-600"><Trash2 className="size-4" />Quitar</button>}</div>{scheduleMessage && <p role="status" className={`mt-4 rounded-xl px-4 py-3 text-sm ${scheduleMessage.startsWith("No") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{scheduleMessage}</p>}</section><AdminMaintenanceForm systems={[{ systemCode: system.systemCode }]} onSaved={() => { void load(); }} /><div className="border-t border-stone-200 pt-10"><AdminDocuments fixedSystemCode={system.systemCode} /></div></div>;
}
