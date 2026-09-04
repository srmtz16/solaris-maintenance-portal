import { PortalPage } from "../portal-page";
export default function Page({ params }: { params: Promise<{ id: string }> }) { return <PortalPage params={params} view="historial" />; }
