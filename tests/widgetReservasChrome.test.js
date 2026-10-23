/**
 * En la landing reservas el pie no lleva el checkout genérico de Wompi.
 * Si «Reservar sin Pago» o «Sube tu comprobante» pisan la esquina de reposo
 * del lanzador, el widget sube esa esquina (móvil y escritorio) sin ocultarlo.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const source = fs.readFileSync(
  path.join(__dirname, "../public/amarte-widget.js"),
  "utf8"
);
const GENERIC_WOMPI = "https://checkout.wompi.co/l/VPOS_RXJqnz";

function boot(setup) {
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
  if (setup) setup(window);
  window.Function(source)();
  if (window.document.readyState === "loading") {
    window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  }
  return window;
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function setViewport(window, width, height) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    get: function () {
      return width;
    },
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    get: function () {
      return height;
    },
  });
}

function box(metrics) {
  return function () {
    return {
      left: metrics.left,
      top: metrics.top,
      right: metrics.right,
      bottom: metrics.bottom,
      width: metrics.width,
      height: metrics.height,
      x: metrics.left,
      y: metrics.top,
      toJSON: function () {
        return metrics;
      },
    };
  };
}

function quickLinks(document) {
  return Array.from(document.querySelectorAll(".amarte-widget-quick-row a"));
}

function wompiLink(document) {
  return quickLinks(document).find(function (link) {
    return /wompi/i.test(link.textContent || "");
  });
}

(async () => {
  const reservas = boot(function (win) {
    win.AMARTE_LANDING = "reservas";
    win.AMARTE_QUICK_WOMPI_URL = "https://checkout.example.invalid/por-reserva";
  });
  const reservasDoc = reservas.document;
  assert.strictEqual(wompiLink(reservasDoc), undefined, "reservas no muestra Wompi en el pie");
  assert.ok(
    !quickLinks(reservasDoc).some(function (link) {
      return String(link.href).indexOf("VPOS_RXJqnz") !== -1;
    })
  );
  assert.ok(
    !quickLinks(reservasDoc).some(function (link) {
      return String(link.href).indexOf("checkout.example.invalid") !== -1;
    }),
    "un override de página tampoco sustituye el link de cada reserva"
  );
  for (const label of ["WhatsApp", "PROMOCIONES", "Reservar"]) {
    assert.ok(
      quickLinks(reservasDoc).some(function (link) {
        return (link.textContent || "").indexOf(label) !== -1;
      }),
      "falta " + label
    );
  }

  const plain = boot();
  const plainWompi = wompiLink(plain.document);
  assert.ok(plainWompi, "sin landing el pie sigue llevando Wompi");
  assert.strictEqual(plainWompi.href, GENERIC_WOMPI);

  const suite = boot(function (win) {
    win.AMARTE_LANDING = "suite-jacuzzi";
  });
  assert.strictEqual(wompiLink(suite.document).href, GENERIC_WOMPI);

  const css = reservasDoc.querySelector("style[data-amarte-widget]").textContent;
  assert.ok(css.includes(".amarte-widget-root.amarte-clear-reserve .amarte-widget-launcher"));
  assert.ok(
    css.includes(
      "bottom:calc(24px + 64px + env(safe-area-inset-bottom,0px));z-index:99998;"
    )
  );
  assert.ok(
    css.includes(
      "@media (max-width:768px){.amarte-widget-launcher{right:16px;"
    )
  );
  assert.ok(
    css.includes(
      ".amarte-widget-root.amarte-clear-reserve .amarte-widget-launcher{right:16px;" +
        "bottom:calc(16px + 64px + env(safe-area-inset-bottom,0px));z-index:99998;}"
    )
  );
  assert.ok(
    css.includes(
      ".amarte-widget-root.amarte-clear-reserve .amarte-widget-panel{right:16px;" +
        "bottom:calc(80px + 64px + env(safe-area-inset-bottom,0px));z-index:99999;}"
    )
  );

  const window = boot();
  const { document } = window;
  const root = document.querySelector(".amarte-widget-root");
  const launcher = document.querySelector(".amarte-widget-launcher");
  setViewport(window, 390, 800);

  const away = document.createElement("button");
  away.type = "button";
  away.textContent = "Reservar sin Pago";
  away.getBoundingClientRect = box({
    left: 16,
    top: 200,
    right: 370,
    bottom: 252,
    width: 354,
    height: 52,
  });
  document.body.appendChild(away);
  await flush();
  assert.ok(!root.classList.contains("amarte-clear-reserve"), "fuera de la esquina no se mueve");
  assert.strictEqual(launcher.hidden, false);

  away.getBoundingClientRect = box({
    left: 250,
    top: 740,
    right: 390,
    bottom: 792,
    width: 140,
    height: 52,
  });
  away.dispatchEvent(new window.Event("scroll"));
  window.dispatchEvent(new window.Event("resize"));
  await flush();
  assert.ok(root.classList.contains("amarte-clear-reserve"), "en móvil la esquina sube");
  assert.strictEqual(launcher.hidden, false, "el lanzador se desplaza y sigue disponible");
  await flush();
  assert.ok(root.classList.contains("amarte-clear-reserve"), "no oscila al medir de nuevo");

  const other = document.createElement("button");
  other.type = "button";
  other.textContent = "Ya realicé mi abono/pago";
  other.getBoundingClientRect = box({
    left: 250,
    top: 740,
    right: 390,
    bottom: 792,
    width: 140,
    height: 52,
  });
  away.remove();
  document.body.appendChild(other);
  await flush();
  assert.ok(!root.classList.contains("amarte-clear-reserve"), "otro botón no cuenta");

  other.textContent = "Reservar sin Pago";
  other.style.display = "none";
  await flush();
  assert.ok(!root.classList.contains("amarte-clear-reserve"), "un botón oculto no cuenta");

  const desktop = boot();
  setViewport(desktop, 1280, 800);
  const corner = desktop.document.createElement("button");
  corner.type = "button";
  const label = desktop.document.createElement("span");
  label.textContent = "Reservar sin Pago";
  const busy = desktop.document.createElement("span");
  busy.textContent = "Procesando…";
  corner.appendChild(label);
  corner.appendChild(busy);
  corner.getBoundingClientRect = box({
    left: 900,
    top: 740,
    right: 1200,
    bottom: 792,
    width: 300,
    height: 52,
  });
  desktop.document.body.appendChild(corner);
  await flush();
  assert.ok(
    desktop.document.querySelector(".amarte-widget-root").classList.contains("amarte-clear-reserve"),
    "a 1280×800 la esquina del botón también sube"
  );

  const phone = boot();
  setViewport(phone, 375, 667);
  const receipt = phone.document.createElement("button");
  receipt.type = "submit";
  receipt.textContent = "Sube tu comprobante";
  receipt.getBoundingClientRect = box({
    left: 16,
    top: 615,
    right: 375,
    bottom: 667,
    width: 359,
    height: 52,
  });
  phone.document.body.appendChild(receipt);
  await flush();
  const phoneRoot = phone.document.querySelector(".amarte-widget-root");
  const phoneLauncher = phone.document.querySelector(".amarte-widget-launcher");
  assert.ok(
    phoneRoot.classList.contains("amarte-clear-reserve"),
    "a 375×667 el comprobante sube el lanzador"
  );
  assert.strictEqual(phoneLauncher.hidden, false);
  await flush();
  assert.ok(phoneRoot.classList.contains("amarte-clear-reserve"), "no oscila en 375×667");

  receipt.textContent = "Elegir comprobante";
  await flush();
  assert.ok(
    !phoneRoot.classList.contains("amarte-clear-reserve"),
    "otro rótulo de archivo no cuenta"
  );

  console.log("widgetReservasChrome.test.js ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
