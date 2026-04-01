import { Elysia } from "elysia";
import { db } from "../../db/schema";

export const workcellRoutes = new Elysia({ prefix: "/workcells" })

    .get("/", ({ query }) => {
        return db.query(`
      SELECT * FROM dim_workcell
      ORDER BY workcell_name
    `).all();
    })

    .get("/detail", ({ query }) => {
        if (!query.workcell_id) return new Response("workcell_id required", { status: 400 });
        const row = db.query(`
      SELECT * FROM dim_workcell WHERE customer_id = ?
    `).get(query.workcell_id);
        if (!row) return new Response("Not found", { status: 404 });
        return row;
    })

    .get("/bays", ({ query }) => {
        const conditions: string[] = [];
        const params: any[] = [];

        if (query.workcell_id) { conditions.push("m.customer_id = ?"); params.push(query.workcell_id); }
        if (query.plant) { conditions.push("l.plant = ?"); params.push(query.plant); }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        return db.query(`
      SELECT DISTINCT
        m.customer_id,
        m.workcell_name,
        l.plant,
        m.bay,
        COUNT(l.route_step_id) as step_count
      FROM map_workcell_bay m
      LEFT JOIN dim_location l ON l.bay = m.bay
      ${where}
      GROUP BY m.customer_id, m.workcell_name, l.plant, m.bay
      ORDER BY l.plant, m.bay
    `).all(...params);
    })

    .get("/routes", ({ query }) => {
        const conditions: string[] = [];
        const params: any[] = [];

        if (query.workcell_id) { conditions.push("m.customer_id = ?"); params.push(query.workcell_id); }
        if (query.plant) { conditions.push("l.plant = ?"); params.push(query.plant); }
        if (query.bay) { conditions.push("l.bay = ?"); params.push(query.bay); }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        return db.query(`
      SELECT DISTINCT
        m.customer_id,
        m.workcell_name,
        l.plant,
        l.bay,
        l.route_name,
        COUNT(l.route_step_id) as step_count
      FROM map_workcell_bay m
      JOIN dim_location l ON l.bay = m.bay
      ${where}
      GROUP BY m.customer_id, m.workcell_name, l.plant, l.bay, l.route_name
      ORDER BY l.plant, l.bay, l.route_name
    `).all(...params);
    })

    .get("/steps", ({ query }) => {
        const conditions: string[] = [];
        const params: any[] = [];

        if (query.workcell_id) { conditions.push("m.customer_id = ?"); params.push(query.workcell_id); }
        if (query.plant) { conditions.push("l.plant = ?"); params.push(query.plant); }
        if (query.bay) { conditions.push("l.bay = ?"); params.push(query.bay); }
        if (query.route) { conditions.push("l.route_name LIKE ?"); params.push(`%${query.route}%`); }
        if (query.route_step_id) { conditions.push("l.route_step_id = ?"); params.push(query.route_step_id); }
        if (query.step_name) { conditions.push("l.step_name LIKE ?"); params.push(`%${query.step_name}%`); }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        return db.query(`
      SELECT DISTINCT
        m.customer_id,
        m.workcell_name,
        l.route_step_id,
        l.plant,
        l.bay,
        l.route_name,
        l.step_name,
        l.step_description,
        l.step_order,
        l.step_type,
        l.is_birthing_station
      FROM map_workcell_bay m
      JOIN dim_location l ON l.bay = m.bay
      ${where}
      ORDER BY l.plant, l.bay, l.route_name, l.step_order
      LIMIT 200
    `).all(...params);
    })

    .get("/by-plant", ({ query }) => {
        if (!query.plant) return new Response("plant required", { status: 400 });

        return db.query(`
    SELECT DISTINCT
      m.customer_id,
      m.workcell_name,
      COUNT(DISTINCT m.bay) as bay_count
    FROM map_workcell_bay m
    JOIN dim_location l ON l.bay = m.bay
    WHERE l.plant = ?
    GROUP BY m.customer_id, m.workcell_name
    ORDER BY m.workcell_name
  `).all(query.plant);
    })

    .get("/summary", ({ query }) => {
        if (!query.workcell_id) return new Response("workcell_id required", { status: 400 });

        const workcell = db.query(`
      SELECT * FROM dim_workcell WHERE customer_id = ?
    `).get(query.workcell_id);
        if (!workcell) return new Response("Not found", { status: 404 });

        const plantFilter = query.plant ? `AND l.plant = '${query.plant}'` : "";

        const bays = db.query(`
      SELECT COUNT(DISTINCT m.bay) as total_bays
      FROM map_workcell_bay m
      LEFT JOIN dim_location l ON l.bay = m.bay
      WHERE m.customer_id = ? ${plantFilter}
    `).get(query.workcell_id) as { total_bays: number };

        const routes = db.query(`
      SELECT COUNT(DISTINCT l.route_name) as total_routes
      FROM map_workcell_bay m
      JOIN dim_location l ON l.bay = m.bay
      WHERE m.customer_id = ? ${plantFilter}
    `).get(query.workcell_id) as { total_routes: number };

        const steps = db.query(`
      SELECT COUNT(DISTINCT l.route_step_id) as total_steps
      FROM map_workcell_bay m
      JOIN dim_location l ON l.bay = m.bay
      WHERE m.customer_id = ? ${plantFilter}
    `).get(query.workcell_id) as { total_steps: number };

        const plants = db.query(`
      SELECT DISTINCT l.plant
      FROM map_workcell_bay m
      JOIN dim_location l ON l.bay = m.bay
      WHERE m.customer_id = ?
      ORDER BY l.plant
    `).all(query.workcell_id) as { plant: string }[];

        return {
            workcell,
            plants: plants.map(p => p.plant),
            stats: {
                total_bays: bays.total_bays,
                total_routes: routes.total_routes,
                total_steps: steps.total_steps,
            }
        };
    });

