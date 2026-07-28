(function () {
  // Evita ejecutar el widget más de una vez si el script se carga dos veces
  if (window.__amarteWidgetLoaded) {
    return;
  }
  // Marca global para impedir doble inicialización
  window.__amarteWidgetLoaded = true;

  // URL base del backend: prioridad a la variable global definida en la página
  var BACKEND_URL =
    typeof window.AMARTE_CHATBOT_URL === "string" && window.AMARTE_CHATBOT_URL
      ? window.AMARTE_CHATBOT_URL.replace(/\/$/, "")
      : "";

  // Si no hay URL global, intenta deducirla desde la ruta del propio script
  if (!BACKEND_URL && document.currentScript && document.currentScript.src) {
    // Quita el nombre del archivo para obtener el origen del servidor de widgets
    BACKEND_URL = document.currentScript.src.replace(/\/[^/]+$/, "");
  }

  // Si aún no hay URL, usa el origen actual (útil en pruebas locales)
  if (!BACKEND_URL) {
    BACKEND_URL = window.location.origin;
  }

  /** URLs de acciones rápidas (alineadas con config/amarteCatalog.js). Sustituibles vía window.* */
  var DEFAULT_WHATSAPP_MESSAGE =
    "Hola, estuve navegando en la página web y descubrí habitaciones muy interesantes. ¿Me ayudas con más información?";
  var DEFAULT_QUICK_WHATSAPP =
    "https://wa.me/573007416683?text=" + encodeURIComponent(DEFAULT_WHATSAPP_MESSAGE);
  var DEFAULT_QUICK_RESERVE = "https://reservas.amartesuite.com";
  var DEFAULT_QUICK_PROMOS = "https://promojacuzzi.amartesuite.com";
  var DEFAULT_QUICK_TEL = "tel:+573013307909";

  /**
   * @param {string} globalProp - nombre de propiedad en window
   * @param {string} fallback
   */
  function pickQuickUrl(globalProp, fallback) {
    try {
      var g = window[globalProp];
      if (typeof g === "string" && g.trim()) {
        return g.trim();
      }
    } catch (e0) {}
    return fallback;
  }

  /**
   * @param {string} href
   * @param {string} label
   * @param {string} [extraClass]
   */
  function buildQuickLink(href, label, extraClass) {
    var a = document.createElement("a");
    a.className = "amarte-opt-link" + (extraClass ? " " + extraClass : "");
    a.href = href;
    if (href.indexOf("tel:") !== 0) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    a.textContent = label;
    return a;
  }

  var AMARTE_CONV_ID_KEY = "amarte_conversation_id";
  var CONVERSATION_ID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function randomUuidV4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        var r = (Math.random() * 16) | 0;
        var v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  /**
   * Identificador estable de conversación para historial en servidor (UUID v4).
   */
  function getConversationId() {
    try {
      var existing = localStorage.getItem(AMARTE_CONV_ID_KEY);
      if (existing && CONVERSATION_ID_RE.test(existing)) {
        return existing;
      }
      var id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : randomUuidV4();
      localStorage.setItem(AMARTE_CONV_ID_KEY, id);
      return id;
    } catch (e1) {
      try {
        var s = sessionStorage.getItem(AMARTE_CONV_ID_KEY);
        if (s && CONVERSATION_ID_RE.test(s)) {
          return s;
        }
        var nid = randomUuidV4();
        sessionStorage.setItem(AMARTE_CONV_ID_KEY, nid);
        return nid;
      } catch (e2) {
        return randomUuidV4();
      }
    }
  }

  /** Evita rehidratar el historial más de una vez por carga de página. */
  var historyHydrated = false;
  var historyHydrating = false;
  /** Evita duplicar el saludo inicial de Martina. */
  var welcomeShown = false;
  var WELCOME_TEXT =
    "¡Hola! ✨ Soy Martina, tu anfitriona digital de Amarte Suite. Estoy aquí para ayudarte a encontrar la experiencia perfecta. ¿Buscas algo romántico, con jacuzzi o una opción más acogedora?";

  /**
   * Muestra el saludo solo si el panel aún no tiene mensajes (historial vacío).
   */
  function ensureWelcomeMessage() {
    if (welcomeShown) {
      return;
    }
    if (typeof messagesEl === "undefined" || !messagesEl) {
      return;
    }
    if (messagesEl.querySelector(".amarte-msg")) {
      welcomeShown = true;
      return;
    }
    welcomeShown = true;
    appendMessage("bot", WELCOME_TEXT, []);
  }

  /** Zona horaria del hotel (cotizaciones y “hoy/mañana”). */
  var BOGOTA_TZ = "America/Bogota";

  function padTimePart(n) {
    var x = typeof n === "number" ? n : parseInt(String(n), 10);
    if (isNaN(x)) return "00";
    return x < 10 ? "0" + x : String(x);
  }

  /**
   * Fecha y hora actuales en Bogotá para que el servidor interprete expresiones relativas.
   * @returns {{ referenceDate: string; referenceTime: string; referenceWeekday: string; referenceIso: string }}
   */
  function getBogotaReference() {
    var now = new Date();
    var y = "";
    var m = "";
    var d = "";
    try {
      var fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: BOGOTA_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      var parts = fmt.formatToParts(now);
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === "year") {
          y = parts[i].value;
        }
        if (parts[i].type === "month") {
          m = parts[i].value;
        }
        if (parts[i].type === "day") {
          d = parts[i].value;
        }
      }
    } catch (e0) {
      return {
        referenceDate: "",
        referenceTime: "",
        referenceWeekday: "",
        referenceIso: "",
      };
    }
    var referenceDate = y + "-" + m + "-" + d;

    var hh = "00";
    var mm = "00";
    try {
      var tfmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: BOGOTA_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      var tparts = tfmt.formatToParts(now);
      for (var j = 0; j < tparts.length; j++) {
        if (tparts[j].type === "hour") {
          hh = padTimePart(tparts[j].value);
        }
        if (tparts[j].type === "minute") {
          mm = padTimePart(tparts[j].value);
        }
      }
    } catch (e1) {
      // deja 00:00
    }
    var referenceTime = hh + ":" + mm;

    var referenceWeekday = "";
    try {
      var wfmt = new Intl.DateTimeFormat("es-CO", {
        timeZone: BOGOTA_TZ,
        weekday: "long",
      });
      referenceWeekday = wfmt.format(now);
    } catch (e2) {
      referenceWeekday = "";
    }

    var referenceIso = referenceDate + "T" + referenceTime + ":00-05:00";

    return {
      referenceDate: referenceDate,
      referenceTime: referenceTime,
      referenceWeekday: referenceWeekday,
      referenceIso: referenceIso,
    };
  }

  /**
   * Codifica un valor para usarlo de forma segura en atributo HTML (p. ej. href).
   */
  function attrEncode(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
  }

  var WOMPI_CHECKOUT_URL = "https://checkout.wompi.co/l/VPOS_RXJqnz";
  var WOMPI_CHECKOUT_RE =
    /https:\/\/checkout\.wompi\.co\/l\/VPOS(?:_|%3[Cc]em%3[Ee]|%3[Cc]\/em%3[Ee]|<\/?em>|&lt;\/?em&gt;|&amp;lt;\/?em&amp;gt;)*RXJqnz(?:%3[Cc]\/em%3[Ee]|<\/em>|&lt;\/em&gt;|&amp;lt;\/em&amp;gt;)*/gi;

  /**
   * Corrige variantes generadas por Markdown/caché para el checkout de Wompi.
   */
  function normalizeWompiCheckoutUrl(value) {
    return String(value).replace(WOMPI_CHECKOUT_RE, WOMPI_CHECKOUT_URL);
  }

  function isWompiCheckoutLabel(label) {
    return /pago\s+seguro\s+wompi/i.test(String(label || ""));
  }

  /**
   * Escapa HTML en texto plano.
   */
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * En segmentos de texto ya escapado (sin etiquetas), convierte URLs http(s) en enlaces.
   */
  function autolinkPlainSegments(html) {
    var parts = html.split(/(<[^>]+>)/);
    var idx;
    for (idx = 0; idx < parts.length; idx++) {
      if (idx % 2 !== 0) {
        continue;
      }
      parts[idx] = parts[idx].replace(
        /\b(https?:\/\/[^\s<]+)/gi,
        function (full) {
          var u = full;
          while (u.length > 10 && /[.,;:!?…)\]]$/i.test(u)) {
            u = u.slice(0, -1);
          }
          if (!/^https?:\/\//i.test(u)) {
            return full;
          }
          var rawUrl = u.replace(/&amp;/g, "&");
          var suite = findSuiteVideoByProductUrl(rawUrl);
          var tail = full.slice(u.length);
          if (suite) {
            return (
              '<button type="button" class="amarte-suite-video-btn" data-amarte-video-url="' +
              attrEncode(suite.videoUrl) +
              '" data-amarte-video-title="' +
              attrEncode(suite.title) +
              '">Ver video de la ' +
              escapeHtml(suite.title) +
              "</button>" +
              tail
            );
          }
          var safeUrl = normalizeWompiCheckoutUrl(rawUrl);
          return (
            '<a href="' +
            attrEncode(safeUrl) +
            '" class="amarte-inline-link" target="_blank" rel="noopener noreferrer">' +
            escapeHtml(safeUrl) +
            "</a>" +
            tail
          );
        }
      );
    }
    return parts.join("");
  }

  /**
   * Aplica Markdown inline solo sobre texto, sin tocar atributos de etiquetas ya generadas.
   */
  function renderInlineMarkdownPlainSegments(html) {
    var parts = html.split(/(<[^>]+>)/);
    var idx;
    for (idx = 0; idx < parts.length; idx++) {
      if (idx % 2 !== 0) {
        continue;
      }
      parts[idx] = parts[idx].replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      parts[idx] = parts[idx].replace(/_([^_\n]+)_/g, "<em>$1</em>");
    }
    return parts.join("");
  }

  /**
   * Markdown ligero del mensaje del bot → HTML seguro (negrita, cursiva, enlaces, saltos).
   */
  function renderBotMessageHtml(raw) {
    var t = escapeHtml(String(raw || ""));
    // Títulos de oferta (## …) → magenta
    t = t.replace(
      /(^|\n)##\s+([^\n]+)/g,
      function (_full, lead, title) {
        return (
          lead +
          '<span class="amarte-promo-title">' +
          title.trim() +
          "</span>"
        );
      }
    );
    // Fallback: títulos planos (si la IA no usó ##)
    t = t.replace(
      /(^|\n)((?:🔥\s*)?¡?DESCUENTO ESPECIAL!?)/gi,
      function (_full, lead, title) {
        return lead + '<span class="amarte-promo-title">' + title.trim() + "</span>";
      }
    );
    t = t.replace(
      /(^|\n)((?:💎\s*)?¿?QUIERES AHORRAR AÚN MÁS\??)/gi,
      function (_full, lead, title) {
        return lead + '<span class="amarte-promo-title">' + title.trim() + "</span>";
      }
    );
    t = t.replace(
      /(^|\n)((?:🔥\s*)?Promo ya aplicada)/gi,
      function (_full, lead, title) {
        return lead + '<span class="amarte-promo-title">' + title.trim() + "</span>";
      }
    );
    // Enlaces Markdown [etiqueta](https://...) — fichas de suite → botón de video
    t = t.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      function (_, label, url) {
        var safeUrl = isWompiCheckoutLabel(label)
          ? WOMPI_CHECKOUT_URL
          : normalizeWompiCheckoutUrl(url.replace(/&amp;/g, "&"));
        return renderSuiteOrExternalLink(safeUrl, label);
      }
    );
    t = renderInlineMarkdownPlainSegments(t);
    t = autolinkPlainSegments(t);
    t = t.replace(/\n/g, "<br>");
    return t;
  }

  // Referencia al contenedor raíz del widget (se asigna al crear el DOM)
  var rootEl = null;
  // Referencia al panel de mensajes con scroll
  var messagesEl = null;
  // Referencia al campo de texto del usuario
  var inputEl = null;
  // Referencia al elemento que muestra "Escribiendo..."
  var typingEl = null;
  // Estado de grabación de voz (MediaRecorder)
  var voiceState = {
    recorder: null,
    chunks: [],
    stream: null,
    maxTimer: null,
  };

  /** Estado del modo “Hablar en vivo”. */
  var liveState = {
    enabled: false,
    bundleLoaded: false,
    loadingBundle: false,
    active: false,
    muted: false,
    provider: "elevenlabs",
    startedAt: 0,
    durationTimer: null,
    statusEl: null,
    metaEl: null,
    panelEl: null,
    overlayEl: null,
    liveBtn: null,
    muteBtn: null,
    unmuteBtn: null,
    endBtn: null,
  };

  /**
   * Kill-switch temporal: desactiva voz en vivo y muestra “Próximamente”.
   * Volver a false cuando indiquen reactivar.
   */
  var LIVE_VOICE_COMING_SOON = true;

  /** Catálogo para el formulario de prerreserva (desde /api/widget-config). */
  var reservationFormCatalog = {
    tipos: [
      "Suite Amarte",
      "Suite Árabe",
      "Suite Cabaña",
      "Suite Diamante",
      "Suite Gamer",
      "Suite Gold",
      "Suite Gótica",
      "Suite Jacuzzi",
      "Suite Movimiento",
      "Suite Queen",
      "Suite Rubí",
      "Suite Sencilla",
      "Suite Zafiro",
      "Plan Amarte",
      "Plan Cabaña",
      "Plan Cama Movimiento",
      "Plan Cumpleaños",
      "Plan Erótico",
      "Plan Húmedo",
      "Plan Movimiento",
      "Plan Romántico",
    ],
    packs: [
      "Pack 4 horas",
      "Pack 6 horas",
      "Pack 8 horas",
      "Pack 12 horas",
      "Día Hotelero",
    ],
  };

  /** @type {Array<{ id: string; title: string; productUrl: string; videoUrl: string }>} */
  var suiteVideosCatalog = [];

  /** Modal de video de suite (se crea lazy). */
  var suiteVideoModalEl = null;
  var suiteVideoPlayerEl = null;
  var suiteVideoTitleEl = null;

  var LIVE_ACTION_URLS = {
    reservation: DEFAULT_QUICK_RESERVE,
    reserve: DEFAULT_QUICK_RESERVE,
    promotions: DEFAULT_QUICK_PROMOS,
    whatsapp: DEFAULT_QUICK_WHATSAPP,
    payment: "https://checkout.wompi.co/l/VPOS_RXJqnz",
    wompi: "https://checkout.wompi.co/l/VPOS_RXJqnz",
  };

  /** Duración máxima de la conversación en vivo con Martina. */
  var LIVE_MAX_MS = 2 * 60 * 1000;

  /**
   * Analítica ligera (consola en no-producción; hook global opcional).
   * @param {string} name
   * @param {object} [props]
   */
  function trackLiveEvent(name, props) {
    var payload = {
      event: name,
      props: props || {},
      ts: new Date().toISOString(),
    };
    try {
      if (typeof window.__amarteAnalyticsTrack === "function") {
        window.__amarteAnalyticsTrack(payload);
        return;
      }
    } catch (e0) {}
    try {
      if (
        typeof location !== "undefined" &&
        (location.hostname === "localhost" ||
          location.hostname === "127.0.0.1")
      ) {
        console.debug("[amarte-analytics]", payload.event, payload.props);
      }
    } catch (e1) {}
  }

  /**
   * Carga el bundle de voz en vivo una sola vez (VoiceAgentManager).
   * @returns {Promise<void>}
   */
  function loadLiveAgentBundle() {
    if (liveState.bundleLoaded && window.VoiceAgentManager) {
      return Promise.resolve();
    }
    if (liveState.loadingBundle) {
      return new Promise(function (resolve, reject) {
        var tries = 0;
        var t = setInterval(function () {
          tries += 1;
          if (window.VoiceAgentManager) {
            clearInterval(t);
            resolve();
          } else if (tries > 80) {
            clearInterval(t);
            reject(new Error("Timeout cargando agente en vivo"));
          }
        }, 100);
      });
    }
    liveState.loadingBundle = true;
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = BACKEND_URL + "/amarte-live-agent.bundle.js";
      s.async = true;
      s.onload = function () {
        liveState.bundleLoaded = true;
        liveState.loadingBundle = false;
        if (!window.VoiceAgentManager) {
          reject(new Error("VoiceAgentManager no disponible"));
          return;
        }
        resolve();
      };
      s.onerror = function () {
        liveState.loadingBundle = false;
        reject(new Error("No se pudo cargar el agente en vivo"));
      };
      document.head.appendChild(s);
    });
  }

  /**
   * Estados UI independientes del proveedor:
   * idle | connecting | connected | listening | thinking | speaking | muted | disconnected | error
   * @param {string} status
   */
  function setLiveUiStatus(status) {
    if (!liveState.statusEl) return;
    var label = "Conectando con Martina…";
    liveState.statusEl.classList.remove(
      "amarte-listening",
      "amarte-speaking",
      "amarte-muted"
    );
    if (status === "idle") label = "Listo para hablar";
    else if (status === "connecting") label = "Conectando con Martina…";
    else if (status === "connected" || status === "listening") {
      label = "Martina está escuchando";
      liveState.statusEl.classList.add("amarte-listening");
    } else if (status === "speaking") {
      label = "Martina está hablando";
      liveState.statusEl.classList.add("amarte-speaking");
    } else if (status === "thinking") label = "Martina está pensando";
    else if (status === "muted") {
      label = "Micrófono silenciado";
      liveState.statusEl.classList.add("amarte-muted");
    } else if (status === "disconnected") label = "Conversación finalizada";
    else if (status === "error") label = "Error en la conversación en vivo";
    if (liveState.muted && liveState.active) {
      label = "Micrófono silenciado";
      liveState.statusEl.classList.add("amarte-muted");
    }
    liveState.statusEl.lastChild
      ? (liveState.statusEl.lastChild.textContent = label)
      : null;
    var textNode = liveState.statusEl.querySelector(".amarte-live-status-text");
    if (textNode) textNode.textContent = label;
  }

  function formatLiveDuration(ms) {
    var sec = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return (m < 10 ? "0" + m : String(m)) + ":" + (s < 10 ? "0" + s : String(s));
  }

  function startLiveDurationTimer() {
    stopLiveDurationTimer();
    liveState.startedAt = Date.now();
    liveState.durationTimer = setInterval(function () {
      if (!liveState.metaEl) return;
      var elapsed = Date.now() - liveState.startedAt;
      var remaining = Math.max(0, LIVE_MAX_MS - elapsed);
      liveState.metaEl.textContent =
        "Duración " +
        formatLiveDuration(elapsed) +
        " · quedan " +
        formatLiveDuration(remaining);
      if (elapsed >= LIVE_MAX_MS) {
        endLiveSession("time_limit");
        appendMessage(
          "bot",
          "La conversación en vivo tiene un límite de 2 minutos. Puedes seguir escribiendo o enviar una nota de voz.",
          []
        );
      }
    }, 1000);
  }

  function stopLiveDurationTimer() {
    if (liveState.durationTimer) {
      clearInterval(liveState.durationTimer);
      liveState.durationTimer = null;
    }
  }

  /**
   * Muestra fallback cuando falla el modo en vivo.
   * @param {string} [detail]
   */
  function showLiveFallback(detail) {
    var text =
      "No fue posible iniciar la conversación en vivo. Puedes escribirle a Martina o usar WhatsApp / Reservar en el pie del chat.";
    if (detail && /dominio|pageUrl|no permitido/i.test(detail)) {
      text =
        "No fue posible iniciar la conversación en vivo desde esta página. Prueba en amartesuite.com o en el demo oficial.";
    }
    appendMessage("bot", text, []);
    trackLiveEvent("live_voice_error", {
      reason: "fallback_shown",
      detail: detail ? String(detail).slice(0, 120) : "",
    });
  }

  /**
   * @param {string[]} actions
   */
  function showLiveActionButtons(actions) {
    var map = {
      promotions: {
        label: "🎁 Promociones",
        url: pickQuickUrl("AMARTE_PROMOCIONES_URL", DEFAULT_QUICK_PROMOS),
        event: null,
      },
      payment: {
        label: "💳 Pago seguro Wompi",
        url: WOMPI_CHECKOUT_URL,
        event: null,
      },
      wompi: {
        label: "💳 Pago seguro Wompi",
        url: WOMPI_CHECKOUT_URL,
        event: null,
      },
    };
    var options = [];
    var list = Array.isArray(actions) ? actions : [];
    for (var i = 0; i < list.length; i++) {
      var key = String(list[i] || "").toLowerCase();
      if (key === "reservation" || key === "reserve" || key === "whatsapp") {
        continue;
      }
      if (map[key]) {
        options.push({ label: map[key].label, url: map[key].url, _evt: map[key].event });
      }
    }
    if (!options.length) return;
    appendMessage("bot", "Aquí tienes los enlaces oficiales:", options.map(function (o) {
      return { label: o.label, url: o.url };
    }));
    // Track clicks via delegated listener once
    if (!rootEl.__amarteLiveActionTracked) {
      rootEl.__amarteLiveActionTracked = true;
      rootEl.addEventListener("click", function (ev) {
        var t = ev.target;
        if (!t || !t.classList || !t.classList.contains("amarte-opt-link")) return;
        var href = t.getAttribute("href") || "";
        if (href.indexOf("wa.me") !== -1) {
          trackLiveEvent("live_voice_whatsapp_clicked", {});
        } else if (
          href.indexOf("formulario-reservas") !== -1 ||
          href.indexOf("reservas.amartesuite.com") !== -1
        ) {
          trackLiveEvent("live_voice_reservation_clicked", {});
        }
      });
    }
  }

  function openLiveConsent() {
    trackLiveEvent("live_voice_button_clicked", {});
    if (liveState.overlayEl) {
      liveState.overlayEl.classList.add("amarte-open");
    }
  }

  function closeLiveConsent() {
    if (liveState.overlayEl) {
      liveState.overlayEl.classList.remove("amarte-open");
    }
  }

  function setLivePanelOpen(open) {
    if (!liveState.panelEl) return;
    if (open) liveState.panelEl.classList.add("amarte-open");
    else liveState.panelEl.classList.remove("amarte-open");
  }

  function updateLiveControlButtons() {
    if (liveState.muteBtn) liveState.muteBtn.disabled = !liveState.active || liveState.muted;
    if (liveState.unmuteBtn) liveState.unmuteBtn.disabled = !liveState.active || !liveState.muted;
    if (liveState.endBtn) liveState.endBtn.disabled = !liveState.active;
    if (liveState.liveBtn) liveState.liveBtn.disabled = liveState.active;
    var micBtn = rootEl && rootEl.querySelector(".amarte-widget-mic");
    var micHint = rootEl && rootEl.querySelector(".amarte-widget-mic-hint");
    if (micBtn) {
      micBtn.disabled = liveState.active;
      micBtn.setAttribute(
        "title",
        liveState.active
          ? "Durante la conversación en vivo no hace falta pulsar el micrófono"
          : "Mensaje de voz"
      );
    }
    if (micHint) {
      micHint.textContent = liveState.active
        ? "Habla con naturalidad: Martina te escucha en vivo (no pulses el micrófono)"
        : "Presiona el micrófono para hablar y nuevamente para finalizar";
    }
  }

  /**
   * Detiene una nota de voz en curso (evita que robe el mic al WebRTC en vivo).
   */
  function stopVoiceNoteIfRecording() {
    if (voiceState.recorder && voiceState.recorder.state === "recording") {
      try {
        voiceState.recorder.stop();
      } catch (e0) {}
    }
  }

  /**
   * Quita etiquetas de audio de ElevenLabs (p. ej. [warmly]) del texto mostrado.
   * @param {string} text
   * @returns {string}
   */
  function stripLiveAudioTags(text) {
    return String(text || "")
      .replace(/\[[a-z][a-z0-9_-]{0,30}\]/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function endLiveSession(reason) {
    var wasActive = liveState.active;
    var durationMs = liveState.startedAt ? Date.now() - liveState.startedAt : 0;
    liveState.active = false;
    liveState.muted = false;
    stopLiveDurationTimer();
    setLiveUiStatus("disconnected");
    updateLiveControlButtons();
    setLivePanelOpen(false);
    var done = Promise.resolve();
    try {
      if (window.VoiceAgentManager && typeof window.VoiceAgentManager.stop === "function") {
        done = Promise.resolve(window.VoiceAgentManager.stop()).catch(function () {});
      }
    } catch (e0) {}
    if (wasActive) {
      trackLiveEvent("live_voice_disconnected", { reason: reason || "user" });
      trackLiveEvent("live_voice_duration", {
        seconds: Math.round(durationMs / 1000),
      });
    }
    return done;
  }

  function beginLiveConversation() {
    closeLiveConsent();
    stopVoiceNoteIfRecording();

    // Pedir micrófono en el mismo gesto del clic (antes del async del bundle/token).
    var micReady = Promise.resolve();
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      micReady = navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(function (stream) {
          stream.getTracks().forEach(function (t) {
            t.stop();
          });
        });
    }

    micReady
      .then(function () {
        return loadLiveAgentBundle();
      })
      .then(function () {
        if (
          !window.VoiceAgentManager ||
          (window.VoiceAgentManager.isSupported &&
            !window.VoiceAgentManager.isSupported())
        ) {
          showLiveFallback();
          return null;
        }

        setLivePanelOpen(true);
        setLiveUiStatus("connecting");
        liveState.active = true;
        liveState.muted = false;
        updateLiveControlButtons();
        startLiveDurationTimer();

        return window.VoiceAgentManager.start({
          provider: liveState.provider || "elevenlabs",
          backendUrl: BACKEND_URL,
          conversationId: getConversationId(),
          pageUrl: window.location.href || "",
          roomName: document.title || "",
          onStatus: function (status) {
            setLiveUiStatus(status);
          },
          onTranscript: function (payload) {
            if (!payload || !payload.text) return;
            var text = stripLiveAudioTags(payload.text);
            if (!text) return;
            if (payload.role === "user") {
              appendMessage("user", text, null);
            } else {
              appendMessage("bot", text, []);
            }
          },
          onShowActions: function (actions) {
            showLiveActionButtons(actions);
          },
          onConnected: function () {
            trackLiveEvent("live_voice_connected", {});
            trackLiveEvent("live_voice_permission_granted", {});
            try {
              if (
                window.VoiceAgentManager &&
                typeof window.VoiceAgentManager.unmute === "function"
              ) {
                window.VoiceAgentManager.unmute();
              }
            } catch (eUnmute) {}
            liveState.muted = false;
            setLiveUiStatus("listening");
            updateLiveControlButtons();
          },
          onDisconnected: function () {
            endLiveSession("remote");
          },
          onError: function (message) {
            trackLiveEvent("live_voice_error", {});
            endLiveSession("error");
            showLiveFallback(message);
          },
        });
      })
      .catch(function (errStart) {
        var msg = errStart && errStart.message ? String(errStart.message) : "";
        if (/permis|NotAllowed|Permission|denied/i.test(msg)) {
          trackLiveEvent("live_voice_permission_denied", {});
          msg =
            msg ||
            "Necesitamos permiso de micrófono para la conversación en vivo.";
        } else {
          trackLiveEvent("live_voice_error", { message: msg.slice(0, 120) });
        }
        endLiveSession("error");
        showLiveFallback(msg);
      });
  }

  /**
   * Consulta config pública: catálogo del form + videos de suite + voz en vivo si aplica.
   */
  function loadWidgetConfig() {
    fetch(BACKEND_URL + "/api/widget-config")
      .then(function (res) {
        return res.json();
      })
      .then(function (cfg) {
        if (
          cfg &&
          cfg.reservationForm &&
          Array.isArray(cfg.reservationForm.tipos) &&
          cfg.reservationForm.tipos.length
        ) {
          reservationFormCatalog.tipos = cfg.reservationForm.tipos.slice();
        }
        if (
          cfg &&
          cfg.reservationForm &&
          Array.isArray(cfg.reservationForm.packs) &&
          cfg.reservationForm.packs.length
        ) {
          reservationFormCatalog.packs = cfg.reservationForm.packs.slice();
        }
        if (cfg && Array.isArray(cfg.suiteVideos) && cfg.suiteVideos.length) {
          suiteVideosCatalog = cfg.suiteVideos.slice();
        }
        if (LIVE_VOICE_COMING_SOON) {
          return;
        }
        if (cfg && cfg.voiceAgentProvider) {
          liveState.provider = String(cfg.voiceAgentProvider);
        }
        if (cfg && cfg.liveVoiceEnabled === true) {
          liveState.enabled = true;
          if (liveState.liveBtn) {
            liveState.liveBtn.style.display = "flex";
          }
        }
      })
      .catch(function () {
        // Silencioso: el chat sigue con catálogo embebido
      });
  }

  /**
   * @param {string} productUrl
   * @returns {{ id: string; title: string; productUrl: string; videoUrl: string } | null}
   */
  function findSuiteVideoByProductUrl(productUrl) {
    var raw = String(productUrl || "").trim();
    if (!raw) return null;
    var path = "";
    try {
      path = new URL(raw).pathname.replace(/\/+$/, "").toLowerCase();
    } catch (e0) {
      path = raw.replace(/\/+$/, "").toLowerCase();
    }
    for (var i = 0; i < suiteVideosCatalog.length; i++) {
      var item = suiteVideosCatalog[i];
      if (!item || !item.productUrl || !item.videoUrl) continue;
      var itemPath = "";
      try {
        itemPath = new URL(item.productUrl)
          .pathname.replace(/\/+$/, "")
          .toLowerCase();
      } catch (e1) {
        continue;
      }
      if (path === itemPath || path.endsWith(itemPath)) {
        return item;
      }
    }
    return null;
  }

  function ensureSuiteVideoModal() {
    if (suiteVideoModalEl) return;
    suiteVideoModalEl = document.createElement("div");
    suiteVideoModalEl.className = "amarte-suite-video-modal";
    suiteVideoModalEl.setAttribute("role", "dialog");
    suiteVideoModalEl.setAttribute("aria-modal", "true");
    suiteVideoModalEl.setAttribute("aria-hidden", "true");
    suiteVideoModalEl.innerHTML =
      '<div class="amarte-suite-video-backdrop" data-amarte-video-close="1"></div>' +
      '<div class="amarte-suite-video-dialog">' +
      '<div class="amarte-suite-video-header">' +
      '<h4 class="amarte-suite-video-title"></h4>' +
      '<button type="button" class="amarte-suite-video-close" aria-label="Cerrar video" data-amarte-video-close="1">✕</button>' +
      "</div>" +
      '<video class="amarte-suite-video-player" controls playsinline preload="metadata"></video>' +
      "</div>";
    document.body.appendChild(suiteVideoModalEl);
    suiteVideoPlayerEl = suiteVideoModalEl.querySelector(
      ".amarte-suite-video-player"
    );
    suiteVideoTitleEl = suiteVideoModalEl.querySelector(
      ".amarte-suite-video-title"
    );
    suiteVideoModalEl.addEventListener("click", function (ev) {
      var t = ev.target;
      if (
        t &&
        t.getAttribute &&
        t.getAttribute("data-amarte-video-close") === "1"
      ) {
        closeSuiteVideoModal();
      }
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && suiteVideoModalEl && suiteVideoModalEl.classList.contains("amarte-open")) {
        closeSuiteVideoModal();
      }
    });
  }

  function closeSuiteVideoModal() {
    if (!suiteVideoModalEl) return;
    suiteVideoModalEl.classList.remove("amarte-open");
    suiteVideoModalEl.setAttribute("aria-hidden", "true");
    if (suiteVideoPlayerEl) {
      try {
        suiteVideoPlayerEl.pause();
      } catch (e0) {}
      suiteVideoPlayerEl.removeAttribute("src");
      try {
        suiteVideoPlayerEl.load();
      } catch (e1) {}
    }
  }

  /**
   * @param {{ title?: string; videoUrl: string }} video
   */
  function openSuiteVideoModal(video) {
    if (!video || !video.videoUrl) return;
    ensureSuiteVideoModal();
    if (suiteVideoTitleEl) {
      suiteVideoTitleEl.textContent = video.title
        ? String(video.title)
        : "Video de la suite";
    }
    if (suiteVideoPlayerEl) {
      suiteVideoPlayerEl.src = video.videoUrl;
      suiteVideoPlayerEl.play().catch(function () {});
    }
    suiteVideoModalEl.classList.add("amarte-open");
    suiteVideoModalEl.setAttribute("aria-hidden", "false");
  }

  /**
   * @param {string} url maybe HTML-escaped
   * @param {string} labelHtml already escaped for HTML text
   * @returns {string} HTML
   */
  function renderSuiteOrExternalLink(url, labelHtml) {
    var rawUrl = String(url || "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"');
    var suite = findSuiteVideoByProductUrl(rawUrl);
    if (suite) {
      return (
        '<button type="button" class="amarte-suite-video-btn" data-amarte-video-url="' +
        attrEncode(suite.videoUrl) +
        '" data-amarte-video-title="' +
        attrEncode(suite.title || "") +
        '">' +
        (labelHtml || escapeHtml("Ver video de la " + suite.title)) +
        "</button>"
      );
    }
    var safeUrl = normalizeWompiCheckoutUrl(rawUrl);
    return (
      '<a href="' +
      attrEncode(safeUrl) +
      '" class="amarte-inline-link" target="_blank" rel="noopener noreferrer">' +
      labelHtml +
      "</a>"
    );
  }

  /**
   * Consulta config pública y muestra el botón en vivo si aplica.
   */
  function initLiveVoiceFeature() {
    if (LIVE_VOICE_COMING_SOON) {
      applyLiveComingSoonUi();
    }
    loadWidgetConfig();
  }

  /** UI temporal: botón visible pero deshabilitado (“Próximamente”). */
  function applyLiveComingSoonUi() {
    liveState.enabled = false;
    if (!liveState.liveBtn) return;
    liveState.liveBtn.style.display = "flex";
    liveState.liveBtn.disabled = true;
    liveState.liveBtn.classList.add("amarte-live-soon");
    liveState.liveBtn.setAttribute("aria-label", "Hablar en vivo con Martina — Próximamente");
    liveState.liveBtn.setAttribute("title", "Próximamente");
    var label = liveState.liveBtn.querySelector("span:not(.amarte-live-dot)");
    if (label) label.textContent = "Próximamente";
  }

  /**
   * Inserta en el documento los estilos CSS del widget (paleta Amarte: magenta, navy, blanco).
   */
  function injectStyles() {
    // Crea un elemento style para inyectar reglas CSS sin archivo externo
    var style = document.createElement("style");
    // Identificador para poder localizar estos estilos si hace falta
    style.setAttribute("data-amarte-widget", "true");
    // Texto CSS: variables de color y layout del widget
    style.textContent =
      /* CSS del widget Amarte */
      ".amarte-widget-root{font-family:'Jost',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}" +
      ".amarte-widget-launcher{position:fixed;right:24px;left:auto;bottom:calc(24px + env(safe-area-inset-bottom,0px));" +
      "display:flex;align-items:center;gap:8px;padding:7px 7px 7px 14px;border:none;border-radius:999px;" +
      "background:#D81B60;color:#ffffff;cursor:pointer;z-index:99998;" +
      "font-size:0.72rem;font-weight:600;letter-spacing:0.01em;white-space:normal;" +
      "box-shadow:0 8px 24px rgba(216,27,96,0.35);" +
      "transition:opacity 0.25s ease,visibility 0.25s ease,transform 0.25s ease,box-shadow 0.2s ease;}" +
      ".amarte-widget-launcher:hover{transform:scale(1.02);box-shadow:0 12px 32px rgba(216,27,96,0.45);}" +
      ".amarte-widget-launcher-label{line-height:1.15;text-align:left;display:block;}" +
      ".amarte-widget-launcher-icon{width:40px;height:40px;border-radius:50%;flex-shrink:0;" +
      "background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;}" +
      ".amarte-widget-root.amarte-chat-open .amarte-widget-launcher{opacity:0;visibility:hidden;pointer-events:none;transform:scale(0.92);}" +
      ".amarte-widget-panel{position:fixed;right:24px;left:auto;bottom:96px;width:min(380px,calc(100vw - 32px));" +
      "max-height:min(560px,calc(100vh - 120px));background:rgba(255,255,255,0.92);border:1px solid #fff;" +
      "border-radius:25px;box-shadow:0 12px 40px rgba(0,0,0,0.1);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);" +
      "z-index:99999;display:flex;flex-direction:column;overflow:hidden;opacity:0;" +
      "transform:translateY(12px) scale(0.98);pointer-events:none;color:#1a1a1a;color-scheme:light;" +
      "transition:opacity 0.25s ease,transform 0.25s ease;}" +
      ".amarte-widget-panel.amarte-open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}" +
      ".amarte-widget-header{background:transparent;padding:16px 18px 12px;" +
      "display:flex;align-items:center;justify-content:space-between;}" +
      ".amarte-widget-title{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
      "font-size:1.1rem;font-weight:600;letter-spacing:0.02em;color:#D81B60;}" +
      ".amarte-widget-sub{color:#9e9e9e;font-size:0.75rem;margin-top:4px;}" +
      ".amarte-widget-close{background:transparent;border:none;color:#9e9e9e;cursor:pointer;" +
      "padding:4px;line-height:1;font-size:1.5rem;}" +
      ".amarte-widget-close:hover{color:#D81B60;}" +
      ".amarte-widget-messages{flex:1;overflow-y:auto;padding:16px;background:transparent;min-height:200px;}" +
      ".amarte-msg{margin-bottom:12px;display:flex;flex-direction:column;align-items:flex-start;}" +
      ".amarte-msg-user{align-items:flex-end;}" +
      ".amarte-bubble-inner{max-width:85%;padding:10px 14px;border-radius:14px;font-size:0.95rem;line-height:1.45;" +
      "word-break:break-word;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif;}" +
      ".amarte-msg-bot .amarte-inline-link{color:#AD1457;text-decoration:underline;font-weight:600;}" +
      ".amarte-msg-bot .amarte-inline-link:hover{color:#1A1A3D;}" +
      ".amarte-suite-video-btn{display:inline;margin:0;padding:0;border:none;background:none;" +
      "color:#AD1457;text-decoration:underline;font-weight:600;font:inherit;cursor:pointer;}" +
      ".amarte-suite-video-btn:hover{color:#1A1A3D;}" +
      ".amarte-suite-video-cta{display:inline-flex;align-items:center;gap:6px;margin-top:10px;" +
      "padding:10px 14px;border-radius:999px;border:none;cursor:pointer;font-weight:600;font-size:0.85rem;" +
      "background:#D81B60;color:#fff;}" +
      ".amarte-suite-video-cta:hover{background:#AD1457;}" +
      ".amarte-suite-video-modal{position:fixed;inset:0;z-index:2147483000;display:none;" +
      "align-items:center;justify-content:center;padding:16px;}" +
      ".amarte-suite-video-modal.amarte-open{display:flex;}" +
      ".amarte-suite-video-backdrop{position:absolute;inset:0;background:rgba(13,13,17,0.72);}" +
      ".amarte-suite-video-dialog{position:relative;z-index:1;width:min(920px,100%);" +
      "background:#111;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.45);}" +
      ".amarte-suite-video-header{display:flex;align-items:center;justify-content:space-between;" +
      "gap:12px;padding:12px 14px;background:#1a1a1a;}" +
      ".amarte-suite-video-title{margin:0;color:#fff;font-size:1rem;font-weight:600;}" +
      ".amarte-suite-video-close{border:none;background:transparent;color:#fff;font-size:1.35rem;" +
      "cursor:pointer;line-height:1;padding:4px 8px;}" +
      ".amarte-suite-video-close:hover{color:#E91E63;}" +
      ".amarte-suite-video-player{display:block;width:100%;max-height:min(70vh,560px);background:#000;}" +
      ".amarte-msg-bot .amarte-bubble-inner{background:#fff;border:1px solid #e0e0e0;color:#1a1a1a;}" +
      ".amarte-msg-bot .amarte-promo-title{display:block;margin:12px 0 6px;color:#D81B60;" +
      "font-weight:800;font-size:1.05rem;letter-spacing:0.01em;line-height:1.3;}" +
      ".amarte-msg-bot .amarte-promo-title:first-child{margin-top:2px;}" +
      ".amarte-msg-user .amarte-bubble-inner{background:linear-gradient(145deg,#E91E63,#D81B60);color:#ffffff;}" +
      ".amarte-typing{font-size:0.85rem;color:#666;font-style:italic;padding:4px 0 8px;}" +
      ".amarte-options{margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;}" +
      ".amarte-opt-link{display:inline-block;padding:10px 16px;border-radius:30px;border:none;" +
      "color:#fff;text-decoration:none;font-size:0.85rem;font-weight:600;background:#D81B60;" +
      "transition:background 0.2s ease,transform 0.15s ease;}" +
      ".amarte-opt-link:hover{background:#AD1457;color:#fff;}" +
      ".amarte-dt-picker{width:100%;max-width:100%;margin-top:8px;padding:12px;" +
      "background:#fff;border:1px solid #e0e0e0;border-radius:14px;box-sizing:border-box;}" +
      ".amarte-dt-picker-title{margin:0 0 10px;font-size:0.85rem;font-weight:600;color:#1A1A3D;}" +
      ".amarte-dt-stack{display:flex;flex-direction:column;gap:10px;margin-bottom:10px;}" +
      ".amarte-dt-field{display:flex;flex-direction:column;gap:4px;width:100%;}" +
      ".amarte-dt-field label{font-size:0.72rem;font-weight:600;color:#555;}" +
      ".amarte-dt-field input,.amarte-dt-field select{width:100%;box-sizing:border-box;" +
      "border:1px solid rgba(0,0,0,0.12);border-radius:10px;padding:9px 10px;font-size:0.88rem;" +
      "background:#fff !important;color:#1a1a1a !important;-webkit-text-fill-color:#1a1a1a !important;" +
      "caret-color:#1a1a1a !important;opacity:1 !important;color-scheme:light;}" +
      ".amarte-dt-field input:focus,.amarte-dt-field select:focus{border-color:#D81B60;outline:none;}" +
      ".amarte-dt-field select option{color:#1a1a1a !important;background:#fff !important;}" +
      ".amarte-dt-time-row{display:flex;gap:6px;}" +
      ".amarte-dt-time-row select{flex:1;min-width:0;}" +
      ".amarte-dt-submit{width:100%;margin-top:4px;padding:11px 14px;border:none;border-radius:999px;" +
      "background:#D81B60;color:#fff;font-weight:600;font-size:0.85rem;cursor:pointer;}" +
      ".amarte-dt-submit:hover{background:#AD1457;}" +
      ".amarte-dt-submit:disabled{opacity:0.55;cursor:not-allowed;}" +
      ".amarte-dt-error{margin:0 0 8px;font-size:0.78rem;color:#c62828;}" +
      ".amarte-widget-footer-wrap{flex-shrink:0;display:flex;flex-direction:column;background:transparent;}" +
      ".amarte-widget-footer-row{display:flex;gap:8px;padding:12px 16px 8px;background:transparent;align-items:center;}" +
      ".amarte-widget-mic-hint{margin:0;padding:0 16px 8px;font-size:0.75rem;line-height:1.35;" +
      "color:rgba(0,0,0,0.55);text-align:center;}" +
      ".amarte-widget-quick-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;" +
      "padding:0 16px 16px;background:transparent;margin-top:4px;}" +
      ".amarte-widget-quick-row .amarte-opt-link{text-align:center;}" +
      "@media (min-width:769px){.amarte-quick-call{display:none !important;}}" +
      ".amarte-widget-input{flex:1;border:1px solid rgba(0,0,0,0.12);border-radius:999px;" +
      "padding:12px 16px;font-size:0.95rem;outline:none;background:#fff !important;" +
      "box-shadow:none;color:#0D0D11 !important;caret-color:#0D0D11 !important;" +
      "font-family:'Jost',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
      "font-weight:400;-webkit-text-fill-color:#0D0D11 !important;opacity:1 !important;color-scheme:light;}" +
      ".amarte-widget-input::placeholder{color:#929095 !important;opacity:1;-webkit-text-fill-color:#929095 !important;}" +
      ".amarte-widget-input:focus{border-color:#D81B60;}" +
      ".amarte-widget-input:-webkit-autofill,.amarte-widget-input:-webkit-autofill:hover," +
      ".amarte-widget-input:-webkit-autofill:focus{-webkit-text-fill-color:#0D0D11 !important;" +
      "box-shadow:0 0 0 1000px #fff inset !important;transition:background-color 9999s ease-out 0s;}" +
      ".amarte-widget-mic{background:transparent;color:#D81B60;border:none;border-radius:50%;" +
      "width:40px;height:40px;padding:0;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;" +
      "transition:background 0.2s ease,color 0.2s ease;}" +
      ".amarte-widget-mic:hover{background:rgba(216,27,96,0.08);}" +
      ".amarte-widget-mic:disabled{opacity:0.5;cursor:not-allowed;}" +
      ".amarte-widget-mic.amarte-recording{background:#2E7D32;color:#fff;}" +
      ".amarte-widget-mic.amarte-recording:hover{background:#1B5E20;}" +
      ".amarte-widget-audio{width:100%;max-width:100%;margin-top:8px;height:40px;}" +
      ".amarte-widget-send{width:44px;height:44px;min-width:44px;padding:0;border:none;border-radius:50%;" +
      "background:#D81B60;color:#fff;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;" +
      "box-shadow:0 4px 12px rgba(216,27,96,0.35);transition:background 0.2s ease,transform 0.15s ease;}" +
      ".amarte-widget-send:hover{background:#AD1457;transform:scale(1.05);}" +
      ".amarte-widget-send:disabled{opacity:0.5;cursor:not-allowed;}" +
      ".amarte-rsv-form{width:100%;max-width:100%;margin-top:4px;padding:12px;" +
      "background:#fff;border:1px solid #e0e0e0;border-radius:14px;box-sizing:border-box;color:#1a1a1a;}" +
      ".amarte-rsv-form-title{margin:0 0 10px;font-size:0.9rem;font-weight:600;color:#1A1A3D;}" +
      ".amarte-rsv-field{display:flex;flex-direction:column;gap:4px;margin-bottom:10px;}" +
      ".amarte-rsv-field label,.amarte-rsv-field > div{font-size:0.75rem;font-weight:600;color:#555 !important;}" +
      ".amarte-rsv-field input,.amarte-rsv-field select{width:100%;box-sizing:border-box;" +
      "border:1px solid rgba(0,0,0,0.12);border-radius:10px;padding:9px 11px;font-size:0.9rem;" +
      "font-family:inherit;color:#0D0D11 !important;background:#fff !important;outline:none;" +
      "-webkit-text-fill-color:#0D0D11 !important;caret-color:#0D0D11 !important;opacity:1 !important;color-scheme:light;}" +
      ".amarte-rsv-field input:focus,.amarte-rsv-field select:focus{border-color:#D81B60;}" +
      ".amarte-rsv-field input:disabled,.amarte-rsv-field select:disabled{opacity:0.7 !important;background:#f5f5f5 !important;}" +
      ".amarte-rsv-field input:-webkit-autofill,.amarte-rsv-field input:-webkit-autofill:hover," +
      ".amarte-rsv-field input:-webkit-autofill:focus{-webkit-text-fill-color:#0D0D11 !important;" +
      "box-shadow:0 0 0 1000px #fff inset !important;transition:background-color 9999s ease-out 0s;}" +
      ".amarte-rsv-field select option{color:#0D0D11 !important;background:#fff !important;}" +
      ".amarte-rsv-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;}" +
      ".amarte-rsv-pack-options{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px;}" +
      ".amarte-rsv-pack-opt{display:inline-flex;cursor:pointer;margin:0;position:relative;}" +
      ".amarte-rsv-pack-opt input{position:absolute;opacity:0;width:1px;height:1px;margin:0;clip:rect(0,0,0,0);}" +
      ".amarte-rsv-pack-opt span{display:inline-block;padding:8px 11px;border:1px solid rgba(0,0,0,0.14);" +
      "border-radius:999px;font-size:0.8rem;font-weight:600;color:#1A1A3D !important;background:#fff !important;" +
      "line-height:1.2;transition:background 0.15s ease,color 0.15s ease,border-color 0.15s ease;" +
      "-webkit-text-fill-color:#1A1A3D !important;}" +
      ".amarte-rsv-pack-opt:hover span{border-color:#D81B60;}" +
      ".amarte-rsv-pack-opt input:focus-visible + span{outline:2px solid #D81B60;outline-offset:2px;}" +
      ".amarte-rsv-pack-opt input:checked + span{background:#D81B60 !important;color:#fff !important;" +
      "border-color:#D81B60;-webkit-text-fill-color:#fff !important;}" +
      ".amarte-rsv-error{display:none;margin:0 0 8px;font-size:0.8rem;color:#c62828;}" +
      ".amarte-rsv-error.amarte-show{display:block;}" +
      ".amarte-rsv-submit{width:100%;border:none;border-radius:999px;padding:11px 14px;" +
      "background:#D81B60;color:#fff;font-weight:600;font-size:0.9rem;cursor:pointer;}" +
      ".amarte-rsv-submit:hover{background:#AD1457;}" +
      ".amarte-rsv-submit:disabled{opacity:0.55;cursor:not-allowed;}" +
      ".amarte-rsv-form.amarte-done{opacity:0.72;pointer-events:none;}" +
      "@media (max-width:768px){.amarte-widget-launcher{right:16px;font-size:0.68rem;padding:6px 6px 6px 12px;" +
      "bottom:calc(16px + env(safe-area-inset-bottom,0px));}" +
      ".amarte-widget-launcher-icon{width:36px;height:36px;}" +
      ".amarte-widget-launcher-icon svg{width:18px;height:18px;}" +
      ".amarte-widget-panel{right:16px;bottom:calc(80px + env(safe-area-inset-bottom,0px));}}" +
      "@media (min-width:769px){.amarte-widget-panel{width:min(420px,calc(100vw - 48px));" +
      "max-height:min(720px,calc(100vh - 140px));}.amarte-widget-messages{min-height:320px;}}" +
      /* Live voice */
      ".amarte-live-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:auto;" +
      "margin:0 auto 8px;padding:10px 16px;border:none;border-radius:30px;cursor:pointer;" +
      "background:#1A1A3D;color:#fff;font-size:0.85rem;font-weight:600;}" +
      ".amarte-live-btn:hover{background:#2a2a55;}" +
      ".amarte-live-btn:disabled{opacity:0.5;cursor:not-allowed;}" +
      ".amarte-live-btn.amarte-live-soon{opacity:0.9;cursor:not-allowed;background:#17172a;color:rgba(255,255,255,0.78);}" +
      ".amarte-live-btn.amarte-live-soon:hover{background:#17172a;}" +
      ".amarte-live-btn .amarte-live-dot{width:8px;height:8px;border-radius:50%;background:#e53935;flex-shrink:0;}" +
      ".amarte-live-btn.amarte-live-soon .amarte-live-dot{background:#9e9e9e;}" +
      ".amarte-widget-footer-wrap>.amarte-live-btn{align-self:center;}" +
      ".amarte-live-overlay{position:absolute;inset:0;background:rgba(26,26,61,0.55);z-index:5;" +
      "display:none;align-items:center;justify-content:center;padding:16px;}" +
      ".amarte-live-overlay.amarte-open{display:flex;}" +
      ".amarte-live-card{background:#fff;border-radius:16px;padding:18px;max-width:100%;width:100%;" +
      "box-shadow:0 8px 28px rgba(0,0,0,0.18);}" +
      ".amarte-live-card p{margin:0 0 14px;font-size:0.9rem;line-height:1.45;color:#1a1a1a;}" +
      ".amarte-live-card-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;}" +
      ".amarte-live-card-actions button{border:none;border-radius:999px;padding:10px 14px;font-weight:600;" +
      "font-size:0.85rem;cursor:pointer;}" +
      ".amarte-live-start{background:#D81B60;color:#fff;}" +
      ".amarte-live-start:hover{background:#AD1457;}" +
      ".amarte-live-cancel{background:#eee;color:#333;}" +
      ".amarte-live-panel{display:none;flex-direction:column;gap:8px;padding:10px 16px 12px;" +
      "background:rgba(255,255,255,0.92);border-top:1px solid rgba(0,0,0,0.06);}" +
      ".amarte-live-panel.amarte-open{display:flex;}" +
      ".amarte-live-status{font-size:0.85rem;color:#1A1A3D;font-weight:600;display:flex;align-items:center;gap:8px;}" +
      ".amarte-live-status .amarte-live-mic-ind{width:10px;height:10px;border-radius:50%;background:#9e9e9e;}" +
      ".amarte-live-status.amarte-listening .amarte-live-mic-ind{background:#2E7D32;}" +
      ".amarte-live-status.amarte-speaking .amarte-live-mic-ind{background:#D81B60;" +
      "animation:amarte-live-pulse 1.1s ease-in-out infinite;}" +
      ".amarte-live-status.amarte-muted .amarte-live-mic-ind{background:#f9a825;}" +
      "@keyframes amarte-live-pulse{0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.35);opacity:0.7;}}" +
      ".amarte-live-meta{font-size:0.75rem;color:#666;}" +
      ".amarte-live-controls{display:flex;flex-wrap:wrap;gap:8px;}" +
      ".amarte-live-controls button{border:none;border-radius:999px;padding:8px 12px;font-size:0.8rem;" +
      "font-weight:600;cursor:pointer;background:#eee;color:#1a1a1a;}" +
      ".amarte-live-controls button:disabled{opacity:0.45;cursor:not-allowed;}" +
      ".amarte-live-controls .amarte-live-end{background:#1A1A3D;color:#fff;}";

    // Añade el style al head del documento
    document.head.appendChild(style);
  }

  /**
   * Desplaza el área de mensajes hasta el final para ver el último mensaje.
   */
  function scrollMessagesToBottom() {
    // Si no existe el contenedor de mensajes, no hace nada
    if (!messagesEl) {
      return;
    }
    // Fuerza el scroll al máximo vertical disponible
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  /**
   * Crea un nodo de mensaje de usuario o bot y lo añade al panel.
   * @param {'user'|'bot'} role - Quién envía el mensaje
   * @param {string} text - Contenido de texto
   * @param {Array<{label:string,url:string}>} options - Enlaces rápidos (solo bot)
   * @param {{audioBase64?: string, audioMimeType?: string}} [extras] - Audio de respuesta (solo bot, voz)
   */
  function appendMessage(role, text, options, extras) {
    // Contenedor de una fila de mensaje
    var row = document.createElement("div");
    // Clase base de mensaje
    row.className = "amarte-msg " + (role === "user" ? "amarte-msg-user" : "amarte-msg-bot");

    // Burbuja interior con el texto
    var bubble = document.createElement("div");
    bubble.className = "amarte-bubble-inner";
    if (role === "bot") {
      bubble.innerHTML = renderBotMessageHtml(text);
    } else {
      bubble.textContent = text;
    }
    row.appendChild(bubble);

    // Solo botón de video bajo la burbuja (CTAs viven en el pie del widget)
    if (
      role === "bot" &&
      extras &&
      extras.suiteVideo &&
      extras.suiteVideo.videoUrl
    ) {
      var videoBtn = document.createElement("button");
      videoBtn.type = "button";
      videoBtn.className = "amarte-suite-video-cta";
      videoBtn.setAttribute(
        "data-amarte-video-url",
        extras.suiteVideo.videoUrl
      );
      videoBtn.setAttribute(
        "data-amarte-video-title",
        extras.suiteVideo.title || ""
      );
      videoBtn.textContent =
        "Ver video" +
        (extras.suiteVideo.title ? " · " + extras.suiteVideo.title : "");
      row.appendChild(videoBtn);
    }

    if (
      role === "bot" &&
      extras &&
      extras.audioBase64 &&
      extras.audioMimeType
    ) {
      var audioEl = document.createElement("audio");
      audioEl.className = "amarte-widget-audio";
      audioEl.controls = true;
      audioEl.setAttribute(
        "aria-label",
        "Respuesta de voz del concierge"
      );
      audioEl.src =
        "data:" + extras.audioMimeType + ";base64," + extras.audioBase64;
      row.appendChild(audioEl);
      audioEl.play().catch(function () {});
    }

    // Inserta la fila antes del indicador de escritura si existe (para mantener el orden visual)
    if (typingEl && typingEl.parentNode === messagesEl) {
      messagesEl.insertBefore(row, typingEl);
    } else {
      // Si no hay indicador visible, añade al final del contenedor
      messagesEl.appendChild(row);
    }
    // Mueve el scroll para que el nuevo contenido sea visible
    scrollMessagesToBottom();
  }

  /**
   * Restaura burbujas desde el servidor (mismo conversationId en localStorage).
   */
  function hydrateHistoryFromServer() {
    if (historyHydrated || historyHydrating || !BACKEND_URL) {
      return;
    }
    if (typeof messagesEl === "undefined" || !messagesEl) {
      return;
    }
    if (messagesEl.querySelector(".amarte-msg")) {
      historyHydrated = true;
      return;
    }
    historyHydrating = true;
    var id = getConversationId();
    fetch(
      BACKEND_URL +
        "/chat/history?conversationId=" +
        encodeURIComponent(id),
      { method: "GET", credentials: "omit" }
    )
      .then(function (res) {
        return res.json().catch(function () {
          return { messages: [] };
        });
      })
      .then(function (data) {
        historyHydrating = false;
        historyHydrated = true;
        if (!data || !Array.isArray(data.messages) || !data.messages.length) {
          ensureWelcomeMessage();
          return;
        }
        if (messagesEl.querySelector(".amarte-msg")) {
          welcomeShown = true;
          return;
        }
        for (var i = 0; i < data.messages.length; i++) {
          var m = data.messages[i];
          if (!m || typeof m.content !== "string" || !m.content.trim()) {
            continue;
          }
          if (m.role === "user") {
            appendMessage("user", m.content, null);
          } else {
            appendMessage(
              "bot",
              m.content,
              Array.isArray(m.options) ? m.options : []
            );
          }
        }
        welcomeShown = true;
        scrollMessagesToBottom();
      })
      .catch(function () {
        historyHydrating = false;
        historyHydrated = true;
        ensureWelcomeMessage();
      });
  }

  /**
   * @param {HTMLElement} selectEl
   * @param {string[]} options
   * @param {string} selected
   */
  function fillSelectOptions(selectEl, options, selected) {
    selectEl.innerHTML = "";
    var empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Selecciona…";
    selectEl.appendChild(empty);
    var list = Array.isArray(options) ? options : [];
    var found = false;
    for (var i = 0; i < list.length; i++) {
      var opt = document.createElement("option");
      opt.value = list[i];
      opt.textContent = list[i];
      if (selected && list[i] === selected) {
        opt.selected = true;
        found = true;
      }
      selectEl.appendChild(opt);
    }
    if (selected && !found) {
      var extra = document.createElement("option");
      extra.value = selected;
      extra.textContent = selected;
      extra.selected = true;
      selectEl.appendChild(extra);
    }
  }

  /**
   * Opciones de hora en HH:MM (24h), una por cada hora — formato que usa el SaaS/BD.
   * @returns {Array<{ value: string, label: string }>}
   */
  function buildReservationHourOptions() {
    var out = [];
    for (var h = 0; h < 24; h++) {
      var hh = (h < 10 ? "0" : "") + h;
      var value = hh + ":00";
      var hour12 = h % 12 === 0 ? 12 : h % 12;
      var period = h < 12 ? "AM" : "PM";
      out.push({
        value: value,
        label: hour12 + ":00 " + period + " (" + value + ")",
      });
    }
    return out;
  }

  /**
   * Normaliza texto de hora (p.ej. "2:00 PM", "14:00") a HH:00 para el select.
   * @param {unknown} raw
   * @returns {string}
   */
  function normalizeReservationHourValue(raw) {
    var t = String(raw || "").trim();
    if (!t) return "";

    var m24 = t.match(/^(\d{1,2}):(\d{2})\s*$/);
    if (m24) {
      var h24 = parseInt(m24[1], 10);
      if (h24 >= 0 && h24 <= 23) {
        return (h24 < 10 ? "0" : "") + h24 + ":00";
      }
      return "";
    }

    var m12 = t.match(
      /^(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)\s*$/i
    );
    if (m12) {
      var hour = parseInt(m12[1], 10);
      if (hour < 1 || hour > 12) return "";
      var period = m12[3].replace(/\./g, "").replace(/\s/g, "").toLowerCase();
      if (period === "am") {
        if (hour === 12) hour = 0;
      } else if (hour !== 12) {
        hour += 12;
      }
      return (hour < 10 ? "0" : "") + hour + ":00";
    }

    return "";
  }

  /**
   * Rellena un select de horas (value HH:MM, label legible).
   * @param {HTMLSelectElement} selectEl
   * @param {string} selectedHhMm
   */
  function fillHourSelectOptions(selectEl, selectedHhMm) {
    selectEl.innerHTML = "";
    var empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Selecciona…";
    selectEl.appendChild(empty);
    var list = buildReservationHourOptions();
    var found = false;
    for (var i = 0; i < list.length; i++) {
      var opt = document.createElement("option");
      opt.value = list[i].value;
      opt.textContent = list[i].label;
      if (selectedHhMm && list[i].value === selectedHhMm) {
        opt.selected = true;
        found = true;
      }
      selectEl.appendChild(opt);
    }
    if (selectedHhMm && !found) {
      var extra = document.createElement("option");
      extra.value = selectedHhMm;
      extra.textContent = selectedHhMm;
      extra.selected = true;
      selectEl.appendChild(extra);
    }
  }

  /**
   * Packs canónicos del formulario (fallback si el config aún no cargó).
   * @returns {string[]}
   */
  function getReservationPackOptions() {
    var packs = reservationFormCatalog.packs;
    if (Array.isArray(packs) && packs.length) {
      return packs.slice();
    }
    return [
      "Pack 4 horas",
      "Pack 6 horas",
      "Pack 8 horas",
      "Pack 12 horas",
      "Día Hotelero",
    ];
  }

  /**
   * Empareja prefill de duración con un pack canónico.
   * @param {unknown} raw
   * @returns {string}
   */
  function matchReservationPackOption(raw) {
    var packs = getReservationPackOptions();
    var t = String(raw || "").trim();
    if (!t) return "";
    var i;
    for (i = 0; i < packs.length; i++) {
      if (packs[i].toLowerCase() === t.toLowerCase()) {
        return packs[i];
      }
    }
    var hourMatch = t.match(/(\d+)\s*h/i);
    if (hourMatch) {
      var target = "Pack " + hourMatch[1] + " horas";
      for (i = 0; i < packs.length; i++) {
        if (packs[i] === target) return packs[i];
      }
    }
    if (/d[ií]a\s*hotelero/i.test(t)) {
      for (i = 0; i < packs.length; i++) {
        if (/d[ií]a\s*hotelero/i.test(packs[i])) return packs[i];
      }
    }
    return "";
  }

  /**
   * Etiqueta corta visible en chips de duración.
   * @param {string} pack
   * @returns {string}
   */
  function formatPackChipLabel(pack) {
    var t = String(pack || "");
    var m = t.match(/^Pack\s+(\d+)\s+horas$/i);
    if (m) return m[1] + " h";
    return t;
  }

  /**
   * @param {HTMLElement} formEl
   * @param {string} name
   * @returns {HTMLInputElement|HTMLSelectElement|null}
   */
  function formControl(formEl, name) {
    return formEl.querySelector('[name="' + name + '"]');
  }

  /** Contador para IDs únicos en formularios de prerreserva (evita choques entre formularios). */
  var reservationFormSeq = 0;

  /**
   * Formulario inline de prerreserva en el hilo del chat.
   * @param {Record<string, string>|null|undefined} prefill
   */
  function appendReservationForm(prefill) {
    if (!messagesEl) return;
    // Cierra formularios previos aún abiertos para no duplicar IDs ni confundir al usuario
    var prevForms = messagesEl.querySelectorAll(".amarte-rsv-form:not(.amarte-done)");
    for (var pf = 0; pf < prevForms.length; pf++) {
      var prev = prevForms[pf];
      var prevRow =
        prev && prev.closest ? prev.closest(".amarte-msg") : null;
      if (prevRow && prevRow.parentNode) {
        prevRow.parentNode.removeChild(prevRow);
      } else if (prev && prev.parentNode) {
        prev.parentNode.removeChild(prev);
      }
    }

    reservationFormSeq += 1;
    var formId = "amarte-rsv-" + reservationFormSeq;
    var data = prefill && typeof prefill === "object" ? prefill : {};
    var row = document.createElement("div");
    row.className = "amarte-msg amarte-msg-bot";

    var form = document.createElement("form");
    form.className = "amarte-rsv-form";
    form.id = formId;
    form.setAttribute("novalidate", "novalidate");
    form.setAttribute("aria-label", "Formulario de prerreserva");

    var title = document.createElement("p");
    title.className = "amarte-rsv-form-title";
    title.textContent = "Completa tu prerreserva";
    form.appendChild(title);

    function fieldId(name) {
      return formId + "-" + name;
    }

    function addField(name, labelText, type, required) {
      var wrap = document.createElement("div");
      wrap.className = "amarte-rsv-field";
      var lab = document.createElement("label");
      lab.setAttribute("for", fieldId(name));
      lab.textContent = labelText + (required ? " *" : "");
      var input = document.createElement("input");
      input.type = type || "text";
      input.name = name;
      input.id = fieldId(name);
      input.autocomplete = "on";
      if (required) input.required = true;
      if (typeof data[name] === "string" && data[name]) {
        input.value = data[name];
      }
      if (name === "precio" && data.precio) {
        input.readOnly = true;
      }
      wrap.appendChild(lab);
      wrap.appendChild(input);
      form.appendChild(wrap);
      return input;
    }

    function addSelect(name, labelText, options) {
      var wrap = document.createElement("div");
      wrap.className = "amarte-rsv-field";
      var lab = document.createElement("label");
      lab.setAttribute("for", fieldId(name));
      lab.textContent = labelText + " *";
      var sel = document.createElement("select");
      sel.name = name;
      sel.id = fieldId(name);
      sel.required = true;
      fillSelectOptions(
        sel,
        options,
        typeof data[name] === "string" ? data[name] : ""
      );
      wrap.appendChild(lab);
      wrap.appendChild(sel);
      form.appendChild(wrap);
      return sel;
    }

    /**
     * Duración visible de una vez (chips), sin abrir un select.
     */
    function addPackChoices() {
      var packs = getReservationPackOptions();
      var selected = matchReservationPackOption(data.pack_tiempo);
      var wrap = document.createElement("div");
      wrap.className = "amarte-rsv-field";
      var lab = document.createElement("div");
      lab.id = fieldId("pack_tiempo-label");
      lab.textContent = "Duración *";
      var group = document.createElement("div");
      group.className = "amarte-rsv-pack-options";
      group.setAttribute("role", "radiogroup");
      group.setAttribute("aria-labelledby", fieldId("pack_tiempo-label"));
      for (var i = 0; i < packs.length; i++) {
        var pack = packs[i];
        var optLab = document.createElement("label");
        optLab.className = "amarte-rsv-pack-opt";
        var radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "pack_tiempo";
        radio.value = pack;
        radio.id = fieldId("pack_tiempo-" + i);
        radio.setAttribute("aria-label", pack);
        if (i === 0) radio.required = true;
        if (selected && pack === selected) radio.checked = true;
        var chip = document.createElement("span");
        chip.textContent = formatPackChipLabel(pack);
        chip.title = pack;
        optLab.appendChild(radio);
        optLab.appendChild(chip);
        group.appendChild(optLab);
      }
      wrap.appendChild(lab);
      wrap.appendChild(group);
      form.appendChild(wrap);
    }

    addField("nombre", "Nombre completo", "text", true);
    addField("documento", "Documento de identidad", "text", true);
    addField("correo", "Correo (opcional)", "email", false);
    addField("whatsapp", "WhatsApp", "tel", true);
    addSelect("tipo", "Suite o plan", reservationFormCatalog.tipos);
    addPackChoices();

    var rowDates = document.createElement("div");
    rowDates.className = "amarte-rsv-row";
    var fechaWrap = document.createElement("div");
    fechaWrap.className = "amarte-rsv-field";
    var fechaLab = document.createElement("label");
    fechaLab.setAttribute("for", fieldId("fecha_reserva"));
    fechaLab.textContent = "Fecha *";
    var fechaInput = document.createElement("input");
    fechaInput.type = "date";
    fechaInput.name = "fecha_reserva";
    fechaInput.id = fieldId("fecha_reserva");
    fechaInput.required = true;
    if (data.fecha_reserva) fechaInput.value = data.fecha_reserva;
    fechaWrap.appendChild(fechaLab);
    fechaWrap.appendChild(fechaInput);
    var horaWrap = document.createElement("div");
    horaWrap.className = "amarte-rsv-field";
    var horaLab = document.createElement("label");
    horaLab.setAttribute("for", fieldId("hora_reserva"));
    horaLab.textContent = "Hora *";
    var horaSelect = document.createElement("select");
    horaSelect.name = "hora_reserva";
    horaSelect.id = fieldId("hora_reserva");
    horaSelect.required = true;
    fillHourSelectOptions(
      horaSelect,
      normalizeReservationHourValue(data.hora_reserva)
    );
    horaWrap.appendChild(horaLab);
    horaWrap.appendChild(horaSelect);
    rowDates.appendChild(fechaWrap);
    rowDates.appendChild(horaWrap);
    form.appendChild(rowDates);

    addField("precio", "Precio cotizado (COP)", "text", true);

    var errEl = document.createElement("p");
    errEl.className = "amarte-rsv-error";
    errEl.setAttribute("role", "alert");
    form.appendChild(errEl);

    var submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.className = "amarte-rsv-submit";
    submitBtn.textContent = "Confirmar prerreserva";
    form.appendChild(submitBtn);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      errEl.classList.remove("amarte-show");
      errEl.textContent = "";

      var nombre = String(formControl(form, "nombre").value || "").trim();
      var documento = String(formControl(form, "documento").value || "").trim();
      var whatsapp = String(formControl(form, "whatsapp").value || "").trim();
      var digits = whatsapp.replace(/\D/g, "");
      if (!nombre) {
        errEl.textContent = "Indica tu nombre completo.";
        errEl.classList.add("amarte-show");
        return;
      }
      if (!documento) {
        errEl.textContent = "Indica tu documento de identidad.";
        errEl.classList.add("amarte-show");
        return;
      }
      if (digits.length < 7) {
        errEl.textContent = "Indica un WhatsApp válido (mín. 7 dígitos).";
        errEl.classList.add("amarte-show");
        return;
      }

      var payload = {
        conversationId: getConversationId(),
        pageUrl: window.location.href || "",
        roomName: document.title || "",
        nombre: nombre,
        whatsapp: whatsapp,
        correo: String(formControl(form, "correo").value || "").trim(),
        documento: documento,
        tipo: String(formControl(form, "tipo").value || "").trim(),
        pack_tiempo: String(
          (
            form.querySelector('input[name="pack_tiempo"]:checked') ||
            formControl(form, "pack_tiempo") ||
            {}
          ).value || ""
        ).trim(),
        fecha_reserva: String(
          formControl(form, "fecha_reserva").value || ""
        ).trim(),
        hora_reserva: String(
          formControl(form, "hora_reserva").value || ""
        ).trim(),
        precio: String(formControl(form, "precio").value || "").trim(),
        abono: "",
      };

      if (
        !payload.tipo ||
        !payload.pack_tiempo ||
        !payload.fecha_reserva ||
        !payload.hora_reserva ||
        !payload.precio
      ) {
        errEl.textContent = "Completa suite, duración, fecha, hora y precio.";
        errEl.classList.add("amarte-show");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Registrando…";

      fetch(BACKEND_URL + "/reservations/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (body) {
            return { res: res, body: body };
          });
        })
        .then(function (result) {
          var body = result.body || {};
          var reply =
            typeof body.reply === "string" && body.reply
              ? body.reply
              : body.error
                ? String(body.error)
                : "No se pudo registrar la prerreserva.";
          var options = Array.isArray(body.options) ? body.options : [];
          if (result.res.ok && body.ok) {
            form.classList.add("amarte-done");
            submitBtn.textContent = "Prerreserva enviada";
            appendMessage("bot", reply, options);
          } else if (result.res.status === 409) {
            form.classList.add("amarte-done");
            submitBtn.textContent = "Ya registrada";
            appendMessage("bot", reply, options);
          } else {
            submitBtn.disabled = false;
            submitBtn.textContent = "Confirmar prerreserva";
            errEl.textContent = body.error || reply;
            errEl.classList.add("amarte-show");
          }
        })
        .catch(function (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Confirmar prerreserva";
          errEl.textContent = "Error de conexión. Inténtalo de nuevo.";
          errEl.classList.add("amarte-show");
          console.error("Amarte reservation form:", err);
        });
    });

    row.appendChild(form);
    if (typingEl && typingEl.parentNode === messagesEl) {
      messagesEl.insertBefore(row, typingEl);
    } else {
      messagesEl.appendChild(row);
    }
    scrollMessagesToBottom();
  }

  /**
   * Tras respuesta del bot: burbuja + formulario si aplica.
   * @param {object} data
   * @param {{audioBase64?: string, audioMimeType?: string}|null} [extras]
   */
  function handleBotChatPayload(data, extras) {
    var reply = typeof data.reply === "string" ? data.reply : "";
    var options = Array.isArray(data.options) ? data.options : [];
    var payloadExtras = extras && typeof extras === "object" ? extras : {};
    if (data.suiteVideo && data.suiteVideo.videoUrl) {
      payloadExtras.suiteVideo = data.suiteVideo;
    }
    appendMessage("bot", reply || " ", options, payloadExtras);
    if (data.showReservationForm) {
      appendReservationForm(data.formPrefill || {});
    } else if (data.showDateTimePicker) {
      appendDateTimePicker();
    }
  }

  /**
   * Selector de fecha / hora / pack inline; al confirmar envía un mensaje de chat.
   */
  function appendDateTimePicker() {
    var existing = messagesEl.querySelector(".amarte-dt-picker");
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    var wrap = document.createElement("div");
    wrap.className = "amarte-dt-picker";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Seleccionar fecha, hora y duración");

    var title = document.createElement("p");
    title.className = "amarte-dt-picker-title";
    title.textContent = "📅 Elige fecha, hora y duración";
    wrap.appendChild(title);

    var errEl = document.createElement("p");
    errEl.className = "amarte-dt-error";
    errEl.style.display = "none";
    wrap.appendChild(errEl);

    var stack = document.createElement("div");
    stack.className = "amarte-dt-stack";

    var fechaField = document.createElement("div");
    fechaField.className = "amarte-dt-field";
    var fechaLab = document.createElement("label");
    fechaLab.setAttribute("for", "amarte-dt-fecha");
    fechaLab.textContent = "Fecha";
    var fechaInput = document.createElement("input");
    fechaInput.type = "date";
    fechaInput.id = "amarte-dt-fecha";
    fechaInput.required = true;
    var bogotaToday = getBogotaReference().referenceDate;
    if (bogotaToday) {
      fechaInput.min = bogotaToday;
      fechaInput.value = bogotaToday;
    }
    fechaField.appendChild(fechaLab);
    fechaField.appendChild(fechaInput);
    stack.appendChild(fechaField);

    var horaField = document.createElement("div");
    horaField.className = "amarte-dt-field";
    var horaLab = document.createElement("label");
    horaLab.textContent = "Hora";
    var timeRow = document.createElement("div");
    timeRow.className = "amarte-dt-time-row";

    var hourSel = document.createElement("select");
    hourSel.setAttribute("aria-label", "Hora");
    for (var h = 1; h <= 12; h++) {
      var ho = document.createElement("option");
      ho.value = String(h);
      ho.textContent = String(h);
      if (h === 2) ho.selected = true;
      hourSel.appendChild(ho);
    }

    var minSel = document.createElement("select");
    minSel.setAttribute("aria-label", "Minutos");
    ["00", "15", "30", "45"].forEach(function (m) {
      var mo = document.createElement("option");
      mo.value = m;
      mo.textContent = m;
      minSel.appendChild(mo);
    });

    var periodSel = document.createElement("select");
    periodSel.setAttribute("aria-label", "AM o PM");
    ["AM", "PM"].forEach(function (p) {
      var po = document.createElement("option");
      po.value = p;
      po.textContent = p;
      if (p === "PM") po.selected = true;
      periodSel.appendChild(po);
    });

    timeRow.appendChild(hourSel);
    timeRow.appendChild(minSel);
    timeRow.appendChild(periodSel);
    horaField.appendChild(horaLab);
    horaField.appendChild(timeRow);
    stack.appendChild(horaField);

    var packField = document.createElement("div");
    packField.className = "amarte-dt-field";
    var packLab = document.createElement("label");
    packLab.setAttribute("for", "amarte-dt-pack");
    packLab.textContent = "Pack de tiempo";
    var packSel = document.createElement("select");
    packSel.id = "amarte-dt-pack";
    packSel.setAttribute("aria-label", "Pack de tiempo");
    packSel.required = true;
    fillSelectOptions(packSel, getReservationPackOptions(), "");
    packField.appendChild(packLab);
    packField.appendChild(packSel);
    stack.appendChild(packField);

    wrap.appendChild(stack);

    var submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "amarte-dt-submit";
    submitBtn.textContent = "Confirmar fecha, hora y duración";
    submitBtn.addEventListener("click", function () {
      errEl.style.display = "none";
      var fecha = String(fechaInput.value || "").trim();
      if (!fecha) {
        errEl.textContent = "Selecciona una fecha.";
        errEl.style.display = "block";
        return;
      }
      var pack = String(packSel.value || "").trim();
      if (!pack) {
        errEl.textContent = "Selecciona un pack de tiempo.";
        errEl.style.display = "block";
        return;
      }
      var hour12 = parseInt(hourSel.value, 10);
      var hora24;
      if (periodSel.value === "AM") {
        hora24 = hour12 === 12 ? 0 : hour12;
      } else {
        hora24 = hour12 === 12 ? 12 : hour12 + 12;
      }
      var horaHhMm =
        (hora24 < 10 ? "0" : "") + hora24 + ":" + minSel.value;
      var horaLabel =
        hourSel.value + ":" + minSel.value + " " + periodSel.value;
      var message =
        "Quiero reservar el " +
        fecha +
        " a las " +
        horaLabel +
        " (" +
        horaHhMm +
        ") con " +
        pack +
        ".";
      if (wrap.parentNode) {
        wrap.parentNode.removeChild(wrap);
      }
      sendUserMessage(message);
    });
    wrap.appendChild(submitBtn);

    messagesEl.appendChild(wrap);
    scrollMessagesToBottom();
  }

  /**
   * Muestra u oculta el indicador de escritura del asistente.
   * @param {boolean} show - true para mostrar, false para ocultar
   */
  /**
   * Envía audio grabado: transcribe, chat y voz de respuesta (solo en este flujo).
   * @param {Blob} blob
   */
  function sendVoiceBlob(blob) {
    var sendBtn = rootEl.querySelector(".amarte-widget-send");
    var micBtn = rootEl.querySelector(".amarte-widget-mic");
    setTyping(true);
    sendBtn.disabled = true;
    micBtn.disabled = true;
    inputEl.disabled = true;

    var roomName = document.title || "";
    var pageUrl = window.location.href || "";

    var fd = new FormData();
    fd.append("audio", blob, "recording.webm");
    fd.append("roomName", roomName);
    fd.append("pageUrl", pageUrl);
    fd.append("conversationId", getConversationId());
    var refAudio = getBogotaReference();
    fd.append("referenceDate", refAudio.referenceDate);
    fd.append("referenceTime", refAudio.referenceTime);
    fd.append("referenceWeekday", refAudio.referenceWeekday);
    fd.append("referenceIso", refAudio.referenceIso);

    fetch(BACKEND_URL + "/chat/audio", {
      method: "POST",
      body: fd,
    })
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            throw new Error(data.error || "Error al procesar el audio");
          }
          return data;
        });
      })
      .then(function (data) {
        setTyping(false);
        var transcript =
          typeof data.transcript === "string" ? data.transcript : "";
        appendMessage("user", transcript || "(Nota de voz)", null);
        var extras = null;
        if (data.audioBase64 && data.audioMimeType) {
          extras = {
            audioBase64: data.audioBase64,
            audioMimeType: data.audioMimeType,
          };
        }
        handleBotChatPayload(data, extras);
      })
      .catch(function (err) {
        setTyping(false);
        appendMessage(
          "bot",
          "No pudimos procesar tu nota de voz. Inténtalo de nuevo o escribe tu mensaje.",
          []
        );
        console.error("Amarte widget voz:", err);
      })
      .finally(function () {
        sendBtn.disabled = false;
        micBtn.disabled = false;
        inputEl.disabled = false;
        inputEl.focus();
      });
  }

  /**
   * Primer clic: grabar. Segundo clic: enviar nota de voz.
   */
  function toggleVoiceRecording() {
    var micBtn = rootEl.querySelector(".amarte-widget-mic");
    var sendBtn = rootEl.querySelector(".amarte-widget-send");
    if (liveState.active) {
      appendMessage(
        "bot",
        "Ahora mismo Martina te escucha en vivo: habla con naturalidad, sin pulsar el micrófono. Usa Finalizar si quieres enviar una nota de voz después.",
        []
      );
      return;
    }
    if (voiceState.recorder && voiceState.recorder.state === "recording") {
      voiceState.recorder.stop();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      appendMessage(
        "bot",
        "Tu navegador no permite grabar audio.",
        []
      );
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(function (stream) {
        voiceState.stream = stream;
        voiceState.chunks = [];
        var mime = "";
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mime = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mime = "audio/webm";
        }
        var rec = new MediaRecorder(
          stream,
          mime ? { mimeType: mime } : undefined
        );
        voiceState.recorder = rec;
        rec.ondataavailable = function (e) {
          if (e.data && e.data.size > 0) {
            voiceState.chunks.push(e.data);
          }
        };
        rec.onstop = function () {
          var blobType = mime || "audio/webm";
          var blob = new Blob(voiceState.chunks, { type: blobType });
          if (voiceState.stream) {
            voiceState.stream.getTracks().forEach(function (t) {
              t.stop();
            });
          }
          voiceState.stream = null;
          voiceState.recorder = null;
          if (voiceState.maxTimer) {
            clearTimeout(voiceState.maxTimer);
            voiceState.maxTimer = null;
          }
          micBtn.classList.remove("amarte-recording");
          sendBtn.disabled = false;
          inputEl.disabled = false;
          if (blob.size > 400) {
            sendVoiceBlob(blob);
          }
        };
        rec.start();
        sendBtn.disabled = true;
        inputEl.disabled = true;
        micBtn.classList.add("amarte-recording");
        voiceState.maxTimer = setTimeout(function () {
          if (
            voiceState.recorder &&
            voiceState.recorder.state === "recording"
          ) {
            voiceState.recorder.stop();
          }
        }, 120000);
      })
      .catch(function (err) {
        appendMessage(
          "bot",
          "No pudimos usar el micrófono. Revisa permisos o que el sitio use HTTPS.",
          []
        );
        console.error(err);
      });
  }

  function setTyping(show) {
    // Si no existe el nodo de typing, sale
    if (!typingEl || !messagesEl) {
      return;
    }
    if (show) {
      // Asegura que el indicador quede al final del área de mensajes
      messagesEl.appendChild(typingEl);
      // Muestra el indicador de escritura
      typingEl.style.display = "block";
      // Al mostrar typing, baja el scroll para ver el indicador
      scrollMessagesToBottom();
    } else {
      // Oculta el indicador de escritura
      typingEl.style.display = "none";
    }
  }

  /**
   * Envía el mensaje del usuario al backend y muestra la respuesta.
   * @param {string} [presetText] - Si se pasa, envía ese texto en lugar del input.
   */
  function sendUserMessage(presetText) {
    // Lee el valor actual del input o el texto prefijado
    var text =
      typeof presetText === "string" && presetText.trim()
        ? presetText.trim()
        : inputEl.value.trim();
    // Si está vacío, no envía
    if (!text) {
      return;
    }
    // Limpia el campo de entrada
    inputEl.value = "";
    // Muestra la burbuja del usuario
    appendMessage("user", text, null);
    // Activa el estado de escritura del bot
    setTyping(true);
    // Deshabilita enviar y micrófono mientras espera respuesta
    var sendBtn = rootEl.querySelector(".amarte-widget-send");
    var micBtn = rootEl.querySelector(".amarte-widget-mic");
    sendBtn.disabled = true;
    micBtn.disabled = true;

    // Título de la página como contexto de habitación/suite
    var roomName = document.title || "";
    // URL completa de la página actual
    var pageUrl = window.location.href || "";
    var refChat = getBogotaReference();

    // Construye la URL del endpoint de chat en el backend
    var url = BACKEND_URL + "/chat";
    // Petición POST con fetch al servidor
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: text,
        roomName: roomName,
        pageUrl: pageUrl,
        conversationId: getConversationId(),
        referenceDate: refChat.referenceDate,
        referenceTime: refChat.referenceTime,
        referenceWeekday: refChat.referenceWeekday,
        referenceIso: refChat.referenceIso,
      }),
    })
      .then(function (res) {
        // Convierte la respuesta HTTP a JSON
        return res.json().then(function (data) {
          // Si el estado no es OK, lanza error con mensaje del servidor o genérico
          if (!res.ok) {
            throw new Error(data.error || "Error al contactar al concierge");
          }
          return data;
        });
      })
      .then(function (data) {
        // Oculta el indicador de escritura
        setTyping(false);
        handleBotChatPayload(data, null);
      })
      .catch(function (err) {
        // Oculta typing en caso de error
        setTyping(false);
        // Muestra mensaje de error amable al usuario
        appendMessage(
          "bot",
          "Lo sentimos, hubo un problema al conectar con el concierge. Inténtelo de nuevo en unos instantes.",
          []
        );
        // Registra el error en consola para depuración
        console.error("Amarte widget:", err);
      })
      .finally(function () {
        sendBtn.disabled = false;
        micBtn.disabled = false;
        inputEl.focus();
      });
  }

  /**
   * Construye el DOM del widget y engancha los eventos.
   */
  function buildWidget() {
    // Contenedor raíz del widget
    rootEl = document.createElement("div");
    rootEl.className = "amarte-widget-root";

    // Lanzador: píldora con título + icono circular
    var launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "amarte-widget-launcher";
    launcher.setAttribute("aria-label", "Pregúntale a Martina — abrir chat Amarte Suite");
    launcher.setAttribute("aria-expanded", "false");

    var launcherLabel = document.createElement("span");
    launcherLabel.className = "amarte-widget-launcher-label";
    launcherLabel.innerHTML = "Pregúntale<br>a Martina";

    var launcherIcon = document.createElement("span");
    launcherIcon.className = "amarte-widget-launcher-icon";
    launcherIcon.setAttribute("aria-hidden", "true");
    launcherIcon.innerHTML =
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
      "</svg>";

    launcher.appendChild(launcherLabel);
    launcher.appendChild(launcherIcon);

    // Panel del chat (inicialmente oculto vía clase)
    var panel = document.createElement("div");
    panel.className = "amarte-widget-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Chat concierge Amarte Suite");

    // Cabecera del panel
    var header = document.createElement("div");
    header.className = "amarte-widget-header";
    var titleWrap = document.createElement("div");
    var title = document.createElement("div");
    title.className = "amarte-widget-title";
    title.textContent = "Amarte Suite";
    var sub = document.createElement("div");
    sub.className = "amarte-widget-sub";
    sub.textContent = "Concierge";
    titleWrap.appendChild(title);
    titleWrap.appendChild(sub);

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "amarte-widget-close";
    closeBtn.setAttribute("aria-label", "Cerrar chat");
    closeBtn.innerHTML = "&times;";
    header.appendChild(titleWrap);
    header.appendChild(closeBtn);

    // Área de mensajes con scroll
    messagesEl = document.createElement("div");
    messagesEl.className = "amarte-widget-messages";

    // Línea de "Escribiendo..." (se inserta al final solo cuando hace falta)
    typingEl = document.createElement("div");
    typingEl.className = "amarte-typing";
    typingEl.textContent = "El concierge está escribiendo…";
    typingEl.style.display = "none";

    // Pie: fila de escritura + accesos rápidos (WhatsApp, Llamar solo móvil, Reservar, PROMOCIONES)
    var footerWrap = document.createElement("div");
    footerWrap.className = "amarte-widget-footer-wrap";

    var footerRow = document.createElement("div");
    footerRow.className = "amarte-widget-footer-row";

    inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.className = "amarte-widget-input";
    inputEl.placeholder = "Escriba su mensaje…";
    inputEl.setAttribute("autocomplete", "off");

    var micBtn = document.createElement("button");
    micBtn.type = "button";
    micBtn.className = "amarte-widget-mic";
    micBtn.setAttribute("aria-label", "Grabar mensaje de voz");
    micBtn.setAttribute("title", "Mensaje de voz");
    micBtn.innerHTML =
      '<svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>' +
      '<path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>' +
      "</svg>";

    var sendBtn = document.createElement("button");
    sendBtn.type = "button";
    sendBtn.className = "amarte-widget-send";
    sendBtn.setAttribute("aria-label", "Enviar");
    sendBtn.innerHTML =
      '<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" ' +
      'stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M5 12h14M13 6l6 6-6 6"/>' +
      "</svg>";

    footerRow.appendChild(inputEl);
    footerRow.appendChild(micBtn);
    footerRow.appendChild(sendBtn);

    var micHint = document.createElement("p");
    micHint.className = "amarte-widget-mic-hint";
    micHint.textContent =
      "Presiona el micrófono para hablar y nuevamente para finalizar";

    var quickRow = document.createElement("div");
    quickRow.className = "amarte-widget-quick-row";

    var urlWa = pickQuickUrl("AMARTE_QUICK_WHATSAPP_URL", DEFAULT_QUICK_WHATSAPP);
    var urlRes = pickQuickUrl("AMARTE_QUICK_RESERVATIONS_URL", DEFAULT_QUICK_RESERVE);
    var urlPromos = pickQuickUrl("AMARTE_PROMOCIONES_URL", DEFAULT_QUICK_PROMOS);
    var urlWompi = pickQuickUrl("AMARTE_QUICK_WOMPI_URL", WOMPI_CHECKOUT_URL);
    var telHref = pickQuickUrl("AMARTE_QUICK_CALL_TEL", DEFAULT_QUICK_TEL);

    quickRow.appendChild(buildQuickLink(urlWa, "💬 WhatsApp", ""));
    var callLink = buildQuickLink(telHref, "📞 Llamar", "amarte-quick-call");
    callLink.setAttribute("aria-label", "Llamar por teléfono");
    quickRow.appendChild(callLink);
    quickRow.appendChild(buildQuickLink(urlRes, "📅 Reservar", ""));
    quickRow.appendChild(buildQuickLink(urlPromos, "🎁 PROMOCIONES", ""));
    quickRow.appendChild(buildQuickLink(urlWompi, "💳 Wompi", ""));

    var liveBtn = document.createElement("button");
    liveBtn.type = "button";
    liveBtn.className = "amarte-live-btn";
    liveBtn.style.display = "none";
    liveBtn.setAttribute("aria-label", "Hablar en vivo con Martina");
    var liveDot = document.createElement("span");
    liveDot.className = "amarte-live-dot";
    liveDot.setAttribute("aria-hidden", "true");
    var liveBtnLabel = document.createElement("span");
    liveBtnLabel.textContent = "Hablar en vivo con Martina";
    liveBtn.appendChild(liveDot);
    liveBtn.appendChild(liveBtnLabel);
    liveState.liveBtn = liveBtn;

    var livePanel = document.createElement("div");
    livePanel.className = "amarte-live-panel";
    livePanel.setAttribute("role", "status");
    livePanel.setAttribute("aria-live", "polite");
    var liveStatus = document.createElement("div");
    liveStatus.className = "amarte-live-status";
    var micInd = document.createElement("span");
    micInd.className = "amarte-live-mic-ind";
    micInd.setAttribute("aria-hidden", "true");
    var statusText = document.createElement("span");
    statusText.className = "amarte-live-status-text";
    statusText.textContent = "Conectando con Martina…";
    liveStatus.appendChild(micInd);
    liveStatus.appendChild(statusText);
    var liveMeta = document.createElement("div");
    liveMeta.className = "amarte-live-meta";
    liveMeta.textContent = "Duración 00:00";
    var liveControls = document.createElement("div");
    liveControls.className = "amarte-live-controls";
    var muteBtn = document.createElement("button");
    muteBtn.type = "button";
    muteBtn.textContent = "Silenciar";
    muteBtn.setAttribute("aria-label", "Silenciar micrófono");
    var unmuteBtn = document.createElement("button");
    unmuteBtn.type = "button";
    unmuteBtn.textContent = "Activar micrófono";
    unmuteBtn.setAttribute("aria-label", "Activar micrófono");
    var endBtn = document.createElement("button");
    endBtn.type = "button";
    endBtn.className = "amarte-live-end";
    endBtn.textContent = "Finalizar";
    endBtn.setAttribute("aria-label", "Finalizar conversación en vivo");
    liveControls.appendChild(muteBtn);
    liveControls.appendChild(unmuteBtn);
    liveControls.appendChild(endBtn);
    livePanel.appendChild(liveStatus);
    livePanel.appendChild(liveMeta);
    livePanel.appendChild(liveControls);
    liveState.statusEl = liveStatus;
    liveState.metaEl = liveMeta;
    liveState.panelEl = livePanel;
    liveState.muteBtn = muteBtn;
    liveState.unmuteBtn = unmuteBtn;
    liveState.endBtn = endBtn;
    updateLiveControlButtons();

    var liveOverlay = document.createElement("div");
    liveOverlay.className = "amarte-live-overlay";
    liveOverlay.setAttribute("role", "dialog");
    liveOverlay.setAttribute("aria-modal", "true");
    liveOverlay.setAttribute("aria-label", "Confirmar conversación en vivo");
    var liveCard = document.createElement("div");
    liveCard.className = "amarte-live-card";
    var liveNotice = document.createElement("p");
    liveNotice.textContent =
      "Martina utilizará el micrófono para mantener una conversación de voz en vivo (máximo 2 minutos). La voz es generada por inteligencia artificial.";
    var liveCardActions = document.createElement("div");
    liveCardActions.className = "amarte-live-card-actions";
    var liveStartBtn = document.createElement("button");
    liveStartBtn.type = "button";
    liveStartBtn.className = "amarte-live-start";
    liveStartBtn.textContent = "Iniciar conversación";
    liveStartBtn.setAttribute("aria-label", "Iniciar conversación en vivo");
    var liveCancelBtn = document.createElement("button");
    liveCancelBtn.type = "button";
    liveCancelBtn.className = "amarte-live-cancel";
    liveCancelBtn.textContent = "Cancelar";
    liveCancelBtn.setAttribute("aria-label", "Cancelar conversación en vivo");
    liveCardActions.appendChild(liveCancelBtn);
    liveCardActions.appendChild(liveStartBtn);
    liveCard.appendChild(liveNotice);
    liveCard.appendChild(liveCardActions);
    liveOverlay.appendChild(liveCard);
    liveState.overlayEl = liveOverlay;

    footerWrap.appendChild(footerRow);
    footerWrap.appendChild(micHint);
    footerWrap.appendChild(liveBtn);
    footerWrap.appendChild(livePanel);
    footerWrap.appendChild(quickRow);

    panel.appendChild(header);
    panel.appendChild(messagesEl);
    panel.appendChild(footerWrap);
    panel.appendChild(liveOverlay);

    messagesEl.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t) return;
      var btn =
        t.closest &&
        (t.closest(".amarte-suite-video-btn") ||
          t.closest(".amarte-suite-video-cta"));
      if (btn) {
        ev.preventDefault();
        openSuiteVideoModal({
          videoUrl: btn.getAttribute("data-amarte-video-url") || "",
          title: btn.getAttribute("data-amarte-video-title") || "",
        });
        return;
      }
      var link = t.closest && t.closest("a.amarte-inline-link");
      if (link && link.href) {
        var suite = findSuiteVideoByProductUrl(link.href);
        if (suite) {
          ev.preventDefault();
          openSuiteVideoModal({
            videoUrl: suite.videoUrl,
            title: suite.title,
          });
        }
      }
    });

    rootEl.appendChild(launcher);
    rootEl.appendChild(panel);
    document.body.appendChild(rootEl);

    function togglePanel() {
      var isOpen = panel.classList.toggle("amarte-open");
      rootEl.classList.toggle("amarte-chat-open", isOpen);
      launcher.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (isOpen) {
        hydrateHistoryFromServer();
        inputEl.focus();
        scrollMessagesToBottom();
      }
    }

    launcher.addEventListener("click", function () {
      togglePanel();
    });
    closeBtn.addEventListener("click", function () {
      panel.classList.remove("amarte-open");
      rootEl.classList.remove("amarte-chat-open");
      launcher.setAttribute("aria-expanded", "false");
      if (liveState.active) {
        endLiveSession("panel_closed");
      }
      closeLiveConsent();
    });
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendUserMessage();
      }
    });
    sendBtn.addEventListener("click", function () {
      sendUserMessage();
    });
    micBtn.addEventListener("click", function () {
      toggleVoiceRecording();
    });

    liveBtn.addEventListener("click", function () {
      if (LIVE_VOICE_COMING_SOON || liveState.active) return;
      openLiveConsent();
      liveStartBtn.focus();
    });
    liveCancelBtn.addEventListener("click", function () {
      closeLiveConsent();
    });
    liveStartBtn.addEventListener("click", function () {
      beginLiveConversation();
    });
    liveOverlay.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeLiveConsent();
      }
    });
    muteBtn.addEventListener("click", function () {
      if (!window.VoiceAgentManager) return;
      window.VoiceAgentManager.mute();
      liveState.muted = true;
      setLiveUiStatus("muted");
      updateLiveControlButtons();
    });
    unmuteBtn.addEventListener("click", function () {
      if (!window.VoiceAgentManager) return;
      window.VoiceAgentManager.unmute();
      liveState.muted = false;
      setLiveUiStatus("listening");
      updateLiveControlButtons();
    });
    endBtn.addEventListener("click", function () {
      endLiveSession("user");
    });

    initLiveVoiceFeature();

    /**
     * API pública para embeds React/Vite (CTA del sitio, no solo el launcher).
     * openLive() debe llamarse en el mismo gesto de clic del usuario (micrófono).
     */
    window.AmarteChatbot = {
      openChat: function (initialMessage) {
        if (!panel.classList.contains("amarte-open")) {
          panel.classList.add("amarte-open");
          rootEl.classList.add("amarte-chat-open");
          launcher.setAttribute("aria-expanded", "true");
        }
        hydrateHistoryFromServer();
        // Si el historial ya se resolvió vacío (o falló), saluda al abrir.
        if (historyHydrated && !historyHydrating) {
          ensureWelcomeMessage();
        }
        inputEl.focus();
        scrollMessagesToBottom();
        var msg = initialMessage != null ? String(initialMessage).trim() : "";
        if (msg) {
          inputEl.value = msg;
          sendUserMessage();
        }
      },
      openLive: function () {
        // Temporalmente desactivado: abre chat de texto en su lugar.
        if (LIVE_VOICE_COMING_SOON) {
          window.AmarteChatbot.openChat();
          return;
        }
        if (liveState.active) return;
        if (!panel.classList.contains("amarte-open")) {
          panel.classList.add("amarte-open");
          rootEl.classList.add("amarte-chat-open");
          launcher.setAttribute("aria-expanded", "true");
        }
        hydrateHistoryFromServer();
        // Mismo gesto de usuario: iniciar en vivo sin segundo clic de consentimiento.
        beginLiveConversation();
      },
      close: function () {
        panel.classList.remove("amarte-open");
        rootEl.classList.remove("amarte-chat-open");
        launcher.setAttribute("aria-expanded", "false");
        if (liveState.active) {
          endLiveSession("api_close");
        }
        closeLiveConsent();
      },
    };

    // Precarga historial en segundo plano tras montar el DOM del widget
    hydrateHistoryFromServer();
  }

  /**
   * Punto de entrada: inyecta estilos, construye el widget cuando el DOM está listo.
   */
  function init() {
    injectStyles();
    buildWidget();
  }

  // Si el documento ya está cargado, inicializa de inmediato
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();