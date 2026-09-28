"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
  const yellow = "#F4B400", gray = "#ADB7BE";
  const color = (key: keyof Equipment) => equipment[key] === true ? yellow : gray;
  return <svg viewBox="0 0 900 510" role="img" aria-label="Ilustración de una vivienda con paneles en el techo, cargador en el garaje y baterías. Los equipos instalados se resaltan en amarillo." className="mx-auto h-auto w-full max-w-4xl">
    <ellipse cx="456" cy="444" rx="354" ry="38" fill="#DCE2E7" opacity=".6" />
    <path d="M76 367 409 214 834 365 508 496Z" fill="#E6EAEF" />
    <path d="M128 234 451 316 451 438 128 349Z" fill="#F8F9FB" stroke="#D3DAE1" />
    <path d="M451 316 765 210 765 332 451 438Z" fill="#D6DDE3" stroke="#C7D0D8" />
    <path d="M122 227 443 95 772 201 451 319Z" fill="#EEF1F4" stroke="#C3CDD5" strokeWidth="3" />
    <path d="M122 227V241L451 332V319Z" fill="#D8DFE5" /><path d="M451 319V332L772 215V201Z" fill="#BEC9D2" />
    <path d="M157 263 214 278 214 373 157 357Z" fill="#A0ABB4" /><path d="M166 272 205 282 205 363 166 353Z" fill="#BAC3CA" /><path d="M195 318v17" stroke="#637582" strokeWidth="3" />
    <path d="M240 285 335 311 335 361 240 335Z" fill="#7D909E" stroke="#C0CAD2" strokeWidth="6" /><path d="M287 301V346" stroke="#CED6DD" strokeWidth="3" />
    <path d="M470 340 652 275V388L470 451Z" fill="#F5F7FA" /><path d="M482 348 639 291V384L482 439Z" fill="#788995" />
    <path d="M452 321 650 248 680 264 481 340Z" fill="#FAFBFC" /><path d="M650 248V273L680 281V264Z" fill="#C3CED7" />
    <path d="M656 279 679 271V402L656 411Z" fill="#ECF0F3" />
    <path d="M685 274 746 253V351L685 373Z" fill="#BCC8D1" />
    <g transform="matrix(1 .25 -.9 .4 360 133)" stroke={color("solar")} strokeWidth="3" fill={equipment.solar ? "#16303D" : "#C1CBD3"}>
      {[0,1].map(row => [0,1,2,3].map(col => <g key={`${row}-${col}`} transform={`translate(${col * 70} ${row * 90})`}><rect width="63" height="82" rx="2" /><path d="M21 0V82M42 0V82M0 20H63M0 41H63M0 62H63" strokeWidth=".9" /></g>))}
    </g>
    <g stroke="#697B88" strokeWidth="2"><path d="M502 408 511 375 552 355 593 363 616 392 613 411 568 431 516 424Z" fill="#D0D8DE" /><path d="M514 377 545 365 572 370 585 387 533 410 505 402Z" fill="#203B4B" /><path d="M533 410 568 417 611 398" fill="none" /><ellipse cx="523" cy="420" rx="8" ry="12" fill="#455A68" /><ellipse cx="598" cy="413" rx="8" ry="12" fill="#455A68" /></g>
    <g transform="translate(617 305)" stroke={color("charger")}><rect x="0" y="0" width="19" height="32" rx="5" fill={equipment.charger ? "#FFF2BE" : "#D0D8DE"} strokeWidth="3" /><path d="m12 6-6 9h7l-6 9" fill="none" strokeWidth="2" /><path d="M10 33v20q22 17 25-7V21" fill="none" strokeWidth="3" /><path d="M30 16h9v12h-9z" fill={color("charger")} /></g>
    <g transform="translate(697 299)"><path d="M0 10 19 3 47 10 28 18Z" fill={color("battery")} /><path d="M0 10 28 18V77L0 68Z" fill={equipment.battery ? "#FFD45C" : "#D1D9DF"} stroke={color("battery")} strokeWidth="2" /><path d="M28 18 47 10V67L28 77Z" fill={color("battery")} /><path d="m4 31 20 6m-20 11 20 6" stroke={equipment.battery ? "#BB8800" : "#9BAAB5"} /><path d="m9 19 11 3" stroke="#294452" strokeWidth="3" /></g>
    <g fill="#AEBCC5"><ellipse cx="117" cy="364" rx="20" ry="6" /><path d="M102 346h29l-5 20h-18Z" fill="#C9D2D9" /><path d="M118 348q-33-26-28-37 29 9 28 37M118 348q-8-39 7-51 15 25-7 51M118 348q24-35 33-23-3 19-33 23" /></g>
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
    <div><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#8A6200]">{admin ? "Configuración del diagrama" : "Mi sistema"}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#06131B] md:text-3xl">{admin ? "Equipos de la instalación" : "Tu instalación, de un vistazo"}</h2><p className="mt-2 text-sm leading-6 text-stone-500">{admin ? "Indica qué equipos tiene este sistema. El cliente solo podrá consultarlos." : "Conoce los equipos que forman parte de tu sistema."}</p></div>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error} <button type="button" onClick={() => void load()} className="underline">Volver a cargar</button></div>}
    {loading ? <p role="status" className="flex items-center gap-2 py-12 text-sm text-stone-500"><LoaderCircle className="size-5 animate-spin" />Cargando equipos…</p> : <div className="overflow-hidden rounded-3xl border border-stone-200 bg-[#EEF2F5]">
      {!admin && <EquipmentHouse equipment={equipment} />}
      <div className="grid gap-5 p-5 sm:grid-cols-3 md:p-7">{devices.map(({ key, label, icon: Icon }) => <div key={key} className="flex items-center gap-3 sm:flex-col sm:text-center"><Icon className={`size-7 shrink-0 ${equipment[key] ? "text-[#D99B00]" : "text-slate-400"}`} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#06131B]">{label}</p>{admin ? <select aria-label={label} disabled={saving} value={equipment[key] === null ? "unknown" : String(equipment[key])} onChange={event => { setMessage(""); setEquipment(current => ({ ...current, [key]: event.target.value === "unknown" ? null : event.target.value === "true" })); }} className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm"><option value="unknown">Por confirmar</option><option value="true">Instalado</option><option value="false">No instalado</option></select> : <p className="mt-1 text-xs text-stone-500">{equipment[key] === null ? "Por confirmar" : equipment[key] ? "Instalado" : "No instalado"}</p>}</div></div>)}</div>
      {!admin && <p className="px-5 pb-5 text-center text-[11px] leading-5 text-stone-500">Ilustración de referencia. Amarillo: instalado · Gris: no instalado o por confirmar.</p>}
    </div>}
    {admin ? <><button type="button" disabled={loading || saving || !ready} onClick={() => void save()} className="min-h-11 rounded-xl bg-[#F4B400] px-5 text-sm font-semibold text-[#06131B] disabled:opacity-50">{saving ? "Guardando…" : "Guardar equipos"}</button>{message && <p role="status" className="text-sm text-emerald-700">{message}</p>}</> : <div className="text-center"><p className="text-sm text-stone-500">¿Quieres ampliar tu sistema? Podemos orientarte.</p><Link href={`/s/${portalKey}/soporte`} className="mt-3 inline-flex min-h-11 items-center rounded-full border border-[#06131B] px-5 text-sm font-semibold text-[#06131B]">Consultar a SOLARIS</Link></div>}
  </section>;
}
