import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// Use a fixed user id so seeding is repeatable.
// Later, this will be your Clerk userId.
const USER_ID = process.env.SEED_USER_ID || "user_seed_neeraj";
const dbUrl = process.env.DATABASE_URL || "";
const safeDb = dbUrl
  ? dbUrl.replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/, "$1***$3")
  : "(missing DATABASE_URL)";
console.log("[seed] DATABASE_URL:", safeDb);
console.log("[seed] starting...");

async function main() {
  // 1) User + Profile
  const user = await prisma.user.upsert({
    where: { id: USER_ID },
    update: {
      email: "seed@portfolio-copilot.local",
      profile: {
        upsert: {
          create: {
            ageRange: "30-39",
            riskTolerance: "medium",
            timeHorizon: "long",
          },
          update: {
            ageRange: "30-39",
            riskTolerance: "medium",
            timeHorizon: "long",
          },
        },
      },
    },
    create: {
      id: USER_ID,
      email: "seed@portfolio-copilot.local",
      profile: {
        create: {
          ageRange: "30-39",
          riskTolerance: "medium",
          timeHorizon: "long",
        },
      },
    },
    include: { profile: true },
  });

  // 2) Brokerage Account
  const account = await prisma.brokerageAccount.upsert({
    where: { id: "acct_seed_schwab" },
    update: {
      institution: "Charles Schwab",
      name: "Brokerage",
      mask: "1234",
      type: "brokerage",
      currency: "USD",
      lastSyncedAt: new Date(),
    },
    create: {
      id: "acct_seed_schwab",
      userId: user.id,
      institution: "Charles Schwab",
      name: "Brokerage",
      mask: "1234",
      type: "brokerage",
      currency: "USD",
      lastSyncedAt: new Date(),
    },
  });

  // 3) Clear existing holdings for this account (so seed is repeatable)
  await prisma.holding.deleteMany({
    where: { brokerageAccountId: account.id },
  });

  // 4) Insert Holdings (mix ETFs + stocks + cash)
  const holdings: Prisma.HoldingCreateManyInput[] = [
    {
      brokerageAccountId: account.id,
      ticker: "VTI",
      name: "Vanguard Total Stock Market ETF",
      quantity: new Prisma.Decimal("12.34567890"),
      price: new Prisma.Decimal("250.12"),
      value: new Prisma.Decimal("3087.73"),
      securityType: "etf",
      assetClass: "us_equity",
      geography: "us",
      style: "blend",
      asOf: new Date(),
    },
    {
      brokerageAccountId: account.id,
      ticker: "VXUS",
      name: "Vanguard Total International Stock ETF",
      quantity: new Prisma.Decimal("20.00000000"),
      price: new Prisma.Decimal("58.40"),
      value: new Prisma.Decimal("1168.00"),
      securityType: "etf",
      assetClass: "intl_equity",
      geography: "intl",
      style: "blend",
      asOf: new Date(),
    },
    {
      brokerageAccountId: account.id,
      ticker: "BND",
      name: "Vanguard Total Bond Market ETF",
      quantity: new Prisma.Decimal("15.00000000"),
      price: new Prisma.Decimal("72.15"),
      value: new Prisma.Decimal("1082.25"),
      securityType: "etf",
      assetClass: "bonds",
      geography: "us",
      style: null,
      asOf: new Date(),
    },
    {
      brokerageAccountId: account.id,
      ticker: "QQQ",
      name: "Invesco QQQ Trust",
      quantity: new Prisma.Decimal("3.50000000"),
      price: new Prisma.Decimal("420.50"),
      value: new Prisma.Decimal("1471.75"),
      securityType: "etf",
      assetClass: "us_equity",
      geography: "us",
      style: "growth",
      asOf: new Date(),
    },
    {
      brokerageAccountId: account.id,
      ticker: "AAPL",
      name: "Apple Inc.",
      quantity: new Prisma.Decimal("5.00000000"),
      price: new Prisma.Decimal("195.10"),
      value: new Prisma.Decimal("975.50"),
      securityType: "stock",
      assetClass: "us_equity",
      geography: "us",
      style: "growth",
      asOf: new Date(),
    },
    {
      brokerageAccountId: account.id,
      ticker: "MSFT",
      name: "Microsoft Corporation",
      quantity: new Prisma.Decimal("2.00000000"),
      price: new Prisma.Decimal("415.25"),
      value: new Prisma.Decimal("830.50"),
      securityType: "stock",
      assetClass: "us_equity",
      geography: "us",
      style: "growth",
      asOf: new Date(),
    },
    {
      brokerageAccountId: account.id,
      ticker: "COST",
      name: "Costco Wholesale Corporation",
      quantity: new Prisma.Decimal("1.00000000"),
      price: new Prisma.Decimal("720.00"),
      value: new Prisma.Decimal("720.00"),
      securityType: "stock",
      assetClass: "us_equity",
      geography: "us",
      style: "blend",
      asOf: new Date(),
    },
    {
      brokerageAccountId: account.id,
      ticker: "VNQ",
      name: "Vanguard Real Estate ETF",
      quantity: new Prisma.Decimal("6.00000000"),
      price: new Prisma.Decimal("85.30"),
      value: new Prisma.Decimal("511.80"),
      securityType: "etf",
      assetClass: "other",
      geography: "us",
      style: null,
      asOf: new Date(),
    },
    {
      brokerageAccountId: account.id,
      ticker: null,
      name: "Cash",
      quantity: new Prisma.Decimal("1.00000000"),
      price: null,
      value: new Prisma.Decimal("1250.00"),
      securityType: "cash",
      assetClass: "cash",
      geography: "us",
      style: null,
      asOf: new Date(),
    },
    {
      brokerageAccountId: account.id,
      ticker: "IWM",
      name: "iShares Russell 2000 ETF",
      quantity: new Prisma.Decimal("4.00000000"),
      price: new Prisma.Decimal("205.75"),
      value: new Prisma.Decimal("823.00"),
      securityType: "etf",
      assetClass: "us_equity",
      geography: "us",
      style: "blend",
      asOf: new Date(),
    },
  ];

  await prisma.holding.createMany({ data: holdings });

  // 5) Daily snapshots (yesterday + today)
  const today = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Normalize to a “date bucket” (optional): set to midnight local
  const toMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const t = toMidnight(today);
  const y = toMidnight(yesterday);

  // Compute total value from holdings
  const totalValue = holdings
    .reduce((sum, h) => sum + Number(h.value), 0);

  // Set a fake daily move
  const yesterdayValue = totalValue - 123.45;
  const changeAbs = totalValue - yesterdayValue;
  const changePct = yesterdayValue === 0 ? 0 : changeAbs / yesterdayValue;

  await prisma.dailySnapshot.upsert({
    where: { brokerageAccountId_date: { brokerageAccountId: account.id, date: y } },
    update: { totalValue: new Prisma.Decimal(yesterdayValue.toFixed(2)) },
    create: {
      brokerageAccountId: account.id,
      date: y,
      totalValue: new Prisma.Decimal(yesterdayValue.toFixed(2)),
      changeAbs: null,
      changePct: null,
    },
  });

  await prisma.dailySnapshot.upsert({
    where: { brokerageAccountId_date: { brokerageAccountId: account.id, date: t } },
    update: {
      totalValue: new Prisma.Decimal(totalValue.toFixed(2)),
      changeAbs: new Prisma.Decimal(changeAbs.toFixed(2)),
      changePct: new Prisma.Decimal(changePct.toFixed(6)),
    },
    create: {
      brokerageAccountId: account.id,
      date: t,
      totalValue: new Prisma.Decimal(totalValue.toFixed(2)),
      changeAbs: new Prisma.Decimal(changeAbs.toFixed(2)),
      changePct: new Prisma.Decimal(changePct.toFixed(6)),
    },
  });

  const counts = await Promise.all([
    prisma.user.count(),
    prisma.profile.count(),
    prisma.brokerageAccount.count(),
    prisma.holding.count(),
    prisma.dailySnapshot.count(),
  ]);
  console.log("[seed] row counts", {
    users: counts[0],
    profiles: counts[1],
    brokerageAccounts: counts[2],
    holdings: counts[3],
    dailySnapshots: counts[4],
  });

  console.log("✅ Seed complete:", {
    userId: user.id,
    accountId: account.id,
    holdings: holdings.length,
    totalValue: totalValue.toFixed(2),
  });
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });