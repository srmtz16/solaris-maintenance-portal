'use client';
import {EnergySummary} from './energy-summary';
import {type EnergySnapshot} from '@/lib/energy-metrics';
export function EnergyReportView({snapshot,title='Reporte energético',folio,pdfUrl}:{snapshot:EnergySnapshot;notes?:string;title?:string;folio?:string;pdfUrl?:string}) {

 return <article className="space-y-6 text-[#06131B]">
  <header className="rounded-3xl bg-[#06131B] p-6 text-white md:p-8"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#FFD966]">SOLARIS · Energía</p><h2 className="mt-3 text-2xl font-semibold md:text-3xl">{title}</h2><p className="mt-3 text-sm text-slate-300">Periodo: {snapshot.options.start} — {snapshot.options.end}</p>{folio&&<p className="mt-2 break-all text-xs text-slate-400">{folio}</p>}{pdfUrl&&<a className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#F4B400] px-5 text-sm font-semibold text-[#06131B]" href={pdfUrl}>Descargar resumen</a>}</header>
  {snapshot.daily.some(d=>d.count!==1440/snapshot.options.interval)&&<p role="status" className="rounded-2xl bg-amber-50 p-4 text-sm">Este periodo tiene intervalos sin datos válidos. Los resultados son parciales; no se estimaron mediciones faltantes.</p>}
  <EnergySummary snapshot={snapshot}/>
 </article>;
}





