"use client";
import { useEffect, useState } from "react";

function whatsappUrl(phone: string, form?: FormData) {
  const value = (key: string) => String(form?.get(key) || "").trim();
  const message = ["Hola, quiero cotizar un mantenimiento para mi sistema fotovoltaico.", "", `Número aproximado de paneles: ${value("panels")}`, `Zona: ${value("zone")}`, `¿Presenta alguna falla? ${value("failure") || "Sí / No"}`, ...(form ? ["", `Nombre: ${value("name")}`, `Teléfono: ${value("phone")}`, `Tipo de instalación: ${value("installation")}`, ...(value("comments") ? [`Comentarios: ${value("comments")}`] : [])] : [])].join("\n");
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
export function FloatingQuote({ whatsapp }: { whatsapp: string }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const visible = new Set<string>();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.isIntersecting ? visible.add(entry.target.id) : visible.delete(entry.target.id));
      setHidden(visible.size > 0);
    });
    ["hero", "contacto"].forEach(id => { const element = document.getElementById(id); if (element) observer.observe(element); });
    return () => observer.disconnect();
  }, []);
  return <a href={whatsappUrl(whatsapp)} target="_blank" rel="noreferrer" className="landing-floating" hidden={hidden}>Cotiza tu mantenimiento <span aria-hidden="true">↗</span></a>;
}
export function ProspectContact({ whatsapp }: { whatsapp: string }) {
  const [prepared, setPrepared] = useState("");
  return <form className="landing-form" onChange={() => setPrepared("")} onSubmit={event => {
    event.preventDefault();
    const url = whatsappUrl(whatsapp, new FormData(event.currentTarget));
    setPrepared(url);
    window.open(url, "_blank", "noopener,noreferrer");
  }}>
    <h3>Cuéntanos sobre tu sistema</h3>
    <div className="landing-fields">
      <label>Nombre<input required name="name" autoComplete="name" maxLength={100} pattern={".*\\S.*"} /></label>
      <label>Teléfono<input required name="phone" type="tel" inputMode="tel" autoComplete="tel" minLength={10} maxLength={20} pattern={"[+0-9\\s\\(\\)\\-]{10,20}"} /></label>
      <label>Número aproximado de paneles<input required name="panels" type="number" inputMode="numeric" min={1} max={100000} step={1} /></label>
      <label>Zona / ubicación general<input required name="zone" autoComplete="address-level2" maxLength={150} placeholder="Ciudad o colonia" pattern={".*\\S.*"} /></label>
      <label>Tipo de instalación<select required name="installation" defaultValue=""><option value="" disabled>Selecciona</option><option>Residencial</option><option>Comercial</option></select></label>
      <label>¿Presenta alguna falla?<select required name="failure" defaultValue=""><option value="" disabled>Selecciona</option><option>Sí</option><option>No</option></select></label>
    </div>
    <label>Comentarios <span>(opcional)</span><textarea name="comments" maxLength={1500} rows={3} placeholder="Describe la falla o indica si necesitas una visita, otro servicio o más información." /></label>
    <p className="landing-form-note">Prepararemos tu mensaje para WhatsApp. Tú confirmas el envío; la fecha y el precio se acuerdan con nuestro equipo.</p>
    <button type="submit" className="landing-primary">Solicitar cotización <span aria-hidden="true">↗</span></button>
    {prepared && <p role="status" className="landing-form-status">Tu solicitud está preparada. Si no se abrió WhatsApp, <a href={prepared} target="_blank" rel="noreferrer">continúa aquí</a> y pulsa Enviar.</p>}
  </form>;
}
