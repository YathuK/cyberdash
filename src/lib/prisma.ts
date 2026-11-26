import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("No database URL configured. Set TURSO_DATABASE_URL or DATABASE_URL.");
  }

  const adapter = new PrismaLibSql({ url, authToken });
  return new PrismaClient({ adapter });
}

// Lazy proxy: the client is only created on first query, not at import time.
// Next's build evaluates route modules to collect page data, and an eager
// throw here failed `next build` on any machine without the DB env vars.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) globalForPrisma.prisma = createPrismaClient();
    const client = globalForPrisma.prisma;
    const value = client[prop as keyof PrismaClient];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});
