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

  // Referencia al contenedor raíz del widget (se asigna al crear el DOM)
  var rootEl = null;
  // Referencia al panel de mensajes con scroll
  var messagesEl = null;
  // Referencia al campo de texto del usuario
  var inputEl = null;
  // Referencia al elemento que muestra "Escribiendo..."
  var typingEl = null;

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
      "min-height:48px;padding:12px 22px;border-radius:8px;border:none;cursor:pointer;" +
      "background:linear-gradient(135deg,#E91E63,#D81B60 55%,#AD1457);color:#ffffff;" +
      "font-size:0.95rem;font-weight:600;letter-spacing:0.02em;white-space:nowrap;" +
      "box-shadow:0 8px 24px rgba(216,27,96,0.35);z-index:99998;display:flex;align-items:center;justify-content:center;" +
      "transition:transform 0.2s ease,box-shadow 0.2s ease,background 0.2s ease;}" +
      "@media (max-width:400px){.amarte-widget-bubble{font-size:0.85rem;padding:10px 16px;white-space:normal;text-align:center;max-width:calc(100vw - 32px);}}" +
      ".amarte-widget-bubble:hover{transform:translateX(-50%) scale(1.03);" +
      "box-shadow:0 12px 32px rgba(26,26,61,0.35);background:linear-gradient(135deg,#1A1A3D,#2a2a52);color:#ffffff;}" +
      ".amarte-widget-panel{position:fixed;left:50%;bottom:96px;width:min(380px,calc(100vw - 32px));" +
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
      ".amarte-widget-footer{display:flex;gap:8px;padding:12px;border-top:1px solid #eee;background:#fff;}" +
      ".amarte-widget-input{flex:1;border:1px solid #ccc;border-radius:999px;padding:10px 14px;font-size:0.95rem;outline:none;}" +
      ".amarte-widget-input:focus{border-color:#D81B60;}" +
      ".amarte-widget-send{background:#1A1A3D;color:#fff;border:none;border-radius:999px;padding:10px 18px;cursor:pointer;font-weight:600;}" +
      ".amarte-widget-send:hover{background:#2a2a52;}" +
      ".amarte-widget-send:disabled{opacity:0.5;cursor:not-allowed;}";

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
   */
  function appendMessage(role, text, options) {
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
    // Deshabilita el botón de enviar mientras espera respuesta
    var sendBtn = rootEl.querySelector(".amarte-widget-send");
    sendBtn.disabled = true;

    // Título de la página como contexto de habitación/suite
    var roomName = document.title || "";
    // URL completa de la página actual
    var pageUrl = window.location.href || "";

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
        // Vuelve a habilitar el botón de enviar
        sendBtn.disabled = false;
        // Devuelve el foco al campo de texto
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

    // Pie con input y enviar
    var footer = document.createElement("div");
    footer.className = "amarte-widget-footer";
    inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.className = "amarte-widget-input";
    inputEl.placeholder = "Escriba su mensaje…";
    inputEl.setAttribute("autocomplete", "off");

    var sendBtn = document.createElement("button");
    sendBtn.type = "button";
    sendBtn.className = "amarte-widget-send";
    sendBtn.textContent = "Enviar";

    footer.appendChild(inputEl);
    footer.appendChild(sendBtn);

    panel.appendChild(header);
    panel.appendChild(messagesEl);
    panel.appendChild(footer);

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
