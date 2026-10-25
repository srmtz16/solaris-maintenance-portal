import {Document,Page,Text,View,StyleSheet,Svg,Path,Line,Rect,Circle,G} from '@react-pdf/renderer';
import {energyNumber,type EnergyReport,type EnergyDay} from '@/lib/energy-metrics';
import {formattedRuns,formattedChunks} from '@/lib/energy-formatting';
import {reportPerformance} from '@/lib/energy-report-design';

function Rich({value}:{value:string}){return <>{formattedRuns(value).map((r,i)=><Text key={i} style={{fontFamily:r.bold?(r.italic?'Helvetica-BoldOblique':'Helvetica-Bold'):(r.italic?'Helvetica-Oblique':'Helvetica')}}>{r.text}</Text>)}</>}
const navy='#102D45', yellow='#F4B400', muted='#405875', pale='#F3F5F7';
const st=StyleSheet.create({
 page:{paddingTop:25,paddingHorizontal:35,paddingBottom:42,fontFamily:'Helvetica',fontSize:9.5,color:navy,lineHeight:1.3},
 header:{flexDirection:'row',justifyContent:'space-between',borderBottomWidth:2.5,borderBottomColor:yellow,paddingBottom:15,marginBottom:16},
 brand:{fontFamily:'Helvetica-Bold',fontSize:30,lineHeight:1.1,letterSpacing:1},tag:{color:'#B98000',fontSize:9,letterSpacing:3,marginTop:3},slogan:{fontSize:9,color:muted,marginTop:6},meta:{textAlign:'right',fontSize:8.5,color:muted,maxWidth:190},
 title:{fontSize:17,fontFamily:'Helvetica-Bold',marginBottom:13,lineHeight:1.2},heading:{fontSize:13.5,fontFamily:'Helvetica-Bold',marginTop:14,marginBottom:7},
 row:{flexDirection:'row',borderBottomWidth:.5,borderBottomColor:'#DDE3E9',paddingVertical:3},label:{width:'59%',paddingRight:10,color:muted},cell:{width:'41%'},bold:{fontFamily:'Helvetica-Bold'},
 panel:{padding:14,borderRadius:8,backgroundColor:pale},cards:{flexDirection:'row',flexWrap:'wrap',gap:8},card:{width:'49%',flexDirection:'row',backgroundColor:'white',borderRadius:7,padding:10,gap:10,minHeight:65},
 big:{fontSize:21,fontFamily:'Helvetica-Bold',lineHeight:1.2,marginVertical:3},small:{fontSize:9,color:muted},body:{fontSize:10,lineHeight:1.65},footer:{position:'absolute',height:12,bottom:22,left:35,right:35,flexDirection:'row',justifyContent:'space-between',fontSize:8,color:muted},
});
const kwh=(n:number|null)=>n===null?'No disponible':`${energyNumber(n)} kWh`;
const date=(s:string)=>/^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10).split('-').reverse().join('/'):'Sin registro';
function Icon({kind,color=yellow,size=34}:{kind:'sun'|'house'|'grid'|'bars'|'info';color?:string;size?:number}){
 return <Svg width={size} height={size} viewBox="0 0 48 48">
 {kind==='sun'?<><Circle cx="24" cy="24" r="10" fill={color}/>{[[24,2,24,9],[24,39,24,46],[2,24,9,24],[39,24,46,24],[8,8,13,13],[35,35,40,40],[8,40,13,35],[35,13,40,8]].map((a,i)=><Line key={i} x1={a[0]} y1={a[1]} x2={a[2]} y2={a[3]} stroke={color} strokeWidth="2.5"/>)}</>:null}
 {kind==='house'?<Path d="M3 23 L24 4 L45 23 L39 23 L39 44 L28 44 L28 31 L20 31 L20 44 L9 44 L9 23 Z" fill={color}/>:null}
 {kind==='bars'?<><Rect x="4" y="29" width="9" height="16" rx="2" fill={color}/><Rect x="19" y="17" width="9" height="28" rx="2" fill={color}/><Rect x="34" y="4" width="9" height="41" rx="2" fill={color}/></>:null}
 {kind==='grid'?<Path d="M24 2 L9 46 M24 2 L39 46 M14 15 L34 15 L39 22 L9 22 Z M12 29 L36 29 M17 11 L31 38 L12 29 L34 15 M31 11 L17 38 L36 29 L14 15 M18 9 L30 9" stroke={color} strokeWidth="2.3" fill="none"/>:null}
 {kind==='info'?<><Circle cx="24" cy="24" r="21" fill={color}/><Circle cx="24" cy="13" r="2" fill="white"/><Rect x="22" y="20" width="4" height="17" fill="white"/></>:null}
 </Svg>;
}
function Header({report}:{report:EnergyReport}){return <View fixed style={st.header}><View><Text style={st.brand}>SOLARIS</Text><Text style={st.tag}>ENERGY SOLUTIONS</Text><Text style={st.slogan}>Iluminando el mañana</Text></View><View style={st.meta}><Text style={st.bold}>{report.system_code}</Text><Text style={{marginTop:4}}>{date(report.published_at||report.created_at||'')}</Text><Text style={{marginTop:4}}>Reporte de monitoreo</Text>{report.status==='draft'&&<Text style={{color:'#A66B00',marginTop:4}}>BORRADOR · NO PUBLICADO</Text>}</View></View>}
function Footer({report,page,total}:{report:EnergyReport;page:number;total:number}){return <View fixed style={{position:'absolute',top:805,left:35,right:35,height:18,flexDirection:'row',fontSize:8,color:muted}}><Text style={{width:'34%'}}>{report.system_code} · {date(report.published_at||report.created_at||'')}</Text><Text style={{width:'52%',textAlign:'center'}}>SOLARIS Energy Solutions · {report.system_code}</Text><Text style={{width:'14%',textAlign:'right'}}>{page} / {total}</Text></View>;}
function Rows({rows,bold=false}:{rows:[string,string][];bold?:boolean}){return <View>{rows.map(([a,b])=><View wrap={false} key={a} style={st.row}><Text style={st.label}>{a}</Text><Text style={[st.cell,bold?st.bold:{}]}>{b||'Sin registro'}</Text></View>)}</View>}
function Metric({kind,label,value,sub}:{kind:'sun'|'house'|'grid'|'bars';label:string;value:string;sub:string}){return <View style={st.card}><Icon kind={kind}/><View style={{flex:1}}><Text style={{fontSize:8.5}}>{label}</Text><Text style={{fontSize:17,fontFamily:'Helvetica-Bold',lineHeight:1.3,marginVertical:3}}>{value}</Text><Text style={{fontSize:8,color:muted}}>{sub}</Text></View></View>}
function DailyChart({days,expected}:{days:EnergyDay[];expected:number|null}){
 const max=Math.max(1,...days.map(d=>d.production),expected||0)*1.15;
 const left=40,top=18,width=460,height=220,step=width/Math.max(days.length,1);
 return <Svg width="100%" height={242} viewBox="0 0 525 282">
 {[0,1,2,3,4,5].map(i=>{const y=top+height-height*i/5;return <G key={i}><Line x1={left} x2={left+width} y1={y} y2={y} stroke="#E3E8ED" strokeWidth=".5"/><Text x="31" y={y+3} style={{fontSize:8,fill:navy,textAnchor:'end'}}>{energyNumber(max*i/5,1)}</Text></G>})}
 <Line x1={left} x2={left} y1={top} y2={top+height} stroke={navy} strokeWidth=".7"/>
 {days.map((d,i)=>{const h=d.count?d.production/max*height:0,x=left+i*step+step*.15;return <G key={d.date}><Rect x={x} y={top+height-h} width={step*.7} height={h} rx="2" fill={navy}/><Text x={x+step*.35} y={top+height-h-5} style={{fontSize:days.length>20?6:8,fill:navy,textAnchor:'middle'}}>{d.count?energyNumber(d.production,1):'s/d'}</Text><Text x={x+step*.35} y={top+height+14} style={{fontSize:7,fill:navy,textAnchor:'middle'}}>{d.date.slice(8)}</Text></G>})}
 {expected!==null&&<Line x1={left} x2={left+width} y1={top+height-expected/max*height} y2={top+height-expected/max*height} stroke={yellow} strokeWidth="2" strokeDasharray="7 5"/>}
 <Text x="270" y="278" style={{fontSize:9,fill:muted,textAnchor:'middle'}}>{days[0]?.date} - {days.at(-1)?.date} · kWh por día</Text>
 </Svg>;
}
export function EnergyReportPdf({report}:{report:EnergyReport}) {
 const s=report.snapshot,t=s.totals,d=s.reportDetails,p=reportPerformance(s),period=`${date(s.options.start)} al ${date(s.options.end)}`;
 const dailyReference=p.expected!==null?d!.expectedDaily:null;
 const share=t.production>0?Math.min(100,Math.max(0,t.selfConsumption/t.production*100)):null;
 const exportShare=t.production>0?t.exported/t.production*100:null;
 const percent=(v:number|null)=>v===null?'No disponible':`${energyNumber(v,1)} %`;
 const chunks:EnergyDay[][]=[];for(let i=0;i<s.daily.length;i+=31)chunks.push(s.daily.slice(i,i+31));if(!chunks.length)chunks.push([]);
 const noteChunks=formattedChunks(report.notes||'Pendientes de revisión y aprobación por SOLARIS.');
 const totalPages=1+chunks.length+noteChunks.length;
 return <Document title="Monitoreo y desempeño energético" author="SOLARIS ENERGY SOLUTIONS">
 <Page size="A4" style={st.page}><Header report={report}/><Text style={st.title}>Monitoreo y desempeño energético</Text>
 <Rows rows={[["CLIENTE",d?.client||''],["TÉCNICO RESPONSABLE",d?.technician||''],["UBICACIÓN",d?.location||''],["SISTEMA",report.system_code]]}/>
 {d?.measurementSource&&<Text style={[st.small,{marginTop:6}]}>Fuente de medición: {d.measurementSource}</Text>}<Text style={st.heading}>Información del sistema</Text><Rows rows={[["Tipo de sistema",d?.systemType||''],["Número de módulos",d?.modules||''],["Módulos / microinversores",d?.equipment||''],["Capacidad instalada estimada",d?.capacity||'']]}/>
 <Text style={st.heading}>Resumen del periodo evaluado</Text><Rows bold rows={[["Periodo de monitoreo",period],["Días evaluados",String(p.days)],["Generación fotovoltaica",kwh(t.production)],["Consumo total registrado",kwh(t.consumption)],["Autoconsumo solar",kwh(t.selfConsumption)],["Importación desde la red",kwh(t.imported)],["Exportación hacia la red",kwh(t.exported)],["Cumplimiento de generación estimada",percent(p.compliance)]]}/>
 <View style={[st.panel,{marginTop:20}]}><Text style={[st.heading,{marginTop:0}]}>Indicadores principales</Text><View style={st.cards}>
 <Metric kind="sun" label="Generación fotovoltaica" value={kwh(t.production)} sub={`en ${p.days} ${p.days===1?'día':'días'}`}/><Metric kind="bars" label="Cumplimiento de generación estimada" value={percent(p.compliance)} sub={p.expected!==null?`${energyNumber(t.production)} / ${energyNumber(p.expected)} kWh`:'Sin referencia validada'}/>
 <Metric kind="house" label="Autoconsumo solar" value={kwh(t.selfConsumption)} sub={`${percent(share)} de la generación`}/><Metric kind="grid" label="Importación de la red" value={kwh(t.imported)} sub={`en ${p.days} ${p.days===1?'día':'días'}`}/></View></View><Footer report={report} page={1} total={totalPages}/></Page>
 {chunks.map((days,index)=><Page key={index} size="A4" style={st.page}><Header report={report}/><Text style={st.title}>Generación fotovoltaica ({p.days} {p.days===1?'día':'días'})</Text>
 <View style={{marginLeft:40,marginBottom:10}}><Text style={{color:'#A87500',marginBottom:4}}>---  {dailyReference!==null?`Referencia: ${energyNumber(dailyReference)} kWh/día`:'Referencia: no configurada'}</Text><View style={{flexDirection:'row',alignItems:'center',gap:6}}><View style={{width:14,height:7,backgroundColor:navy,borderRadius:2}}/><Text>Generación registrada</Text></View></View>
 <DailyChart days={days} expected={dailyReference}/><Text style={st.heading}>Resultados de desempeño</Text><View style={st.panel}><Rows bold rows={[["Generación esperada diaria",dailyReference!==null?`${energyNumber(dailyReference)} kWh/día`:'No disponible'],["Generación esperada del periodo",kwh(p.expected)],["Generación registrada",kwh(t.production)],["Diferencia respecto a la esperada",kwh(p.difference)],["Cumplimiento de generación estimada",percent(p.compliance)]]}/></View>
 <View style={[st.panel,{marginTop:24}]}><View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:8}}><Icon kind="info" color="#476782" size={23}/><Text style={st.bold}>Interpretación</Text></View><Text style={st.body}>{d?.interpretation?<Rich value={d.interpretation}/>:!p.complete?`En las mediciones disponibles se registraron ${kwh(t.production)} de generación solar. Faltan datos para completar el periodo; por ello, aún no es posible compararlo con la generación estimada.`:p.compliance===null?`Durante el periodo, tus paneles generaron ${kwh(t.production)}. Este informe muestra la energía registrada; todavía no cuenta con una estimación de generación para compararla.`:`Durante el periodo, tus paneles generaron ${kwh(t.production)}, frente a una generación estimada de ${kwh(p.expected)}. ${Math.abs(p.difference??0)<0.005?'La generación registrada coincidió con la estimación.':`La generación fue ${kwh(Math.abs(p.difference??0))} ${p.difference!<0?'menor':'mayor'} que lo estimado (${energyNumber(Math.abs(p.compliance-100),1)} % ${p.difference!<0?'por debajo':'por encima'}).`}`}</Text></View><Footer report={report} page={index+2} total={totalPages}/></Page>)}
 <Page size="A4" style={st.page}><Header report={report}/><Text style={[st.title,{marginBottom:3}]}>Destino de la energía fotovoltaica</Text><Text style={{color:muted,marginBottom:12}}>Energía acumulada del {period}</Text>
 <View wrap={false} style={st.panel}><View style={{flexDirection:'row',gap:18,alignItems:'center'}}><Icon kind="sun" size={44}/><View><Text style={st.bold}>Generación fotovoltaica total</Text><Text style={[st.big,{fontSize:27}]}>{kwh(t.production)}</Text></View></View>
 {share!==null?<View style={{flexDirection:'row',height:38,borderRadius:6,overflow:'hidden',marginTop:15,marginBottom:15}}><View style={{width:`${share}%`,backgroundColor:yellow,justifyContent:'center',alignItems:'center'}}>{share>=12&&<Text style={{color:navy,fontFamily:'Helvetica-Bold'}}>{percent(share)}</Text>}</View><View style={{flex:1,backgroundColor:navy,justifyContent:'center',alignItems:'center'}}>{100-share>=12&&<Text style={{color:'white',fontFamily:'Helvetica-Bold'}}>{percent(exportShare)}</Text>}</View></View>:<Text style={{marginVertical:15}}>Sin generación solar registrada.</Text>}
 <View style={{flexDirection:'row',gap:20}}><View style={{width:'50%'}}><View style={{flexDirection:'row',alignItems:'center',gap:6}}><View style={{width:9,height:9,borderRadius:5,backgroundColor:yellow}}/><Text>Autoconsumida</Text></View><Text style={st.big}>{kwh(t.selfConsumption)}</Text><Text style={st.small}>{percent(share)} de la generación</Text></View><View style={{width:'50%'}}><View style={{flexDirection:'row',alignItems:'center',gap:6}}><View style={{width:9,height:9,borderRadius:5,backgroundColor:navy}}/><Text>Exportada</Text></View><Text style={st.big}>{kwh(t.exported)}</Text><Text style={st.small}>{percent(exportShare)} de la generación</Text></View></View></View>
 <View wrap={false} style={[st.panel,{marginTop:8,flexDirection:'row',gap:20,alignItems:'center'}]}><Icon kind="grid" color="#476782" size={42}/><View><Text style={st.bold}>Importación desde la red (CFE)</Text><Text style={[st.big,{fontSize:25}]}>{kwh(t.imported)}</Text><Text style={st.small}>en {p.days} días</Text></View></View>
 <Text style={st.heading}>Conclusiones</Text>{noteChunks[0].split(/\n\s*\n/).map((text,i)=><Text key={i} style={[st.body,{marginBottom:10}]}><Rich value={text}/></Text>)}
 {!p.complete&&<Text style={st.small}>Resultados parciales: existen intervalos sin datos válidos. No se interpolaron mediciones.</Text>}<Footer report={report} page={chunks.length+2} total={totalPages}/></Page>
 {noteChunks.slice(1).map((note,i)=><Page key={i} size="A4" style={st.page}><Header report={report}/><Text style={st.title}>Conclusiones · continuación</Text><Text style={st.body}><Rich value={note}/></Text><Footer report={report} page={chunks.length+3+i} total={totalPages}/></Page>)}
 </Document>;
}




