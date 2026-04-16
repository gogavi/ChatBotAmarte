const fs = require("fs");
const path = require("path");

/** Límite para proteger tokens del modelo si el Markdown crece demasiado. */
const MAX_CHARS = 12000;

let warnedMissing = false;
let warnedTruncated = false;

function getMemoriaPath() {
  const fromEnv = process.env.MARTINA_MEMORIA_PATH;
  if (fromEnv && String(fromEnv).trim()) {
    return path.resolve(String(fromEnv).trim());
  }
  return path.join(__dirname, "memoria.md");
}

/**
 * Lee el Markdown de memoria operativa para inyectar en el system prompt.
 * @returns {string} Contenido recortado o cadena vacía si no hay archivo.
 */
function loadMartinaMemoriaForPrompt() {
  const filePath = getMemoriaPath();
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const trimmed = raw.trim();
    if (trimmed.length > MAX_CHARS) {
      if (!warnedTruncated) {
        console.warn(
          `[memoria] Contenido truncado a ${MAX_CHARS} caracteres (${filePath})`
        );
        warnedTruncated = true;
      }
      return trimmed.slice(0, MAX_CHARS);
    }
    return trimmed;
  } catch (e) {
    if (!warnedMissing) {
      console.warn("[memoria] No se pudo cargar memoria operativa:", e.message);
      warnedMissing = true;
    }
    return "";
  }
}

module.exports = { loadMartinaMemoriaForPrompt, getMemoriaPath };
