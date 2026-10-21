/**
 * El widget reenvía window.AMARTE_LANDING y muestra el 429 del servidor.
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
  const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
    url: "http://127.0.0.1:3000/embed-demo.html?landing=suite-jacuzzi",
    pretendToBeVisual: true,
    runScripts: "dangerously",
  });
  const { window } = dom;
  window.fetch = function () {
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({ reply: "ok", options: [] });
      },
    });
  };
  if (setup) setup(window);
  window.Function(source)();
  if (window.document.readyState === "loading") {
    window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  }
  assert.ok(window.document.querySelector(".amarte-widget-root"));
  return window;
}

function sendText(window, text) {
  const input = window.document.querySelector(".amarte-widget-input");
  const button = window.document.querySelector(".amarte-widget-send");
  assert.ok(input);
  assert.ok(button);
  input.value = text;
  button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
}

(async () => {
  const captured = [];
  const window = boot(function (win) {
    win.AMARTE_LANDING = "suite-jacuzzi";
    win.fetch = function (url, opts) {
      captured.push({ url: String(url), opts });
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve({ reply: "hola", options: [] });
        },
      });
    };
  });
  sendText(window, "qué incluye");
  await new Promise((resolve) => setTimeout(resolve, 30));
  const chat = captured.find((call) => String(call.url).endsWith("/chat"));
  assert.ok(chat, "no hubo POST /chat");
  const body = JSON.parse(chat.opts.body);
  assert.strictEqual(body.landing, "suite-jacuzzi");

  const omitted = [];
  const plain = boot(function (win) {
    win.fetch = function (url, opts) {
      omitted.push({ url: String(url), opts });
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve({ reply: "hola", options: [] });
        },
      });
    };
  });
  sendText(plain, "hola");
  await new Promise((resolve) => setTimeout(resolve, 30));
  const plainChat = omitted.find((call) => String(call.url).endsWith("/chat"));
  const plainBody = JSON.parse(plainChat.opts.body);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(plainBody, "landing"), false);

  const limited = boot(function (win) {
    win.fetch = function (url) {
      if (String(url).endsWith("/chat")) {
        return Promise.resolve({
          ok: false,
          status: 429,
          json: function () {
            return Promise.resolve({
              error: "Vas muy rápido. Espera un momento y vuelve a escribirle a Martina.",
            });
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
  sendText(limited, "otra vez");
  await new Promise((resolve) => setTimeout(resolve, 30));
  const bubbles = Array.from(
    limited.document.querySelectorAll(".amarte-msg-bot, .amarte-bot-msg, .amarte-widget-msg")
  ).map((node) => node.textContent);
  const allText = limited.document.body.textContent;
  assert.ok(
    allText.includes("Vas muy rápido"),
    `el 429 no se mostró: ${allText.slice(0, 400)}`
  );
  assert.ok(!bubbles.join("\n").includes("problema al conectar") || allText.includes("Vas muy rápido"));

  const demo = fs.readFileSync(
    path.join(__dirname, "../public/embed-demo.html"),
    "utf8"
  );
  assert.ok(demo.includes("AMARTE_LANDING"));
  assert.ok(demo.includes("landing"));

  console.log("widgetLanding.test.js ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
