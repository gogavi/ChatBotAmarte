/**
 * Tests del formulario de prerreserva: schema, prefill, validación y widget-config.
 */
const assert = require("assert");
const http = require("http");
const express = require("express");

const {
  MARTINA_REPLY_JSON_SCHEMA,
  buildAssistantResponse,
  normalizeFormPrefill,
} = require("../config/chatActions");
const {
  validatePendingPayload,
  VALID_TIPOS,
  VALID_PACKS,
} = require("../reservationService");
const widgetConfigRouter = require("../routes/widgetConfig");

assert.ok(MARTINA_REPLY_JSON_SCHEMA.schema.properties.showReservationForm);
assert.ok(MARTINA_REPLY_JSON_SCHEMA.schema.properties.formPrefill);
assert.ok(MARTINA_REPLY_JSON_SCHEMA.schema.properties.suiteShowcase);
assert.ok(
  MARTINA_REPLY_JSON_SCHEMA.schema.required.includes("showReservationForm")
);
assert.ok(
  MARTINA_REPLY_JSON_SCHEMA.schema.required.includes("suiteShowcase")
);

const prefill = normalizeFormPrefill({
  tipo: " Suite Amarte ",
  fecha_reserva: "2026-08-10",
  hora_reserva: "2:00 PM",
  pack_tiempo: "Pack 4 horas",
  precio: "90000",
  nombre: "",
  whatsapp: "",
});
assert.strictEqual(prefill.tipo, "Suite Amarte");
assert.strictEqual(prefill.precio, "90000");
assert.strictEqual(prefill.nombre, "");

const built = buildAssistantResponse(
  JSON.stringify({
    message: "Te muestro el formulario.",
    actionTypes: ["reserve"],
    pendingReservation: null,
    showReservationForm: true,
    formPrefill: prefill,
    suiteShowcase: "",
  })
);
assert.strictEqual(built.showReservationForm, true);
assert.strictEqual(built.formPrefill.tipo, "Suite Amarte");

const invalid = validatePendingPayload({
  nombre: "",
  whatsapp: "12",
  tipo: "Suite Amarte",
  pack_tiempo: "Pack 4 horas",
  fecha_reserva: "2026-08-10",
  hora_reserva: "14:00",
  precio: "90000",
});
assert.strictEqual(invalid.ok, false);

const valid = validatePendingPayload({
  nombre: "Ana Pérez",
  whatsapp: "3001234567",
  correo: "",
  documento: "1020304050",
  tipo: "Suite Amarte",
  pack_tiempo: "Pack 4 horas",
  fecha_reserva: "2026-08-10",
  hora_reserva: "14:00",
  precio: "90000",
  abono: "",
});
assert.strictEqual(valid.ok, true);
assert.strictEqual(valid.data.nombre, "Ana Pérez");
assert.ok(valid.data.abono);

const app = express();
app.use("/api", widgetConfigRouter);
const server = http.createServer(app);

server.listen(0, () => {
  const port = server.address().port;
  http
    .get(`http://127.0.0.1:${port}/api/widget-config`, (res) => {
      let raw = "";
      res.on("data", (c) => {
        raw += c;
      });
      res.on("end", () => {
        const cfg = JSON.parse(raw);
        assert.ok(cfg.reservationForm);
        assert.deepStrictEqual(cfg.reservationForm.tipos, [...VALID_TIPOS]);
        assert.deepStrictEqual(cfg.reservationForm.packs, [...VALID_PACKS]);
        assert.ok(Array.isArray(cfg.suiteVideos));
        assert.ok(cfg.suiteVideos.length >= 10);
        assert.ok(cfg.suiteVideos[0].videoUrl);
        server.close();
        console.log("reservationForm.test.js: ok");
      });
    })
    .on("error", (err) => {
      server.close();
      console.error(err);
      process.exit(1);
    });
});
