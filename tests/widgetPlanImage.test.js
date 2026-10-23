/**
 * El widget pinta planImage del servidor y lo abre en grande.
 * La ruta relativa se cuelga de AMARTE_CHATBOT_URL, no del origen de la página.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const source = fs.readFileSync(
  path.join(__dirname, "../public/amarte-widget.js"),
  "utf8"
);

function boot(fetchImpl) {
  const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
    url: "http://127.0.0.1:3000/embed-demo.html",
    pretendToBeVisual: true,
    runScripts: "dangerously",
  });
  const { window } = dom;
  window.AMARTE_CHATBOT_URL = "https://chat.example";
  window.fetch = fetchImpl;
  window.Function(source)();
  if (window.document.readyState === "loading") {
    window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  }
  assert.ok(window.document.querySelector(".amarte-widget-root"));
  return window;
}

function jsonResponse(body, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: function () {
      return Promise.resolve(body);
    },
  });
}

(async () => {
  const image = {
    plan: "Plan Romántico",
    src: "/plans/plan-romantico.webp",
    alt: "Plan Romántico",
  };
  const window = boot(function (url) {
    const target = String(url);
    if (target.includes("/chat/history")) {
      return jsonResponse({ messages: [] });
    }
    if (target.endsWith("/chat")) {
      return jsonResponse({
        reply: "Te presento el Plan Romántico",
        options: [],
        planImage: image,
      });
    }
    return jsonResponse({});
  });

  const input = window.document.querySelector(".amarte-widget-input");
  const button = window.document.querySelector(".amarte-widget-send");
  input.value = "el plan romántico";
  button.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 40));

  const thumb = window.document.querySelector(".amarte-plan-image-cta img");
  assert.ok(thumb, "no hay miniatura");
  assert.strictEqual(thumb.getAttribute("src"), "https://chat.example/plans/plan-romantico.webp");
  assert.strictEqual(thumb.alt, "Plan Romántico");
  thumb.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const modal = window.document.querySelector(".amarte-plan-image-modal.amarte-open");
  assert.ok(modal, "el toque no abrió la imagen");
  const full = modal.querySelector(".amarte-plan-image-full");
  assert.strictEqual(full.getAttribute("src"), "https://chat.example/plans/plan-romantico.webp");

  const silent = boot(function (url) {
    const target = String(url);
    if (target.includes("/chat/history")) {
      return jsonResponse({
        messages: [
          {
            role: "assistant",
            content: "Te presento el Plan Romántico y también https://evil.example/p.webp",
            planImage: null,
          },
        ],
      });
    }
    return jsonResponse({});
  });
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.strictEqual(silent.document.querySelector(".amarte-plan-image-cta"), null);
  assert.ok(silent.document.body.textContent.includes("Plan Romántico"));

  console.log("widgetPlanImage.test.js ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
