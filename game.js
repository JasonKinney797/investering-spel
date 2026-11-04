"use strict";
(() => {

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const SAVE_KEY = "investeer-sim-save-v2";
const SETTINGS_KEY = "investeer-sim-settings-v1";

const MARKETS = ["Europa", "Amerika", "Azië"];
const MARKET_COSTS = { Europa: 20000, Amerika: 40000, Azië: 70000 };
const MARKET_FAIL_CHANCE = { Europa: 0, Amerika: 0.18, Azië: 0.32 };
const MARKET_INCOME_BONUS = { Europa: 0, Amerika: 0.25, Azië: 0.4 };
const MARKET_DRIFT = { Europa: 0.0005, Amerika: 0.001, Azië: 0.0015 };

const RECESSION_RECOVERY_CHANCE = 0.28;
const DEPRESSION_TRIGGER_DAYS = 8;
const DEPRESSION_CHANCE = 0.12;
const DEPRESSION_RECOVERY_CHANCE = 0.25;

const FACTORY_COST = 50000;
const FACTORY_DAILY_INCOME = 3500;
const MAX_LOANS = 5;
const LOAN_AMOUNT = 100000;
const MAX_DEBT = MAX_LOANS * LOAN_AMOUNT;

const OWNERSHIP_THRESHOLD = 50;
const CEO_THRESHOLD = 100;
const WIN_TARGET = 1_000_000_000;
const IPO_THRESHOLD = 10_000_000;
const IPO_SHARES = 200;
const IPO_PRICE = 12500;

const SHORT_MARGIN = 0.5;          // 50% of position value locked as collateral
const SHORT_DAILY_FEE = 0.001;     // 0.1% of position value per day
const SHORT_MARGIN_CALL = 0.15;    // forced close when equity < 15% of value

const HISTORY_LEN = 120;
const MIN_XP_TRADE_VALUE = 500;
const MAX_BUY_XP_PER_DAY = 10;
const MAX_SELL_XP_PER_DAY = 5;

const SPEEDS = [0, 1500, 750, 300]; // ms per day; 0 = paused
const SPEED_LABELS = ["⏸", "1×", "2×", "5×"];

const DIFFICULTIES = {
  easy:     { label: "Makkelijk", desc: "Dubbel startgeld, minder recessies, lagere rente, rustige rivalen.", cashMult: 2,    recession: 0.02,  interest: 0.6, fee: 0.004, rival: 0.6, permadeath: false },
  normal:   { label: "Normaal",   desc: "De gebalanceerde ervaring.",                                         cashMult: 1,    recession: 0.035, interest: 1,   fee: 0.006, rival: 1,   permadeath: false },
  hardcore: { label: "Hardcore",  desc: "Minder geld, meer crisissen, agressieve rivalen. Failliet = save weg.", cashMult: 0.75, recession: 0.05,  interest: 1.4, fee: 0.008, rival: 1.4, permadeath: true },
};

const INVESTOR_RANKS = [
  { name: "Beginner", xpNeeded: 0,    color: "#64748b", icon: "🌱" },
  { name: "Junior",   xpNeeded: 100,  color: "#22c55e", icon: "📊" },
  { name: "Analist",  xpNeeded: 300,  color: "#3b82f6", icon: "🔍" },
  { name: "Senior",   xpNeeded: 700,  color: "#a78bfa", icon: "💼" },
  { name: "Expert",   xpNeeded: 1500, color: "#f59e0b", icon: "⚡" },
  { name: "Legende",  xpNeeded: 3000, color: "#ef4444", icon: "🌟" },
];
// Each rank lowers transaction fees by 15% (Legende pays 25% of the base fee).
const RANK_FEE_REDUCTION = 0.15;

const XP_REWARDS = {
  buy: 2, sell_profit: 10, own_company: 25, become_ceo: 50, product_hit: 15,
  risk_success: 20, takeover: 40, survive_recession: 30, survive_depression: 60,
  reach_100k: 50, reach_500k: 100, reach_1m: 200, reach_10m: 400, reach_100m: 800,
};

const ACHIEVEMENTS = [
  { id: "first_buy",     label: "Eerste aankoop",      desc: "Koop je eerste aandelen.",                    xp: 10,  icon: "📈" },
  { id: "first_own",     label: "Eerste eigenaar",     desc: "Bezit je eerste bedrijf.",                    xp: 25,  icon: "🏢" },
  { id: "first_ceo",     label: "Eerste CEO",          desc: "Word CEO van een bedrijf.",                   xp: 50,  icon: "👔" },
  { id: "hit_product",   label: "Bestseller",          desc: "Launch een succesproduct.",                   xp: 20,  icon: "🚀" },
  { id: "risk_win",      label: "Gokker",              desc: "Win een risicoproject.",                      xp: 20,  icon: "🎲" },
  { id: "takeover_win",  label: "Overname",            desc: "Neem een bedrijf over.",                      xp: 40,  icon: "🤝" },
  { id: "survived_rec",  label: "Recessie overleefd",  desc: "Overleef een recessie.",                      xp: 30,  icon: "🛡️" },
  { id: "survived_dep",  label: "Depressie overleefd", desc: "Overleef een depressie.",                     xp: 60,  icon: "💪" },
  { id: "reach_100k",    label: "€100K club",          desc: "Bereik €100.000 totaalwaarde.",               xp: 50,  icon: "💰" },
  { id: "reach_1m",      label: "Miljonair",           desc: "Bereik €1.000.000 totaalwaarde.",             xp: 150, icon: "💎" },
  { id: "reach_10m",     label: "Tycoon",              desc: "Bereik €10.000.000 totaalwaarde.",            xp: 300, icon: "🏆" },
  { id: "reach_100m",    label: "Magnaat",             desc: "Bereik €100.000.000 totaalwaarde.",           xp: 600, icon: "🌍" },
  { id: "own_all",       label: "Monopolist",          desc: "Bezit alle 5 beursbedrijven tegelijk.",       xp: 200, icon: "👑" },
  { id: "all_markets",   label: "Globalist",           desc: "Open alle 3 markten in 1 bedrijf.",           xp: 80,  icon: "🌐" },
  { id: "no_debt",       label: "Schuldenvrij",        desc: "Los een volledige schuld af.",                xp: 40,  icon: "✅" },
  { id: "war_started",   label: "Oorlogszuchtig",      desc: "Start een concurrentieoorlog.",               xp: 20,  icon: "⚔️" },
  { id: "bankruptcy",    label: "Bankroet bevriend",   desc: "Overleef het faillissement van een bedrijf.", xp: 15,  icon: "💀" },
  { id: "short_win",     label: "Shortkoning",         desc: "Maak winst op een short-positie.",            xp: 30,  icon: "📉" },
  { id: "synergy",       label: "Synergie",            desc: "Activeer een sectorsynergie.",                xp: 40,  icon: "🔗" },
  { id: "ipo",           label: "Oprichter",           desc: "Breng je eigen bedrijf naar de beurs.",       xp: 150, icon: "🔔" },
  { id: "beat_rivals",   label: "Nummer één",          desc: "Wees na dag 30 rijker dan alle rivalen.",     xp: 80,  icon: "🥇" },
  { id: "defended",      label: "Verdediger",          desc: "Heroover een bedrijf van een rivaal.",        xp: 40,  icon: "🏰" },
  { id: "goals_10",      label: "Doelgericht",         desc: "Voltooi 10 dagdoelen.",                       xp: 60,  icon: "🎯" },
  { id: "legend_rank",   label: "Legende bereikt",     desc: "Bereik investeerdersrang Legende.",           xp: 0,   icon: "⭐" },
  { id: "hardcore_win",  label: "IJzeren wil",         desc: "Win het spel op Hardcore.",                   xp: 0,   icon: "🔥" },
];

const ACTION_COSTS = {
  marketing: 5000, employees: 12000, research: 20000,
  risk: 30000, ceo: 15000, factory: FACTORY_COST, product: 25000,
};
const WAR_COSTS = { price: 20000, ads: 15000, talent: 10000 };

const PRODUCT_IDEAS = {
  TechNova:  ["AI Assistant", "Gaming Laptop", "Smartphone", "Cloud Platform"],
  GreenVolt: ["Solar Roof", "Home Battery", "Wind Turbine", "Eco Charger"],
  EuroBank:  ["Premium Account", "Safe Loan System", "Mobile Banking", "Fraud Shield"],
  MedFuture: ["Health Scanner", "Medical AI", "Recovery Device", "Smart Lab"],
  SpaceY:    ["Reusable Rocket", "Moon Cargo", "Satellite Net", "Mars Prototype"],
};
const GENERIC_PRODUCTS = ["Startup Kit", "Pro Edition", "Abonnement", "Smart Device", "Platform 2.0"];

const RISK_PROFILES = {
  TechNova:  { chance: 0.58, up: 1.22, down: 0.91 },
  GreenVolt: { chance: 0.68, up: 1.14, down: 0.94 },
  EuroBank:  null,
  MedFuture: { chance: 0.38, up: 1.42, down: 0.80 },
  SpaceY:    { chance: 0.20, up: 2.00, down: 0.50 },
};
const DEFAULT_RISK = { chance: 0.5, up: 1.2, down: 0.85 };

const SECTORS = { tech: "Tech", energy: "Energie", finance: "Financiën", health: "Zorg", space: "Ruimtevaart" };

const SYNERGIES = [
  { id: "tech",    label: "Tech-alliantie",  names: ["TechNova", "SpaceY"],    desc: "+15% inkomen voor TechNova en SpaceY.",        income: 0.15 },
  { id: "smart",   label: "Smart Energy",    names: ["GreenVolt", "TechNova"], desc: "+10% inkomen voor GreenVolt en TechNova.",     income: 0.10 },
  { id: "health",  label: "HealthTech",      names: ["MedFuture", "TechNova"], desc: "+10% kans op een producthit voor beide.",      product: 0.10 },
  { id: "finance", label: "Huisbankier",     names: ["EuroBank"], extra: 1,    desc: "EuroBank + minstens 1 ander bedrijf: −40% rente voor al je bedrijven.", interest: 0.4, global: true },
  { id: "green",   label: "Groene raketten", names: ["GreenVolt", "SpaceY"],   desc: "SpaceY is 30% minder volatiel.",               volatility: 0.3 },
];

const MARKET_EVENTS = [
  { title: "AI-hype trekt investeerders naar TechNova.", affected: ["TechNova"], multiplier: 1.1 },
  { title: "Energieprijzen stijgen. GreenVolt wint aandacht.", affected: ["GreenVolt"], multiplier: 1.08 },
  { title: "Banken winnen vertrouwen. EuroBank stabiel omhoog.", affected: ["EuroBank"], multiplier: 1.03 },
  { title: "Medische doorbraak. MedFuture profiteert.", affected: ["MedFuture"], multiplier: 1.12 },
  { title: "SpaceY schiet wild heen en weer.", affected: ["SpaceY"], multiplier: () => Math.random() > 0.5 ? 1.22 : 0.75 },
  { title: "Renteangst raakt de markt. Risico-aandelen dalen.", affected: ["TechNova", "GreenVolt", "MedFuture", "SpaceY"], multiplier: 0.95 },
  { title: "Optimisme keert terug. Bijna alle aandelen stijgen.", affected: "*", multiplier: 1.05 },
  { title: "Consumenten geven minder uit. Groeibedrijven raken klappen.", affected: ["TechNova", "GreenVolt", "MedFuture", "SpaceY"], multiplier: 0.93 },
  { title: "Grote fondsen kopen defensief. EuroBank rustig.", affected: ["EuroBank"], multiplier: 1.02 },
  { title: "Speculanten pompen SpaceY opnieuw omhoog.", affected: ["SpaceY"], multiplier: 1.3 },
  { title: "Rustige handelsdag. Weinig nieuws.", affected: [], multiplier: 1 },
];

const CEO_NAMES = ["Lina Storm", "Omar Van Dijk", "Victor Chen", "Aya Moreau", "Nora Steel", "Jonas Peeters", "Iris Laurent", "Karim Benali"];

const RIVAL_TEMPLATES = [
  { name: "Victor Vale",   style: "agressief",   cash: 40000, color: "#ef4444", icon: "🦈", likes: ["SpaceY", "TechNova", "MedFuture"] },
  { name: "Sophie Stern",  style: "voorzichtig", cash: 80000, color: "#06b6d4", icon: "🦉", likes: ["EuroBank", "GreenVolt", "MedFuture"] },
  { name: "Bram Peeters",  style: "trendvolger", cash: 25000, color: "#f59e0b", icon: "🐺", likes: [] },
];
const RIVAL_NORMAL_CAP = 45;   // rivals never cross the ownership line unless they go hostile
const RIVAL_HOSTILE_FROM_DAY = 20;

// Choice events. `pay` is taken from company cash; options without enough cash are disabled.
const CHOICE_EVENTS = [
  {
    id: "scandal", title: "📰 Journalist dreigt met onthulling",
    text: c => `Een journalist heeft vervelende documenten over ${c}. Wat doe je?`,
    options: [
      { label: "Betaal €20K om het stil te houden", pay: 20000, run: s => {
          if (Math.random() < 0.3) { s.reputation = clamp(s.reputation - 15, 0, 100); s.price = round2(s.price * 0.85); return `Het lekt toch uit. ${s.name} verliest 15% en reputatie.`; }
          return `Het verhaal verdwijnt. ${s.name} blijft buiten schot.`;
        } },
      { label: "Open kaart spelen", run: s => {
          s.reputation = clamp(s.reputation - 5, 0, 100); s.ceo.reliability = clamp(s.ceo.reliability + 3, 0, 100);
          return `${s.name} is eerlijk. Kleine reputatiedeuk, maar de CEO wint aan betrouwbaarheid.`;
        } },
    ],
  },
  {
    id: "union", title: "✊ Vakbond eist loonsverhoging",
    text: c => `Werknemers van ${c} willen meer loon en dreigen met staking.`,
    options: [
      { label: "Akkoord (€15K bonus)", pay: 15000, run: s => { s.reputation = clamp(s.reputation + 4, 0, 100); return `Tevreden personeel. ${s.name} reputatie +4.`; } },
      { label: "Weigeren", run: s => {
          if (Math.random() < 0.5) { s.price = round2(s.price * 0.92); s.employees = Math.floor(s.employees * 0.95); return `Staking! ${s.name} −8% en 5% personeel vertrekt.`; }
          return `De vakbond geeft toe. Niets aan de hand bij ${s.name}.`;
        } },
    ],
  },
  {
    id: "patent", title: "📜 Patent te koop",
    text: c => `Een concurrent wil een patent verkopen aan ${c} voor €40K.`,
    options: [
      { label: "Kopen (€40K)", pay: 40000, run: s => {
          if (Math.random() < 0.3) { s.research = clamp(s.research + 2, 0, 100); return `Het patent blijkt weinig waard. Onderzoek +2.`; }
          s.research = clamp(s.research + 12, 0, 100); s.price = round2(s.price * 1.04); return `Topdeal! ${s.name} onderzoek +12 en koers +4%.`;
        } },
      { label: "Afslaan", run: s => `${s.name} laat het patent liggen.` },
    ],
  },
  {
    id: "subsidy", title: "🏛️ Overheidssubsidie",
    text: c => `De overheid biedt ${c} €30K subsidie als het bedrijf 200 banen schept.`,
    options: [
      { label: "Aannemen (+200 werknemers)", run: s => { s.employees += 200; s.companyCash += 30000; s.reputation = clamp(s.reputation + 3, 0, 100); return `${s.name} schept 200 banen en krijgt €30K.`; } },
      { label: "Bedanken", run: s => { s.reputation = clamp(s.reputation - 2, 0, 100); return `De pers vindt het jammer. ${s.name} reputatie −2.`; } },
    ],
  },
  {
    id: "influencer", title: "📱 Influencer-deal",
    text: c => `Een bekende influencer wil ${c} promoten voor €10K.`,
    options: [
      { label: "Doen (€10K)", pay: 10000, run: s => {
          if (Math.random() < 0.6) { s.reputation = clamp(s.reputation + 10, 0, 100); s.price = round2(s.price * 1.06); return `Viraal! ${s.name} +6% en reputatie +10.`; }
          s.reputation = clamp(s.reputation - 6, 0, 100); return `Backlash online. ${s.name} reputatie −6.`;
        } },
      { label: "Nee, bedankt", run: s => `${s.name} houdt het rustig.` },
    ],
  },
];

const INITIAL_STOCKS = [
  { name: "TechNova",  sector: "tech",    price: 120, volatility: 0.09, reputation: 50, employees: 1200, research: 50, markets: ["Europa"],  companyCash: 50000,  ceo: { name: "Mila Vos",        leadership: 60, innovation: 75, reliability: 55 } },
  { name: "GreenVolt", sector: "energy",  price: 80,  volatility: 0.07, reputation: 50, employees: 900,  research: 50, markets: ["Europa"],  companyCash: 35000,  ceo: { name: "Noah Verbruggen", leadership: 58, innovation: 65, reliability: 70 } },
  { name: "EuroBank",  sector: "finance", price: 60,  volatility: 0.01, reputation: 70, employees: 2400, research: 35, markets: ["Europa"],  companyCash: 120000, ceo: { name: "Elise De Smet",   leadership: 72, innovation: 35, reliability: 90 } },
  { name: "MedFuture", sector: "health",  price: 95,  volatility: 0.08, reputation: 55, employees: 1100, research: 60, markets: ["Europa"],  companyCash: 60000,  ceo: { name: "Samira Haddad",   leadership: 55, innovation: 85, reliability: 60 } },
  { name: "SpaceY",    sector: "space",   price: 150, volatility: 0.22, reputation: 65, employees: 700,  research: 80, markets: ["Amerika"], companyCash: 80000,  ceo: { name: "Rex Orion",       leadership: 45, innovation: 95, reliability: 30 } },
];
const BASE_NAMES = INITIAL_STOCKS.map(s => s.name);

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
const round2 = v => Math.round(v * 100) / 100;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function fmt(v) {
  if (!isFinite(v)) return "∞";
  return v.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtShort(v) {
  if (!isFinite(v)) return "∞";
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  if (a >= 1e9) return sign + "€" + (a / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return sign + "€" + (a / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return sign + "€" + (a / 1e3).toFixed(0) + "K";
  if (a >= 1e3) return sign + "€" + (a / 1e3).toFixed(1) + "K";
  return sign + "€" + a.toFixed(0);
}
function randomCeo() {
  return {
    name: pick(CEO_NAMES),
    leadership: Math.floor(40 + Math.random() * 56),
    innovation: Math.floor(30 + Math.random() * 66),
    reliability: Math.floor(35 + Math.random() * 61),
  };
}

function storageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function storageSet(key, val) { try { localStorage.setItem(key, val); return true; } catch { return false; } }
function storageDel(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } }

// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════

let state = null;
const ui = {
  tab: "market", selected: null, amounts: {}, speed: 0, modal: null,
  takeoverTarget: "", warTarget: "", flashDay: 0, ipoName: "", ipoSector: "tech",
};
const settings = Object.assign({ sound: true }, safeParse(storageGet(SETTINGS_KEY)) || {});

function safeParse(txt) { try { return txt ? JSON.parse(txt) : null; } catch { return null; } }

function makeStock(def) {
  return {
    name: def.name, sector: def.sector, price: def.price, volatility: def.volatility,
    reputation: def.reputation, employees: def.employees, research: def.research,
    factories: 0, markets: [...def.markets], debt: 0, companyCash: def.companyCash,
    dividendRate: 10, playerCEO: false, ceo: { ...def.ceo }, products: [],
    bankrupt: false, history: [def.price], controlledBy: null, custom: !!def.custom,
    lastWarDay: 0,
  };
}

function getStartingSetup(diffKey) {
  const m = DIFFICULTIES[diffKey].cashMult;
  const r = Math.random() * 100;
  let s;
  if (r < 12)      s = { cash: 5000,     ownAll: false, label: "💀 Harde start",     text: "Je start met weinig geld. Veel geluk." };
  else if (r < 24) s = { cash: 1000000,  ownAll: true,  label: "👑 Dynasty start",   text: "Je bezit alle bedrijven, maar bent nergens CEO." };
  else if (r < 74) s = { cash: 10000,    ownAll: false, label: "📈 Normale start",   text: "Een normale start." };
  else if (r < 84) s = { cash: 50000,    ownAll: false, label: "💼 Sterke start",    text: "Een sterke start." };
  else if (r < 94) s = { cash: 250000,   ownAll: false, label: "🏦 Rijke start",     text: "Een rijke start." };
  else if (r < 99) s = { cash: 1000000,  ownAll: false, label: "💎 Miljonair start", text: "Je start als miljonair." };
  else             s = { cash: 50000000, ownAll: false, label: "🎰 Jackpot",         text: "Jackpot! Wat doe je ermee?" };
  s.cash = Math.round(s.cash * m);
  s.text = `${s.text} Startkapitaal: ${fmtShort(s.cash)}.`;
  return s;
}

function newGame(diffKey, persist = true) {
  const setup = getStartingSetup(diffKey);
  const stocks = INITIAL_STOCKS.map(makeStock);
  const holdings = {};
  if (setup.ownAll) stocks.forEach(s => { holdings[s.name] = { qty: OWNERSHIP_THRESHOLD, avg: s.price }; });

  state = {
    v: 2, difficulty: diffKey, setupLabel: setup.label, day: 1, cash: setup.cash,
    stocks, holdings, shorts: {},
    recession: false, recessionDays: 0, depression: false, depressionDays: 0,
    xp: 0, achievements: [], milestones: [],
    rewarded: { own: {}, ceo: {} },
    rivals: RIVAL_TEMPLATES.map(t => ({ name: t.name, style: t.style, color: t.color, icon: t.icon, likes: t.likes, cash: Math.round(t.cash * DIFFICULTIES[diffKey].rival), holdings: {} })),
    news: [{ day: 1, text: `${setup.label} — ${setup.text}`, kind: "info" }],
    lastDividend: 0,
    goal: null, goalsDone: 0,
    today: { buys: 0, actions: 0, buyXp: 0, sellXp: 0 },
    trades: [], ipoDone: false, pendingChoice: null,
    gameOver: false, gameWon: false,
    ownedPrev: {}, qtyPrev: {}, lostTo: {},
  };

  if (setup.ownAll) {
    state.achievements.push("first_buy", "first_own", "own_all", "synergy");
    stocks.forEach(s => { state.rewarded.own[s.name] = true; });
  }
  // Milestones already below the starting total give no XP.
  const startTotal = totalValue();
  milestoneList().forEach(m => { if (startTotal >= m.threshold) state.milestones.push(m.key); });
  syncOwnership(true);
  state.goal = newGoal();

  ui.tab = "market"; ui.selected = ownedNames()[0] || null; ui.amounts = {};
  ui.takeoverTarget = ""; ui.warTarget = ""; ui.flashDay = 0;
  setSpeed(0);
  ui.placeholder = !persist;
  if (persist) save();
}

// ═══════════════════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════════════════

const diff = () => DIFFICULTIES[state.difficulty];
const stockBy = name => state.stocks.find(s => s.name === name);
const qtyOf = name => (state.holdings[name] ? state.holdings[name].qty : 0);
const maxRivalQty = name => state.rivals.reduce((m, r) => Math.max(m, r.holdings[name] ? r.holdings[name].qty : 0), 0);
const topRival = name => state.rivals.reduce((best, r) => {
  const q = r.holdings[name] ? r.holdings[name].qty : 0;
  return q > (best ? best.q : 0) ? { r, q } : best;
}, null);

function isOwned(name, depth = 0) {
  const s = stockBy(name);
  if (!s || s.bankrupt) return false;
  const q = qtyOf(name);
  if (q >= OWNERSHIP_THRESHOLD && q >= maxRivalQty(name)) return true;
  if (s.controlledBy && depth < 6) return isOwned(s.controlledBy, depth + 1);
  return false;
}
const ownedNames = () => state.stocks.filter(s => isOwned(s.name)).map(s => s.name);

function rankIndex(xp = state.xp) {
  let r = 0;
  INVESTOR_RANKS.forEach((rk, i) => { if (xp >= rk.xpNeeded) r = i; });
  return r;
}
const feeRate = () => diff().fee * (1 - rankIndex() * RANK_FEE_REDUCTION);

function shortEquity(name) {
  const sh = state.shorts[name];
  if (!sh) return 0;
  const s = stockBy(name);
  return sh.margin + (sh.entry - s.price) * sh.qty;
}
function longValue() { return state.stocks.reduce((t, s) => t + qtyOf(s.name) * s.price, 0); }
function shortsValue() { return Object.keys(state.shorts).reduce((t, n) => t + shortEquity(n), 0); }
function totalValue() { return state.cash + longValue() + shortsValue(); }

function activeSynergies() {
  const owned = new Set(ownedNames());
  return SYNERGIES.filter(sy => sy.names.every(n => owned.has(n)) && owned.size >= sy.names.length + (sy.extra || 0));
}
function synergyBonus(name, key) {
  if (!isOwned(name)) return 0;
  return activeSynergies().reduce((t, sy) => t + ((sy.global || sy.names.includes(name)) && sy[key] ? sy[key] : 0), 0);
}

function econMult() { return state.depression ? 0.6 : state.recession ? 0.78 : 1; }
function calcIncome(s) {
  const base = s.employees * 4 + s.factories * FACTORY_DAILY_INCOME;
  const market = 1 + s.markets.reduce((t, m) => t + MARKET_INCOME_BONUS[m], 0);
  return base * market * (1 + synergyBonus(s.name, "income")) * econMult();
}
function interestRate(s) {
  const base = s.ceo.reliability >= 75 ? 0.0012 : s.ceo.reliability >= 50 ? 0.002 : 0.003;
  return base * diff().interest * (1 - synergyBonus(s.name, "interest"));
}
function calcCosts(s) {
  const salary = s.employees * (state.recession || state.depression ? 2.4 : 2);
  return salary + s.debt * interestRate(s);
}
const calcProfit = s => calcIncome(s) - calcCosts(s);
const loanCount = s => Math.ceil(s.debt / LOAN_AMOUNT - 1e-9);

function dailyDrift(s) {
  const rep = s.reputation <= 20 ? -0.006 : s.reputation <= 40 ? -0.002 : s.reputation <= 60 ? 0 : s.reputation <= 80 ? 0.0015 : 0.0025;
  const res = s.research < 20 ? 0 : s.research < 40 ? 0.0005 : s.research < 60 ? 0.001 : s.research < 80 ? 0.002 : 0.003;
  const mk = s.markets.reduce((t, m) => t + MARKET_DRIFT[m], 0);
  const ceo = (s.ceo.leadership - 50) / 25000 + (s.ceo.reliability - 50) / 30000;
  return rep + res + mk + ceo;
}

function companyLevel(s) {
  const v = s.reputation + s.research + s.factories * 10 + s.employees / 300 + (s.markets.length - 1) * 15;
  if (v >= 220) return "Megacorporatie";
  if (v >= 170) return "Multinational";
  if (v >= 125) return "Nationaal bedrijf";
  if (v >= 90)  return "Regionaal bedrijf";
  if (v >= 55)  return "Klein bedrijf";
  return "Startup";
}

function dayChange(s) {
  const h = s.history;
  if (h.length < 2 || !h[h.length - 2]) return 0;
  return (h[h.length - 1] - h[h.length - 2]) / h[h.length - 2] * 100;
}

// ═══════════════════════════════════════════════════════════════════════════
// News, XP, achievements, goals
// ═══════════════════════════════════════════════════════════════════════════

function addNews(text, kind = "info") {
  state.news.unshift({ day: state.day, text, kind });
  if (state.news.length > 40) state.news.length = 40;
}

function awardXP(amount, reason) {
  if (amount <= 0) return;
  const before = rankIndex();
  state.xp += amount;
  if (reason) toast(`+${amount} XP — ${reason}`);
  const after = rankIndex();
  if (after > before) {
    const rk = INVESTOR_RANKS[after];
    toast(`${rk.icon} Nieuwe rang: ${rk.name}! Lagere transactiekosten.`, "big");
    confetti(); sound("rank");
    if (after === INVESTOR_RANKS.length - 1) unlock("legend_rank");
  }
}

function unlock(id) {
  if (state.achievements.includes(id)) return;
  const ach = ACHIEVEMENTS.find(a => a.id === id);
  if (!ach) return;
  state.achievements.push(id);
  toast(`${ach.icon} Prestatie ontgrendeld: ${ach.label}!`, "big");
  confetti(); sound("achievement");
  if (ach.xp > 0) awardXP(ach.xp, null);
}

function milestoneList() {
  return [
    { key: "reach_100k", threshold: 1e5, achId: "reach_100k", xp: XP_REWARDS.reach_100k },
    { key: "reach_500k", threshold: 5e5, achId: null,         xp: XP_REWARDS.reach_500k },
    { key: "reach_1m",   threshold: 1e6, achId: "reach_1m",   xp: XP_REWARDS.reach_1m },
    { key: "reach_10m",  threshold: 1e7, achId: "reach_10m",  xp: XP_REWARDS.reach_10m },
    { key: "reach_100m", threshold: 1e8, achId: "reach_100m", xp: XP_REWARDS.reach_100m },
  ];
}
function checkMilestones(total) {
  milestoneList().forEach(m => {
    if (total >= m.threshold && !state.milestones.includes(m.key)) {
      state.milestones.push(m.key);
      awardXP(m.xp, `mijlpaal ${fmtShort(m.threshold)} bereikt`);
      if (m.achId) unlock(m.achId);
    }
  });
}

function estimatedDividend() {
  return ownedNames().reduce((t, n) => {
    const s = stockBy(n); const p = calcProfit(s);
    return t + (p > 0 ? p * s.dividendRate / 100 : 0);
  }, 0);
}

function newGoal() {
  const opts = [
    { type: "buys",   target: 2,    xp: 15, text: `Doe 2 aankopen van minstens ${fmtShort(MIN_XP_TRADE_VALUE)}` },
    { type: "growth", target: 1.02, xp: 25, text: "Laat je totaalwaarde 2% stijgen tegen de volgende dag" },
    { type: "short",  target: 1,    xp: 15, text: "Open een short-positie" },
  ];
  if (ownedNames().length) {
    opts.push({ type: "actions", target: 2, xp: 20, text: "Doe 2 bedrijfsacties" });
    const est = estimatedDividend();
    if (est > 50) {
      const target = Math.max(100, Math.round(est * 1.25));
      opts.push({ type: "dividend", target, xp: 25, text: `Ontvang minstens ${fmtShort(target)} dividend bij de volgende dag` });
    }
  }
  return { ...pick(opts), progress: 0, done: false, base: totalValue() };
}
function goalProgress(type, amount = 1) {
  const g = state.goal;
  if (!g || g.done || g.type !== type) return;
  g.progress += amount;
  if (g.progress >= g.target) completeGoal();
}
function completeGoal() {
  const g = state.goal;
  g.done = true;
  state.goalsDone++;
  awardXP(g.xp, "dagdoel voltooid");
  sound("goal");
  if (state.goalsDone >= 10) unlock("goals_10");
}

// ═══════════════════════════════════════════════════════════════════════════
// Ownership / CEO bookkeeping (single place that reacts to holding changes)
// ═══════════════════════════════════════════════════════════════════════════

function syncOwnership(silent = false) {
  state.stocks.forEach(s => {
    const name = s.name;
    const owned = isOwned(name);
    const prev = !!state.ownedPrev[name];
    const q = qtyOf(name);
    const prevQ = state.qtyPrev[name] || 0;

    if (owned && !prev && !silent) {
      if (state.lostTo[name]) {
        addNews(`Je heroverde ${name} van ${state.lostTo[name]}!`, "good");
        unlock("defended");
        delete state.lostTo[name];
      } else {
        addNews(`Je hebt nu controle over ${name}. Dashboard ontgrendeld.`, "good");
      }
      if (!state.rewarded.own[name]) { state.rewarded.own[name] = true; awardXP(XP_REWARDS.own_company, "bedrijf verworven"); }
      unlock("first_own");
      if (!ui.selected || !isOwned(ui.selected)) ui.selected = name;
    }
    if (!owned && prev && !s.bankrupt) {
      const tr = topRival(name);
      if (tr && tr.q > q && q >= OWNERSHIP_THRESHOLD) {
        state.lostTo[name] = tr.r.name;
        addNews(`⚠ Vijandige overname! ${tr.r.name} heeft meer aandelen ${name} dan jij. Koop terug om de controle te heroveren.`, "bad");
        sound("bad");
      } else {
        addNews(`Je hebt geen controle meer over ${name}.`, "bad");
      }
    }

    // CEO: automatic when crossing 100 shares while in control.
    if (owned && q >= CEO_THRESHOLD && prevQ < CEO_THRESHOLD && !s.playerCEO && !silent) becomeCEO(s);
    if (s.playerCEO && !(owned && q >= CEO_THRESHOLD)) {
      s.playerCEO = false;
      s.ceo = randomCeo();
      if (!silent) addNews(`Je bent geen CEO meer van ${name}. ${s.ceo.name} neemt over.`, "bad");
    }

    state.ownedPrev[name] = owned;
    state.qtyPrev[name] = q;
  });

  if (ui.selected && !isOwned(ui.selected)) ui.selected = ownedNames()[0] || null;
  if (ui.tab === "company" && !ui.selected) ui.tab = "market";

  if (silent) return;
  const owned = ownedNames();
  if (BASE_NAMES.every(n => owned.includes(n))) unlock("own_all");
  if (activeSynergies().length) unlock("synergy");
}

function becomeCEO(s) {
  s.playerCEO = true;
  s.ceo = { name: "Jij", leadership: 60, innovation: 60, reliability: 60 };
  addNews(`Je bent nu CEO van ${s.name}!`, "good");
  if (!state.rewarded.ceo[s.name]) { state.rewarded.ceo[s.name] = true; awardXP(XP_REWARDS.become_ceo, "CEO geworden"); }
  unlock("first_ceo");
}

// ═══════════════════════════════════════════════════════════════════════════
// Day simulation
// ═══════════════════════════════════════════════════════════════════════════

function goBankrupt(s, notes) {
  s.bankrupt = true; s.price = 0; s.employees = 0; s.companyCash = 0; s.debt = 0;
  s.playerCEO = false; s.controlledBy = null;
  notes.push(`${s.name} is failliet gegaan.`);
  state.rivals.forEach(r => { delete r.holdings[s.name]; });
  state.stocks.forEach(o => { if (o.controlledBy === s.name) o.controlledBy = null; });
  if (state.shorts[s.name]) {
    const sh = state.shorts[s.name];
    const gain = sh.margin + sh.entry * sh.qty;
    state.cash = round2(state.cash + gain);
    notes.push(`Je short op ${s.name} levert ${fmtShort(sh.entry * sh.qty)} winst op.`);
    delete state.shorts[s.name];
    unlock("short_win");
  }
  if (qtyOf(s.name) > 0 || isOwnedBefore(s.name)) unlock("bankruptcy");
}
function isOwnedBefore(name) { return !!state.ownedPrev[name]; }

function aiManage(s) {
  if (s.companyCash > 150000 && Math.random() < 0.03) {
    s.companyCash -= FACTORY_COST; s.factories++; s.employees += 120;
  } else if (s.companyCash > 60000 && Math.random() < 0.04) {
    s.companyCash -= 20000; s.research = clamp(s.research + 5, 0, 100);
  } else if (s.companyCash > 30000 && s.reputation < 45 && Math.random() < 0.05) {
    s.companyCash -= 5000; s.reputation = clamp(s.reputation + 6, 0, 100);
  }
}

function advanceDay() {
  if (!state || state.gameOver || state.gameWon || state.pendingChoice) return;
  const D = diff();
  const before = totalValue();
  const ev = pick(MARKET_EVENTS);
  const mult = typeof ev.multiplier === "function" ? ev.multiplier() : ev.multiplier;
  const owned = new Set(ownedNames());
  const notes = [];
  let dividend = 0;

  state.stocks.forEach(s => {
    if (s.bankrupt) return;

    // Company finances
    const profit = calcProfit(s);
    if (owned.has(s.name) && profit > 0) {
      const div = profit * s.dividendRate / 100;
      dividend += div;
      s.companyCash += profit - div;
    } else {
      s.companyCash += profit;
    }
    if (!owned.has(s.name)) aiManage(s);
    s.companyCash = round2(s.companyCash);

    // Price
    let p = s.price;
    if (ev.affected === "*" || ev.affected.includes(s.name)) p *= mult;
    if (s.name === "EuroBank") {
      p *= Math.random() > 0.5 ? 1.002 : 0.998;
    } else {
      const vol = s.volatility * (1 - synergyBonus(s.name, "volatility"));
      p += (Math.random() - 0.5) * vol * p;
    }
    p *= 1 + dailyDrift(s);

    if (state.recession) {
      p *= s.name === "EuroBank" ? 0.993 : s.name === "SpaceY" ? 0.96 : 0.978;
      if (Math.random() < 0.05 && s.employees > 150) {
        s.employees = Math.floor(s.employees * 0.96);
        notes.push(`${s.name} ontslaat werknemers door de recessie.`);
      }
    }
    if (state.depression) p *= 0.985;

    if (s.name === "SpaceY") {
      if (p > 1200 && Math.random() < 0.18) { p *= 0.55; s.reputation = clamp(s.reputation - 8, 0, 100); notes.push("SpaceY-bubbel knapt. Koers crasht 45%."); }
      if (p > 4000 && Math.random() < 0.30) { p *= 0.30; s.reputation = clamp(s.reputation - 15, 0, 100); notes.push("SpaceY mega-bubbel barst. Paniek."); }
    }
    if (Math.random() < 0.008 * ((100 - s.ceo.reliability) / 100)) {
      s.reputation = clamp(s.reputation - 8, 0, 100); p *= 0.92;
      notes.push(`${s.name}: betrouwbaarheidsschandaal.`);
    }

    s.price = round2(Math.max(0, p));
    s.history.push(s.price);
    if (s.history.length > HISTORY_LEN) s.history.shift();

    if (s.price < 1.5 || s.companyCash < -300000) goBankrupt(s, notes);
  });

  // Short positions: daily borrow fee and margin calls.
  Object.keys(state.shorts).forEach(name => {
    const sh = state.shorts[name]; const s = stockBy(name);
    const value = sh.qty * s.price;
    const fee = value * SHORT_DAILY_FEE;
    if (state.cash >= fee) state.cash -= fee; else sh.margin -= fee;
    const eq = shortEquity(name);
    if (eq < value * SHORT_MARGIN_CALL) {
      state.cash = round2(state.cash + Math.max(0, eq));
      logTrade(name, "cover", sh.qty, s.price);
      delete state.shorts[name];
      notes.push(`Margin call! Je short op ${name} is gedwongen gesloten.`);
      sound("bad");
    }
  });

  state.cash = round2(state.cash + dividend);
  state.lastDividend = round2(dividend);

  rivalsAct(notes);

  // Economic cycle
  const roll = Math.random();
  let headline = ev.title;
  if (state.depression) {
    state.depressionDays++;
    if (state.depressionDays >= 6 && roll < DEPRESSION_RECOVERY_CHANCE) {
      state.depression = false; state.depressionDays = 0;
      headline = `HERSTEL — De depressie is voorbij. ${ev.title}`;
      awardXP(XP_REWARDS.survive_depression, "depressie overleefd");
      unlock("survived_dep");
    }
  } else if (state.recession) {
    state.recessionDays++;
    if (state.recessionDays >= DEPRESSION_TRIGGER_DAYS && roll < DEPRESSION_CHANCE) {
      state.depression = true; state.depressionDays = 1; state.recession = false; state.recessionDays = 0;
      state.stocks.forEach(s => { if (!s.bankrupt) { s.price = round2(s.price * 0.6); s.history[s.history.length - 1] = s.price; } });
      headline = "DEPRESSIE — Paniek op de markt. Alle aandelen verliezen 40%.";
      sound("bad");
    } else if (state.recessionDays >= 5 && roll < RECESSION_RECOVERY_CHANCE) {
      state.recession = false; state.recessionDays = 0;
      headline = `HERSTEL — ${ev.title}`;
      awardXP(XP_REWARDS.survive_recession, "recessie overleefd");
      unlock("survived_rec");
    }
  } else if (roll < D.recession) {
    state.recession = true; state.recessionDays = 1;
    headline = `RECESSIE START — ${ev.title}`;
    sound("bad");
  }
  addNews([headline, ...notes].join(" "), /RECESSIE|DEPRESSIE/.test(headline) ? "bad" : /HERSTEL/.test(headline) ? "good" : "info");

  state.day++;
  state.today = { buys: 0, actions: 0, buyXp: 0, sellXp: 0 };

  syncOwnership();
  const after = totalValue();

  // Evaluate yesterday's goal, then roll a new one.
  const g = state.goal;
  if (g && !g.done) {
    if (g.type === "dividend" && dividend >= g.target) { g.progress = dividend; completeGoal(); }
    if (g.type === "growth" && g.base > 0 && after / g.base >= g.target) completeGoal();
  }
  state.goal = newGoal();

  // Pending choice event (only with an owned company, paused during auto-play).
  const ownedNow = ownedNames();
  if (ownedNow.length && state.day > 3 && Math.random() < 0.08) {
    const ev2 = pick(CHOICE_EVENTS);
    state.pendingChoice = { id: ev2.id, company: pick(ownedNow) };
  }

  if (state.day > 30 && state.rivals.every(r => rivalWorth(r) < after)) unlock("beat_rivals");

  checkMilestones(after);
  if (after >= WIN_TARGET) {
    state.gameWon = true;
    if (state.difficulty === "hardcore") unlock("hardcore_win");
    confetti(true); sound("win");
  } else if (after < 10) {
    state.gameOver = true;
    sound("bad");
  }

  ui.flashDay = state.day;
  sound("tick");
  save();
  if (state.gameOver && diff().permadeath) storageDel(SAVE_KEY);
  if (state.gameOver || state.gameWon) { setSpeed(0); openModal({ type: "end" }); }
  else if (state.pendingChoice) { setSpeed(0); openModal({ type: "choice" }); }
  render();
}

// ═══════════════════════════════════════════════════════════════════════════
// Rivals
// ═══════════════════════════════════════════════════════════════════════════

function rivalWorth(r) {
  return r.cash + Object.keys(r.holdings).reduce((t, n) => { const s = stockBy(n); return t + (s ? r.holdings[n].qty * s.price : 0); }, 0);
}

function rivalBuy(r, s, qty) {
  if (qty < 1) return 0;
  const cost = qty * s.price * (1 + diff().fee);
  if (cost > r.cash) return 0;
  r.cash = round2(r.cash - cost);
  const h = r.holdings[s.name] || { qty: 0, avg: s.price };
  h.avg = (h.avg * h.qty + s.price * qty) / (h.qty + qty);
  h.qty += qty;
  r.holdings[s.name] = h;
  return qty;
}

function rivalsAct(notes) {
  const aggro = diff().rival;
  const alive = state.stocks.filter(s => !s.bankrupt);
  if (!alive.length) return;
  const playerOwned = ownedNames();

  state.rivals.forEach(r => {
    r.cash = round2(r.cash + 150 * aggro); // side income keeps them in the game

    // Sell: stop-loss or take-profit
    Object.keys(r.holdings).forEach(n => {
      const s = stockBy(n); const h = r.holdings[n];
      if (!s || s.bankrupt) { delete r.holdings[n]; return; }
      const hostileHold = playerOwned.includes(n) || state.lostTo[n] === r.name;
      if (!hostileHold && (s.price < h.avg * 0.88 || (s.price > h.avg * 1.3 && Math.random() < 0.5))) {
        r.cash = round2(r.cash + h.qty * s.price * (1 - diff().fee));
        delete r.holdings[n];
      }
    });

    if (Math.random() > 0.55 * aggro) return;

    // Hostile move on a company the player controls.
    if (r.style === "agressief" && state.day > RIVAL_HOSTILE_FROM_DAY && playerOwned.length && Math.random() < 0.25 * aggro) {
      const target = stockBy(pick(playerOwned));
      const pq = qtyOf(target.name);
      if (pq > 0) {
        const want = Math.max(5, Math.ceil(pq * 0.25));
        const affordable = Math.floor(r.cash / (target.price * (1 + diff().fee)));
        const got = rivalBuy(r, target, Math.min(want, affordable));
        if (got) notes.push(`⚠ ${r.name} koopt ${got} aandelen ${target.name} op (bezit nu ${r.holdings[target.name].qty}).`);
        return;
      }
    }

    // Normal buy, capped below the ownership line.
    let s;
    if (r.style === "trendvolger") s = alive.slice().sort((a, b) => dayChange(b) - dayChange(a))[0];
    else s = stockBy(pick(r.likes.filter(n => stockBy(n) && !stockBy(n).bankrupt)) || pick(alive).name) || pick(alive);
    if (!s || s.bankrupt) return;
    if (r.style === "voorzichtig" && dayChange(s) < -3) return;
    const have = r.holdings[s.name] ? r.holdings[s.name].qty : 0;
    const room = RIVAL_NORMAL_CAP - have;
    const budget = r.cash * (0.15 + Math.random() * 0.25);
    rivalBuy(r, s, Math.min(room, Math.floor(budget / s.price)));
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Trading
// ═══════════════════════════════════════════════════════════════════════════

function logTrade(name, type, qty, price) {
  state.trades.push({ day: state.day, name, type, qty, price });
  if (state.trades.length > 400) state.trades.shift();
}

function readAmount(name) {
  const n = Math.floor(Number(String(ui.amounts[name] || "").replace(/[^\d]/g, "")));
  return isFinite(n) && n > 0 ? n : 0;
}

function maxBuyable(s) {
  if (s.bankrupt || s.price <= 0) return 0;
  return Math.max(0, Math.floor(state.cash / (s.price * (1 + feeRate()))));
}

function buyStock(name) {
  const s = stockBy(name);
  if (!s || s.bankrupt) return;
  const qty = readAmount(name);
  if (!qty) return msg("Vul een geldig aantal in (heel getal, minstens 1).");
  const cost = s.price * qty;
  const fee = cost * feeRate();
  if (state.cash < cost + fee) return msg(`Niet genoeg cash. Je kunt maximaal ${maxBuyable(s)} aandelen kopen.`);

  state.cash = round2(state.cash - cost - fee);
  const h = state.holdings[name] || { qty: 0, avg: s.price };
  h.avg = (h.avg * h.qty + (cost + fee)) / (h.qty + qty); // average includes fees = real cost basis
  h.qty += qty;
  state.holdings[name] = h;
  logTrade(name, "buy", qty, s.price);
  unlock("first_buy");

  if (cost >= MIN_XP_TRADE_VALUE) {
    if (state.today.buyXp < MAX_BUY_XP_PER_DAY) { state.today.buyXp++; awardXP(XP_REWARDS.buy, null); }
    goalProgress("buys");
  }
  addNews(`Gekocht: ${qty}× ${name} à €${fmt(s.price)} (kosten ${fmtShort(fee)}).`);
  sound("buy");
  afterAction();
}

function sellStock(name) {
  const s = stockBy(name);
  const qty = readAmount(name);
  const h = state.holdings[name];
  if (!h || !qty) return msg("Vul een geldig aantal in.");
  if (qty > h.qty) return msg(`Je hebt maar ${h.qty} aandelen ${name}.`);

  const gross = s.price * qty;
  const fee = gross * feeRate();
  const profit = gross - fee - h.avg * qty;
  state.cash = round2(state.cash + gross - fee);
  h.qty -= qty;
  if (h.qty <= 0) delete state.holdings[name];
  logTrade(name, "sell", qty, s.price);

  if (profit > 0 && gross >= MIN_XP_TRADE_VALUE && state.today.sellXp < MAX_SELL_XP_PER_DAY) {
    state.today.sellXp++;
    awardXP(XP_REWARDS.sell_profit, `winst op ${name}`);
  }
  addNews(`Verkocht: ${qty}× ${name} à €${fmt(s.price)}. Resultaat: ${profit >= 0 ? "+" : ""}${fmtShort(profit)}.`, profit >= 0 ? "good" : "bad");
  sound("sell");
  afterAction();
}

function openShort(name) {
  const s = stockBy(name);
  if (!s || s.bankrupt) return;
  if (isOwned(name)) return msg("Je kunt geen bedrijf shorten dat je zelf controleert.");
  const qty = readAmount(name);
  if (!qty) return msg("Vul een geldig aantal in om te shorten.");
  const value = s.price * qty;
  const margin = value * SHORT_MARGIN;
  const fee = value * feeRate();
  if (state.cash < margin + fee) return msg(`Shorten vraagt ${fmtShort(margin + fee)} onderpand + kosten.`);
  state.cash = round2(state.cash - margin - fee);
  const sh = state.shorts[name] || { qty: 0, entry: s.price, margin: 0 };
  sh.entry = (sh.entry * sh.qty + s.price * qty) / (sh.qty + qty);
  sh.qty += qty;
  sh.margin += margin;
  state.shorts[name] = sh;
  logTrade(name, "short", qty, s.price);
  goalProgress("short");
  addNews(`Short geopend: ${qty}× ${name} à €${fmt(s.price)}. Onderpand ${fmtShort(margin)}.`);
  sound("sell");
  afterAction();
}

function coverShort(name) {
  const sh = state.shorts[name];
  if (!sh) return;
  const s = stockBy(name);
  const fee = sh.qty * s.price * feeRate();
  const pnl = (sh.entry - s.price) * sh.qty - fee;
  state.cash = round2(state.cash + Math.max(0, sh.margin + (sh.entry - s.price) * sh.qty - fee));
  logTrade(name, "cover", sh.qty, s.price);
  delete state.shorts[name];
  if (pnl > 0) unlock("short_win");
  addNews(`Short op ${name} gesloten. Resultaat: ${pnl >= 0 ? "+" : ""}${fmtShort(pnl)}.`, pnl >= 0 ? "good" : "bad");
  sound(pnl >= 0 ? "buy" : "bad");
  afterAction();
}

// ═══════════════════════════════════════════════════════════════════════════
// Company management
// ═══════════════════════════════════════════════════════════════════════════

function selectedStock() {
  const s = stockBy(ui.selected);
  return s && !s.bankrupt && isOwned(s.name) ? s : null;
}

function spend(s, cost) {
  if (s.companyCash < cost) { msg(`Niet genoeg bedrijfskas. ${s.name} heeft ${fmtShort(s.companyCash)}, nodig: ${fmtShort(cost)}.`); return false; }
  s.companyCash = round2(s.companyCash - cost);
  return true;
}

function ceoDelta(s, d) {
  if (!s.playerCEO) return;
  ["leadership", "innovation", "reliability"].forEach(k => { s.ceo[k] = clamp(s.ceo[k] + (d[k] || 0), 0, 100); });
}

function companyAction(action, arg) {
  const s = selectedStock();
  if (!s) return;
  let done = false;

  switch (action) {
    case "marketing":
      if ((done = spend(s, ACTION_COSTS.marketing))) {
        s.reputation = clamp(s.reputation + 8, 0, 100); s.price = round2(s.price * 1.025); ceoDelta(s, { leadership: 1 });
        addNews(`${s.name}: marketingcampagne. Reputatie +8.`, "good");
      }
      break;
    case "employees":
      if ((done = spend(s, ACTION_COSTS.employees))) {
        s.employees += 100; s.volatility = Math.max(0.01, s.volatility - 0.003); ceoDelta(s, { leadership: 1 });
        addNews(`${s.name}: 100 werknemers aangenomen (+€200/dag winst).`, "good");
      }
      break;
    case "research":
      if ((done = spend(s, ACTION_COSTS.research))) {
        s.research = clamp(s.research + 8, 0, 100); s.price = round2(s.price * 1.03); ceoDelta(s, { innovation: 1 });
        addNews(`${s.name}: onderzoek verbeterd. Innovatie stijgt.`, "good");
      }
      break;
    case "risk": {
      if (s.name === "EuroBank") return msg("EuroBank doet geen risicovolle projecten.");
      if (!(done = spend(s, ACTION_COSTS.risk))) break;
      const prof = RISK_PROFILES[s.name] || DEFAULT_RISK;
      const ok = Math.random() < clamp(prof.chance + s.ceo.innovation / 600, 0.05, 0.88);
      s.reputation = clamp(s.reputation + (ok ? 5 : -6), 0, 100);
      s.price = round2(s.price * (ok ? prof.up : prof.down));
      ceoDelta(s, ok ? { innovation: 2 } : { reliability: -2 });
      addNews(ok ? `${s.name}: risicoproject geslaagd! Koers ×${prof.up}.` : `${s.name}: risicoproject mislukt.`, ok ? "good" : "bad");
      if (ok) { awardXP(XP_REWARDS.risk_success, "risicoproject gewonnen"); unlock("risk_win"); sound("buy"); } else sound("bad");
      break;
    }
    case "ceo": {
      if (!(done = spend(s, ACTION_COSTS.ceo))) break;
      const c = randomCeo();
      s.playerCEO = false; s.ceo = c;
      s.reputation = clamp(s.reputation + Math.floor((c.reliability - 50) / 12), 0, 100);
      addNews(`${s.name}: nieuwe CEO ${c.name} aangesteld.`);
      break;
    }
    case "selfceo":
      if (qtyOf(s.name) < CEO_THRESHOLD) return msg(`Je hebt ${CEO_THRESHOLD} aandelen nodig om CEO te worden.`);
      if (s.playerCEO) return;
      becomeCEO(s); done = true;
      break;
    case "factory":
      if ((done = spend(s, ACTION_COSTS.factory))) {
        s.factories++; s.employees += 120; s.price = round2(s.price * 1.05); ceoDelta(s, { leadership: 1, reliability: 1 });
        addNews(`${s.name}: nieuwe fabriek. +€${FACTORY_DAILY_INCOME.toLocaleString("nl-BE")}/dag.`, "good");
      }
      break;
    case "product": {
      if (!(done = spend(s, ACTION_COSTS.product))) break;
      const ideas = PRODUCT_IDEAS[s.name] || GENERIC_PRODUCTS;
      const pname = pick(ideas);
      const chance = clamp(0.2 + s.research / 280 + s.reputation / 450 + s.ceo.innovation / 550 + synergyBonus(s.name, "product"), 0.08, 0.85);
      const ok = Math.random() < chance;
      s.products.push({ name: pname, result: ok ? "Hit" : "Flop" });
      if (s.products.length > 20) s.products.shift();
      s.reputation = clamp(s.reputation + (ok ? 10 : -7), 0, 100);
      s.price = round2(s.price * (ok ? 1.16 : 0.93));
      ceoDelta(s, ok ? { innovation: 2 } : { reliability: -1 });
      addNews(ok ? `${s.name}: ${pname} is een hit!` : `${s.name}: ${pname} flopt.`, ok ? "good" : "bad");
      if (ok) { awardXP(XP_REWARDS.product_hit, `${pname} hit`); unlock("hit_product"); sound("buy"); } else sound("bad");
      break;
    }
    case "loan":
      if (s.debt + LOAN_AMOUNT > MAX_DEBT) return msg(`${s.name} kan niet meer lenen. Maximum ${fmtShort(MAX_DEBT)} schuld.`);
      s.companyCash += LOAN_AMOUNT; s.debt += LOAN_AMOUNT; s.reputation = clamp(s.reputation - 3, 0, 100);
      addNews(`${s.name}: lening ${fmtShort(LOAN_AMOUNT)} (${loanCount(s)}/${MAX_LOANS}). Rente ${(interestRate(s) * 100).toFixed(2)}%/dag.`);
      done = true;
      break;
    case "repay": {
      if (s.debt <= 0) return msg("Geen schuld om af te lossen.");
      const pay = Math.min(s.debt, s.companyCash, 50000);
      if (pay <= 0) return msg(`${s.name} heeft geen bedrijfskas om af te lossen.`);
      s.companyCash = round2(s.companyCash - pay); s.debt = round2(s.debt - pay); s.reputation = clamp(s.reputation + 1, 0, 100);
      addNews(`${s.name}: ${fmtShort(pay)} schuld afgelost. Resterend: ${fmtShort(s.debt)}.`, "good");
      if (s.debt <= 0) unlock("no_debt");
      done = true;
      break;
    }
    case "inject": {
      const want = arg === "all" ? state.cash : Number(arg);
      const amount = Math.min(state.cash, want);
      if (amount < 1) return msg("Je hebt geen cash om in te leggen.");
      state.cash = round2(state.cash - amount); s.companyCash = round2(s.companyCash + amount);
      addNews(`Je legt ${fmtShort(amount)} in bij ${s.name}.`);
      done = true;
      break;
    }
    case "dividend":
      s.dividendRate = Number(arg);
      addNews(`${s.name}: dividendbeleid ${s.dividendRate}% van de dagwinst.`);
      break;
    case "market":
      done = openMarket(s, arg);
      break;
    case "takeover":
      done = takeover(s);
      break;
    case "war":
      done = startWar(s, arg);
      break;
  }
  if (done && action !== "inject" && action !== "dividend") goalProgress("actions");
  afterAction();
}

function openMarket(s, market) {
  if (s.markets.includes(market)) { msg(`${s.name} is al actief in ${market}.`); return false; }
  if (!spend(s, MARKET_COSTS[market])) return false;
  const fail = Math.random() < MARKET_FAIL_CHANCE[market];
  if (fail) {
    s.reputation = clamp(s.reputation - 10, 0, 100); s.price = round2(s.price * 0.95); ceoDelta(s, { reliability: -2 });
    addNews(`${s.name} mislukt in ${market}. Reputatieschade. Je kunt het opnieuw proberen.`, "bad");
    sound("bad");
  } else {
    s.markets.push(market);
    s.reputation = clamp(s.reputation + 7, 0, 100); s.price = round2(s.price * 1.07); ceoDelta(s, { leadership: 1 });
    addNews(`${s.name} opent ${market}! +${Math.round(MARKET_INCOME_BONUS[market] * 100)}% inkomen.`, "good");
    if (MARKETS.every(m => s.markets.includes(m))) unlock("all_markets");
  }
  return true;
}

function takeover(buyer) {
  const target = stockBy(ui.takeoverTarget);
  if (!target || target.bankrupt || target.name === buyer.name || isOwned(target.name)) { msg("Kies een geldig doelwit."); return false; }
  const cost = round2(target.price * 100 * 1.25);
  if (buyer.companyCash < cost) { msg(`Overname kost ${fmtShort(cost)}. ${buyer.name} heeft ${fmtShort(buyer.companyCash)}.`); return false; }
  const chance = clamp((buyer.reputation + buyer.ceo.leadership) / 250, 0.15, 0.78);
  const ok = Math.random() < chance;
  if (ok) {
    buyer.companyCash = round2(buyer.companyCash - cost);
    buyer.reputation = clamp(buyer.reputation + 5, 0, 100);
    buyer.price = round2(buyer.price * 1.04);
    target.controlledBy = buyer.name;
    addNews(`${buyer.name} neemt ${target.name} over! Je bestuurt het nu via ${buyer.name}.`, "good");
    awardXP(XP_REWARDS.takeover, "overname geslaagd");
    unlock("takeover_win");
    ui.takeoverTarget = "";
    sound("achievement");
  } else {
    const lost = round2(cost * 0.2);
    buyer.companyCash = round2(buyer.companyCash - lost);
    buyer.reputation = clamp(buyer.reputation - 9, 0, 100);
    buyer.price = round2(buyer.price * 0.91);
    addNews(`${buyer.name} faalt in het bod op ${target.name}. ${fmtShort(lost)} advieskosten verloren.`, "bad");
    sound("bad");
  }
  return true;
}

function startWar(att, type) {
  const def = stockBy(ui.warTarget);
  if (!def || def.bankrupt || isOwned(def.name)) { msg("Kies een concurrent die je niet bezit."); return false; }
  if (att.lastWarDay === state.day) { msg(`${att.name} voert vandaag al een oorlog. Probeer morgen opnieuw.`); return false; }
  if (!spend(att, WAR_COSTS[type])) return false;
  att.lastWarDay = state.day;
  if (type === "price") {
    att.price = round2(att.price * 0.99); def.price = round2(def.price * 0.95); def.reputation = clamp(def.reputation - 2, 0, 100);
  } else if (type === "ads") {
    att.price = round2(att.price * 1.03); att.reputation = clamp(att.reputation + 4, 0, 100);
    def.price = round2(def.price * 0.98); def.reputation = clamp(def.reputation - 4, 0, 100);
  } else {
    const n = Math.min(80, def.employees);
    att.employees += n; def.employees -= n; att.price = round2(att.price * 1.02); def.price = round2(def.price * 0.98);
  }
  const labels = { price: "prijsoorlog", ads: "reclameoorlog", talent: "talentenroof" };
  addNews(`${att.name} start een ${labels[type]} tegen ${def.name}.`);
  unlock("war_started");
  return true;
}

function resolveChoice(i) {
  const pc = state.pendingChoice;
  if (!pc) return;
  const ev = CHOICE_EVENTS.find(e => e.id === pc.id);
  const s = stockBy(pc.company);
  const opt = ev && ev.options[i];
  if (!opt || !s || s.bankrupt) { state.pendingChoice = null; closeModal(); return; }
  if (opt.pay && s.companyCash < opt.pay) return msg("Niet genoeg bedrijfskas voor deze keuze.");
  if (opt.pay) s.companyCash = round2(s.companyCash - opt.pay);
  const result = opt.run(s);
  s.history[s.history.length - 1] = s.price;
  addNews(result);
  state.pendingChoice = null;
  closeModal();
  afterAction();
}

function foundCompany() {
  if (state.ipoDone) return;
  if (totalValue() < IPO_THRESHOLD) return msg(`Je hebt ${fmtShort(IPO_THRESHOLD)} totaalwaarde nodig.`);
  const cost = IPO_SHARES * IPO_PRICE * 2; // half for your shares, half for the company's cash
  if (state.cash < cost) return msg(`Een IPO kost ${fmtShort(cost)} cash.`);
  const name = ui.ipoName.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 16) return msg("Kies een naam van 2 tot 16 tekens.");
  if (state.stocks.some(s => s.name.toLowerCase() === name.toLowerCase())) return msg("Die naam bestaat al.");

  state.cash = round2(state.cash - cost);
  const s = makeStock({
    name, sector: ui.ipoSector, price: IPO_PRICE, volatility: 0.05, reputation: 60, employees: 800,
    research: 55, markets: ["Europa"], companyCash: IPO_SHARES * IPO_PRICE, custom: true,
    ceo: { name: "Jij", leadership: 60, innovation: 60, reliability: 60 },
  });
  s.playerCEO = true;
  state.stocks.push(s);
  state.holdings[name] = { qty: IPO_SHARES, avg: IPO_PRICE };
  state.qtyPrev[name] = IPO_SHARES;
  state.rewarded.own[name] = true; state.rewarded.ceo[name] = true;
  state.ipoDone = true;
  logTrade(name, "buy", IPO_SHARES, IPO_PRICE);
  addNews(`🔔 ${name} gaat naar de beurs! Jij bent oprichter en CEO.`, "good");
  unlock("ipo");
  confetti(true);
  closeModal();
  ui.selected = name; ui.tab = "company";
  afterAction();
}

function afterAction() {
  syncOwnership();
  checkMilestones(totalValue());
  if (totalValue() >= WIN_TARGET && !state.gameWon) {
    state.gameWon = true;
    if (state.difficulty === "hardcore") unlock("hardcore_win");
    confetti(true); sound("win");
    setSpeed(0); openModal({ type: "end" });
  }
  save();
  render();
}

function msg(text) {
  toast(text, "warn");
  sound("error");
}

// ═══════════════════════════════════════════════════════════════════════════
// Save / load
// ═══════════════════════════════════════════════════════════════════════════

function save() {
  if (!state || ui.placeholder) return;
  if (state.gameOver && diff().permadeath) return;
  storageSet(SAVE_KEY, JSON.stringify(state));
}
function loadSave() {
  const s = safeParse(storageGet(SAVE_KEY));
  if (!s || s.v !== 2 || !Array.isArray(s.stocks)) return null;
  return s;
}
function saveSettings() { storageSet(SETTINGS_KEY, JSON.stringify(settings)); }

function exportSave() {
  const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `investeer-simulator-dag-${state.day}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importSave(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const s = safeParse(reader.result);
    if (!s || s.v !== 2 || !Array.isArray(s.stocks)) return msg("Ongeldig savebestand.");
    state = s; ui.placeholder = false;
    ui.selected = ownedNames()[0] || null; ui.tab = "market";
    ui.modal = null; save(); toast("Spel geladen."); render();
  };
  reader.readAsText(file);
}

// ═══════════════════════════════════════════════════════════════════════════
// Auto-play
// ═══════════════════════════════════════════════════════════════════════════

let timer = null;
function setSpeed(i) {
  ui.speed = i;
  if (timer) { clearInterval(timer); timer = null; }
  if (SPEEDS[i]) {
    timer = setInterval(() => {
      if (document.hidden || ui.modal || !state || state.gameOver || state.gameWon) return;
      advanceDay();
    }, SPEEDS[i]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Sound (WebAudio, no files)
// ═══════════════════════════════════════════════════════════════════════════

let actx = null;
const SOUNDS = {
  buy:         { notes: [523, 784], dur: 0.07, type: "triangle" },
  sell:        { notes: [659, 440], dur: 0.07, type: "triangle" },
  tick:        { notes: [880], dur: 0.025, type: "sine", vol: 0.015 },
  achievement: { notes: [523, 659, 784, 1047], dur: 0.09, type: "triangle" },
  rank:        { notes: [392, 523, 659, 784, 1047], dur: 0.1, type: "square", vol: 0.03 },
  goal:        { notes: [659, 988], dur: 0.08, type: "triangle" },
  bad:         { notes: [220, 165], dur: 0.14, type: "sawtooth", vol: 0.03 },
  error:       { notes: [196], dur: 0.08, type: "square", vol: 0.02 },
  win:         { notes: [523, 659, 784, 1047, 1319, 1568], dur: 0.12, type: "triangle" },
};
function sound(name) {
  if (!settings.sound) return;
  const def = SOUNDS[name];
  if (!def) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
    const t0 = actx.currentTime;
    def.notes.forEach((f, i) => {
      const o = actx.createOscillator(); const g = actx.createGain();
      o.type = def.type; o.frequency.value = f;
      const st = t0 + i * def.dur;
      g.gain.setValueAtTime(def.vol || 0.05, st);
      g.gain.exponentialRampToValueAtTime(0.0001, st + def.dur * 1.6);
      o.connect(g).connect(actx.destination);
      o.start(st); o.stop(st + def.dur * 1.7);
    });
  } catch { /* audio unavailable */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// Confetti
// ═══════════════════════════════════════════════════════════════════════════

const confettiCanvas = document.getElementById("confetti");
let confettiParts = [], confettiRunning = false;
function confetti(big = false) {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const w = window.innerWidth, h = window.innerHeight;
  const colors = ["#7c3aed", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a78bfa"];
  const n = big ? 160 : 70;
  for (let i = 0; i < n; i++) {
    confettiParts.push({
      x: w / 2 + (Math.random() - 0.5) * w * 0.4, y: h * 0.35,
      vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 12 - 4,
      r: 3 + Math.random() * 4, c: pick(colors), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, life: 0,
    });
  }
  if (!confettiRunning) { confettiRunning = true; requestAnimationFrame(confettiStep); }
}
function confettiStep() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  if (confettiCanvas.width !== w * dpr || confettiCanvas.height !== h * dpr) { confettiCanvas.width = w * dpr; confettiCanvas.height = h * dpr; }
  const ctx = confettiCanvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  confettiParts.forEach(p => {
    p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - p.life / 140);
    ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
    ctx.restore();
  });
  confettiParts = confettiParts.filter(p => p.y < h + 20 && p.life < 140);
  if (confettiParts.length) requestAnimationFrame(confettiStep);
  else { confettiRunning = false; ctx.clearRect(0, 0, w, h); }
}

// ═══════════════════════════════════════════════════════════════════════════
// Toasts
// ═══════════════════════════════════════════════════════════════════════════

const toastRoot = document.getElementById("toasts");
function toast(text, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = text;
  toastRoot.appendChild(el);
  while (toastRoot.children.length > 3) toastRoot.firstChild.remove();
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, kind === "big" ? 3500 : 2600);
}

// ═══════════════════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);

function sparkline(hist, n = 30) {
  const h = hist.slice(-n);
  if (h.length < 2) return `<svg class="spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"></svg>`;
  const W = 120, H = 36;
  const min = Math.min(...h), max = Math.max(...h), range = max - min || 1;
  const pts = h.map((v, i) => `${(i / (h.length - 1) * W).toFixed(1)},${(H - ((v - min) / range) * (H - 4) - 2).toFixed(1)}`).join(" ");
  const up = h[h.length - 1] >= h[0];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${up ? "#22c55e" : "#ef4444"}" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
const badge = (t, c = "#7c3aed") => `<span class="badge" style="--c:${c}">${t}</span>`;
function statBar(label, value, color, max = 100) {
  const pct = clamp(value / max * 100, 0, 100);
  return `<div class="statbar"><div class="statbar-top"><span>${label}</span><span>${Math.round(value)}/${max}</span></div><div class="bar"><div style="width:${pct}%;background:${color}"></div></div></div>`;
}
function btn(label, act, { arg = "", color = "#7c3aed", disabled = false, cls = "", title = "" } = {}) {
  return `<button class="btn ${cls}" style="--c:${color}" data-act="${act}" data-arg="${esc(arg)}" ${disabled ? "disabled" : ""} ${title ? `title="${esc(title)}"` : ""}>${label}</button>`;
}

function renderHeader() {
  const status = state.depression ? `⚠ DEPRESSIE dag ${state.depressionDays}` : state.recession ? `📉 RECESSIE dag ${state.recessionDays}` : "📊 Normale markt";
  const col = state.depression ? "#ef4444" : state.recession ? "#f97316" : "#22c55e";
  $("dayline").innerHTML = `Dag ${state.day} • <span style="color:${col}">${status}</span> • ${esc(diff().label)}`;
  const tv = totalValue();
  $("stats").innerHTML = [["Cash", fmtShort(state.cash), "#22c55e"], ["Portfolio", fmtShort(longValue() + shortsValue()), "#e2e8f0"], ["Totaal", fmtShort(tv), "#a78bfa"]]
    .map(([l, v, c]) => `<div class="card stat"><span class="label">${l}</span><strong style="color:${c}">${v}</strong></div>`).join("");
  const pct = Math.min(100, tv / WIN_TARGET * 100);
  $("progress").innerHTML = `<div class="progress-top"><span>Doel: €1 miljard</span><span>${pct.toFixed(2)}%</span></div><div class="bar thin"><div style="width:${pct}%;background:#7c3aed"></div></div>`;

  const n = state.news[0];
  const g = state.goal;
  $("newsrow").innerHTML = `
    <div class="card news ${n ? n.kind : ""}"><span class="kicker">Marktnieuws</span><div>${n ? esc(n.text) : ""}</div></div>
    ${state.lastDividend > 0 ? `<div class="card news good mini"><span class="kicker">Dividend</span><strong>+${fmtShort(state.lastDividend)}</strong></div>` : ""}
    ${g ? `<div class="card news goal ${g.done ? "done" : ""}"><span class="kicker">🎯 Dagdoel ${g.done ? "✓" : `(+${g.xp} XP)`}</span><div>${esc(g.text)}${!g.done && ["buys", "actions"].includes(g.type) ? ` — ${g.progress}/${g.target}` : ""}</div></div>` : ""}`;

  $("controlbar").innerHTML = `
    <button class="next" data-act="next" ${state.gameOver || state.gameWon ? "disabled" : ""}>Volgende dag →</button>
    <div class="speed" role="group" aria-label="Auto-play snelheid">
      ${SPEED_LABELS.map((l, i) => `<button class="${ui.speed === i ? "on" : ""}" data-act="speed" data-arg="${i}" aria-pressed="${ui.speed === i}" title="${i ? `Automatisch ${l}` : "Pauze"}">${l}</button>`).join("")}
    </div>`;
}

function renderTabs() {
  const owned = ownedNames();
  const tabs = [
    ["market", "📊 Markt"], ["portfolio", "💼 Portfolio"],
    ["company", `🏢 Bedrijven${owned.length ? ` (${owned.length})` : ""}`],
    ["rivals", "🦈 Rivalen"], ["investor", "🎖️ Investeerder"],
    ["achievements", `🏅 Prestaties`], ["settings", "⚙️ Spel"],
  ];
  $("tabs").innerHTML = tabs.map(([k, l]) => {
    const dis = k === "company" && !owned.length;
    return `<button class="tab ${ui.tab === k ? "on" : ""}" data-act="tab" data-arg="${k}" ${dis ? "disabled title=\"Koop 50 aandelen van een bedrijf om het te besturen\"" : ""}>${l}</button>`;
  }).join("");
}

function renderMarket() {
  const fr = feeRate();
  const flashNow = ui.flashDay === state.day && state.day > 1;
  ui.flashDay = 0; // animate price changes once per new day, not on every re-render
  const cards = state.stocks.map(s => {
    const q = qtyOf(s.name);
    const ch = dayChange(s);
    const up = ch >= 0;
    const flash = flashNow && Math.abs(ch) > 0.01 ? (up ? "flash-up" : "flash-down") : "";
    const owned = isOwned(s.name);
    const sh = state.shorts[s.name];
    const rq = maxRivalQty(s.name);
    const hint = q >= CEO_THRESHOLD ? "✓ CEO-niveau"
      : q >= OWNERSHIP_THRESHOLD ? `✓ Eigenaar — nog ${CEO_THRESHOLD - q} voor CEO`
      : q > 0 ? `Nog ${OWNERSHIP_THRESHOLD - q} voor eigenaarschap` : `${OWNERSHIP_THRESHOLD} aandelen voor eigenaarschap`;
    return `<article class="stock ${s.bankrupt ? "dead" : ""}">
      <div class="stock-top">
        <div class="stock-id">
          <button class="linkish" data-act="chart" data-arg="${esc(s.name)}" title="Grote grafiek">${esc(s.name)} <span aria-hidden="true">🔍</span></button>
          <div class="sub">${s.bankrupt ? "💀 Failliet" : `${companyLevel(s)} • ${SECTORS[s.sector] || ""} • ${s.markets.join(", ")}`}</div>
          <div class="badges">
            ${owned ? badge("Owned") : ""}${s.playerCEO ? badge("CEO", "#f59e0b") : ""}
            ${s.controlledBy ? badge(`via ${esc(s.controlledBy)}`, "#6366f1") : ""}
            ${sh ? badge(`Short ${sh.qty}`, "#ec4899") : ""}
            ${state.lostTo[s.name] ? badge(`Overgenomen`, "#ef4444") : ""}
          </div>
        </div>
        <div class="stock-price">
          <div class="price ${flash}">€${fmt(s.price)}</div>
          <div class="chg" style="color:${up ? "#22c55e" : "#ef4444"}">${up ? "▲" : "▼"} ${Math.abs(ch).toFixed(1)}% vandaag</div>
          <button class="spark-btn" data-act="chart" data-arg="${esc(s.name)}" aria-label="Grafiek ${esc(s.name)}">${sparkline(s.history)}</button>
        </div>
      </div>
      ${s.bankrupt ? "" : `
      <div class="trade-row">
        <input class="input" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="Aantal" autocomplete="off"
          data-amount="${esc(s.name)}" data-focuskey="amt-${esc(s.name)}" value="${esc(ui.amounts[s.name] || "")}" aria-label="Aantal aandelen ${esc(s.name)}">
        ${btn("Max", "max", { arg: s.name, color: "#64748b", cls: "small" })}
      </div>
      <div class="trade-btns">
        ${btn("Kopen", "buy", { arg: s.name, color: "#22c55e" })}
        ${btn(`Verkopen (${q})`, "sell", { arg: s.name, color: "#ef4444", disabled: q === 0 })}
        ${sh ? btn(`Short sluiten`, "cover", { arg: s.name, color: "#ec4899" })
             : btn("Short", "short", { arg: s.name, color: "#ec4899", disabled: owned, title: owned ? "Je kunt je eigen bedrijf niet shorten" : "Verdien als de koers daalt" })}
      </div>
      <div class="hint">${hint}${rq ? ` • Rivalen: max ${rq}` : ""}</div>`}
    </article>`;
  }).join("");

  return `<p class="fee-note">Transactiekosten: <strong>${(fr * 100).toFixed(2)}%</strong> per aankoop/verkoop (${esc(INVESTOR_RANKS[rankIndex()].name)}). Hogere rang = lagere kosten.</p>
    <div class="grid">${cards}</div>`;
}

function renderPortfolio() {
  const longs = state.stocks.filter(s => qtyOf(s.name) > 0).map(s => {
    const h = state.holdings[s.name];
    const value = h.qty * s.price;
    const pl = value - h.avg * h.qty;
    const pct = h.avg ? pl / (h.avg * h.qty) * 100 : 0;
    return `<div class="card">
      <div class="row-between">
        <div><strong>${esc(s.name)}</strong>${s.bankrupt ? " 💀" : ""}
          <div class="muted">${h.qty} aandelen • gem. €${fmt(h.avg)}</div></div>
        <div class="right"><strong>${fmtShort(value)}</strong>
          <div style="color:${pl >= 0 ? "#22c55e" : "#ef4444"}" class="small-t">${pl >= 0 ? "▲" : "▼"} ${fmtShort(Math.abs(pl))} (${pl >= 0 ? "+" : ""}${pct.toFixed(1)}%)</div></div>
      </div>
      <button class="spark-btn wide" data-act="chart" data-arg="${esc(s.name)}" aria-label="Grafiek ${esc(s.name)}">${sparkline(s.history)}</button>
    </div>`;
  }).join("");

  const shorts = Object.keys(state.shorts).map(n => {
    const sh = state.shorts[n]; const s = stockBy(n);
    const pnl = (sh.entry - s.price) * sh.qty;
    return `<div class="card">
      <div class="row-between">
        <div><strong>${esc(n)}</strong> ${badge("Short", "#ec4899")}
          <div class="muted">${sh.qty} aandelen • instap €${fmt(sh.entry)} • onderpand ${fmtShort(sh.margin)}</div></div>
        <div class="right"><strong style="color:${pnl >= 0 ? "#22c55e" : "#ef4444"}">${pnl >= 0 ? "+" : ""}${fmtShort(pnl)}</strong>
          <div class="muted">kost ${fmtShort(sh.qty * s.price * SHORT_DAILY_FEE)}/dag</div></div>
      </div>
      <div class="mt8">${btn("Short sluiten", "cover", { arg: n, color: "#ec4899" })}</div>
    </div>`;
  }).join("");

  const tv = totalValue();
  const ipoCost = IPO_SHARES * IPO_PRICE * 2;
  const ipo = state.ipoDone
    ? `<div class="card"><span class="label">🔔 Eigen bedrijf</span><div class="muted">Je hebt al een bedrijf naar de beurs gebracht.</div></div>`
    : `<div class="card"><span class="label">🔔 Eigen bedrijf (IPO)</span>
        <div class="muted">Vanaf ${fmtShort(IPO_THRESHOLD)} totaalwaarde kun je je eigen bedrijf oprichten. Kost ${fmtShort(ipoCost)} cash: de helft wordt jouw ${IPO_SHARES} aandelen, de helft de bedrijfskas.</div>
        <div class="mt8">${btn("Bedrijf oprichten", "ipo", { color: "#f59e0b", disabled: tv < IPO_THRESHOLD })}</div>
        ${tv < IPO_THRESHOLD ? `<div class="bar thin mt8"><div style="width:${Math.min(100, tv / IPO_THRESHOLD * 100)}%;background:#f59e0b"></div></div>` : ""}
      </div>`;

  return `<div class="grid">
    ${longs || `<div class="card muted">Geen aandelen in bezit.</div>`}
    ${shorts}
    <div class="card span-all">
      ${[["Cash", state.cash], ["Aandelen", longValue()], ["Shorts (netto)", shortsValue()], ["Totaal", tv]].map(([k, v], i, a) =>
        `<div class="sum-row ${i === a.length - 1 ? "total" : ""}"><span>${k}</span><span>${fmtShort(v)}</span></div>`).join("")}
    </div>
    <div class="span-all">${ipo}</div>
  </div>`;
}

function renderCompany() {
  const owned = ownedNames();
  if (!owned.length) return `<div class="card muted">Koop ${OWNERSHIP_THRESHOLD} aandelen van een bedrijf om het te besturen.</div>`;
  if (!ui.selected || !owned.includes(ui.selected)) ui.selected = owned[0];
  const s = stockBy(ui.selected);
  const q = qtyOf(s.name);
  const profit = calcProfit(s);
  const syn = activeSynergies().filter(sy => sy.global || sy.names.includes(s.name));
  const tr = topRival(s.name);

  const chips = `<div class="chips">${owned.map(n => `<button class="chip ${n === s.name ? "on" : ""}" data-act="select" data-arg="${esc(n)}">🏢 ${esc(n)}</button>`).join("")}</div>`;

  const takeoverOpts = state.stocks.filter(o => o.name !== s.name && !isOwned(o.name) && !o.bankrupt);
  const warOpts = takeoverOpts;
  if (ui.takeoverTarget && !takeoverOpts.some(o => o.name === ui.takeoverTarget)) ui.takeoverTarget = "";
  if (ui.warTarget && !warOpts.some(o => o.name === ui.warTarget)) ui.warTarget = "";

  return `${chips}
  <div class="card company">
    <div class="company-head">
      <div>
        <h2>${esc(s.name)} ${s.playerCEO ? badge("CEO", "#f59e0b") : ""}</h2>
        <div class="muted">${companyLevel(s)} • ${SECTORS[s.sector] || ""} • CEO: ${esc(s.ceo.name)}${s.controlledBy ? ` • bestuurd via ${esc(s.controlledBy)}` : ` • jij: ${q} aandelen`}</div>
        <div class="muted mt4">Kas: <span style="color:${s.companyCash < 0 ? "#ef4444" : "#22c55e"}">${fmtShort(s.companyCash)}</span>
          • Schuld: <span style="color:${s.debt > 0 ? "#f97316" : "#64748b"}">${fmtShort(s.debt)}</span>${s.debt > 0 ? ` (${loanCount(s)}/${MAX_LOANS})` : ""}
          ${tr && tr.q > 0 ? ` • <span style="color:${tr.r.color}">${esc(tr.r.name)}: ${tr.q}</span>` : ""}</div>
        ${s.companyCash < -150000 ? `<div class="warn mt4">⚠ Bedrijfskas zeer laag. Onder ${fmtShort(-300000)} gaat ${esc(s.name)} failliet.</div>` : ""}
      </div>
      <div class="kpis">
        ${[["Inkomen/dag", fmtShort(calcIncome(s))], ["Kosten/dag", fmtShort(calcCosts(s))],
           ["Winst/dag", fmtShort(profit), profit >= 0 ? "#22c55e" : "#ef4444"],
           ["Dividend/dag", fmtShort(Math.max(0, profit * s.dividendRate / 100)), "#a78bfa"]]
          .map(([l, v, c]) => `<div class="kpi"><span>${l}</span><strong style="color:${c || "#e2e8f0"}">${v}</strong></div>`).join("")}
      </div>
    </div>

    <div class="cols3">
      <div><span class="label">Bedrijfsstats</span>
        ${statBar("Reputatie", s.reputation, "#7c3aed")}${statBar("Onderzoek", s.research, "#06b6d4")}
        <div class="muted">Werknemers: <b>${s.employees}</b> • Fabrieken: <b>${s.factories}</b></div></div>
      <div><span class="label">CEO — ${esc(s.ceo.name)}</span>
        ${statBar("Leiderschap", s.ceo.leadership, "#f59e0b")}${statBar("Innovatie", s.ceo.innovation, "#22c55e")}${statBar("Betrouwbaarheid", s.ceo.reliability, "#06b6d4")}</div>
      <div><span class="label">Producten</span>
        ${s.products.length ? s.products.slice(-6).map(p => `<div class="row-between small-t mb3"><span>${esc(p.name)}</span>${badge(p.result, p.result === "Hit" ? "#22c55e" : "#ef4444")}</div>`).join("") : `<div class="muted">Nog geen producten.</div>`}
        ${syn.length ? `<span class="label mt8">Actieve synergieën</span>${syn.map(sy => `<div class="small-t" style="color:#22c55e">🔗 ${sy.label}</div>`).join("")}` : ""}</div>
    </div>

    <div class="section"><span class="label">Dividendbeleid — huidig ${s.dividendRate}%</span>
      <div class="muted mb6">Elke dag gaat ${s.dividendRate}% van de winst naar jouw cash. De rest blijft in de bedrijfskas.</div>
      <div class="btn-row">${[0, 10, 25, 50, 75].map(r => btn(`${r}%`, "c:dividend", { arg: r, color: s.dividendRate === r ? "#a78bfa" : "#64748b", cls: s.dividendRate === r ? "active" : "" })).join("")}</div>
    </div>

    <div class="section"><span class="label">Bedrijfsacties</span>
      <div class="actions">
        ${btn("Marketing €5K", "c:marketing", { color: "#22c55e" })}
        ${btn("Werknemers €12K", "c:employees", { color: "#3b82f6" })}
        ${btn("Onderzoek €20K", "c:research", { color: "#a78bfa" })}
        ${btn("Risicoproject €30K", "c:risk", { color: "#ef4444", disabled: s.name === "EuroBank" })}
        ${btn("Product €25K", "c:product", { color: "#ec4899" })}
        ${btn("Fabriek €50K", "c:factory", { color: "#f97316" })}
        ${btn("CEO vervangen €15K", "c:ceo", { color: "#94a3b8" })}
        ${btn("Zelf CEO worden", "c:selfceo", { color: "#f59e0b", disabled: s.playerCEO || q < CEO_THRESHOLD, title: q < CEO_THRESHOLD ? `Vereist ${CEO_THRESHOLD} aandelen` : "" })}
        ${btn(`Lening +€100K${s.debt ? ` (${loanCount(s)}/${MAX_LOANS})` : ""}`, "c:loan", { color: "#06b6d4", disabled: s.debt + LOAN_AMOUNT > MAX_DEBT })}
        ${btn("Schuld aflossen €50K", "c:repay", { color: "#14b8a6", disabled: s.debt <= 0 })}
      </div>
      <div class="muted mt8 mb6">Rente: ${(interestRate(s) * 100).toFixed(2)}%/dag (afhankelijk van CEO-betrouwbaarheid${synergyBonus(s.name, "interest") ? ", met Huisbankier-korting" : ""}).</div>
      <span class="label">Cash inleggen (jouw cash → bedrijfskas)</span>
      <div class="btn-row">${btn("€10K", "c:inject", { arg: 10000, color: "#84cc16", disabled: state.cash < 1 })}${btn("€50K", "c:inject", { arg: 50000, color: "#84cc16", disabled: state.cash < 1 })}${btn("€250K", "c:inject", { arg: 250000, color: "#84cc16", disabled: state.cash < 1 })}${btn("Alles", "c:inject", { arg: "all", color: "#84cc16", disabled: state.cash < 1 })}</div>
    </div>

    <div class="cols3 section">
      <div class="sub-card"><span class="label">Marktexpansie</span>
        <div class="stack">${MARKETS.map(m => {
          const has = s.markets.includes(m);
          return btn(`${m} ${has ? "✓" : `€${MARKET_COSTS[m] / 1000}K • +${Math.round(MARKET_INCOME_BONUS[m] * 100)}%${MARKET_FAIL_CHANCE[m] ? ` • ${Math.round(MARKET_FAIL_CHANCE[m] * 100)}% risico` : ""}`}`, "c:market", { arg: m, color: has ? "#64748b" : "#7c3aed", disabled: has });
        }).join("")}</div></div>
      <div class="sub-card"><span class="label">Overnamebod</span>
        <select class="input" data-select="takeoverTarget" aria-label="Doelwit overname">
          <option value="">Kies doelwit</option>
          ${takeoverOpts.map(o => `<option value="${esc(o.name)}" ${ui.takeoverTarget === o.name ? "selected" : ""}>${esc(o.name)} (~${fmtShort(o.price * 125)})</option>`).join("")}
        </select>
        <div class="muted mt4 mb6">Kans: ${Math.round(clamp((s.reputation + s.ceo.leadership) / 250, 0.15, 0.78) * 100)}%. Mislukt = 20% kosten kwijt.</div>
        ${btn("Bied op bedrijf", "c:takeover", { color: "#6366f1", disabled: !ui.takeoverTarget })}</div>
      <div class="sub-card"><span class="label">Concurrentieoorlog (1×/dag)</span>
        <select class="input" data-select="warTarget" aria-label="Doelwit oorlog">
          <option value="">Kies concurrent</option>
          ${warOpts.map(o => `<option value="${esc(o.name)}" ${ui.warTarget === o.name ? "selected" : ""}>${esc(o.name)}</option>`).join("")}
        </select>
        <div class="stack mt8">
          ${btn("Prijsoorlog €20K", "c:war", { arg: "price", color: "#ef4444", disabled: !ui.warTarget })}
          ${btn("Reclameoorlog €15K", "c:war", { arg: "ads", color: "#f59e0b", disabled: !ui.warTarget })}
          ${btn("Talenten stelen €10K", "c:war", { arg: "talent", color: "#3b82f6", disabled: !ui.warTarget })}
        </div></div>
    </div>
  </div>`;
}

function renderRivals() {
  const me = totalValue();
  const rows = [{ name: "Jij", icon: "🧑‍💼", color: "#a78bfa", worth: me, style: INVESTOR_RANKS[rankIndex()].name, me: true },
    ...state.rivals.map(r => ({ name: r.name, icon: r.icon, color: r.color, worth: rivalWorth(r), style: r.style, r }))]
    .sort((a, b) => b.worth - a.worth);
  return `<div class="grid">
    <div class="card span-all"><span class="label">Ranglijst</span>
      ${rows.map((x, i) => `<div class="sum-row ${x.me ? "total" : ""}"><span>${i + 1}. ${x.icon} <span style="color:${x.color}">${esc(x.name)}</span> <span class="muted">(${esc(x.style)})</span></span><span>${fmtShort(x.worth)}</span></div>`).join("")}
    </div>
    ${state.rivals.map(r => {
      const hs = Object.keys(r.holdings).filter(n => r.holdings[n].qty > 0);
      return `<div class="card"><div class="row-between"><strong style="color:${r.color}">${r.icon} ${esc(r.name)}</strong>${badge(r.style, r.color)}</div>
        <div class="muted mt4">Cash: ${fmtShort(r.cash)}</div>
        <div class="mt8">${hs.length ? hs.map(n => {
          const threat = isOwned(n) || state.lostTo[n] === r.name;
          return `<div class="row-between small-t mb3"><span>${esc(n)}</span><span style="color:${threat ? "#ef4444" : "#94a3b8"}">${r.holdings[n].qty} aandelen${threat ? " ⚠" : ""}</span></div>`;
        }).join("") : `<div class="muted">Geen posities.</div>`}</div></div>`;
    }).join("")}
    <div class="card span-all muted">Rivalen handelen elke dag. ${RIVAL_TEMPLATES[0].name} kan vanaf dag ${RIVAL_HOSTILE_FROM_DAY} vijandig aandelen opkopen van bedrijven die jij bezit. Heeft een rivaal meer aandelen dan jij, dan verlies je de controle. Koop bij om terug te vechten.</div>
  </div>`;
}

function renderInvestor() {
  const ri = rankIndex(); const rk = INVESTOR_RANKS[ri]; const next = INVESTOR_RANKS[ri + 1];
  const into = state.xp - rk.xpNeeded; const span = next ? next.xpNeeded - rk.xpNeeded : 1;
  const g = state.goal;
  return `<div class="grid">
    <div class="card span-all">
      <div class="row-between"><div><div class="rank" style="color:${rk.color}">${rk.name}</div><div class="muted">${state.xp} XP totaal</div></div><div class="rank-icon">${rk.icon}</div></div>
      ${next ? `<div class="progress-top mt8"><span>${rk.name} → ${next.name}</span><span>${into}/${span} XP</span></div>
        <div class="bar"><div style="width:${Math.min(100, into / span * 100)}%;background:${rk.color}"></div></div>`
        : `<div style="color:${rk.color}" class="mt8">Maximale rang bereikt!</div>`}
    </div>
    <div class="card"><span class="label">Transactiekosten</span>
      <div class="big-num">${(feeRate() * 100).toFixed(2)}%</div>
      <div class="mt8">${INVESTOR_RANKS.map((r, i) => `<div class="row-between small-t" style="color:${ri >= i ? "#22c55e" : "#475569"}"><span>${ri >= i ? "✓" : "○"} ${r.name}</span><span>${(diff().fee * (1 - i * RANK_FEE_REDUCTION) * 100).toFixed(2)}%</span></div>`).join("")}</div>
    </div>
    <div class="card"><span class="label">🎯 Dagdoel</span>
      ${g ? `<div>${esc(g.text)}</div><div class="muted mt4">${g.done ? "✓ Voltooid" : `Beloning: +${g.xp} XP`}</div>` : ""}
      <div class="muted mt8">Voltooid: ${state.goalsDone}</div>
    </div>
    <div class="card"><span class="label">XP verdienen</span>
      ${[["Aankoop ≥ €500 (max 10/dag)", XP_REWARDS.buy], ["Verkoop met winst (max 5/dag)", XP_REWARDS.sell_profit], ["Bedrijf verwerven (1× per bedrijf)", XP_REWARDS.own_company],
         ["CEO worden (1× per bedrijf)", XP_REWARDS.become_ceo], ["Product hit", XP_REWARDS.product_hit], ["Risicoproject winnen", XP_REWARDS.risk_success],
         ["Overname", XP_REWARDS.takeover], ["Recessie overleven", XP_REWARDS.survive_recession], ["Depressie overleven", XP_REWARDS.survive_depression]]
        .map(([k, v]) => `<div class="row-between small-t"><span class="muted">${k}</span><span style="color:#a78bfa">+${v}</span></div>`).join("")}
    </div>
    <div class="card"><span class="label">🔗 Sectorsynergieën</span>
      ${SYNERGIES.map(sy => { const on = activeSynergies().includes(sy);
        return `<div class="mb6"><div style="color:${on ? "#22c55e" : "#94a3b8"}">${on ? "✓" : "○"} ${sy.label}</div><div class="muted small-t">${sy.desc}</div></div>`; }).join("")}
    </div>
    <div class="card"><span class="label">Dividend uitgelegd</span>
      <div class="muted lh">Een bedrijf dat je bezit maakt elke dag winst of verlies. <b>Dividend</b> is het deel van de winst dat naar jouw cash gaat. De rest blijft in de bedrijfskas. Bij verlies daalt de kas; onder ${fmtShort(-300000)} gaat het bedrijf failliet.</div>
    </div>
  </div>`;
}

function renderAchievements() {
  return `<div class="muted mb6">${state.achievements.length}/${ACHIEVEMENTS.length} ontgrendeld • ${state.xp} XP</div>
  <div class="grid ach-grid">${ACHIEVEMENTS.map(a => {
    const on = state.achievements.includes(a.id);
    return `<div class="card ach ${on ? "on" : ""}"><div class="ach-icon">${on ? a.icon : "🔒"}</div><div><strong>${a.label}</strong><div class="muted small-t">${a.desc}</div>${a.xp ? `<div class="small-t" style="color:${on ? "#a78bfa" : "#475569"}">+${a.xp} XP</div>` : ""}</div></div>`;
  }).join("")}</div>`;
}

function renderSettings() {
  return `<div class="grid">
    <div class="card"><span class="label">Geluid</span>
      ${btn(settings.sound ? "🔊 Geluid aan" : "🔇 Geluid uit", "sound", { color: settings.sound ? "#22c55e" : "#64748b" })}</div>
    <div class="card"><span class="label">Opslaan</span>
      <div class="muted mb6">Het spel wordt automatisch opgeslagen in deze browser.${diff().permadeath ? " Hardcore: bij faillissement wordt de save gewist." : ""}</div>
      <div class="btn-row">${btn("💾 Exporteren", "export", { color: "#06b6d4" })}
        <label class="btn" style="--c:#06b6d4">📂 Importeren<input type="file" accept="application/json,.json" data-import hidden></label></div></div>
    <div class="card"><span class="label">Spel</span>
      <div class="muted mb6">Moeilijkheid: <b>${esc(diff().label)}</b> • Start: ${esc(state.setupLabel)}</div>
      ${btn("↺ Nieuw spel", "newgame", { color: "#ef4444" })}</div>
    <div class="card span-all"><span class="label">Sneltoetsen (pc)</span>
      <div class="muted small-t lh">Spatie / Enter: volgende dag • 0–3: auto-play snelheid • 1–7 met Alt: tabbladen • Esc: venster sluiten</div></div>
  </div>`;
}

function render() {
  if (!state) return;
  renderHeader();
  renderTabs();

  const main = $("main");
  const ae = document.activeElement;
  if (ae && ae.tagName === "SELECT" && main.contains(ae)) return; // don't close an open dropdown

  let focusKey = null, ss = null, se = null;
  if (ae && ae.dataset && ae.dataset.focuskey) {
    focusKey = ae.dataset.focuskey;
    try { ss = ae.selectionStart; se = ae.selectionEnd; } catch { /* ignore */ }
  }

  const views = { market: renderMarket, portfolio: renderPortfolio, company: renderCompany, rivals: renderRivals, investor: renderInvestor, achievements: renderAchievements, settings: renderSettings };
  main.innerHTML = (views[ui.tab] || renderMarket)();

  if (focusKey) {
    const el = main.querySelector(`[data-focuskey="${CSS.escape(focusKey)}"]`);
    if (el) { el.focus({ preventScroll: true }); try { if (ss != null) el.setSelectionRange(ss, se); } catch { /* ignore */ } }
  }
  renderModal();
}

// ═══════════════════════════════════════════════════════════════════════════
// Modals
// ═══════════════════════════════════════════════════════════════════════════

function openModal(m) { ui.modal = m; renderModal(); }
function closeModal() {
  if (ui.modal && ui.modal.type === "choice" && state && state.pendingChoice) return; // must choose
  if (ui.modal && (ui.modal.type === "start" || ui.modal.type === "end")) return;
  ui.modal = null; renderModal();
}

function renderModal() {
  const root = $("modal-root");
  const m = ui.modal;
  if (!m) { root.innerHTML = ""; document.body.classList.remove("modal-open"); return; }
  document.body.classList.add("modal-open");
  let inner = "";
  let dismissable = true;

  if (m.type === "start") {
    dismissable = false;
    const saved = loadSave();
    inner = `<h2>▸ Investeer Simulator</h2>
      <p class="muted">Koop aandelen, word eigenaar en CEO, versla je rivalen en bouw een imperium van €1 miljard.</p>
      ${saved && !saved.gameOver && !saved.gameWon ? `<div class="card mt8"><div class="row-between"><div><strong>Opgeslagen spel</strong><div class="muted small-t">Dag ${saved.day} • ${esc((DIFFICULTIES[saved.difficulty] || DIFFICULTIES.normal).label)}</div></div>${btn("Doorgaan", "continue", { color: "#22c55e" })}</div></div>` : ""}
      <span class="label mt12">Nieuw spel — kies moeilijkheid</span>
      <div class="stack">${Object.entries(DIFFICULTIES).map(([k, d]) => `<button class="diff" data-act="start" data-arg="${k}"><strong>${d.label}</strong><span class="muted small-t">${d.desc}</span></button>`).join("")}</div>`;
  } else if (m.type === "end") {
    dismissable = false;
    const won = state.gameWon; const rk = INVESTOR_RANKS[rankIndex()];
    inner = `<div class="end-icon">${won ? "🏆" : "💸"}</div>
      <h2 style="color:${won ? "#22c55e" : "#ef4444"}">${won ? "Je hebt gewonnen!" : "Failliet."}</h2>
      <p class="muted">${won ? `€1 miljard bereikt op dag ${state.day}.` : `Alles verloren op dag ${state.day}.`}${!won && diff().permadeath ? " Hardcore: je save is gewist." : ""}</p>
      <p>Eindwaarde: <strong>${fmtShort(totalValue())}</strong></p>
      <p>Rang: <strong style="color:${rk.color}">${rk.name}</strong> (${state.xp} XP) • Prestaties: ${state.achievements.length}/${ACHIEVEMENTS.length}</p>
      <div class="btn-row center mt12">${btn("Nieuw spel", "newgame-confirmed", { color: "#a78bfa", cls: "lg" })}</div>`;
  } else if (m.type === "choice") {
    dismissable = false;
    const pc = state.pendingChoice;
    const ev = pc && CHOICE_EVENTS.find(e => e.id === pc.id);
    const s = pc && stockBy(pc.company);
    if (!ev || !s) { ui.modal = null; state.pendingChoice = null; root.innerHTML = ""; document.body.classList.remove("modal-open"); return; }
    inner = `<h2>${ev.title}</h2><p>${esc(ev.text(s.name))}</p><p class="muted small-t">Bedrijfskas ${esc(s.name)}: ${fmtShort(s.companyCash)}</p>
      <div class="stack mt8">${ev.options.map((o, i) => btn(esc(o.label), "choose", { arg: i, color: i === 0 ? "#22c55e" : "#94a3b8", disabled: !!(o.pay && s.companyCash < o.pay), cls: "lg" })).join("")}</div>`;
  } else if (m.type === "chart") {
    const s = stockBy(m.name);
    if (!s) { ui.modal = null; root.innerHTML = ""; return; }
    const h = state.holdings[s.name];
    inner = `<div class="row-between"><h2>${esc(s.name)}</h2><button class="x" data-act="close" aria-label="Sluiten">✕</button></div>
      <div class="muted small-t">€${fmt(s.price)} • laatste ${s.history.length} dagen${h ? ` • jouw gem. €${fmt(h.avg)}` : ""}</div>
      <div class="chart-wrap"><canvas id="bigchart"></canvas></div>
      <div class="legend small-t"><span><i style="background:#22c55e"></i>Koop</span><span><i style="background:#ef4444"></i>Verkoop</span><span><i style="background:#ec4899"></i>Short</span><span><i style="background:#f59e0b"></i>Gem. aankoop</span></div>`;
  } else if (m.type === "ipo") {
    inner = `<div class="row-between"><h2>🔔 Eigen bedrijf oprichten</h2><button class="x" data-act="close" aria-label="Sluiten">✕</button></div>
      <p class="muted small-t">Kost ${fmtShort(IPO_SHARES * IPO_PRICE * 2)}. Je krijgt ${IPO_SHARES} aandelen à ${fmtShort(IPO_PRICE)} en wordt CEO.</p>
      <span class="label">Naam (2–16 tekens)</span>
      <input class="input" type="text" maxlength="16" data-ipo-name data-focuskey="ipo-name" value="${esc(ui.ipoName)}" placeholder="Bijv. NovaCorp">
      <span class="label mt8">Sector</span>
      <select class="input" data-ipo-sector>${Object.entries(SECTORS).map(([k, v]) => `<option value="${k}" ${ui.ipoSector === k ? "selected" : ""}>${v}</option>`).join("")}</select>
      <div class="btn-row mt12">${btn("Naar de beurs!", "ipo-go", { color: "#f59e0b", cls: "lg" })}</div>`;
  } else if (m.type === "confirm-new") {
    inner = `<h2>Nieuw spel starten?</h2><p class="muted">Je huidige spel (dag ${state.day}) gaat verloren.</p>
      <div class="btn-row mt12">${btn("Ja, nieuw spel", "newgame-confirmed", { color: "#ef4444", cls: "lg" })}${btn("Annuleren", "close", { color: "#64748b", cls: "lg" })}</div>`;
  }

  const keepFocus = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.focuskey === "ipo-name";
  root.innerHTML = `<div class="modal-backdrop" ${dismissable ? `data-act="close"` : ""}></div>
    <div class="modal ${m.type === "chart" ? "wide" : ""}" role="dialog" aria-modal="true">${inner}</div>`;
  if (m.type === "chart") requestAnimationFrame(() => drawChart(m.name));
  if (keepFocus || m.type === "ipo") { const el = root.querySelector("[data-ipo-name]"); if (el && keepFocus) el.focus(); }
}

function drawChart(name) {
  const canvas = $("bigchart");
  const s = stockBy(name);
  if (!canvas || !s) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const hist = s.history;
  const startDay = state.day - hist.length + 1;
  const holding = state.holdings[name];
  const vals = hist.concat(holding ? [holding.avg] : []);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max === min) { max += 1; min = Math.max(0, min - 1); }
  const padV = (max - min) * 0.08; min -= padV; max += padV;
  const P = { l: w < 420 ? 46 : 60, r: 10, t: 10, b: 22 };
  const X = i => P.l + (hist.length === 1 ? 0.5 : i / (hist.length - 1)) * (w - P.l - P.r);
  const Y = v => P.t + (1 - (v - min) / (max - min)) * (h - P.t - P.b);

  ctx.font = "11px 'IBM Plex Mono', monospace";
  ctx.strokeStyle = "#1e293b"; ctx.fillStyle = "#64748b"; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const v = min + (max - min) * i / 4; const y = Y(v);
    ctx.beginPath(); ctx.moveTo(P.l, y); ctx.lineTo(w - P.r, y); ctx.stroke();
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText(v >= 1000 ? fmtShort(v) : "€" + v.toFixed(v < 10 ? 2 : 0), P.l - 6, y);
  }
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  const ticks = Math.min(5, hist.length);
  for (let i = 0; i < ticks; i++) {
    const idx = Math.round(i * (hist.length - 1) / Math.max(1, ticks - 1));
    ctx.fillText(`d${startDay + idx}`, X(idx), h - P.b + 6);
  }

  if (holding) {
    ctx.setLineDash([5, 4]); ctx.strokeStyle = "#f59e0b";
    ctx.beginPath(); ctx.moveTo(P.l, Y(holding.avg)); ctx.lineTo(w - P.r, Y(holding.avg)); ctx.stroke();
    ctx.setLineDash([]);
  }

  const up = hist[hist.length - 1] >= hist[0];
  const grad = ctx.createLinearGradient(0, P.t, 0, h - P.b);
  grad.addColorStop(0, up ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  hist.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.lineTo(X(hist.length - 1), h - P.b); ctx.lineTo(X(0), h - P.b); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath();
  hist.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.strokeStyle = up ? "#22c55e" : "#ef4444"; ctx.lineWidth = 2; ctx.stroke();

  const colors = { buy: "#22c55e", sell: "#ef4444", short: "#ec4899", cover: "#ec4899" };
  state.trades.filter(t => t.name === name && t.day >= startDay).forEach(t => {
    const i = t.day - startDay;
    const x = X(i), y = Y(t.price);
    const isUp = t.type === "buy" || t.type === "cover";
    ctx.fillStyle = colors[t.type]; ctx.beginPath();
    if (isUp) { ctx.moveTo(x, y - 2); ctx.lineTo(x - 6, y + 9); ctx.lineTo(x + 6, y + 9); }
    else { ctx.moveTo(x, y + 2); ctx.lineTo(x - 6, y - 9); ctx.lineTo(x + 6, y - 9); }
    ctx.closePath(); ctx.fill();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Events
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const act = el.dataset.act, arg = el.dataset.arg;

  if (act.startsWith("c:")) return companyAction(act.slice(2), arg);
  switch (act) {
    case "next": advanceDay(); break;
    case "speed": setSpeed(Number(arg)); render(); break;
    case "tab": ui.tab = arg; render(); window.scrollTo({ top: Math.min(window.scrollY, $("tabs").offsetTop - 8) }); break;
    case "select": ui.selected = arg; render(); break;
    case "buy": buyStock(arg); break;
    case "sell": sellStock(arg); break;
    case "short": openShort(arg); break;
    case "cover": coverShort(arg); break;
    case "max": { const s = stockBy(arg); const q = qtyOf(arg); const mb = maxBuyable(s); ui.amounts[arg] = String(mb > 0 ? mb : q || ""); render(); break; }
    case "chart": openModal({ type: "chart", name: arg }); break;
    case "close": closeModal(); break;
    case "choose": resolveChoice(Number(arg)); break;
    case "ipo": ui.ipoName = ""; openModal({ type: "ipo" }); break;
    case "ipo-go": foundCompany(); break;
    case "sound": settings.sound = !settings.sound; saveSettings(); render(); sound("buy"); break;
    case "export": exportSave(); break;
    case "newgame": openModal({ type: "confirm-new" }); break;
    case "newgame-confirmed": ui.modal = null; state = null; showStart(); break;
    case "continue": {
      const s = loadSave();
      if (s) { state = s; ui.placeholder = false; ui.modal = null; ui.selected = ownedNames()[0] || null; ui.tab = "market"; if (state.pendingChoice) ui.modal = { type: "choice" }; render(); }
      break;
    }
    case "start": ui.modal = null; newGame(arg); render(); break;
  }
});

document.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.amount !== undefined) {
    const clean = t.value.replace(/[^\d]/g, "").slice(0, 12);
    if (clean !== t.value) t.value = clean;
    ui.amounts[t.dataset.amount] = clean;
  } else if (t.dataset.ipoName !== undefined) {
    ui.ipoName = t.value;
  }
});

document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.select) { ui[t.dataset.select] = t.value; t.blur(); render(); }
  else if (t.dataset.ipoSector !== undefined) ui.ipoSector = t.value;
  else if (t.dataset.import !== undefined && t.files && t.files[0]) importSave(t.files[0]);
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeModal(); return; }
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea") {
    if (e.key === "Enter" && e.target.dataset.amount) { buyStock(e.target.dataset.amount); }
    if (e.key === "Enter" && e.target.dataset.ipoName !== undefined) foundCompany();
    return;
  }
  if (!state || ui.modal) return;
  if (e.altKey && /^[1-7]$/.test(e.key)) {
    const order = ["market", "portfolio", "company", "rivals", "investor", "achievements", "settings"];
    const k = order[Number(e.key) - 1];
    if (k !== "company" || ownedNames().length) { ui.tab = k; render(); }
    e.preventDefault(); return;
  }
  if ((e.key === " " || e.key === "Enter") && !(e.target.closest && e.target.closest("button"))) { e.preventDefault(); advanceDay(); }
  else if (/^[0-3]$/.test(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey) { setSpeed(Number(e.key)); render(); }
});

let resizeRaf = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => { if (ui.modal && ui.modal.type === "chart") drawChart(ui.modal.name); });
});
document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });

// ═══════════════════════════════════════════════════════════════════════════
// Boot
// ═══════════════════════════════════════════════════════════════════════════

function showStart() {
  setSpeed(0);
  // A placeholder state so the page behind the dialog isn't empty.
  if (!state) {
    const saved = loadSave();
    if (saved && !saved.gameOver && !saved.gameWon) state = saved;
    else { newGame("normal", false); }
  }
  ui.modal = { type: "start" };
  render();
}

window.__game = { get state() { return state; }, advanceDay, newGame: d => { newGame(d); ui.modal = null; render(); }, render, ui };

showStart();

})();
