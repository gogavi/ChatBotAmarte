/**
 * CORS del chatbot. La lista de landings sale de config/landings.js.
 * Un host *.vercel.app que no esté en el catálogo no pasa,
 * salvo un preview https de un proyecto de esta lista:
 * <slug>-git-<rama>-gogavis-projects.vercel.app
 * o <slug>-<id con dígito>-gogavis-projects.vercel.app.
 * Un proyecto ajeno llamado evil-gogavis-projects no entra.
 */

const { landingBrowserOrigins } = require("./landings");

const SITE_ORIGINS = Object.freeze([
  "https://amartesuite.com",
  "https://www.amartesuite.com",
]);

/** Este repo no es una landing. Su preview de Vercel sí puede llamar a /chat. */
const CHATBOT_VERCEL_SLUG = "chatbotamarte";

/**
 * Slugs *.vercel.app del catálogo, más el del chatbot. El más largo primero.
 * @returns {string[]}
 */
function teamPreviewSlugs() {
  const slugs = new Set([CHATBOT_VERCEL_SLUG]);
  for (const origin of landingBrowserOrigins()) {
    let host = "";
    try {
      host = new URL(origin).hostname;
    } catch {
      continue;
    }
    if (!host.endsWith(".vercel.app")) continue;
    slugs.add(host.slice(0, -".vercel.app".length));
  }
  return [...slugs].sort((a, b) => b.length - a.length);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Preview del team acotado al slug del catálogo.
 * El id de deploy lleva al menos un dígito, así «production» no parece un hash.
 */
const VERCEL_TEAM_PREVIEW_HOST = new RegExp(
  `^(?:${teamPreviewSlugs().map(escapeRegExp).join("|")})-(?:git-[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?|(?=[a-z0-9]*\\d)[a-z0-9]{8,12})-gogavis-projects\\.vercel\\.app$`
);

/**
 * Preview https de un slug del catálogo (git o id de deploy).
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
