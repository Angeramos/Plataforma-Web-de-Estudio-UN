import process from "node:process";
import { Client } from "pg";

try {
  process.loadEnvFile(".env.local");
} catch {}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!url) {
  console.error("[db:check] Falta DATABASE_URL_UNPOOLED o DATABASE_URL en .env.local");
  process.exit(1);
}

if (url.includes("usuario:clave@host")) {
  console.error("[db:check] .env.local aun tiene URLs de ejemplo. Reemplazalas por las de Neon.");
  process.exit(1);
}

const client = new Client({ connectionString: url });

try {
  await client.connect();
  const basic = await client.query("select current_database() as db, now() as now");
  const schema = await client.query("select to_regclass('public.users') as users_table");

  console.log("[db:check] Conexion OK");
  console.log(`[db:check] DB: ${basic.rows[0].db}`);
  console.log(`[db:check] Hora DB: ${basic.rows[0].now}`);
  console.log(`[db:check] Tabla users: ${schema.rows[0].users_table ?? "NO EXISTE"}`);

  if (!schema.rows[0].users_table) {
    console.log("[db:check] Falta inicializar esquema. Ejecuta: npm run db:init");
  }
} catch (err) {
  console.error("[db:check] Error de conexion o consulta:");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
