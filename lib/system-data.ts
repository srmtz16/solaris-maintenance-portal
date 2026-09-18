import "server-only";
import type { SolarSystem } from "@/data/system";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function dateLabel(value: unknown, monthOnly = false) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return "Sin registro";
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-MX", monthOnly ? { month: "long", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export async function getPublicSystem(portalKey: string): Promise<SolarSystem | null> {
  if (!uuidPattern.test(portalKey)) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/get_public_system`, {
      method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_public_token: portalKey }), cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.id !== "string") return null;
    const history = Array.isArray(data.maintenanceHistory) ? data.maintenanceHistory : [];
    const documents = Array.isArray(data.documents) ? data.documents : [];
    const observations = Array.isArray(data.observations) ? data.observations.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0) : [];
    return {
      id: data.id,
      clientName: typeof data.clientName === "string" && data.clientName.trim() ? data.clientName.trim() : null,
      welcomeLabel: data.welcomeLabel === "Bienvenida" ? "Bienvenida" : "Bienvenido",
      installedPower: typeof data.installedPower === "number" ? `${data.installedPower.toFixed(2)} kWp` : "Sin registro",
      numPanels: typeof data.numPanels === "number" ? String(data.numPanels) : "Sin registro",
      panelPower: typeof data.panelPowerW === "number" ? `${data.panelPowerW.toLocaleString("es-MX")} W` : "Sin registro",
      panelBrand: typeof data.panelBrand === "string" && data.panelBrand.trim() ? data.panelBrand.trim() : "Sin registro",
      inverterModel: typeof data.inverterModel === "string" && data.inverterModel.trim() ? data.inverterModel.trim() : "Sin registro",
      inverterSerial: typeof data.inverterSerial === "string" && data.inverterSerial.trim() ? data.inverterSerial.trim() : "Sin registro",
      systemStatus: typeof data.systemStatus === "string" && data.systemStatus.trim() ? data.systemStatus.trim() : "Sin registro",
      installationDate: dateLabel(data.installationDate, true), lastMaintenance: dateLabel(data.lastMaintenance), nextMaintenance: dateLabel(data.nextMaintenance),
      maintenanceHistory: history.map((item: Record<string, unknown>) => ({ id: String(item.id || ""), work: String(item.work || ""), findings: String(item.findings || ""), recommendations: String(item.recommendations || ""), date: dateLabel(item.date), type: String(item.type || "Servicio"), status: "Completado", technician: String(item.technician || "Equipo Solaris"), hasReport: Boolean(item.hasReport), hasPhotos: Boolean(item.hasPhotos), hasObservations: Boolean(item.hasObservations) })),
      documents: documents.map((item: Record<string, unknown>) => ({
        name: String(item.name || "Documento"),
        type: String(item.type || "Archivo"),
        fileUrl: typeof item.fileUrl === "string" && /^https:\/\//i.test(item.fileUrl) ? item.fileUrl : null,
        publishedAt: typeof item.publishedAt === "string" ? item.publishedAt : null,
      })), observations,
    };
  } catch { return null; }
}
