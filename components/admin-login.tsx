"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole, Sun } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(searchParams.get("error") === "config" ? "Falta configurar Supabase en este entorno." : "");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError || !data.user) throw new Error("Correo o contraseña incorrectos.");
      if (data.user.app_metadata?.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("Esta cuenta no tiene permiso de administrador.");
      }
      const next = searchParams.get("next");
      router.replace(next?.startsWith("/admin") && next !== "/admin/login" ? next : "/admin/documentos");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-[#F5F7FA] px-5 py-10 text-stone-900">
    <section className="w-full max-w-md rounded-[2rem] border border-stone-200 bg-white p-7 shadow-[0_24px_70px_rgba(28,25,20,.10)] sm:p-10">
      <div className="grid size-12 place-items-center rounded-2xl bg-stone-900 text-[#F4B400]"><Sun className="size-6" /></div>
      <p className="mt-7 text-xs font-semibold uppercase tracking-[.2em] text-[#8A6200]">Solaris</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Portal de administrador</h1>
      <p className="mt-3 text-sm leading-6 text-stone-500">Acceso privado para gestionar los expedientes y documentos de cada sistema.</p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <label className="block text-sm font-medium">Correo<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-stone-200 px-4 outline-none focus:border-[#8A6200]" /></label>
        <label className="block text-sm font-medium">Contraseña<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-stone-200 px-4 outline-none focus:border-[#8A6200]" /></label>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 font-semibold text-white disabled:opacity-60"><LockKeyhole className="size-4" />{loading ? "Verificando…" : "Ingresar"}</button>
      </form>
    </section>
  </main>;
}
