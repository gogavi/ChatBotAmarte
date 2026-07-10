const express = require("express");
const { ElevenLabsClient } = require("@elevenlabs/elevenlabs-js");
const conversationStore = require("../conversationStore");

const router = express.Router();

/**
 * Extrae campos útiles del evento post-call de ElevenLabs.
 * Tolera campos adicionales / formas distintas del payload.
 * @param {unknown} event
 */
function extractPostCallPayload(event) {
  const root = event && typeof event === "object" ? event : {};
  const data =
    root.data && typeof root.data === "object" ? root.data : root;

  const elevenlabsConversationId =
    data.conversation_id ||
    data.conversationId ||
    data.id ||
    null;

  const agentId = data.agent_id || data.agentId || null;

  const analysis =
    data.analysis && typeof data.analysis === "object" ? data.analysis : {};

  const metadata =
    data.metadata && typeof data.metadata === "object" ? data.metadata : {};

  const transcript =
    data.transcript ||
    data.transcription ||
    analysis.transcript ||
    null;

  const summary =
    (typeof analysis.transcript_summary === "string" &&
      analysis.transcript_summary) ||
    (typeof analysis.summary === "string" && analysis.summary) ||
    (typeof data.summary === "string" && data.summary) ||
    null;

  const durationSeconds =
    Number(
      metadata.call_duration_secs ||
        metadata.callDurationSecs ||
        data.call_duration_secs ||
        data.duration_seconds ||
        data.durationSeconds
    ) || null;

  const status =
    data.status ||
    metadata.status ||
    root.type ||
    "completed";

  // Dynamic variables / custom data may carry local conversation id
  const dyn =
    data.conversation_initiation_client_data?.dynamic_variables ||
    data.dynamic_variables ||
    metadata.dynamic_variables ||
    {};

  const localConversationId =
    (typeof dyn.conversation_id === "string" && dyn.conversation_id) ||
    (typeof data.participant_name === "string" && data.participant_name) ||
    (typeof metadata.participant_name === "string" &&
      metadata.participant_name) ||
    null;

  const suiteContext =
    (typeof dyn.suite_context === "string" && dyn.suite_context) ||
    null;

  const dataCollection =
    analysis.data_collection_results ||
    analysis.dataCollectionResults ||
    {};

  const bookingIntent = Boolean(
    dataCollection.booking_intent?.value ||
      dataCollection.booking_intent ||
      analysis.booking_intent ||
      false
  );

  return {
    type: root.type || null,
    elevenlabsConversationId:
      typeof elevenlabsConversationId === "string"
        ? elevenlabsConversationId
        : null,
    localConversationId:
      typeof localConversationId === "string" ? localConversationId : null,
    agentId: typeof agentId === "string" ? agentId : null,
    status: typeof status === "string" ? status : "completed",
    durationSeconds:
      durationSeconds != null && Number.isFinite(durationSeconds)
        ? Math.round(durationSeconds)
        : null,
    summary,
    transcript,
    analysis: {
      ...analysis,
      dataCollection,
      suite_context: suiteContext,
      reference_date: dyn.reference_date || null,
      requested_duration: dataCollection.duration?.value || null,
      human_contact_requested: Boolean(
        dataCollection.human_contact?.value ||
          dataCollection.whatsapp_requested?.value
      ),
    },
    suiteContext,
    bookingIntent,
  };
}

/**
 * Procesa el evento de forma asíncrona (tras responder 200).
 * @param {object} parsed
 */
async function persistPostCall(parsed) {
  if (!parsed.elevenlabsConversationId) {
    console.warn("post-call: sin elevenlabs_conversation_id");
    return;
  }
  conversationStore.ensureStoreReady();
  await conversationStore.savePostCallData({
    localConversationId: parsed.localConversationId,
    elevenlabsConversationId: parsed.elevenlabsConversationId,
    agentId: parsed.agentId,
    status: parsed.status,
    durationSeconds: parsed.durationSeconds,
    summary: parsed.summary,
    transcript: parsed.transcript,
    analysis: parsed.analysis,
    suiteContext: parsed.suiteContext,
    bookingIntent: parsed.bookingIntent,
  });
}

router.post(
  "/elevenlabs/post-call",
  express.text({ type: "*/*", limit: "2mb" }),
  async (req, res) => {
    const secret = String(
      process.env.ELEVENLABS_CONVAI_WEBHOOK_SECRET || ""
    ).trim();
    if (!secret) {
      return res.status(503).json({ error: "Webhook no configurado" });
    }

    const signature =
      req.headers["elevenlabs-signature"] ||
      req.headers["ElevenLabs-Signature"];
    const rawBody =
      typeof req.body === "string"
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body.toString("utf8")
          : "";

    if (!rawBody) {
      return res.status(400).json({ error: "Cuerpo vacío" });
    }

    let event;
    try {
      const client = new ElevenLabsClient({
        apiKey: process.env.ELEVENLABS_API_KEY || "unused",
      });
      event = await client.webhooks.constructEvent(
        rawBody,
        String(signature || ""),
        secret
      );
    } catch (err) {
      console.warn(
        "post-call firma inválida:",
        err && err.message ? err.message : err
      );
      return res.status(401).json({ error: "Firma inválida" });
    }

    // Responder rápido
    res.status(200).json({ received: true });

    try {
      const parsed = extractPostCallPayload(event);
      // Solo persistir eventos post-call relevantes; aceptar otros sin fallar
      const type = String(parsed.type || "");
      if (
        !type ||
        type.includes("post_call") ||
        type.includes("transcription") ||
        parsed.elevenlabsConversationId
      ) {
        await persistPostCall(parsed);
      }
    } catch (err) {
      console.error(
        "post-call persist:",
        err && err.message ? err.message : err
      );
    }
  }
);

module.exports = router;
module.exports.extractPostCallPayload = extractPostCallPayload;
module.exports.persistPostCall = persistPostCall;
