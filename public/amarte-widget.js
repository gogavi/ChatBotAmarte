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
  var DEFAULT_QUICK_WHATSAPP = "https://wa.me/573007416683";
  var DEFAULT_QUICK_RESERVE = "https://amartesuite.com/suites/";
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
      ".amarte-widget-bubble{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);" +
      "min-height:72px;padding:18px 28px;border-radius:10px;border:none;cursor:pointer;" +
      "background:linear-gradient(135deg,#E91E63,#D81B60 55%,#AD1457);color:#ffffff;" +
      "font-size:1.9rem;font-weight:600;letter-spacing:0.02em;white-space:nowrap;" +
      "box-shadow:0 8px 24px rgba(216,27,96,0.35);z-index:99998;display:flex;align-items:center;justify-content:center;" +
      "transition:transform 0.2s ease,box-shadow 0.2s ease,background 0.2s ease;}" +
      ".amarte-widget-bubble:hover{transform:translateX(-50%) scale(1.03);" +
      "box-shadow:0 12px 32px rgba(26,26,61,0.35);background:linear-gradient(135deg,#1A1A3D,#2a2a52);color:#ffffff;}" +
      ".amarte-widget-panel{position:fixed;left:50%;bottom:140px;width:min(380px,calc(100vw - 32px));" +
      "max-height:min(560px,calc(100vh - 120px));background:#ffffff;border:1px solid #e8e8e8;" +
      "border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,0.18);z-index:99999;display:flex;flex-direction:column;" +
      "overflow:hidden;opacity:0;transform:translate(-50%,12px) scale(0.98);pointer-events:none;" +
      "transition:opacity 0.25s ease,transform 0.25s ease;}" +
      ".amarte-widget-panel.amarte-open{opacity:1;transform:translate(-50%,0) scale(1);pointer-events:auto;}" +
      ".amarte-widget-header{background:linear-gradient(90deg,#1A1A3D,#2a2a52);color:#fff;padding:16px 18px;" +
      "display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #D81B60;}" +
      ".amarte-widget-title{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:1.1rem;font-weight:600;letter-spacing:0.02em;}" +
      ".amarte-widget-sub{color:rgba(255,255,255,0.88);font-size:0.75rem;margin-top:4px;}" +
      ".amarte-widget-close{background:transparent;border:none;color:#fff;cursor:pointer;padding:4px;line-height:1;}" +
      ".amarte-widget-messages{flex:1;overflow-y:auto;padding:16px;background:#fafafa;min-height:200px;}" +
      ".amarte-msg{margin-bottom:12px;display:flex;flex-direction:column;align-items:flex-start;}" +
      ".amarte-msg-user{align-items:flex-end;}" +
      ".amarte-bubble-inner{max-width:85%;padding:10px 14px;border-radius:14px;font-size:0.95rem;line-height:1.45;}" +
      ".amarte-msg-bot .amarte-bubble-inner{background:#fff;border:1px solid #e0e0e0;color:#1a1a1a;}" +
      ".amarte-msg-user .amarte-bubble-inner{background:linear-gradient(145deg,#E91E63,#D81B60);color:#ffffff;}" +
      ".amarte-typing{font-size:0.85rem;color:#666;font-style:italic;padding:4px 0 8px;}" +
      ".amarte-options{margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;}" +
      ".amarte-opt-link{display:inline-block;padding:8px 12px;border-radius:999px;border:1px solid #D81B60;" +
      "color:#1A1A3D;text-decoration:none;font-size:0.85rem;background:#fff;transition:background 0.2s,color 0.2s;}" +
      ".amarte-opt-link:hover{background:#D81B60;color:#ffffff;}" +
      ".amarte-widget-footer-wrap{flex-shrink:0;display:flex;flex-direction:column;border-top:1px solid #eee;background:#fff;}" +
      ".amarte-widget-footer-row{display:flex;gap:8px;padding:12px 12px 8px;background:#fff;align-items:center;}" +
      ".amarte-widget-quick-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:0 12px 12px;background:#fff;}" +
      ".amarte-widget-quick-row .amarte-opt-link{text-align:center;}" +
      "@media (min-width:769px){.amarte-quick-call{display:none !important;}}" +
      ".amarte-widget-input{flex:1;border:1px solid #ccc;border-radius:999px;padding:10px 14px;font-size:0.95rem;outline:none;}" +
      ".amarte-widget-input:focus{border-color:#D81B60;}" +
      ".amarte-widget-mic{background:#fff;color:#1A1A3D;border:2px solid #D81B60;border-radius:999px;" +
      "padding:10px 14px;cursor:pointer;font-weight:600;flex-shrink:0;font-size:0.9rem;line-height:1;}" +
      ".amarte-widget-mic:hover{background:#fafafa;}" +
      ".amarte-widget-mic:disabled{opacity:0.5;cursor:not-allowed;}" +
      ".amarte-widget-mic.amarte-recording{background:#E91E63;color:#fff;border-color:#AD1457;}" +
      ".amarte-widget-audio{width:100%;max-width:100%;margin-top:8px;height:40px;}" +
      ".amarte-widget-send{background:#1A1A3D;color:#fff;border:none;border-radius:999px;padding:10px 18px;cursor:pointer;font-weight:600;}" +
      ".amarte-widget-send:hover{background:#2a2a52;}" +
      ".amarte-widget-send:disabled{opacity:0.5;cursor:not-allowed;}" +
      "@media (max-width:768px){.amarte-widget-bubble{min-height:44px;padding:8px 14px;font-size:0.95rem;" +
      "letter-spacing:0.01em;white-space:normal;text-align:center;line-height:1.25;max-width:min(92vw,280px);" +
      "bottom:calc(16px + env(safe-area-inset-bottom,0px));border-radius:8px;box-shadow:0 4px 16px rgba(216,27,96,0.3);}" +
      ".amarte-widget-panel{bottom:calc(100px + env(safe-area-inset-bottom,0px));}}" +
      "@media (min-width:769px){.amarte-widget-panel{width:min(520px,calc(100vw - 48px));" +
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
    // Asigna el texto del mensaje de forma segura (solo texto, sin HTML)
    bubble.textContent = text;
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

    // Botón flotante (burbuja) para abrir/cerrar
    var bubble = document.createElement("button");
    bubble.type = "button";
    bubble.className = "amarte-widget-bubble";
    bubble.setAttribute("aria-label", "Pregúntale a Martina — abrir chat Amarte Suite");
    bubble.textContent = "Pregúntale a Martina";

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
    micBtn.textContent = "🎤";

    var sendBtn = document.createElement("button");
    sendBtn.type = "button";
    sendBtn.className = "amarte-widget-send";
    sendBtn.textContent = "Enviar";

    footerRow.appendChild(inputEl);
    footerRow.appendChild(micBtn);
    footerRow.appendChild(sendBtn);

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
    footerWrap.appendChild(quickRow);

    panel.appendChild(header);
    panel.appendChild(messagesEl);
    panel.appendChild(footerWrap);

    rootEl.appendChild(bubble);
    rootEl.appendChild(panel);
    document.body.appendChild(rootEl);

    // Alterna la clase que abre/cierra el panel
    function togglePanel() {
      var isOpen = panel.classList.toggle("amarte-open");
      bubble.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (isOpen) {
        inputEl.focus();
        scrollMessagesToBottom();
      }
    }

    // Click en burbuja: abre o cierra
    bubble.addEventListener("click", function () {
      togglePanel();
    });
    // Click en cerrar: quita clase abierta
    closeBtn.addEventListener("click", function () {
      panel.classList.remove("amarte-open");
      bubble.setAttribute("aria-expanded", "false");
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