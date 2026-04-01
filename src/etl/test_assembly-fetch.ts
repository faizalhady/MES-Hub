const MES_BASE_URL = process.env.MES_BASE_URL!;
const MES_API_KEY = process.env.MES_API_KEY!;

const TEST_WORKCELLS = [
    { customer_id: 82, name: "UTAS" },
    { customer_id: 86, name: "TED" },
    { customer_id: 208, name: "TERRA SANA" },
    { customer_id: 23, name: "BEDFORD" },
    { customer_id: 68, name: "ARISTANETWORKS" },
    { customer_id: 7, name: "KEYSIGHT" },
];

for (const wc of TEST_WORKCELLS) {
    process.stdout.write(`[${wc.customer_id}] ${wc.name}... `);
    const start = Date.now();

    const res = await fetch(`${MES_BASE_URL}/Assembly/ListAssembly`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "ApiKey": MES_API_KEY,
        },
        body: JSON.stringify({
            custId: wc.customer_id,
            active: "1",
            partialKey: "",
            langId: "0",
        }),
    });

    const raw = (await res.json()) as any[];
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`${raw.length} assemblies in ${elapsed}s`);
}