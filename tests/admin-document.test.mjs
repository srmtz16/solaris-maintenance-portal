import assert from "node:assert/strict";
import test from "node:test";
import { buildDocumentPath, MAX_DOCUMENT_BYTES, sha256ForFile, validateAdminDocument } from "../lib/admin-document.ts";

test("accepts the supported document formats", () => {
  for (const type of ["application/pdf", "image/png", "image/jpeg"]) {
    assert.equal(validateAdminDocument({ type, size: 1024 }), null);
  }
});

test("rejects unsupported, empty, and oversized files", () => {
  assert.match(validateAdminDocument({ type: "text/plain", size: 10 }), /Solo puedes/);
  assert.match(validateAdminDocument({ type: "application/pdf", size: 0 }), /vacío/);
  assert.match(validateAdminDocument({ type: "application/pdf", size: MAX_DOCUMENT_BYTES + 1 }), /15 MB/);
});

test("builds an isolated storage path for the selected system", () => {
  assert.equal(
    buildDocumentPath("FV-0001", "Diagrama unifilar", "Plano FINAL.PDF", "fixed-id"),
    "FV-0001/diagrama-unifilar/fixed-id.pdf",
  );
});

test("creates a stable SHA-256 checksum for migration verification", async () => {
  assert.equal(
    await sha256ForFile(new Blob(["abc"])),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
