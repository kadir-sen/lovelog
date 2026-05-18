// SQLite-tabanlı chat storage. better-sqlite3 (sync) — Lightsail tek-instance
// ölçeğinde gayet yeterli. Veri yolu: $DATA_DIR (default /data) altında lovelog.sqlite.
//
// Schema:
//   chats(id TEXT PK, deviceId TEXT, name TEXT, uploadedAt INTEGER,
//         sizeBytes INTEGER, raw TEXT)
//
// Privacy: raw mesaj DB'de tutulur. Erişim "link-onaylı" model — her cihaz
// kendi device-id'siyle isolate. Backend tek instance, tek SQLite dosyası.

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = process.env.DATA_DIR ?? '/data';
const DB_PATH = path.join(DATA_DIR, 'lovelog.sqlite');

mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS chats (
    id          TEXT PRIMARY KEY,
    deviceId    TEXT NOT NULL,
    name        TEXT NOT NULL,
    uploadedAt  INTEGER NOT NULL,
    sizeBytes   INTEGER NOT NULL,
    raw         TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS chats_device_idx ON chats(deviceId, uploadedAt DESC);

  -- Partner invite tokens (Phase A: read-only viewer link).
  -- A user generates a token that exposes their saved chat's analysis to
  -- anyone with the link; expires after 30 days; sahibi revoke edebilir.
  CREATE TABLE IF NOT EXISTS invites (
    token       TEXT PRIMARY KEY,
    deviceId    TEXT NOT NULL,
    chatId      TEXT NOT NULL,
    createdAt   INTEGER NOT NULL,
    expiresAt   INTEGER NOT NULL,
    viewCount   INTEGER NOT NULL DEFAULT 0,
    revoked     INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS invites_device_idx ON invites(deviceId, createdAt DESC);

  -- Bağlanma stili quiz responses (lead magnet).
  -- Email is THE only PII the server stores; quiz can be filled with or
  -- without an installed app (deviceId nullable, source tracks origin).
  CREATE TABLE IF NOT EXISTS quizzes (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL,
    responses   TEXT NOT NULL,
    result      TEXT NOT NULL,
    submittedAt INTEGER NOT NULL,
    deviceId    TEXT,
    source      TEXT
  );
  CREATE INDEX IF NOT EXISTS quizzes_email_idx ON quizzes(email);
  CREATE INDEX IF NOT EXISTS quizzes_submitted_idx ON quizzes(submittedAt DESC);

  -- Telemetry event sink. Best-effort, optional — only used when client
  -- consents. No raw chat content ever; props is JSON-encoded primitives.
  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId    TEXT NOT NULL,
    name        TEXT NOT NULL,
    props       TEXT,
    ts          INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS events_device_ts_idx ON events(deviceId, ts DESC);
  CREATE INDEX IF NOT EXISTS events_name_idx ON events(name, ts DESC);
`);

export interface ChatRow {
  id: string;
  deviceId: string;
  name: string;
  uploadedAt: number;
  sizeBytes: number;
  raw: string;
}

export interface ChatSummary {
  id: string;
  name: string;
  uploadedAt: number;
  sizeBytes: number;
}

const insertStmt = db.prepare<[string, string, string, number, number, string]>(
  `INSERT INTO chats (id, deviceId, name, uploadedAt, sizeBytes, raw)
   VALUES (?, ?, ?, ?, ?, ?)`
);

const listStmt = db.prepare<[string]>(
  `SELECT id, name, uploadedAt, sizeBytes
   FROM chats WHERE deviceId = ?
   ORDER BY uploadedAt DESC`
);

const getStmt = db.prepare<[string, string]>(
  `SELECT id, deviceId, name, uploadedAt, sizeBytes, raw
   FROM chats WHERE id = ? AND deviceId = ?`
);

const deleteStmt = db.prepare<[string, string]>(
  `DELETE FROM chats WHERE id = ? AND deviceId = ?`
);

const deleteByDeviceStmt = db.prepare<[string]>(
  `DELETE FROM chats WHERE deviceId = ?`
);

const countByDeviceStmt = db.prepare<[string]>(
  `SELECT COUNT(*) AS c FROM chats WHERE deviceId = ?`
);

export const createChat = (
  deviceId: string,
  name: string,
  raw: string
): ChatSummary => {
  const id = 'c_' + crypto.randomBytes(8).toString('hex');
  const uploadedAt = Date.now();
  const sizeBytes = Buffer.byteLength(raw, 'utf8');
  insertStmt.run(id, deviceId, name, uploadedAt, sizeBytes, raw);
  return { id, name, uploadedAt, sizeBytes };
};

export const listChats = (deviceId: string): ChatSummary[] =>
  listStmt.all(deviceId) as ChatSummary[];

export const getChat = (deviceId: string, id: string): ChatRow | undefined =>
  getStmt.get(id, deviceId) as ChatRow | undefined;

export const deleteChat = (deviceId: string, id: string): boolean => {
  const info = deleteStmt.run(id, deviceId);
  return info.changes > 0;
};

export const deleteAllForDevice = (deviceId: string): number => {
  // Mağaza zorunluğu: cihaza ait tüm sunucu durumunu temizle. Yeni tabloları
  // (invites, events) da burada nuke ediyoruz; aynı endpoint çağrısı her şeyi
  // tek defada siler. Quiz responses email-bazlı ve ayrı PII modeli olduğu
  // için burada DOKUNULMAZ — kullanıcı email silme talebi varsa ayrı flow.
  db.prepare('DELETE FROM invites WHERE deviceId = ?').run(deviceId);
  db.prepare('DELETE FROM events WHERE deviceId = ?').run(deviceId);
  const info = deleteByDeviceStmt.run(deviceId);
  return info.changes;
};

export const countChats = (deviceId: string): number => {
  const row = countByDeviceStmt.get(deviceId) as { c: number };
  return row.c;
};

// Per-device sınırlar — aşağı yukarı koruma; kötüye-kullanım önler.
export const STORAGE_LIMITS = {
  maxChatsPerDevice: 50,
  maxRawBytesPerChat: 5 * 1024 * 1024, // 5MB
  maxNameLength: 200,
} as const;

// =============================================================================
// Invites — partner-share read-only viewer tokens (Phase A).
// =============================================================================

export interface InviteRow {
  token: string;
  deviceId: string;
  chatId: string;
  createdAt: number;
  expiresAt: number;
  viewCount: number;
  revoked: number;
}

const insertInviteStmt = db.prepare<[string, string, string, number, number]>(
  `INSERT INTO invites (token, deviceId, chatId, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)`
);
const getInviteStmt = db.prepare<[string]>(
  `SELECT token, deviceId, chatId, createdAt, expiresAt, viewCount, revoked
   FROM invites WHERE token = ?`
);
const incrementInviteViewStmt = db.prepare<[string]>(
  `UPDATE invites SET viewCount = viewCount + 1 WHERE token = ?`
);
const revokeInviteStmt = db.prepare<[string, string]>(
  `UPDATE invites SET revoked = 1 WHERE token = ? AND deviceId = ?`
);
const listInvitesForDeviceStmt = db.prepare<[string]>(
  `SELECT token, deviceId, chatId, createdAt, expiresAt, viewCount, revoked
   FROM invites WHERE deviceId = ?
   ORDER BY createdAt DESC LIMIT 50`
);
const deleteInvitesForDeviceStmt = db.prepare<[string]>(
  `DELETE FROM invites WHERE deviceId = ?`
);

export const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const createInvite = (deviceId: string, chatId: string): InviteRow => {
  // 24 chars from a URL-safe alphabet — high entropy, link-shareable.
  const token = crypto.randomBytes(18).toString('base64url').slice(0, 24);
  const now = Date.now();
  const expiresAt = now + INVITE_TTL_MS;
  insertInviteStmt.run(token, deviceId, chatId, now, expiresAt);
  return { token, deviceId, chatId, createdAt: now, expiresAt, viewCount: 0, revoked: 0 };
};

export const getInvite = (token: string): InviteRow | undefined =>
  getInviteStmt.get(token) as InviteRow | undefined;

export const incrementInviteView = (token: string): void => {
  incrementInviteViewStmt.run(token);
};

export const revokeInvite = (deviceId: string, token: string): boolean => {
  const info = revokeInviteStmt.run(token, deviceId);
  return info.changes > 0;
};

export const listInvitesForDevice = (deviceId: string): InviteRow[] =>
  listInvitesForDeviceStmt.all(deviceId) as InviteRow[];

// =============================================================================
// Quizzes — attachment-style lead magnet.
// =============================================================================

export interface QuizRow {
  id: string;
  email: string;
  responses: string;   // JSON string
  result: string;
  submittedAt: number;
  deviceId: string | null;
  source: string | null;
}

const insertQuizStmt = db.prepare<[string, string, string, string, number, string | null, string | null]>(
  `INSERT INTO quizzes (id, email, responses, result, submittedAt, deviceId, source)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

export const insertQuiz = (input: {
  email: string;
  responses: unknown;
  result: string;
  deviceId?: string | null;
  source?: string | null;
}): QuizRow => {
  const id = 'q_' + crypto.randomBytes(10).toString('hex');
  const submittedAt = Date.now();
  const responsesJson = JSON.stringify(input.responses);
  insertQuizStmt.run(
    id,
    input.email,
    responsesJson,
    input.result,
    submittedAt,
    input.deviceId ?? null,
    input.source ?? null,
  );
  return {
    id,
    email: input.email,
    responses: responsesJson,
    result: input.result,
    submittedAt,
    deviceId: input.deviceId ?? null,
    source: input.source ?? null,
  };
};

// =============================================================================
// Events — telemetry sink. Best-effort write.
// =============================================================================

const insertEventStmt = db.prepare<[string, string, string | null, number]>(
  `INSERT INTO events (deviceId, name, props, ts) VALUES (?, ?, ?, ?)`
);

export const insertEvent = (
  deviceId: string,
  name: string,
  props?: unknown,
): void => {
  try {
    const propsJson = props ? JSON.stringify(props) : null;
    insertEventStmt.run(deviceId, name, propsJson, Date.now());
  } catch (e) {
    // Never let telemetry break the request handler.
    console.warn('[storage] insertEvent failed', e);
  }
};

