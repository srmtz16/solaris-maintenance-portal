"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";

export function MarketingNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const services = useRef<HTMLDetailsElement>(null);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); if (services.current) services.current.open = false; };
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); if (services.current) services.current.open = false; toggle.current?.focus(); } };
    const outside = (event: PointerEvent) => { if (!header.current?.contains(event.target as Node)) { setOpen(false); if (services.current) services.current.open = false; } };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, []);
  return <header className="landing-nav" ref={header}><div className="landing-wrap nav-inner">
    <Link href="/" className="landing-brand" aria-label="SOLARIS Energy Solutions, inicio" onClick={close}>SOLARIS<span>ENERGY SOLUTIONS</span></Link>
    <button ref={toggle} className="mobile-menu" aria-expanded={open} aria-controls="commercial-nav" aria-label={open ? "Cerrar menú" : "Abrir menú"} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    <nav id="commercial-nav" aria-label="Navegación principal" data-open={open}>
      <Link href="/" aria-current={path === "/" ? "page" : undefined} onClick={close}>Inicio</Link>
      <Link href="/pasaporte-solar" aria-current={path === "/pasaporte-solar" ? "page" : undefined} onClick={close}>Pasaporte Solar</Link>
      <details className="services-menu" ref={services}><summary className={path === "/mantenimiento" || path === "/gestoria" ? "service-active" : ""}>Servicios<ChevronDown size={15} aria-hidden="true" /></summary><div className="services-popover"><Link href="/mantenimiento" aria-current={path === "/mantenimiento" ? "page" : undefined} onClick={close}>Mantenimiento fotovoltaico</Link><Link href="/gestoria" aria-current={path === "/gestoria" ? "page" : undefined} onClick={close}>Gestoría y trámites</Link></div></details>
      <Link href="/contacto" className="nav-contact" aria-current={path === "/contacto" ? "page" : undefined} onClick={close}>Solicitar orientación<ArrowUpRight size={16} aria-hidden="true" /></Link>
    </nav>
  </div></header>;
}
