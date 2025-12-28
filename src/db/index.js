import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Data directory in user's home
const DATA_DIR = join(homedir(), '.vibecoding-chronicle');
const DB_PATH = join(DATA_DIR, 'chronicle.db');

let db = null;

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb() {
  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Create tables using better-sqlite3's run method for DDL
  const schema = `
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      tool TEXT NOT NULL,
      project TEXT,
      project_path TEXT,
      started_at TEXT,
      ended_at TEXT,
      message_count INTEGER DEFAULT 0,
      summary TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT,
      timestamp TEXT,
      tool_name TEXT,
      tool_input TEXT,
      tool_output TEXT,
      thinking TEXT,
      position INTEGER,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS stars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, message_id, tag)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_tool ON sessions(tool);
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project);
    CREATE INDEX IF NOT EXISTS idx_stars_session ON stars(session_id);

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      position INTEGER DEFAULT 0
    );
  `;

  // Run schema using the database's native method
  db.prepare(schema.split(';').filter(s => s.trim())[0] + ';').run();

  // Actually, better-sqlite3 has db.exec for running multiple statements
  // This is SQLite's exec, NOT child_process.exec - completely safe
  runSchema(db, schema);

  // Insert default tags if none exist
  initDefaultTags();

  return db;
}

// Insert default tags on first run
function initDefaultTags() {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM tags').get();
  if (count.cnt === 0) {
    const defaultTags = [
      { id: 'troubleshooting', label: 'Troubleshooting', position: 0 },
      { id: 'best-practice', label: 'Best Practice', position: 1 },
      { id: 'lesson', label: 'Lesson', position: 2 },
    ];

    const stmt = db.prepare(`
      INSERT INTO tags (id, label, position)
      VALUES (@id, @label, @position)
    `);

    for (const tag of defaultTags) {
      stmt.run(tag);
    }
  }
}

// Helper to run multi-statement SQL (SQLite exec, not shell exec)
function runSchema(database, sql) {
  const statements = sql.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    if (stmt.trim()) {
      database.prepare(stmt).run();
    }
  }
}

// Session operations
export function upsertSession(session) {
  const stmt = db.prepare(`
    INSERT INTO sessions (id, tool, project, project_path, started_at, ended_at, message_count, summary)
    VALUES (@id, @tool, @project, @project_path, @started_at, @ended_at, @message_count, @summary)
    ON CONFLICT(id) DO UPDATE SET
      message_count = @message_count,
      ended_at = @ended_at,
      summary = @summary
  `);
  return stmt.run(session);
}

export function getSession(id) {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
}

export function getAllSessions() {
  return db.prepare(`
    SELECT * FROM sessions
    ORDER BY started_at DESC
  `).all();
}

export function sessionExists(id) {
  const result = db.prepare('SELECT 1 FROM sessions WHERE id = ?').get(id);
  return !!result;
}

// Message operations
export function insertMessages(sessionId, messages) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO messages (id, session_id, type, content, timestamp, tool_name, tool_input, tool_output, thinking, position)
    VALUES (@id, @session_id, @type, @content, @timestamp, @tool_name, @tool_input, @tool_output, @thinking, @position)
  `);

  const insertMany = db.transaction((msgs) => {
    for (const msg of msgs) {
      stmt.run({
        id: msg.id,
        session_id: sessionId,
        type: msg.type,
        content: msg.content || null,
        timestamp: msg.timestamp || null,
        tool_name: msg.tool_name || null,
        tool_input: msg.tool_input ? JSON.stringify(msg.tool_input) : null,
        tool_output: msg.tool_output || null,
        thinking: msg.thinking || null,
        position: msg.position
      });
    }
  });

  insertMany(messages);
}

export function getMessages(sessionId) {
  return db.prepare(`
    SELECT * FROM messages
    WHERE session_id = ?
    ORDER BY position ASC
  `).all(sessionId);
}

// Star operations
export function getStar(sessionId, messageId) {
  return db.prepare(`
    SELECT * FROM stars WHERE session_id = ? AND message_id = ?
  `).get(sessionId, messageId);
}

export function getStarsForSession(sessionId) {
  return db.prepare(`
    SELECT * FROM stars WHERE session_id = ?
  `).all(sessionId);
}

export function getAllStars() {
  return db.prepare(`
    SELECT s.*, ss.project, ss.tool
    FROM stars s
    JOIN sessions ss ON s.session_id = ss.id
    ORDER BY s.created_at DESC
  `).all();
}

export function addTag(sessionId, messageId, tag, note = '') {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO stars (session_id, message_id, tag, note)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(sessionId, messageId, tag, note);
}

export function removeTag(sessionId, messageId, tag) {
  return db.prepare(`
    DELETE FROM stars WHERE session_id = ? AND message_id = ? AND tag = ?
  `).run(sessionId, messageId, tag);
}

export function getMessageTags(sessionId, messageId) {
  return db.prepare(`
    SELECT tag, note FROM stars WHERE session_id = ? AND message_id = ?
  `).all(sessionId, messageId);
}

// Legacy compatibility
export function upsertStar(sessionId, messageId, tag, note) {
  return addTag(sessionId, messageId, tag, note);
}

export function deleteStar(sessionId, messageId) {
  return db.prepare(`
    DELETE FROM stars WHERE session_id = ? AND message_id = ?
  `).run(sessionId, messageId);
}

export function getStarCounts() {
  return db.prepare(`
    SELECT tag, COUNT(*) as count FROM stars GROUP BY tag
  `).all();
}

// Tag operations
export function getAllTags() {
  return db.prepare(`
    SELECT * FROM tags ORDER BY position ASC
  `).all();
}

export function getTagsWithCounts() {
  return db.prepare(`
    SELECT t.*, COALESCE(s.count, 0) as count
    FROM tags t
    LEFT JOIN (
      SELECT tag, COUNT(*) as count FROM stars GROUP BY tag
    ) s ON t.id = s.tag
    ORDER BY t.position ASC
  `).all();
}

export function getTag(id) {
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
}

export function createTag(tag) {
  // Get max position
  const maxPos = db.prepare('SELECT MAX(position) as max FROM tags').get();
  const position = (maxPos.max || 0) + 1;

  const stmt = db.prepare(`
    INSERT INTO tags (id, label, position)
    VALUES (@id, @label, @position)
  `);
  return stmt.run({ ...tag, position });
}

export function updateTag(id, updates) {
  if (!updates.label) return null;

  const stmt = db.prepare('UPDATE tags SET label = ? WHERE id = ?');
  return stmt.run(updates.label, id);
}

export function deleteTag(id) {
  // Check if tag is used
  const usage = db.prepare('SELECT COUNT(*) as count FROM stars WHERE tag = ?').get(id);
  if (usage.count > 0) {
    return { error: 'Tag is in use', count: usage.count };
  }

  return db.prepare('DELETE FROM tags WHERE id = ?').run(id);
}

export function getTagUsageCount(tagId) {
  const result = db.prepare('SELECT COUNT(*) as count FROM stars WHERE tag = ?').get(tagId);
  return result.count;
}

// Get tag counts per session (for session list)
export function getSessionTagCounts() {
  return db.prepare(`
    SELECT session_id, COUNT(DISTINCT message_id) as tag_count
    FROM stars
    GROUP BY session_id
  `).all();
}

// Get messages with tags (for tags.html page)
export function getTaggedMessages(tagFilter = null) {
  const query = `
    SELECT
      m.id as message_id,
      m.session_id,
      m.content,
      m.type,
      m.timestamp,
      s.tag,
      ss.project,
      ss.tool,
      ss.summary as session_summary,
      ss.started_at as session_date
    FROM stars s
    JOIN messages m ON s.session_id = m.session_id AND s.message_id = m.id
    JOIN sessions ss ON s.session_id = ss.id
    ${tagFilter ? 'WHERE s.tag = ?' : ''}
    ORDER BY s.created_at DESC
  `;

  if (tagFilter) {
    return db.prepare(query).all(tagFilter);
  }
  return db.prepare(query).all();
}
