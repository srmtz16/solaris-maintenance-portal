"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, FolderOpen, Gauge, Home, LogOut, Menu, Plus, Settings, Sun, Users, Wrench, X } from "lucide-react";
import { AdminDocuments } from "@/components/admin-documents";
import { AdminClientSystem } from "@/components/admin-client-system";
import { AdminRecords, type RealAdminView } from "@/components/admin-records";
import { AdminSystemForm } from "@/components/admin-system-form";
import type { AdminSystem } from "@/lib/admin-system";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type AdminView = RealAdminView | "documentos";

const navItems = [
  { label: "Resumen", href: "/admin", icon: Home },
  { label: "Sistemas", href: "/admin/sistemas", icon: Gauge },
  { label: "Mantenimientos", href: "/admin/mantenimientos", icon: Wrench },
  { label: "Documentos", href: "/admin/documentos", icon: FolderOpen },
  { label: "Clientes", href: "/admin/clientes", icon: Users },
] as const;

function Sidebar({ open, close }: { open: boolean; close: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }
  return <><button onClick={close} aria-label="Cerrar menú" className={`fixed inset-0 z-40 bg-stone-950/40 backdrop-blur-sm transition lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} /><aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#171713] px-4 py-5 text-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}><div className="mb-8 flex items-center justify-between px-2"><Link href="/admin" className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#d6b76f] text-[#171713]"><Sun className="size-5" /></span><span><span className="block text-sm font-semibold tracking-[.18em]">SOLARIS</span><span className="block text-[10px] uppercase tracking-[.16em] text-stone-400">Administración</span></span></Link><button onClick={close} aria-label="Cerrar" className="p-2 text-stone-400 lg:hidden"><X className="size-5" /></button></div><nav className="space-y-1">{navItems.map(({ label, href, icon: Icon }) => { const active = href === "/admin" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} onClick={close} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${active ? "bg-white text-stone-950" : "text-stone-400 hover:bg-white/10 hover:text-white"}`}><Icon className={`size-4 ${active ? "text-[#9b7835]" : ""}`} />{label}</Link>; })}</nav><div className="mt-auto space-y-2"><button disabled title="Disponible en una siguiente fase" className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3 py-3 text-sm text-stone-600"><Settings className="size-4" />Configuración</button><button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-stone-400 hover:bg-white/10 hover:text-white"><LogOut className="size-4" />Cerrar sesión</button><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[#d6b76f] text-xs font-bold text-stone-900">SM</span><span><span className="block text-sm font-medium">Sergio Martínez</span><span className="block text-xs text-stone-500">Administrador</span></span></div></div></div></aside></>;
}

function Header({ openMenu, title, newSystem }: { openMenu: () => void; title: string; newSystem: () => void }) {
  return <header className="sticky top-0 z-30 flex h-18 items-center justify-between border-b border-stone-200 bg-[#faf9f6]/90 px-5 backdrop-blur-xl md:px-8"><div className="flex items-center gap-3"><button onClick={openMenu} aria-label="Abrir menú" className="grid size-10 place-items-center rounded-xl border border-stone-200 bg-white lg:hidden"><Menu className="size-5" /></button><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#9b7835]">Panel administrativo</p><h1 className="text-lg font-semibold tracking-tight text-stone-900">{title}</h1></div></div><div className="flex items-center gap-2"><Link href="/admin#solicitudes" aria-label="Solicitudes" className="relative grid size-10 place-items-center rounded-xl border border-stone-200 bg-white text-stone-500"><Bell className="size-4" /></Link><button onClick={newSystem} className="flex h-10 items-center gap-2 rounded-xl bg-stone-900 px-3 text-xs font-semibold text-white sm:px-4 sm:text-sm"><Plus className="size-4" /><span className="hidden sm:inline">Nuevo sistema</span><span className="sm:hidden">Nuevo</span></button></div></header>;
}

export function AdminPortal({ view = "dashboard", systemCode }: { view?: AdminView; systemCode?: string }) {
  const [menu, setMenu] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminSystem | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState("");
  const titles: Record<AdminView, string> = { dashboard: "Resumen", sistemas: "Sistemas", mantenimientos: "Mantenimientos", documentos: "Documentos", clientes: "Clientes" };
  function saved(system: { systemCode: string }) {
    setCreateOpen(false);
    setEditing(null);
    setRefreshKey((value) => value + 1);
    setToast(`${system.systemCode} guardado correctamente en Supabase.`);
    window.setTimeout(() => setToast(""), 3500);
  }
  return <div className="min-h-screen bg-[#faf9f6] text-stone-900"><Sidebar open={menu} close={() => setMenu(false)} /><div className="lg:pl-72"><Header openMenu={() => setMenu(true)} title={systemCode || titles[view]} newSystem={() => setCreateOpen(true)} /><main className="mx-auto max-w-[1500px] px-5 py-8 md:px-8 md:py-10">{view === "documentos" ? <AdminDocuments /> : view === "clientes" && systemCode ? <AdminClientSystem systemCode={systemCode} refreshKey={refreshKey} onEdit={setEditing} /> : <AdminRecords view={view} refreshKey={refreshKey} onEdit={setEditing} />}</main></div>{createOpen && <AdminSystemForm onClose={() => setCreateOpen(false)} onSaved={saved} />}{editing && <AdminSystemForm initial={editing} onClose={() => setEditing(null)} onSaved={saved} />}{toast && <div role="status" className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white shadow-xl">{toast}</div>}</div>;
}
