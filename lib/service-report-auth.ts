import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export async function reportAdmin() {
 const jar=await cookies();
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key) throw new Error('Conexión no configurada.');
 const db=createServerClient(url,key,{cookies:{getAll:()=>jar.getAll(),setAll:items=>items.forEach(({name,value,options})=>jar.set(name,value,options))}});
 const {data,error}=await db.auth.getUser();
 if(error||data.user?.app_metadata.role!=='admin') return null;
 return db;
}
