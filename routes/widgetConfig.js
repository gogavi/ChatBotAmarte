const express = require("express");
const {
  isLiveVoiceEnabled,
  getVoiceAgentProvider,
} = require("../liveVoiceConfig");
const { VALID_TIPOS, VALID_PACKS } = require("../reservationService");
const { getSuiteVideosForWidget } = require("../config/amarteCatalog");
const { buildWidgetQuoteCatalog } = require("../services/catalogLookup");

const router = express.Router();

router.get("/widget-config", async (_req, res) => {
  try {
    const quoteCatalog = await buildWidgetQuoteCatalog(VALID_TIPOS, VALID_PACKS);
    res.json({
      liveVoiceEnabled: isLiveVoiceEnabled(),
      voiceAgentProvider: getVoiceAgentProvider(),
      reservationForm: {
        tipos: [...VALID_TIPOS],
        packs: [...VALID_PACKS],
      },
      quoteCatalog,
      suiteVideos: getSuiteVideosForWidget(),
    });
  } catch (err) {
    console.warn("[widget-config]", err && err.message ? err.message : err);
    res.status(500).json({ error: "No se pudo cargar la configuración del widget" });
  }
});

module.exports = router;
