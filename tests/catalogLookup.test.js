const assert = require("assert");
const {
  lookupCatalogPrice,
  normalizeDuration,
  toSpokenPrice,
} = require("../services/catalogLookup");

assert.strictEqual(normalizeDuration("8 horas"), "h8");
assert.strictEqual(normalizeDuration("día hotelero"), "diaHotelero");

const miss = lookupCatalogPrice({
  suite: "Suite Inventada XYZ",
  date: "2026-07-09",
  duration: "8 horas",
});
assert.strictEqual(miss.found, false);

const hit = lookupCatalogPrice({
  suite: "VIP Jacuzzi",
  date: "2026-07-09",
  duration: "8 horas",
});
assert.strictEqual(hit.found, true);
assert.strictEqual(hit.dateType, "weekday");
assert.strictEqual(hit.priceCop, 240000);
assert.ok(typeof hit.spokenPrice === "string" && hit.spokenPrice.length > 0);
assert.ok(Array.isArray(hit.availableDurations));
assert.ok(hit.bookingUrl.includes("amartesuite.com"));

const spoken = toSpokenPrice(180000);
assert.ok(spoken.includes("pesos"));
assert.ok(!spoken.includes("$"));

console.log("catalogLookup tests passed");
