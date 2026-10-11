import Link from "next/link";
import { redirect } from "next/navigation";
export default async function Page({ params, searchParams }: { params: Promise<{ equipmentId: string }>; searchParams: Promise<{ property?: string }> }) {
  const { equipmentId } = await params;
  const { property } = await searchParams;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (property && uuid.test(property) && uuid.test(equipmentId)) redirect(`/s/${property}/equipos?equipment=${equipmentId}`);
  return <main className="mx-auto max-w-lg px-6 py-20"><h1 className="text-2xl font-semibold">Acceso al equipo</h1><p className="mt-4 text-sm leading-6 text-stone-500">Abre este equipo desde el Pasaporte SOLARIS de tu propiedad. Su identificador por sí solo no permite consultar el expediente.</p><Link href="/" className="mt-6 inline-block underline">Ir a SOLARIS</Link></main>;
}
