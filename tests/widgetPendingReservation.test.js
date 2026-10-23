/**
 * showReservationForm hace POST /reservations/pending con la landing.
 * El cuerpo no manda canal, forma_pago ni beneficio_ruleta: los decide el servidor.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const source = fs.readFileSync(
  path.join(__dirname, "../public/amarte-widget.js"),
  "utf8"
);

function boot(setup) {
  const dom = new JSDOM("<!DOCTYPE html><html><head><title>Suite</title></head><body></body></html>", {
    url: "https://deluxe.amartesuite.com/promo",
    pretendToBeVisual: true,
    runScripts: "dangerously",
  });
  const { window } = dom;
  if (setup) setup(window);
  window.Function(source)();
  if (window.document.readyState === "loading") {
    window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  }
  return window;
}

(async () => {
  const calls = [];
  const window = boot(function (win) {
    win.AMARTE_LANDING = "suite-sauna-jacuzzi";
    win.fetch = function (url, opts) {
      const target = String(url);
      calls.push({ url: target, opts: opts || {} });
      if (target.endsWith("/api/widget-config")) {
        return Promise.resolve({
          ok: true,
          json: function () {
            return Promise.resolve({
              reservationForm: {
                tipos: ["Suite Gold"],
                packs: ["Pack 4 horas"],
              },
              quoteCatalog: {
                byTipo: {
                  "Suite Gold": {
                    weekday: { "Pack 4 horas": 240000 },
                    weekend: { "Pack 4 horas": 300000 },
                    availablePacks: ["Pack 4 horas"],
                  },
                },
              },
            });
          },
        });
      }
      if (target.endsWith("/chat") || target.endsWith("/chat/history")) {
        return Promise.resolve({
          ok: true,
          json: function () {
            return Promise.resolve({
              reply: "Puedes dejar la prerreserva aquí.",
              options: [],
              showReservationForm: target.endsWith("/chat"),
              formPrefill: {
                tipo: "Suite Gold",
                pack_tiempo: "Pack 4 horas",
                fecha_reserva: "2026-10-21",
                hora_reserva: "14:00",
              },
            });
          },
        });
      }
      if (target.endsWith("/reservations/pending")) {
        return Promise.resolve({
          ok: true,
          json: function () {
            return Promise.resolve({ ok: true, reply: "Lista.", options: [] });
          },
        });
      }
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve({});
        },
      });
    };
  });

  const doc = window.document;
  const input = doc.querySelector(".amarte-widget-input");
  const send = doc.querySelector(".amarte-widget-send");
  input.value = "quiero reservar";
  send.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 40));

  const form = doc.querySelector(".amarte-rsv-form");
  assert.ok(form, "showReservationForm no armó el formulario");
  form.querySelector('[name="nombre"]').value = "Ana Pérez";
  form.querySelector('[name="documento"]').value = "1234567890";
  form.querySelector('[name="whatsapp"]').value = "3001234567";
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 40));

  const pending = calls.find((call) => call.url.endsWith("/reservations/pending"));
  assert.ok(pending, "no hubo POST /reservations/pending");
  const body = JSON.parse(pending.opts.body);
  assert.strictEqual(body.landing, "suite-sauna-jacuzzi");
  assert.strictEqual(body.pageUrl, "https://deluxe.amartesuite.com/promo");
  assert.strictEqual(Object.prototype.hasOwnProperty.call(body, "canal"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(body, "forma_pago"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(body, "beneficio_ruleta"), false);
  assert.strictEqual(body.tipo, "Suite Gold");
  assert.ok(body.precio);

  console.log("widgetPendingReservation.test.js ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
