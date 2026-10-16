'use client';
import {useState} from 'react';
import {PieChart,Pie,Cell,ResponsiveContainer,Tooltip} from 'recharts';
import {energyNumber,type EnergySnapshot} from '@/lib/energy-metrics';

export function EnergySummary({snapshot}:{snapshot:EnergySnapshot}) {
 const [active,setActive]=useState<number|null>(null);
 const [solar,setSolar]=useState(true);
 const t=snapshot.totals,hasData=snapshot.daily.some(d=>d.count>0);
 const total=solar?t.production:t.consumption;
 const used=Math.min(total,Math.max(0,t.selfConsumption));
 // Each view partitions its own total; the remainder absorbs meter rounding.
 const remainder=Math.max(0,total-used);
 const slices=[{name:'Autoconsumo solar',value:used,color:'#159665'},solar?{name:'Enviada a CFE',value:remainder,color:'#D99A00'}:{name:'Cubierto por CFE',value:remainder,color:'#3888CB'}];
 return <section className="rounded-3xl border border-slate-200 bg-white p-5 md:p-8" aria-label="Resumen de energía">
  <p className="text-xs font-semibold uppercase tracking-[.15em] text-[#8A6200]">Tu energía de un vistazo</p>
  <h3 className="mt-2 text-2xl font-semibold">Lo esencial de este periodo</h3>
  <div className="mt-6 grid gap-4 sm:grid-cols-3">
   {[{label:'Generación solar',value:t.production,description:'Lo que produjeron tus paneles.'},{label:'Consumo total',value:t.consumption,description:'La energía que utilizó tu instalación.'},{label:'Autoconsumo solar',value:t.selfConsumption,description:'Energía de tus paneles utilizada directamente.'}].map((m,i)=><div key={m.label} className="rounded-2xl p-4" style={{background:['#FFF7D9','#EDF5FD','#EAF8F0'][i],borderTop:'3px solid '+['#E7AC13','#3888CB','#159665'][i]}}><p className="text-sm text-slate-600">{m.label}</p><p className="mt-2 text-2xl font-semibold">{hasData?energyNumber(m.value):'Sin datos'} <span className="text-sm font-normal">{hasData?'kWh':''}</span></p><p className="mt-2 text-xs leading-5 text-slate-500">{m.description}</p></div>)}
  </div>
  <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Vista de la dona">{[{label:'Generación solar',value:true},{label:'Consumo total',value:false}].map(view=><button type="button" key={view.label} aria-pressed={solar===view.value} onClick={()=>{setSolar(view.value);setActive(null);}} className="min-h-11 rounded-xl px-4 py-3 text-sm font-semibold" style={{background:solar===view.value?'#0B1F2A':'#F1F5F9',color:solar===view.value?'#FFFFFF':'#334155'}}>{view.label}</button>)}</div><div className="mt-6 grid items-center gap-6 md:grid-cols-2">
   <div className="relative" style={{height:280}} aria-label={solar?'Distribución de la generación solar':'Cómo se cubrió el consumo total'}>
    {hasData&&total>0?<><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={slices} dataKey="value" nameKey="name" innerRadius={87} outerRadius={116} startAngle={90} endAngle={-270} stroke="#FFFFFF" strokeWidth={5} isAnimationActive={false}>{slices.map((s,i)=><Cell key={s.name} fill={s.color} opacity={active===null||active===i?1:.35}/>)}</Pie><Tooltip formatter={value=>`${energyNumber(Number(value))} kWh`}/></PieChart></ResponsiveContainer><div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',pointerEvents:'none'}}><strong style={{fontSize:34}}>{active===null?energyNumber(total):energyNumber(slices[active].value/total*100,1)}{active===null?'':'%'}</strong><span className="mt-1 text-xs text-slate-500">{active===null?(solar?'kWh de generación solar':'kWh de consumo total'):(active===0?'de autoconsumo':solar?'enviado a CFE':'recibido de CFE')}</span></div></>:<div className="flex h-full items-center justify-center text-sm text-slate-500">{hasData?(solar?'No se registró generación solar.':'No se registró consumo.'):'Sin mediciones disponibles.'}</div>}
   </div>
   <div><h4 className="text-xl font-semibold">{solar?'¿Cómo utilizaste tu generación solar?':'¿Cómo cubriste tu consumo?'}</h4><p className="mt-3 text-sm leading-6 text-slate-500">{solar?'Toda tu generación se reparte entre lo que utilizaste directamente y lo que enviaste a CFE.':'Tu consumo total se cubrió con energía de tus paneles y energía recibida de CFE.'}</p><div className="mt-4 space-y-2">{slices.map((s,i)=><button type="button" key={s.name} aria-pressed={active===i} disabled={!hasData||total<=0} onClick={()=>setActive(active===i?null:i)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm" style={{background:active===i?'#EDF2F5':'#F7F9FA',border:active===i?'1px solid #BCCBD5':'1px solid transparent'}}><span className="flex items-center gap-2"><span aria-hidden="true" style={{width:10,height:10,borderRadius:'50%',background:s.color,flexShrink:0}}/>{s.name}</span><strong className="whitespace-nowrap">{hasData?`${energyNumber(s.value)} kWh`:'Sin datos'}</strong></button>)}</div><p className="mt-3 text-xs leading-5 text-slate-500">{solar?'Selecciona una parte para ver qué porcentaje representa de tu generación solar.':'Selecciona una parte para ver qué porcentaje representa de tu consumo total.'}</p></div>
  </div>
 </section>;
}


