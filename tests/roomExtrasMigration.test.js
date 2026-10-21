/**
 * Contrato de la migración room_extras. No se aplica a Supabase desde aquí.
 * El repo no tiene pgTAP: el mismo mecanismo que live_conversations
 * (lectura del SQL) es la prueba de la migración.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const sqlPath = path.join(
  root,
  "supabase/migrations/20261021170000_room_extras.sql"
);
const sql = fs.readFileSync(sqlPath, "utf8");
const lower = sql.toLowerCase();

assert.ok(
  /guillermo/i.test(sql),
  "la migración debe pedir confirmación de Guillermo antes de aplicarla"
);
assert.ok(/30-oct-2026|30 oct 2026/i.test(sql));
assert.ok(
  /no aplicar/i.test(sql),
  "el archivo debe decir que no se aplica desde el PR"
);

assert.ok(/create table if not exists public\.room_extras/i.test(sql));
for (const column of [
  "code text not null",
  "nombre text not null",
  "precio numeric",
  "applies_to text not null",
  "activo boolean not null",
  "created_at timestamptz",
  "updated_at timestamptz",
]) {
  assert.ok(lower.includes(column), column);
}
assert.ok(/unique \(code\)/i.test(sql));
assert.ok(/precio >= 0/i.test(sql));

const enableAt = lower.indexOf(
  "alter table public.room_extras enable row level security"
);
const revokeAt = lower.indexOf(
  "revoke all on public.room_extras from anon, authenticated"
);
const grantAt = lower.indexOf(
  "grant all on public.room_extras to service_role"
);
assert.ok(enableAt >= 0 && revokeAt > enableAt && grantAt > revokeAt);
assert.ok(!/create\s+policy/i.test(sql));
assert.ok(
  !/grant\s+(select|all)[^;]*to\s+anon/i.test(sql),
  "las landings no leen room_extras; anon no recibe GRANT"
);

assert.ok(/on conflict \(code\) do update/i.test(sql));
assert.ok(sql.includes("'persona_adicional'"));
assert.ok(sql.includes("'decoracion_sencillas_cabana'"));
assert.ok(sql.includes("'decoracion_vip_tematicas_jacuzzi_sauna'"));
assert.ok(sql.includes("'hora_adicional'"));
assert.ok(sql.includes("60000"));
assert.ok(sql.includes("100000"));
assert.ok(sql.includes("120000"));
assert.ok(sql.includes("30000"));
assert.ok(sql.includes("'*'"));
const values = sql.slice(lower.indexOf("insert into public.room_extras"));
assert.ok(
  values.includes("Suite Amarte,Suite Cabaña,Suite Movimiento,Suite Sencilla")
);
assert.ok(
  values.includes(
    "Suite Diamante,Suite Gold,Suite Rubí,Suite Zafiro,Suite Árabe,Suite Gótica,Suite Queen,Suite Jacuzzi"
  )
);
assert.ok(values.includes("'Suite Sencilla'"));
assert.ok(!values.includes("Suite VIP Jacuzzi"));
assert.ok(!/grant\s+\w+[^;]*\bto\s+authenticated\b/i.test(sql));

function walkJs(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walkJs(abs, out);
      continue;
    }
    if (/\.(js|html|css)$/.test(entry.name)) out.push(abs);
  }
}

const browserFiles = [];
walkJs(path.join(root, "public"), browserFiles);
walkJs(path.join(root, "src"), browserFiles);
for (const file of browserFiles) {
  const body = fs.readFileSync(file, "utf8");
  assert.ok(
    !body.includes("room_extras"),
    `${path.relative(root, file)} no debe nombrar room_extras`
  );
}

const serverFiles = [];
walkJs(root, serverFiles);
for (const file of serverFiles) {
  if (file.endsWith(`${path.sep}services${path.sep}roomRatesCatalog.js`)) continue;
  if (file.includes(`${path.sep}tests${path.sep}`)) continue;
  if (file.includes(`${path.sep}supabase${path.sep}`)) continue;
  const body = fs.readFileSync(file, "utf8");
  assert.ok(
    !body.includes('.from("room_extras")') && !body.includes(".from('room_extras')"),
    `${path.relative(root, file)} no consulta room_extras`
  );
}

console.log("roomExtrasMigration.test.js: ok");
