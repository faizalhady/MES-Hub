import { db } from "../db/schema";

const MES_BASE_URL = process.env.MES_BASE_URL!;
const MES_API_KEY = process.env.MES_API_KEY!;

async function fetchWorkcells() {
    console.log("Fetching workcells from MES...");

    const res = await fetch(`${MES_BASE_URL}/Customer/ListCustomer`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "ApiKey": MES_API_KEY,
        },
        body: JSON.stringify({ partialKey: "", active: "1" }),
    });

    if (!res.ok) throw new Error(`MES error: ${res.status} ${res.statusText}`);

    const raw = (await res.json()) as any[];
    console.log(`Got ${raw.length} records from MES`);
    return raw;
}

function transform(raw: any[]) {
    return raw.map((r, i) => ({
        customer_id: r.Customer_ID,
        workcell_name: r.CustomerName || `UNKNOWN_${i + 1}`,
        division_name: r.DivisionName || `UNKNOWN_${i + 1}`,
        display_name: r.CustomerDivisionName || `UNKNOWN / UNKNOWN_${i + 1}`,
        sap_identifier: r.SAPIdentifier || null,
        active: r.Active ? 1 : 0,
        last_updated_mes: r.LastUpdated,
    }));
}

function load(records: ReturnType<typeof transform>) {
    const insert = db.prepare(`
    INSERT INTO dim_workcell (
      customer_id, workcell_name, division_name, display_name,
      sap_identifier, active, last_updated_mes, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(customer_id) DO UPDATE SET
      workcell_name     = excluded.workcell_name,
      division_name     = excluded.division_name,
      display_name      = excluded.display_name,
      sap_identifier    = excluded.sap_identifier,
      active            = excluded.active,
      last_updated_mes  = excluded.last_updated_mes,
      synced_at         = datetime('now')
  `);

    const upsertAll = db.transaction((rows) => {
        for (const row of rows) {
            try {
                insert.run(
                    row.customer_id,
                    row.workcell_name,
                    row.division_name,
                    row.display_name,
                    row.sap_identifier,
                    row.active,
                    row.last_updated_mes
                );
            } catch (e) {
                console.log("FAILED ROW:", JSON.stringify(row));
                throw e;
            }
        }
    });;

    upsertAll(records);
    console.log(`Upserted ${records.length} workcells into SQLite`);
}

// --- run ---
// --- run ---
const raw = await fetchWorkcells();
const records = transform(raw);

// DEBUG - print ALL records
console.log("All transformed records:");
records.forEach((r, i) => {
    console.log(i, JSON.stringify(r));
});

load(records);

console.log("\nSample (first 5):");
console.table(
    db.query("SELECT customer_id, workcell_name, division_name, display_name FROM dim_workcell LIMIT 5").all()
);