import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { normalizeRecord, STATES, TYPES } from '../../src/driving/model.js';
import { validRoad } from '../../src/driving/jurisdictions.js';

export const DEFAULT_DB = fileURLToPath(
  new URL('../../.gev-data/enforcement.sqlite', import.meta.url),
);
export function openStore(path = process.env.GEV_ENFORCEMENT_DB || DEFAULT_DB) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, source TEXT NOT NULL, body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY, body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY, record_id TEXT, changed_at TEXT, body TEXT);
    CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, status TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, resolution TEXT);
  `);
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const r = fn();
      db.exec('COMMIT');
      return r;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  function put(record) {
    const previous = db
      .prepare('SELECT body FROM records WHERE id=?')
      .get(record.id);
    const body = JSON.stringify(record);
    if (previous?.body === body) return;
    if (previous)
      db.prepare(
        'INSERT INTO history(record_id,changed_at,body) VALUES(?,?,?)',
      ).run(record.id, new Date().toISOString(), previous.body);
    db.prepare('INSERT OR REPLACE INTO records VALUES(?,?,?)').run(
      record.id,
      record.sourceId,
      body,
    );
  }
  const store = {
    db,
    snapshot() {
      return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        scope: 'United States · partial curated coverage; see /road/',
        records: db
          .prepare('SELECT body FROM records ORDER BY id')
          .all()
          .map((r) => JSON.parse(r.body)),
        sources: db
          .prepare('SELECT body FROM sources ORDER BY id')
          .all()
          .map((r) => JSON.parse(r.body)),
      };
    },
    importSource(source, rows) {
      if (!source?.id || !Array.isArray(rows) || rows.length > 10000)
        throw new Error('Invalid import');
      const records = rows.map(normalizeRecord);
      if (
        records.some((r) => r.sourceId !== source.id) ||
        new Set(records.map((r) => r.id)).size !== records.length
      )
        throw new Error('Duplicate identity or source mismatch');
      transaction(() => {
        const ids = new Set(records.map((r) => r.id));
        for (const old of db
          .prepare('SELECT body FROM records WHERE source=?')
          .all(source.id)) {
          const r = JSON.parse(old.body);
          if (!ids.has(r.id) && !['completed', 'paused'].includes(r.status))
            put({ ...r, status: 'unknown' });
        }
        records.forEach(put);
        db.prepare('INSERT OR REPLACE INTO sources VALUES(?,?)').run(
          source.id,
          JSON.stringify(source),
        );
      });
    },
    sourceFailure(source) {
      const prior = db
        .prepare('SELECT body FROM sources WHERE id=?')
        .get(source.id);
      const body = {
        ...(prior ? JSON.parse(prior.body) : {}),
        ...source,
        lastAttempt: new Date().toISOString(),
        status: 'unavailable',
      };
      db.prepare('INSERT OR REPLACE INTO sources VALUES(?,?)').run(
        source.id,
        JSON.stringify(body),
      );
    },
    report(input) {
      const report = validateReport(input);
      const id = randomUUID();
      if (
        db
          .prepare("SELECT count(*) AS n FROM reports WHERE status='pending'")
          .get().n >= 10000
      )
        throw new Error('Review queue full');
      db.prepare('INSERT INTO reports VALUES(?,?,?,?,NULL)').run(
        id,
        'pending',
        JSON.stringify(report),
        new Date().toISOString(),
      );
      return id;
    },
    reports() {
      return db
        .prepare('SELECT * FROM reports ORDER BY created_at DESC LIMIT 500')
        .all()
        .map((r) => ({ ...r, body: JSON.parse(r.body) }));
    },
    resolve(id, record) {
      if (
        !db
          .prepare("SELECT id FROM reports WHERE id=? AND status='pending'")
          .get(id)
      )
        throw new Error('Pending report not found');
      const clean = record ? normalizeRecord(record) : null;
      transaction(() => {
        if (clean) put(clean);
        db.prepare('UPDATE reports SET status=?, resolution=? WHERE id=?').run(
          clean ? 'approved' : 'rejected',
          clean?.id || 'Rejected by maintainer',
          id,
        );
      });
    },
    close() {
      db.close();
    },
  };
  return store;
}
export function validateReport(input) {
  const text = (s, n) => (typeof s === 'string' ? s.trim().slice(0, n) : '');
  if (
    !STATES.includes(input?.state) ||
    !validRoad(input?.route) ||
    !TYPES.includes(input?.type)
  )
    throw new Error('Choose a supported state, route and type');
  if (!['new', 'correction', 'removed'].includes(input.kind))
    throw new Error('Invalid report kind');
  const details = text(input.details, 2000);
  if (details.length < 10)
    throw new Error(
      'Please include location, direction and evidence in at least 10 characters',
    );
  return {
    kind: input.kind,
    recordId: text(input.recordId, 160),
    state: input.state,
    route: input.route,
    type: input.type,
    details,
  };
}
export function seedStore(store) {
  if (store.snapshot().sources.length) return;
  const seed = JSON.parse(
    readFileSync(
      new URL('../../public/enforcement/snapshot.json', import.meta.url),
      'utf8',
    ),
  );
  for (const source of seed.sources)
    store.importSource(
      source,
      seed.records.filter((r) => r.sourceId === source.id),
    );
}
