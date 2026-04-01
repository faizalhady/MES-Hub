import { Elysia } from "elysia";
import { db } from "../../db/schema";

export const productionRoutes = new Elysia({ prefix: "/production" })

  .get("/", ({ query }) => {
    const conditions: string[] = [];
    const params: any[] = [];

    if (query.workcell_id) { conditions.push("customer_id = ?"); params.push(query.workcell_id); }
    if (query.bay) { conditions.push("bay = ?"); params.push(query.bay); }
    if (query.assembly) { conditions.push("assembly LIKE ?"); params.push(`%${query.assembly}%`); }
    if (query.route_step) { conditions.push("route_step LIKE ?"); params.push(`%${query.route_step}%`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Number(query.limit) || 100;
    const offset = Number(query.offset) || 0;

    return db.query(`
            SELECT customer_id, workcell_name, bay, batch_id,
                   assembly, route_step, step_order, actual_qty,
                   first_scan_dts, last_scan_dts
            FROM fact_production
            ${where}
            ORDER BY last_scan_dts DESC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);
  })

  .get("/summary", ({ query }) => {
    const conditions: string[] = [];
    const params: any[] = [];

    if (query.workcell_id) { conditions.push("customer_id = ?"); params.push(query.workcell_id); }
    if (query.bay) { conditions.push("bay = ?"); params.push(query.bay); }
    if (query.plant) {
      const ids = (db.query(`
                SELECT DISTINCT m.customer_id FROM map_workcell_bay m
                JOIN dim_location l ON l.bay = m.bay COLLATE NOCASE
                WHERE l.plant = ?
            `).all(query.plant) as { customer_id: number }[]).map(w => w.customer_id);
      if (ids.length > 0) conditions.push(`customer_id IN (${ids.join(",")})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    return db.query(`
            SELECT customer_id, workcell_name, bay,
                   COUNT(DISTINCT batch_id)   as total_batches,
                   COUNT(DISTINCT assembly)   as total_assemblies,
                   COUNT(DISTINCT route_step) as total_steps,
                   SUM(actual_qty)            as total_output,
                   MAX(last_scan_dts)         as latest_activity
            FROM fact_production
            ${where}
            GROUP BY customer_id, workcell_name, bay
            ORDER BY latest_activity DESC
        `).all(...params);
  })

  .get("/by-bay", ({ query }) => {
    const conditions: string[] = [];
    const params: any[] = [];

    if (query.workcell_id) { conditions.push("customer_id = ?"); params.push(query.workcell_id); }
    if (query.plant) {
      const ids = (db.query(`
                SELECT DISTINCT m.customer_id FROM map_workcell_bay m
                JOIN dim_location l ON l.bay = m.bay COLLATE NOCASE
                WHERE l.plant = ?
            `).all(query.plant) as { customer_id: number }[]).map(w => w.customer_id);
      if (ids.length > 0) conditions.push(`customer_id IN (${ids.join(",")})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    return db.query(`
            SELECT customer_id, workcell_name, bay,
                   COUNT(DISTINCT batch_id)  as total_batches,
                   COUNT(DISTINCT assembly)  as total_assemblies,
                   SUM(actual_qty)           as total_output,
                   MAX(last_scan_dts)        as latest_activity
            FROM fact_production
            ${where}
            GROUP BY customer_id, workcell_name, bay
            ORDER BY total_output DESC
        `).all(...params);
  })

  .get("/by-assembly", ({ query }) => {
    const conditions: string[] = [];
    const params: any[] = [];

    if (query.workcell_id) { conditions.push("customer_id = ?"); params.push(query.workcell_id); }
    if (query.bay) { conditions.push("bay = ?"); params.push(query.bay); }
    if (query.plant) {
      const ids = (db.query(`
                SELECT DISTINCT m.customer_id FROM map_workcell_bay m
                JOIN dim_location l ON l.bay = m.bay COLLATE NOCASE
                WHERE l.plant = ?
            `).all(query.plant) as { customer_id: number }[]).map(w => w.customer_id);
      if (ids.length > 0) conditions.push(`customer_id IN (${ids.join(",")})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    return db.query(`
            SELECT customer_id, workcell_name, bay, assembly, batch_id,
                   SUM(actual_qty)     as total_output,
                   MIN(first_scan_dts) as started,
                   MAX(last_scan_dts)  as last_activity
            FROM fact_production
            ${where}
            GROUP BY customer_id, workcell_name, bay, assembly, batch_id
            ORDER BY last_activity DESC
        `).all(...params);
  })

  .get("/latest", ({ query }) => {
    const conditions: string[] = [];
    const params: any[] = [];

    if (query.workcell_id) { conditions.push("customer_id = ?"); params.push(query.workcell_id); }
    if (query.bay) { conditions.push("bay = ?"); params.push(query.bay); }
    if (query.plant) {
      const ids = (db.query(`
                SELECT DISTINCT m.customer_id FROM map_workcell_bay m
                JOIN dim_location l ON l.bay = m.bay COLLATE NOCASE
                WHERE l.plant = ?
            `).all(query.plant) as { customer_id: number }[]).map(w => w.customer_id);
      if (ids.length > 0) conditions.push(`customer_id IN (${ids.join(",")})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Number(query.limit) || 20;

    return db.query(`
            SELECT customer_id, workcell_name, bay,
                   assembly, route_step, actual_qty, last_scan_dts
            FROM fact_production
            ${where}
            ORDER BY last_scan_dts DESC
            LIMIT ?
        `).all(...params, limit);
  });