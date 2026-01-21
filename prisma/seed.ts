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
  // 1.5) Fund profiles (Phase 1: ETF -> primary bucket)
  // Source list (tickers/names): ETFdb Top 100 by AUM (we seed the first ~30)
  const fundProfiles: Array<{
    ticker: string
    name: string
    assetClass: string
    geography?: string | null
    style?: string | null
    marketCapBias?: string | null
    source?: string | null
    notes?: string | null
  }> = [
    { ticker: "VOO", name: "Vanguard S&P 500 ETF", assetClass: "us_equity", geography: "us", style: "blend", marketCapBias: "large", source: "manual", notes: "S&P 500" },
    { ticker: "IVV", name: "iShares Core S&P 500 ETF", assetClass: "us_equity", geography: "us", style: "blend", marketCapBias: "large", source: "manual", notes: "S&P 500" },
    { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", assetClass: "us_equity", geography: "us", style: "blend", marketCapBias: "large", source: "manual", notes: "S&P 500" },
    { ticker: "VTI", name: "Vanguard Total Stock Market ETF", assetClass: "us_equity", geography: "us", style: "blend", marketCapBias: "all", source: "manual", notes: "US total market" },
    { ticker: "QQQ", name: "Invesco QQQ Trust Series I", assetClass: "us_equity", geography: "us", style: "growth", marketCapBias: "large", source: "manual", notes: "Nasdaq 100" },
    { ticker: "VUG", name: "Vanguard Growth ETF", assetClass: "us_equity", geography: "us", style: "growth", marketCapBias: "large", source: "manual", notes: "US large growth" },
    { ticker: "VEA", name: "Vanguard FTSE Developed Markets ETF", assetClass: "intl_equity", geography: "intl", style: "blend", marketCapBias: "large", source: "manual", notes: "Intl developed" },
    { ticker: "IEFA", name: "iShares Core MSCI EAFE ETF", assetClass: "intl_equity", geography: "intl", style: "blend", marketCapBias: "large", source: "manual", notes: "EAFE" },
    { ticker: "VTV", name: "Vanguard Value ETF", assetClass: "us_equity", geography: "us", style: "value", marketCapBias: "large", source: "manual", notes: "US large value" },
    { ticker: "GLD", name: "SPDR Gold Shares", assetClass: "other", geography: "global", style: null, marketCapBias: null, source: "manual", notes: "Gold" },
    { ticker: "BND", name: "Vanguard Total Bond Market ETF", assetClass: "bonds", geography: "us", style: null, marketCapBias: null, source: "manual", notes: "US total bond" },
    { ticker: "AGG", name: "iShares Core U.S. Aggregate Bond ETF", assetClass: "bonds", geography: "us", style: null, marketCapBias: null, source: "manual", notes: "US aggregate bond" },
    { ticker: "IEMG", name: "iShares Core MSCI Emerging Markets ETF", assetClass: "intl_equity", geography: "intl", style: "blend", marketCapBias: "all", source: "manual", notes: "Emerging markets" },
    { ticker: "VXUS", name: "Vanguard Total International Stock ETF", assetClass: "intl_equity", geography: "intl", style: "blend", marketCapBias: "all", source: "manual", notes: "Intl total market ex-US" },
    { ticker: "IWF", name: "iShares Russell 1000 Growth ETF", assetClass: "us_equity", geography: "us", style: "growth", marketCapBias: "large", source: "manual", notes: "US large growth" },
    { ticker: "VGT", name: "Vanguard Information Technology ETF", assetClass: "us_equity", geography: "us", style: "growth", marketCapBias: "large", source: "manual", notes: "US sector: technology" },
    { ticker: "VWO", name: "Vanguard FTSE Emerging Markets ETF", assetClass: "intl_equity", geography: "intl", style: "blend", marketCapBias: "all", source: "manual", notes: "Emerging markets" },
    { ticker: "IJH", name: "iShares Core S&P Mid-Cap ETF", assetClass: "us_equity", geography: "us", style: "blend", marketCapBias: "mid", source: "manual", notes: "US mid cap" },
    { ticker: "SPYM", name: "State Street SPDR Portfolio S&P 500 ETF", assetClass: "us_equity", geography: "us", style: "blend", marketCapBias: "large", source: "manual", notes: "S&P 500" },
    { ticker: "VIG", name: "Vanguard Dividend Appreciation ETF", assetClass: "us_equity", geography: "us", style: "blend", marketCapBias: "large", source: "manual", notes: "Dividend growth" },
    { ticker: "IJR", name: "iShares Core S&P Small-Cap ETF", assetClass: "us_equity", geography: "us", style: "blend", marketCapBias: "small", source: "manual", notes: "US small cap" },
    { ticker: "VO", name: "Vanguard Mid-Cap ETF", assetClass: "us_equity", geography: "us", style: "blend", marketCapBias: "mid", source: "manual", notes: "US mid cap" },
    { ticker: "XLK", name: "State Street Technology Select Sector SPDR ETF", assetClass: "us_equity", geography: "us", style: "growth", marketCapBias: "large", source: "manual", notes: "US sector: technology" },
    { ticker: "RSP", name: "Invesco S&P 500 Equal Weight ETF", assetClass: "us_equity", geography: "us", style: "blend", marketCapBias: "large", source: "manual", notes: "S&P 500 equal weight" },
    { ticker: "ITOT", name: "iShares Core S&P Total U.S. Stock Market ETF", assetClass: "us_equity", geography: "us", style: "blend", marketCapBias: "all", source: "manual", notes: "US total market" },
    { ticker: "IWM", name: "iShares Russell 2000 ETF", assetClass: "us_equity", geography: "us", style: "blend", marketCapBias: "small", source: "manual", notes: "US small cap" },
    { ticker: "SCHD", name: "Schwab US Dividend Equity ETF", assetClass: "us_equity", geography: "us", style: "value", marketCapBias: "large", source: "manual", notes: "Dividend equity" },
    { ticker: "BNDX", name: "Vanguard Total International Bond ETF", assetClass: "bonds", geography: "intl", style: null, marketCapBias: null, source: "manual", notes: "Intl investment-grade bond (hedged)" },
    { ticker: "IBIT", name: "iShares Bitcoin Trust ETF", assetClass: "other", geography: "global", style: null, marketCapBias: null, source: "manual", notes: "Bitcoin" },
    { ticker: "VB", name: "Vanguard Small Cap ETF", assetClass: "us_equity", geography: "us", style: "blend", marketCapBias: "small", source: "manual", notes: "US small cap" },
    { ticker: "SGOV", name: "iShares 0-3 Month Treasury Bond ETF", assetClass: "cash", geography: "us", style: null, marketCapBias: null, source: "manual", notes: "Treasury bills / cash proxy" },
  ];

  await prisma.$transaction(
    fundProfiles.map((fp) =>
      prisma.fundProfile.upsert({
        where: { ticker: fp.ticker },
        update: {
          name: fp.name,
          assetClass: fp.assetClass,
          geography: fp.geography ?? null,
          style: fp.style ?? null,
          marketCapBias: fp.marketCapBias ?? null,
          source: fp.source ?? "manual",
          notes: fp.notes ?? null,
        },
        create: {
          ticker: fp.ticker,
          name: fp.name,
          assetClass: fp.assetClass,
          geography: fp.geography ?? null,
          style: fp.style ?? null,
          marketCapBias: fp.marketCapBias ?? null,
          source: fp.source ?? "manual",
          notes: fp.notes ?? null,
        },
      })
    )
  );

  // Only log fundProfiles count
  const fundCount = await prisma.fundProfile.count();
  console.log("[seed] fund profiles upserted:", fundCount);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });