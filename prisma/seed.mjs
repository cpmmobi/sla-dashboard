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

  const customers = [
    {
      name: "Asia Premier",
      authCode: "sl_auth_asia_001",
      domain: "live.asiapremier.tv",
      domainsJson: JSON.stringify([
        "live.asiapremier.tv",
        "edge.asiapremier.tv",
        "tk-api.fheuuw.com",
      ]),
      status: "正常",
      timezone: "Asia/Shanghai",
      contact: "ops@asiapremier.tv",
      notes: "重点赛事客户，关注晚间峰值带宽。",
      accountManagerEmail: "am@sportliveapi.com",
      renewalDay: 5,
    },
    {
      name: "Euro Match Hub",
      authCode: "sl_auth_euro_002",
      domain: "edge.euromatchhub.com",
      domainsJson: JSON.stringify([
        "edge.euromatchhub.com",
        "live.euromatchhub.com",
      ]),
      status: "正常",
      timezone: "Europe/London",
      contact: "tech@euromatchhub.com",
      notes: "欧洲客户，关心 UV 与日报导出。",
      accountManagerEmail: "am@sportliveapi.com",
      renewalDay: 18,
    },
    {
      name: "F1 Edge",
      authCode: "sl_auth_f1_003",
      domain: "stream.f1edge.net",
      domainsJson: JSON.stringify([
        "stream.f1edge.net",
      ]),
      status: "待审查",
      timezone: "Asia/Singapore",
      contact: "admin@f1edge.net",
      notes: "Auth 已重置，等待重新发放。",
      accountManagerEmail: null,
      renewalDay: null,
    },
    {
      name: "Arena Vision",
      authCode: "sl_auth_arena_004",
      domain: "play.arenavision.io",
      domainsJson: JSON.stringify([
        "play.arenavision.io",
        "backup.arenavision.io",
      ]),
      status: "正常",
      timezone: "Asia/Tokyo",
      contact: "support@arenavision.io",
      notes: "客户反馈希望增强按时段查询能力。",
      accountManagerEmail: null,
      renewalDay: 25,
    },
  ];

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
