"use client";

import {
  ArrowRight, CalendarDays, Camera, Check, ChevronRight, ClipboardCheck,
  FileText, FolderOpen, Headphones, History, Home, Images, LayoutGrid,
  MessageSquareText, ShieldCheck, Sparkles, Sun, Wrench, X, Inbox,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { SolarSystem, SystemDocument } from "@/data/system";

export type SystemPortalView = "inicio" | "historial" | "documentos" | "soporte";

const navItems = [
  { label: "Inicio", icon: Home, section: "" },
  { label: "Historial", icon: History, section: "historial" },
  { label: "Documentos", icon: FolderOpen, section: "documentos" },
  { label: "Soporte", icon: Headphones, section: "soporte" },
] as const;

const portalHref = (id: string, section: string) => `/s/${id}${section ? `/${section}` : ""}`;

function Header({ id, portalKey }: { id: string; portalKey: string }) {
  const pathname = usePathname();
  return <header className="border-b border-stone-200/80 bg-[#faf9f6]/90 backdrop-blur-xl">
    <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
      <Link href={portalHref(portalKey, "")} className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-full bg-[#171713] text-[#d5b66f]"><Sun className="size-5" /></div><div><div className="text-sm font-semibold tracking-[.18em] text-stone-900">SOLARIS</div><div className="text-[10px] uppercase tracking-[.2em] text-stone-500">Mi hogar solar</div></div></Link>
      <nav className="hidden items-center gap-1 md:flex" aria-label="Secciones del portal">{navItems.map(({ label, section }) => { const href = portalHref(portalKey, section); const active = pathname === href; return <Link key={label} href={href} aria-current={active ? "page" : undefined} style={active ? { backgroundColor: "#1c1917", color: "#ffffff" } : undefined} className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${active ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-white hover:text-stone-900"}`}>{label}</Link>; })}</nav>
      <div className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600">Vivienda · {id}</div>
    </div>
  </header>;
}

function SystemSummary({ system }: { system: SolarSystem }) {
  const items = [["Potencia instalada", system.installedPower], ["Fecha de instalación", system.installationDate], ["Último mantenimiento", system.lastMaintenance], ["Próximo recomendado", system.nextMaintenance]];
  return <section id="inicio" className="scroll-mt-6">
    <div className="mb-8 md:mb-10"><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-[#9b7835]"><Sparkles className="size-3.5" /> Vivienda vinculada</div><h1 className="max-w-3xl text-3xl font-medium leading-[1.08] tracking-[-.04em] text-[#171713] md:text-5xl">{system.clientName ? <>{system.welcomeLabel}, {system.clientName}</> : "Tu sistema fotovoltaico"}</h1><p className="mt-4 max-w-xl text-sm leading-6 text-stone-500 md:text-base">Expediente, servicios y documentos asociados al QR de esta vivienda.</p></div>
    <div className="grid overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_18px_50px_rgba(28,25,20,.06)] sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value], index) => <div key={label} className={`p-5 md:p-6 ${index ? "border-t border-stone-100 sm:border-t-0 sm:border-l" : ""} ${index === 2 ? "sm:border-l-0 sm:border-t lg:border-l lg:border-t-0" : ""}`}><div className="mb-3 text-[11px] font-semibold uppercase tracking-[.14em] text-stone-400">{label}</div><div className="text-lg font-semibold tracking-tight text-stone-900">{value}</div></div>)}
    </div>
  </section>;
}

function NextMaintenance({ system, onRequest }: { system: SolarSystem; onRequest: (type: RequestType) => void }) {
  return <section className="relative overflow-hidden rounded-[2rem] bg-[#191914] p-6 text-white shadow-[0_20px_60px_rgba(20,20,15,.16)] md:p-10">
    <div className="absolute -right-16 -top-20 size-56 rounded-full bg-[#d6b76f]/15 blur-2xl" /><div className="relative grid gap-8 md:grid-cols-[1fr_auto] md:items-end"><div><div className="mb-5 flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#d6b76f]"><CalendarDays className="size-5" /></div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#d6b76f]">Próximo mantenimiento</p><h2 className="mt-2 text-3xl font-medium tracking-[-.03em] md:text-4xl">{system.nextMaintenance}</h2><p className="mt-3 text-sm text-stone-400">Mantenimiento preventivo recomendado</p></div><div className="grid gap-3 sm:grid-cols-2 md:min-w-[420px]"><button onClick={() => onRequest("maintenance")} className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#d6b76f] px-6 text-sm font-semibold text-[#191914] transition hover:bg-[#e2c682]">Solicitar mantenimiento <ArrowRight className="size-4" /></button><button onClick={() => onRequest("failure")} className="flex h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 text-sm font-semibold text-white transition hover:bg-white/10"><Headphones className="size-4" /> Reportar falla</button></div></div>
  </section>;
}

function MaintenanceHistory({ system, portalKey, notify }: { system: SolarSystem; portalKey: string; notify: (message: string) => void }) {
  if (!system.maintenanceHistory.length) return <section id="historial" className="scroll-mt-8"><SectionHeading eyebrow="Trazabilidad" title="Historial de mantenimiento" /><EmptyState icon={History} title="Aún no hay servicios registrados" description="Cuando se complete el primer servicio, aparecerá aquí con sus evidencias." /></section>;
  const chipClass = "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-600 transition hover:border-[#c8a65c] hover:bg-[#f7f1e4] hover:text-[#8a682c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c8a65c]";
  return <section id="historial" className="scroll-mt-8"><SectionHeading eyebrow="Trazabilidad" title="Historial de mantenimiento" /><div className="space-y-4">{system.maintenanceHistory.map((item) => <article key={`${item.date}-${item.type}`} className="group rounded-3xl border border-stone-200 bg-white p-5 transition hover:border-stone-300 md:p-6"><div className="grid gap-5 sm:grid-cols-[112px_1fr_auto] sm:items-center"><div><div className="text-sm font-semibold text-stone-900">{item.date}</div><div className="mt-1 text-xs text-stone-400">Fecha de servicio</div></div><div className="sm:border-l sm:border-stone-100 sm:pl-6"><h3 className="font-semibold text-stone-900">{item.type}</h3><div className="mt-3 flex flex-wrap gap-2"><Link href={portalHref(portalKey, "documentos")} className={chipClass}><FileText className="size-3.5" /> Reporte</Link><Link href={portalHref(portalKey, "documentos")} className={chipClass}><Camera className="size-3.5" /> Fotografías</Link><button type="button" onClick={() => notify(item.hasObservations ? "Consulta las observaciones del último servicio en Inicio" : "Este servicio no tiene observaciones registradas")} className={chipClass}><MessageSquareText className="size-3.5" /> Observaciones</button><Link href={portalHref(portalKey, "soporte")} className={chipClass}><Wrench className="size-3.5" /> {item.technician}</Link></div></div><div className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><span className="grid size-6 place-items-center rounded-full bg-emerald-50"><Check className="size-3.5" /></span>{item.status}</div></div></article>)}</div></section>;
}

function Documents({ system, notify }: { system: SolarSystem; notify: (message: string) => void }) {
  type DocumentCategory = "diagram" | "reports" | "photos";
  const [selected, setSelected] = useState<DocumentCategory>("diagram");
  const categories = [
    { id: "diagram" as const, label: "Diagrama unifilar", description: "Plano eléctrico del sistema", icon: LayoutGrid },
    { id: "reports" as const, label: "Reportes", description: "Informes y fichas técnicas", icon: FileText },
    { id: "photos" as const, label: "Fotografías", description: "Evidencia visual publicada", icon: Images },
  ];
  const categoryFor = (doc: SystemDocument): DocumentCategory => {
    const text = `${doc.name} ${doc.type}`.toLocaleLowerCase("es-MX");
    if (text.includes("unifilar") || text.includes("diagrama")) return "diagram";
    if (["foto", "imagen", "galería", "galeria", "png", "jpg", "jpeg"].some((term) => text.includes(term))) return "photos";
    return "reports";
  };
  const visibleDocuments = system.documents.filter((doc) => categoryFor(doc) === selected);
  const activeCategory = categories.find((category) => category.id === selected)!;
  const publishedLabel = (value: string | null) => {
    if (!value) return "Fecha no disponible";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Fecha no disponible";
    return `Publicado el ${new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" }).format(date)}`;
  };
  return <section id="documentos" className="scroll-mt-8"><SectionHeading eyebrow="Expediente digital" title="Documentos del sistema" /><p className="-mt-2 mb-6 max-w-2xl text-sm leading-6 text-stone-500">Selecciona una categoría para consultar los archivos publicados por Solaris. Esta sección es de solo lectura.</p><div className="grid gap-3 md:grid-cols-3" role="tablist" aria-label="Categorías de documentos">{categories.map(({ id, label, description, icon: Icon }) => { const active = selected === id; const count = system.documents.filter((doc) => categoryFor(doc) === id).length; return <button key={id} type="button" role="tab" aria-selected={active} onClick={() => setSelected(id)} className={`flex min-h-32 items-center gap-4 rounded-3xl border p-5 text-left transition ${active ? "border-stone-900 bg-stone-900 text-white shadow-lg" : "border-stone-200 bg-white text-stone-900 hover:-translate-y-0.5 hover:border-[#c8a65c]"}`}><span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${active ? "bg-white/10 text-[#d6b76f]" : "bg-[#f4efe4] text-[#9b7835]"}`}><Icon className="size-5" /></span><span className="min-w-0 flex-1"><span className="block font-semibold">{label}</span><span className={`mt-1 block text-xs leading-5 ${active ? "text-stone-300" : "text-stone-500"}`}>{description}</span><span className={`mt-2 block text-[11px] font-semibold uppercase tracking-wider ${active ? "text-[#d6b76f]" : "text-stone-400"}`}>{count} {count === 1 ? "archivo" : "archivos"}</span></span></button>; })}</div><div className="mt-8" role="tabpanel"><div className="mb-4 flex items-center justify-between gap-4"><h3 className="text-lg font-semibold text-stone-900">{activeCategory.label}</h3><span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-500">Solo lectura</span></div>{visibleDocuments.length ? <div className="space-y-3">{visibleDocuments.map((doc, index) => <article key={`${doc.name}-${index}`} className="flex flex-col gap-4 rounded-3xl border border-stone-200 bg-white p-5 sm:flex-row sm:items-center"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f4efe4] text-[#9b7835]"><FileText className="size-5" /></span><div className="min-w-0 flex-1"><h4 className="font-semibold text-stone-900">{doc.name}</h4><p className="mt-1 text-xs text-stone-500">{doc.type} · {publishedLabel(doc.publishedAt)}</p></div>{doc.fileUrl ? <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-stone-900 px-5 text-sm font-semibold text-white transition hover:bg-stone-700">Abrir archivo <ArrowRight className="size-4" /></a> : <button type="button" onClick={() => notify("El archivo todavía no ha sido publicado")} className="inline-flex h-11 items-center justify-center rounded-full border border-stone-200 px-5 text-sm font-semibold text-stone-500 transition hover:border-stone-300 hover:text-stone-800">Pendiente de publicación</button>}</article>)}</div> : <EmptyState icon={activeCategory.icon} title={`Aún no hay ${activeCategory.label.toLocaleLowerCase("es-MX")}`} description="Cuando el administrador publique un archivo en esta categoría, aparecerá aquí con su fecha de publicación." />}</div></section>;
}

function Observations({ system }: { system: SolarSystem }) {
  return <section className="rounded-3xl border border-stone-200 bg-[#f4f1ea] p-6 md:p-8"><div className="flex gap-4"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-[#9b7835] shadow-sm"><ClipboardCheck className="size-5" /></div><div><h2 className="text-xl font-semibold tracking-tight text-stone-900">Observaciones del último servicio</h2><div className="mt-4 space-y-3">{system.observations.map((observation) => <p key={observation} className="text-sm leading-6 text-stone-600">{observation}</p>)}</div></div></div></section>;
}

function QuickActions({ id, openRequest }: { id: string; openRequest: (type: RequestType) => void }) {
  const actions = [{ label: "Solicitar mantenimiento", description: "Agenda una revisión preventiva", icon: CalendarDays, action: "maintenance" as const }, { label: "Reportar una falla", description: "Cuéntanos qué está ocurriendo", icon: Headphones, action: "failure" as const }];
  const consultations = [{ label: "Historial", description: "Consulta los servicios realizados", icon: History, href: portalHref(id, "historial") }, { label: "Documentos", description: "Revisa reportes, diagramas y fotos", icon: FolderOpen, href: portalHref(id, "documentos") }];
  const cardClass = "group flex min-h-40 flex-col justify-between rounded-3xl border border-stone-200 bg-white p-6 text-left transition hover:-translate-y-0.5 hover:border-[#c8a65c] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c8a65c]";
  return <section><SectionHeading eyebrow="Acciones principales" title="¿Qué necesitas?" /><div className="grid gap-3 sm:grid-cols-2">{actions.map(({ label, description, icon: Icon, action }) => <button key={label} onClick={() => openRequest(action)} className={cardClass}><span className="grid size-11 place-items-center rounded-2xl bg-[#f4efe4] text-[#9b7835]"><Icon className="size-5" /></span><span className="mt-8"><span className="block text-base font-semibold leading-5 text-stone-900">{label}</span><span className="mt-2 block text-sm text-stone-500">{description}</span></span></button>)}{consultations.map(({ label, description, icon: Icon, href }) => <Link key={label} href={href} className={cardClass}><span className="grid size-11 place-items-center rounded-2xl bg-[#f4efe4] text-[#9b7835]"><Icon className="size-5" /></span><span className="mt-8"><span className="flex items-center justify-between gap-3 text-base font-semibold leading-5 text-stone-900">{label}<ChevronRight className="size-4 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-[#9b7835]" /></span><span className="mt-2 block text-sm text-stone-500">{description}</span></span></Link>)}</div></section>;
}

type RequestType = "maintenance" | "failure";

function RequestDialog({ type, systemId, portalKey, close, completed }: { type: RequestType; systemId: string; portalKey: string; close: () => void; completed: (message: string) => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const title = type === "maintenance" ? "Solicitar mantenimiento" : "Reportar una falla";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/client-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ portalKey, requestType: type, preferredDate: form.get("preferredDate"), message: form.get("message"), website: form.get("website") }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok || !result.reference) { setError(result.error || "No pudimos confirmar el envío. Verifica con el equipo antes de reenviar."); return; }
      setReference(result.reference);
    } catch {
      setError("No se pudo confirmar el envío por un problema de conexión. Verifica con el equipo antes de reenviar.");
    } finally {
      setSubmitting(false);
    }
  }
  if (reference) return <div className="fixed inset-0 z-[70] grid place-items-center bg-stone-950/45 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Solicitud recibida"><div className="w-full max-w-lg rounded-[2rem] bg-[#faf9f6] p-8"><span className="mb-5 grid size-12 place-items-center rounded-full bg-emerald-100"><Check className="size-6 text-emerald-700" /></span><h2 className="text-2xl font-semibold">Solicitud recibida</h2><p className="mt-3 text-sm leading-6 text-stone-600">Un integrante del equipo revisará la solicitud y se comunicará contigo para confirmar el siguiente paso.</p><p className="mt-5 text-xs font-semibold uppercase tracking-wider text-stone-500">Folio de seguimiento</p><p className="mt-2 break-all rounded-xl border border-stone-200 bg-white p-4 font-mono text-sm">{reference}</p><button onClick={() => { completed("Solicitud enviada"); close(); }} className="mt-6 h-12 w-full rounded-full bg-stone-900 text-sm font-semibold text-white">Entendido</button></div></div>;
  return <div className="fixed inset-0 z-[70] grid place-items-end bg-stone-950/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-5" role="dialog" aria-modal="true" aria-label={title}><div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-[#faf9f6] p-6 shadow-2xl sm:max-w-lg sm:rounded-[2rem] sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#9b7835]">Vivienda {systemId}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2><p className="mt-2 text-sm leading-6 text-stone-500">Este QR identifica la vivienda y sus datos de contacto. Cuéntanos qué necesitas.</p></div><button onClick={close} aria-label="Cerrar" className="grid size-10 shrink-0 place-items-center rounded-full border border-stone-200 bg-white"><X className="size-4" /></button></div><form onSubmit={submit} className="mt-6 space-y-4"><input name="website" className="hidden" tabIndex={-1} autoComplete="off" />{type === "maintenance" && <label className="block text-sm font-medium">Fecha preferida <span className="text-stone-400">(opcional)</span><input name="preferredDate" type="date" className="mt-2 h-12 w-full rounded-xl border border-stone-200 bg-white px-4 outline-none focus:border-[#b48b43]" /></label>}<label className="block text-sm font-medium">{type === "maintenance" ? "Comentarios" : "Describe lo que sucede"}<textarea required name="message" minLength={5} maxLength={1500} rows={5} placeholder={type === "maintenance" ? "Ej. Quiero revisar el rendimiento de los paneles" : "Ej. El inversor muestra una luz roja"} className="mt-2 w-full resize-none rounded-xl border border-stone-200 bg-white p-4 outline-none focus:border-[#b48b43]" /></label>{error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}<button disabled={submitting} className="flex h-12 w-full items-center justify-center rounded-full bg-stone-900 px-5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? "Enviando…" : "Enviar solicitud"}</button></form></div></div>;
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) { return <div className="mb-5"><p className="mb-2 text-[11px] font-semibold uppercase tracking-[.18em] text-[#9b7835]">{eyebrow}</p><h2 className="text-2xl font-semibold tracking-[-.025em] text-stone-900 md:text-3xl">{title}</h2></div>; }

function EmptyState({ icon: Icon, title, description }: { icon: typeof Inbox; title: string; description: string }) { return <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f4efe4] text-[#9b7835]"><Icon className="size-5" /></span><h3 className="mt-5 font-semibold text-stone-900">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">{description}</p></div></div>; }

function MobileNavigation({ id }: { id: string }) { const pathname = usePathname(); return <nav className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-stone-200/80 bg-white/95 p-1.5 shadow-[0_12px_40px_rgba(20,20,15,.16)] backdrop-blur-xl md:hidden" aria-label="Secciones del portal"><div className="grid grid-cols-4">{navItems.map(({ label, icon: Icon, section }) => { const href = portalHref(id, section); const active = pathname === href; return <Link key={label} href={href} aria-current={active ? "page" : undefined} style={active ? { backgroundColor: "#1c1917", color: "#ffffff" } : undefined} className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-medium transition-colors ${active ? "bg-stone-900 text-white" : "text-stone-500 active:bg-stone-100"}`}><Icon className="size-4 shrink-0" /><span className="max-w-full truncate">{label}</span></Link>; })}</div></nav>; }

export function SystemPortal({ system, portalKey, view = "inicio" }: { system: SolarSystem; portalKey: string; view?: SystemPortalView }) {
  const [toast, setToast] = useState("");
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const supportWhatsApp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "");
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2200); };
  const openRequest = (type: RequestType) => setRequestType(type);
  return <div className="min-h-[100dvh] bg-[#faf9f6] text-stone-900"><Header id={system.id} portalKey={portalKey} /><main className="mx-auto min-h-[70vh] max-w-6xl space-y-12 px-5 pb-32 pt-8 md:px-8 md:pb-16 md:pt-12">{view === "inicio" && <><SystemSummary system={system} /><NextMaintenance system={system} onRequest={openRequest} /><Observations system={system} /></>}{view === "historial" && <MaintenanceHistory system={system} portalKey={portalKey} notify={notify} />}{view === "documentos" && <Documents system={system} notify={notify} />}{view === "soporte" && <QuickActions id={portalKey} openRequest={openRequest} />}</main><footer className="border-t border-stone-200 bg-white px-5 py-10 text-center text-xs text-stone-400"><div className="mb-2 flex items-center justify-center gap-2 font-semibold tracking-[.16em] text-stone-700"><ShieldCheck className="size-4 text-[#9b7835]" /> SOLARIS</div><div>Expediente de mantenimiento · {system.id}</div><div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">{supportWhatsApp ? <a href={`https://wa.me/${supportWhatsApp}`} target="_blank" rel="noreferrer" className="font-medium text-stone-600 underline decoration-stone-300 underline-offset-4">WhatsApp de soporte</a> : <Link href={portalHref(portalKey, "soporte")} className="font-medium text-stone-600 underline decoration-stone-300 underline-offset-4">Ayuda y contacto desde Soporte</Link>}<Link href={`/aviso-de-privacidad?returnTo=${encodeURIComponent(portalHref(portalKey, view === "inicio" ? "" : view))}`} className="font-medium text-stone-600 underline decoration-stone-300 underline-offset-4">Aviso de privacidad</Link></div><div className="mt-4">© 2026 Solaris · Todos los derechos reservados</div><Link href={portalHref(portalKey, "historial")} className="mt-3 inline-flex rounded-full border border-stone-200 px-3 py-1.5 font-medium text-stone-500 transition hover:border-stone-300 hover:text-stone-800">Consulta para técnicos · solo lectura</Link></footer><MobileNavigation id={portalKey} />{requestType && <RequestDialog type={requestType} systemId={system.id} portalKey={portalKey} close={() => setRequestType(null)} completed={notify} />}{toast && <div role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white shadow-xl md:bottom-8">{toast}</div>}</div>;
}
