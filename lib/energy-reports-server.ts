import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { reportAdmin } from '@/lib/service-report-auth';
import { clientEnergySnapshot,type EnergyReport } from '@/lib/energy-metrics';
export const energyHeaders = { 'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer', 'X-Robots-Tag':'noindex, nofollow' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function energyReports(token: string | null, system: string | null, id: string | null = null): Promise<EnergyReport[]> {
  if(id && !uuid.test(id))throw new Error('Reporte no disponible.');
  if(system ? !/^FV-\d+$/.test(system) : !token || !uuid.test(token))throw new Error('Expediente no disponible.');
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)throw new Error('Conexión no configurada.');
  const db=system ? await reportAdmin() : createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  if(!db)throw new Error('Inicia sesión como administrador.');
  const result=await db.rpc('energy_report_list',{p_token:system?null:token,p_system_code:system,p_id:id});
  if(result.error)throw new Error('No se pudieron consultar los reportes. Comprueba la conexión y la activación del módulo.');
  const reports=(result.data ?? []) as EnergyReport[];
  return system?reports:reports.map(r=>({...r,snapshot:clientEnergySnapshot(r.snapshot)}));
}
