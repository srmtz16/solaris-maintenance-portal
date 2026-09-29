"use client";

import { SOLARIS_WHATSAPP, whatsappUrl } from "@/lib/prospect-contact";
import { useCallback, useEffect, useId, useState } from "react";
import { BatteryCharging, CarFront, Sun, LoaderCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Equipment = { solar: boolean | null; charger: boolean | null; battery: boolean | null };
const empty: Equipment = { solar: null, charger: null, battery: null };
const devices = [{ key: "solar", label: "Paneles solares", icon: Sun }, { key: "charger", label: "Cargador eléctrico", icon: CarFront }, { key: "battery", label: "Baterías", icon: BatteryCharging }] as const;
function parse(value: unknown): Equipment {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(devices.map(({ key }) => [key, typeof row[key] === "boolean" ? row[key] : null])) as Equipment;
}

export function EquipmentHouse({ equipment }: { equipment: Equipment }) {
  const id = useId().replace(/:/g, "");
  const asset = "/solar-house-realistic.webp";
  // All layers share one image and coordinate system so highlights stay aligned at every size.
  const regions = { solar: [400, 140, 725, 200], charger: [1110, 460, 60, 150], battery: [1310, 475, 125, 220] } as const;
  return <svg viewBox="0 70 1672 800" role="img" aria-label="Ilustración residencial con paneles solares, cargador eléctrico y baterías. Solo los equipos registrados como instalados se muestran en amarillo." className="block h-auto w-full">
    <defs>
      <filter id={id + "-gray"} colorInterpolationFilters="sRGB"><feColorMatrix type="saturate" values="0" /></filter>
      {devices.map(({ key }) => <clipPath id={id + "-" + key} key={key}>{key === "solar" ? <polygon points="421,275 584,154 1111,191 1110,211 975,321" /> : <rect x={regions[key][0]} y={regions[key][1]} width={regions[key][2]} height={regions[key][3]} />}</clipPath>)}
    </defs>
    <image href={asset} width="1672" height="941" filter={"url(#" + id + "-gray)"} />
    {devices.map(({ key }) => equipment[key] === true && <image key={key} href={asset} width="1672" height="941" clipPath={"url(#" + id + "-" + key + ")"} />)}
  </svg>;
}

export function SystemEquipment({ portalKey, systemCode }: { portalKey?: string; systemCode?: string }) {
  const admin = Boolean(systemCode);
  const [equipment, setEquipment] = useState<Equipment>(empty);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      setError("");
      const db = getSupabaseBrowserClient();
      const result = admin ? await db.rpc("admin_get_system_equipment", { p_system_code: systemCode }) : await db.rpc("get_public_equipment", { p_public_token: portalKey });
      if (result.error || !result.data) throw new Error();
      setEquipment(parse(result.data)); setReady(true);
    } catch { setError("No pudimos cargar los equipos. Intenta nuevamente."); }
    finally { setLoading(false); }
  }, [admin, systemCode, portalKey]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (admin) return;
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 15000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [admin, load]);
  async function save() {
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await getSupabaseBrowserClient().rpc("admin_save_system_equipment", { p_system_code: systemCode, p_solar: equipment.solar, p_charger: equipment.charger, p_battery: equipment.battery });
      if (result.error || result.data !== true) throw new Error();
      setMessage("Equipos guardados. El cliente verá la instalación actualizada.");
    } catch { setError("No se guardaron los cambios. Intenta nuevamente."); }
    finally { setSaving(false); }
  }
  return <section className="space-y-5" aria-label={admin ? "Administrar equipos" : "Equipos de tu instalación"}>
    <div><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#8A6200]">{admin ? "Configuración del diagrama" : "Mi sistema"}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#06131B] md:text-4xl">{admin ? "Equipos de la instalación" : "Tu sistema, con energía solar"}</h2><p className="mt-2 text-sm leading-6 text-stone-500">{admin ? "Indica qué equipos tiene este sistema. El cliente solo podrá consultarlos." : "Conoce los equipos que forman parte de tu instalación."}</p></div>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error} <button type="button" onClick={() => void load()} className="underline">Volver a cargar</button></div>}
    {loading ? <p role="status" className="flex items-center gap-2 py-12 text-sm text-stone-500"><LoaderCircle className="size-5 animate-spin" />Cargando equipos…</p> : <div className="overflow-hidden rounded-3xl border border-slate-100 bg-[#EEF2F5]">
      {!admin && <EquipmentHouse equipment={equipment} />}
      <div className="grid gap-5 px-5 pb-6 pt-2 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-slate-300 md:px-8 md:pb-8">{devices.map(({ key, label, icon: Icon }) => <div key={key} className="flex items-center gap-3 sm:flex-col sm:px-5 sm:text-center"><Icon className={`size-9 shrink-0 sm:size-12 ${equipment[key] ? "text-[#E8AB00]" : "text-slate-400"}`} /><div className="min-w-0 flex-1"><p className="text-base font-semibold text-[#06131B] md:text-lg">{label}</p>{admin ? <select aria-label={label} disabled={saving} value={String(equipment[key] === true)} onChange={event => { setMessage(""); setEquipment(current => ({ ...current, [key]: event.target.value === "true" })); }} className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm"><option value="true">Instalado</option><option value="false">Aún no instalado</option></select> : <p className="mt-1 text-sm text-slate-500">{equipment[key] === true ? "Instalado" : "Aún no instalado"}</p>}</div></div>)}</div>
      {!admin && <p className="px-5 pb-5 text-center text-[11px] leading-5 text-stone-500">Ilustración de referencia. Amarillo: instalado · Gris: aún no instalado.</p>}
    </div>}
    {admin ? <><button type="button" disabled={loading || saving || !ready} onClick={() => void save()} className="min-h-11 rounded-xl bg-[#F4B400] px-5 text-sm font-semibold text-[#06131B] disabled:opacity-50">{saving ? "Guardando…" : "Guardar equipos"}</button>{message && <p role="status" className="text-sm text-emerald-700">{message}</p>}</> : <div className="text-center"><p className="text-sm text-stone-500">¿Quieres ampliar tu sistema? Podemos orientarte.</p><a href={whatsappUrl(SOLARIS_WHATSAPP, "Orientación")} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-full border border-[#06131B] px-5 text-sm font-semibold text-[#06131B]">Consultar a SOLARIS</a></div>}
  </section>;
}


