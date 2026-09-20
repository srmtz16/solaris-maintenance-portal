"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

export function ProspectContact({ whatsapp }: { whatsapp: string }) {
  const [message, setMessage] = useState("");
  return <form onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!whatsapp) { setMessage("El canal de atención estará disponible próximamente."); return; }
    const text = `Hola, Solaris. Me gustaría solicitar ${data.get("request")}.\n\nNombre: ${String(data.get("name")).trim()}\nZona: ${String(data.get("zone")).trim()}\nServicio: ${data.get("service")}\n\n${String(data.get("details")).trim()}`;
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    setMessage("Se abrió WhatsApp con tu solicitud preparada. Pulsa Enviar allí para compartirla con Solaris. La visita queda pendiente de confirmación.");
  }} className="space-y-5 rounded-[2rem] border border-stone-200 bg-white p-6 text-stone-900 md:p-9">
    <h3 className="text-2xl font-semibold tracking-tight">Cuéntanos qué necesitas</h3>
    <p className="text-sm leading-6 text-stone-500">Prepara tu solicitud y envíala directamente a nuestro equipo por WhatsApp.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Tu nombre<input required name="name" autoComplete="given-name" maxLength={100} className="mt-2 w-full rounded-xl border border-stone-200 p-3 focus:outline-[#F4B400]" /></label>
      <label className="text-sm font-medium">Ciudad o zona<input required name="zone" autoComplete="address-level2" maxLength={150} placeholder="¿Dónde necesitas el servicio?" className="mt-2 w-full rounded-xl border border-stone-200 p-3 focus:outline-[#F4B400]" /></label>
      <label className="text-sm font-medium">Quiero solicitar<select name="request" className="mt-2 w-full rounded-xl border border-stone-200 bg-white p-3"><option>una cotización</option><option>una visita</option><option>más información</option></select></label>
      <label className="text-sm font-medium">Servicio<select name="service" className="mt-2 w-full rounded-xl border border-stone-200 bg-white p-3"><option>Mantenimiento fotovoltaico</option><option>Revisión y diagnóstico</option><option>Gestoría de interconexión</option><option>Trámite de nuevo servicio</option><option>Cambio a medidor bidireccional</option><option>Necesito orientación</option></select></label>
    </div>
    <label className="block text-sm font-medium">Detalles <span className="font-normal text-stone-400">(opcional)</span><textarea name="details" maxLength={1500} rows={4} placeholder="Cuéntanos sobre tu instalación o el trámite que necesitas." className="mt-2 w-full rounded-xl border border-stone-200 p-3 focus:outline-[#F4B400]" /></label>
    <p className="text-xs leading-5 text-stone-500">El formulario prepara un mensaje; los datos se comparten cuando tú lo envías por WhatsApp. Evita incluir documentos personales o datos de tu cuenta en esta primera consulta.</p>
    <button disabled={!whatsapp} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#F4B400] px-5 py-4 font-semibold text-[#06131B] transition hover:bg-[#FFD966] hover:shadow-[0_0_30px_#F4B40055] disabled:opacity-50">Continuar en WhatsApp <ArrowUpRight className="size-4" /></button>
    {message && <p role="status" className="rounded-xl bg-[#FFF6D9] p-4 text-sm leading-6">{message}</p>}
  </form>;
}
