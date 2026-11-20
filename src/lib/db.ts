import { PrismaClient } from "@prisma/client";

// Singleton Prisma client — avoids exhausting connections under Next.js HMR.
const globalForPrisma = globalThis as unknown as { db?: PrismaClient };

export const db =
  globalForPrisma.db ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.db = db;
