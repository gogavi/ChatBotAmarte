const { suiteCategories } = require("./amarteCatalog");

/**
 * Rutas de fichas de suite (pathname sin barra final), ordenadas de más larga a más corta
 * para que coincidan primero las URLs más específicas.
 */
function buildPathHints() {
  const hints = [];
  for (const cat of suiteCategories) {
    for (const s of cat.suites) {
      try {
        const u = new URL(s.url);
        const path = u.pathname.replace(/\/$/, "") || "/";
        hints.push({ path, label: s.label, url: s.url });
      } catch {
        // URL inválida en catálogo: omitir
      }
    }
  }
  hints.sort((a, b) => b.path.length - a.path.length);
  return hints;
}

const pathHints = buildPathHints();

/**
 * Si la URL de la página coincide con una ficha del catálogo, devuelve etiqueta y URL oficiales.
 * @param {string} pageUrl
 * @returns {{ detectedSuiteLabel: string; detectedSuiteUrl: string } | null}
 */
function matchSuiteFromPageUrl(pageUrl) {
  if (!pageUrl || typeof pageUrl !== "string") {
    return null;
  }
  let pathname;
  try {
    pathname = new URL(pageUrl).pathname.replace(/\/$/, "") || "/";
  } catch {
    return null;
  }
  for (const h of pathHints) {
    if (pathname === h.path || pathname.startsWith(h.path + "/")) {
      return {
        detectedSuiteLabel: h.label,
        detectedSuiteUrl: h.url,
      };
    }
  }
  return null;
}

module.exports = { matchSuiteFromPageUrl, buildPathHints };
