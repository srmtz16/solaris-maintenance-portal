import type { EnergySnapshot } from './energy-metrics';

/** Information explicitly reviewed by administration, separate from measured energy. */
export type EnergyReportDetails = {
  client: string; technician: string; location: string; systemType: string;
  modules: string; equipment: string; capacity: string;
  expectedDaily: number | null; reference: string;
  measurementSource?: string; interpretation?: string;
  economics?: EnergyEconomics;
};
export function validateReportDetails(raw: unknown): EnergyReportDetails | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Revisa los datos del informe.');
  const input = raw as Record<string, unknown>;
  const text = (key: string, max = 120) => {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > max) throw new Error('Revisa los datos del informe.');
    return value.trim();
  };
  const expectedDaily = input.expectedDaily == null || input.expectedDaily === '' ? null : input.expectedDaily;
  if (expectedDaily !== null && (typeof expectedDaily !== 'number' || !Number.isFinite(expectedDaily) || expectedDaily <= 0 || expectedDaily > 1e9)) throw new Error('La referencia diaria debe ser un número positivo en kWh.');
  const reference = text('reference', 300);
  if (expectedDaily !== null && !reference) throw new Error('Documenta el origen de la generación esperada.');
  return {client:text('client'),technician:text('technician'),location:text('location'),systemType:text('systemType'),modules:text('modules',30),equipment:text('equipment'),capacity:text('capacity',40),expectedDaily,reference,measurementSource:text('measurementSource',120),interpretation:text('interpretation',600),economics:validateEconomics(input.economics)};
}
export function reportPerformance(s: EnergySnapshot) {
  const days = s.daily.length;
  const reference = s.reportDetails?.expectedDaily;
  const expected = typeof reference === 'number' && Number.isFinite(reference) && reference > 0 ? reference * days : null;
  const complete = days > 0 && s.daily.every(d => d.count === 1440 / s.options.interval);
  return {days, expected, complete, compliance: complete && expected ? s.totals.production / expected * 100 : null, difference: complete && expected ? s.totals.production - expected : null};
}

/** Block quantities apply to the entire projected period. */
export type EnergyEconomics = {
 days:number; tariff:string; validity:string; confirmed:boolean;
 tierPeriod?:"monthly"|"period"; netMeteringConfirmed?:boolean; creditKwh?:number; vatPercent?:number; lightingCharge?:number;
 basicKwh:number|null; intermediateKwh:number|null;
 basicPrice:number|null; intermediatePrice:number|null; excessPrice:number|null;
};
export function validateEconomics(raw:unknown):EnergyEconomics|undefined {
 if(raw==null)return undefined;
 if(typeof raw!=='object'||Array.isArray(raw))throw new Error('Revisa la proyección económica.');
 const e=raw as Record<string,unknown>;
 if(!Number.isInteger(e.days)||Number(e.days)<1||Number(e.days)>92)throw new Error('Indica entre 1 y 92 días para el periodo proyectado.');
 for(const key of ['tariff','validity'])if(typeof e[key]!=='string'||!String(e[key]).trim()||String(e[key]).length>120)throw new Error('Completa la tarifa y su vigencia.');
 if(e.confirmed!==true)throw new Error('Confirma los precios y bloques del periodo antes de generar la proyección.');
 const values:Record<string,number>={};
 for(const key of ['basicKwh','intermediateKwh','basicPrice','intermediatePrice','excessPrice']){
 const v=e[key];if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e6)throw new Error('Completa los límites y precios con números válidos.');values[key]=v;
 }
 if(e.tierPeriod!==undefined&&!['monthly','period'].includes(String(e.tierPeriod)))throw new Error('Revisa el periodo de los bloques.');
 if(e.netMeteringConfirmed!==undefined&&typeof e.netMeteringConfirmed!=='boolean')throw new Error('Confirma la modalidad contractual.');
 for(const key of ['creditKwh','vatPercent','lightingCharge']){const v=e[key]??0;if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>(key==='vatPercent'?100:1e6))throw new Error('Revisa IVA, alumbrado y saldo a favor.');}
 return {tierPeriod:e.tierPeriod==='monthly'?'monthly':'period',netMeteringConfirmed:e.netMeteringConfirmed===true,creditKwh:Number(e.creditKwh??0),vatPercent:Number(e.vatPercent??0),lightingCharge:Number(e.lightingCharge??0),days:Number(e.days),tariff:String(e.tariff).trim(),validity:String(e.validity).trim(),confirmed:true,basicKwh:values.basicKwh,intermediateKwh:values.intermediateKwh,basicPrice:values.basicPrice,intermediatePrice:values.intermediatePrice,excessPrice:values.excessPrice};
}
export function tieredEnergyCost(kwh:number,e:EnergyEconomics){
 const factor=e.tierPeriod==='monthly'?e.days/30:1;
 const basic=Math.min(kwh,e.basicKwh!*factor);
 const intermediate=Math.min(Math.max(0,kwh-basic),e.intermediateKwh!*factor);
 return basic*e.basicPrice!+intermediate*e.intermediatePrice!+Math.max(0,kwh-basic-intermediate)*e.excessPrice!;
}
export function estimatedPayment(energy:number,e:EnergyEconomics){
 const money=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
 const subtotal=money(energy),vat=money(subtotal*(e.vatPercent??0)/100),lighting=money(e.lightingCharge??0);
 return {energy:subtotal,vat,lighting,total:money(subtotal+vat+lighting)};
}
export function economicProjection(s:EnergySnapshot){
 let config:EnergyEconomics|undefined;
 try{config=validateEconomics(s.reportDetails?.economics);}catch{return null;}
 if(!config)return null;
 const days=s.daily.filter(d=>d.count===1440/s.options.interval&&[d.consumption,d.production,d.imported,d.exported,d.selfConsumption].every(v=>Number.isFinite(v)&&v>=0));
 if(!days.length)return null;
 const average=(key:'consumption'|'production'|'imported'|'exported'|'selfConsumption')=>days.reduce((sum,d)=>sum+d[key],0)/days.length;
 const consumption=average('consumption')*config.days,production=average('production')*config.days;
 const imported=average('imported')*config.days,exported=average('exported')*config.days;
 const netImported=imported-exported;
 const billed=Math.max(0,netImported-(config.creditKwh??0)),excess=Math.max(0,(config.creditKwh??0)-netImported);
 const money=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
 const withoutBreakdown=estimatedPayment(tieredEnergyCost(consumption,config),config);
 const withBreakdown=config.netMeteringConfirmed?estimatedPayment(tieredEnergyCost(billed,config),config):null;
 const withoutPanels=withoutBreakdown.total,withPanels=withBreakdown?.total??null;
 return {config,measuredDays:days.length,excludedDays:s.daily.length-days.length,firstDay:days[0].date,lastDay:days.at(-1)!.date,averageConsumption:average('consumption'),averageProduction:average('production'),consumption,production,imported,exported,billed,excess,selfConsumption:average('selfConsumption')*config.days,netImported,withoutBreakdown,withBreakdown,withoutPanels,withPanels,savings:withPanels===null?null:money(withoutPanels-withPanels)};
}
