import assert from "node:assert/strict";
import test from "node:test";
import { matchesDocumentSearch, isAdministrativeDocument, documentTypes } from "../lib/admin-document.ts";

test("finds client names without accents, regardless of case or word order", () => {
  assert.equal(matchesDocumentSearch("  PEREZ jose ", "José Pérez", "FV-0001"), true);
  assert.equal(matchesDocumentSearch("José López", "José Pérez", "FV-0001"), false);
  assert.equal(matchesDocumentSearch("fv-0002", "José Pérez", "FV-0001"), false);
  assert.equal(matchesDocumentSearch("", null, undefined), true);
});

test("searches across client, system, document type and filename", () => {
  assert.equal(matchesDocumentSearch("perez interconexion", "José Pérez", "Convenio de interconexión", "firma.pdf"), true);
});

test("administrative documents are separated from existing client document categories", () => {
  for (const category of documentTypes.slice(0, 3)) assert.equal(isAdministrativeDocument(category), false);
  for (const category of documentTypes.slice(3)) assert.equal(isAdministrativeDocument(category), true);
  assert.equal(isAdministrativeDocument("unrecognized"), false);
});
