const assert = require("assert");
const {
  CHAT_ACTIONS,
  DEFAULT_ACTION_TYPES,
  resolveChatActions,
  stripOptionsBlock,
  tryParseStructuredMartinaReply,
  buildAssistantResponse,
} = require("../config/chatActions");

assert.deepStrictEqual(DEFAULT_ACTION_TYPES, []);
assert.deepStrictEqual(resolveChatActions(["wompi", "whatsapp"]), []);
assert.deepStrictEqual(resolveChatActions([]), []);
assert.deepStrictEqual(
  resolveChatActions(["wompi", "fake", "wompi", "reserve"]),
  []
);
assert.deepStrictEqual(resolveChatActions(["reserve", "whatsapp"]), []);

assert.strictEqual(
  stripOptionsBlock("Hola\n[OPTIONS]\n[]\n[/OPTIONS]"),
  "Hola"
);

const structured = tryParseStructuredMartinaReply(
  JSON.stringify({
    message: "La Suite VIP Jacuzzi está disponible.",
    actionTypes: ["reserve", "wompi"],
    pendingReservation: null,
    showReservationForm: false,
    showDateTimePicker: true,
    formPrefill: null,
    suiteShowcase: "suite_vip_jacuzzi",
  })
);
assert.ok(structured);
assert.strictEqual(structured.message, "La Suite VIP Jacuzzi está disponible.");
assert.strictEqual(structured.pendingReservation, null);
assert.strictEqual(structured.showReservationForm, false);
assert.strictEqual(structured.showDateTimePicker, true);
assert.strictEqual(structured.suiteShowcase, "suite_vip_jacuzzi");

const built = buildAssistantResponse(
  JSON.stringify({
    message: "Cotización lista.",
    actionTypes: ["reserve"],
    pendingReservation: null,
    showReservationForm: false,
    showDateTimePicker: false,
    formPrefill: null,
    suiteShowcase: "",
  })
);
assert.strictEqual(built.reply, "Cotización lista.");
assert.strictEqual(built.options.length, 0);
assert.strictEqual(built.showReservationForm, false);
assert.strictEqual(built.showDateTimePicker, false);
assert.strictEqual(built.suiteShowcase, "");

const withPicker = buildAssistantResponse(
  JSON.stringify({
    message: "¿Para qué día y a qué hora?",
    actionTypes: ["promotions"],
    pendingReservation: null,
    showReservationForm: false,
    showDateTimePicker: true,
    formPrefill: null,
    suiteShowcase: "",
  })
);
assert.strictEqual(withPicker.showDateTimePicker, true);
assert.strictEqual(withPicker.options.length, 0);

const withForm = buildAssistantResponse(
  JSON.stringify({
    message: "Completa el formulario.",
    actionTypes: ["reserve", "whatsapp"],
    pendingReservation: {
      nombre: "X",
      whatsapp: "300",
      correo: "",
      documento: "",
      tipo: "Suite Amarte",
      fecha_reserva: "2026-08-01",
      hora_reserva: "14:00",
      pack_tiempo: "Pack 4 horas",
      precio: "90000",
      abono: "",
    },
    showReservationForm: true,
    showDateTimePicker: true,
    formPrefill: {
      nombre: "",
      whatsapp: "",
      correo: "",
      documento: "",
      tipo: "Suite Amarte",
      fecha_reserva: "2026-08-01",
      hora_reserva: "14:00",
      pack_tiempo: "Pack 4 horas",
      precio: "90000",
    },
    suiteShowcase: "Suite Amarte",
  })
);
assert.strictEqual(withForm.showReservationForm, true);
assert.strictEqual(withForm.showDateTimePicker, false);
assert.strictEqual(withForm.pendingReservation, null);
assert.ok(withForm.formPrefill);
assert.strictEqual(withForm.formPrefill.tipo, "Suite Amarte");
assert.strictEqual(withForm.suiteShowcase, "Suite Amarte");
assert.strictEqual(withForm.options.length, 0);

const legacy = buildAssistantResponse(
  `Texto visible\n[OPTIONS]\n[{"label":"X","url":"https://evil.example/pay"}]\n[/OPTIONS]`
);
assert.strictEqual(legacy.reply, "Texto visible");
assert.strictEqual(legacy.options.length, 0);
assert.ok(CHAT_ACTIONS.wompi.url.includes("wompi"));

console.log("chatActions tests passed");
