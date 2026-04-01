const MES_BASE_URL = process.env.MES_BASE_URL!;
const MES_API_KEY = process.env.MES_API_KEY!;

console.log("Fetching RouteStep...");

const res = await fetch(`${MES_BASE_URL}/Route/ListRouteStep`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "ApiKey": MES_API_KEY,
    },
    body: JSON.stringify({ factory: "" }),
});

const raw = (await res.json()) as any[];

console.log(`Total records: ${raw.length}`);
console.log("\nFirst 3 records:");
console.log(JSON.stringify(raw.slice(0, 3), null, 2));

// also show unique FactoryNames
const factories = [...new Set(raw.map((r: any) => r.FactoryName))];
console.log("\nUnique FactoryNames:", factories);

// unique ManufacturingAreaNames
const areas = [...new Set(raw.map((r: any) => r.ManufacturingAreaName))];
console.log("\nUnique ManufacturingAreaNames:", areas);