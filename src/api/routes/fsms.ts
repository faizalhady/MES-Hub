import { Elysia, t } from "elysia";
import { fsmsDb } from "../../db/fsms-schema";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Zone {
  id: string;
  label: string;
  bay_number: string;
  workcell: string;
  status: string;
  description: string;
  color: string;
  locked: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Layout {
  id: number;
  name: string;
  image_path: string;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const upsertLayout = fsmsDb.prepare(`
  INSERT INTO fsms_layouts (name, image_path, updated_at)
  VALUES (?, ?, datetime('now'))
  ON CONFLICT(name) DO UPDATE SET
    image_path = excluded.image_path,
    updated_at = datetime('now')
`);

const getLayoutByName = fsmsDb.prepare(`
  SELECT * FROM fsms_layouts WHERE name = ?
`);

const deleteZonesByLayout = fsmsDb.prepare(`
  DELETE FROM fsms_zones WHERE layout_id = ?
`);

const insertZone = fsmsDb.prepare(`
  INSERT INTO fsms_zones
    (id, layout_id, label, bay_number, workcell, status, description, color, locked, x, y, w, h)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getZonesByLayout = fsmsDb.prepare(`
  SELECT * FROM fsms_zones WHERE layout_id = ? ORDER BY bay_number
`);

// ─── Routes ───────────────────────────────────────────────────────────────────

export const fsmsRoutes = new Elysia({ prefix: "/fsms" })

  // GET /fsms/layouts — list all saved layouts
  .get("/layouts", () => {
    return fsmsDb.query(`
      SELECT
        l.*,
        COUNT(z.id) as zone_count
      FROM fsms_layouts l
      LEFT JOIN fsms_zones z ON z.layout_id = l.id
      GROUP BY l.id
      ORDER BY l.updated_at DESC
    `).all();
  })

  // GET /fsms/layouts/:name/zones — get all zones for a layout by name
  .get("/layouts/:name/zones", ({ params }) => {
    const layout = getLayoutByName.get(params.name) as Layout | null;
    if (!layout) return new Response("Layout not found", { status: 404 });

    const zones = getZonesByLayout.all(layout.id) as any[];

    // Convert SQLite 0/1 back to boolean for frontend
    return {
      layout,
      zones: zones.map(z => ({ ...z, locked: z.locked === 1 })),
    };
  })

  // POST /fsms/layouts — create layout (no zones)
  .post("/layouts", ({ body }: { body: { name: string; image_path: string } }) => {
    upsertLayout.run(body.name, body.image_path);
    const layout = getLayoutByName.get(body.name) as Layout;
    return { ok: true, layout };
  })

  // PUT /fsms/layouts/:name/zones — full replace all zones for a layout
  .put("/layouts/:name/zones", ({ params, body }: {
    params: { name: string };
    body: { image_path: string; zones: Zone[] };
  }) => {
    // Upsert layout
    upsertLayout.run(params.name, body.image_path);
    const layout = getLayoutByName.get(params.name) as Layout;

    // Replace all zones in a transaction
    const saveAll = fsmsDb.transaction(() => {
      deleteZonesByLayout.run(layout.id);
      for (const z of body.zones) {
        insertZone.run(
          z.id,
          layout.id,
          z.label,
          z.bay_number,
          z.workcell,
          z.status,
          z.description,
          z.color,
          z.locked ? 1 : 0,
          z.x, z.y, z.w, z.h
        );
      }
    });

    saveAll();

    return {
      ok: true,
      layout_id: layout.id,
      zones_saved: body.zones.length,
      saved_at: new Date().toISOString(),
    };
  })

  // ─── Bay routes ──────────────────────────────────────────────────────────────

  // GET /fsms/bays — list all bays, merged with zone data as fallback
  .get("/bays", ({ query }: { query: Record<string, string> }) => {
    const conditions: string[] = [];
    const params: string[] = [];

    if (query.workcell) { conditions.push("workcell = ?"); params.push(query.workcell); }
    if (query.plant)    { conditions.push("plant = ?");    params.push(query.plant); }
    if (query.status)   { conditions.push("status = ?");   params.push(query.status); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // Return bays from fsms_bays, falling back to zone data for unregistered bays
    const fromDb = fsmsDb.query(`
      SELECT
        b.*,
        (b.length_m * b.width_m) as area_sqm,
        (b.length_m * b.width_m * b.rate_per_sqm) as monthly_cost
      FROM fsms_bays b
      ${where}
      ORDER BY b.bay_number
    `).all(...params);

    // Also pull any zones not yet in fsms_bays
    const knownBayNumbers = new Set((fromDb as any[]).map((b: any) => b.bay_number));
    const fromZones = fsmsDb.query(`
      SELECT DISTINCT
        z.bay_number,
        z.workcell,
        z.status,
        NULL as plant,
        NULL as floor,
        NULL as description,
        0 as length_m,
        0 as width_m,
        0 as rate_per_sqm,
        0 as area_sqm,
        0 as monthly_cost,
        '' as line_manager,
        '' as pic,
        NULL as created_at,
        NULL as updated_at
      FROM fsms_zones z
      WHERE z.bay_number IS NOT NULL AND z.bay_number != ''
    `).all() as any[];

    const unregistered = fromZones.filter(z => !knownBayNumbers.has(z.bay_number));

    return [...(fromDb as any[]), ...unregistered];
  })

  // GET /fsms/bays/:bay_number — single bay
  .get("/bays/:bay_number", ({ params }: { params: { bay_number: string } }) => {
    const bay = fsmsDb.query(`
      SELECT
        b.*,
        (b.length_m * b.width_m) as area_sqm,
        (b.length_m * b.width_m * b.rate_per_sqm) as monthly_cost
      FROM fsms_bays b
      WHERE b.bay_number = ?
    `).get(params.bay_number);
    if (!bay) return new Response("Bay not found", { status: 404 });
    return bay;
  })

  // POST /fsms/bays — create or upsert a bay record
  .post("/bays", ({ body }: { body: any }) => {
    fsmsDb.run(`
      INSERT INTO fsms_bays
        (bay_number, workcell, plant, floor, status, description, length_m, width_m, rate_per_sqm, line_manager, pic, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(bay_number) DO UPDATE SET
        workcell     = excluded.workcell,
        plant        = excluded.plant,
        floor        = excluded.floor,
        status       = excluded.status,
        description  = excluded.description,
        length_m     = excluded.length_m,
        width_m      = excluded.width_m,
        rate_per_sqm = excluded.rate_per_sqm,
        line_manager = excluded.line_manager,
        pic          = excluded.pic,
        updated_at   = datetime('now')
    `,
      body.bay_number, body.workcell ?? '', body.plant ?? '',
      body.floor ?? '', body.status ?? 'Active', body.description ?? '',
      body.length_m ?? 0, body.width_m ?? 0, body.rate_per_sqm ?? 0,
      body.line_manager ?? '', body.pic ?? ''
    );
    return { ok: true, bay_number: body.bay_number };
  })

  // PUT /fsms/bays/:bay_number — update bay business data
  .put("/bays/:bay_number", ({ params, body }: { params: { bay_number: string }; body: any }) => {
    fsmsDb.run(`
      INSERT INTO fsms_bays
        (bay_number, workcell, plant, floor, status, description, length_m, width_m, rate_per_sqm, line_manager, pic, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(bay_number) DO UPDATE SET
        workcell     = excluded.workcell,
        plant        = excluded.plant,
        floor        = excluded.floor,
        status       = excluded.status,
        description  = excluded.description,
        length_m     = excluded.length_m,
        width_m      = excluded.width_m,
        rate_per_sqm = excluded.rate_per_sqm,
        line_manager = excluded.line_manager,
        pic          = excluded.pic,
        updated_at   = datetime('now')
    `,
      params.bay_number,
      body.workcell ?? '', body.plant ?? '',
      body.floor ?? '', body.status ?? 'Active', body.description ?? '',
      body.length_m ?? 0, body.width_m ?? 0, body.rate_per_sqm ?? 0,
      body.line_manager ?? '', body.pic ?? ''
    );

    // Also sync workcell + status back to any matching zones
    fsmsDb.run(`
      UPDATE fsms_zones
      SET workcell = ?, status = ?
      WHERE bay_number = ?
    `, body.workcell ?? '', body.status ?? '', params.bay_number);

    return { ok: true, bay_number: params.bay_number };
  });
