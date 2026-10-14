import { NextResponse } from 'next/server';
import { reportAdmin } from '@/lib/service-report-auth';
import { readJsonBody } from '@/lib/request-body';
import { smappeeFileSource, MAX_ENERGY_BYTES, inspectEnergyTable } from '@/lib/energy-import';
import { normalizeEnergy } from '@/lib/energy-metrics';
import { energyReports, energyHeaders } from '@/lib/energy-reports-server';
export const runtime='nodejs';
export async function GET(request:Request) {
 try { const q=new URL(request.url).searchParams;return NextResponse.json({reports:await energyReports(q.get('token'),q.get('system'),q.get('id'))},{headers:energyHeaders}); }
 catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Reportes no disponibles.'},{status:403,headers:energyHeaders});}
}
export async function POST(request:Request) {
 try {
  if(request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({error:'Origen no autorizado.'},{status:403,headers:energyHeaders});
  const db=await reportAdmin();if(!db)return NextResponse.json({error:'Inicia sesión como administrador.'},{status:403,headers:energyHeaders});
  const body=await readJsonBody(request,2_200_000) as Record<string,unknown>;
  if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Solicitud inválida.');
  if(['notes','publish','unpublish'].includes(String(body.action))) {
   if(typeof body.id!=='string'||!Number.isInteger(body.revision)||typeof body.notes!=='string'||body.notes.length>6000)throw new Error('Reporte inválido.');
   const result=await db.rpc('admin_energy_update',{p_id:body.id,p_revision:body.revision,p_action:body.action,p_notes:body.notes});
   if(result.error)throw new Error(result.error.message);return NextResponse.json({ok:true},{headers:energyHeaders});
  }
  if(!['inspect','preview','save'].includes(String(body.action))||typeof body.file!=='string'||typeof body.filename!=='string'||typeof body.mime!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(body.file))throw new Error('Selecciona un archivo válido.');
  const bytes=Buffer.from(body.file,'base64');if(bytes.length>MAX_ENERGY_BYTES)throw new Error('Máximo 1.5 MB por archivo.');
  const table=await smappeeFileSource.read(bytes,body.filename,body.mime);
  const detected=inspectEnergyTable(table);
  if(body.action==='inspect')return NextResponse.json({start:detected.start,end:detected.end,interval:detected.interval},{headers:energyHeaders});
  const requested=body.options as Record<string,unknown>|undefined;
  const start=requested?.start??detected.start,end=requested?.end??detected.end;
  if(typeof start!=='string'||typeof end!=='string'||start<detected.start||end>detected.end)throw new Error('Elige fechas dentro del periodo que contiene el archivo.');
  const snapshot=normalizeEnergy(table.rows,{...detected,start,end});
  if(body.action==='preview')return NextResponse.json({snapshot},{headers:energyHeaders});
  if(typeof body.system!=='string'||!/^FV-\d+$/.test(body.system)||typeof body.title!=='string'||!body.title.trim()||body.title.length>160||typeof body.notes!=='string'||body.notes.length>6000)throw new Error('Revisa expediente, título y notas.');
  // Reparse and calculate on every save; never accept a client-provided snapshot.
  const result=await db.rpc('admin_energy_draft',{p_system_code:body.system,p_filename:table.filename,p_mime:table.mime,p_raw:body.file,p_checksum:table.checksum,p_title:body.title.trim(),p_notes:body.notes,p_snapshot:snapshot});
  if(result.error)throw new Error(result.error.message);return NextResponse.json({id:result.data},{headers:energyHeaders});
 } catch(error){return NextResponse.json({error:error instanceof Error?error.message:'No se pudo procesar el archivo.'},{status:400,headers:energyHeaders});}
}
