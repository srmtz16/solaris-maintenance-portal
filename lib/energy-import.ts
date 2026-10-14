import ExcelJS from 'exceljs';
import { unzipSync } from 'fflate';
import { createHash } from 'node:crypto';
import type { EnergyMapping, EnergyOptions } from './energy-metrics';

export const MAX_ENERGY_BYTES = 1_500_000;
export type EnergyTable = { headers: string[]; rows: unknown[][]; checksum: string; filename: string; mime: string };
export interface EnergyDataSource { readonly name: string; read(bytes: Uint8Array, filename: string, mime: string): Promise<EnergyTable> }

// Smappee exports carry their units in the headings. Never guess kWh or allow
// the browser to override source metadata when calculating a report.
export function inspectEnergyTable(table: EnergyTable): EnergyOptions {
  const names: Record<keyof EnergyMapping, string> = {timestamp:'Date',consumption:'Consumption',production:'Production',imported:'Import',exported:'Export'};
  const mapping = {} as EnergyMapping;
  const units = new Set<string>();
  for (const field of Object.keys(names) as (keyof EnergyMapping)[]) {
    const matches = table.headers.map((header,index)=>({header:header.trim(),index})).filter(({header})=>field==='timestamp' ? header==='Date' : new RegExp(`^${names[field]} \\[(Wh|kWh)\\]$`).test(header));
    if(matches.length!==1) throw new Error('El archivo debe conservar las columnas Date, Consumption, Production, Import y Export de Smappee, con su unidad [Wh] o [kWh].');
    mapping[field]=matches[0].index;
    if(field!=='timestamp')units.add(/\[(Wh|kWh)\]$/.exec(matches[0].header)![1]);
  }
  if(units.size!==1)throw new Error('Las columnas del archivo deben usar una misma unidad: Wh o kWh.');
  const stamps=table.rows.map(row=>{
    const value=row[mapping.timestamp];
    const match=typeof value==='string'?/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim()):null;
    if(!match)throw new Error('El archivo contiene fechas sin reconocer. Prepáralas como AAAA-MM-DD HH:mm:ss antes de importarlo.');
    const stamp=`${match[1]}T${match[2]}:${match[3]}:${match[4]||'00'}`;
    const time=Date.parse(stamp+'Z');
    if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,19)!==stamp)throw new Error('El archivo contiene una fecha inválida. Corrígela antes de importarlo.');
    return stamp;
  }).sort();
  const unique=[...new Set(stamps)];
  const gaps=unique.slice(1).map((s,i)=>(Date.parse(s+'Z')-Date.parse(unique[i]+'Z'))/60000);
  const interval=([60,30,15] as const).find(n=>gaps.length>0&&gaps.includes(n)&&gaps.every(g=>g%n===0)&&unique.every(s=>Number(s.slice(14,16))%n===0&&s.slice(17)==='00'));
  if(!interval)throw new Error('No se reconoce una frecuencia regular de 15, 30 o 60 minutos en el archivo. Revisa sus fechas antes de importarlo.');
  return {mapping,unit:[...units][0] as 'Wh'|'kWh',timezone:'America/Merida',start:stamps[0].slice(0,10),end:stamps.at(-1)!.slice(0,10),interval};
}

function csv(text: string): string[][] {
  if (text.includes('\0')) throw new Error('El CSV contiene datos binarios.');
  const firstLine = text.split(/\r?\n/,1)[0], delimiter = firstLine.includes(';') ? ';' : ',';
  const result: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i=0;i<text.length;i++) {
    const ch=text[i];
    if(ch==='"') { if(quoted && text[i+1]==='"'){cell+='"';i++;} else if(!quoted && cell.length) throw new Error('CSV inválido.'); else quoted=!quoted; }
    else if(!quoted && ch===delimiter) {row.push(cell);cell='';}
    else if(!quoted && (ch==='\n'||ch==='\r')) {if(ch==='\r'&&text[i+1]==='\n') i++;row.push(cell);if(row.some(v=>v.trim()))result.push(row);row=[];cell='';}
    else cell+=ch;
    if(cell.length>2000||row.length>32||result.length>10001) throw new Error('El archivo excede los límites de filas, columnas o texto.');
  }
  if(quoted) throw new Error('CSV con comillas sin cerrar.');
  row.push(cell);if(row.some(v=>v.trim()))result.push(row);return result;
}
export const smappeeFileSource: EnergyDataSource = {
  name:'Smappee — importación manual',
  async read(bytes,filename,mime) {
    if(!bytes.length || bytes.length>MAX_ENERGY_BYTES) throw new Error('El archivo debe pesar como máximo 1.5 MB.');
    let table: unknown[][];
    if(filename.toLowerCase().endsWith('.xlsx')) {
      if(!['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream',''].includes(mime) || bytes[0]!==80||bytes[1]!==75) throw new Error('El contenido no es un XLSX válido.');
      let size=0, entries=0;
      // Inspect declared expansion before ExcelJS decompresses the package.
      unzipSync(bytes,{filter(entry){size+=entry.originalSize;entries++;if(size>12_000_000||entries>200||entry.name.includes('vbaProject'))throw new Error('Excel demasiado grande o con macros.');return false;}});
      const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(bytes) as never);
      if(workbook.worksheets.length!==1) throw new Error('Importa un archivo con una sola hoja de mediciones.');
      const sheet=workbook.worksheets[0];
      if(sheet.rowCount>10001||sheet.columnCount>32)throw new Error('Máximo 10,000 mediciones y 32 columnas.');
      table=[];
      sheet.eachRow({includeEmpty:true},r=>{const row: unknown[]=[];for(let c=1;c<=sheet.columnCount;c++){const v=r.getCell(c).value;if(v instanceof Date)row.push(v.toISOString().slice(0,19).replace('T',' '));else if(v===null||typeof v==='string'||typeof v==='number')row.push(v);else throw new Error('No se admiten fórmulas, enlaces ni celdas compuestas; exporta valores.');}table.push(row);});
    } else if(filename.toLowerCase().endsWith('.csv')) {
      if(!['text/csv','text/plain','application/vnd.ms-excel','application/octet-stream',''].includes(mime))throw new Error('Tipo de CSV no admitido.');
      table=csv(new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,''));
    } else throw new Error('Selecciona un CSV UTF-8 o un XLSX.');
    if(table.length<2)throw new Error('No hay mediciones.');
    const headers=table[0].map(v=>String(v??'').trim());
    if(headers.some(v=>!v||v.length>150)||new Set(headers).size!==headers.length)throw new Error('Los encabezados deben ser únicos y no estar vacíos.');
    if(table.slice(1).some(r=>r.length!==headers.length))throw new Error('Las filas no tienen el mismo número de columnas.');
    return {headers,rows:table.slice(1),checksum:createHash('sha256').update(bytes).digest('hex'),filename:filename.slice(0,180),mime};
  }
};
