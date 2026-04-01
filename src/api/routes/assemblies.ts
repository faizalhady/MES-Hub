import { Elysia } from "elysia";
import { db } from "../../db/schema";

const MES_BASE_URL = process.env.MES_BASE_URL!;
const MES_API_KEY = process.env.MES_API_KEY!;
const CACHE_TTL_HOURS = 24;

function isCacheStale(customerId: number): boolean {
    const log = db.query(`
    SELECT synced_at FROM dim_assembly_sync_log WHERE customer_id = ?
  `).get(customerId) as { synced_at: string } | null;

    if (!log) return true;

    const syncedAt = new Date(log.synced_at);
    const hoursSince = (Date.now() - syncedAt.getTime()) / 1000 / 3600;
    return hoursSince > CACHE_TTL_HOURS;
}

async function fetchAndCacheAssemblies(customerId: number) {
    const res = await fetch(`${MES_BASE_URL}/Assembly/ListAssembly`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "ApiKey": MES_API_KEY,
        },
        body: JSON.stringify({
            custId: customerId,
            active: "1",
            partialKey: "",
            langId: "0",
        }),
    });

    if (!res.ok) throw new Error(`MES error: ${res.status}`);
    const raw = (await res.json()) as any[];

    const insert = db.prepare(`
    INSERT INTO dim_assembly (
      assembly_id, customer_id, workcell_name,
      product_number, product_name, revision, version,
      family_name, active, last_updated_mes, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(assembly_id) DO UPDATE SET
      customer_id      = excluded.customer_id,
      workcell_name    = excluded.workcell_name,
      product_number   = excluded.product_number,
      product_name     = excluded.product_name,
      revision         = excluded.revision,
      version          = excluded.version,
      family_name      = excluded.family_name,
      active           = excluded.active,
      last_updated_mes = excluded.last_updated_mes,
      synced_at        = datetime('now')
  `);

    const logInsert = db.prepare(`
    INSERT INTO dim_assembly_sync_log (customer_id, synced_at)
    VALUES (?, datetime('now'))
    ON CONFLICT(customer_id) DO UPDATE SET synced_at = datetime('now')
  `);

    const upsertAll = db.transaction((rows: any[]) => {
        for (const r of rows) {
            insert.run(
                r.Assembly_ID,
                r.Customer_ID,
                r.CustomerText?.trim() || null,
                r.Number?.trim() || null,
                r.AssemblyName?.trim() || null,
                r.Revision?.trim() || null,
                r.Version?.trim() || null,
                r.FamilyName?.trim() || null,
                r.Active ? 1 : 0,
                r.LastUpdated
            );
        }
        logInsert.run(customerId);
    });

    upsertAll(raw);
    return raw.length;
}

export const assemblyRoutes = new Elysia({ prefix: "/assemblies" })

    .get("/", async ({ query }) => {
        if (!query.workcell_id) return new Response("workcell_id required", { status: 400 });

        const customerId = Number(query.workcell_id);

        if (isCacheStale(customerId)) {
            try {
                await fetchAndCacheAssemblies(customerId);
            } catch (e) {
                const count = db.query(`
          SELECT COUNT(*) as c FROM dim_assembly WHERE customer_id = ?
        `).get(customerId) as { c: number };
                if (count.c === 0) return new Response("Failed to fetch from MES", { status: 502 });
            }
        }

        const conditions: string[] = ["customer_id = ?"];
        const params: any[] = [customerId];

        if (query.family) { conditions.push("family_name = ?"); params.push(query.family); }
        if (query.search) { conditions.push("product_number LIKE ?"); params.push(`%${query.search}%`); }

        const where = `WHERE ${conditions.join(" AND ")}`;
        const limit = Number(query.limit) || 100;
        const offset = Number(query.offset) || 0;

        const rows = db.query(`
      SELECT assembly_id, customer_id, workcell_name,
             product_number, product_name, revision,
             family_name, active, last_updated_mes
      FROM dim_assembly
      ${where}
      ORDER BY product_number
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

        const total = db.query(`
      SELECT COUNT(*) as count FROM dim_assembly ${where}
    `).get(...params) as { count: number };

        const lastSync = db.query(`
      SELECT synced_at FROM dim_assembly_sync_log WHERE customer_id = ?
    `).get(customerId) as { synced_at: string } | null;

        return {
            total: total.count,
            limit,
            offset,
            last_synced: lastSync?.synced_at,
            data: rows
        };
    })

    .get("/families", async ({ query }) => {
        if (!query.workcell_id) return new Response("workcell_id required", { status: 400 });

        const customerId = Number(query.workcell_id);

        if (isCacheStale(customerId)) {
            await fetchAndCacheAssemblies(customerId);
        }

        return db.query(`
      SELECT family_name, COUNT(*) as assembly_count
      FROM dim_assembly
      WHERE customer_id = ?
      GROUP BY family_name
      ORDER BY family_name
    `).all(customerId);
    })

    // single product detail
    .get("/detail", ({ query }) => {
        if (!query.assembly_id) return new Response("assembly_id required", { status: 400 });

        return db.query(`
    SELECT * FROM dim_assembly WHERE assembly_id = ?
  `).get(query.assembly_id);
    })

    // production history for a specific product
    .get("/production", ({ query }) => {
        if (!query.workcell_id && !query.assembly_id)
            return new Response("workcell_id or assembly_id required", { status: 400 });

        const conditions: string[] = [];
        const params: any[] = [];

        if (query.workcell_id) { conditions.push("f.customer_id = ?"); params.push(query.workcell_id); }
        if (query.assembly_id) {
            // get product_number from dim_assembly first
            const asm = db.query(`
      SELECT product_number, revision FROM dim_assembly WHERE assembly_id = ?
    `).get(query.assembly_id) as { product_number: string; revision: string } | null;

            if (asm) {
                conditions.push("f.assembly LIKE ?");
                params.push(`%${asm.product_number}%`);
            }
        }
        if (query.product_number) {
            conditions.push("f.assembly LIKE ?");
            params.push(`%${query.product_number}%`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        return db.query(`
    SELECT
      f.workcell_name,
      f.bay,
      f.batch_id,
      f.assembly,
      f.route_step,
      f.step_order,
      f.actual_qty,
      f.first_scan_dts,
      f.last_scan_dts
    FROM fact_production f
    ${where}
    ORDER BY f.last_scan_dts DESC
    LIMIT 200
  `).all(...params);
    })

    .get("/refresh", async ({ query }) => {
        if (!query.workcell_id) return new Response("workcell_id required", { status: 400 });
        const count = await fetchAndCacheAssemblies(Number(query.workcell_id));
        return { refreshed: true, count };
    });