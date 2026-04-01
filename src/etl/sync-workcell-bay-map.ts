import { db } from "../db/schema";

const MES_BASE_URL = process.env.MES_BASE_URL!;
const MES_API_KEY = process.env.MES_API_KEY!;

// use a recent date range — just need to discover which bays each workcell uses
// wide range = more coverage
const START_DATE = "2024-01-01 00:00:00";
const END_DATE = "2025-12-31 00:00:00";

async function fetchBaysForWorkcell(customerId: number) {
    const res = await fetch(`${MES_BASE_URL}/Batch/ListBatchCountsByRouteStep`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "ApiKey": MES_API_KEY,
        },
        body: JSON.stringify({
            CustomerID: customerId,
            StartDate: START_DATE,
            EndDate: END_DATE,
        }),
    });

    if (!res.ok) {
        console.log(`  SKIP customer_id ${customerId} — HTTP ${res.status}`);
        return [];
    }

    const raw = (await res.json()) as any[];

    // handle error response shape
    if (!Array.isArray(raw)) {
        console.log(`  SKIP customer_id ${customerId} — non-array response`);
        return [];
    }

    return raw;
}

function extractUniqueBays(raw: any[], customerId: number, workcellName: string) {
    const seen = new Set<string>();
    const result: { customer_id: number; workcell_name: string; bay: string }[] = [];

    for (const r of raw) {
        const bay = r.Bay?.trim();
        if (!bay) continue;
        if (seen.has(bay)) continue;
        seen.add(bay);
        result.push({ customer_id: customerId, workcell_name: workcellName, bay });
    }

    return result;
}

function load(records: { customer_id: number; workcell_name: string; bay: string }[]) {
    const insert = db.prepare(`
    INSERT INTO map_workcell_bay (customer_id, workcell_name, bay)
    VALUES (?, ?, ?)
    ON CONFLICT(customer_id, bay) DO UPDATE SET
      workcell_name = excluded.workcell_name
  `);

    const upsertAll = db.transaction((rows) => {
        for (const row of rows) {
            insert.run(row.customer_id, row.workcell_name, row.bay);
        }
    });

    upsertAll(records);
}

// --- run ---
console.log("Starting workcell → bay mapping sync...\n");

// get all workcells from SQLite
const workcells = db.query(`
  SELECT customer_id, workcell_name FROM dim_workcell
  WHERE active = 1
  ORDER BY customer_id
`).all() as { customer_id: number; workcell_name: string }[];

console.log(`Found ${workcells.length} active workcells\n`);

let totalMapped = 0;
let skipped = 0;

for (const wc of workcells) {
    process.stdout.write(`  [${wc.customer_id}] ${wc.workcell_name}... `);

    const raw = await fetchBaysForWorkcell(wc.customer_id);

    if (raw.length === 0) {
        console.log("no data");
        skipped++;
        continue;
    }

    const records = extractUniqueBays(raw, wc.customer_id, wc.workcell_name);
    load(records);

    console.log(`${records.length} bays`);
    totalMapped += records.length;
}

console.log(`\nDone.`);
console.log(`Total mappings stored: ${totalMapped}`);
console.log(`Workcells with no data: ${skipped}`);

// preview
console.log("\nSample mappings:");
console.table(
    db.query(`
    SELECT w.workcell_name, m.bay
    FROM map_workcell_bay m
    JOIN dim_workcell w ON w.customer_id = m.customer_id
    ORDER BY w.workcell_name
    LIMIT 10
  `).all()
);