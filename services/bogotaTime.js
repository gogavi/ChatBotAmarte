/**
 * Fecha, hora y día de la semana en America/Bogota (servidor).
 */

const BOGOTA_TZ = "America/Bogota";

/**
 * @param {Date} [now]
 * @returns {{
 *   referenceDate: string;
 *   referenceTime: string;
 *   referenceWeekday: string;
 *   referenceIso: string;
 * }}
 */
function getBogotaReference(now = new Date()) {
  let y = "";
  let m = "";
  let d = "";
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: BOGOTA_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    for (const part of fmt.formatToParts(now)) {
      if (part.type === "year") y = part.value;
      if (part.type === "month") m = part.value;
      if (part.type === "day") d = part.value;
    }
  } catch {
    return {
      referenceDate: "",
      referenceTime: "",
      referenceWeekday: "",
      referenceIso: "",
    };
  }

  const referenceDate = `${y}-${m}-${d}`;

  let hh = "00";
  let mm = "00";
  try {
    const tfmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: BOGOTA_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    for (const part of tfmt.formatToParts(now)) {
      if (part.type === "hour") hh = String(part.value).padStart(2, "0");
      if (part.type === "minute") mm = String(part.value).padStart(2, "0");
    }
  } catch {
    // keep 00:00
  }

  const referenceTime = `${hh}:${mm}`;

  let referenceWeekday = "";
  try {
    referenceWeekday = new Intl.DateTimeFormat("es-CO", {
      timeZone: BOGOTA_TZ,
      weekday: "long",
    }).format(now);
  } catch {
    referenceWeekday = "";
  }

  return {
    referenceDate,
    referenceTime,
    referenceWeekday,
    referenceIso: `${referenceDate}T${referenceTime}:00-05:00`,
  };
}

/**
 * @param {string} isoDate YYYY-MM-DD
 * @returns {"weekday"|"weekend"|null}
 */
function dateTypeFromIsoDate(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return null;
  }
  // Interpretar mediodía Bogotá para evitar bordes de DST (Colombia sin DST).
  const d = new Date(`${isoDate}T12:00:00-05:00`);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: BOGOTA_TZ,
    weekday: "short",
  }).format(d);
  // Fri / Sat = weekend
  if (weekday === "Fri" || weekday === "Sat") {
    return "weekend";
  }
  return "weekday";
}

module.exports = {
  BOGOTA_TZ,
  getBogotaReference,
  dateTypeFromIsoDate,
};
