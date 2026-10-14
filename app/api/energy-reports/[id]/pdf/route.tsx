import {renderToBuffer} from '@react-pdf/renderer';
import {energyReports,energyHeaders} from '@/lib/energy-reports-server';
import {EnergyReportPdf} from '@/components/energy-report-pdf';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
 try {const {id}=await params,q=new URL(request.url).searchParams;const [report]=await energyReports(q.get('token'),q.get('system'),id);if(!report)return new Response('Reporte no disponible.',{status:404,headers:energyHeaders});const bytes=await renderToBuffer(<EnergyReportPdf report={report}/>);return new Response(new Uint8Array(bytes),{headers:{...energyHeaders,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${report.folio}.pdf"`}});}catch{return new Response('Reporte no disponible.',{status:403,headers:energyHeaders});}
}
