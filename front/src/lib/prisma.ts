import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let _prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    if (globalForPrisma.prisma) {
      _prisma = globalForPrisma.prisma;
    } else {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error("DATABASE_URL is not set");
      }
      const adapter = new PrismaPg({ connectionString });
      _prisma = new PrismaClient({ adapter });
      if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = _prisma;
      }
    }
  }
  return _prisma;
}

// Backward-compatible export (lazy — only initializes on first property access)
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as unknown as Record<string, unknown>)[prop as string];
  },
});
