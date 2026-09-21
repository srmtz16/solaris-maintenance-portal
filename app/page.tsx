import type { Metadata } from "next";
import Image from "next/image";
import { Sun, QrCode, Search, Wrench, ClipboardCheck, ShieldCheck } from "lucide-react";
import { ProspectContact, FloatingQuote } from "@/components/prospect-contact";
import "./landing.css";

export const metadata: Metadata = {
  title: "Mantenimiento de Paneles Solares en Mérida | SOLARIS Energy Solutions",
  description: "Mantenimiento preventivo de sistemas fotovoltaicos: inspección, limpieza, revisión y reporte de hallazgos. SOLARIS Energy Solutions.",
  openGraph: { title: "Mantenimiento profesional para tu sistema solar | SOLARIS", description: "Inspección, limpieza, revisión y reporte. Mantenimiento desde $1,500 MXN en Yucatán.", type: "website", locale: "es_MX" },
};
const includes = [
  ["Inspección inicial", "Revisamos módulos, cableado, conexiones, protecciones y el estado general visible del sistema."],
  ["Mantenimiento preventivo", "Realizamos la limpieza de los módulos y las actividades incluidas dentro del alcance contratado."],
  ["Verificación y reporte", "Documentamos el estado final, fotografías, hallazgos y recomendaciones."],
  ["Correctivos por separado", "Si detectamos una anomalía, te explicamos el problema y cotizamos la reparación antes de intervenir."],
];
const questions = [
  ["¿Cada cuánto tiempo debo dar mantenimiento a mis paneles?", "La frecuencia depende de las condiciones de la instalación y su entorno. Al revisar tu sistema te recomendamos cuándo programar el siguiente servicio."],
  ["¿El mantenimiento incluye reparaciones?", "Cualquier reparación o sustitución de componentes se informa y cotiza por separado antes de intervenir."],
  ["¿Qué pasa si encuentran un problema?", "Documentamos el hallazgo, te explicamos la anomalía y preparamos una cotización del correctivo para tu autorización."],
  ["¿Necesitan apagar el sistema?", "Lo determinamos según la instalación y las actividades a realizar. El equipo te informa antes del servicio y realiza las maniobras necesarias para trabajar de forma segura."],
  ["¿Cuánto cuesta el mantenimiento?", "El mantenimiento inicia desde $1,500 MXN. El precio depende del número de módulos, ubicación, acceso y condiciones del sistema."],
  ["¿Atienden sistemas residenciales y comerciales?", "Sí, atendemos viviendas y negocios en Yucatán. Cuéntanos dónde se encuentra tu instalación para confirmar la atención."],
  ["¿Qué es el Pasaporte Solar?", "Es el expediente digital de tu sistema. Permite consultar mantenimientos, fotografías, reportes, recomendaciones y documentación registrada por Solaris."],
];
// Add only authorized work photos. Never publish a customer's private QR.
const workPhotos: { src: string; alt: string; stage: string }[] = [];
const scopeIcons = [Search, Wrench, ClipboardCheck, ShieldCheck];

// Restore the original decorative solar illustration; it is not a work photograph.
function SolarIllustration() {
  return <div className="landing-solar-art" aria-hidden="true">
    <div className="landing-art-heading"><span>EL FUTURO SE CUIDA HOY</span><Sun /></div>
    <div className="landing-panel-array">{Array.from({ length: 9 }, (_, i) => <div className="landing-solar-panel" key={i} />)}</div>
    <div className="landing-art-footer"><span>Energía hoy.</span><span>Tranquilidad mañana.</span></div>
  </div>;
}

export default function HomePage() {
  const whatsapp = "527778311043";
  return <div className="solaris-landing">
    <a className="landing-skip" href="#contenido">Saltar al contenido</a>
    <header className="landing-nav"><div className="landing-wrap"><a href="#" className="landing-brand" aria-label="SOLARIS Energy Solutions, inicio">SOLARIS <span>ENERGY SOLUTIONS</span></a><nav aria-label="Navegación principal"><a href="#servicios">Mantenimiento</a><a href="#proceso">Proceso</a><a href="#pasaporte">Pasaporte Solar</a><a href="#contacto">Cotización</a></nav></div></header>
    <main id="contenido">
      <section id="hero" className="landing-hero"><div className="landing-wrap landing-hero-grid"><div className="landing-hero-copy"><p className="landing-eyebrow">Cuidamos tu sistema solar · Yucatán</p><h1>Mantenimiento profesional <span>para tu sistema solar.</span></h1><p className="landing-intro">Inspeccionamos, limpiamos y revisamos tu instalación fotovoltaica para conocer su estado real y detectar problemas a tiempo.</p><p className="landing-price">Mantenimiento desde <strong>$1,500 MXN</strong></p><p className="landing-fine">El precio final depende del número de módulos, ubicación, acceso y condiciones del sistema.</p><div className="landing-actions"><a className="landing-primary" href="#contacto">Solicitar cotización <span aria-hidden="true">↗</span></a><a className="landing-secondary" href="#proceso">Conocer el proceso</a></div><p className="landing-tagline">Iluminando el mañana</p></div><SolarIllustration /></div></section>
      <section className="landing-difference"><div className="landing-wrap"><h2>No solo limpiamos paneles.</h2><p>Revisamos el estado general de tu sistema, documentamos los hallazgos y te informamos si existe alguna anomalía que requiera atención.</p><p className="landing-three">Inspeccionamos <span>·</span> Limpiamos <span>·</span> Documentamos</p></div></section>
      <section id="servicios" className="landing-section landing-wrap"><p className="landing-eyebrow">Mantenimiento fotovoltaico · SOLARIS Nivel 1</p><h2>¿Qué incluye tu mantenimiento?</h2><div className="landing-includes">{includes.map(([title,text],i) => { const Icon = scopeIcons[i]; return <article key={title}><div className="landing-scope-top"><Icon aria-hidden="true" /><span className="landing-number">0{i+1}</span></div><h3>{title}</h3><p>{text}</p></article>; })}</div></section>
      <section id="proceso" className="landing-process"><div className="landing-wrap landing-section"><h2>Proceso SOLARIS</h2><ol className="landing-flow">{["Inspección", "Mantenimiento", "Verificación", "Reporte", "Correctivos si se requieren"].map((step,i) => <li key={step}><span>{step}</span>{i<4 && <span className="landing-flow-arrow" aria-hidden="true">↓</span>}</li>)}</ol><p className="landing-fine">Los correctivos se cotizan por separado y requieren tu autorización.</p></div></section>
      <section id="trabajos" className="landing-wrap landing-section"><h2>Así cuidamos tu sistema</h2><p className="landing-lead">Antes, durante, después y hallazgos técnicos: evidencia del trabajo realizado.</p>{workPhotos.length ? <div className="landing-gallery">{workPhotos.map(photo => <figure key={photo.src}><a href={photo.src} target="_blank" rel="noreferrer"><Image src={photo.src} alt={photo.alt} width={640} height={480} loading="lazy" /></a><figcaption>{photo.stage}</figcaption></figure>)}</div> : <div className="landing-gallery-empty"><p>Próximamente compartiremos fotografías de nuestros trabajos.</p><span>Antes · Durante · Después · Hallazgos técnicos</span></div>}</section>
      <section id="pasaporte" className="landing-passport"><div className="landing-wrap landing-section"><p className="landing-eyebrow">Pasaporte Solar</p><div className="landing-split"><div><h2>Cada mantenimiento deja historial.</h2><p className="landing-lead">Con tu Pasaporte Solar puedes consultar la información de tu sistema y mantener un registro organizado de su mantenimiento.</p><p className="landing-passport-line">La historia de tu sistema, a un escaneo.</p><a className="landing-text-link" href="#pasaporte-detalles">Conocer el Pasaporte Solar ↘</a></div><div id="pasaporte-detalles" className="landing-passport-details"><div className="landing-passport-heading"><QrCode aria-hidden="true" /><span>Tu expediente digital</span></div><ul>{["Historial de mantenimientos", "Fotografías", "Reportes", "Recomendaciones", "Garantías / documentación", "Próximo mantenimiento"].map(item => <li key={item}>{item}</li>)}</ul><p className="landing-fine">Consulta la información que Solaris publica en tu expediente. Si ya eres cliente, escanea el QR de tu vivienda o abre tu enlace personal.</p></div></div></div></section>
      <section id="otros-servicios" className="landing-wrap landing-section"><h2>También podemos ayudarte con</h2><ul className="landing-other">{["Diagnóstico de sistemas fotovoltaicos", "Trámites / gestoría CFE", "Medidor bidireccional", "Diagramas y documentación técnica", "Servicios eléctricos relacionados"].map(service => <li key={service}>{service}</li>)}</ul><p className="landing-fine">Incluye orientación para interconexión y nuevos servicios. El alcance de cada gestoría se define según tu caso.</p></section>
      <section id="nivel-2" className="landing-scale"><div className="landing-wrap"><div><p className="landing-eyebrow">SOLARIS Nivel 2</p><h2>¿Tienes un sistema de mayor escala?</h2><p>Para sistemas fotovoltaicos de 40 módulos o más, SOLARIS puede incorporar monitoreo, análisis de desempeño y mantenimiento predictivo.</p></div><details><summary>Conocer SOLARIS Nivel 2</summary><p>Revisamos las características y necesidades de tu sistema para definir el alcance. Indica el número de módulos y tu interés en Nivel 2 al solicitar información.</p><a href="#contacto" className="landing-text-link">Solicitar cotización ↗</a></details></div></section>
      <section id="preguntas" className="landing-wrap landing-section landing-faq"><h2>Resolvemos tus dudas</h2>{questions.map(([question,answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</section>
      <section id="contacto" className="landing-contact"><div className="landing-wrap landing-section"><div className="landing-split"><div><p className="landing-eyebrow">Solicitar cotización</p><h2>Contratar SOLARIS es sencillo</h2><ol className="landing-hire"><li><strong>1. Cuéntanos sobre tu sistema</strong><p>Indica cuántos paneles tienes y dónde se encuentra tu instalación.</p></li><li><strong>2. Preparamos tu cotización</strong><p>Definimos el alcance y el precio según tu caso.</p></li><li><strong>3. Agendamos tu servicio</strong><p>Confirmamos contigo la fecha y las condiciones antes de comenzar.</p></li></ol><p className="landing-price">Desde <strong>$1,500 MXN</strong></p><address>Atención en Yucatán<br /><a href="tel:+527778311043">777 831 1043</a><br /><a href="mailto:solarisenergysolutions.mx@gmail.com">solarisenergysolutions.mx@gmail.com</a></address></div><ProspectContact whatsapp={whatsapp} /></div></div></section>
    </main>
    <footer className="landing-footer"><div className="landing-wrap"><div className="landing-brand">SOLARIS <span>ENERGY SOLUTIONS</span><p>Iluminando el mañana</p></div><div><a href="/admin">Administración</a><span>© {new Date().getFullYear()} SOLARIS</span></div></div></footer><FloatingQuote whatsapp={whatsapp} />
  </div>;
}
