const express = require("express");
const { isLiveVoiceEnabled } = require("../liveVoiceConfig");

const router = express.Router();

router.get("/widget-config", (_req, res) => {
  res.json({
    liveVoiceEnabled: isLiveVoiceEnabled(),
  });
});

module.exports = router;
