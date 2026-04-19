import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { dirname } from "node:path";

const dbPath = process.env.FSMS_DB_PATH || "data/fsms.db";

mkdirSync(dirname(dbPath), { recursive: true });

export const fsmsDb = new Database(dbPath);

// ─── Tables ───────────────────────────────────────────────────────────────────

fsmsDb.run(`
  CREATE TABLE IF NOT EXISTS fsms_layouts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    image_path  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

fsmsDb.run(`
  CREATE TABLE IF NOT EXISTS fsms_zones (
    id          TEXT PRIMARY KEY,
    layout_id   INTEGER NOT NULL REFERENCES fsms_layouts(id) ON DELETE CASCADE,
    label       TEXT,
    bay_number  TEXT,
    workcell    TEXT,
    status      TEXT,
    description TEXT,
    color       TEXT,
    locked      INTEGER NOT NULL DEFAULT 0,
    x           REAL NOT NULL,
    y           REAL NOT NULL,
    w           REAL NOT NULL,
    h           REAL NOT NULL
  )
`);

// ─── Indexes ──────────────────────────────────────────────────────────────────

fsmsDb.run(`CREATE INDEX IF NOT EXISTS idx_fsms_zones_layout
  ON fsms_zones(layout_id)`);

fsmsDb.run(`CREATE INDEX IF NOT EXISTS idx_fsms_zones_bay_number
  ON fsms_zones(bay_number)`);

// ─── fsms_bays ────────────────────────────────────────────────────────────────

fsmsDb.run(`
  CREATE TABLE IF NOT EXISTS fsms_bays (
    bay_number    TEXT PRIMARY KEY,
    workcell      TEXT,
    plant         TEXT,
    floor         TEXT,
    status        TEXT DEFAULT 'Active',
    description   TEXT DEFAULT '',
    length_m      REAL DEFAULT 0,
    width_m       REAL DEFAULT 0,
    rate_per_sqm  REAL DEFAULT 0,
    line_manager  TEXT DEFAULT '',
    pic           TEXT DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

fsmsDb.run(`CREATE INDEX IF NOT EXISTS idx_fsms_bays_workcell
  ON fsms_bays(workcell)`);

fsmsDb.run(`CREATE INDEX IF NOT EXISTS idx_fsms_bays_plant
  ON fsms_bays(plant)`);

console.log("FSMS DB ready");
