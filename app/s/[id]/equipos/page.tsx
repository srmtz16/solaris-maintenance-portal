import { notFound } from "next/navigation";
import { PropertyEquipmentModule } from "@/components/property-equipment-module";
import { getPublicSystem } from "@/lib/system-data";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
 const { id: portalKey } = await params;
 const system = await getPublicSystem(portalKey);
 if (!system) notFound();
 return <PropertyEquipmentModule portalKey={portalKey} systemCode={system.id} />;
}
