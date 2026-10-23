/**
 * El lanzador se oculta si la página tiene un diálogo visible, y no si el
 * diálogo es del propio widget o está cerrado.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const source = fs.readFileSync(
  path.join(__dirname, "../public/amarte-widget.js"),
  "utf8"
);

function boot() {
  const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
    url: "http://127.0.0.1:3000/embed-demo.html",
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
  window.Function(source)();
  if (window.document.readyState === "loading") {
    window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  }
  return window;
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

(async () => {
  const window = boot();
  const { document } = window;
  const root = document.querySelector(".amarte-widget-root");
  const launcher = document.querySelector(".amarte-widget-launcher");
  const css = document.querySelector("style[data-amarte-widget]").textContent;
  assert.ok(root);
  assert.ok(launcher);
  assert.strictEqual(launcher.hidden, false);
  assert.ok(!root.classList.contains("amarte-page-dialog"));
  assert.ok(
    css.includes(
      ".amarte-widget-root.amarte-page-dialog .amarte-widget-launcher"
    )
  );

  const own = document.createElement("div");
  own.setAttribute("role", "dialog");
  own.setAttribute("aria-modal", "true");
  own.setAttribute("data-amarte-widget-dialog", "true");
  document.body.appendChild(own);
  await flush();
  assert.strictEqual(launcher.hidden, false, "el diálogo del widget no oculta el botón");

  const closed = document.createElement("div");
  closed.setAttribute("role", "dialog");
  closed.setAttribute("aria-modal", "true");
  closed.setAttribute("aria-hidden", "true");
  document.body.appendChild(closed);
  await flush();
  assert.strictEqual(launcher.hidden, false, "un diálogo cerrado no oculta el botón");

  const hiddenWrap = document.createElement("div");
  hiddenWrap.style.display = "none";
  const nested = document.createElement("div");
  nested.setAttribute("role", "dialog");
  nested.setAttribute("aria-modal", "true");
  hiddenWrap.appendChild(nested);
  document.body.appendChild(hiddenWrap);
  await flush();
  assert.strictEqual(launcher.hidden, false, "un diálogo con display:none no oculta el botón");

  const modal = document.createElement("div");
  modal.setAttribute("aria-modal", "true");
  document.body.appendChild(modal);
  await flush();
  assert.strictEqual(launcher.hidden, true, "aria-modal visible oculta el botón");
  assert.ok(root.classList.contains("amarte-page-dialog"));

  modal.remove();
  await flush();
  assert.strictEqual(launcher.hidden, false, "al cerrar el modal el botón vuelve");
  assert.ok(!root.classList.contains("amarte-page-dialog"));

  const sheet = document.createElement("div");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  document.body.appendChild(sheet);
  await flush();
  assert.strictEqual(launcher.hidden, true, "role=dialog visible oculta el botón");

  sheet.setAttribute("data-state", "closed");
  await flush();
  assert.strictEqual(launcher.hidden, false, "data-state=closed devuelve el botón");

  const panel = document.querySelector(".amarte-widget-panel");
  launcher.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  assert.ok(panel.classList.contains("amarte-open"));
  sheet.removeAttribute("data-state");
  await flush();
  assert.strictEqual(panel.hidden, true, "el panel abierto se oculta con el modal");
  assert.strictEqual(launcher.hidden, true);
  sheet.remove();
  await flush();
  assert.strictEqual(panel.hidden, false, "al cerrar el modal el panel abierto vuelve");
  assert.ok(panel.classList.contains("amarte-open"));

  console.log("widgetPageDialog.test.js ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
