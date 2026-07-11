# Herramientas ElevenLabs — Martina Live

El backend expone herramientas seguras. El modelo **nunca** inventa URLs ni precios: los obtiene de estos endpoints.

## Autenticación

Todas las rutas `/api/agent-tools/*` requieren:

```http
Authorization: Bearer ELEVENLABS_TOOL_SECRET
```

También se acepta el header `x-amarte-tool-secret` con el mismo valor.

Configura en Railway:

```env
ELEVENLABS_TOOL_SECRET=genera-un-secreto-largo-aleatorio
```

En ElevenLabs, al crear cada **Webhook Tool**, añade el mismo Bearer en los headers de autenticación.

## Backend de producción

```text
https://chatbotamarte-production.up.railway.app
```

Usa el mismo `ELEVENLABS_TOOL_SECRET` que está en Railway (header `Authorization: Bearer …`).

## 1. Consultar catálogo

```http
POST https://chatbotamarte-production.up.railway.app/api/agent-tools/catalog
Content-Type: application/json
Authorization: Bearer ELEVENLABS_TOOL_SECRET
```

### Body

```json
{
  "suite": "VIP Jacuzzi",
  "date": "2026-07-11",
  "duration": "8 horas"
}
```

### Respuesta (ejemplo)

```json
{
  "found": true,
  "suite": "Suite VIP Jacuzzi",
  "dateType": "weekend",
  "duration": "8 horas",
  "priceCop": 290000,
  "spokenPrice": "doscientos noventa mil pesos",
  "formattedPrice": "$290.000",
  "availableDurations": ["4 horas", "8 horas", "12 horas", "día hotelero"],
  "bookingUrl": "https://amartesuite.com/formulario-reservas-amarte-suite/",
  "message": null
}
```

Los precios salen **solo** de `config/amarteCatalog.js`.

## 2. Enlaces oficiales

```http
POST https://chatbotamarte-production.up.railway.app/api/agent-tools/actions
Authorization: Bearer ELEVENLABS_TOOL_SECRET
```

Devuelve URLs canónicas de reserva, promociones, WhatsApp, Wompi y ubicación. No acepta URLs del modelo.

## 3. Client Tool: `show_action_buttons`

Tipo: **Client Tool** (se ejecuta en el navegador vía `@elevenlabs/client`).

### Parámetros

```json
{
  "actions": ["reservation", "whatsapp", "promotions", "payment"]
}
```

Valores permitidos: `reservation` | `reserve` | `whatsapp` | `promotions` | `payment` | `wompi`.

El widget muestra los botones oficiales con URLs ya conocidas. **No** pases URLs en los parámetros.

## Cómo registrarlas en ElevenLabs

1. Abre el agente → Tools.
2. Crea Webhook Tool `lookup_catalog` → URL del endpoint catalog + Bearer.
3. Crea Webhook Tool `get_official_actions` → URL del endpoint actions + Bearer.
4. Crea Client Tool `show_action_buttons` con el schema de `actions` (array de strings).
5. En el prompt, indica: cotizar solo tras `lookup_catalog`; para botones usar `show_action_buttons` sin URLs.
