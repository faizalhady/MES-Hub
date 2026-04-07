import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { assemblyRoutes } from "./routes/assemblies";
import { locationRoutes } from "./routes/locations";
import { productionRoutes } from "./routes/production";
import { workcellRoutes } from "./routes/workcells";

const app = new Elysia()
    .use(cors())
    .get("/", () => ({ status: "MES data hub running" }))
    .use(workcellRoutes)
    .use(locationRoutes)
    .use(productionRoutes)
    .use(assemblyRoutes)
    .listen({
        port: process.env.PORT ?? 9009,
        idleTimeout: 250, // seconds
    });

console.log(`Server running at http://localhost:${app.server?.port}`);