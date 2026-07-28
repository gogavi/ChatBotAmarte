const express = require("express");
const {
  isLiveVoiceEnabled,
  getVoiceAgentProvider,
} = require("../liveVoiceConfig");
const { VALID_TIPOS, VALID_PACKS } = require("../reservationService");
const { getSuiteVideosForWidget } = require("../config/amarteCatalog");
const { buildWidgetQuoteCatalog } = require("../services/catalogLookup");

const router = express.Router();

router.get("/widget-config", (_req, res) => {
  res.json({
    liveVoiceEnabled: isLiveVoiceEnabled(),
    voiceAgentProvider: getVoiceAgentProvider(),
    reservationForm: {
      tipos: [...VALID_TIPOS],
      packs: [...VALID_PACKS],
    },
    quoteCatalog: buildWidgetQuoteCatalog(VALID_TIPOS, VALID_PACKS),
    suiteVideos: getSuiteVideosForWidget(),
  });
});

module.exports = router;
