import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
}

if (!process.env.DIRECT_URL && process.env.POSTGRES_URL_NON_POOLING) {
  process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING;
}

function applyDirectPostgresTimeouts(url: string | undefined) {
  if (!url || (!url.startsWith("postgres://") && !url.startsWith("postgresql://"))) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "5");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "5");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

process.env.DATABASE_URL = applyDirectPostgresTimeouts(process.env.DATABASE_URL) ?? process.env.DATABASE_URL;
process.env.DIRECT_URL = applyDirectPostgresTimeouts(process.env.DIRECT_URL) ?? process.env.DIRECT_URL;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function isRetryablePrismaError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String(error.code) : "";
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";

  return (
    name === "PrismaClientInitializationError" ||
    code === "P1001" ||
    code === "P1002" ||
    code === "P1017" ||
    code === "P2024" ||
    message.includes("Can't reach database server") ||
    message.includes("Timed out fetching a new connection") ||
    message.includes("Connection reset") ||
    message.includes("Server has closed the connection")
  );
}

export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  label: string,
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryablePrismaError(error) || attempt === maxAttempts) {
        throw error;
      }

      console.warn("Retrying Prisma operation after a transient failure", {
        label,
        attempt,
        error,
      });
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
  }

  throw lastError;
}
