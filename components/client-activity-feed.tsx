"use client";

import { useState } from "react";
import { Camera, ChevronDown, FileText, History, Sparkles } from "lucide-react";
import type { SolarSystem, SystemDocument } from "@/data/system";

type Filter = "Todo" | "Mantenimientos" | "Fotografías" | "Documentos";
const filters: Filter[] = ["Todo", "Mantenimientos", "Fotografías", "Documentos"];
const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function serviceTime(label: string) {
  const match = label.match(/(\d{1,2}) de (\w+) de (\d{4})/);
  return match && months.includes(match[2]) ? Date.UTC(Number(match[3]), months.indexOf(match[2]), Number(match[1]), 12) : 0;
}
function isPhoto(doc: SystemDocument) {
  return /foto|imagen|galer[ií]a|png|jpe?g|webp/i.test(`${doc.type} ${doc.name}`);
}
function imageUrl(doc: SystemDocument) {
  return doc.fileUrl && /\.(png|jpe?g|webp|gif|avif)(?:[?#]|$)/i.test(doc.fileUrl) ? doc.fileUrl : null;
}

export function ClientActivityFeed({ system }: { system: SolarSystem }) {
  const [filter, setFilter] = useState<Filter>("Todo");
  const [limit, setLimit] = useState(6);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const events = [
    ...system.maintenanceHistory.map((service, index) => ({
      key: `service-${service.id || index}`, category: "Mantenimientos" as Filter,
      title: service.type, date: service.date, time: serviceTime(service.date), service, doc: null,
    })),
    ...system.documents.map((doc, index) => ({
      key: `document-${doc.fileUrl || index}`, category: (isPhoto(doc) ? "Fotografías" : "Documentos") as Filter,
      title: doc.name, date: doc.publishedAt && Number.isFinite(Date.parse(doc.publishedAt))
        ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" }).format(new Date(doc.publishedAt)) : "Fecha no disponible",
      time: doc.publishedAt ? Date.parse(doc.publishedAt) || 0 : 0, service: null, doc,
    })),
  ].sort((a, b) => b.time - a.time);
  const visible = events.filter(event => filter === "Todo" || event.category === filter);

  return <section aria-labelledby="activity-title" className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4"><div>
      <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-[#8A6200]"><Sparkles className="size-4" /> Tu expediente al día</p>
      <h2 id="activity-title" className="text-2xl font-semibold tracking-tight md:text-3xl">Actividad de tu vivienda</h2>
      <p className="mt-2 text-sm text-stone-500">Servicios, fotografías y documentos publicados por Solaris.</p>
    </div><span className="rounded-full border border-stone-200 bg-white px-3 py-2 text-xs text-stone-500">{events.length} publicaciones</span></div>
    <div className="flex flex-wrap gap-2" aria-label="Filtrar actividad">{filters.map(item => <button key={item} type="button" aria-pressed={filter === item} onClick={() => { setFilter(item); setLimit(6); }} className={`rounded-full border px-4 py-2.5 text-sm font-medium transition motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F4B400] ${filter === item ? "border-[#F4B400]/60 bg-[#06131B] text-[#FFD966] shadow-[0_0_24px_rgba(244,180,0,.22)]" : "border-stone-200 bg-white text-stone-600 hover:border-[#F4B400] hover:bg-[#FFF6D9]"}`}>{item}</button>)}</div>
    <p className="sr-only" role="status">{visible.length} publicaciones en {filter}</p>
    {visible.length === 0 ? <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-10 text-center"><History className="mx-auto size-7 text-[#8A6200]" /><h3 className="mt-4 font-semibold">{events.length ? "Sin publicaciones en esta categoría" : "Aquí comienza la historia de tu sistema"}</h3><p className="mt-2 text-sm leading-6 text-stone-500">Las novedades aparecerán aquí cuando Solaris registre un servicio o publique archivos.</p></div> : <div className="grid items-start gap-4 lg:grid-cols-2">{visible.slice(0, limit).map(event => {
      const Icon = event.service ? History : event.category === "Fotografías" ? Camera : FileText;
      const preview = event.doc ? imageUrl(event.doc) : null;
      return <article key={event.key} className="overflow-hidden rounded-3xl border border-stone-200 bg-white transition duration-300 hover:border-[#F4B400]/60 hover:shadow-[0_12px_35px_rgba(6,19,27,.07)] motion-reduce:transition-none">
        {preview && !failedImages.includes(preview) && <a href={preview} target="_blank" rel="noreferrer" className="group block overflow-hidden bg-stone-100" aria-label={`Abrir fotografía: ${event.title}`}><img src={preview} alt={event.title} loading="lazy" onError={() => setFailedImages(previous => [...previous, preview])} className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.025] motion-reduce:transform-none motion-reduce:transition-none" /></a>}
        <div className="p-5 md:p-6"><div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#FFF6D9] text-[#8A6200]"><Icon className="size-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A6200]">{event.category}</p><p className="mt-1 text-xs text-stone-500">{event.date}</p></div></div>
          <h3 className="mt-4 break-words text-lg font-semibold">{event.title}</h3>
          {event.service ? <><p className="mt-2 text-sm text-stone-500">Completado · {event.service.technician}</p><details className="group mt-4 border-t border-stone-100 pt-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg text-sm font-semibold text-[#8A6200] focus-visible:outline-2 focus-visible:outline-[#F4B400]">Ver detalles del servicio <ChevronDown className="size-4 transition group-open:rotate-180 motion-reduce:transition-none" /></summary><div className="mt-4 space-y-3 text-sm leading-6 text-stone-600">{event.service.work && <p className="whitespace-pre-wrap">{event.service.work}</p>}{event.service.findings && <p className="whitespace-pre-wrap"><strong>Observaciones: </strong>{event.service.findings}</p>}{event.service.recommendations && <p className="whitespace-pre-wrap"><strong>Recomendaciones: </strong>{event.service.recommendations}</p>}{!event.service.work && !event.service.findings && !event.service.recommendations && <p>Servicio registrado sin notas adicionales.</p>}</div></details></> : <><p className="mt-2 text-sm text-stone-500">{event.doc?.type} · Archivo del expediente</p>{event.doc?.fileUrl ? <a href={event.doc.fileUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-10 items-center rounded-full border border-[#F4B400]/40 bg-[#FFF6D9] px-4 text-sm font-semibold text-[#8A6200] transition hover:shadow-[0_0_20px_rgba(244,180,0,.25)]">{preview ? "Ampliar fotografía" : "Abrir archivo"}</a> : <p className="mt-4 text-xs text-stone-500">Archivo aún no disponible para abrir.</p>}</>}
        </div>
      </article>;
    })}</div>}
    {visible.length > limit && <button type="button" onClick={() => setLimit(value => value + 6)} className="mx-auto block rounded-full border border-stone-200 bg-white px-6 py-3 text-sm font-semibold hover:border-[#F4B400]">Ver más actividad ({visible.length - limit})</button>}
  </section>;
}
