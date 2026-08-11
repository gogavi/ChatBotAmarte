const assert = require("assert");
const {
  lookupCatalogPrice,
  normalizeDuration,
  toSpokenPrice,
  findCatalogEntry,
} = require("../services/catalogLookup");
const {
  setRoomRatesCacheForTests,
  resetRoomRatesCache,
} = require("../services/roomRatesCatalog");

assert.strictEqual(normalizeDuration("8 horas"), "h8");
assert.strictEqual(normalizeDuration("día hotelero"), "diaHotelero");

async function run() {
  // --- Fallback estático (sin BD) ---
  resetRoomRatesCache();
  setRoomRatesCacheForTests(null);

  const miss = await lookupCatalogPrice({
    suite: "Suite Inventada XYZ",
    date: "2026-07-09",
    duration: "8 horas",
  });
  assert.strictEqual(miss.found, false);

  const hitFallback = await lookupCatalogPrice({
    suite: "VIP Jacuzzi",
    date: "2026-07-09",
    duration: "8 horas",
  });
  assert.strictEqual(hitFallback.found, true);
  assert.strictEqual(hitFallback.dateType, "weekday");
  assert.strictEqual(hitFallback.priceCop, 200000);
  assert.strictEqual(hitFallback.source, "fallback");
  assert.ok(
    typeof hitFallback.spokenPrice === "string" &&
      hitFallback.spokenPrice.length > 0
  );
  assert.ok(Array.isArray(hitFallback.availableDurations));
  assert.ok(hitFallback.bookingUrl.includes("amartesuite.com"));

  // findCatalogEntry sigue disponible para fallback
  const staticJacuzzi = findCatalogEntry("VIP Jacuzzi");
  assert.ok(staticJacuzzi);
  assert.strictEqual(staticJacuzzi.entry.weekday.h8, 200000);

  // --- SSOT mock Supabase ---
  const mock = new Map([
    [
      "Suite Diamante",
      {
        name: "Suite Diamante",
        kind: "suite",
        weekday: { h4: 240000, h8: 280000, h12: 340000, diaHotelero: 420000 },
        weekend: { h4: 300000, h8: 350000, h12: 420000, diaHotelero: 470000 },
      },
    ],
    [
      "Suite Jacuzzi",
      {
        name: "Suite Jacuzzi",
        kind: "suite",
        weekday: { h4: 200000, h8: 240000, h12: 300000, diaHotelero: 380000 },
        weekend: { h4: 240000, h8: 290000, h12: 360000, diaHotelero: 420000 },
      },
    ],
    [
      "Plan Amarte",
      {
        name: "Plan Amarte",
        kind: "plan",
        weekday: { h6: 210000, h12: 280000, diaHotelero: 320000 },
        weekend: { h6: 200000, h12: 340000, diaHotelero: 380000 },
      },
    ],
  ]);
  setRoomRatesCacheForTests(mock);

  const diamante = await lookupCatalogPrice({
    suite: "Diamante",
    date: "2026-07-09",
    duration: "4 horas",
  });
  assert.strictEqual(diamante.found, true);
  assert.strictEqual(diamante.suite, "Suite Diamante");
  assert.strictEqual(diamante.priceCop, 240000);
  assert.strictEqual(diamante.source, "supabase");
  assert.notStrictEqual(diamante.priceCop, 200000);

  const plan = await lookupCatalogPrice({
    suite: "Plan Amarte",
    date: "2026-07-09",
    duration: "6 horas",
  });
  assert.strictEqual(plan.found, true);
  assert.strictEqual(plan.priceCop, 210000);
  assert.strictEqual(plan.source, "supabase");

  const jacuzziDb = await lookupCatalogPrice({
    suite: "VIP Jacuzzi",
    date: "2026-07-09",
    duration: "8 horas",
  });
  assert.strictEqual(jacuzziDb.found, true);
  assert.strictEqual(jacuzziDb.priceCop, 240000);
  assert.strictEqual(jacuzziDb.source, "supabase");

  const spoken = toSpokenPrice(180000);
  assert.ok(spoken.includes("pesos"));
  assert.ok(!spoken.includes("$"));

  resetRoomRatesCache();
  console.log("catalogLookup tests passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
