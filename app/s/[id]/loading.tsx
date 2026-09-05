export default function Loading() {
  return <div className="min-h-[100dvh] bg-[#faf9f6] text-stone-900" role="status" aria-label="Cargando expediente">
    <div className="border-b border-stone-200 bg-[#faf9f6]"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8"><div className="h-10 w-36 animate-pulse rounded-xl bg-stone-200" /><div className="h-8 w-24 animate-pulse rounded-full bg-stone-200" /></div></div>
    <main className="mx-auto max-w-6xl space-y-8 px-5 py-10 md:px-8"><div className="h-4 w-32 animate-pulse rounded bg-stone-200" /><div className="h-12 max-w-xl animate-pulse rounded-xl bg-stone-200" /><div className="grid overflow-hidden rounded-3xl border border-stone-200 bg-white sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="min-h-28 animate-pulse border-b border-stone-100 p-5 sm:border-r lg:border-b-0"><div className="h-3 w-28 rounded bg-stone-200" /><div className="mt-5 h-6 w-24 rounded bg-stone-200" /></div>)}</div><div className="h-56 animate-pulse rounded-[2rem] bg-stone-900/90" /></main>
    <span className="sr-only">Cargando…</span>
  </div>;
}
