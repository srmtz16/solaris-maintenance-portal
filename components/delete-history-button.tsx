"use client";

import { useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function DeleteHistoryButton({ kind, id, label, onDeleted }: {
  kind: "maintenance" | "request"; id: string; label: string; onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    const detail = kind === "maintenance"
      ? "Se retirará del historial del administrador y del cliente. Las fotografías y reportes se conservan en Documentos; puedes eliminarlos por separado."
      : "Se eliminará esta solicitud del historial. Los mantenimientos realizados se conservan.";
    if (!window.confirm(`¿Eliminar ${label}?\n\n${detail}\n\nEsta acción no se puede deshacer.`)) return;
    setBusy(true);
    setError("");
    try {
      const result = await getSupabaseBrowserClient().rpc("admin_delete_history", { p_kind: kind, p_id: id });
      if (result.error || result.data !== true) throw new Error("No se pudo eliminar el registro. Recarga la página e inténtalo nuevamente.");
      onDeleted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar el registro.");
    } finally { setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={() => void remove()} aria-label={`Eliminar ${label}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}{busy ? "Eliminando…" : "Eliminar"}</button>{error && <p role="alert" className="mt-2 max-w-xs text-xs text-red-700">{error}</p>}</div>;
}
