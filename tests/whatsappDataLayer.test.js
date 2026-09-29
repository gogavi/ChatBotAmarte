/**
 * Clic en enlaces wa.me del widget Martina → dataLayer (GTM) sin perder
 * el hook __amarteAnalyticsTrack.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");

const WIDGET_PATH = path.join(__dirname, "..", "public", "amarte-widget.js");
const WIDGET_SRC = fs.readFileSync(WIDGET_PATH, "utf8");

/**
 * @param {{ analytics?: Function|null }} [opts]
 */
function bootWidget(opts) {
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
    url: "https://www.amartesuite.com/",
    runScripts: "outside-only",
    virtualConsole,
  });
  const { window } = dom;
  window.fetch = function fetchStub() {
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({ messages: [] });
      },
    });
  };
  window.dataLayer = [];
  const analyticsCalls = [];
  if (!opts || opts.analytics !== null) {
    const sink =
      opts && typeof opts.analytics === "function"
        ? opts.analytics
        : function (payload) {
            analyticsCalls.push(payload);
          };
    window.__amarteAnalyticsTrack = function (payload) {
      sink(payload);
    };
  }
  window.eval(WIDGET_SRC);
  if (window.document.readyState === "loading") {
    window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  }
  return { window, dom, analyticsCalls };
}

/**
 * @param {Window} window
 * @param {string} needle
 */
function findOptLink(window, needle) {
  const links = window.document.querySelectorAll("a.amarte-opt-link");
  for (let i = 0; i < links.length; i++) {
    const href = links[i].getAttribute("href") || "";
    if (href.indexOf(needle) !== -1) return links[i];
  }
  return null;
}

/**
 * @param {Window} window
 * @param {Element} el
 */
function click(window, el) {
  const ev = new window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(ev);
  return ev;
}

/** Copia el dataLayer al realm de Node (jsdom usa otro Object). */
function plainDataLayer(window) {
  return JSON.parse(JSON.stringify(window.dataLayer));
}

test("el bundle servido contiene el push whatsapp_redirect", () => {
  assert.match(
    WIDGET_SRC,
    /dataLayer\.push\(\{\s*event:\s*"whatsapp_redirect",\s*location:\s*"martina_widget",?\s*\}\)/
  );
});

test("clic en a.amarte-opt-link wa.me empuja whatsapp_redirect y conserva el hook", () => {
  const { window, analyticsCalls } = bootWidget();
  const wa = findOptLink(window, "wa.me");
  assert.ok(wa, "el widget debe renderizar a.amarte-opt-link con href wa.me");

  const ev = click(window, wa);

  assert.equal(ev.defaultPrevented, false);
  assert.deepEqual(plainDataLayer(window), [
    { event: "whatsapp_redirect", location: "martina_widget" },
  ]);
  assert.equal(analyticsCalls.length, 1);
  assert.equal(analyticsCalls[0].event, "live_voice_whatsapp_clicked");
  assert.deepEqual(JSON.parse(JSON.stringify(analyticsCalls[0].props)), {});
});

test("un clic empuja el evento una sola vez; otro clic vuelve a empujar", () => {
  const { window } = bootWidget({ analytics: null });
  const wa = findOptLink(window, "wa.me");
  assert.ok(wa);

  click(window, wa);
  assert.equal(window.dataLayer.length, 1);

  click(window, wa);
  assert.deepEqual(plainDataLayer(window), [
    { event: "whatsapp_redirect", location: "martina_widget" },
    { event: "whatsapp_redirect", location: "martina_widget" },
  ]);
});

test("clic en un hijo del enlace wa.me también empuja antes de navegar", () => {
  const { window, analyticsCalls } = bootWidget();
  const wa = findOptLink(window, "wa.me");
  assert.ok(wa);
  const child = window.document.createElement("span");
  child.textContent = "WhatsApp";
  wa.textContent = "";
  wa.appendChild(child);

  const ev = click(window, child);

  assert.equal(ev.defaultPrevented, false);
  assert.deepEqual(plainDataLayer(window), [
    { event: "whatsapp_redirect", location: "martina_widget" },
  ]);
  assert.equal(analyticsCalls.length, 1);
  assert.equal(analyticsCalls[0].event, "live_voice_whatsapp_clicked");
});

test("un enlace que no es wa.me no empuja whatsapp_redirect", () => {
  const { window, analyticsCalls } = bootWidget();
  const reserve = findOptLink(window, "reservas.amartesuite.com");
  assert.ok(reserve);

  click(window, reserve);

  assert.deepEqual(plainDataLayer(window), []);
  assert.equal(analyticsCalls.length, 1);
  assert.equal(analyticsCalls[0].event, "live_voice_reservation_clicked");
});

test("si __amarteAnalyticsTrack lanza, el dataLayer igual recibe el evento", () => {
  const { window } = bootWidget({
    analytics: function () {
      throw new Error("sink caído");
    },
  });
  const wa = findOptLink(window, "wa.me");
  assert.ok(wa);

  const ev = click(window, wa);

  assert.equal(ev.defaultPrevented, false);
  assert.deepEqual(plainDataLayer(window), [
    { event: "whatsapp_redirect", location: "martina_widget" },
  ]);
});

test("sin __amarteAnalyticsTrack el clic wa.me igual empuja al dataLayer", () => {
  const { window } = bootWidget({ analytics: null });
  delete window.__amarteAnalyticsTrack;
  const wa = findOptLink(window, "wa.me");
  assert.ok(wa);

  click(window, wa);

  assert.deepEqual(plainDataLayer(window), [
    { event: "whatsapp_redirect", location: "martina_widget" },
  ]);
});
