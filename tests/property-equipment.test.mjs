import assert from "node:assert/strict";
import test from "node:test";
import { equipmentMaintenanceSummary, equipmentToday, isEquipmentDate, parseEquipmentInput, parseEquipmentService } from "../lib/property-equipment.ts";
const service = (date, next = null, id = "a") => ({ id, service_date: date, next_service_date: next, created_at: `${date}T12:00:00Z` });
test("date states use recorded dates and inclusive 30-day boundary", () => {
  const state = next => equipmentMaintenanceSummary([service("2026-01-01", next)], "2026-10-08").status;
  assert.equal(equipmentMaintenanceSummary([], "2026-10-08").status, "no-history");
  assert.equal(state("2026-10-07"), "overdue");
  assert.equal(state("2026-10-08"), "upcoming");
  assert.equal(state("2026-11-07"), "upcoming");
  assert.equal(state("2026-11-08"), "current");
  assert.equal(state(null), "current");
});
test("service records reject future work, invalid types and dates before the performed service", () => {
  const valid = { service_date: "2026-01-10", type: "Preventivo", provider: "Técnico independiente", description: "Limpieza general", next_service_date: "2026-07-10" };
  assert.equal(parseEquipmentService(valid).provider, "Técnico independiente");
  assert.throws(() => parseEquipmentService({ ...valid, service_date: "2999-01-01" }));
  assert.throws(() => parseEquipmentService({ ...valid, next_service_date: "2025-01-01" }));
  assert.throws(() => parseEquipmentService({ ...valid, type: "Certificado" }));
  assert.throws(() => parseEquipmentService({ ...valid, description: " " }));
  assert.equal("password" in parseEquipmentService({ ...valid, password: "not-a-real-password" }), false);
});
test("backdated entries do not override latest maintenance or latest suggested date", () => {
  const result = equipmentMaintenanceSummary([service("2026-07-12", null), service("2026-01-10", "2026-07-10"), service("2026-10-09", "2027-01-01")], "2026-10-08");
  assert.equal(result.lastService, "2026-07-12");
  assert.equal(result.nextService, "2026-07-10");
  assert.equal(result.status, "overdue");
});
test("calendar validation rejects overflow and uses Mexico City day at midnight UTC", () => {
  assert.equal(isEquipmentDate("2026-02-30"), false);
  assert.equal(isEquipmentDate("2028-02-29"), true);
  assert.equal(equipmentToday(new Date("2026-10-08T02:00:00Z")), "2026-10-07");
});
test("equipment input limits fields and excludes untrusted relationship fields", () => {
  const input = { type: "Aire acondicionado", name: " Recámara principal ", system_id: 99, owner_id: "other" };
  assert.equal(parseEquipmentInput(input).name, "Recámara principal");
  assert.equal("owner_id" in parseEquipmentInput(input), false);
  assert.equal("system_id" in parseEquipmentInput(input), false);
  assert.throws(() => parseEquipmentInput({ ...input, name: "  " }));
  assert.throws(() => parseEquipmentInput({ ...input, type: "Sistema fotovoltaico" }));
  assert.throws(() => parseEquipmentInput({ ...input, installed_on: "2026-02-30" }));
});
