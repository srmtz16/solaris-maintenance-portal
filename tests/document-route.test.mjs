import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { documentAccessInput, documentStoragePath } from '../lib/document-access.ts';
const source=readFileSync(new URL('../app/api/documents/[id]/route.ts',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export async function GET','async function GET').replace('export const dynamic','const dynamic');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const factory=new Function('createServerClient','createClient','cookies','NextResponse','documentAccessInput','documentStoragePath','process',`${compiled};return GET;`);
function setup({ authorized=true, configured=true, storageError=false, wrongOrigin=false }={}){
 const calls=[];
 const handler=factory(()=>({rpc:async(name,input)=>{calls.push(['authorize',name,input]);return {data:authorized?{bucket:'system-documents',path:'FV-0001/report.pdf'}:null,error:null};}}),()=>({storage:{from:bucket=>({createSignedUrl:async(path,seconds)=>{calls.push(['sign',bucket,path,seconds]);return {error:storageError,data:{signedUrl:`https://${wrongOrigin?'evil.test':'example.supabase.co'}/storage/v1/object/sign/system-documents/FV-0001/report.pdf?token=temporary`}};}})}}),async()=>({getAll:()=>[],set(){}}),{json:Response.json,redirect:(url,options)=>new Response(null,{...options,headers:{...options.headers,Location:String(url)}})},documentAccessInput,documentStoragePath,{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:configured?'server-only':undefined}});
 return {calls,run:(id='1',query='')=>handler(new Request(`https://solaris.test/api/documents/${id}${query}`),{params:Promise.resolve({id})})};
}
test('document endpoint never signs unauthorized or malformed requests',async()=>{
 const denied=setup({authorized:false});assert.equal((await denied.run()).status,404);assert.equal(denied.calls.length,1);
 const invalid=setup();assert.equal((await invalid.run('../1')).status,404);assert.equal(invalid.calls.length,0);
 const missing=setup({configured:false});assert.equal((await missing.run()).status,503);assert.equal(missing.calls.length,0);
});
test('authorized file uses short-lived signing after caller authorization, no cache or referrer',async()=>{
 const {run,calls}=setup();const response=await run();
 assert.equal(response.status,307);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 assert.equal(calls[0][0],'authorize');assert.deepEqual(calls[1],['sign','system-documents','FV-0001/report.pdf',60]);
});
test('signing errors and unexpected destinations fail closed',async()=>{
 assert.equal((await setup({storageError:true}).run()).status,404);
 assert.equal((await setup({wrongOrigin:true}).run()).status,502);
});
