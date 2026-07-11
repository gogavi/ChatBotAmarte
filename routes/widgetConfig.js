const express = require("express");
const {
  isLiveVoiceEnabled,
  getVoiceAgentProvider,
} = require("../liveVoiceConfig");

const router = express.Router();

router.get("/widget-config", (_req, res) => {
  res.json({
    liveVoiceEnabled: isLiveVoiceEnabled(),
    voiceAgentProvider: getVoiceAgentProvider(),
  });
});

module.exports = router;
