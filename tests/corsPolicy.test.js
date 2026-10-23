/**
 * CORS: landings de vercel.app, dominios de producción y el sitio.
 * Sin comodín *.vercel.app ni *.amartesuite.com.
 * Preview solo si el host es https, un slug del catálogo, y git o un id de deploy.
 */
const assert = require("assert");
const { allowCorsOrigin } = require("../config/corsPolicy");

const extras = ["https://preview.ejemplo.test"];

function allows(origin) {
  assert.strictEqual(allowCorsOrigin(origin, extras), true, origin);
}

function blocks(origin) {
  assert.strictEqual(allowCorsOrigin(origin, extras), false, origin);
}

allows(undefined);
allows(null);
allows("https://amartesuite.com");
allows("https://www.amartesuite.com");
allows("http://localhost:5999");
allows("http://127.0.0.1:4173");
allows("https://preview.ejemplo.test");
allows("https://microservicio-suite-jacuzzi.vercel.app");
allows("https://microservicio-promo-suite-jacuzzi.vercel.app");
allows("https://microservicio-promo-suite-amarte.vercel.app");
allows("https://microservicio-suite-tematicas.vercel.app");
allows("https://microservicio-suite-sauna-jacuzzi.vercel.app");
allows("https://microservicio-suite-gamer.vercel.app");
allows("https://microservicio-reservas.vercel.app");
allows("https://deluxe.amartesuite.com");
allows("https://suitejacuzzi.amartesuite.com");
allows("https://promojacuzzi.amartesuite.com");
allows("https://promoamarte.amartesuite.com");
allows("https://tematica.amartesuite.com");
allows("https://suitegamer.amartesuite.com");
allows("https://reservas.amartesuite.com");
allows(
  "https://microservicio-suite-gamer-git-main-gogavis-projects.vercel.app"
);
allows("https://chatbotamarte-git-master-gogavis-projects.vercel.app");
allows(
  "https://microservicio-suite-tematicas-2j1qs77te-gogavis-projects.vercel.app"
);

blocks("https://evil.vercel.app");
blocks("https://evil-gogavis-projects.vercel.app");
blocks("https://evil-git-main-gogavis-projects.vercel.app");
blocks("https://not-git-branch-gogavis-projects.vercel.app");
blocks(
  "https://microservicio-suite-gamer-production-gogavis-projects.vercel.app"
);
blocks("https://microservicio-suite-jacuzzi.vercel.app.evil.com");
blocks("https://otro.amartesuite.com");
blocks("https://tematicas.amartesuite.com");
blocks("https://suitegamer.amartesuite.com.evil.com");
blocks("http://suitegamer.amartesuite.com");
blocks("http://foo.gogavis-projects.vercel.app");
blocks("https://a.b.gogavis-projects.vercel.app");
blocks("https://preview.gogavis-projects.vercel.app");
blocks("https://notgogavis-projects.vercel.app");
blocks("https://gogavis-projects.vercel.app");
blocks("https://evil.gogavis-projects.vercel.app.evil.com");
blocks("https://foo.gogavis-projects.vercel.app/path");
blocks("https://-bad.gogavis-projects.vercel.app");
blocks("https://bad-.gogavis-projects.vercel.app");
blocks("https://user@foo.gogavis-projects.vercel.app");
blocks("not a url");

console.log("corsPolicy.test.js ok");
