
const MES_BASE_URL = process.env.MES_BASE_URL!;
const MES_API_KEY = process.env.MES_API_KEY!;

// P1 workcells from our query
const P1_WORKCELLS = [
    { customer_id: 51, workcell_name: "ADVANTEST" },
    { customer_id: 68, workcell_name: "ARISTANETWORKS" },
    { customer_id: 110, workcell_name: "ARISTA_NETWORKS_GLACIER" },
    { customer_id: 66, workcell_name: "ASP" },
    { customer_id: 78, workcell_name: "BD" },
    { customer_id: 95, workcell_name: "BECKMAN COULTER" },
    { customer_id: 23, workcell_name: "BEDFORD" },
    { customer_id: 180, workcell_name: "DYSON" },
    { customer_id: 112, workcell_name: "ELENION TECHNOLOGIES" },
    { customer_id: 214, workcell_name: "ENDURANCE" },
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

// check last 30 days
const END_DATE = new Date().toISOString().slice(0, 10) + " 00:00:00";
const START_DATE = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10) + " 00:00:00";

console.log(`Checking activity from ${START_DATE} to ${END_DATE}\n`);

const active: { customer_id: number; workcell_name: string; record_count: number }[] = [];
const inactive: { customer_id: number; workcell_name: string }[] = [];

for (const wc of P1_WORKCELLS) {
    process.stdout.write(`  [${wc.customer_id}] ${wc.workcell_name}... `);

    try {
        const res = await fetch(`${MES_BASE_URL}/Batch/ListBatchCountsByRouteStep`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ApiKey": MES_API_KEY,
            },
            body: JSON.stringify({
                CustomerID: wc.customer_id,
                StartDate: START_DATE,
                EndDate: END_DATE,
            }),
        });

        if (!res.ok) {
            console.log(`HTTP ${res.status}`);
            inactive.push(wc);
            continue;
        }

        const raw = (await res.json()) as any[];

        if (!Array.isArray(raw) || raw.length === 0) {
            console.log("no activity");
            inactive.push(wc);
        } else {
            console.log(`${raw.length} records`);
            active.push({ ...wc, record_count: raw.length });
        }
    } catch (e) {
        console.log("error");
        inactive.push(wc);
    }
}

console.log("\n=== ACTIVE WORKCELLS (last 30 days) ===");
console.table(active);

console.log("\n=== INACTIVE WORKCELLS ===");
console.table(inactive);

console.log(`\nActive: ${active.length} / ${P1_WORKCELLS.length}`);
console.log(`Inactive: ${inactive.length} / ${P1_WORKCELLS.length}`);