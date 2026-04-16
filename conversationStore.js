const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

/** @type {import("better-sqlite3").Database | null} */
let db = null;

const DEFAULT_HISTORY_LIMIT = 40;

/**
 * @param {string} absPath - Ruta absoluta al archivo .sqlite
 */
function initConversationStore(absPath) {
  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  db = new Database(absPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chat_conv ON chat_messages(conversation_id, id);
  `);
}

function isStoreReady() {
  return db !== null;
}

/**
 * @param {string} conversationId
 * @param {number} [limit]
 * @returns {Array<{ role: string; content: string }>}
 */
function getPriorMessages(conversationId, limit = DEFAULT_HISTORY_LIMIT) {
  if (!db || !conversationId) {
    return [];
  }
  const rows = db
    .prepare(
      `SELECT role, content FROM chat_messages
       WHERE conversation_id = ?
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(conversationId, limit);
  return rows.reverse().map((r) => ({ role: r.role, content: r.content }));
}

/**
 * @param {string} conversationId
 * @param {string} userContent
 * @param {string} assistantRawContent - Respuesta completa del modelo (incluye [OPTIONS] si aplica)
 */
function appendTurn(conversationId, userContent, assistantRawContent) {
  if (!db || !conversationId) {
    return;
  }
  const insert = db.prepare(
    `INSERT INTO chat_messages (conversation_id, role, content) VALUES (?, ?, ?)`
  );
  const run = db.transaction(() => {
    insert.run(conversationId, "user", userContent);
    insert.run(conversationId, "assistant", assistantRawContent);
  });
  run();
}

module.exports = {
  initConversationStore,
  isStoreReady,
  getPriorMessages,
  appendTurn,
};
