import { db } from "../db/schema";

const MES_BASE_URL = process.env.MES_BASE_URL!;
const MES_API_KEY = process.env.MES_API_KEY!;

const P1_ACTIVE_WORKCELLS = [
    { customer_id: 51, workcell_name: "ADVANTEST" },
    { customer_id: 68, workcell_name: "ARISTANETWORKS" },
    { customer_id: 110, workcell_name: "ARISTA_NETWORKS_GLACIER" },
    { customer_id: 66, workcell_name: "ASP" },
    { customer_id: 78, workcell_name: "BD" },
    { customer_id: 95, workcell_name: "BECKMAN COULTER" },
    { customer_id: 23, workcell_name: "BEDFORD" },
    { customer_id: 112, workcell_name: "ELENION TECHNOLOGIES" },
    { customer_id: 205, workcell_name: "FORTALEZA" },
    { customer_id: 216, workcell_name: "HMB" },
    { customer_id: 207, workcell_name: "ILLUMINA" },
    { customer_id: 50, workcell_name: "INFINERA" },
    { customer_id: 188, workcell_name: "INTEL OPTICS" },
    { customer_id: 7, workcell_name: "KEYSIGHT" },
    { customer_id: 102, workcell_name: "K_CTEC" },
    { customer_id: 57, workcell_name: "LAMRESEARCH" },
    { customer_id: 49, workcell_name: "LTX" },
    { customer_id: 118, workcell_name: "MICRON SIG" },
    { customer_id: 59, workcell_name: "Masimo" },
    { customer_id: 199, workcell_name: "Medtronic" },
    { customer_id: 186, workcell_name: "Motorola" },
    { customer_id: 144, workcell_name: "Nokia Optics" },
    { customer_id: 80, workcell_name: "ResMed" },
    { customer_id: 99, workcell_name: "SHINKAWA" },
    { customer_id: 86, workcell_name: "TED" },
    { customer_id: 208, workcell_name: "TERRA SANA" },
    { customer_id: 72, workcell_name: "TMO" },
    { customer_id: 82, workcell_name: "UTAS" },
    { customer_id: 142, workcell_name: "WABTEC" },
];

// default to last 30 days — can be overridden via args
const END_DATE = new Date().toISOString().slice(0, 10) + " 00:00:00";
const START_DATE = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10) + " 00:00:00";

async function fetchProduction(customerId: number) {
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

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = (await res.json()) as any[];
    if (!Array.isArray(raw)) return [];
    return raw;
}

function load(records: any[], customerId: number, workcellName: string) {

    // pre-load all assemblies for this workcell into memory once
    const assemblyMap = new Map<string, number>();
    const assemblies = db.query(`
    SELECT assembly_id, product_number, revision
    FROM dim_assembly
    WHERE customer_id = ?
  `).all(customerId) as { assembly_id: number; product_number: string; revision: string }[];

    for (const a of assemblies) {
        const key = `${a.product_number}||${a.revision}`;
        assemblyMap.set(key, a.assembly_id);
    }

    const insert = db.prepare(`
    INSERT INTO fact_production (
      customer_id, workcell_name, batch_id, assembly, assembly_id, sap_bom,
      route_step, bay, step_order, actual_qty,
      first_scan_dts, last_scan_dts, period_start, period_end, synced_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(customer_id, batch_id, route_step, bay) DO UPDATE SET
      assembly       = excluded.assembly,
      assembly_id    = excluded.assembly_id,
      sap_bom        = excluded.sap_bom,
      step_order     = excluded.step_order,
      actual_qty     = excluded.actual_qty,
      first_scan_dts = excluded.first_scan_dts,
      last_scan_dts  = excluded.last_scan_dts,
      period_start   = excluded.period_start,
      period_end     = excluded.period_end,
      synced_at      = datetime('now')
  `);

    const upsertAll = db.transaction((rows: any[]) => {
        for (const r of rows) {
            const parts = (r.Assembly || "").split("/").map((s: string) => s.trim());
            const productNumber = parts[0] || null;
            const revision = parts[1] || null;

            // O(1) map lookup instead of DB query per row
            const assemblyId = productNumber
                ? (assemblyMap.get(`${productNumber}||${revision}`) ?? null)
                : null;

            try {
                insert.run(
                    customerId,
                    workcellName,
                    r.BatchID?.trim() || null,
                    r.Assembly?.trim() || null,
                    assemblyId,
                    r.SAP_BOM?.trim() || null,
                    r.RouteStep?.trim() || null,
                    r.Bay?.trim() || null,
                    r.StepOrder,
                    r.ActualQty,
                    r.FirstScanDTS,
                    r.LastScanDTS,
                    START_DATE,
                    END_DATE
                );
            } catch (e) {
                console.log("FAILED ROW:", JSON.stringify(r));
            }
        }
    });

    upsertAll(records);
}

// --- run ---
console.log(`Starting fact_production sync`);
console.log(`Period: ${START_DATE} → ${END_DATE}`);
console.log(`Workcells: ${P1_ACTIVE_WORKCELLS.length}\n`);

let totalRecords = 0;
let failed = 0;
const overallStart = Date.now();

for (const wc of P1_ACTIVE_WORKCELLS) {
    process.stdout.write(`  [${wc.customer_id}] ${wc.workcell_name}... `);

    try {
        const raw = await fetchProduction(wc.customer_id);
        load(raw, wc.customer_id, wc.workcell_name);
        console.log(`${raw.length} records`);
        totalRecords += raw.length;
    } catch (e: any) {
        console.log(`FAILED — ${e.message}`);
        failed++;
    }
}

const totalTime = ((Date.now() - overallStart) / 1000).toFixed(1);

console.log(`\n=== Done ===`);
console.log(`Total records: ${totalRecords}`);
console.log(`Failed: ${failed}`);
console.log(`Time: ${totalTime}s`);

// preview
console.log("\nSample (first 5):");
console.table(
    db.query(`
    SELECT workcell_name, batch_id, assembly, bay, route_step, actual_qty
    FROM fact_production
    LIMIT 5
  `).all()
);