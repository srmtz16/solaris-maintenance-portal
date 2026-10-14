import ExcelJS from 'exceljs';
import { unzipSync } from 'fflate';
import { createHash } from 'node:crypto';

export const MAX_ENERGY_BYTES = 1_500_000;
export type EnergyTable = { headers: string[]; rows: unknown[][]; checksum: string; filename: string; mime: string };
export interface EnergyDataSource { readonly name: string; read(bytes: Uint8Array, filename: string, mime: string): Promise<EnergyTable> }

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
