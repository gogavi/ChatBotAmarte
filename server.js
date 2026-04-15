// Carga variables de entorno desde el archivo .env antes de leer process.env
require("dotenv").config();

// Importa express para crear el servidor HTTP y definir rutas
const express = require("express");
// Importa middleware CORS para restringir el origen de las peticiones del navegador
const cors = require("cors");
// Importa el cliente oficial de OpenAI para llamar a la API de chat
const OpenAI = require("openai");

// Lee el puerto desde variables de entorno o usa 3000 por defecto
const PORT = process.env.PORT || 3000;
// Crea la instancia de la aplicación Express
const app = express();

// Middleware: permite que Express interprete el cuerpo JSON de las peticiones POST
app.use(express.json());

// Middleware CORS: solo permite peticiones desde el dominio de producción de Amarte Suite
app.use(
  cors({
    origin: ["https://amartesuite.com", "https://www.amartesuite.com"],
    methods: ["GET", "POST"],
    credentials: true
  })
);

// Middleware: sirve archivos estáticos desde la carpeta public (por ejemplo amarte-widget.js)
app.use(express.static("public"));

// Crea el cliente de OpenAI usando la clave definida en OPENAI_API_KEY
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Separa el texto visible para el usuario y el bloque de opciones estructuradas.
 * @param {string} rawText - Texto completo devuelto por el modelo
 * @returns {{ reply: string, options: Array<{ label: string, url: string }> }}
 */
function parseAssistantReply(rawText) {
  // Si no hay texto, devolvemos respuesta vacía y sin opciones
  if (!rawText || typeof rawText !== "string") {
    return { reply: "", options: [] };
  }
  // Marca de inicio del bloque de opciones que el modelo debe incluir
  const startTag = "[OPTIONS]";
  // Marca de fin del bloque de opciones
  const endTag = "[/OPTIONS]";
  // Índice donde comienza el bloque de opciones en el texto
  const startIdx = rawText.indexOf(startTag);
  // Índice donde termina el bloque de opciones en el texto
  const endIdx = rawText.indexOf(endTag);
  // Si no hay bloque completo de opciones, devolvemos todo el texto como reply
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return { reply: rawText.trim(), options: [] };
  }
  // Extrae la parte antes del bloque de opciones como mensaje visible
  const reply = rawText.slice(0, startIdx).trim();
  // Extrae el JSON interno entre las etiquetas de opciones
  const jsonSlice = rawText.slice(startIdx + startTag.length, endIdx).trim();
  // Intenta parsear el JSON de opciones
  try {
    // Convierte el texto JSON en un array de JavaScript
    const parsed = JSON.parse(jsonSlice);
    // Verifica que sea un array para usarlo como lista de botones
    if (!Array.isArray(parsed)) {
      return { reply: reply || rawText.trim(), options: [] };
    }
    // Normaliza cada elemento a { label, url } solo si tienen ambos campos
    const options = parsed
      .filter(
        (item) =>
          item &&
          typeof item.label === "string" &&
          typeof item.url === "string"
      )
      .map((item) => ({ label: item.label, url: item.url }));
    return { reply: reply || rawText.trim(), options };
  } catch {
    // Si el JSON es inválido, devolvemos reply sin opciones
    return { reply: reply || rawText.trim(), options: [] };
  }
}

// Ruta POST /chat: recibe el mensaje del usuario y contexto de la página
app.post("/chat", async (req, res) => {
  try {
    // Extrae campos del cuerpo JSON de la petición
    const { message, roomName, pageUrl } = req.body || {};
    // Valida que exista un mensaje de usuario (no vacío)
    if (!message || typeof message !== "string" || !message.trim()) {
      // Responde con error 400 si falta el mensaje
      return res.status(400).json({ error: "El campo message es obligatorio" });
    }
    // Verifica que la clave de OpenAI esté configurada en el entorno
    if (!process.env.OPENAI_API_KEY) {
      // Responde con error 500 si falta configuración
      return res.status(500).json({ error: "El servidor no está configurado correctamente" });
    }
    // Texto seguro para nombre de habitación o página (fallback vacío)
    const safeRoom =
      typeof roomName === "string" && roomName.trim() ? roomName.trim() : "sin especificar";
    // Texto seguro para URL de página (fallback vacío)
    const safePage =
      typeof pageUrl === "string" && pageUrl.trim() ? pageUrl.trim() : "sin especificar";
    // Construye el prompt de sistema con el contexto solicitado
    const systemPrompt =
  `Eres el concierge de lujo de Amarte Suite. Eres elegante, servicial y persuasivo. 
  El cliente está viendo la suite: ${safeRoom}. 
  La página actual es: ${safePage}. 
  
  REGLAS DE ORO:
  1. Si el cliente quiere reservar, ofrece el botón de "Reservar en Línea".
  2. Si tiene dudas complejas, ofrece el botón de "Hablar por WhatsApp".
  3. No menciones que eres una IA a menos que te pregunten directamente.
  4. Mantén tus respuestas breves (máximo 3 frases) para que se lean bien en móviles.

  IMPORTANTE: Al final de cada respuesta, incluye SIEMPRE el bloque [OPTIONS] con este formato:
  [OPTIONS]
  [
    {"label": "📅 Reservar ahora", "url": "https://amartesuite.com/reservas"},
    {"label": "💬 WhatsApp Directo", "url": "https://wa.me/573007416683"}
  ]
  [/OPTIONS]`;

    // Llama al modelo de chat de OpenAI con mensajes de sistema y usuario
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message.trim() },
      ],
    });
    // Obtiene el texto de la primera opción de la respuesta del modelo
    const rawText = completion.choices[0]?.message?.content ?? "";
    // Separa el texto visible y las opciones estructuradas
    const { reply, options } = parseAssistantReply(rawText);
    // Log para depuración (ayuda mucho en Railway)
    console.log(`IA respondió a ${safeRoom}: ${options.length} botones generados.`);
    // Devuelve JSON con reply y options al cliente
    return res.json({ reply, options });
  } catch (err) {
    // Registra el error en consola para depuración en servidor
    console.error("Error en /chat:", err);
    // Devuelve error genérico al cliente sin filtrar detalles internos
    return res.status(500).json({ error: "No se pudo procesar la conversación" });
  }
});

// Inicia el servidor escuchando en el puerto configurado
app.listen(PORT, () => {
  // Mensaje de confirmación en consola
  console.log(`Servidor Amarte escuchando en http://localhost:${PORT}`);
});
