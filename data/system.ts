export type MaintenanceItem = {
  date: string;
  type: string;
  status: string;
  technician: string;
  hasReport: boolean;
  hasPhotos: boolean;
  hasObservations: boolean;
};

export type SystemDocument = {
  name: string;
  type: string;
  fileUrl: string | null;
  publishedAt: string | null;
};

export type SolarSystem = {
  id: string;
  clientName: string | null;
  welcomeLabel: "Bienvenido" | "Bienvenida";
  installedPower: string;
  installationDate: string;
  lastMaintenance: string;
  nextMaintenance: string;
  maintenanceHistory: MaintenanceItem[];
  documents: SystemDocument[];
  observations: string[];
};

export const system: SolarSystem = {
  id: "FV-0001",
  clientName: "Karina de la Rosa",
  welcomeLabel: "Bienvenida",
  installedPower: "8.68 kWp",
  installationDate: "Mayo 2026",
  lastMaintenance: "14 agosto 2026",
  nextMaintenance: "Agosto 2027",
  maintenanceHistory: [
    { date: "14/08/2026", type: "Mantenimiento preventivo", status: "Completado", technician: "Equipo Solaris", hasReport: true, hasPhotos: true, hasObservations: true },
    { date: "03/02/2027", type: "Inspección eléctrica", status: "Completado", technician: "Equipo Solaris", hasReport: true, hasPhotos: true, hasObservations: true },
  ],
  documents: [
    { name: "Ficha técnica", type: "PDF", fileUrl: null, publishedAt: "2026-05-18T12:00:00Z" },
    { name: "Reporte de mantenimiento", type: "PDF", fileUrl: null, publishedAt: "2026-08-14T12:00:00Z" },
    { name: "Fotografías", type: "Galería", fileUrl: null, publishedAt: "2026-08-14T12:00:00Z" },
    { name: "Diagrama unifilar", type: "PDF", fileUrl: null, publishedAt: "2026-05-18T12:00:00Z" },
    { name: "Documentación adicional", type: "Archivo", fileUrl: null, publishedAt: "2026-05-18T12:00:00Z" },
  ],
  observations: [
    "Se realizó inspección visual, limpieza general y revisión de conexiones accesibles.",
    "Se recomienda realizar nuevamente mantenimiento preventivo en agosto de 2027.",
  ],
};
