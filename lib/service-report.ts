export const serviceTypes = ['Mantenimiento preventivo','Diagnóstico','Inspección','Reparación','Levantamiento'] as const;
export const findingStates = ['Correcto','Requiere atención','Corregido durante el servicio','Recomendación preventiva'] as const;
export const priorities = ['Preventiva','Recomendada','Importante','Urgente'] as const;
export const generalStates = ['Operación normal','Operación con observaciones','Requiere mantenimiento adicional','Requiere reparación','Requiere diagnóstico especializado','No fue posible verificar operación'] as const;
export const photoCategories = ['Antes','Durante','Después','Hallazgo','Evidencia general'] as const;
export type Finding = { id: string; title: string; description: string; state: string };
export type Measurement = { id: string; parameter: string; value: string; unit: string; observation: string };
export type Recommendation = { id: string; title: string; description: string; priority: string };
export type ServicePhoto = { id: string; path: string; description: string; category: string; findingIds: string[] };
export type ServiceDraft = {
 date: string; type: string; technician: string; location: string;
 system: { type: string; modules: string; power: string; moduleModel: string; inverter: string; batteries: string; protections: string };
 originalNotes: string; activities: string; corrections: string; result: string;
 findings: Finding[]; measurements: Measurement[]; recommendations: Recommendation[]; photos: ServicePhoto[];
 generalState: string; finalComments: string; conclusion: string; nextDate: string; verified: boolean;
};
export type ServiceRecord = {id:string; folio:string; system_id:number; customer_id:number; status:'draft'|'completed'; version:number; data:ServiceDraft; created_at:string; customer_name:string; public_token:string; system_code:string};
export type ReportRecord = {id:string;service_id:string;folio:string;version:number;file_path:string;snapshot:ServiceRecord;created_at:string;published:boolean};
export const EVIDENCE_BUCKET = 'service-evidence';
export function emptyService(): ServiceDraft {
 const date = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return {date,type:serviceTypes[0],technician:'',location:'',system:{type:'',modules:'',power:'',moduleModel:'',inverter:'',batteries:'',protections:''},originalNotes:'',activities:'',corrections:'',result:'',findings:[],measurements:[],recommendations:[],photos:[],generalState:generalStates[5],finalComments:'',conclusion:'',nextDate:'',verified:false};
}
// Organize only supplied notes; decimal values remain intact.
export function organizeNotes(notes:string) { return notes.split(/\n+|;\s*|(?<=\.)[ \t]+(?=[A-ZÁÉÍÓÚÑ])/u).map(s=>s.trim().replace(/^[•\-]\s*/, '')).filter(Boolean).join('\n'); }
export function factualConclusion(d:ServiceDraft) {
 const paragraphs = [`Estado general registrado por el técnico: ${d.generalState}.`];
 if (d.result.trim()) paragraphs.push(d.result.trim());
 else if(d.finalComments.trim()) paragraphs.push(d.finalComments.trim());
 return paragraphs.join('\n\n');
}
export function reportFilename(record:ServiceRecord) {
 const safe=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9-]+/g,'-').replace(/^-|-$/g,'').slice(0,90);
 return `SOLARIS_Reporte_${safe(record.folio)}_${safe(record.customer_name)}_${record.data.date.split('-').reverse().join('-')}.pdf`;
}
export function validateService(d:ServiceDraft, final=false):string|null {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!Number.isFinite(Date.parse(d.date))||new Date(d.date).toISOString().slice(0,10)!==d.date||!serviceTypes.includes(d.type as typeof serviceTypes[number])) return 'Indica una fecha y un tipo de servicio válidos.';
 if(d.date>emptyService().date) return 'La fecha del servicio no puede estar en el futuro.';
 if(!d.technician.trim()||!d.location.trim()) return 'Indica el técnico responsable y la ubicación.';
 if(d.nextDate && d.nextDate<=d.date) return 'El próximo mantenimiento debe ser posterior al servicio.';
 if(d.system.modules && (!/^\d+$/.test(d.system.modules)||Number(d.system.modules)<1)) return 'El número de módulos debe ser un entero positivo.';
 if(!generalStates.includes(d.generalState as typeof generalStates[number])) return 'Selecciona el estado general.';
 if(d.findings.some(f=>!f.title.trim()||!f.description.trim()||!findingStates.includes(f.state as typeof findingStates[number]))) return 'Completa el título, descripción y estado de cada hallazgo.';
 if(d.measurements.some(m=>!m.parameter.trim()||!m.value.trim()||!m.unit.trim())) return 'Completa parámetro, valor y unidad de cada medición.';
 if(d.recommendations.some(r=>!r.title.trim()||!r.description.trim()||!priorities.includes(r.priority as typeof priorities[number]))) return 'Completa cada recomendación y su prioridad.';
 if(d.photos.some(p=>!p.description.trim()||!photoCategories.includes(p.category as typeof photoCategories[number])||p.findingIds.some(id=>!d.findings.some(f=>f.id===id)))) return 'Describe cada fotografía y revisa sus hallazgos asociados.';
 if(final && !d.originalNotes.trim()) return 'Registra las notas originales del servicio.';
 if(final && !d.activities.trim()) return 'Registra las actividades realizadas.';
 if(final && !d.conclusion.trim()) return 'Revisa la conclusión antes de generar el reporte.';
 if(final && d.conclusion.split(/\n\s*\n/).filter(Boolean).length>3) return 'La conclusión debe tener como máximo tres párrafos.';
 if(final && !d.verified) return 'Confirma que revisaste los datos y que no se añadieron hechos sin respaldo.';
 return null;
}
