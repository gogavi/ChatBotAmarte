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
