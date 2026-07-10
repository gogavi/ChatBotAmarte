# Post-call webhook — ElevenLabs ConvAI

## Endpoint

```http
POST https://TU_BACKEND/api/elevenlabs/post-call
```

## Variable de entorno

```env
ELEVENLABS_CONVAI_WEBHOOK_SECRET=
```

El secreto lo genera ElevenLabs al crear el webhook. **Nunca** lo expongas al navegador.

## Verificación

El servidor:

1. Lee el cuerpo **crudo** (antes de `express.json()`).
2. Verifica el header `ElevenLabs-Signature` con `@elevenlabs/elevenlabs-js` → `webhooks.constructEvent`.
3. Responde `200 { "received": true }` de inmediato.
4. Persiste de forma asíncrona e idempotente en Supabase (`live_conversations`), clave única `elevenlabs_conversation_id`.

No se almacena audio completo en esta fase.

## Datos guardados

- Conversation ID de ElevenLabs
- Conversation ID local (`dynamic_variables.conversation_id`)
- Agent ID
- Duración
- Transcripción / resumen / análisis
- Suite consultada
- Intención de reserva / contacto humano (si vienen en data collection)

## Configuración en ElevenLabs

1. Agents → Settings / Webhooks → Post-call webhook.
2. URL: `https://chatbotamarte-production.up.railway.app/api/elevenlabs/post-call` (o tu dominio).
3. Copia el signing secret a `ELEVENLABS_CONVAI_WEBHOOK_SECRET` en Railway.
4. Activa eventos de transcripción / post-call analysis.

## Tabla Supabase

```sql
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
```

Esta migración ya se aplicó en el proyecto Amarte; si usas otro proyecto, ejecuta el SQL anterior.

## Prueba local

Usa un túnel (ngrok / Cloudflare Tunnel) apuntando a `localhost:3000` y registra esa URL en ElevenLabs, o envía un POST firmado en tests (`tests/elevenlabsPostCall.test.js`).
