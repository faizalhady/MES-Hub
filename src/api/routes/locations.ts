import { Elysia } from "elysia";
import { db } from "../../db/schema";

export const locationRoutes = new Elysia({ prefix: "/locations" })

    .get("/", ({ query }) => {
        const conditions: string[] = [];
        const params: any[] = [];

        if (query.plant) {
            conditions.push("plant = ?");
            params.push(query.plant);
        }
        if (query.bay) {
            conditions.push("bay = ?");
            params.push(query.bay);
        }
        if (query.route) {
            conditions.push("route_name LIKE ?");
            params.push(`%${query.route}%`);
        }
        if (query.step) {
            conditions.push("step_name = ?");
            params.push(query.step);
        }

        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        return db.query(`
      SELECT * FROM dim_location
      ${where}
      ORDER BY plant, bay, route_name, step_order
      LIMIT 100
    `).all(...params);
    })

    .get("/plants", () => {
        return db.query(`
      SELECT DISTINCT plant, COUNT(*) as step_count
      FROM dim_location
      WHERE plant IS NOT NULL
      GROUP BY plant
      ORDER BY plant
    `).all();
    })

    .get("/bays", ({ query }) => {
        const conditions: string[] = ["bay IS NOT NULL"];
        const params: any[] = [];

        if (query.plant) {
            conditions.push("plant = ?");
            params.push(query.plant);
        }

        return db.query(`
      SELECT DISTINCT plant, bay, COUNT(*) as step_count
      FROM dim_location
      WHERE ${conditions.join(" AND ")}
      GROUP BY plant, bay
      ORDER BY plant, bay
    `).all(...params);
    })

    .get("/routes", ({ query }) => {
        const conditions: string[] = ["route_name IS NOT NULL"];
        const params: any[] = [];

        if (query.plant) {
            conditions.push("plant = ?");
            params.push(query.plant);
        }
        if (query.bay) {
            conditions.push("bay = ?");
            params.push(query.bay);
        }

        return db.query(`
      SELECT DISTINCT plant, bay, route_name, COUNT(*) as step_count
      FROM dim_location
      WHERE ${conditions.join(" AND ")}
      GROUP BY plant, bay, route_name
      ORDER BY plant, bay, route_name
    `).all(...params);
    })

    .get("/:id", ({ params }) => {
        const row = db.query(`
      SELECT * FROM dim_location WHERE route_step_id = ?
    `).get(params.id);
        if (!row) return new Response("Not found", { status: 404 });
        return row;
    });