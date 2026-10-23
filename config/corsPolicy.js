/**
 * CORS del chatbot. La lista de landings sale de config/landings.js.
 * Un host *.vercel.app que no esté en el catálogo no pasa,
 * salvo un preview https del team: un solo label que termina en -gogavis-projects.vercel.app.
 */

const { landingBrowserOrigins } = require("./landings");

const SITE_ORIGINS = Object.freeze([
  "https://amartesuite.com",
  "https://www.amartesuite.com",
]);

/**
 * Preview real de Vercel: <proyecto>-git-<rama>-gogavis-projects.vercel.app
 * (un solo label; el team va con guion, no como subdominio).
 * El prefijo cabe en lo que queda del tope de 63 del label.
 */
const VERCEL_TEAM_PREVIEW_HOST =
  /^[a-z0-9](?:[a-z0-9-]{0,44}[a-z0-9])?-gogavis-projects\.vercel\.app$/;

/**
 * Preview de Vercel del team (label …-gogavis-projects.vercel.app).
 * El nombre de rama no identifica una landing.
 * @param {string} origin
 * @returns {boolean}
 */
function allowVercelTeamPreview(origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  if (url.port) return false;
  if (url.pathname !== "/" || url.search || url.hash) return false;
  return VERCEL_TEAM_PREVIEW_HOST.test(url.hostname);
}

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
  if (allowVercelTeamPreview(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  } catch {
    return false;
  }
  return false;
}

module.exports = { allowCorsOrigin, SITE_ORIGINS };
