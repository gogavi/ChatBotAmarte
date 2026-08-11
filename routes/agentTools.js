const express = require("express");
const { contact, location, payment } = require("../config/amarteCatalog");
const { CHAT_ACTIONS, resolveChatActions } = require("../config/chatActions");
const { lookupCatalogPrice } = require("../services/catalogLookup");

const router = express.Router();

/**
 * Middleware: Bearer ELEVENLABS_TOOL_SECRET
 */
function requireToolSecret(req, res, next) {
  const secret = String(process.env.ELEVENLABS_TOOL_SECRET || "").trim();
  if (!secret) {
    return res.status(503).json({ error: "Herramientas no configuradas" });
  }
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : "";
  // También aceptar header custom
  const alt = String(req.headers["x-amarte-tool-secret"] || "").trim();
  if (token !== secret && alt !== secret) {
    return res.status(401).json({ error: "No autorizado" });
  }
  return next();
}

router.use(requireToolSecret);

router.post("/catalog", async (req, res) => {
  const suite =
    typeof req.body?.suite === "string" ? req.body.suite.slice(0, 200) : "";
  const date =
    typeof req.body?.date === "string" ? req.body.date.slice(0, 32) : "";
  const duration =
    typeof req.body?.duration === "string"
      ? req.body.duration.slice(0, 64)
      : "";

  try {
    const result = await lookupCatalogPrice({ suite, date, duration });
    return res.json(result);
  } catch (err) {
    console.warn("[agentTools/catalog]", err && err.message ? err.message : err);
    return res.status(500).json({ error: "No se pudo cotizar" });
  }
});

router.post("/actions", (_req, res) => {
  // URLs canónicas del backend — nunca del modelo
  return res.json({
    reservation: {
      label: CHAT_ACTIONS.reserve.label,
      url: contact.reservationsUrl,
    },
    promotions: {
      label: CHAT_ACTIONS.promotions.label,
      url: contact.promotionsUrl,
    },
    whatsapp: {
      label: CHAT_ACTIONS.whatsapp.label,
      url: contact.whatsappUrl,
    },
    payment: {
      label: CHAT_ACTIONS.wompi.label,
      url: payment.checkoutUrl,
    },
    location: {
      label: "Ubicación",
      url: location.mapsUrl,
      address: location.address,
    },
    /** Alias para Client Tool show_action_buttons */
    options: resolveChatActions([
      "reserve",
      "promotions",
      "wompi",
      "whatsapp",
    ]),
  });
});

module.exports = router;
module.exports.requireToolSecret = requireToolSecret;
