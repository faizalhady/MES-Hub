import { db } from "../db/schema";

const MES_BASE_URL = process.env.MES_BASE_URL!;
const MES_API_KEY = process.env.MES_API_KEY!;

// we know these from our peek script earlier
const FACTORIES = ["P1", "P2", "P3", "P4", "P5", "P6", "P8", "BK"];

async function fetchRouteStepsByFactory(factory: string) {
    console.log(`  Fetching factory: ${factory}...`);

    const res = await fetch(`${MES_BASE_URL}/Route/ListRouteStep`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "ApiKey": MES_API_KEY,
        },
        body: JSON.stringify({ factory, langId: "0" }),
    });

    if (!res.ok) throw new Error(`MES error ${res.status} for factory ${factory}`);

    const raw = (await res.json()) as any[];
    console.log(`    Got ${raw.length} steps`);
    return raw;
}

function transform(raw: any[]) {
    return raw
        .filter(r => r.RouteStep_ID > 0)
        .map(r => ({
            route_step_id: r.RouteStep_ID,
            factory_ma_route_id: r.FactoryMARoute_ID,
            plant: r.FactoryName?.trim() || null,
            bay: r.ManufacturingAreaName?.trim() || null,
            route_name: r.RouteName?.trim() || null,
            step_name: r.StepName?.trim() || null,
            step_description: r.Description?.trim() || null,
            step_order: r.StepOrder,
            step_type: r.StepTypeName?.trim() || null,
            step_id: r.Step_ID,
            is_birthing_station: r.BirthingStation ? 1 : 0,
            last_updated_mes: r.LastUpdated,
        }));
}

function load(records: ReturnType<typeof transform>) {
    const insert = db.prepare(`
    INSERT INTO dim_location (
      route_step_id, factory_ma_route_id, plant, bay,
      route_name, step_name, step_description, step_order,
      step_type, step_id, is_birthing_station,
      last_updated_mes, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(route_step_id) DO UPDATE SET
      factory_ma_route_id = excluded.factory_ma_route_id,
      plant               = excluded.plant,
      bay                 = excluded.bay,
      route_name          = excluded.route_name,
      step_name           = excluded.step_name,
      step_description    = excluded.step_description,
      step_order          = excluded.step_order,
      step_type           = excluded.step_type,
      step_id             = excluded.step_id,
      is_birthing_station = excluded.is_birthing_station,
      last_updated_mes    = excluded.last_updated_mes,
      synced_at           = datetime('now')
  `);

    const upsertAll = db.transaction((rows) => {
        for (const row of rows) {
            try {
                insert.run(
                    row.route_step_id,
                    row.factory_ma_route_id,
                    row.plant,
                    row.bay,
                    row.route_name,
                    row.step_name,
                    row.step_description,
                    row.step_order,
                    row.step_type,
                    row.step_id,
                    row.is_birthing_station,
                    row.last_updated_mes
                );
            } catch (e) {
                console.log("FAILED ROW:", JSON.stringify(row));
                throw e;
            }
        }
    });

    upsertAll(records);
    console.log(`  Upserted ${records.length} rows`);
}
// --- run ---
console.log("Starting dim_location sync...\n");

let total = 0;

for (const factory of FACTORIES) {
    const raw = await fetchRouteStepsByFactory(factory);
    const records = transform(raw);
    load(records);
    total += records.length;
}

console.log(`\nDone. Total rows upserted: ${total}`);

// preview
console.log("\nSample (first 5):");
console.table(
    db.query(`
    SELECT route_step_id, plant, bay, route_name, step_name
    FROM dim_location
    LIMIT 5
  `).all()
);

// unique plants and bays
const plants = db.query("SELECT DISTINCT plant FROM dim_location ORDER BY plant").all();
console.log("\nPlants stored:", plants.map((p: any) => p.plant));