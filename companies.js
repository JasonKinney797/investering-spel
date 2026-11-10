"use strict";
// Shared game data for solo (browser) and online (Node.js server).
// Every visible text is a translation key (see lang/*.js), never a sentence.
(function (root, factory) {
  const data = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  else root.GAME_DATA = data;
})(typeof self !== "undefined" ? self : this, function () {

  const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
  const round2 = v => Math.round(v * 100) / 100;

  const MARKETS = ["Europa", "Amerika", "Azië"];   // internal ids; shown via market.<id>
  const SECTORS = ["tech", "energy", "finance", "health", "space", "gaming", "retail", "transport", "construction", "media"];

  // recession: daily price factor while in recession (lower = hit harder)
  const STOCK_DEFS = [
    { name: "TechNova",    sector: "tech",         price: 120, volatility: 0.09,  reputation: 50, employees: 1200, research: 50, markets: ["Europa"],  companyCash: 50000,  recession: 0.978, ceo: { name: "Mila Vos",        leadership: 60, innovation: 75, reliability: 55 } },
    { name: "GreenVolt",   sector: "energy",       price: 80,  volatility: 0.07,  reputation: 50, employees: 900,  research: 50, markets: ["Europa"],  companyCash: 35000,  recession: 0.978, ceo: { name: "Noah Verbruggen", leadership: 58, innovation: 65, reliability: 70 } },
    { name: "EuroBank",    sector: "finance",      price: 60,  volatility: 0.01,  reputation: 70, employees: 2400, research: 35, markets: ["Europa"],  companyCash: 120000, recession: 0.96,  ceo: { name: "Elise De Smet",   leadership: 72, innovation: 35, reliability: 90 } },
    { name: "MedFuture",   sector: "health",       price: 95,  volatility: 0.08,  reputation: 55, employees: 1100, research: 60, markets: ["Europa"],  companyCash: 60000,  recession: 0.985, ceo: { name: "Samira Haddad",   leadership: 55, innovation: 85, reliability: 60 } },
    { name: "SpaceY",      sector: "space",        price: 150, volatility: 0.22,  reputation: 65, employees: 700,  research: 80, markets: ["Amerika"], companyCash: 80000,  recession: 0.96,  ceo: { name: "Rex Orion",       leadership: 45, innovation: 95, reliability: 30 } },
    { name: "PixelForge",  sector: "gaming",       price: 70,  volatility: 0.12,  reputation: 55, employees: 600,  research: 65, markets: ["Amerika"], companyCash: 40000,  recession: 0.975, ceo: { name: "Kai Nakamura",    leadership: 60, innovation: 85, reliability: 45 } },
    { name: "FreshMart",   sector: "retail",       price: 45,  volatility: 0.025, reputation: 65, employees: 3000, research: 25, markets: ["Europa"],  companyCash: 90000,  recession: 0.995, ceo: { name: "Greta Jansen",    leadership: 70, innovation: 40, reliability: 85 } },
    { name: "SkyLine Air", sector: "transport",    price: 65,  volatility: 0.1,   reputation: 55, employees: 1800, research: 40, markets: ["Europa"],  companyCash: 70000,  recession: 0.96,  ceo: { name: "Marco Rossi",     leadership: 62, innovation: 50, reliability: 65 } },
    { name: "BuildCo",     sector: "construction", price: 55,  volatility: 0.06,  reputation: 55, employees: 2000, research: 30, markets: ["Europa"],  companyCash: 75000,  recession: 0.97,  ceo: { name: "Hanna Berg",      leadership: 66, innovation: 45, reliability: 72 } },
    { name: "StreamWave",  sector: "media",        price: 90,  volatility: 0.1,   reputation: 60, employees: 800,  research: 55, markets: ["Amerika"], companyCash: 55000,  recession: 0.98,  ceo: { name: "Leo Martins",     leadership: 58, innovation: 78, reliability: 55 } },
  ];

  // Product names are brand-like and stay in English in every language.
  const PRODUCT_IDEAS = {
    TechNova:      ["AI Assistant", "Gaming Laptop", "Smartphone", "Cloud Platform"],
    GreenVolt:     ["Solar Roof", "Home Battery", "Wind Turbine", "Eco Charger"],
    EuroBank:      ["Premium Account", "Safe Loan System", "Mobile Banking", "Fraud Shield"],
    MedFuture:     ["Health Scanner", "Medical AI", "Recovery Device", "Smart Lab"],
    SpaceY:        ["Reusable Rocket", "Moon Cargo", "Satellite Net", "Mars Prototype"],
    PixelForge:    ["Open-World RPG", "Mobile Hit", "VR Headset", "Esports League"],
    FreshMart:     ["Store Brand", "Home Delivery", "Self-Checkout", "Loyalty App"],
    "SkyLine Air": ["Low-cost Route", "Business Lounge", "Cargo Service", "Electric Plane"],
    BuildCo:       ["Smart Homes", "Bridge Project", "Office Tower", "Modular House"],
    StreamWave:    ["Hit Series", "Live Sports", "Music Platform", "Podcast Network"],
  };
  const GENERIC_PRODUCTS = ["Starter Kit", "Pro Edition", "Subscription", "Smart Device", "Platform 2.0"];

  const RISK_PROFILES = {
    TechNova:      { chance: 0.58, up: 1.22, down: 0.91 },
    GreenVolt:     { chance: 0.68, up: 1.14, down: 0.94 },
    EuroBank:      null,
    MedFuture:     { chance: 0.38, up: 1.42, down: 0.80 },
    SpaceY:        { chance: 0.20, up: 2.00, down: 0.50 },
    PixelForge:    { chance: 0.45, up: 1.35, down: 0.85 },
    FreshMart:     { chance: 0.70, up: 1.08, down: 0.96 },
    "SkyLine Air": { chance: 0.50, up: 1.25, down: 0.85 },
    BuildCo:       { chance: 0.60, up: 1.18, down: 0.90 },
    StreamWave:    { chance: 0.50, up: 1.30, down: 0.85 },
  };
  const DEFAULT_RISK = { chance: 0.5, up: 1.2, down: 0.85 };

  const RISKY = ["TechNova", "GreenVolt", "MedFuture", "SpaceY", "PixelForge", "SkyLine Air", "StreamWave"];
  const MARKET_EVENTS = [
    { id: "ai_hype",     affected: ["TechNova"], multiplier: 1.1 },
    { id: "energy",      affected: ["GreenVolt"], multiplier: 1.08 },
    { id: "banks",       affected: ["EuroBank"], multiplier: 1.03 },
    { id: "med",         affected: ["MedFuture"], multiplier: 1.12 },
    { id: "spacey_wild", affected: ["SpaceY"], multiplier: () => (Math.random() > 0.5 ? 1.22 : 0.75) },
    { id: "rates",       affected: RISKY, multiplier: 0.95 },
    { id: "optimism",    affected: "*", multiplier: 1.05 },
    { id: "consumers",   affected: ["TechNova", "GreenVolt", "MedFuture", "SpaceY", "PixelForge", "StreamWave"], multiplier: 0.93 },
    { id: "spacey_pump", affected: ["SpaceY"], multiplier: 1.3 },
    { id: "gaming",      affected: ["PixelForge"], multiplier: 1.12 },
    { id: "oil",         affected: ["SkyLine Air"], multiplier: 0.9 },
    { id: "housing",     affected: ["BuildCo"], multiplier: 1.08 },
    { id: "streaming",   affected: ["StreamWave"], multiplier: 0.92 },
    { id: "bargains",    affected: ["FreshMart"], multiplier: 1.03 },
    { id: "holiday",     affected: ["SkyLine Air", "FreshMart"], multiplier: 1.05 },
    { id: "quiet",       affected: [], multiplier: 1 },
  ];

  // Synergies: bonuses for owning a set of companies (solo mode).
  const SYNERGIES = [
    { id: "tech",          names: ["TechNova", "SpaceY"],        income: 0.15 },
    { id: "smart",         names: ["GreenVolt", "TechNova"],     income: 0.10 },
    { id: "health",        names: ["MedFuture", "TechNova"],     product: 0.10 },
    { id: "finance",       names: ["EuroBank"], extra: 1,        interest: 0.4, global: true },
    { id: "green",         names: ["GreenVolt", "SpaceY"],       volatility: 0.3 },
    { id: "entertainment", names: ["PixelForge", "StreamWave"],  income: 0.15 },
    { id: "aero",          names: ["SkyLine Air", "SpaceY"],     volatility: 0.3 },
    { id: "malls",         names: ["BuildCo", "FreshMart"],      income: 0.12 },
  ];

  // Choice events. run(stock) changes the stock and returns a news part [key, params].
  // The LAST option is the safe default (online: picked automatically on timeout).
  const CHOICE_EVENTS = [
    { id: "scandal", options: [
      { pay: 20000, run: s => {
        if (Math.random() < 0.3) { s.reputation = clamp(s.reputation - 15, 0, 100); s.price = round2(s.price * 0.85); return ["choice.scandal.r0bad", { company: s.name }]; }
        return ["choice.scandal.r0ok", { company: s.name }]; } },
      { run: s => { s.reputation = clamp(s.reputation - 5, 0, 100); s.ceo.reliability = clamp(s.ceo.reliability + 3, 0, 100); return ["choice.scandal.r1", { company: s.name }]; } },
    ] },
    { id: "union", options: [
      { pay: 15000, run: s => { s.reputation = clamp(s.reputation + 4, 0, 100); return ["choice.union.r0", { company: s.name }]; } },
      { run: s => {
        if (Math.random() < 0.5) { s.price = round2(s.price * 0.92); s.employees = Math.floor(s.employees * 0.95); return ["choice.union.r1bad", { company: s.name }]; }
        return ["choice.union.r1ok", { company: s.name }]; } },
    ] },
    { id: "patent", options: [
      { pay: 40000, run: s => {
        if (Math.random() < 0.3) { s.research = clamp(s.research + 2, 0, 100); return ["choice.patent.r0bad", { company: s.name }]; }
        s.research = clamp(s.research + 12, 0, 100); s.price = round2(s.price * 1.04); return ["choice.patent.r0ok", { company: s.name }]; } },
      { run: s => ["choice.patent.r1", { company: s.name }] },
    ] },
    { id: "subsidy", options: [
      { run: s => { s.employees += 200; s.companyCash += 30000; s.reputation = clamp(s.reputation + 3, 0, 100); return ["choice.subsidy.r0", { company: s.name }]; } },
      { run: s => { s.reputation = clamp(s.reputation - 2, 0, 100); return ["choice.subsidy.r1", { company: s.name }]; } },
    ] },
    { id: "influencer", options: [
      { pay: 10000, run: s => {
        if (Math.random() < 0.6) { s.reputation = clamp(s.reputation + 10, 0, 100); s.price = round2(s.price * 1.06); return ["choice.influencer.r0ok", { company: s.name }]; }
        s.reputation = clamp(s.reputation - 6, 0, 100); return ["choice.influencer.r0bad", { company: s.name }]; } },
      { run: s => ["choice.influencer.r1", { company: s.name }] },
    ] },
  ];

  const CEO_NAMES = ["Lina Storm", "Omar Van Dijk", "Victor Chen", "Aya Moreau", "Nora Steel", "Jonas Peeters", "Iris Laurent", "Karim Benali", "Sofia Lund", "Mateo Silva"];

  return { MARKETS, SECTORS, STOCK_DEFS, PRODUCT_IDEAS, GENERIC_PRODUCTS, RISK_PROFILES, DEFAULT_RISK, MARKET_EVENTS, SYNERGIES, CHOICE_EVENTS, CEO_NAMES };
});
