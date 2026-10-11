"use client";

import Link from "next/link";
import { EquipmentIllustration } from "@/components/equipment-illustration";
import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { equipmentExpansionUrl } from "@/lib/prospect-contact";
import { EQUIPMENT_PHOTOS_ENABLED, EQUIPMENT_LIMIT, equipmentTypes, equipmentServiceTypes, equipmentMaintenanceSummary, equipmentToday, type EquipmentInput, type EquipmentPortal, type PropertyEquipment, type EquipmentType } from "@/lib/property-equipment";

const card = "rounded-3xl border border-stone-200 bg-white p-5 md:p-6";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold";
const field = "mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#F4B400]";
const empty = (type: EquipmentType): EquipmentInput => ({ type, name: type, brand: null, model: null, serial_number: null, location: null, installed_on: null, notes: null });
const dateLabel = (date: string | null) => date ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)) : "Sin registro";
function Status({ equipment }: { equipment: PropertyEquipment }) {
  const { status, label } = equipmentMaintenanceSummary(equipment.services);
  const colors = { current: "bg-green-50 text-green-800", upcoming: "bg-amber-50 text-amber-800", overdue: "bg-red-50 text-red-800", "no-history": "bg-stone-100 text-stone-600" };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${colors[status]}`}>{label}</span>;
}

async function preparePhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10_000_000) throw new Error("Usa una imagen JPG, PNG o WebP de hasta 10 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar la imagen.");
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [.8, .65, .45]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.length < 650_000) return data;
    }
    throw new Error("La fotografía es demasiado grande. Selecciona otra imagen.");
  } finally { bitmap.close(); }
}

type Draft = EquipmentInput & { id?: string; photo?: string };
function EquipmentFields({ value, change, busy, onPhotoBusy }: { value: Draft; change: (value: Draft) => void; busy: boolean; onPhotoBusy: (busy: boolean) => void }) {
  const [photoError, setPhotoError] = useState("");
  const [processing, setProcessing] = useState(false);
  return <fieldset disabled={busy || processing} className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Tipo de equipo<select className={field} required value={value.type} onChange={e => change({ ...value, type: e.target.value as EquipmentType })}>{equipmentTypes.map(type => <option key={type}>{type}</option>)}</select></label><label className="text-sm font-medium">Nombre personalizado<input required maxLength={120} className={field} value={value.name} onChange={e => change({ ...value, name: e.target.value })} placeholder="Aire acondicionado - Recámara principal" /></label>{([['brand','Marca',100],['model','Modelo',120],['serial_number','Número de serie',150],['location','Ubicación dentro de la propiedad',200]] as const).map(([key,label,max]) => <label key={key} className="text-sm font-medium">{label} <span className="font-normal text-stone-400">(opcional)</span><input maxLength={max} className={field} value={value[key] || ""} onChange={e => change({ ...value, [key]: e.target.value })} /></label>)}<label className="text-sm font-medium">Fecha de instalación (opcional)<input type="date" className={field} value={value.installed_on || ""} onChange={e => change({ ...value, installed_on: e.target.value })} /></label>{EQUIPMENT_PHOTOS_ENABLED && <label className="text-sm font-medium">Fotografía (opcional)<input type="file" accept="image/jpeg,image/png,image/webp" className={field} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; setProcessing(true); onPhotoBusy(true); setPhotoError(""); try { change({ ...value, photo: await preparePhoto(file) }); } catch (error) { setPhotoError((error as Error).message); } finally { setProcessing(false); onPhotoBusy(false); } }} />{processing && <span role="status">Preparando fotografía…</span>}{value.photo && <span className="mt-2 block text-xs text-green-700">Fotografía preparada <button type="button" onClick={() => change({ ...value, photo: undefined })} className="ml-2 underline">Quitar</button></span>}{photoError && <span role="alert" className="mt-2 block text-xs text-red-700">{photoError}</span>}</label>}<label className="text-sm font-medium sm:col-span-2">Notas (opcional)<textarea maxLength={2000} rows={3} className={field} value={value.notes || ""} onChange={e => change({ ...value, notes: e.target.value })} /></label></fieldset>;
}

export function PropertyEquipmentSection({ portalKey, systemCode, initialEquipmentId }: { portalKey?: string; systemCode?: string; initialEquipmentId?: string }) {
  const admin = Boolean(systemCode);
  const query = new URLSearchParams(systemCode ? { system: systemCode } : { token: portalKey || "" }).toString();
  const [data, setData] = useState<EquipmentPortal | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [selected, setSelected] = useState<EquipmentType[]>([]);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [setup, setSetup] = useState(false);
  const [active, setActive] = useState<string | null>(initialEquipmentId || null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [service, setService] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/equipment?${query}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result); setError("");
    } catch (error) { setError((error as Error).message || "No se pudo cargar Equipos."); }
  }, [query]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { const timer = window.setTimeout(() => { const id = new URLSearchParams(window.location.search).get("equipment"); if (id) setActive(id); }, 0); return () => window.clearTimeout(timer); }, []);
  async function save(payload: Record<string, unknown>) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/equipment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, token: portalKey, system: systemCode }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await load(); setDrafts(null); setEditing(null); setService(false); setSetup(false); return true;
    } catch (error) { setError((error as Error).message || "No se confirmó el guardado. Actualiza antes de reintentar."); return false; }
    finally { setBusy(false); }
  }
  if (!data) return <section className={card}><h2 className="text-xl font-semibold">Equipos de mi propiedad</h2><p role={error ? "alert" : "status"} className="mt-3 text-sm">{error || "Cargando equipos…"}</p>{error && <button className={`${secondary} mt-4`} onClick={() => void load()}>Reintentar</button>}</section>;
  const equipment = data.equipment.find(e => e.id === active);
  const photoUrl = (path: string) => `/api/equipment?${query}&photo=${encodeURIComponent(path)}`;
  const onboarding = !admin && !data.completed && (!data.skipped || setup);
  return <section className="space-y-6"><div><p className="mb-2 text-[11px] font-semibold uppercase tracking-[.18em] text-[#8A6200]">Registro de equipos · {data.systemCode}</p><h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Equipos de mi propiedad</h2><p className="mt-2 text-sm leading-6 text-stone-500">Consulta tus equipos y registra los servicios realizados. La información solar permanece en tu Pasaporte.</p></div>{error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {equipment ? <><button className={secondary} onClick={() => { setActive(null); setService(false); setEditing(null); }}>Volver a equipos</button><article className={card}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-stone-500">{equipment.type}</p><h3 className="mt-1 text-2xl font-semibold">{equipment.name}</h3></div><Status equipment={equipment} /></div>{equipment.photo_path ? <EquipmentPhoto src={photoUrl(equipment.photo_path)} name={equipment.name} /> : <div className="mt-5"><EquipmentIllustration type={equipment.type} /></div>}<dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">{[["Marca",equipment.brand],["Modelo",equipment.model],["Número de serie",equipment.serial_number],["Ubicación",equipment.location],["Fecha de instalación",dateLabel(equipment.installed_on)]].map(([label,value]) => <div key={label}><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-1 break-words">{value || "Sin registro"}</dd></div>)}</dl>{equipment.notes && <p className="mt-5 whitespace-pre-wrap text-sm text-stone-600">{equipment.notes}</p>}<p className="mt-5 break-all text-[10px] text-stone-400">{equipment.asset_code}</p>{portalKey && <Link className="mt-3 inline-block text-xs underline" href={`/equipment/${equipment.id}?property=${portalKey}`}>Enlace de consulta del equipo</Link>}<div className="mt-5 flex flex-wrap gap-3">{admin && <button className={secondary} onClick={() => { setEditing(equipment); setService(false); }}>Editar equipo</button>}<button className={button} onClick={() => { setService(true); setEditing(null); }}>Registrar servicio</button></div></article><article className={card}><h3 className="font-semibold">Estado de mantenimiento</h3><div className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><p className="text-stone-500">Último mantenimiento registrado</p><p className="mt-1">{dateLabel(equipmentMaintenanceSummary(equipment.services).lastService)}</p></div><div><p className="text-stone-500">Próximo servicio registrado</p><p className="mt-1">{dateLabel(equipmentMaintenanceSummary(equipment.services).nextService)}</p></div></div><p className="mt-4 text-xs leading-5 text-stone-500">El estado se basa solo en las fechas registradas. No representa un diagnóstico técnico. «Próximo servicio» corresponde a los siguientes 30 días.</p></article>{editing && <form className={card} onSubmit={e => { e.preventDefault(); void save({ action: "save", equipment: editing }); }}><h3 className="mb-5 font-semibold">Editar equipo</h3><EquipmentFields value={editing} change={setEditing} busy={busy || photoBusy} onPhotoBusy={setPhotoBusy} /><div className="mt-5 flex gap-3"><button disabled={busy || photoBusy} className={button}>Guardar cambios</button><button type="button" disabled={busy} className={secondary} onClick={() => setEditing(null)}>Cancelar</button></div></form>}{service && <ServiceForm busy={busy} onSave={value => save({ action: "service", equipmentId: equipment.id, service: value })} onCancel={() => setService(false)} />}<article className={card}><h3 className="text-lg font-semibold">Historial de servicios</h3>{equipment.services.length ? <ol className="mt-5 divide-y divide-stone-100">{equipment.services.map(record => <li key={record.id} className="py-5 first:pt-0"><p className="text-xs font-semibold uppercase text-[#8A6200]">{dateLabel(record.service_date)}</p><h4 className="mt-2 font-semibold">{record.type}</h4><p className="mt-1 text-sm text-stone-500">{record.provider || "Empresa o técnico sin registrar"}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{record.description}</p>{record.next_service_date && <p className="mt-3 text-xs text-stone-500">Próximo servicio sugerido: {dateLabel(record.next_service_date)}</p>}{record.photo_path && <a href={photoUrl(record.photo_path)} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm underline">Ver evidencia</a>}</li>)}</ol> : <p className="mt-4 text-sm text-stone-500">Aún no hay servicios registrados para este equipo.</p>}</article></> : <>
    {onboarding && <div className={card}><h3 className="text-xl font-semibold">Agrega los equipos principales de tu propiedad</h3><p className="mt-3 text-sm leading-6 text-stone-500">Tu Pasaporte Solar incluye 3 registros de equipos. Selecciona los que quieres registrar; después puedes contactar a SOLARIS para conocer precios y adquirir más registros.</p>{drafts ? <form onSubmit={e => { e.preventDefault(); void save({ action: "initialize", equipment: drafts }); }}><div className="mt-6 space-y-7">{drafts.map((draft,index) => <div key={index}><h4 className="mb-4 font-semibold">{index+1}. {draft.type}</h4><EquipmentFields value={draft} busy={busy || photoBusy} onPhotoBusy={setPhotoBusy} change={value => setDrafts(drafts.map((d,i) => i === index ? value : d))} /></div>)}</div><p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Revisa los datos. Al finalizar, solo SOLARIS podrá editar los equipos, aunque registres menos de tres.</p><div className="mt-5 flex flex-wrap gap-3"><button disabled={busy || photoBusy} className={button}>{busy ? "Guardando…" : "Finalizar configuración"}</button><button disabled={busy} type="button" className={secondary} onClick={() => setDrafts(null)}>Volver a selección</button></div></form> : <><h4 className="mt-6 font-semibold">¿Qué equipos quieres agregar?</h4><p role="status" className="mt-2 text-sm text-stone-500">{selected.length} / {EQUIPMENT_LIMIT} equipos seleccionados</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{equipmentTypes.map(type => { const checked = selected.includes(type); return <button key={type} type="button" aria-pressed={checked} disabled={busy || (!checked && selected.length >= EQUIPMENT_LIMIT)} onClick={() => setSelected(checked ? selected.filter(t => t !== type) : [...selected,type])} className={`min-h-28 rounded-2xl border p-3 text-left text-xs font-medium disabled:opacity-50 ${checked ? "border-[#F4B400] bg-[#FFF6D9]" : "border-stone-200 bg-white"}`}><EquipmentIllustration type={type} compact />{type}</button>; })}</div>{selected.length === EQUIPMENT_LIMIT && <p className="mt-3 text-sm text-[#8A6200]">Has seleccionado tus 3 equipos incluidos.</p>}<div className="mt-6 flex flex-wrap gap-3"><button disabled={!selected.length || busy} className={button} onClick={() => setDrafts(selected.map(empty))}>Continuar</button><button disabled={busy} className={secondary} onClick={() => void save({ action: "skip" })}>Configurar después</button></div></>}</div>}
    {!onboarding && !admin && !data.completed && <button className={button} onClick={() => setSetup(true)}>Configurar mis equipos</button>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.equipment.map(equipment => { const summary = equipmentMaintenanceSummary(equipment.services); return <article key={equipment.id} className={card}><EquipmentIllustration type={equipment.type} /><p className="text-xs text-stone-500">{equipment.type}</p><h3 className="mt-1 break-words text-lg font-semibold">{equipment.name}</h3><div className="mt-4 space-y-3 text-sm"><p><span className="block text-xs text-stone-500">Último mantenimiento</span>{dateLabel(summary.lastService)}</p><p><span className="block text-xs text-stone-500">Próximo servicio registrado</span>{dateLabel(summary.nextService)}</p><Status equipment={equipment} /></div><button className={`${secondary} mt-5 w-full`} onClick={() => setActive(equipment.id)}>Ver equipo</button></article>; })}</div>
    {admin && <><button disabled={busy} className={button} onClick={() => setEditing(empty("Aire acondicionado"))}><Plus className="size-4" />{data.equipment.length >= EQUIPMENT_LIMIT ? "Agregar equipo de ampliación" : "Agregar equipo"}</button>{editing && <form className={card} onSubmit={e => { e.preventDefault(); void save({ action: "save", equipment: editing }); }}><h3 className="mb-5 font-semibold">Agregar equipo</h3><EquipmentFields value={editing} change={setEditing} busy={busy || photoBusy} onPhotoBusy={setPhotoBusy} /><div className="mt-5 flex gap-3"><button disabled={busy || photoBusy} className={button}>Guardar equipo</button><button type="button" className={secondary} onClick={() => setEditing(null)}>Cancelar</button></div></form>}</>}
    {!admin && data.completed && <p className="text-sm text-stone-500">Configuración completada. SOLARIS administra los cambios y los registros adicionales.</p>}{!admin && <aside className={card}><h3 className="font-semibold">¿Quieres registrar más equipos?</h3><p className="mt-2 text-sm leading-6 text-stone-500">Tu Pasaporte incluye 3 registros. Contáctanos para conocer precios y adquirir una ampliación.</p><a href={equipmentExpansionUrl(data.systemCode)} target="_blank" rel="noopener noreferrer" className={`${button} mt-4`}>Consultar ampliación por WhatsApp</a></aside>}{admin && <p className="text-sm text-stone-500">Incluye 3 registros. Después de acordar una ampliación con el cliente, añade aquí los equipos adquiridos.</p>}</>}
  </section>;
}

function ServiceForm({ busy, onSave, onCancel }: { busy: boolean; onSave: (value: Record<string, unknown>) => Promise<boolean>; onCancel: () => void }) {
  const [id] = useState(() => crypto.randomUUID());
  const [photo, setPhoto] = useState<string>();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); await onSave({ ...values, id, photo }); }
  return <form className={card} onSubmit={submit}><h3 className="mb-5 text-lg font-semibold">Registrar servicio</h3><fieldset disabled={busy || processing} className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Fecha del servicio<input name="service_date" type="date" required max={equipmentToday()} defaultValue={equipmentToday()} className={field} /></label><label className="text-sm font-medium">Tipo de servicio<select name="type" required className={field}>{equipmentServiceTypes.map(type => <option key={type}>{type}</option>)}</select></label><label className="text-sm font-medium">Empresa o técnico<input name="provider" maxLength={150} className={field} /></label><label className="text-sm font-medium">Próxima fecha sugerida (opcional)<input name="next_service_date" type="date" className={field} /></label><label className="text-sm font-medium sm:col-span-2">Descripción breve del trabajo realizado<textarea required name="description" rows={3} maxLength={2000} className={field} /></label>{EQUIPMENT_PHOTOS_ENABLED && <label className="text-sm font-medium sm:col-span-2">Fotografía/evidencia (opcional)<input type="file" accept="image/jpeg,image/png,image/webp" className={field} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; setProcessing(true); setError(""); try { setPhoto(await preparePhoto(file)); } catch (error) { setError((error as Error).message); } finally { setProcessing(false); } }} />{photo && <button type="button" className="mt-2 text-xs underline" onClick={() => setPhoto(undefined)}>Quitar fotografía preparada</button>}{error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</label>}<div className="flex flex-wrap gap-3 sm:col-span-2"><button className={button}>{busy ? "Guardando…" : processing ? "Preparando imagen…" : "Guardar registro"}</button><button type="button" className={secondary} onClick={onCancel}>Cancelar</button></div></fieldset></form>;
}

function EquipmentPhoto({src,name}: {src:string;name:string}) { const [failed,setFailed]=useState(false);return failed ? <p className="mt-4 text-sm text-stone-500">Fotografía temporalmente no disponible.</p> : <Image src={src} alt={`Fotografía de ${name}`} width={600} height={400} unoptimized onError={()=>setFailed(true)} className="mt-5 max-h-72 w-full rounded-2xl object-contain bg-stone-50" />; }
