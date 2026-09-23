import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Sun, FileText, History, FolderOpen } from "lucide-react";
import { MarketingNav } from "./marketing-nav";
import { FloatingQuote } from "./prospect-contact";
import { SOLARIS_WHATSAPP, type ContactTopic } from "@/lib/prospect-contact";
import "@/app/landing.css";

export function marketingMetadata(title: string, description: string, path: string): Metadata {
  return { title, description, alternates: { canonical: `https://solaris-maintenance-portal.vercel.app${path}` }, openGraph: { title, description, url: `https://solaris-maintenance-portal.vercel.app${path}`, siteName: "SOLARIS Energy Solutions", type: "website", locale: "es_MX" } };
}
export function MarketingSite({ children, topic = "Orientación" }: { children: React.ReactNode; topic?: ContactTopic }) {
  return <div className="solaris-landing"><a className="landing-skip" href="#contenido">Saltar al contenido</a><MarketingNav /><main id="contenido" tabIndex={-1}>{children}</main><footer className="landing-footer"><div className="landing-wrap footer-grid"><div><Link href="/" className="landing-brand">SOLARIS<span>ENERGY SOLUTIONS</span></Link><p>Iluminando el mañana</p><span className="footer-location">Yucatán, México</span></div><nav aria-label="Enlaces del sitio"><Link href="/pasaporte-solar">Pasaporte Solar</Link><Link href="/mantenimiento">Mantenimiento</Link><Link href="/gestoria">Gestoría</Link><Link href="/contacto">Contacto</Link></nav><div className="footer-contact"><a href="tel:+527778311043">777 831 1043</a><a href="mailto:solarisenergysolutions.mx@gmail.com">solarisenergysolutions.mx@gmail.com</a><p>¿Ya eres cliente? Abre tu enlace personal o escanea el QR de tu sistema.</p></div></div><div className="landing-wrap footer-bottom"><span>© {new Date().getFullYear()} SOLARIS Energy Solutions</span><div><Link href="/aviso-de-privacidad">Privacidad</Link><Link href="/admin">Administración</Link></div></div></footer><FloatingQuote whatsapp={SOLARIS_WHATSAPP} topic={topic} /></div>;
}
export function Action({ href, children, secondary = false }: { href: string; children: React.ReactNode; secondary?: boolean }) {
  return <Link href={href} className={secondary ? "landing-secondary" : "landing-primary"}>{children}<ArrowUpRight size={18} aria-hidden="true" /></Link>;
}
export function ContactBand({ title = "El siguiente paso empieza con una conversación.", text = "Cuéntanos sobre tu sistema o tu trámite. Te ayudamos a identificar qué necesitas.", topic = "Orientación" }: { title?: string; text?: string; topic?: ContactTopic }) {
  return <section id="contacto" className="contact-band"><div className="landing-wrap"><div><p className="landing-eyebrow">Hablemos de tu proyecto</p><h2>{title}</h2><p>{text}</p></div><Action href={`/contacto?servicio=${encodeURIComponent(topic)}`}>{topic === "Mantenimiento" ? "Solicitar cotización" : "Solicitar orientación"}</Action></div></section>;
}
export function FAQ({ questions }: { questions: string[][] }) {
  return <div className="landing-faq">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>;
}
// Brand illustration, not a customer record or a working QR code.
export function PassportArtwork() {
  return <div className="passport-art" aria-label="Pasaporte Solar: expediente digital de tu sistema" role="img"><div className="passport-orbit" /><div className="passport-sheet sheet-back" /><div className="passport-sheet sheet-front"><div className="passport-cover-top"><span>SOLARIS<small>ENERGY SOLUTIONS</small></span><Sun aria-hidden="true" /></div><div className="passport-cover-title">PASAPORTE<br /><strong>SOLAR</strong></div><div className="passport-cover-lines" /><p>Tu sistema.<br />Su historia.</p><div className="passport-cover-bottom"><span>EXPEDIENTE DIGITAL</span><ArrowUpRight aria-hidden="true" /></div></div><div className="passport-caption"><span>La historia de tu sistema,<br /><strong>a un escaneo.</strong></span></div></div>;
}
export function SolarIllustration() {
  return <div className="landing-solar-art" aria-hidden="true"><div className="landing-art-heading"><span>EL FUTURO SE CUIDA HOY</span><Sun /></div><div className="landing-panel-array">{Array.from({ length: 9 }, (_, i) => <div className="landing-solar-panel" key={i} />)}</div><div className="landing-art-footer"><span>Energía hoy.</span><span>Tranquilidad mañana.</span></div></div>;
}
export const passportBenefits = [
  { icon: History, title: "Historial y seguimiento", text: "Consulta los mantenimientos registrados, las recomendaciones y la próxima fecha de servicio publicada." },
  { icon: FileText, title: "Fotografías y reportes", text: "Revisa las evidencias y los hallazgos que SOLARIS documenta en cada servicio." },
  { icon: FolderOpen, title: "Documentación organizada", text: "Encuentra los documentos, diagramas y garantías disponibles en tu expediente." },
];
