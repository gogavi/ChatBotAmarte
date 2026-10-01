/**
 * Medición del widget: generate_lead (tel / WhatsApp) y martina_open (lanzador).
 * Carga public/amarte-widget.js en jsdom. No llama a la red.
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
  const dom = new JSDOM(
    "<!DOCTYPE html><html><head></head><body></body></html>",
    {
      url: "http://127.0.0.1:3000/medicion-widget.html",
      pretendToBeVisual: true,
      runScripts: "dangerously",
    }
  );
  const { window } = dom;
  window.fetch = function () {
    return Promise.resolve({
      ok: true,
      json: function () {
        return Promise.resolve({});
      },
    });
  };
  window.dataLayer = [];
  window.document.addEventListener(
    "click",
    function (ev) {
      const link = ev.target && ev.target.closest && ev.target.closest("a");
      if (link) ev.preventDefault();
    },
    true
  );
  if (setup) setup(window);
  // Function del realm del window: el IIFE ve window/document, no el global de Node.
  window.Function(source)();
  if (window.document.readyState === "loading") {
    window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
  }
  const root = window.document.querySelector(".amarte-widget-root");
  assert.ok(root, "el widget no montó");
  return window;
}

function click(window, el) {
  const ev = new window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(ev);
  return ev;
}

function siteEvents(window) {
  return JSON.parse(
    JSON.stringify(
      window.dataLayer.filter(function (item) {
        return (
          item &&
          (item.event === "generate_lead" || item.event === "martina_open")
        );
      })
    )
  );
}

function cssText(window) {
  const style = window.document.querySelector("style[data-amarte-widget]");
  assert.ok(style);
  return style.textContent;
}

// --- sin puente: dataLayer es el respaldo ---
{
  const window = boot();
  const doc = window.document;
  assert.ok(
    !doc.querySelector(".amarte-widget-root").classList.contains(
      "amarte-show-desktop-call"
    )
  );
  assert.ok(
    cssText(window).indexOf(
      ".amarte-widget-root:not(.amarte-show-desktop-call) .amarte-quick-call{display:none !important;}"
    ) !== -1
  );
  assert.strictEqual(
    cssText(window).indexOf(
      "@media (min-width:769px){.amarte-quick-call{display:none !important;}}"
    ),
    -1
  );

  const call = doc.querySelector("a.amarte-quick-call");
  assert.ok(call);
  const span = doc.createElement("span");
  span.textContent = "Llamar";
  call.textContent = "";
  call.appendChild(span);
  click(window, span);
  assert.deepStrictEqual(siteEvents(window), [
    {
      event: "generate_lead",
      method: "phone",
      location: "martina_widget",
      phone_number: "573013307909",
    },
  ]);

  const wa = Array.from(doc.querySelectorAll("a.amarte-opt-link")).find(
    function (a) {
      return (a.getAttribute("href") || "").indexOf("wa.me") !== -1;
    }
  );
  assert.ok(wa);
  click(window, wa);
  const waHref = wa.getAttribute("href");
  assert.deepStrictEqual(siteEvents(window)[1], {
    event: "generate_lead",
    method: "whatsapp",
    location: "martina_widget",
    link_url: waHref,
  });

  const promo = Array.from(doc.querySelectorAll("a.amarte-opt-link")).find(
    function (a) {
      return (a.getAttribute("href") || "").indexOf("promojacuzzi") !== -1;
    }
  );
  click(window, promo);
  assert.strictEqual(siteEvents(window).length, 2);

  const inline = doc.createElement("a");
  inline.className = "amarte-inline-link";
  inline.href = "https://api.whatsapp.com/send?phone=573007416683";
  doc.querySelector(".amarte-widget-messages").appendChild(inline);
  click(window, inline);
  assert.strictEqual(siteEvents(window)[2].method, "whatsapp");
  assert.ok(siteEvents(window)[2].link_url.indexOf("api.whatsapp.com") !== -1);

  const launcher = doc.querySelector(".amarte-widget-launcher");
  click(window, launcher);
  assert.deepStrictEqual(siteEvents(window)[3], {
    event: "martina_open",
    location: "launcher",
    interaction_type: "text",
  });
  assert.ok(doc.querySelector(".amarte-widget-panel").classList.contains("amarte-open"));

  const beforeClose = siteEvents(window).length;
  click(window, launcher);
  assert.strictEqual(siteEvents(window).length, beforeClose);
  assert.ok(
    !doc.querySelector(".amarte-widget-panel").classList.contains("amarte-open")
  );

  click(window, launcher);
  assert.strictEqual(
    siteEvents(window).filter(function (e) {
      return e.event === "martina_open";
    }).length,
    2
  );
}

// openChat / openLive no duplican el martina_open de los CTA de la homepage
{
  const window = boot();
  window.AmarteChatbot.openChat("hola");
  window.AmarteChatbot.openLive();
  assert.deepStrictEqual(siteEvents(window), []);
  assert.ok(
    window.document
      .querySelector(".amarte-widget-panel")
      .classList.contains("amarte-open")
  );
}

// puente presente: no hay segundo push a dataLayer
{
  const seen = [];
  const window = boot(function (w) {
    w.__amarteAnalyticsTrack = function (payload) {
      seen.push(payload);
    };
  });
  click(window, window.document.querySelector("a.amarte-quick-call"));
  click(window, window.document.querySelector(".amarte-widget-launcher"));
  assert.strictEqual(window.dataLayer.length, 0);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(seen)), [
    {
      event: "generate_lead",
      method: "phone",
      location: "martina_widget",
      phone_number: "573013307909",
    },
    {
      event: "martina_open",
      location: "launcher",
      interaction_type: "text",
    },
  ]);
}

// mismo clic ya medido por la homepage (capture): el widget no repite
{
  const seen = [];
  const window = boot(function (w) {
    w.__amarteAnalyticsTrack = function (payload) {
      seen.push(payload);
    };
    w.document.addEventListener(
      "click",
      function (ev) {
        const link = ev.target && ev.target.closest && ev.target.closest("a");
        if (!link) return;
        const href = link.getAttribute("href") || "";
        if (/^tel:/i.test(href) || href.indexOf("wa.me") !== -1) {
          ev.__amarteMeasuredEvent = "generate_lead";
        }
      },
      true
    );
  });
  click(window, window.document.querySelector("a.amarte-quick-call"));
  const wa = Array.from(
    window.document.querySelectorAll("a.amarte-opt-link")
  ).find(function (a) {
    return (a.getAttribute("href") || "").indexOf("wa.me") !== -1;
  });
  click(window, wa);
  assert.strictEqual(seen.length, 0);
  assert.strictEqual(window.dataLayer.length, 0);
  click(window, window.document.querySelector(".amarte-widget-launcher"));
  assert.strictEqual(seen.length, 1);
  assert.strictEqual(String(seen[0].event), "martina_open");
}

// flag de escritorio apagado por defecto; "true" lo enciende
{
  const off = boot(function (w) {
    w.AMARTE_SHOW_DESKTOP_CALL = "false";
  });
  assert.ok(
    !off.document
      .querySelector(".amarte-widget-root")
      .classList.contains("amarte-show-desktop-call")
  );
  const on = boot(function (w) {
    w.AMARTE_SHOW_DESKTOP_CALL = "true";
  });
  assert.ok(
    on.document
      .querySelector(".amarte-widget-root")
      .classList.contains("amarte-show-desktop-call")
  );
}

console.log("widgetMeasurement.test.js ok");
