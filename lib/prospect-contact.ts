export const SOLARIS_WHATSAPP = "527778311043";
export const contactTopics = ["Orientación", "Pasaporte Solar", "Mantenimiento", "Gestoría"] as const;
export type ContactTopic = (typeof contactTopics)[number];
export function contactTopic(value: unknown): ContactTopic {
  return contactTopics.find(topic => topic === value) || "Orientación";
}
export function whatsappUrl(phone: string, topic: ContactTopic = "Orientación", form?: FormData) {
  const value = (key: string) => String(form?.get(key) || "").trim();
  const greetings: Record<ContactTopic, string> = {
    Orientación: "Hola, quisiera orientación sobre los servicios de SOLARIS.",
    "Pasaporte Solar": "Hola, quiero conocer cómo obtener el Pasaporte Solar para mi sistema.",
    Mantenimiento: "Hola, quiero cotizar un mantenimiento para mi sistema fotovoltaico.",
    Gestoría: "Hola, necesito orientación para un trámite o gestoría CFE.",
  };
  const lines = [greetings[topic], ""];
  if (topic === "Mantenimiento") lines.push(`Número aproximado de paneles: ${value("panels")}`, `Zona: ${value("zone")}`, `¿Presenta alguna falla? ${value("failure") || "Sí / No"}`);
  else if (form) lines.push(`Zona: ${value("zone")}`);
  if (form) {
    lines.push("", `Nombre: ${value("name")}`, `Teléfono: ${value("phone")}`);
    if (value("installation")) lines.push(`Tipo de instalación: ${value("installation")}`);
    if (value("comments")) lines.push(`Comentarios: ${value("comments")}`);
  }
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(lines.join("\n"))}`;
}
