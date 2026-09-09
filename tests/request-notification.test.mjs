import test from "node:test";
import assert from "node:assert/strict";
import { buildRequestNotification, sendRequestNotification } from "../lib/request-notification.ts";

const maintenance = {
  reference: "123e4567-e89b-42d3-a456-426614174000",
  requestType: "maintenance",
  systemCode: "FV-0001",
  clientName: "Karina de la Rosa",
  message: "Revisar <inversor> & conexiones",
  preferredDate: "2026-09-20",
  receivedAt: "2026-09-09T18:00:00.000Z",
};

test("builds a maintenance email with the system, client, date and escaped message", () => {
  const result = buildRequestNotification(maintenance);
  assert.equal(result.subject, "Nueva solicitud de mantenimiento · FV-0001");
  assert.match(result.text, /Karina de la Rosa/);
  assert.match(result.text, /20 de septiembre de 2026/);
  assert.doesNotMatch(result.html, /<inversor>/);
  assert.match(result.html, /&lt;inversor&gt; &amp; conexiones/);
});

test("builds a distinct failure notification without a requested date", () => {
  const result = buildRequestNotification({ ...maintenance, requestType: "failure", preferredDate: null });
  assert.equal(result.subject, "Nueva falla reportada · FV-0001");
  assert.doesNotMatch(result.text, /Fecha solicitada/);
});

test("does not call Resend when server configuration is missing", async () => {
  let called = false;
  const sent = await sendRequestNotification(maintenance, {}, async () => { called = true; return new Response(); });
  assert.equal(sent, false);
  assert.equal(called, false);
});

test("returns false without throwing when Resend fails", async () => {
  const sent = await sendRequestNotification(maintenance, { apiKey: "secret", recipient: "owner@example.com" }, async () => new Response("error", { status: 500 }));
  assert.equal(sent, false);
});

test("sends server credentials and the expected email payload to Resend", async () => {
  let request;
  const sent = await sendRequestNotification(maintenance, { apiKey: "secret", recipient: "owner@example.com" }, async (url, init) => {
    request = { url, init };
    return new Response("{}", { status: 200 });
  });
  assert.equal(sent, true);
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.init.headers.Authorization, "Bearer secret");
  const body = JSON.parse(request.init.body);
  assert.deepEqual(body.to, ["owner@example.com"]);
  assert.equal(body.from, "Solaris <onboarding@resend.dev>");
  assert.equal(body.subject, "Nueva solicitud de mantenimiento · FV-0001");
});
