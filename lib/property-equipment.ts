// Complementary property equipment; never includes the photovoltaic system.
export const EQUIPMENT_LIMIT = 3;
// Enable only after private storage is configured and verified.
export const EQUIPMENT_PHOTOS_ENABLED = false;
export const UPCOMING_SERVICE_DAYS = 30;
export const equipmentTypes = ["Aire acondicionado", "Presurizador", "Suavizador de agua", "Calentador", "Bomba de piscina", "Bomba de agua", "Refrigerador", "Planta eléctrica", "Cargador de vehículo eléctrico", "Otro"] as const;
export const equipmentServiceTypes = ["Preventivo", "Correctivo", "Inspección", "Limpieza", "Instalación", "Otro"] as const;
export type EquipmentType = typeof equipmentTypes[number];
export type EquipmentServiceType = typeof equipmentServiceTypes[number];
export type EquipmentStatus = "current" | "upcoming" | "overdue" | "no-history";
export const equipmentStatusLabels: Record<EquipmentStatus, string> = {
  current: "Al día", upcoming: "Próximo servicio", overdue: "Fecha de servicio vencida", "no-history": "Sin historial",
};
// Reserved integration signal, not a mechanical diagnosis or mascot behavior.
export const equipmentStatusSignals = { current: "optimal", upcoming: "attention", overdue: "alert", "no-history": null } as const;

export function isEquipmentDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function equipmentToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export type EquipmentServiceDates = { id: string; service_date: string; next_service_date: string | null; created_at: string };

export function equipmentMaintenanceSummary(records: readonly EquipmentServiceDates[], today = equipmentToday()) {
  if (!isEquipmentDate(today)) throw new Error("Fecha de referencia inválida.");
  // Sort by performed date, not upload order: adding an old record must not
  // replace a more recent service. Dates without a new suggestion retain the
  // last explicitly recorded suggestion, as requested by the product flow.
  const history = records.filter(r => isEquipmentDate(r.service_date) && r.service_date <= today)
    .slice().sort((a, b) => b.service_date.localeCompare(a.service_date) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  const lastService = history[0]?.service_date ?? null;
  const nextService = history.find(r => isEquipmentDate(r.next_service_date))?.next_service_date ?? null;
  let status: EquipmentStatus = lastService ? "current" : "no-history";
  if (nextService) {
    const days = (Date.parse(`${nextService}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000;
    status = days < 0 ? "overdue" : days <= UPCOMING_SERVICE_DAYS ? "upcoming" : "current";
  }
  return { lastService, nextService, status, label: equipmentStatusLabels[status] };
}

export type EquipmentInput = {
  type: EquipmentType; name: string; brand: string | null; model: string | null;
  serial_number: string | null; location: string | null; installed_on: string | null; notes: string | null;
};

export type EquipmentService = EquipmentServiceDates & { type: EquipmentServiceType; provider: string; description: string; photo_path: string | null };
export type PropertyEquipment = EquipmentInput & { id: string; asset_code: string; photo_path: string | null; services: EquipmentService[] };
export type EquipmentPortal = { systemId: number; systemCode: string; completed: boolean; skipped: boolean; equipment: PropertyEquipment[] };

export function parseEquipmentService(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Servicio inválido.");
  const input = value as Record<string, unknown>;
  if (!equipmentServiceTypes.includes(input.type as EquipmentServiceType)) throw new Error("Selecciona un tipo de servicio.");
  if (!isEquipmentDate(input.service_date) || input.service_date > equipmentToday()) throw new Error("La fecha del servicio no es válida o es futura.");
  const next = input.next_service_date || null;
  if (next !== null && (!isEquipmentDate(next) || next < input.service_date)) throw new Error("La próxima fecha debe ser posterior o igual al servicio.");
  return { service_date: input.service_date, type: input.type as EquipmentServiceType, provider: textField(input.provider, "Empresa o técnico", 150) || "", description: textField(input.description, "Descripción", 2000, true)!, next_service_date: next };
}

function textField(value: unknown, label: string, max: number, required = false) {
  if (value == null || value === "") {
    if (required) throw new Error(`${label} es obligatorio.`);
    return null;
  }
  if (typeof value !== "string") throw new Error(`${label} no es válido.`);
  const text = value.trim();
  if (text.length > max || (required && !text)) throw new Error(`Revisa ${label.toLocaleLowerCase("es-MX")}.`);
  return text || null;
}

export function parseEquipmentInput(value: unknown): EquipmentInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Datos de equipo inválidos.");
  const input = value as Record<string, unknown>;
  if (!equipmentTypes.includes(input.type as EquipmentType)) throw new Error("Selecciona un tipo de equipo.");
  const date = input.installed_on || null;
  if (date !== null && !isEquipmentDate(date)) throw new Error("Fecha de instalación inválida.");
  return {
    type: input.type as EquipmentType,
    name: textField(input.name, "Nombre", 120, true)!,
    brand: textField(input.brand, "Marca", 100), model: textField(input.model, "Modelo", 120),
    serial_number: textField(input.serial_number, "Número de serie", 150),
    location: textField(input.location, "Ubicación", 200), installed_on: date as string | null,
    notes: textField(input.notes, "Notas", 2000),
  };
}
