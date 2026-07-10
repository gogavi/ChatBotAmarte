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

## Variables de entorno en Railway

```env
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
ELEVENLABS_ENVIRONMENT=production
ELEVENLABS_LIVE_ENABLED=true
```

El navegador **nunca** recibe la API key ni el Agent ID: solo un token temporal vía `POST /api/elevenlabs/conversation-token`.

## Cómo desactivar el modo en vivo

```env
ELEVENLABS_LIVE_ENABLED=false
```

El chat escrito y la nota de voz siguen funcionando.

## Prueba local

1. Copia `.env.example` → `.env` y rellena claves.
2. `npm run build:voice`
3. `npm start`
4. Abre `http://localhost:3000/embed-demo.html`
5. Abre el widget → **Hablar en vivo con Martina** → confirmar → permitir micrófono.

En local, `pageUrl` en `localhost` se acepta si `NODE_ENV !== production` o `ELEVENLABS_ALLOW_LOCAL_PAGE_HOSTS=true`.

## Pasos en ElevenLabs (manual)

1. Crear agente privado con el nombre y primera frase de arriba.
2. Pegar el system prompt oral.
3. Registrar variables dinámicas.
4. Crear herramientas webhook + Client Tool (ver `ELEVENLABS_TOOLS_SETUP.md`).
5. Configurar post-call webhook (ver `ELEVENLABS_POST_CALL_WEBHOOK.md`).
6. Copiar el **Agent ID** a `ELEVENLABS_AGENT_ID` en Railway.
