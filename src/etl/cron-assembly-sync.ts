import { db } from "../db/schema";

const MES_BASE_URL = process.env.MES_BASE_URL!;
const MES_API_KEY = process.env.MES_API_KEY!;

// active P1 workcells only — DYSON and ENDURANCE excluded
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

async function syncWorkcellAssemblies(customerId: number, workcellName: string) {
    const start = Date.now();

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

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

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
                workcellName,
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

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    return { count: raw.length, elapsed };
}

// --- run ---
console.log(`Starting assembly sync — ${new Date().toISOString()}`);
console.log(`Syncing ${P1_ACTIVE_WORKCELLS.length} P1 workcells\n`);

let totalAssemblies = 0;
let failed = 0;
const overallStart = Date.now();

for (const wc of P1_ACTIVE_WORKCELLS) {
    process.stdout.write(`  [${wc.customer_id}] ${wc.workcell_name}... `);

    try {
        const { count, elapsed } = await syncWorkcellAssemblies(
            wc.customer_id,
            wc.workcell_name
        );
        console.log(`${count} assemblies in ${elapsed}s`);
        totalAssemblies += count;
    } catch (e: any) {
        console.log(`FAILED — ${e.message}`);
        failed++;
    }
}

const totalTime = ((Date.now() - overallStart) / 1000).toFixed(1);

console.log(`\n=== Sync complete ===`);
console.log(`Total assemblies: ${totalAssemblies}`);
console.log(`Failed workcells: ${failed}`);
console.log(`Total time: ${totalTime}s`);
console.log(`Finished: ${new Date().toISOString()}`);