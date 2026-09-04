import { notFound } from "next/navigation";
import { SystemPortal, type SystemPortalView } from "@/components/system-portal";
import { getPublicSystem } from "@/lib/system-data";

export async function PortalPage({ params, view }: { params: Promise<{ id: string }>; view: SystemPortalView }) {
  const { id: portalKey } = await params;
  const system = await getPublicSystem(portalKey);
  if (!system) notFound();
  return <SystemPortal system={system} portalKey={portalKey} view={view} />;
}
