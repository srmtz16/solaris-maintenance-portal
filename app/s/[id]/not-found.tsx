import { QrCode, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function SystemNotFound() {
  return <main className="grid min-h-[100dvh] place-items-center bg-[#faf9f6] px-5 py-12 text-stone-900"><section className="w-full max-w-lg rounded-[2rem] border border-stone-200 bg-white p-8 text-center shadow-sm md:p-12"><span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-50 text-[#9b7835]"><ShieldAlert className="size-6" /></span><h1 className="mt-5 text-2xl font-semibold tracking-tight">No pudimos abrir esta vivienda</h1><p className="mt-3 text-sm leading-6 text-stone-500">El QR no es válido, todavía no ha sido activado o el sistema no está disponible. Vuelve a escanear la etiqueta instalada en la vivienda.</p><div className="mx-auto mt-7 grid size-16 place-items-center rounded-2xl bg-stone-100 text-stone-500"><QrCode className="size-7" /></div><Link href="/" className="mt-7 inline-flex rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white">Volver al inicio</Link></section></main>;
}
