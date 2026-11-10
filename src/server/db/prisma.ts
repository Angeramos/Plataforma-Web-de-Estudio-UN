import { attachDatabasePool } from "@vercel/functions";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/server/env";

// Un solo cliente por proceso (y por recarga en caliente en `next dev`).
const globalForDb = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // URL con pooler de Neon; driver `pg` según la guía de Neon para Vercel (Fluid compute).
  const pool = new Pool({ connectionString: env().DATABASE_URL });
  attachDatabasePool(pool); // cierra conexiones ociosas antes de que Vercel suspenda la función
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

// Perezoso: no conecta ni valida variables al importar (p. ej. durante `next build`).
export function db(): PrismaClient {
  return (globalForDb.prisma ??= createClient());
}
