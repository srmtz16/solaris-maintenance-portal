import assert from "node:assert/strict";
import test from "node:test";
import { installedPower, mapAdminSystem } from "../lib/admin-system.ts";

const row = {
  id: 1,
  created_at: "2026-09-09T12:00:00Z",
  system_code: "FV-0001",
  public_token: "200f62ce-1b62-4241-bfec-77f4203fd8be",
  adress: "Residencial Tamara",
  num_panels: 14,
  panel_power_w: 620,
  panel_brand: "Ejemplo",
  inverter_model: "INV-01",
  inverter_serial: "SERIE-01",
  installation_date: "2026-08-01",
  system_status: "Activo",
  Clientes: { id: 1, full_name: "Karina de la Rosa", phone: "9991263199", email: "cliente@example.com", notes: null, welcome_label: "Bienvenida" },
};

test("maps a Supabase system and its real client", () => {
  const system = mapAdminSystem(row);
  assert.equal(system?.systemCode, "FV-0001");
  assert.equal(system?.client.fullName, "Karina de la Rosa");
  assert.equal(system?.client.welcomeLabel, "Bienvenida");
  assert.equal(system && installedPower(system), "8.68 kWp");
});

test("rejects systems without a linked client", () => {
  assert.equal(mapAdminSystem({ ...row, Clientes: null }), null);
});
