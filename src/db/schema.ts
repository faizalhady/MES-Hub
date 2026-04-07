import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { dirname } from "node:path";

const dbPath = process.env.DB_PATH || "data/mes.db";

// Ensure the folder exists before connecting
mkdirSync(dirname(dbPath), { recursive: true });

// This will OPEN your existing file. It only creates a new one if it's missing.
export const db = new Database(dbPath);

// db.run(`
//   CREATE TABLE IF NOT EXISTS dim_workcell (
//     customer_id       INTEGER PRIMARY KEY,
//     workcell_name     TEXT NOT NULL,
//     division_name     TEXT NOT NULL,
//     display_name      TEXT NOT NULL,
//     sap_identifier    TEXT,
//     active            INTEGER DEFAULT 1,
//     last_updated_mes  TEXT,
//     synced_at         TEXT DEFAULT (datetime('now'))
//   )
// `);

// db.run(`
//   CREATE TABLE IF NOT EXISTS dim_location (
//     route_step_id       INTEGER PRIMARY KEY,
//     factory_ma_route_id INTEGER,
//     plant               TEXT,
//     bay                 TEXT,
//     route_name          TEXT,
//     step_name           TEXT,
//     step_description    TEXT,
//     step_order          INTEGER,
//     step_type           TEXT,
//     step_id             INTEGER,
//     is_birthing_station INTEGER DEFAULT 0,
//     last_updated_mes    TEXT,
//     synced_at           TEXT DEFAULT (datetime('now'))
//   )
// `);

// db.run(`
//   CREATE TABLE IF NOT EXISTS map_workcell_bay (
//     customer_id   INTEGER,
//     workcell_name TEXT,
//     bay           TEXT,
//     PRIMARY KEY (customer_id, bay)
//   )
// `);

// db.run(`
//   CREATE TABLE IF NOT EXISTS dim_assembly (
//     assembly_id      INTEGER PRIMARY KEY,
//     customer_id      INTEGER,
//     workcell_name    TEXT,
//     product_number   TEXT,
//     product_name     TEXT,
//     revision         TEXT,
//     version          TEXT,
//     family_name      TEXT,
//     active           INTEGER DEFAULT 1,
//     last_updated_mes TEXT,
//     synced_at        TEXT DEFAULT (datetime('now'))
//   )
// `);

// db.run(`
//   CREATE TABLE IF NOT EXISTS dim_assembly_sync_log (
//     customer_id  INTEGER PRIMARY KEY,
//     synced_at    TEXT
//   )
// `);

// db.run(`
//   CREATE TABLE IF NOT EXISTS fact_production (
//     id               INTEGER PRIMARY KEY AUTOINCREMENT,
//     customer_id      INTEGER,
//     workcell_name    TEXT,
//     batch_id         TEXT,
//     assembly         TEXT,
//     assembly_id      INTEGER,
//     sap_bom          TEXT,
//     route_step       TEXT,
//     bay              TEXT,
//     step_order       INTEGER,
//     actual_qty       INTEGER,
//     first_scan_dts   TEXT,
//     last_scan_dts    TEXT,
//     period_start     TEXT,
//     period_end       TEXT,
//     synced_at        TEXT DEFAULT (datetime('now')),
//     UNIQUE(customer_id, batch_id, route_step, bay)
//   )
// `);

// // fact_production indexes
// db.run(`CREATE INDEX IF NOT EXISTS idx_fact_production_customer
//   ON fact_production(customer_id)`);
// db.run(`CREATE INDEX IF NOT EXISTS idx_fact_production_bay
//   ON fact_production(bay)`);
// db.run(`CREATE INDEX IF NOT EXISTS idx_fact_production_last_scan
//   ON fact_production(last_scan_dts)`);
// db.run(`CREATE INDEX IF NOT EXISTS idx_fact_production_assembly_id
//   ON fact_production(assembly_id)`);

// // dim_location indexes
// db.run(`CREATE INDEX IF NOT EXISTS idx_dim_location_bay
//   ON dim_location(bay)`);

// // map_workcell_bay indexes
// db.run(`CREATE INDEX IF NOT EXISTS idx_map_workcell_bay_customer
//   ON map_workcell_bay(customer_id)`);

console.log("DB ready");
console.log("DB ready");