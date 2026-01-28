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

  // ===== DISTRIBUTION SYSTEM: Content Topics =====
  // Topics for AI content generation, organized by category
  const contentTopics: Array<{
    category: string;
    topic: string;
    angle?: string;
    keywords: string[];
  }> = [
    // === PAIN POINT TOPICS (problems our users face) ===
    { category: "pain_point", topic: "Tracking allocation across multiple brokerages is a nightmare", angle: "The spreadsheet struggle", keywords: ["portfolio tracking", "multiple brokerages", "asset allocation"] },
    { category: "pain_point", topic: "Each brokerage shows you're diversified but together you're not", angle: "Hidden concentration risk", keywords: ["diversification", "portfolio risk", "allocation"] },
    { category: "pain_point", topic: "Logging into 5 different apps to see your full portfolio", angle: "Time wasted", keywords: ["portfolio management", "brokerage apps", "investing"] },
    { category: "pain_point", topic: "Your 401k at work + IRA + taxable account = no unified view", angle: "Account fragmentation", keywords: ["401k", "IRA", "taxable account", "retirement"] },
    { category: "pain_point", topic: "Manual spreadsheets get outdated within days", angle: "Stale data problem", keywords: ["spreadsheet", "portfolio tracking", "manual updates"] },
    { category: "pain_point", topic: "Not knowing your true stock vs bond allocation", angle: "Asset class confusion", keywords: ["stocks", "bonds", "asset allocation"] },
    { category: "pain_point", topic: "Rebalancing across accounts requires mental math", angle: "Complexity of rebalancing", keywords: ["rebalancing", "portfolio", "asset allocation"] },
    { category: "pain_point", topic: "Your target allocation exists only in your head", angle: "No accountability", keywords: ["target allocation", "investment goals", "portfolio"] },
    { category: "pain_point", topic: "Checking your portfolio takes 20 minutes across all apps", angle: "Friction", keywords: ["portfolio check", "investing apps", "time"] },
    { category: "pain_point", topic: "Different brokerages classify the same ETF differently", angle: "Classification inconsistency", keywords: ["ETF", "asset classification", "brokerages"] },
    { category: "pain_point", topic: "You have no idea how much international exposure you actually have", angle: "Geographic blindspot", keywords: ["international stocks", "global investing", "diversification"] },
    { category: "pain_point", topic: "Figuring out what to buy with your monthly contribution", angle: "Decision paralysis", keywords: ["monthly investing", "dollar cost averaging", "what to buy"] },
    { category: "pain_point", topic: "Your spouse's accounts make portfolio tracking even harder", angle: "Household complexity", keywords: ["family finances", "joint investing", "portfolio"] },

    // === EDUCATION TOPICS (teaching moments) ===
    { category: "education", topic: "What asset allocation actually means for your returns", angle: "Back to basics", keywords: ["asset allocation", "returns", "investing basics"] },
    { category: "education", topic: "Why you should care about international diversification", angle: "Global thinking", keywords: ["international stocks", "diversification", "global markets"] },
    { category: "education", topic: "The simple math behind portfolio rebalancing", angle: "Demystifying rebalancing", keywords: ["rebalancing", "portfolio", "investing math"] },
    { category: "education", topic: "How to think about bonds in your portfolio", angle: "Bond basics", keywords: ["bonds", "fixed income", "portfolio allocation"] },
    { category: "education", topic: "Age-based allocation rules and when to break them", angle: "Conventional wisdom", keywords: ["age allocation", "retirement planning", "bonds stocks"] },
    { category: "education", topic: "The difference between asset allocation and asset location", angle: "Tax efficiency", keywords: ["asset location", "tax efficiency", "401k IRA taxable"] },
    { category: "education", topic: "Why checking your portfolio daily might hurt your returns", angle: "Behavioral finance", keywords: ["portfolio checking", "behavioral investing", "long term"] },
    { category: "education", topic: "What diversification actually protects you from", angle: "Risk management", keywords: ["diversification", "risk", "portfolio protection"] },
    { category: "education", topic: "How to calculate your true equity exposure", angle: "Look-through analysis", keywords: ["equity exposure", "portfolio analysis", "stocks"] },
    { category: "education", topic: "The case for keeping it simple: 3-fund portfolio", angle: "Simplicity wins", keywords: ["three fund portfolio", "bogleheads", "simple investing"] },
    { category: "education", topic: "Dollar cost averaging vs lump sum: what data says", angle: "Research-backed", keywords: ["dollar cost averaging", "lump sum", "investing strategy"] },
    { category: "education", topic: "Why your target allocation should change over time", angle: "Glide path", keywords: ["target allocation", "glide path", "retirement"] },
    { category: "education", topic: "Understanding expense ratios and their real impact", angle: "Cost matters", keywords: ["expense ratio", "ETF costs", "investing fees"] },
    { category: "education", topic: "Small cap vs large cap: what the allocation means", angle: "Market cap explained", keywords: ["small cap", "large cap", "market capitalization"] },
    { category: "education", topic: "Growth vs value: choosing your tilt", angle: "Style factors", keywords: ["growth stocks", "value stocks", "factor investing"] },

    // === PRODUCT TOPICS (Portfolio Flow specific) ===
    { category: "product", topic: "See your complete allocation in one dashboard", angle: "Core value prop", keywords: ["portfolio dashboard", "allocation view", "portfolio tracking"] },
    { category: "product", topic: "Connect all your brokerages in minutes", angle: "Easy setup", keywords: ["connect brokerages", "Plaid", "portfolio aggregation"] },
    { category: "product", topic: "AI that answers questions about YOUR portfolio", angle: "Personalized AI", keywords: ["AI portfolio", "portfolio questions", "investing AI"] },
    { category: "product", topic: "Get rebalancing recommendations based on your goals", angle: "Smart rebalancing", keywords: ["rebalancing", "portfolio goals", "investment advice"] },
    { category: "product", topic: "Track your allocation against your target", angle: "Goal tracking", keywords: ["target allocation", "portfolio goals", "tracking"] },
    { category: "product", topic: "Read-only access means your money stays safe", angle: "Security focus", keywords: ["read only", "portfolio security", "Plaid security"] },
    { category: "product", topic: "Daily portfolio snapshots for historical tracking", angle: "Progress tracking", keywords: ["portfolio history", "daily tracking", "performance"] },
    { category: "product", topic: "Works with Fidelity, Vanguard, Schwab and more", angle: "Broad support", keywords: ["Fidelity", "Vanguard", "Schwab", "brokerages"] },

    // === ENGAGEMENT TOPICS (conversation starters) ===
    { category: "engagement", topic: "What's your current stock/bond split?", angle: "Poll/question", keywords: ["stocks bonds", "allocation", "portfolio"] },
    { category: "engagement", topic: "How many brokerage accounts do you have?", angle: "Poll/question", keywords: ["brokerage accounts", "portfolio", "investing"] },
    { category: "engagement", topic: "Do you rebalance monthly, quarterly, or yearly?", angle: "Poll/question", keywords: ["rebalancing", "portfolio management", "frequency"] },
    { category: "engagement", topic: "What percentage of your portfolio is international?", angle: "Poll/question", keywords: ["international", "global stocks", "allocation"] },
    { category: "engagement", topic: "Spreadsheet or app for tracking your portfolio?", angle: "Poll/question", keywords: ["spreadsheet", "portfolio app", "tracking"] },
    { category: "engagement", topic: "What's your target allocation?", angle: "Community sharing", keywords: ["target allocation", "portfolio goals", "investing"] },
    { category: "engagement", topic: "Biggest portfolio mistake you've made?", angle: "Lessons learned", keywords: ["investing mistakes", "portfolio", "lessons"] },
    { category: "engagement", topic: "How often do you check your portfolio?", angle: "Poll/question", keywords: ["portfolio checking", "investing habits", "behavior"] },
    { category: "engagement", topic: "401k, IRA, or taxable: where do you invest most?", angle: "Poll/question", keywords: ["401k", "IRA", "taxable account"] },
    { category: "engagement", topic: "What made you start DIY investing?", angle: "Story sharing", keywords: ["DIY investing", "self-directed", "investing journey"] },

    // === MORE PAIN POINTS ===
    { category: "pain_point", topic: "You don't know if you're overweight in tech stocks", angle: "Sector concentration", keywords: ["tech stocks", "sector allocation", "concentration risk"] },
    { category: "pain_point", topic: "Tax loss harvesting across accounts is impossible to track", angle: "Tax complexity", keywords: ["tax loss harvesting", "taxes", "portfolio"] },
    { category: "pain_point", topic: "Your old 401k is sitting forgotten at a previous employer", angle: "Orphaned accounts", keywords: ["old 401k", "rollover", "retirement accounts"] },
    { category: "pain_point", topic: "You have overlapping ETFs and don't realize it", angle: "Hidden overlap", keywords: ["ETF overlap", "portfolio redundancy", "diversification"] },
    { category: "pain_point", topic: "Cash is scattered across accounts earning different rates", angle: "Cash drag", keywords: ["cash allocation", "savings", "portfolio"] },

    // === MORE EDUCATION ===
    { category: "education", topic: "Why total market beats picking sectors", angle: "Index advantage", keywords: ["total market", "index funds", "sector picking"] },
    { category: "education", topic: "The rebalancing bonus: why it works", angle: "Rebalancing math", keywords: ["rebalancing", "returns", "portfolio strategy"] },
    { category: "education", topic: "Home country bias and how to avoid it", angle: "Behavioral", keywords: ["home country bias", "US stocks", "international"] },
    { category: "education", topic: "What 'risk tolerance' really means", angle: "Risk psychology", keywords: ["risk tolerance", "investing psychology", "portfolio risk"] },
    { category: "education", topic: "Emergency fund vs investable assets", angle: "Financial planning", keywords: ["emergency fund", "liquid assets", "investing"] },
  ];

  // Upsert content topics
  for (const topic of contentTopics) {
    await prisma.contentTopic.upsert({
      where: {
        id: `topic_${topic.category}_${topic.topic.slice(0, 30).replace(/\s+/g, "_").toLowerCase()}`,
      },
      update: {
        category: topic.category,
        topic: topic.topic,
        angle: topic.angle ?? null,
        keywords: topic.keywords,
        active: true,
      },
      create: {
        id: `topic_${topic.category}_${topic.topic.slice(0, 30).replace(/\s+/g, "_").toLowerCase()}`,
        category: topic.category,
        topic: topic.topic,
        angle: topic.angle ?? null,
        keywords: topic.keywords,
        active: true,
      },
    });
  }

  const topicCount = await prisma.contentTopic.count();
  console.log("[seed] content topics upserted:", topicCount);

  // ===== DISTRIBUTION CHANNELS =====
  const channels = [
    { name: "twitter", enabled: false, postsPerDay: 3 },
    { name: "email", enabled: false, postsPerDay: 1 },
    { name: "blog", enabled: false, postsPerDay: 1 },
  ];

  for (const channel of channels) {
    await prisma.distributionChannel.upsert({
      where: { name: channel.name },
      update: { postsPerDay: channel.postsPerDay },
      create: {
        name: channel.name,
        enabled: channel.enabled,
        postsPerDay: channel.postsPerDay,
      },
    });
  }

  const channelCount = await prisma.distributionChannel.count();
  console.log("[seed] distribution channels upserted:", channelCount);

  // ===== BLOG TOPICS (SEO/GEO optimized) =====
  const blogTopics: Array<{
    category: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    geoKeywords: string[];
    title: string;
    outline?: string;
  }> = [
    // === PAIN POINT ARTICLES ===
    {
      category: "pain_point",
      primaryKeyword: "manage multiple brokerage accounts",
      secondaryKeywords: [
        "track investments across brokerages",
        "consolidate investment accounts",
        "portfolio aggregation tool",
        "see all investments in one place",
      ],
      geoKeywords: ["US investors", "UK ISA holders", "Australian super"],
      title: "The Frustration of Managing Multiple Brokerage Accounts (And How to Fix It)",
      outline: "1. The modern investor's dilemma\n2. Why we end up with multiple accounts\n3. The hidden costs of fragmentation\n4. Solutions for unified portfolio tracking",
    },
    {
      category: "pain_point",
      primaryKeyword: "portfolio allocation across accounts",
      secondaryKeywords: [
        "asset allocation multiple accounts",
        "true portfolio allocation",
        "combined investment allocation",
      ],
      geoKeywords: ["401k allocation", "ISA allocation", "super fund allocation"],
      title: "Why You Probably Don't Know Your True Asset Allocation",
      outline: "1. The illusion of diversification\n2. How account fragmentation hides risk\n3. Real-world examples of hidden concentration\n4. How to calculate your true allocation",
    },
    {
      category: "pain_point",
      primaryKeyword: "track 401k IRA taxable accounts together",
      secondaryKeywords: [
        "unified portfolio view",
        "aggregate retirement accounts",
        "combine investment accounts",
      ],
      geoKeywords: ["401k tracking", "IRA management", "taxable brokerage"],
      title: "401k + IRA + Taxable: How to Finally See Your Complete Portfolio",
    },

    // === EDUCATION ARTICLES ===
    {
      category: "education",
      primaryKeyword: "asset allocation for beginners",
      secondaryKeywords: [
        "how to allocate portfolio",
        "stock bond allocation",
        "investment diversification",
        "balanced portfolio",
      ],
      geoKeywords: ["US stock allocation", "international exposure", "bond allocation"],
      title: "Asset Allocation 101: A Complete Guide for DIY Investors",
      outline: "1. What is asset allocation?\n2. Major asset classes explained\n3. How to choose your allocation\n4. Age-based guidelines\n5. Rebalancing basics",
    },
    {
      category: "education",
      primaryKeyword: "portfolio rebalancing guide",
      secondaryKeywords: [
        "when to rebalance portfolio",
        "how often to rebalance",
        "rebalancing strategy",
      ],
      geoKeywords: ["tax-efficient rebalancing", "401k rebalancing", "ISA rebalancing"],
      title: "Portfolio Rebalancing: When, Why, and How to Do It Right",
      outline: "1. What is rebalancing?\n2. The rebalancing bonus explained\n3. Calendar vs threshold rebalancing\n4. Tax-efficient rebalancing strategies\n5. Tools to make it easier",
    },
    {
      category: "education",
      primaryKeyword: "international diversification benefits",
      secondaryKeywords: [
        "global stock allocation",
        "ex-US investing",
        "international stocks percentage",
      ],
      geoKeywords: ["US home bias", "VXUS", "international ETFs"],
      title: "International Diversification: Why Your Portfolio Needs Global Exposure",
    },
    {
      category: "education",
      primaryKeyword: "bond allocation by age",
      secondaryKeywords: [
        "how much bonds to own",
        "stocks vs bonds age",
        "fixed income allocation",
      ],
      geoKeywords: ["Treasury bonds", "UK gilts", "government bonds"],
      title: "How Much Should You Have in Bonds? A Data-Driven Answer",
    },

    // === COMPARISON ARTICLES ===
    {
      category: "comparison",
      primaryKeyword: "Fidelity vs Vanguard vs Schwab",
      secondaryKeywords: [
        "best brokerage for index funds",
        "brokerage comparison",
        "low cost brokerage",
      ],
      geoKeywords: ["US brokerage comparison", "best US broker", "discount brokerages"],
      title: "Fidelity vs Vanguard vs Schwab: Which Is Best for DIY Investors in 2024?",
      outline: "1. Overview of each broker\n2. Fee comparison\n3. Fund selection\n4. Trading platforms\n5. Customer service\n6. Who should choose which",
    },
    {
      category: "comparison",
      primaryKeyword: "VTI vs VOO",
      secondaryKeywords: [
        "total market vs S&P 500",
        "best index fund",
        "VTI or VOO which is better",
      ],
      geoKeywords: ["US total market", "S&P 500 ETF", "Vanguard ETFs"],
      title: "VTI vs VOO: Total Market or S&P 500? The Complete Comparison",
    },
    {
      category: "comparison",
      primaryKeyword: "target date funds vs three fund portfolio",
      secondaryKeywords: [
        "target date fund review",
        "three fund portfolio",
        "simple portfolio strategy",
      ],
      geoKeywords: ["Vanguard target date", "Fidelity Freedom", "retirement funds"],
      title: "Target Date Funds vs Three-Fund Portfolio: Which Strategy Wins?",
    },

    // === GUIDE ARTICLES ===
    {
      category: "guide",
      primaryKeyword: "three-fund portfolio",
      secondaryKeywords: [
        "simple portfolio strategy",
        "bogleheads three fund",
        "lazy portfolio",
      ],
      geoKeywords: ["VTI VXUS BND", "US total market", "international stocks bonds"],
      title: "The Three-Fund Portfolio: A Simple Strategy That Actually Works",
      outline: "1. What is the three-fund portfolio?\n2. The philosophy behind it\n3. Choosing your three funds\n4. Allocation percentages\n5. Rebalancing the three-fund portfolio\n6. Variations and alternatives",
    },
    {
      category: "guide",
      primaryKeyword: "tax-loss harvesting",
      secondaryKeywords: [
        "harvest tax losses",
        "reduce investment taxes",
        "wash sale rules",
      ],
      geoKeywords: ["US tax-loss harvesting", "capital gains tax", "IRS wash sale"],
      title: "Tax-Loss Harvesting: A Step-by-Step Guide to Lowering Your Tax Bill",
      outline: "1. What is tax-loss harvesting?\n2. How it reduces taxes\n3. Wash sale rules explained\n4. When to harvest losses\n5. Tracking across accounts",
    },
    {
      category: "guide",
      primaryKeyword: "backdoor Roth IRA",
      secondaryKeywords: [
        "Roth IRA income limits",
        "mega backdoor Roth",
        "Roth conversion strategy",
      ],
      geoKeywords: ["Roth IRA 2024", "IRA contribution limits", "Roth conversion"],
      title: "The Backdoor Roth IRA: A Complete Step-by-Step Guide",
    },
    {
      category: "guide",
      primaryKeyword: "FIRE portfolio allocation",
      secondaryKeywords: [
        "financial independence portfolio",
        "early retirement investing",
        "FIRE movement investing",
      ],
      geoKeywords: ["FIRE community", "early retirement", "financial independence"],
      title: "Building a FIRE Portfolio: Asset Allocation for Early Retirement",
    },
    {
      category: "guide",
      primaryKeyword: "ETF vs mutual fund",
      secondaryKeywords: [
        "ETF advantages",
        "index fund comparison",
        "which is better ETF or mutual fund",
      ],
      geoKeywords: ["Vanguard ETF", "index funds", "passive investing"],
      title: "ETF vs Mutual Fund: Which Should You Choose for Your Portfolio?",
    },
  ];

  // Upsert blog topics
  for (const topic of blogTopics) {
    const id = `blog_${topic.category}_${topic.primaryKeyword.slice(0, 30).replace(/\s+/g, "_").toLowerCase()}`;
    await prisma.blogTopic.upsert({
      where: { id },
      update: {
        category: topic.category,
        primaryKeyword: topic.primaryKeyword,
        secondaryKeywords: topic.secondaryKeywords,
        geoKeywords: topic.geoKeywords,
        title: topic.title,
        outline: topic.outline ?? null,
        active: true,
      },
      create: {
        id,
        category: topic.category,
        primaryKeyword: topic.primaryKeyword,
        secondaryKeywords: topic.secondaryKeywords,
        geoKeywords: topic.geoKeywords,
        title: topic.title,
        outline: topic.outline ?? null,
        active: true,
      },
    });
  }

  const blogTopicCount = await prisma.blogTopic.count();
  console.log("[seed] blog topics upserted:", blogTopicCount);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });