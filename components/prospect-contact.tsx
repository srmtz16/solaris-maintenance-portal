"use client";
import { useEffect, useState } from "react";
import { MessageCircle, ArrowUpRight } from "lucide-react";
import { contactTopic, contactTopics, whatsappUrl, type ContactTopic } from "@/lib/prospect-contact";

export function FloatingQuote({ whatsapp, topic = "Orientación" }: { whatsapp: string; topic?: ContactTopic }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target));
      setHidden(visible.size > 0);
    });
    document.querySelectorAll("#hero, #contacto, .landing-footer").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [topic]);
  return <a href={whatsappUrl(whatsapp, topic)} target="_blank" rel="noreferrer" className="landing-floating" hidden={hidden}><MessageCircle size={20} aria-hidden="true" />{topic === "Mantenimiento" ? "Cotiza tu mantenimiento" : "Hablemos por WhatsApp"}<ArrowUpRight size={18} aria-hidden="true" /></a>;
}
export function ProspectContact({ whatsapp, initialTopic = "Orientación" }: { whatsapp: string; initialTopic?: ContactTopic }) {
  const [topic, setTopic] = useState<ContactTopic>(initialTopic);
  const [prepared, setPrepared] = useState("");
  return <form className="landing-form" onChange={() => setPrepared("")} onSubmit={event => {
    event.preventDefault();
    const url = whatsappUrl(whatsapp, topic, new FormData(event.currentTarget));
    setPrepared(url);
    window.open(url, "_blank", "noopener,noreferrer");
  }}>
    <h2>Cuéntanos qué necesitas</h2>
    <label>¿En qué podemos ayudarte?<select name="service" value={topic} onChange={event => setTopic(contactTopic(event.target.value))}>{contactTopics.map(item => <option key={item} value={item}>{item === "Orientación" ? "No sé qué necesito / Quiero orientación" : item}</option>)}</select></label>
    <div className="landing-fields">
      <label>Nombre<input required name="name" autoComplete="name" maxLength={100} pattern={".*\\S.*"} /></label>
      <label>Teléfono<input required name="phone" type="tel" inputMode="tel" autoComplete="tel" minLength={10} maxLength={20} pattern={"[+0-9\\s\\(\\)\\-]{10,20}"} /></label>
      <label className={topic !== "Mantenimiento" ? "field-wide" : ""}>Zona / ubicación general<input required name="zone" autoComplete="address-level2" maxLength={150} placeholder="Ciudad o colonia" pattern={".*\\S.*"} /></label>
      {topic === "Mantenimiento" && <>
        <label>Número aproximado de paneles<input required name="panels" type="number" inputMode="numeric" min={1} max={100000} step={1} /></label>
        <label>Tipo de instalación<select required name="installation" defaultValue=""><option value="" disabled>Selecciona</option><option>Residencial</option><option>Comercial</option></select></label>
        <label>¿Presenta alguna falla?<select required name="failure" defaultValue=""><option value="" disabled>Selecciona</option><option>Sí</option><option>No</option><option>No lo sé</option></select></label>
      </>}
    </div>
    <label>Comentarios <span>(opcional)</span><textarea name="comments" maxLength={1500} rows={3} placeholder={topic === "Gestoría" ? "Cuéntanos qué trámite necesitas o en qué etapa estás." : "Cuéntanos un poco sobre tu sistema o tu consulta."} /></label>
    <button type="submit" className="landing-primary">{topic === "Mantenimiento" ? "Solicitar cotización" : "Solicitar orientación"}<ArrowUpRight size={18} aria-hidden="true" /></button>
    <p className="landing-form-note">Se abrirá WhatsApp con tu mensaje preparado; tú confirmas el envío. La fecha, el alcance y el precio se acuerdan con nuestro equipo. <a href="/aviso-de-privacidad">Aviso de privacidad</a>.</p>
    {prepared && <p role="status" className="landing-form-status">Tu mensaje está preparado. Si no se abrió WhatsApp, <a href={prepared} target="_blank" rel="noreferrer">continúa aquí</a> y pulsa Enviar.</p>}
  </form>;
}
