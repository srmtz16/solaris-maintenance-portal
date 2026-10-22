import type { EnergyReportDetails } from './energy-report-design';
export const ENERGY_VERSION = 1;
export const ENERGY_FIELDS = ['timestamp', 'consumption', 'production', 'imported', 'exported'] as const;
export type EnergyField = typeof ENERGY_FIELDS[number];
export type EnergyMapping = Record<EnergyField, number>;
export type EnergyOptions = { mapping: EnergyMapping; unit: 'Wh' | 'kWh'; timezone: 'America/Merida' | 'UTC'; start: string; end: string; interval: 15 | 30 | 60 };
export type EnergyRow = { at: string; local: string; consumption: number; production: number; imported: number; exported: number };
export type EnergyDay = Omit<EnergyRow, 'at' | 'local'> & { date: string; count: number; selfConsumption: number };
export type EnergyQuality = {
  calculationVersion: 2; totalRecords: number; periodRecords: number; validRecords: number;
  duplicateRecords: number; duplicateIntervals: number; incompleteRecords: number; invalidDates: number;
  invalidValues: number; offGridRecords: number; balanceFailures: number; expectedIntervals: number;
  missingIntervals: string[]; unusableIntervals: number; firstMeasured: string | null; lastMeasured: string | null;
  observedSpacings: {minutes: number; count: number}[]; maxBalanceResidual: number; signedBalanceResidual: number;
};
export type EnergySnapshot = { reportDetails?: EnergyReportDetails; version: number; options: EnergyOptions; rows: EnergyRow[]; daily: EnergyDay[]; errors: string[]; warnings: string[]; quality?: EnergyQuality; totals: { consumption: number; production: number; imported: number; exported: number; selfConsumption: number; netImported: number; equivalentCoverage: number | null; directSelfSufficiency: number | null; directSolarUtilization?: number | null }; };
export type EnergyReport = { id: string; folio: string; system_code: string; status: 'draft' | 'published'; title: string; notes: string; revision: number; snapshot: EnergySnapshot; created_at: string; published_at: string | null };
export const energyNumber = (value: number | null, decimals = 2) => value === null ? 'No disponible' : value.toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
export function energyIndicators(s: EnergySnapshot) {
  const t=s.totals, hasData=s.daily.some(d=>d.count>0);
  return [
    {label:'Generación solar',value:t.production,unit:'kWh',description:'Electricidad generada por tus paneles en los intervalos válidos del periodo.'},
    {label:'Consumo eléctrico',value:t.consumption,unit:'kWh',description:'Electricidad consumida por la instalación en los intervalos válidos del periodo.'},
    {label:'Energía recibida de CFE',value:t.imported,unit:'kWh',description:'Electricidad que la instalación recibió de la red eléctrica.'},
    {label:'Energía enviada a CFE',value:t.exported,unit:'kWh',description:'Electricidad que la instalación entregó a la red eléctrica.'},
    {label:'Energía solar utilizada en la vivienda',value:t.selfConsumption,unit:'kWh',description:'Generación menos energía enviada a CFE, calculada en cada intervalo. Requiere que no existan flujos de batería sin medir.'},
    {label:'Diferencia entre energía recibida y enviada a CFE',value:t.netImported,unit:'kWh',description:'Energía recibida menos energía enviada. Un resultado negativo significa que se envió más de lo que se recibió; no es un cálculo del recibo.'},
    {label:'Generación solar respecto al consumo',value:t.equivalentCoverage,unit:'%',description:'Compara toda la generación solar con el consumo total. No significa que toda esa energía se haya consumido directamente.'},
    {label:'Consumo cubierto directamente por los paneles',value:t.directSelfSufficiency,unit:'%',description:'Porcentaje del consumo cubierto por la energía solar utilizada directamente, según los intervalos medidos.'},
    {label:'Aprovechamiento directo de energía solar',value:t.production?t.selfConsumption/t.production*100:null,unit:'%',description:'Porcentaje de toda la generación solar que se utilizó directamente en la vivienda. No es la eficiencia técnica de los paneles.'}
  ].map(m=>({...m,value:hasData?m.value:null}));
}
export function suggestEnergyConclusions(s: EnergySnapshot): string {
  if(!s.daily.some(d=>d.count))return 'No hay mediciones válidas suficientes para elaborar conclusiones.';
  const t=s.totals, partial=s.daily.some(d=>d.count!==1440/s.options.interval), days=s.daily.filter(d=>d.count&&d.production>0).length;
  return `${partial?'Con los intervalos válidos disponibles':'Durante el periodo evaluado'}, se registró una generación solar de ${energyNumber(t.production)} kWh${t.equivalentCoverage===null?'':`, equivalente al ${energyNumber(t.equivalentCoverage,1)}% del consumo eléctrico total medido`}. Se registró producción solar en ${days} ${days===1?'día':'días'} y se enviaron ${energyNumber(t.exported)} kWh a CFE.\n\n${t.production?`Se utilizó directamente el ${energyNumber(t.selfConsumption/t.production*100,1)}% de la generación solar. `:''}Esta relación se calcula a partir de generación y exportación; no mide la eficiencia técnica del sistema.${partial?' El periodo contiene intervalos sin mediciones válidas; los resultados son parciales y no se completaron datos.':''}`;
}
// Explicit projection: administrative diagnostics and source rows never belong to the client response.
export function clientEnergySnapshot(s: EnergySnapshot): EnergySnapshot {
  return {reportDetails:s.reportDetails,version:s.version,options:s.options,rows:[],daily:s.daily,totals:s.totals,errors:[],warnings:[]};
}
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
function validDay(value: string) { return dayPattern.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export function normalizeEnergy(raw: unknown[][], options: EnergyOptions): EnergySnapshot {
  if (!options || !['Wh', 'kWh'].includes(options.unit) || !['America/Merida', 'UTC'].includes(options.timezone) || ![15,30,60].includes(options.interval)) throw new Error('Confirma unidad, zona horaria e intervalo de 15, 30 o 60 minutos.');
  if (!validDay(options.start) || !validDay(options.end) || options.start > options.end || options.start < '2023-01-01' || (Date.parse(options.end) - Date.parse(options.start)) / 86400000 > 366) throw new Error('Selecciona un periodo válido de hasta 367 días, desde 2023.');
  const indices = ENERGY_FIELDS.map(key => options.mapping?.[key]);
  if (indices.some(i => !Number.isInteger(i) || i < 0 || i > 31) || new Set(indices).size !== indices.length) throw new Error('Asigna una columna distinta a cada variable.');
  if (!Array.isArray(raw) || !raw.length || raw.length > 10000) throw new Error('El archivo debe contener entre 1 y 10,000 filas.');
  const rows: EnergyRow[] = [], errors: string[] = [], warnings: string[] = [];
  const quality: EnergyQuality={calculationVersion:2,totalRecords:raw.length,periodRecords:0,validRecords:0,duplicateRecords:0,duplicateIntervals:0,incompleteRecords:0,invalidDates:0,invalidValues:0,offGridRecords:0,balanceFailures:0,expectedIntervals:0,missingIntervals:[],unusableIntervals:0,firstMeasured:null,lastMeasured:null,observedSpacings:[],maxBalanceResidual:0,signedBalanceResidual:0};
  const issue = (message: string) => { if (errors.length < 30) errors.push(message); };
  const groups = new Map<string,{row:unknown[];index:number}[]>();
  raw.forEach((row,index)=>{
    const stamp=row[options.mapping.timestamp];
    const match=typeof stamp==='string'?/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(stamp.trim()):null;
    if(!match||!validDay(match[1])||+match[2]>23||+match[3]>59||+(match[4]||0)>59){quality.invalidDates++;issue(`Fila ${index+2}: fecha inválida; no puede asignarse a un periodo.`);return;}
    if(match[1]<options.start||match[1]>options.end)return;
    quality.periodRecords++;
    if(ENERGY_FIELDS.slice(1).some(k=>row[options.mapping[k]]==null||String(row[options.mapping[k]]).trim()===''))quality.incompleteRecords++;
    const local=`${match[1]}T${match[2]}:${match[3]}:${match[4]||'00'}`;
    const entries=groups.get(local)||[];entries.push({row,index});groups.set(local,entries);
  });
  const stamps=[...groups.keys()].sort(), spacings=new Map<number,number>();
  stamps.slice(1).forEach((s,i)=>{const gap=(Date.parse(s+'Z')-Date.parse(stamps[i]+'Z'))/60000;spacings.set(gap,(spacings.get(gap)||0)+1);});
  quality.observedSpacings=[...spacings].sort((a,b)=>a[0]-b[0]).map(([minutes,count])=>({minutes,count}));
  for(const [local,entries] of groups){
    const offGrid=Number(local.slice(14,16))%options.interval!==0||local.slice(17)!=='00';
    if(offGrid){quality.offGridRecords+=entries.length;issue(`El intervalo ${local} no coincide con la frecuencia confirmada.`);}
    if(entries.length>1){quality.duplicateRecords+=entries.length-1;quality.duplicateIntervals++;issue(`Medición duplicada: ${local}; se excluyen todas sus filas.`);continue;}
    if(offGrid)continue;
    const {row,index}=entries[0];
    const values=ENERGY_FIELDS.slice(1).map(key=>{const v=row[options.mapping[key]];return typeof v==='number'?v:typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v.trim())?Number(v):NaN;});
    if(values.some(v=>!Number.isFinite(v)||v<0||v>1e9)){quality.invalidValues++;issue(`Fila ${index+2}: faltan valores o existen números negativos/inválidos.`);continue;}
    const [consumption,production,imported,exported]=values.map(v=>v/(options.unit==='Wh'?1000:1));
    const balance=production+imported-consumption-exported;
    quality.maxBalanceResidual=Math.max(quality.maxBalanceResidual,Math.abs(balance));quality.signedBalanceResidual+=balance;
    // Tolerance applies to rounded energy counters, never to filling missing readings.
    if(Math.abs(balance)>.00100001||exported>production+.00100001||imported>consumption+.00100001){quality.balanceFailures++;issue(`Balance inconsistente en ${local}; registro excluido. Revisa columnas, unidades o almacenamiento.`);continue;}
    const at=new Date(local+(options.timezone==='UTC'?'Z':'-06:00')).toISOString();
    rows.push({at,local,consumption,production,imported,exported});
  }
  rows.sort((a,b)=>a.at.localeCompare(b.at));
  quality.validRecords=rows.length;quality.firstMeasured=rows[0]?.local||null;quality.lastMeasured=rows.at(-1)?.local||null;
  if(!rows.length)issue('No hay mediciones válidas en el periodo elegido.');
  const daily: EnergyDay[]=[];
  for(let time=Date.parse(options.start);time<=Date.parse(options.end);time+=86400000){
    const date=new Date(time).toISOString().slice(0,10),entries=rows.filter(r=>r.local.startsWith(date));
    for(let minute=0;minute<1440;minute+=options.interval){const local=`${date}T${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}:00`;quality.expectedIntervals++;if(!groups.has(local))quality.missingIntervals.push(local);}
    const sum=(key:'consumption'|'production'|'imported'|'exported')=>entries.reduce((n,r)=>n+r[key],0);
    daily.push({date,count:entries.length,consumption:sum('consumption'),production:sum('production'),imported:sum('imported'),exported:sum('exported'),selfConsumption:entries.reduce((n,r)=>n+Math.max(0,r.production-r.exported),0)});
    if(entries.length!==1440/options.interval)issue(`${date}: ${entries.length}/${1440/options.interval} intervalos válidos; no se rellenan datos faltantes.`);
  }
  quality.unusableIntervals=quality.expectedIntervals-rows.length;
  const sum=(key:'consumption'|'production'|'imported'|'exported'|'selfConsumption')=>daily.reduce((n,d)=>n+d[key],0);
  const consumption=sum('consumption'),production=sum('production'),imported=sum('imported'),exported=sum('exported'),selfConsumption=sum('selfConsumption');
  warnings.push('Solo se suman registros únicos y válidos. Sin interpolación ni sustitución por ceros. Los originales se conservan sin modificaciones.','Balance por intervalo: generación + importación − consumo − exportación. Tolerancia: 0.001 kWh (1 Wh) por redondeo. Los registros fuera de tolerancia se excluyen.','Energía solar utilizada = suma de máx(0, generación − exportación) por intervalo. El límite en cero solo corrige diferencias de redondeo aceptadas; requiere ausencia de flujos de batería sin medir.','Los indicadores derivados son cálculos sobre mediciones, no mediciones adicionales ni evaluaciones de eficiencia técnica.');
  return {version:ENERGY_VERSION,options,rows,daily,errors,warnings,quality,totals:{consumption,production,imported,exported,selfConsumption,netImported:imported-exported,equivalentCoverage:consumption?production/consumption*100:null,directSelfSufficiency:consumption?selfConsumption/consumption*100:null,directSolarUtilization:production?selfConsumption/production*100:null}};
}

