/**
 * La prerreserva del widget lleva canal widget-martina y, si hay, el id de
 * la landing. No copia forma_pago ni beneficio_ruleta del cliente.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  buildPendingReservationInsert,
  widgetReservationCanal,
} = require("../reservationService");
const { resolveChatLanding } = require("../config/landings");

const guest = {
  documento: "1234567890",
  nombre: "Ana Pérez",
  correo: "ana@example.com",
  whatsapp: "3001234567",
  tipo: "Suite Gold",
  fecha_reserva: "2026-10-21",
  hora_reserva: "14:00",
  pack_tiempo: "Pack 4 horas",
  precio: "240000",
  abono: "120000",
  canal: "Web Automático",
  forma_pago: "Pago total",
  beneficio_ruleta: "🍻 2 Cervezas",
};

assert.strictEqual(widgetReservationCanal(""), "widget-martina");
assert.strictEqual(widgetReservationCanal("no-existe"), "widget-martina");
assert.strictEqual(
  widgetReservationCanal("https://deluxe.amartesuite.com"),
  "widget-martina"
);
assert.strictEqual(
  widgetReservationCanal("suite-tematicas"),
  "widget-martina/tematicas"
);

const fromPage = resolveChatLanding("", "https://deluxe.amartesuite.com/promo");
assert.ok(fromPage);
assert.strictEqual(fromPage.id, "suite-sauna-jacuzzi");

const row = buildPendingReservationInsert(guest, {
  conversationId: "conv-1",
  landingId: fromPage.id,
});
assert.strictEqual(row.canal, "widget-martina/suite-sauna-jacuzzi");
assert.strictEqual(row.forma_pago, "Wompi");
assert.strictEqual(Object.prototype.hasOwnProperty.call(row, "beneficio_ruleta"), false);
assert.ok(row.mensaje.includes("conversation_id=conv-1"));

const bare = buildPendingReservationInsert(guest, { landingId: "Web Automático" });
assert.strictEqual(bare.canal, "widget-martina");

const explicit = resolveChatLanding(
  "suite-sauna-jacuzzi",
  "https://amartesuite.com/"
);
assert.strictEqual(
  widgetReservationCanal(explicit && explicit.id),
  "widget-martina/suite-sauna-jacuzzi"
);

const serverSource = fs.readFileSync(
  path.join(__dirname, "../server.js"),
  "utf8"
);
assert.ok(serverSource.includes('filePath.endsWith("amarte-widget.js")'));
assert.ok(
  serverSource.includes('res.setHeader("Cache-Control", "no-cache, must-revalidate")')
);
assert.ok(!/amarte-widget\.[a-f0-9]{8,}\.js/.test(serverSource));

console.log("pendingReservationCanal.test.js ok");
