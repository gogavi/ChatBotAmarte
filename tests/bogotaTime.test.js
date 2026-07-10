const assert = require("assert");
const {
  getBogotaReference,
  dateTypeFromIsoDate,
} = require("../services/bogotaTime");

const ref = getBogotaReference(new Date("2026-07-10T20:00:00.000Z"));
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(ref.referenceDate));
assert.ok(/^\d{2}:\d{2}$/.test(ref.referenceTime));
assert.ok(typeof ref.referenceWeekday === "string");
assert.ok(ref.referenceIso.includes("-05:00"));

// 2026-07-10 = viernes → weekend; 2026-07-09 = jueves → weekday
assert.strictEqual(dateTypeFromIsoDate("2026-07-10"), "weekend");
assert.strictEqual(dateTypeFromIsoDate("2026-07-09"), "weekday");
assert.strictEqual(dateTypeFromIsoDate("2026-07-11"), "weekend");
assert.strictEqual(dateTypeFromIsoDate("bad"), null);

console.log("bogotaTime tests passed");
