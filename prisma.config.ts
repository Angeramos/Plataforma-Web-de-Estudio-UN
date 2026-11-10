import { defineConfig } from "prisma/config";

// Prisma 7 no carga .env solo; en Vercel las variables ya vienen en process.env.
try {
  process.loadEnvFile(".env.local");
} catch {}

export default defineConfig({
  schema: "prisma/schema.prisma",
  // CLI (db pull, db execute) por la URL directa; la app usa la URL con pooler (src/server/db/prisma.ts).
  datasource: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL },
});
