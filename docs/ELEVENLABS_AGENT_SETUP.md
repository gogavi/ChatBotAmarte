# Configuración del agente ElevenLabs — Martina Live

## Nombre sugerido

```text
Martina Live — Hotel Amarte Suite
```

## Idioma

Español

## Primera frase sugerida

```text
Hola, soy Martina, concierge virtual de Hotel Amarte Suite. Puedo ayudarte a elegir una suite, conocer tarifas y orientarte con tu reserva. ¿Qué experiencia estás buscando?
```

No uses etiquetas de estilo tipo `[warmly]` / `[thoughtful]` en la primera frase ni en el prompt oral: se cuelan en la transcripción del chat. El tono se controla con la voz del agente en el dashboard.

## Tipo de agente

- **Privado** (requiere conversation token WebRTC desde el backend).
- Conexión: **WebRTC**.

## Variables dinámicas

Configura en ElevenLabs estas variables (el backend las envía en cada sesión):

| Variable | Descripción |
|----------|-------------|
| `{{conversation_id}}` | UUID local del widget |
| `{{suite_context}}` | Suite detectada por URL (puede ir vacía) |
| `{{page_path}}` | Pathname de la página |
| `{{reference_date}}` | Fecha Bogotá YYYY-MM-DD |
| `{{reference_time}}` | Hora Bogotá HH:mm |
| `{{reference_weekday}}` | Día de la semana en español |
| `{{source}}` | Siempre `amarte_website` |

## Reglas del prompt (oral)

1. Hablar siempre en español, salvo que el usuario use claramente otro idioma.
2. Respuestas breves y naturales para voz (máximo ~3 frases salvo que pidan detalle).
3. No recitar URLs.
4. No inventar precios, promociones ni disponibilidad.
5. Consultar la herramienta de catálogo antes de afirmar una tarifa.
6. Confirmar fecha, hora, suite y duración antes de cotizar.
7. Usar la hora de Bogotá (`reference_date` / `reference_time` / `reference_weekday`).
8. Si preguntan, informar que es una asistente virtual.
9. No solicitar datos financieros completos ni números de tarjeta.
10. Ofrecer WhatsApp cuando pidan asesor, haya situación especial, no puedas resolver, o quieran finalizar la reserva (usar Client Tool `show_action_buttons` con `whatsapp`).
11. No afirmar que una reserva quedó confirmada si el backend no lo confirma.
12. Pronunciar montos en palabras (usar `spokenPrice` de la herramienta de catálogo).
13. Máximo una pregunta principal por turno.

Reutiliza el tono y las reglas comerciales de:

- `config/martinaSystemPrompt.js`
- `config/memoria.md`
- `config/amarteCatalog.js`

Adaptadas a formato oral (sin Markdown denso ni matrices de precios).

## Backend de producción

```text
https://chatbotamarte-production.up.railway.app
```

- Widget config: `GET /api/widget-config` → `{ "liveVoiceEnabled": true }`
- Token WebRTC: `POST /api/elevenlabs/conversation-token`
- Tools: `POST /api/agent-tools/catalog` y `/actions`
- Post-call: `POST /api/elevenlabs/post-call`

## Arquitectura del cliente (proveedor intercambiable)

El widget **no** importa ni llama a `Conversation.startSession` de ElevenLabs.
Usa únicamente `window.VoiceAgentManager`, que selecciona el adaptador según
`VOICE_AGENT_PROVIDER`:

| Valor | Implementación |
|-------|----------------|
| `elevenlabs` (default) | `ElevenLabsProvider` — WebRTC vía `@elevenlabs/client` |
| `openai` | `OpenAIRealtimeProvider` — stub (aún no implementado) |

Código fuente: `src/voice/` → bundle `public/amarte-live-agent.bundle.js`.

Estados de sesión independientes del proveedor: `idle`, `connecting`, `connected`,
`listening`, `thinking`, `speaking`, `muted`, `disconnected`, `error`.

Punto de extensión futuro para OpenAI: `POST /api/openai/realtime-session`
(sin implementar en esta fase).

## Variables de entorno en Railway

```env
VOICE_AGENT_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
ELEVENLABS_ENVIRONMENT=production
ELEVENLABS_LIVE_ENABLED=false
ELEVENLABS_TOOL_SECRET=
ELEVENLABS_CONVAI_WEBHOOK_SECRET=
```

El navegador **nunca** recibe la API key ni el Agent ID: solo un token temporal vía `POST /api/elevenlabs/conversation-token`.
`GET /api/widget-config` expone `{ liveVoiceEnabled, voiceAgentProvider }`.
Para mostrar el botón en vivo: `ELEVENLABS_LIVE_ENABLED=true` (opt-in).

### Permisos de la API key (obligatorio)

La key debe incluir el permiso **`convai_write`**. Sin él, ElevenLabs responde `401 missing_permissions` y el backend devuelve `502` en `/api/elevenlabs/conversation-token`.

En ElevenLabs → API Keys → crea o edita una key con acceso a Conversational AI (write) y actualiza `ELEVENLABS_API_KEY` en Railway y en `.env` local.

## Cómo desactivar el modo en vivo

```env
# true | false — botón “Hablar en vivo” (opt-in; por ahora desactivado)
ELEVENLABS_LIVE_ENABLED=false
```

El chat escrito y la nota de voz siguen funcionando.

## Prueba local

1. Copia `.env.example` → `.env` y rellena claves.
2. `npm run build:voice`
3. `npm start`
4. Abre `http://localhost:3010/embed-demo.html` (o el puerto de `PORT`).
5. Abre el widget → **Hablar en vivo con Martina** → confirmar → permitir micrófono.

En local, `pageUrl` en `localhost` se acepta si `NODE_ENV !== production` o `ELEVENLABS_ALLOW_LOCAL_PAGE_HOSTS=true`.
El demo en Railway (`chatbotamarte-production.up.railway.app`) también está en la lista de hosts permitidos.
Hosts adicionales: `ELEVENLABS_ALLOWED_PAGE_HOSTS=host1,host2`.

## Checklist de despliegue (Martina Live)

### Hecho en backend / Railway

- [x] `ELEVENLABS_AGENT_ID` configurado en Railway
- [x] `ELEVENLABS_ENVIRONMENT=production`; live desactivado por ahora (`ELEVENLABS_LIVE_ENABLED=false`)
- [x] `ELEVENLABS_TOOL_SECRET` generado y desplegado
- [x] `GET /api/widget-config` → `liveVoiceEnabled: false` (reactivar con `true` cuando esté listo)
- [x] `POST /api/agent-tools/catalog` responde con Bearer del tool secret

### Pendiente en dashboard ElevenLabs

1. API key con permiso **`convai_write`** → actualizar `ELEVENLABS_API_KEY` en Railway.
2. Confirmar agente privado + WebRTC + variables dinámicas de arriba.
3. Registrar webhook tools + Client Tool (ver `ELEVENLABS_TOOLS_SETUP.md`).
4. Post-call webhook (ver `ELEVENLABS_POST_CALL_WEBHOOK.md`) y pegar el signing secret en `ELEVENLABS_CONVAI_WEBHOOK_SECRET`.
5. Probar “Hablar en vivo” en `https://chatbotamarte-production.up.railway.app/embed-demo.html` o en amartesuite.com.
