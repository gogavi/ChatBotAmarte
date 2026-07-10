/**
 * Eventos de analítica del modo en vivo.
 * En desarrollo: console.debug. Interfaz lista para integrar un proveedor.
 */

/**
 * @param {string} name
 * @param {Record<string, unknown>} [props]
 */
function trackEvent(name, props = {}) {
  if (!name || typeof name !== "string") {
    return;
  }
  const payload = {
    event: name,
    props: props && typeof props === "object" ? props : {},
    ts: new Date().toISOString(),
  };

  // Hook futuro: window / process analytics sink
  if (typeof globalThis.__amarteAnalyticsTrack === "function") {
    try {
      globalThis.__amarteAnalyticsTrack(payload);
      return;
    } catch {
      // ignore sink errors
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.debug("[amarte-analytics]", payload.event, payload.props);
  }
}

module.exports = { trackEvent };
