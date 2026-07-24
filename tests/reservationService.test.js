const assert = require("assert");
const {
  resolveTipo,
  resolvePack,
  resolveFecha,
  resolvePrecio,
  validatePendingPayload,
  buildPrereservaConfirmMessage,
  firstNameUpper,
} = require("../reservationService");
const { payment } = require("../config/amarteCatalog");

assert.strictEqual(resolveTipo("Suite VIP Jacuzzi"), "Suite Jacuzzi");
assert.strictEqual(resolveTipo("suite diamante"), "Suite Diamante");
assert.strictEqual(resolveTipo("Plan Húmedo"), "Plan Húmedo");
assert.strictEqual(resolveTipo("No existe"), null);

assert.strictEqual(resolvePack("4 h"), "Pack 4 horas");
assert.strictEqual(resolvePack("Pack 8 horas"), "Pack 8 horas");
assert.strictEqual(resolvePack("día hotelero"), "Día Hotelero");
assert.strictEqual(resolvePack("xyz"), null);

assert.strictEqual(resolveFecha("2026-07-20"), "2026-07-20");
assert.strictEqual(resolveFecha("20/07/2026"), null);

assert.strictEqual(resolvePrecio("$160.000"), "160000");
assert.strictEqual(resolvePrecio(160000), "160000");

const ok = validatePendingPayload({
  nombre: "Ana Pérez",
  whatsapp: "3001234567",
  correo: "ana@example.com",
  documento: "1234567890",
  tipo: "Suite VIP Jacuzzi",
  fecha_reserva: "2026-07-20",
  hora_reserva: "2:00 PM",
  pack_tiempo: "Pack 4 horas",
  precio: "240000",
  abono: "",
});
assert.strictEqual(ok.ok, true);
if (ok.ok) {
  assert.strictEqual(ok.data.tipo, "Suite Jacuzzi");
  assert.strictEqual(ok.data.abono, "120000");
  assert.strictEqual(ok.data.documento, "1234567890");
}

const noDoc = validatePendingPayload({
  nombre: "Ana Pérez",
  whatsapp: "3001234567",
  correo: "",
  documento: "",
  tipo: "Suite Amarte",
  fecha_reserva: "2026-07-20",
  hora_reserva: "14:00",
  pack_tiempo: "Pack 4 horas",
  precio: "90000",
});
assert.strictEqual(noDoc.ok, false);

const bad = validatePendingPayload({
  nombre: "Ana",
  whatsapp: "1",
  documento: "123",
  tipo: "Suite Amarte",
  fecha_reserva: "2026-07-20",
  hora_reserva: "14:00",
  pack_tiempo: "Pack 4 horas",
  precio: "90000",
});
assert.strictEqual(bad.ok, false);

assert.strictEqual(firstNameUpper("John Doe"), "JOHN");
const confirm = buildPrereservaConfirmMessage({
  nombre: "John Doe",
  precio: "420000",
  abono: "210000",
});
assert.ok(confirm.includes("Hola JOHN,"));
assert.ok(confirm.includes("pre-reserva"));
assert.ok(confirm.includes("$210.000"));
assert.ok(confirm.includes("$315.000"));
assert.ok(confirm.includes(payment.checkoutUrl));
assert.ok(confirm.includes("Compártenos el comprobante"));

console.log("reservationService tests passed");
