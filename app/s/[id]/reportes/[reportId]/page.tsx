import Link from 'next/link';
import {notFound} from 'next/navigation';
import {energyReports} from '@/lib/energy-reports-server';
import {EnergyReportView} from '@/components/energy-report-view';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string;reportId:string}>}) {
 const {id,reportId}=await params;const [report]=await energyReports(id,null,reportId);if(!report)notFound();
 return <main className="min-h-dvh bg-[#F5F7FA] px-5 py-6 md:px-8 md:py-10"><div className="mx-auto max-w-5xl"><Link href={`/s/${id}/reportes`} className="mb-6 inline-flex min-h-11 items-center text-sm font-medium text-slate-600">← Volver a tus reportes</Link><EnergyReportView snapshot={report.snapshot} title={report.title} notes={report.notes} folio={report.folio} pdfUrl={`/api/energy-reports/${report.id}/pdf?token=${encodeURIComponent(id)}`}/></div></main>;
}
