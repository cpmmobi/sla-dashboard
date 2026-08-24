import "dotenv/config";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
}

if (!process.env.DIRECT_URL && process.env.POSTGRES_URL_NON_POOLING) {
  process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING;
}

const prisma = new PrismaClient();

async function main() {
  await prisma.admin.upsert({
    where: { username: "admin@sportliveapi.com" },
    update: {
      password: "sportlive123",
      displayName: "SportLiveAPI Admin",
      role: "super_admin",
    },
    create: {
      username: "admin@sportliveapi.com",
      password: "sportlive123",
      displayName: "SportLiveAPI Admin",
      role: "super_admin",
    },
  });

  await prisma.admin.upsert({
    where: { username: "am@sportliveapi.com" },
    update: {
      password: "sportlive123",
      displayName: "Account Manager",
      role: "account_manager",
    },
    create: {
      username: "am@sportliveapi.com",
      password: "sportlive123",
      displayName: "Account Manager",
      role: "account_manager",
    },
  });

  const customers = [];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { authCode: customer.authCode },
      update: customer,
      create: customer,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
