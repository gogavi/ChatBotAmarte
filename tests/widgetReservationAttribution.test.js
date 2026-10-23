/**
 * El enlace Reservar reenvía la atribución de la página, o la guardada
 * en sessionStorage, sin duplicar parámetros.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const source = fs.readFileSync(
  path.join(__dirname, "../public/amarte-widget.js"),
  "utf8"
);

const KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
];

function boot(url, setup) {
  const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
    url,
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

function reserveHref(window) {
  const link = Array.from(window.document.querySelectorAll("a")).find(function (node) {
    return node.textContent.indexOf("Reservar") !== -1;
  });
  assert.ok(link, "falta el enlace Reservar");
  return link.href;
}

function paramsOf(href) {
  return new URL(href).searchParams;
}

const fromPage = boot(
  "https://promoamarte.amartesuite.com/promo?utm_source=google&utm_medium=cpc&utm_campaign=suite&utm_content=anuncio&utm_term=jacuzzi&gclid=g-1&gbraid=gb-1&wbraid=wb-1&fbclid=fb-1&foo=no"
);
const pageHref = reserveHref(fromPage);
const pageParams = paramsOf(pageHref);
for (const key of KEYS) {
  assert.strictEqual(pageParams.getAll(key).length, 1, key);
}
assert.strictEqual(pageParams.get("utm_source"), "google");
assert.strictEqual(pageParams.get("utm_medium"), "cpc");
assert.strictEqual(pageParams.get("utm_campaign"), "suite");
assert.strictEqual(pageParams.get("utm_content"), "anuncio");
assert.strictEqual(pageParams.get("utm_term"), "jacuzzi");
assert.strictEqual(pageParams.get("gclid"), "g-1");
assert.strictEqual(pageParams.get("gbraid"), "gb-1");
assert.strictEqual(pageParams.get("wbraid"), "wb-1");
assert.strictEqual(pageParams.get("fbclid"), "fb-1");
assert.strictEqual(pageParams.get("foo"), null);
assert.strictEqual(new URL(pageHref).hostname, "reservas.amartesuite.com");

const fromStorage = boot("https://amartesuite.com/", function (window) {
  window.sessionStorage.setItem(
    "amarte-reservation-attribution",
    JSON.stringify({
      utm_source: "meta",
      utm_campaign: "verano",
      gclid: "g-store",
      ignored: "no",
    })
  );
});
const storedParams = paramsOf(reserveHref(fromStorage));
assert.strictEqual(storedParams.get("utm_source"), "meta");
assert.strictEqual(storedParams.get("utm_campaign"), "verano");
assert.strictEqual(storedParams.get("gclid"), "g-store");
assert.strictEqual(storedParams.get("ignored"), null);
assert.strictEqual(storedParams.get("utm_medium"), null);

const pageWins = boot(
  "https://suitejacuzzi.amartesuite.com/?utm_source=pagina&utm_medium=",
  function (window) {
    window.sessionStorage.setItem(
      "amarte-reservation-attribution",
      "utm_source=guardado&utm_medium=email&fbclid=fb-store"
    );
  }
);
const mixed = paramsOf(reserveHref(pageWins));
assert.strictEqual(mixed.getAll("utm_source").length, 1);
assert.strictEqual(mixed.get("utm_source"), "pagina");
assert.strictEqual(mixed.get("utm_medium"), "email");
assert.strictEqual(mixed.get("fbclid"), "fb-store");

const bare = boot("https://amartesuite.com/producto/suite-amarte/");
const bareUrl = new URL(reserveHref(bare));
assert.strictEqual(bareUrl.hostname, "reservas.amartesuite.com");
assert.strictEqual(bareUrl.pathname, "/");
assert.strictEqual(bareUrl.search, "");

const preset = boot(
  "https://amartesuite.com/?utm_source=pagina&gclid=g-page",
  function (window) {
    window.AMARTE_QUICK_RESERVATIONS_URL =
      "https://reservas.amartesuite.com/form?utm_source=boton";
  }
);
const presetParams = paramsOf(reserveHref(preset));
assert.strictEqual(presetParams.getAll("utm_source").length, 1);
assert.strictEqual(presetParams.get("utm_source"), "boton");
assert.strictEqual(presetParams.get("gclid"), "g-page");
assert.strictEqual(new URL(reserveHref(preset)).pathname, "/form");

console.log("widgetReservationAttribution.test.js ok");
