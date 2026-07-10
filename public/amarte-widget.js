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
  var DEFAULT_QUICK_RESERVE = "https://amartesuite.com/formulario-reservas-amarte-suite/";
  var DEFAULT_QUICK_PROMOS = "https://amartesuite.com/suite-jacuzzi-mejor-precio/";
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
          var safeUrl = normalizeWompiCheckoutUrl(u);
          var tail = full.slice(u.length);
          return (
            '<a href="' +
            attrEncode(safeUrl) +
            '" class="amarte-inline-link" target="_blank" rel="noopener noreferrer">' +
            safeUrl +
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
    // Enlaces Markdown [etiqueta](https://...)
    t = t.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      function (_, label, url) {
        var safeUrl = isWompiCheckoutLabel(label)
          ? WOMPI_CHECKOUT_URL
          : normalizeWompiCheckoutUrl(url);
        return (
          '<a href="' +
          attrEncode(safeUrl) +
          '" class="amarte-inline-link" target="_blank" rel="noopener noreferrer">' +
          label +
          "</a>"
        );
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
      ".amarte-widget-root{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}" +
      ".amarte-widget-launcher{position:fixed;right:24px;left:auto;bottom:calc(24px + env(safe-area-inset-bottom,0px));" +
      "display:flex;align-items:center;gap:10px;padding:8px 8px 8px 18px;border:none;border-radius:999px;" +
      "background:#D81B60;color:#ffffff;cursor:pointer;z-index:99998;" +
      "font-size:0.95rem;font-weight:600;letter-spacing:0.01em;white-space:nowrap;" +
      "box-shadow:0 8px 24px rgba(216,27,96,0.35);" +
      "transition:opacity 0.25s ease,visibility 0.25s ease,transform 0.25s ease,box-shadow 0.2s ease;}" +
      ".amarte-widget-launcher:hover{transform:scale(1.02);box-shadow:0 12px 32px rgba(216,27,96,0.45);}" +
      ".amarte-widget-launcher-label{line-height:1.2;}" +
      ".amarte-widget-launcher-icon{width:44px;height:44px;border-radius:50%;flex-shrink:0;" +
      "background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;}" +
      ".amarte-widget-root.amarte-chat-open .amarte-widget-launcher{opacity:0;visibility:hidden;pointer-events:none;transform:scale(0.92);}" +
      ".amarte-widget-panel{position:fixed;right:24px;left:auto;bottom:96px;width:min(380px,calc(100vw - 32px));" +
      "max-height:min(560px,calc(100vh - 120px));background:rgba(255,255,255,0.75);border:1px solid #fff;" +
      "border-radius:25px;box-shadow:0 12px 40px rgba(0,0,0,0.1);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px);" +
      "z-index:99999;display:flex;flex-direction:column;overflow:hidden;opacity:0;" +
      "transform:translateY(12px) scale(0.98);pointer-events:none;" +
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
      ".amarte-msg-bot .amarte-bubble-inner{background:#fff;border:1px solid #e0e0e0;color:#1a1a1a;}" +
      ".amarte-msg-user .amarte-bubble-inner{background:linear-gradient(145deg,#E91E63,#D81B60);color:#ffffff;}" +
      ".amarte-typing{font-size:0.85rem;color:#666;font-style:italic;padding:4px 0 8px;}" +
      ".amarte-options{margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;}" +
      ".amarte-opt-link{display:inline-block;padding:10px 16px;border-radius:30px;border:none;" +
      "color:#fff;text-decoration:none;font-size:0.85rem;font-weight:600;background:#D81B60;" +
      "transition:background 0.2s ease,transform 0.15s ease;}" +
      ".amarte-opt-link:hover{background:#AD1457;color:#fff;}" +
      ".amarte-widget-footer-wrap{flex-shrink:0;display:flex;flex-direction:column;background:transparent;}" +
      ".amarte-widget-footer-row{display:flex;gap:8px;padding:12px 16px 8px;background:transparent;align-items:center;}" +
      ".amarte-widget-mic-hint{margin:0;padding:0 16px 8px;font-size:0.75rem;line-height:1.35;" +
      "color:rgba(0,0,0,0.55);text-align:center;}" +
      ".amarte-widget-quick-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;" +
      "padding:0 16px 16px;background:transparent;margin-top:4px;}" +
      ".amarte-widget-quick-row .amarte-opt-link{text-align:center;}" +
      "@media (min-width:769px){.amarte-quick-call{display:none !important;}}" +
      ".amarte-widget-input{flex:1;border:1px solid rgba(0,0,0,0.12);border-radius:999px;" +
      "padding:12px 16px;font-size:0.95rem;outline:none;background:rgba(255,255,255,0.9);box-shadow:none;}" +
      ".amarte-widget-input:focus{border-color:#D81B60;}" +
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
      "@media (max-width:768px){.amarte-widget-launcher{right:16px;font-size:0.82rem;padding:6px 6px 6px 14px;" +
      "bottom:calc(16px + env(safe-area-inset-bottom,0px));max-width:min(92vw,320px);}" +
      ".amarte-widget-launcher-icon{width:40px;height:40px;}" +
      ".amarte-widget-launcher-icon svg{width:20px;height:20px;}" +
      ".amarte-widget-panel{right:16px;bottom:calc(80px + env(safe-area-inset-bottom,0px));}}" +
      "@media (min-width:769px){.amarte-widget-panel{width:min(420px,calc(100vw - 48px));" +
      "max-height:min(720px,calc(100vh - 140px));}.amarte-widget-messages{min-height:320px;}}";

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

    // Si hay opciones y es mensaje del bot, crea enlaces debajo
    if (role === "bot" && options && options.length) {
      var optsWrap = document.createElement("div");
      optsWrap.className = "amarte-options";
      for (var i = 0; i < options.length; i++) {
        var opt = options[i];
        if (!opt || !opt.label || !opt.url) {
          continue;
        }
        var a = document.createElement("a");
        a.className = "amarte-opt-link";
        a.href = opt.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = opt.label;
        optsWrap.appendChild(a);
      }
      row.appendChild(optsWrap);
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
        var reply = typeof data.reply === "string" ? data.reply : "";
        var options = Array.isArray(data.options) ? data.options : [];
        var extras = null;
        if (data.audioBase64 && data.audioMimeType) {
          extras = {
            audioBase64: data.audioBase64,
            audioMimeType: data.audioMimeType,
          };
        }
        appendMessage("bot", reply || " ", options, extras);
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
   */
  function sendUserMessage() {
    // Lee el valor actual del input
    var text = inputEl.value.trim();
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
        // Extrae texto de respuesta o cadena vacía
        var reply = typeof data.reply === "string" ? data.reply : "";
        // Extrae array de opciones o lista vacía
        var options = Array.isArray(data.options) ? data.options : [];
        // Muestra mensaje del bot con enlaces opcionales
        appendMessage("bot", reply || " ", options);
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
    launcherLabel.textContent = "Pregúntale a Martina";

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
    var telHref = pickQuickUrl("AMARTE_QUICK_CALL_TEL", DEFAULT_QUICK_TEL);

    quickRow.appendChild(buildQuickLink(urlWa, "WhatsApp", ""));
    var callLink = buildQuickLink(telHref, "Llamar", "amarte-quick-call");
    callLink.setAttribute("aria-label", "Llamar por teléfono");
    quickRow.appendChild(callLink);
    quickRow.appendChild(buildQuickLink(urlRes, "Reservar", ""));
    quickRow.appendChild(buildQuickLink(urlPromos, "PROMOCIONES", ""));

    footerWrap.appendChild(footerRow);
    footerWrap.appendChild(micHint);
    footerWrap.appendChild(quickRow);

    panel.appendChild(header);
    panel.appendChild(messagesEl);
    panel.appendChild(footerWrap);

    rootEl.appendChild(launcher);
    rootEl.appendChild(panel);
    document.body.appendChild(rootEl);

    // Alterna la clase que abre/cierra el panel
    function togglePanel() {
      var isOpen = panel.classList.toggle("amarte-open");
      rootEl.classList.toggle("amarte-chat-open", isOpen);
      launcher.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (isOpen) {
        inputEl.focus();
        scrollMessagesToBottom();
      }
    }

    // Click en lanzador: abre o cierra
    launcher.addEventListener("click", function () {
      togglePanel();
    });
    // Click en cerrar: quita clase abierta
    closeBtn.addEventListener("click", function () {
      panel.classList.remove("amarte-open");
      rootEl.classList.remove("amarte-chat-open");
      launcher.setAttribute("aria-expanded", "false");
    });
    // Enter en el input envía mensaje
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendUserMessage();
      }
    });
    // Click en enviar
    sendBtn.addEventListener("click", function () {
      sendUserMessage();
    });
    // Micrófono: grabar / detener y enviar
    micBtn.addEventListener("click", function () {
      toggleVoiceRecording();
    });
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