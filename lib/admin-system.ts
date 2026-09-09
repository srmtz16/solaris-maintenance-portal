export type AdminClient = {
  id: number;
  fullName: string;
  phone: string;
  email: string;
  notes: string;
  welcomeLabel: "Bienvenido" | "Bienvenida";
};

export type AdminSystem = {
  id: number;
  createdAt: string;
  systemCode: string;
  publicToken: string;
  address: string;
  numPanels: number | null;
  panelPowerW: number | null;
  panelBrand: string;
  inverterModel: string;
  inverterSerial: string;
  installationDate: string;
  status: string;
  client: AdminClient;
};

function optionalText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : value === null ? null : Number(value) || null;
}

export function mapAdminSystem(value: Record<string, unknown>): AdminSystem | null {
  const relation = Array.isArray(value.Clientes) ? value.Clientes[0] : value.Clientes;
  if (!relation || typeof relation !== "object" || Array.isArray(relation)) return null;
  const client = relation as Record<string, unknown>;
  const id = Number(value.id);
  const clientId = Number(client.id);
  if (!Number.isInteger(id) || !Number.isInteger(clientId) || typeof value.system_code !== "string") return null;
  return {
    id,
    createdAt: optionalText(value.created_at),
    systemCode: value.system_code,
    publicToken: optionalText(value.public_token),
    address: optionalText(value.adress),
    numPanels: optionalNumber(value.num_panels),
    panelPowerW: optionalNumber(value.panel_power_w),
    panelBrand: optionalText(value.panel_brand),
    inverterModel: optionalText(value.inverter_model),
    inverterSerial: optionalText(value.inverter_serial),
    installationDate: optionalText(value.installation_date),
    status: optionalText(value.system_status) || "Activo",
    client: {
      id: clientId,
      fullName: optionalText(client.full_name),
      phone: optionalText(client.phone),
      email: optionalText(client.email),
      notes: optionalText(client.notes),
      welcomeLabel: client.welcome_label === "Bienvenida" ? "Bienvenida" : "Bienvenido",
    },
  };
}

export function installedPower(system: AdminSystem) {
  if (!system.numPanels || !system.panelPowerW) return "Sin configurar";
  return `${((system.numPanels * system.panelPowerW) / 1000).toFixed(2)} kWp`;
}
