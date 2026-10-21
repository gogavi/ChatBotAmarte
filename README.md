# ChatBotAmarte

Concierge de IA **Martina** para [Hotel Amarte Suite](https://amartesuite.com): chat escrito, nota de voz y modo **Hablar en vivo** (ElevenLabs Agents + WebRTC).

## Requisitos

- Node.js >= 18
- Claves: OpenAI, ElevenLabs (TTS y/o Agents), Supabase (historial)

## Inicio rápido

```bash
copy .env.example .env   # Windows
npm install
npm run build:voice
npm start
```

Demo local: [http://localhost:3000/embed-demo.html](http://localhost:3000/embed-demo.html)

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm start` | Compila el bundle de voz (`prestart`) y arranca Express |
| `npm run build:voice` | Genera `public/amarte-live-agent.bundle.js` |
| `npm test` | Suite de tests (sin créditos reales) |

## Modos de conversación

| Modo | Flujo |
|------|--------|
| Chat escrito | `POST /chat` → OpenAI |
| Nota de voz | `POST /chat/audio` → STT → chat → ElevenLabs TTS |
| En vivo | Token WebRTC → ElevenLabs Agents → webhook post-call |

Desactivar solo el modo en vivo: `ELEVENLABS_LIVE_ENABLED=false`.

## Embed (WordPress)

```html
<script>
  window.AMARTE_CHATBOT_URL = "https://chatbotamarte-production.up.railway.app";
</script>
<script src="https://chatbotamarte-production.up.railway.app/amarte-widget.js?v=ACTUALIZA"></script>
```

No incluyas API keys en el embed.

### Medición (widget)

El widget no carga GTM. Avisa con `window.__amarteAnalyticsTrack(payload)` y, solo si ese puente no existe, hace `dataLayer.push`. Contrato, flag de llamada en escritorio y página de prueba: [docs/medicion/widget-martina.md](docs/medicion/widget-martina.md).

Llamar sigue oculto en escritorio. Para mostrarlo:

```html
<script>
  window.AMARTE_SHOW_DESKTOP_CALL = true;
</script>
<script src="https://chatbotamarte-production.up.railway.app/amarte-widget.js"></script>
```

## API pública del widget (`window.AmarteChatbot`)

Tras cargar `amarte-widget.js`, el sitio puede abrir Martina sin usar solo el launcher flotante:

```js
// Chat de texto (opcional: mensaje inicial que se envía al backend)
window.AmarteChatbot.openChat("Quiero reservar una suite");

// Voz en vivo — llamar en el mismo click del usuario (permiso de micrófono)
window.AmarteChatbot.openLive();

window.AmarteChatbot.close();
```

Ejemplo React / Vite: define `window.AMARTE_CHATBOT_URL`, carga el script una vez, y en el CTA «HABLA CON MARTINA» invoca `openLive()` de forma síncrona en el `onClick`.

CORS: `amartesuite.com`, `www`, localhost, las 7 landings del catálogo `config/landings.js` y `https://deluxe.amartesuite.com`. Un `*.vercel.app` que no esté en ese catálogo no pasa. Orígenes de preview: `CORS_ORIGINS`.

En una landing, antes del widget: `window.AMARTE_LANDING` con el id de `config/landings.js` (el mismo que `funnel_events.proyecto`). Sin ese valor el prompt de amartesuite.com no cambia. `/chat` y `/chat/audio` admiten 30 mensajes por `conversationId` en el proceso y 60 por hora por IP. `/reservations/pending` no gasta ese cupo. Al pasarse, responden 429.

Demo con landing: [http://localhost:3000/embed-demo.html?landing=suite-jacuzzi](http://localhost:3000/embed-demo.html?landing=suite-jacuzzi)

## Documentación

- [DOSIER.md](DOSIER.md) — arquitectura completa
- [docs/ELEVENLABS_AGENT_SETUP.md](docs/ELEVENLABS_AGENT_SETUP.md)
- [docs/ELEVENLABS_TOOLS_SETUP.md](docs/ELEVENLABS_TOOLS_SETUP.md)
- [docs/ELEVENLABS_POST_CALL_WEBHOOK.md](docs/ELEVENLABS_POST_CALL_WEBHOOK.md)

## Variables Railway (modo en vivo)

```env
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
ELEVENLABS_ENVIRONMENT=production
ELEVENLABS_CONVAI_WEBHOOK_SECRET=
ELEVENLABS_TOOL_SECRET=
ELEVENLABS_LIVE_ENABLED=true
```
