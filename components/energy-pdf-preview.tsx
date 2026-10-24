'use client';
import {useEffect,useRef,useState} from 'react';
import type {PDFDocumentProxy} from 'pdfjs-dist';

/** Preview and download exactly the same PDF bytes, without a browser PDF plugin. */
export function EnergyPdfPreview({blob,url,filename}:{blob?:Blob;url?:string;filename:string}) {
 const [document,setDocument]=useState<PDFDocumentProxy|null>(null);
 const [download,setDownload]=useState(''),[error,setError]=useState('');
 const [page,setPage]=useState(1),[zoom,setZoom]=useState(100),[rendering,setRendering]=useState(true);
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  let active=true,objectUrl='';
  const abort=new AbortController();
  let dispose:(()=>void)|undefined;
  async function load(){
   try {
    let file=blob;
    if(!file&&url){const response=await fetch(url,{signal:abort.signal,cache:'no-store'});if(!response.ok)throw new Error('No se pudo abrir el PDF. Intenta nuevamente.');file=await response.blob();}
    if(!file||!active)return;
    if(!file.type.includes('application/pdf'))throw new Error('La respuesta no contiene un PDF válido.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    const pdfjs=await import('pdfjs-dist');
    if(!active)return;
    const port=new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url),{type:'module'});
    const worker=pdfjs.PDFWorker.create({port});
    const task=pdfjs.getDocument({data:bytes,worker,useSystemFonts:true});
    dispose=()=>{void task.destroy();worker.destroy();port.terminate();};
    const pdf=await task.promise;
    if(!active)return;
    objectUrl=URL.createObjectURL(file);setDownload(objectUrl);setDocument(pdf);
   }catch(e){if(active)setError(e instanceof Error?e.message:'No se pudo abrir el PDF.');}
  }
  void load();return()=>{active=false;abort.abort();dispose?.();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[blob,url]);
 useEffect(()=>{
  if(!document||!canvas.current)return;
  let active=true;let cancel:(()=>void)|undefined;
  const target=canvas.current;
  async function draw(){
   setRendering(true);setError('');
   try {
    const pdfPage=await document!.getPage(page);
    if(!active)return;
    const viewport=pdfPage.getViewport({scale:2});
    target.width=viewport.width;target.height=viewport.height;
    const task=pdfPage.render({canvas:target,viewport});
    cancel=()=>task.cancel();await task.promise;
    if(active)setRendering(false);
   }catch(e){if(active){setError(e instanceof Error?e.message:'No se pudo mostrar la página.');setRendering(false);}}
  }
  void draw();return()=>{active=false;cancel?.();};
 },[document,page]);
 const control='min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm disabled:opacity-40';
 return <section aria-label="Vista previa del PDF final" className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
  <header className="flex flex-wrap items-center justify-between gap-3 bg-white p-4"><div><h3 className="font-semibold">Vista previa del reporte final</h3><p className="mt-1 text-sm text-slate-500">Revisa las páginas. Descargarás este mismo documento.</p></div>{download&&<a style={{color:"#fff"}} className="inline-flex min-h-11 items-center rounded-xl bg-[#06131B] px-5 py-3 text-sm font-semibold text-white" href={download} download={filename}>Descargar PDF</a>}</header>
  {document&&<div className="flex flex-wrap items-center justify-center gap-2 border-y border-slate-200 p-3" aria-label="Controles del PDF"><button type="button" className={control} disabled={page===1||rendering} onClick={()=>setPage(page-1)}>Anterior</button><span aria-live="polite" className="px-2 text-sm">Página {page} de {document.numPages}</span><button type="button" className={control} disabled={page===document.numPages||rendering} onClick={()=>setPage(page+1)}>Siguiente</button><label className="ml-2 text-sm">Zoom <select aria-label="Zoom del PDF" className={control} value={zoom} onChange={e=>setZoom(Number(e.target.value))}><option value={100}>Ajustar</option><option value={125}>125%</option><option value={150}>150%</option><option value={200}>200%</option></select></label></div>}
  {error&&<p role="alert" className="p-5 text-sm text-red-700">{error}</p>}
  {!document&&!error&&<p role="status" className="p-8 text-center text-sm">Abriendo páginas del PDF…</p>}
  {document&&<div style={{overflow:'auto',maxHeight:'80vh'}} className="p-2 sm:p-5" aria-busy={rendering}>{rendering&&<p role="status" className="pb-2 text-center text-sm">Preparando página…</p>}<div style={{width:`${zoom}%`,margin:'0 auto'}}><canvas ref={canvas} role="img" aria-label={`Página ${page} del reporte final. El PDF descargable contiene el texto completo.`} style={{display:'block',width:'100%',height:'auto',background:'white',boxShadow:'0 2px 10px #0002'}}/></div></div>}
 </section>;
}


