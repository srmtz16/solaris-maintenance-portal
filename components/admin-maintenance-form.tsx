"use client";

import { useRef, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminMaintenanceForm({ systems, onSaved }: { systems: { systemCode: string }[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const requestId = useRef("");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const field = "mt-2 w-full rounded-xl border border-stone-200 bg-white p-3 text-sm";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const data = new FormData(event.currentTarget);
    busy.current = true;
    setSaving(true);
    setMessage("");
    try {
      const { error } = await getSupabaseBrowserClient().rpc("admin_complete_maintenance", {
        p_request_id: requestId.current,
        p_system_code: data.get("system"),
        p_service_date: data.get("date"),
        p_service_type: data.get("type"),
        p_technician: String(data.get("technician") || "").trim(),
        p_work: String(data.get("work") || "").trim(),
        p_findings: String(data.get("findings") || "").trim() || null,
        p_recommendations: String(data.get("recommendations") || "").trim() || null,
        p_next_date: data.get("next") || null,
      });
      if (error) {
        setMessage(error.code === "22023" ? "Revisa las fechas y los campos obligatorios. La fecha del servicio no puede estar en el futuro y la siguiente debe ser posterior." : "No se pudo registrar el servicio. Puedes reintentar sin duplicarlo.");
        return;
      }
      setOpen(false);
      setMessage("Servicio registrado como completado. Ya aparece en el historial del cliente.");
      onSaved();
    } catch {
      setMessage("No se pudo confirmar el registro. Revisa tu conexión y vuelve a intentar.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return <section className="rounded-3xl border border-stone-200 bg-white p-5">
    <h3 className="text-lg font-semibold">Registrar servicio realizado</h3>
    <p className="mt-2 text-sm text-stone-500">Publica el trabajo terminado en el historial de la vivienda.</p>
    <button disabled={!systems.length} onClick={() => { requestId.current = crypto.randomUUID(); setMessage(""); setOpen(true); }} className="mt-4 rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Registrar mantenimiento realizado</button>
    {message && !open && <p role="status" className="mt-4 text-sm text-emerald-700">{message}</p>}
    {open && <div role="dialog" aria-modal="true" aria-labelledby="maintenance-title" className="fixed inset-0 z-[90] grid place-items-center bg-stone-950/50 p-4 backdrop-blur-sm"><div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6">
      <div className="flex items-center justify-between gap-4"><h2 id="maintenance-title" className="text-xl font-semibold">Mantenimiento realizado</h2><button disabled={saving} onClick={() => setOpen(false)} className="rounded-lg border p-2 text-sm">Cerrar</button></div>
      <p className="mt-3 text-sm text-stone-500">Estos datos serán visibles para el cliente. Guarda únicamente servicios que ya se realizaron.</p>
      <form onSubmit={submit} className="mt-6 space-y-4"><fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Vivienda<select required name="system" className={field}>{systems.map(s => <option key={s.systemCode}>{s.systemCode}</option>)}</select></label>
        <label className="text-sm">Fecha realizada<input required type="date" name="date" max={today} defaultValue={today} className={field} /></label>
        <label className="text-sm">Tipo de servicio<select name="type" className={field}><option>Mantenimiento preventivo</option><option>Mantenimiento correctivo</option><option>Limpieza de módulos</option><option>Inspección eléctrica</option></select></label>
        <label className="text-sm">Técnico responsable<input required minLength={2} maxLength={120} name="technician" className={field} /></label>
        <label className="text-sm sm:col-span-2">Trabajo realizado<textarea required minLength={5} maxLength={3000} rows={3} name="work" className={field} /></label>
        <label className="text-sm sm:col-span-2">Observaciones (opcional)<textarea maxLength={3000} rows={2} name="findings" className={field} /></label>
        <label className="text-sm sm:col-span-2">Recomendaciones (opcional)<textarea maxLength={3000} rows={2} name="recommendations" className={field} /></label>
        <label className="text-sm sm:col-span-2">Próximo servicio recomendado (opcional)<input type="date" name="next" className={field} /></label>
      </fieldset>{message && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}<button disabled={saving} className="w-full rounded-xl bg-stone-900 p-3 font-semibold text-white disabled:opacity-50">{saving ? "Guardando…" : "Guardar servicio completado"}</button></form>
    </div></div>}
  </section>;
}
