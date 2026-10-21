/**
 * CORS del chatbot. La lista de landings sale de config/landings.js.
 * Un host *.vercel.app que no esté en el catálogo no pasa.
 */

const { landingBrowserOrigins } = require("./landings");

const SITE_ORIGINS = Object.freeze([
  "https://amartesuite.com",
  "https://www.amartesuite.com",
]);

/**
 * @param {unknown} origin
 * @param {readonly string[]} [extraOrigins]
 * @returns {boolean}
 */
function allowCorsOrigin(origin, extraOrigins) {
  if (!origin) return true;
  if (typeof origin !== "string") return false;
  if (SITE_ORIGINS.includes(origin)) return true;
  if (landingBrowserOrigins().includes(origin)) return true;
  const extras = Array.isArray(extraOrigins) ? extraOrigins : [];
  if (extras.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  } catch {
    return false;
  }
  return false;
}

module.exports = { allowCorsOrigin, SITE_ORIGINS };
