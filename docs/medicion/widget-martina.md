# Medición del widget de Martina

El widget (`public/amarte-widget.js`) no carga GTM ni gtag. Quien inserta el script (www.amartesuite.com) es dueño del `dataLayer`.

## Eventos que emite el widget

| Gesto | Payload |
| --- | --- |
| Clic en un `tel:` dentro del widget (botón Llamar) | `{event:'generate_lead', method:'phone', location:'martina_widget', phone_number}` — dígitos del `href`; el botón por defecto es `573013307909` |
| Clic en cualquier WhatsApp del widget (`wa.me`, `api.whatsapp.com`, `whatsapp.com/send`), pie o enlace dentro del hilo | `{event:'generate_lead', method:'whatsapp', location:'martina_widget', link_url}` |
| Abrir el chat desde el lanzador flotante | `{event:'martina_open', location:'launcher', interaction_type:'text'}` |

Cerrar el lanzador no emite. Volver a abrirlo sí.

`interaction_type` admitido por la spec es `text` o `voice`. El lanzador flotante abre el chat escrito, así que el valor es `text`. El botón «Hablar en vivo» está dentro del panel (hoy «Próximamente») y no abre el chat. `AmarteChatbot.openChat` / `openLive` no emiten `martina_open`: en www los CTA ya empujan `martina_open` antes de llamar `openChat` (hoy con `location:'widget'`, no `launcher`).

Los eventos internos `live_voice_*` no cambian. Siguen yendo a `trackLiveEvent` con forma `{event, props, ts}`. El clic de WhatsApp que ya avisaba `live_voice_whatsapp_clicked` lo sigue haciendo; `generate_lead` va en paralelo.

## Contrato del puente

1. Si el evento nativo trae `__amarteMeasuredEvent === payload.event`, la homepage ya emitió **ese mismo** evento para este clic. El widget no llama al puente ni hace `dataLayer.push`. `whatsapp_redirect` no es `generate_lead`: el legacy se queda.
2. Si existe `window.__amarteAnalyticsTrack`, el widget le pasa el objeto plano y **no** hace `dataLayer.push`.
3. Si el puente no existe, respaldo: `window.dataLayer = window.dataLayer || []; window.dataLayer.push(payload)`.
4. La homepage, si mide el mismo clic por su cuenta, debe marcar el evento en fase capture **antes** de que burbujee al widget:

```js
document.addEventListener("click", function (ev) {
  // solo si ESTE listener ya empujó generate_lead para este clic
  ev.__amarteMeasuredEvent = "generate_lead";
}, true);
```

El puente publicado en www (bundle `index-D29nKPN8.js`, octubre 2026) hace esto con WhatsApp:

- En capture, todo `a[href*="wa.me"]` empuja `whatsapp_redirect` (location `martina_widget` si el enlace tiene clase `amarte-opt-link` o `data-wa-location`).
- `__amarteAnalyticsTrack` solo traduce `{event:'live_voice_whatsapp_clicked'}` a ese mismo `whatsapp_redirect`, y lo descarta si el clic wa.me fue hace menos de 400 ms.

Ese puente **ignora** `generate_lead` y `martina_open`. En www, hasta que la homepage los reenvíe, el widget se los entrega y no aparecen en `dataLayer` (el respaldo no corre porque el puente sí existe). Propuesta de reenvío, sin publicar GTM desde aquí:

```js
window.__amarteAnalyticsTrack = function (payload) {
  if (!payload || payload.event === "live_voice_whatsapp_clicked") {
    // conservar la traducción y el dedup de 400 ms ya existentes
    return;
  }
  if (payload.event === "generate_lead" || payload.event === "martina_open") {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
  }
};
```

No hace falta tocar el contenedor para recibir el `push`. Las etiquetas GA4/Ads de estos eventos son otro cambio, en GTM, fuera de este PR.

## Llamar en escritorio

Sigue oculto con `@media (min-width: 769px)` salvo que el raíz tenga la clase `amarte-show-desktop-call`. Esa clase solo se añade si, **antes** de cargar el script:

```html
<script>
  window.AMARTE_SHOW_DESKTOP_CALL = true; // también "true" o 1
</script>
```

Cualquier otro valor (o no definirla) deja el comportamiento visible igual que hoy: Llamar solo en móvil. El clic se mide igual cuando el botón está visible.

## Cómo ver los eventos

- Tests: `node tests/widgetMeasurement.test.js` (también entra en `npm test`).
- Página: [public/medicion-widget.html](../../public/medicion-widget.html) con el servidor local (`npm start` no hace falta para el archivo estático; sí hace falta servirlo, p. ej. `npx serve public` o el Express del repo en `/medicion-widget.html`).

Query:

| URL | Qué demuestra |
| --- | --- |
| `/medicion-widget.html` | Sin puente: los clics caen en `dataLayer` |
| `?puente=1` | Con puente: el widget no duplica en `dataLayer` |
| `?puente=legacy` | Puente actual de www: recibe el payload y no lo reenvía |
| `?desktopCall=1` | Muestra Llamar en ancho de escritorio |
