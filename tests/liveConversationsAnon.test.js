/**
 * La clave anon no debe poder usar live_conversations, y ningún cliente
 * del browser llama a esa tabla.
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  classifyAccess,
  isAnonDenied,
  planProbes,
  scanClientUsage,
} = require("../scripts/verify-live-conversations-anon");

assert.strictEqual(
  classifyAccess(401, { message: "Invalid API key" }),
  "auth_failure"
);
assert.strictEqual(isAnonDenied(401, { message: "Invalid API key" }), false);
assert.strictEqual(classifyAccess(403, {}), "auth_failure");
assert.strictEqual(
  classifyAccess(401, { code: "PGRST301", message: "JWT expired" }),
  "auth_failure"
);
assert.strictEqual(
  classifyAccess(401, {
    code: "42501",
    message: "permission denied for table live_conversations",
  }),
  "denied"
);
assert.strictEqual(
  isAnonDenied(403, {
    code: "42501",
    message: "new row violates row-level security policy",
  }),
  true
);
assert.strictEqual(classifyAccess(200, []), "open");
assert.strictEqual(classifyAccess(201, []), "open");
assert.strictEqual(
  classifyAccess(400, { code: "PGRST204", message: "column not found" }),
  "unexpected"
);

const open = planProbes(200, []);
assert.strictEqual(open.selectDenied, false);
assert.strictEqual(open.attemptMutations, false);

const badKey = planProbes(401, { message: "Invalid API key" });
assert.strictEqual(badKey.attemptMutations, false);

const closed = planProbes(401, {
  code: "42501",
  message: "permission denied for table live_conversations",
});
assert.strictEqual(closed.attemptMutations, true);

const root = path.join(__dirname, "..");
const offenders = scanClientUsage(root);
assert.deepStrictEqual(offenders, []);

const sql = fs
  .readFileSync(
    path.join(root, "supabase/migrations/20261020160000_lock_live_conversations.sql"),
    "utf8"
  )
  .toLowerCase();
const enableAt = sql.indexOf(
  "alter table public.live_conversations enable row level security"
);
const revokeAt = sql.indexOf(
  "revoke all on public.live_conversations from anon, authenticated"
);
const grantAt = sql.indexOf(
  "grant all on public.live_conversations to service_role"
);
assert.ok(enableAt >= 0 && revokeAt > enableAt && grantAt > revokeAt);
assert.ok(!/create\s+policy/i.test(sql));

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "live-rls-"));
fs.mkdirSync(path.join(fixture, "public"));
fs.writeFileSync(
  path.join(fixture, "supabaseClient.js"),
  "const key = process.env.SUPABASE_ANON_KEY;\n"
);
fs.writeFileSync(
  path.join(fixture, "public/widget.js"),
  "createClient(url, key);\n"
);
const tableCall = "sb.from(" + '"live_conversations"' + ");\n";
fs.writeFileSync(path.join(fixture, "other.js"), tableCall);
fs.writeFileSync(path.join(fixture, "conversationStore.js"), tableCall);
const flagged = scanClientUsage(fixture);
assert.ok(
  flagged.some((line) => line.startsWith("public/widget.js")),
  flagged.join("\n")
);
assert.ok(
  flagged.some((line) => line.startsWith("other.js")),
  flagged.join("\n")
);
assert.ok(
  flagged.some((line) => line.startsWith("supabaseClient.js")),
  flagged.join("\n")
);
assert.ok(
  !flagged.some((line) => line.startsWith("conversationStore.js")),
  flagged.join("\n")
);

console.log("liveConversationsAnon.test.js: ok");
