"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, Save, X } from "lucide-react";
import type { AdminSystem } from "@/lib/admin-system";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type SavedSystem = { systemCode: string; publicToken: string };

export function AdminSystemForm({ initial, onClose, onSaved }: { initial?: AdminSystem; onClose: () => void; onSaved: (system: SavedSystem) => void }) {
  const [fullName, setFullName] = useState(initial?.client.fullName ?? "");
  const [welcomeLabel, setWelcomeLabel] = useState<"Bienvenido" | "Bienvenida">(initial?.client.welcomeLabel ?? "Bienvenido");
  const [phone, setPhone] = useState(initial?.client.phone ?? "");
  const [email, setEmail] = useState(initial?.client.email ?? "");
  const [notes, setNotes] = useState(initial?.client.notes ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [numPanels, setNumPanels] = useState(initial?.numPanels?.toString() ?? "");
  const [panelPower, setPanelPower] = useState(initial?.panelPowerW?.toString() ?? "");
  const [panelBrand, setPanelBrand] = useState(initial?.panelBrand ?? "");
  const [inverterModel, setInverterModel] = useState(initial?.inverterModel ?? "");
  const [inverterSerial, setInverterSerial] = useState(initial?.inverterSerial ?? "");
  const [installationDate, setInstallationDate] = useState(initial?.installationDate?.slice(0, 10) ?? "");
  const [status, setStatus] = useState(initial?.status ?? "Activo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const parameters = {
      p_full_name: fullName.trim(), p_welcome_label: welcomeLabel, p_phone: phone.trim(),
      p_email: email.trim() || null, p_notes: notes.trim() || null, p_adress: address.trim(),
      p_num_panels: numPanels ? Number(numPanels) : null,
      p_panel_power_w: panelPower ? Number(panelPower) : null,
      p_panel_brand: panelBrand.trim() || null, p_inverter_model: inverterModel.trim() || null,
      p_inverter_serial: inverterSerial.trim() || null,
      p_installation_date: installationDate || null, p_system_status: status,
    };
    const supabase = getSupabaseBrowserClient();
    const result = initial
      ? await supabase.rpc("admin_update_system", { p_system_id: initial.id, ...parameters })
      : await supabase.rpc("admin_create_system", parameters);
    if (result.error || !result.data || typeof result.data !== "object") {
      setError(result.error?.message?.includes("Could not find") ? "La función administrativa aún no está instalada en Supabase." : "No fue posible guardar. Revisa los campos e intenta nuevamente.");
      setSaving(false);
      return;
    }
    const data = result.data as Record<string, unknown>;
    onSaved({ systemCode: String(data.systemCode || initial?.systemCode || "Sistema"), publicToken: String(data.publicToken || initial?.publicToken || "") });
  }

  const fieldClass = "mt-2 h-12 w-full rounded-xl border border-stone-200 bg-white px-4 outline-none focus:border-[#9b7835]";
  return <div role="dialog" aria-modal="true" aria-labelledby="system-form-title" className="fixed inset-0 z-[90] grid place-items-center bg-stone-950/50 px-4 py-6 backdrop-blur-sm"><section className="max-h-full w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#9b7835]">{initial ? initial.systemCode : "Alta de expediente"}</p><h2 id="system-form-title" className="mt-2 text-2xl font-semibold">{initial ? "Editar cliente y sistema" : "Registrar nuevo sistema"}</h2><p className="mt-2 text-sm text-stone-500">{initial ? "Los cambios se reflejarán en el portal del cliente." : "Supabase asignará el siguiente folio automáticamente."}</p></div><button type="button" disabled={saving} onClick={onClose} aria-label="Cerrar" className="grid size-10 shrink-0 place-items-center rounded-xl bg-stone-100"><X className="size-4" /></button></div><form onSubmit={submit} className="mt-7 space-y-7"><fieldset className="grid gap-5 sm:grid-cols-2"><legend className="mb-4 text-sm font-semibold text-stone-900">Datos del cliente</legend><label className="text-sm font-medium sm:col-span-2">Nombre completo<input required minLength={2} maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} className={fieldClass} /></label><label className="text-sm font-medium">Saludo<select value={welcomeLabel} onChange={(event) => setWelcomeLabel(event.target.value as "Bienvenido" | "Bienvenida")} className={fieldClass}><option>Bienvenido</option><option>Bienvenida</option></select></label><label className="text-sm font-medium">Teléfono<input required minLength={7} maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} className={fieldClass} /></label><label className="text-sm font-medium">Correo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} /></label><label className="text-sm font-medium">Notas<input value={notes} onChange={(event) => setNotes(event.target.value)} className={fieldClass} /></label></fieldset><fieldset className="grid gap-5 sm:grid-cols-2"><legend className="mb-4 text-sm font-semibold text-stone-900">Configuración del sistema</legend><label className="text-sm font-medium sm:col-span-2">Dirección<input required minLength={5} maxLength={250} value={address} onChange={(event) => setAddress(event.target.value)} className={fieldClass} /></label><label className="text-sm font-medium">Número de paneles<input type="number" min="1" step="1" value={numPanels} onChange={(event) => setNumPanels(event.target.value)} className={fieldClass} /></label><label className="text-sm font-medium">Potencia por panel (W)<input type="number" min="1" step="0.01" value={panelPower} onChange={(event) => setPanelPower(event.target.value)} className={fieldClass} /></label><label className="text-sm font-medium">Marca de panel<input value={panelBrand} onChange={(event) => setPanelBrand(event.target.value)} className={fieldClass} /></label><label className="text-sm font-medium">Modelo de inversor<input value={inverterModel} onChange={(event) => setInverterModel(event.target.value)} className={fieldClass} /></label><label className="text-sm font-medium">Serie del inversor<input value={inverterSerial} onChange={(event) => setInverterSerial(event.target.value)} className={fieldClass} /></label><label className="text-sm font-medium">Fecha de instalación<input type="date" value={installationDate} onChange={(event) => setInstallationDate(event.target.value)} className={fieldClass} /></label><label className="text-sm font-medium">Estado<select value={status} onChange={(event) => setStatus(event.target.value)} className={fieldClass}><option>Activo</option><option>En mantenimiento</option><option>Inactivo</option></select></label></fieldset>{error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={saving} onClick={onClose} className="h-12 rounded-xl border border-stone-200 px-5 text-sm font-semibold">Cancelar</button><button disabled={saving} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-stone-900 px-6 text-sm font-semibold text-white disabled:opacity-60">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear cliente y sistema"}</button></div></form></section></div>;
}
