const assert = require("assert");
const {
  isLiveVoiceEnabled,
  isElevenLabsAgentConfigured,
  isAllowedPageHost,
  getVoiceAgentProvider,
  TOKEN_RATE_LIMIT,
} = require("../liveVoiceConfig");

assert.strictEqual(TOKEN_RATE_LIMIT.max, 5);
assert.strictEqual(TOKEN_RATE_LIMIT.windowMs, 10 * 60 * 1000);

assert.strictEqual(isAllowedPageHost("amartesuite.com"), true);
assert.strictEqual(isAllowedPageHost("www.amartesuite.com"), true);
assert.strictEqual(
  isAllowedPageHost("chatbotamarte-production.up.railway.app"),
  true
);
assert.strictEqual(isAllowedPageHost("evil.com"), false);

const prevLive = process.env.ELEVENLABS_LIVE_ENABLED;
const prevKey = process.env.ELEVENLABS_API_KEY;
const prevAgent = process.env.ELEVENLABS_AGENT_ID;
const prevProvider = process.env.VOICE_AGENT_PROVIDER;

process.env.ELEVENLABS_LIVE_ENABLED = "false";
assert.strictEqual(isLiveVoiceEnabled(), false);

process.env.ELEVENLABS_LIVE_ENABLED = "true";
process.env.ELEVENLABS_API_KEY = "";
process.env.ELEVENLABS_AGENT_ID = "";
assert.strictEqual(isElevenLabsAgentConfigured(), false);

process.env.ELEVENLABS_API_KEY = "test-key";
process.env.ELEVENLABS_AGENT_ID = "agent_test";
assert.strictEqual(isElevenLabsAgentConfigured(), true);
assert.strictEqual(isLiveVoiceEnabled(), true);

// Sin flag explícito: botón oculto aunque haya claves.
delete process.env.ELEVENLABS_LIVE_ENABLED;
assert.strictEqual(isLiveVoiceEnabled(), false);
process.env.ELEVENLABS_LIVE_ENABLED = "true";

delete process.env.VOICE_AGENT_PROVIDER;
assert.strictEqual(getVoiceAgentProvider(), "elevenlabs");

process.env.VOICE_AGENT_PROVIDER = "elevenlabs";
assert.strictEqual(getVoiceAgentProvider(), "elevenlabs");
assert.strictEqual(isLiveVoiceEnabled(), true);

process.env.VOICE_AGENT_PROVIDER = "openai";
assert.strictEqual(getVoiceAgentProvider(), "openai");
// OpenAI Realtime stub: live voice stays disabled until implemented.
assert.strictEqual(isLiveVoiceEnabled(), false);

process.env.VOICE_AGENT_PROVIDER = "unknown-vendor";
assert.strictEqual(getVoiceAgentProvider(), "elevenlabs");

if (prevLive === undefined) delete process.env.ELEVENLABS_LIVE_ENABLED;
else process.env.ELEVENLABS_LIVE_ENABLED = prevLive;
if (prevKey === undefined) delete process.env.ELEVENLABS_API_KEY;
else process.env.ELEVENLABS_API_KEY = prevKey;
if (prevAgent === undefined) delete process.env.ELEVENLABS_AGENT_ID;
else process.env.ELEVENLABS_AGENT_ID = prevAgent;
if (prevProvider === undefined) delete process.env.VOICE_AGENT_PROVIDER;
else process.env.VOICE_AGENT_PROVIDER = prevProvider;

console.log("liveVoiceConfig tests passed");
