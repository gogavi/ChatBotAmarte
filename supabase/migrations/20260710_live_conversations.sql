-- Migración: conversaciones en vivo (ElevenLabs Agents)
-- Aplicada en el proyecto Supabase Amarte; conservar para otros entornos.

CREATE TABLE IF NOT EXISTS live_conversations (
  id BIGSERIAL PRIMARY KEY,
  local_conversation_id TEXT,
  elevenlabs_conversation_id TEXT UNIQUE,
  agent_id TEXT,
  status TEXT,
  duration_seconds INTEGER,
  summary TEXT,
  transcript_json JSONB,
  analysis_json JSONB,
  suite_context TEXT,
  booking_intent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS live_conversations_local_id_idx
  ON live_conversations (local_conversation_id);
