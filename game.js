"use strict";
(() => {

const { t } = I18N;
const D = GAME_DATA;

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const SAVE_KEY = "investeer-sim-save-v2";

const MARKETS = D.MARKETS;
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
const OWN_MANY = 5;                // "Monopolist": own this many companies at once

const SHORT_MARGIN = 0.5;
const SHORT_DAILY_FEE = 0.001;
const SHORT_MARGIN_CALL = 0.15;

const HISTORY_LEN = 120;
const MIN_XP_TRADE_VALUE = 500;
const MAX_BUY_XP_PER_DAY = 10;
const MAX_SELL_XP_PER_DAY = 5;
const MAX_ALERTS = 20;

// Job: 6 workdays a week, 52 weeks. Every 7th game day is a Sunday (no work, no salary).
const WORKDAYS_PER_YEAR = 312;
const JOB_SALARIES = [18000, 30000, 45000, 70000, 110000, 180000, 300000]; // per year: Intern → VP
const JOB_XP_NEEDED = [100, 160, 240, 340, 460, 600];                       // job XP for the next level
const JOB_MAX_LEVEL = JOB_SALARIES.length - 1;
const JOB_DAILY_XP = 5;
const REVIEW_WORKDAYS = 12;
const JOB_SWITCH_DAYS = 2;
const JOB_LAYOFF_DAYS = 3;
const EMPLOYEE_DISCOUNT = 0.10;
const EMPLOYEE_DISCOUNT_SHARES = 10;      // per day
const MG_TIERS = [                       // score needed, bonus in days of salary, job XP
  { id: "perfect", min: 0.95, pay: 4,   xp: 60 },
  { id: "gold",    min: 0.75, pay: 2,   xp: 35 },
  { id: "silver",  min: 0.5,  pay: 1,   xp: 20 },
  { id: "bronze",  min: 0.25, pay: 0.5, xp: 10 },
];
const COMPANY_GAMES = {
  FreshMart: "change", EuroBank: "fake", TechNova: "bugs", GreenVolt: "balance", MedFuture: "memory",
  SpaceY: "launch", PixelForge: "diff", StreamWave: "compare", "SkyLine Air": "gates", BuildCo: "stack",
};
const HUSTLES = [
  { id: "lemonade", icon: "🍋", cost: 100,   income: 8 },
  { id: "bike",     icon: "🚲", cost: 500,   income: 35 },
  { id: "truck",    icon: "🚚", cost: 2000,  income: 120 },
  { id: "laundry",  icon: "🧺", cost: 8000,  income: 420 },
  { id: "flat",     icon: "🏠", cost: 30000, income: 1300 },
];
const HUSTLE_MAX = 3;
const PERSONAL_LOAN = 1000;
const PERSONAL_LOAN_RATE = 0.015;         // per day
const BANKRUPT_LIMIT = -2500;             // net worth below this = game over
const EUROBANK_BASE = 60;
const RELAUNCH_DAYS = 25;
// Taxes per difficulty. Income tax (salary, side hustles, mini-game bonuses) works in daily bands; dividends have a flat rate.
const TAXES = {
  easy: null,
  normal:   { bands: [[100, 0.10], [400, 0.20], [Infinity, 0.30]], dividend: 0.25 },
  hardcore: { bands: [[100, 0.15], [400, 0.30], [Infinity, 0.40]], dividend: 0.40 },
};
const FIRST_STEPS = ["job", "minigame", "profit", "own", "improve"];
const FIRST_STEP_XP = 20;
const GLOSSARY = ["share", "profit", "owner", "dividend", "companyCash", "salary", "tax", "recession", "short", "rivals"];

const SPEEDS = [0, 1500, 750, 300];
const SPEED_LABELS = ["⏸", "1×", "2×", "5×"];

const DIFFICULTIES = {
  easy:     { cashMult: 2,    recession: 0.02,  interest: 0.6, fee: 0.004, rival: 0.6, permadeath: false },
  normal:   { cashMult: 1,    recession: 0.035, interest: 1,   fee: 0.006, rival: 1,   permadeath: false },
  hardcore: { cashMult: 0.75, recession: 0.05,  interest: 1.4, fee: 0.008, rival: 1.4, permadeath: true },
};

const INVESTOR_RANKS = [
  { xpNeeded: 0,    color: "#64748b", icon: "🌱" },
  { xpNeeded: 100,  color: "#22c55e", icon: "📊" },
  { xpNeeded: 300,  color: "#3b82f6", icon: "🔍" },
  { xpNeeded: 700,  color: "#a78bfa", icon: "💼" },
  { xpNeeded: 1500, color: "#f59e0b", icon: "⚡" },
  { xpNeeded: 3000, color: "#ef4444", icon: "🌟" },
];
const rankName = i => t(`rank.${i}`);
const RANK_FEE_REDUCTION = 0.15;

const XP_REWARDS = {
  buy: 2, sell_profit: 10, own_company: 25, become_ceo: 50, product_hit: 15,
  risk_success: 20, takeover: 40, survive_recession: 30, survive_depression: 60,
  reach_100k: 50, reach_500k: 100, reach_1m: 200, reach_10m: 400, reach_100m: 800,
};

const ACHIEVEMENTS = [
  { id: "first_buy", xp: 10, icon: "📈" }, { id: "first_own", xp: 25, icon: "🏢" }, { id: "first_ceo", xp: 50, icon: "👔" },
  { id: "hit_product", xp: 20, icon: "🚀" }, { id: "risk_win", xp: 20, icon: "🎲" }, { id: "takeover_win", xp: 40, icon: "🤝" },
  { id: "survived_rec", xp: 30, icon: "🛡️" }, { id: "survived_dep", xp: 60, icon: "💪" }, { id: "reach_100k", xp: 50, icon: "💰" },
  { id: "reach_1m", xp: 150, icon: "💎" }, { id: "reach_10m", xp: 300, icon: "🏆" }, { id: "reach_100m", xp: 600, icon: "🌍" },
  { id: "own_all", xp: 200, icon: "👑" }, { id: "all_markets", xp: 80, icon: "🌐" }, { id: "no_debt", xp: 40, icon: "✅" },
  { id: "war_started", xp: 20, icon: "⚔️" }, { id: "bankruptcy", xp: 15, icon: "💀" }, { id: "short_win", xp: 30, icon: "📉" },
  { id: "synergy", xp: 40, icon: "🔗" }, { id: "ipo", xp: 150, icon: "🔔" }, { id: "beat_rivals", xp: 80, icon: "🥇" },
  { id: "defended", xp: 40, icon: "🏰" }, { id: "goals_10", xp: 60, icon: "🎯" }, { id: "alert_hit", xp: 15, icon: "🔔" },
  { id: "tutorial", xp: 25, icon: "🎓" },
  { id: "promoted", xp: 30, icon: "📈" }, { id: "perfect", xp: 40, icon: "💎" }, { id: "vp", xp: 150, icon: "🕴️" }, { id: "legend_rank", xp: 0, icon: "⭐" }, { id: "hardcore_win", xp: 0, icon: "🔥" },
];

const ACTION_COSTS = { marketing: 5000, employees: 12000, research: 20000, risk: 30000, ceo: 15000, factory: FACTORY_COST, product: 25000 };
const WAR_COSTS = { price: 20000, ads: 15000, talent: 10000 };

const RIVAL_TEMPLATES = [
  { name: "Victor Vale",  style: "aggressive", attack: "raider",  cash: 40000, color: "#ef4444", icon: "🦈", likes: ["SpaceY", "TechNova", "PixelForge", "StreamWave"] },
  { name: "Sophie Stern", style: "cautious",   attack: "shorter", cash: 80000, color: "#06b6d4", icon: "🦉", likes: ["EuroBank", "FreshMart", "BuildCo", "GreenVolt"] },
  { name: "Bram Peeters", style: "trend",      attack: "sniper",  cash: 25000, color: "#f59e0b", icon: "🐺", likes: [] },
];
const OLD_STYLES = { agressief: "aggressive", voorzichtig: "cautious", trendvolger: "trend" };
const RIVAL_NORMAL_CAP = 45;
const RIVAL_HOSTILE_FROM_DAY = 20;

const BASE_NAMES = D.STOCK_DEFS.map(s => s.name);

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
const round2 = v => Math.round(v * 100) / 100;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = v => I18N.num(v, 2);
const fmtShort = v => I18N.moneyShort(v);
const pct = v => I18N.num(v, 1);
const marketName = m => t(`market.${m}`);
const sectorName = s => t(`sector.${s}`);

function randomCeo() {
  return { name: pick(D.CEO_NAMES), leadership: 40 + Math.floor(Math.random() * 56), innovation: 30 + Math.floor(Math.random() * 66), reliability: 35 + Math.floor(Math.random() * 61) };
}
// Accepts "1234.5", "1234,5", "1,234.50" and "1.234,50".
function parsePrice(txt) {
  let s = String(txt || "").replace(/[^\d.,]/g, "");
  const lastSep = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  if (lastSep >= 0) s = s.slice(0, lastSep).replace(/[.,]/g, "") + "." + s.slice(lastSep + 1);
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}
function storageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function storageSet(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }
function storageDel(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
function safeParse(txt) { try { return txt ? JSON.parse(txt) : null; } catch { return null; } }

const sound = name => window.Sound && Sound.play(name);

// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════

let state = null;
const ui = {
  tab: "market", selected: null, amounts: {}, speed: 0, modal: null, menuStep: "main",
  takeoverTarget: "", warTarget: "", flashDay: 0, ipoName: "", ipoSector: "tech",
  marketFilter: "all", alertPrice: "", placeholder: false, tutorial: null,
};

function makeStock(def) {
  return {
    name: def.name, sector: def.sector, price: def.price, volatility: def.volatility,
    reputation: def.reputation, employees: def.employees, research: def.research,
    factories: 0, markets: [...def.markets], debt: 0, companyCash: def.companyCash,
    recession: def.recession || 0.978,
    dividendRate: 10, playerCEO: false, ceo: { ...def.ceo }, products: [],
    bankrupt: false, history: [def.price], controlledBy: null, custom: !!def.custom, lastWarDay: 0,
    shares: D.sharesFor(def, def.employees * 2), profitAvg: def.employees * 2, autopilot: false, bankruptDay: 0,
  };
}

function getStartingSetup(diffKey) {
  if (diffKey === "hardcore") return { id: "hardcore", cash: 0, ownAll: false, icon: "🔥" };
  const m = DIFFICULTIES[diffKey].cashMult;
  // Straight after the tutorial you always get the standard start, never a lucky or unlucky one.
  const r = storageGet("inv-tutorial-done") === "1" ? 50 : Math.random() * 100;
  let s;
  if (r < 12)      s = { id: "hard",        cash: 5000,     ownAll: false, icon: "💀" };
  else if (r < 24) s = { id: "dynasty",     cash: 1000000,  ownAll: true,  icon: "👑" };
  else if (r < 74) s = { id: "normal",      cash: 10000,    ownAll: false, icon: "📈" };
  else if (r < 84) s = { id: "strong",      cash: 50000,    ownAll: false, icon: "💼" };
  else if (r < 94) s = { id: "rich",        cash: 250000,   ownAll: false, icon: "🏦" };
  else if (r < 99) s = { id: "millionaire", cash: 1000000,  ownAll: false, icon: "💎" };
  else             s = { id: "jackpot",     cash: 50000000, ownAll: false, icon: "🎰" };
  s.cash = Math.round(s.cash * m);
  return s;
}

function newGame(diffKey, { persist = true, tutorial = false } = {}) {
  const setup = tutorial ? { id: "tutorial", cash: 10000, ownAll: false, icon: "🎓" } : getStartingSetup(diffKey);
  // Dynasty: own the five original companies.
  const stocks = D.STOCK_DEFS.map(makeStock);
  const holdings = {};
  if (setup.ownAll) stocks.slice(0, 5).forEach(s => { holdings[s.name] = { qty: OWNERSHIP_THRESHOLD, avg: s.price }; });

  state = {
    v: 2, difficulty: diffKey, setupId: setup.id, setupIcon: setup.icon, day: 1, cash: setup.cash,
    stocks, holdings, shorts: {}, alerts: [],
    recession: false, recessionDays: 0, depression: false, depressionDays: 0,
    xp: 0, achievements: [], milestones: [], rewarded: { own: {}, ceo: {} },
    // Easy keeps the calm archetypes; from Normal up every rival attacks, each in its own way.
    rivals: RIVAL_TEMPLATES.map(r => ({ name: r.name, style: diffKey === "easy" ? r.style : r.attack, color: r.color, icon: r.icon, likes: r.likes, cash: Math.round(r.cash * DIFFICULTIES[diffKey].rival), holdings: {} })),
    news: [], lastDividend: 0, goal: null, goalsDone: 0,
    today: { buys: 0, actions: 0, buyXp: 0, sellXp: 0, emp: 0 },
    job: null, jobGap: 0, career: { level: diffKey === "hardcore" ? 0 : 1, xp: 0, since: 0 },
    hustles: {}, personalDebt: 0, lastSalary: 0, incToday: 0, lastWorkTax: 0, lastDivTax: 0, ebPeak: 0,
    tips: { seen: {}, queue: [] },
    steps: tutorial || storageGet("inv-firststeps-done") === "1" ? null : { done: {}, flags: {} },
    trades: [], ipoDone: false, pendingChoice: null, gameOver: false, gameWon: false,
    ownedPrev: {}, qtyPrev: {}, lostTo: {},
  };
  addNews([[`setup.${setup.id}`, { cash: setup.cash }]]);

  if (setup.ownAll) {
    state.achievements.push("first_buy", "first_own");
    stocks.slice(0, 5).forEach(s => { state.rewarded.own[s.name] = true; });
  }
  const startTotal = totalValue();
  milestoneList().forEach(m => { if (startTotal >= m.threshold) state.milestones.push(m.key); });
  syncOwnership(true);
  if (setup.ownAll) ["own_all", "synergy"].forEach(id => { if (!state.achievements.includes(id)) state.achievements.push(id); });
  state.goal = newGoal();

  ui.tab = "market"; ui.selected = ownedNames()[0] || null; ui.amounts = {};
  ui.takeoverTarget = ""; ui.warTarget = ""; ui.flashDay = 0; ui.marketFilter = "all";
  ui.tutorial = tutorial ? { step: 0, rose: false } : null;
  if (tutorial) {
    // Scripted practice market: a tip in the news, enough company cash for a factory, amounts filled in.
    stockBy(TUT).companyCash = Math.max(stockBy(TUT).companyCash, 120000);
    addNews([["tut.newsTip", { company: TUT_TRADE }]], "good");
    ui.amounts[TUT_TRADE] = String(TUT_TRADE_QTY); ui.amounts[TUT] = String(OWNERSHIP_THRESHOLD);
  }
  ui.placeholder = !persist || tutorial;
  setSpeed(0);
  save();
}

// Bring saves from older versions up to date (new companies, translation keys).
function migrate(s) {
  if (!s || s.v !== 2 || !Array.isArray(s.stocks)) return null;
  D.STOCK_DEFS.forEach(def => {
    const ex = s.stocks.find(x => x.name === def.name);
    if (!ex) { s.stocks.push(makeStock(def)); return; }
    ex.recession = def.recession;
    if (!ex.sector) ex.sector = def.sector;
  });
  s.stocks.forEach(x => {
    if (!x.recession) x.recession = 0.978;
    if (!x.shares) {
      // Older saves: give the company shares so that today's price is its fair value.
      x.profitAvg = x.employees * 2 + D.factoryIncome(x.factories || 0);
      const held = (s.holdings[x.name] ? s.holdings[x.name].qty : 0) + (s.rivals || []).reduce((tt, r) => tt + (r.holdings && r.holdings[x.name] ? r.holdings[x.name].qty : 0), 0);
      const value = Math.max(0, x.companyCash) - (x.debt || 0) + x.profitAvg * D.VALUE_DAYS;
      x.shares = Math.max(200, held + 50, Math.round(value / Math.max(1, x.price) / 50) * 50);
      x.autopilot = false; x.bankruptDay = s.day;
    }
  });
  s.alerts = s.alerts || [];
  if (!s.career) s.career = { level: 1, xp: 0, since: 0 };
  if (s.job === undefined) s.job = null;
  s.hustles = s.hustles || {}; s.personalDebt = s.personalDebt || 0; s.lastSalary = s.lastSalary || 0; s.jobGap = s.jobGap || 0;
  if (s.today && s.today.emp === undefined) s.today.emp = 0;
  s.incToday = s.incToday || 0; s.lastWorkTax = s.lastWorkTax || 0; s.lastDivTax = s.lastDivTax || 0; s.ebPeak = s.ebPeak || 0;
  if (!s.tips) s.tips = { seen: {}, queue: [] };
  if (s.steps === undefined) s.steps = null;
  s.rivals.forEach(r => {
    r.style = OLD_STYLES[r.style] || r.style;
    const tpl = RIVAL_TEMPLATES.find(x => x.name === r.name);
    if (tpl) r.likes = tpl.likes;
  });
  if (!s.setupId) { s.setupId = "normal"; s.setupIcon = "📈"; }
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════════════════

const diff = () => DIFFICULTIES[state.difficulty] || DIFFICULTIES.normal;
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
  const sh = state.shorts[name]; if (!sh) return 0;
  return sh.margin + (sh.entry - stockBy(name).price) * sh.qty;
}
const longValue = () => state.stocks.reduce((tt, s) => tt + qtyOf(s.name) * s.price, 0);
const shortsValue = () => Object.keys(state.shorts).reduce((tt, n) => tt + shortEquity(n), 0);
const totalValue = () => state.cash + longValue() + shortsValue() - (state.personalDebt || 0);

const inCrisis = () => state.recession || state.depression;
const isSunday = () => state.day % 7 === 0;
const salaryPerDay = (level = state.career.level) => Math.round(JOB_SALARIES[level] / WORKDAYS_PER_YEAR);
const hustleCount = id => state.hustles[id] || 0;
const hustleCost = h => Math.round(h.cost * Math.pow(1.5, hustleCount(h.id)));
const sideIncome = () => HUSTLES.reduce((tt, h) => tt + hustleCount(h.id) * h.income, 0) * (inCrisis() ? 0.7 : 1);
function incomeTax(gross) {
  const tx = TAXES[state.difficulty];
  if (!tx) return 0;
  let tax = 0, prev = 0;
  for (const [cap, rate] of tx.bands) { if (gross > prev) tax += (Math.min(gross, cap) - prev) * rate; prev = cap; }
  return tax;
}
const dividendTaxRate = () => (TAXES[state.difficulty] ? TAXES[state.difficulty].dividend : 0);
// Pay work income into cash. All income of one day shares the same tax bands.
function earn(gross) {
  const tax = round2(incomeTax(state.incToday + gross) - incomeTax(state.incToday));
  state.incToday = round2(state.incToday + gross);
  state.cash = round2(state.cash + gross - tax);
  if (tax > 0) tip("tax");
  return { net: round2(gross - tax), tax };
}
// One-time explanations the first time something happens.
function tip(id) {
  if (!state || ui.tutorial || state.tips.seen[id]) return;
  state.tips.seen[id] = true;
  state.tips.queue.push(id);
}
// "First steps" checklist of a new player's first real game.
function checkSteps() {
  const st = state && state.steps;
  if (!st || ui.tutorial) return;
  const now = { job: !!state.job, minigame: st.flags.mg, profit: st.flags.profit, own: ownedNames().length > 0, improve: st.flags.improve };
  FIRST_STEPS.forEach(id => {
    if (st.done[id] || !now[id]) return;
    st.done[id] = true;
    awardXP(FIRST_STEP_XP, "xp.reason.step");
    sound("goal");
  });
  if (FIRST_STEPS.every(id => st.done[id])) {
    state.steps = null;
    storageSet("inv-firststeps-done", "1");
    toast(t("steps.allDone"), "big"); confetti();
  }
}
const canWorkToday = () => !!state.job && state.job.startsIn === 0 && !isSunday();

function activeSynergies() {
  const owned = new Set(ownedNames());
  return D.SYNERGIES.filter(sy => sy.names.every(n => owned.has(n)) && owned.size >= sy.names.length + (sy.extra || 0));
}
function synergyBonus(name, key) {
  if (!isOwned(name)) return 0;
  return activeSynergies().reduce((tt, sy) => tt + ((sy.global || sy.names.includes(name)) && sy[key] ? sy[key] : 0), 0);
}

const econMult = () => (state.depression ? 0.6 : state.recession ? 0.78 : 1);
function calcIncome(s) {
  const base = s.employees * 4 + D.factoryIncome(s.factories);
  const market = 1 + s.markets.reduce((tt, m) => tt + MARKET_INCOME_BONUS[m], 0);
  return base * market * (1 + synergyBonus(s.name, "income")) * econMult();
}
function interestRate(s) {
  const base = s.ceo.reliability >= 75 ? 0.0012 : s.ceo.reliability >= 50 ? 0.002 : 0.003;
  return base * diff().interest * (1 - synergyBonus(s.name, "interest"));
}
const calcCosts = s => s.employees * (state.recession || state.depression ? 2.4 : 2) + s.debt * interestRate(s);
const calcProfit = s => calcIncome(s) - calcCosts(s);
const loanCount = s => Math.ceil(s.debt / LOAN_AMOUNT - 1e-9);

function dailyDrift(s) {
  const rep = s.reputation <= 20 ? -0.006 : s.reputation <= 40 ? -0.002 : s.reputation <= 60 ? 0 : s.reputation <= 80 ? 0.0015 : 0.0025;
  const res = s.research < 20 ? 0 : s.research < 40 ? 0.0005 : s.research < 60 ? 0.001 : s.research < 80 ? 0.002 : 0.003;
  const mk = s.markets.reduce((tt, m) => tt + MARKET_DRIFT[m], 0);
  return rep + res + mk + (s.ceo.leadership - 50) / 25000 + (s.ceo.reliability - 50) / 30000;
}

function companyLevel(s) {
  const v = s.reputation + s.research + s.factories * 10 + s.employees / 300 + (s.markets.length - 1) * 15;
  const id = v >= 220 ? "mega" : v >= 170 ? "multi" : v >= 125 ? "national" : v >= 90 ? "regional" : v >= 55 ? "small" : "startup";
  return t(`level.${id}`);
}
function dayChange(s) {
  const h = s.history;
  if (h.length < 2 || !h[h.length - 2]) return 0;
  return (h[h.length - 1] - h[h.length - 2]) / h[h.length - 2] * 100;
}

// ═══════════════════════════════════════════════════════════════════════════
// News, XP, achievements, goals
// ═══════════════════════════════════════════════════════════════════════════

// parts: [[key, params], …] — translated when shown, so switching language works for old news too.
function addNews(parts, kind = "info") {
  state.news.unshift({ day: state.day, parts, kind });
  if (state.news.length > 40) state.news.length = 40;
}

function awardXP(amount, reasonKey) {
  if (amount <= 0) return;
  const before = rankIndex();
  state.xp += amount;
  if (reasonKey) toast(t("xp.gain", { xp: amount, reason: t(reasonKey) }));
  const after = rankIndex();
  if (after > before) {
    toast(t("rank.up", { icon: INVESTOR_RANKS[after].icon, rank: rankName(after) }), "big");
    confetti(); sound("rankup");
    if (after === INVESTOR_RANKS.length - 1) unlock("legend_rank");
  }
}

function unlock(id) {
  if (state.achievements.includes(id)) return;
  const ach = ACHIEVEMENTS.find(a => a.id === id);
  if (!ach) return;
  state.achievements.push(id);
  toast(t("ach.unlocked", { icon: ach.icon, name: t(`ach.${id}.label`) }), "big");
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
      toast(t("milestone", { amount: fmtShort(m.threshold), xp: m.xp }));
      awardXP(m.xp, null);
      if (m.achId) unlock(m.achId);
    }
  });
}

function estimatedDividend() {
  return ownedNames().reduce((tt, n) => {
    const s = stockBy(n); const p = calcProfit(s);
    return tt + (p > 0 ? p * s.dividendRate / 100 * qtyOf(n) / s.shares * (1 - dividendTaxRate()) : 0);
  }, 0);
}
function newGoal() {
  const opts = [
    { type: "buys", target: 2, xp: 15 },
    { type: "growth", target: 1.02, xp: 25 },
    { type: "short", target: 1, xp: 15 },
  ];
  if (canWorkToday() && !state.job.played) opts.push({ type: "minigame", target: 1, xp: 20 }, { type: "minigame", target: 1, xp: 20 });
  if (totalValue() < 1000) opts.splice(0, 3);   // broke: no trading goals you can't reach
  if (!opts.length) opts.push({ type: "growth", target: 1.02, xp: 25 });
  if (ownedNames().length) {
    opts.push({ type: "actions", target: 2, xp: 20 });
    const est = estimatedDividend();
    if (est > 50) opts.push({ type: "dividend", target: Math.max(100, Math.round(est * 1.25)), xp: 25 });
  }
  return { ...pick(opts), progress: 0, done: false, base: totalValue() };
}
function goalText(g) {
  return t(`goal.${g.type}`, { amount: fmtShort(g.type === "buys" ? MIN_XP_TRADE_VALUE : g.target), n: g.target });
}
function goalProgress(type, amount = 1) {
  const g = state.goal;
  if (!g || g.done || g.type !== type) return;
  g.progress += amount;
  if (g.progress >= g.target) completeGoal();
}
function completeGoal() {
  const g = state.goal;
  g.done = true; state.goalsDone++;
  awardXP(g.xp, "xp.reason.goal");
  sound("goal");
  if (state.goalsDone >= 10) unlock("goals_10");
}

// ═══════════════════════════════════════════════════════════════════════════
// Ownership / CEO bookkeeping
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
        addNews([["news.regained", { company: name, rival: state.lostTo[name] }]], "good");
        unlock("defended");
        delete state.lostTo[name];
      } else {
        addNews([["news.control", { company: name }]], "good");
        // Part of the company's cash is paid out to the other shareholders, so a takeover is not a jackpot.
        if (!s.custom && !s.paidOut && s.companyCash > 20000) {
          s.paidOut = true;                   // once per company, so control cannot be flipped for repeated payouts
          const payout = round2(s.companyCash * D.TAKEOVER_PAYOUT);
          s.companyCash = round2(s.companyCash - payout);
          payShareholders(s, payout);         // the other shareholders are paid; the new owner is not
          addNews([["news.takeoverPayout", { company: name, amount: payout }]]);
        }
      }
      if (!state.rewarded.own[name]) { state.rewarded.own[name] = true; awardXP(XP_REWARDS.own_company, "xp.reason.own"); }
      unlock("first_own");
      if (!ui.selected || !isOwned(ui.selected)) ui.selected = name;
    }
    if (!owned && prev && !s.bankrupt && !silent) {
      const tr = topRival(name);
      if (tr && tr.q > q && q >= OWNERSHIP_THRESHOLD) {
        state.lostTo[name] = tr.r.name;
        addNews([["news.hostile", { rival: tr.r.name, company: name }]], "bad");
        sound("takeover");
      } else {
        addNews([["news.lostControl", { company: name }]], "bad");
      }
    }
    if (owned && q >= CEO_THRESHOLD && prevQ < CEO_THRESHOLD && !s.playerCEO && !silent) becomeCEO(s);
    if (s.playerCEO && !(owned && q >= CEO_THRESHOLD)) {
      s.playerCEO = false; s.ceo = randomCeo();
      if (!silent) addNews([["news.ceoLost", { company: name, ceo: s.ceo.name }]], "bad");
    }
    state.ownedPrev[name] = owned;
    state.qtyPrev[name] = q;
  });

  if (ui.selected && !isOwned(ui.selected)) ui.selected = ownedNames()[0] || null;
  if (ui.tab === "company" && !ui.selected) ui.tab = "market";
  if (silent) return;
  const owned = ownedNames();
  if (owned.length >= OWN_MANY) unlock("own_all");
  if (activeSynergies().length) unlock("synergy");
}

function becomeCEO(s) {
  s.playerCEO = true;
  s.ceo = { name: t("you"), leadership: 60, innovation: 60, reliability: 60, isPlayer: true };
  addNews([["news.ceo", { company: s.name }]], "good");
  if (!state.rewarded.ceo[s.name]) { state.rewarded.ceo[s.name] = true; awardXP(XP_REWARDS.become_ceo, "xp.reason.ceo"); }
  unlock("first_ceo");
}
const ceoName = s => (s.ceo.isPlayer || s.playerCEO ? t("you") : s.ceo.name);

// ═══════════════════════════════════════════════════════════════════════════
// Day simulation
// ═══════════════════════════════════════════════════════════════════════════

function goBankrupt(s, notes) {
  s.bankrupt = true; s.price = 0; s.employees = 0; s.companyCash = 0; s.debt = 0; s.bankruptDay = state.day; s.autopilot = false;
  s.playerCEO = false; s.controlledBy = null;
  notes.push(["news.bankrupt", { company: s.name }]);
  state.rivals.forEach(r => { delete r.holdings[s.name]; });
  state.stocks.forEach(o => { if (o.controlledBy === s.name) o.controlledBy = null; });
  state.alerts = state.alerts.filter(a => a.name !== s.name);
  if (state.shorts[s.name]) {
    const sh = state.shorts[s.name];
    state.cash = round2(state.cash + sh.margin + sh.entry * sh.qty);
    notes.push(["news.shortBankrupt", { company: s.name, gain: sh.entry * sh.qty }]);
    delete state.shorts[s.name];
    unlock("short_win");
  }
  if (qtyOf(s.name) > 0 || state.ownedPrev[s.name]) unlock("bankruptcy");
}

// Shares of a company held by you and the rivals together, and how many are still for sale.
const heldShares = s => qtyOf(s.name) + state.rivals.reduce((tt, r) => tt + (r.holdings[s.name] ? r.holdings[s.name].qty : 0), 0);
const freeShares = s => Math.max(0, s.shares - heldShares(s));
const stakePct = s => qtyOf(s.name) / s.shares * 100;
// Pay an amount to all shares of a company. The part of shares nobody in the game holds goes to the public.
function payShareholders(s, pool) {
  if (pool <= 0) return 0;
  state.rivals.forEach(r => { const h = r.holdings[s.name]; if (h) r.cash = round2(r.cash + pool * h.qty / s.shares); });
  return pool * qtyOf(s.name) / s.shares;
}
function bossContext(s) {
  return { mode: state.difficulty, crisis: inCrisis(), day: state.day, others: state.stocks.filter(o => o !== s && !o.bankrupt), held: heldShares,
    mult: x => (1 + x.markets.reduce((tt, m) => tt + MARKET_INCOME_BONUS[m], 0)) * econMult(),
    markets: MARKETS, marketBonus: MARKET_INCOME_BONUS, marketFail: MARKET_FAIL_CHANCE,
    costs: { marketing: ACTION_COSTS.marketing, employees: ACTION_COSTS.employees, research: ACTION_COSTS.research, product: ACTION_COSTS.product, war: WAR_COSTS, markets: MARKET_COSTS, loan: LOAN_AMOUNT, maxDebt: MAX_DEBT } };
}
// A bankrupt company comes back a while later, smaller and under new owners.
function relaunch(s, notes) {
  const def = D.STOCK_DEFS.find(d => d.name === s.name);
  if (!def) return;
  delete state.holdings[s.name]; delete state.ownedPrev[s.name]; delete state.qtyPrev[s.name]; delete state.lostTo[s.name];
  Object.assign(s, makeStock({ ...def, employees: Math.round(def.employees * 0.5), companyCash: Math.round(def.companyCash * 0.5), ceo: randomCeo() }));
  s.price = round2(D.fairValue(s)); s.history = [s.price];
  notes.push(["news.relaunch", { company: s.name }]);
}

function advanceDay() {
  if (!state || state.gameOver || state.gameWon || state.pendingChoice) return;
  const tut = !!ui.tutorial;
  const before = totalValue();
  const ev = tut ? D.MARKET_EVENTS.find(e => e.id === "optimism") : pick(D.MARKET_EVENTS);
  const mult = typeof ev.multiplier === "function" ? ev.multiplier() : ev.multiplier;
  const owned = new Set(ownedNames());
  const notes = [];
  let dividend = 0;
  const hardcoreNoDiv = state.difficulty === "hardcore" && inCrisis();   // Hardcore: no dividends during a crisis

  state.stocks.forEach(s => {
    if (s.bankrupt) { if (!s.custom && state.day - (s.bankruptDay || 0) >= RELAUNCH_DAYS) relaunch(s, notes); return; }
    const profit = calcProfit(s);
    s.profitAvg = s.profitAvg * 0.85 + profit * 0.15;
    // Dividends are paid per share, to everyone who holds shares.
    const pool = profit > 0 && !hardcoreNoDiv ? profit * s.dividendRate / 100 : 0;
    dividend += payShareholders(s, pool);
    s.companyCash += profit - pool;
    // The AI boss runs every company you don't control (and yours too, on autopilot).
    if (!tut && (!owned.has(s.name) || s.autopilot)) {
      const mine = n => qtyOf(n) > 0;
      D.aiBoss(s, bossContext(s)).forEach(part => { if (mine(s.name) || (part[2] && mine(part[2]))) notes.push([part[0], part[1]]); });
    }
    s.companyCash = round2(s.companyCash);

    const fair = D.fairValue(s);
    let p = s.price;
    if (ev.affected === "*" || ev.affected.includes(s.name)) p *= mult;
    if (s.name === "EuroBank") p *= Math.random() > 0.5 ? 1.002 : 0.998;
    else p += (Math.random() - 0.5) * s.volatility * (1 - synergyBonus(s.name, "volatility")) * p * (tut ? 0.3 : 1);
    p *= 1 + dailyDrift(s);

    if (state.recession) {
      p *= s.recession;
      if (Math.random() < 0.05 && s.employees > 150) { s.employees = Math.floor(s.employees * 0.96); notes.push(["news.layoffs", { company: s.name }]); }
    }
    if (state.depression) p *= 0.985;
    if (s.name === "EuroBank") {
      // A bank is calm in normal times and falls hard in a crisis.
      if (state.recession && Math.random() < 0.10) { p *= 0.75; notes.push(["news.bankRun", {}]); }
      if (state.depression) p *= 0.97;
      // After a crisis the bank climbs back to its real value quickly (fastest on Hardcore).
      if (!inCrisis() && p < fair) p += (fair - p) * (state.difficulty === "hardcore" ? 0.14 : 0.06);
      p = Math.max(p, EUROBANK_BASE * 0.1);                                 // too big to fail completely
    }
    p += (fair - p) * D.FAIR_PULL;                                           // the price follows what the company is worth
    if (s.name === "SpaceY") {
      if (p > fair * 2.5 && Math.random() < 0.18) { p *= 0.55; s.reputation = clamp(s.reputation - 8, 0, 100); notes.push(["news.bubble", {}]); }
      if (p > fair * 5 && Math.random() < 0.30) { p *= 0.30; s.reputation = clamp(s.reputation - 15, 0, 100); notes.push(["news.megaBubble", {}]); }
    }
    if (!tut && Math.random() < 0.008 * ((100 - s.ceo.reliability) / 100)) {
      s.reputation = clamp(s.reputation - 8, 0, 100); p *= 0.92;
      notes.push(["news.scandal", { company: s.name }]);
    }
    if (tut && s.name === TUT_TRADE) {
      if (!ui.tutorial.rose && qtyOf(TUT_TRADE) > 0) { p = s.price * 1.08; ui.tutorial.rose = true; }   // the tip in the news comes true
      else p = Math.max(p, s.price);
    }
    s.price = round2(Math.max(0, p));
    s.history.push(s.price);
    if (s.history.length > HISTORY_LEN) s.history.shift();
    if (s.price < 1.5 || s.companyCash < -300000) goBankrupt(s, notes);
  });

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
      notes.push(["news.marginCall", { company: name }]);
      sound("bad");
    }
  });

  const divTax = round2(dividend * dividendTaxRate());
  if (divTax > 0) tip("tax");
  state.cash = round2(state.cash + dividend - divTax);
  state.lastDividend = round2(dividend - divTax);
  state.lastDivTax = divTax;
  dailyWork(notes, tut);
  if (!tut) rivalsAct(notes);
  if (notes.some(n => /^news\.rival(Buys|Short|Snipes)$/.test(n[0]))) tip("rival");
  if (!tut) tip("shares");

  // Economic cycle
  const roll = Math.random();
  let headline = ["event." + ev.id, {}], kind = "info";
  if (tut) { /* calm market during the tutorial */ }
  else if (state.depression) {
    state.depressionDays++;
    if (state.depressionDays >= 6 && roll < DEPRESSION_RECOVERY_CHANCE) {
      state.depression = false; state.depressionDays = 0;
      headline = ["news.depressionOver", {}]; kind = "good";
      awardXP(XP_REWARDS.survive_depression, "xp.reason.depression");
      unlock("survived_dep");
    }
  } else if (state.recession) {
    state.recessionDays++;
    if (state.recessionDays >= DEPRESSION_TRIGGER_DAYS && roll < DEPRESSION_CHANCE) {
      state.depression = true; state.depressionDays = 1; state.recession = false; state.recessionDays = 0;
      state.stocks.forEach(s => { if (!s.bankrupt) { s.price = round2(s.name === "EuroBank" ? Math.max(6, s.price * 0.3) : s.price * 0.6); s.history[s.history.length - 1] = s.price; } });
      headline = ["news.depression", {}]; kind = "bad";
      sound("bad");
    } else if (state.recessionDays >= 5 && roll < RECESSION_RECOVERY_CHANCE) {
      state.recession = false; state.recessionDays = 0;
      headline = ["news.recovery", { event: ev.id }]; kind = "good";
      awardXP(XP_REWARDS.survive_recession, "xp.reason.recession");
      unlock("survived_rec");
    }
  } else if (roll < diff().recession) {
    state.recession = true; state.recessionDays = 1;
    if (state.difficulty === "hardcore") { const eb = stockBy("EuroBank"); if (eb && !eb.bankrupt) state.ebPeak = Math.max(state.ebPeak || 0, eb.price); }
    tip("recession");
    headline = ["news.recession", { event: ev.id }]; kind = "bad";
    sound("bad");
  }
  addNews([headline, ...notes], kind);

  state.day++;
  state.today = { buys: 0, actions: 0, buyXp: 0, sellXp: 0, emp: 0 };
  syncOwnership();
  const after = totalValue();

  const g = state.goal;
  if (g && !g.done) {
    if (g.type === "dividend" && dividend >= g.target) { g.progress = dividend; completeGoal(); }
    if (g.type === "growth" && g.base > 0 && after / g.base >= g.target) completeGoal();
  }
  state.goal = newGoal();
  checkAlerts();

  const ownedNow = ownedNames();
  if (!tut && ownedNow.length && state.day > 3 && Math.random() < 0.08) {
    state.pendingChoice = { id: pick(D.CHOICE_EVENTS).id, company: pick(ownedNow) };
  }
  if (state.day > 30 && state.rivals.every(r => rivalWorth(r) < after)) unlock("beat_rivals");

  checkMilestones(after);
  if (after >= WIN_TARGET) {
    state.gameWon = true;
    if (state.difficulty === "hardcore") unlock("hardcore_win");
    confetti(true); sound("win");
  } else if (after < BANKRUPT_LIMIT) {
    state.gameOver = true; sound("bad");
  }

  ui.flashDay = state.day;
  sound("day");
  save();
  if (state.gameOver && diff().permadeath) storageDel(SAVE_KEY);
  if (state.gameOver || state.gameWon) { setSpeed(0); openModal({ type: "end" }); }
  else if (state.pendingChoice) { setSpeed(0); openModal({ type: "choice" }); }
  render();
}

// ═══════════════════════════════════════════════════════════════════════════
// Price alerts
// ═══════════════════════════════════════════════════════════════════════════

function checkAlerts() {
  const hit = [];
  state.alerts = state.alerts.filter(a => {
    const s = stockBy(a.name);
    if (!s || s.bankrupt) return false;
    const ok = a.dir === "above" ? s.price >= a.price : s.price <= a.price;
    if (ok) hit.push({ a, s });
    return !ok;
  });
  hit.forEach(({ a, s }) => {
    toast(t(`alert.hit.${a.dir}`, { company: s.name, price: I18N.money(s.price), target: I18N.money(a.price) }), "big");
    addNews([[`alert.hit.${a.dir}`, { company: s.name, price: s.price, target: I18N.money(a.price) }]], "good");
    unlock("alert_hit");
  });
  if (hit.length) sound("alert");
}
function addAlert(name, dir) {
  const s = stockBy(name);
  const price = parsePrice(ui.alertPrice);
  if (!s || !(price > 0)) return msg(t("alert.invalid"));
  if (state.alerts.length >= MAX_ALERTS) return msg(t("alert.max", { n: MAX_ALERTS }));
  if (dir === "above" && price <= s.price) return msg(t("alert.mustAbove", { price: I18N.money(s.price) }));
  if (dir === "below" && price >= s.price) return msg(t("alert.mustBelow", { price: I18N.money(s.price) }));
  state.alerts.push({ id: Date.now() + Math.random(), name, dir, price: round2(price) });
  toast(t("alert.set", { company: name }));
  save(); render();
}

// ═══════════════════════════════════════════════════════════════════════════
// Rivals
// ═══════════════════════════════════════════════════════════════════════════

function rivalWorth(r) {
  return r.cash + Object.keys(r.holdings).reduce((tt, n) => { const s = stockBy(n); return tt + (s ? r.holdings[n].qty * s.price : 0); }, 0);
}
function rivalBuy(r, s, qty) {
  qty = Math.min(qty, freeShares(s));
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
    r.cash = round2(r.cash + 150 * aggro);
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
    const hostile = state.day > (state.difficulty === "hardcore" ? 10 : RIVAL_HOSTILE_FROM_DAY);
    // Raider: buys up shares of a company you control.
    if (hostile && (r.style === "aggressive" || r.style === "raider") && playerOwned.length && Math.random() < 0.25 * aggro) {
      const target = stockBy(pick(playerOwned));
      const pq = qtyOf(target.name);
      if (pq > 0) {
        const want = Math.max(5, Math.ceil(pq * 0.25));
        const affordable = Math.floor(r.cash / (target.price * (1 + diff().fee)));
        const got = rivalBuy(r, target, Math.min(want, affordable));
        if (got) notes.push(["news.rivalBuys", { rival: r.name, qty: got, company: target.name, total: r.holdings[target.name].qty }]);
        return;
      }
    }
    // Short seller: attacks the price of a company you control and profits from the drop.
    if (hostile && r.style === "shorter" && playerOwned.length && Math.random() < 0.2 * aggro) {
      const target = stockBy(pick(playerOwned));
      const drop = 0.03 + Math.random() * 0.03;
      r.cash = round2(r.cash + target.price * drop * 40);
      target.price = round2(target.price * (1 - drop));
      target.history[target.history.length - 1] = target.price;
      notes.push(["news.rivalShort", { rival: r.name, company: target.name, pct: Math.round(drop * 100) }]);
      return;
    }
    // Sniper: when you are close to owning a company, buys more shares than you to block it.
    if (hostile && r.style === "sniper" && Math.random() < 0.45 * aggro) {
      const near = alive.filter(x => !isOwned(x.name) && qtyOf(x.name) >= 30);
      if (near.length) {
        const target = pick(near);
        const have = r.holdings[target.name] ? r.holdings[target.name].qty : 0;
        const want = qtyOf(target.name) + 10 - have;
        const affordable = Math.floor(r.cash / (target.price * (1 + diff().fee)));
        const got = want > 0 ? rivalBuy(r, target, Math.min(want, affordable)) : 0;
        if (got) { notes.push(["news.rivalSnipes", { rival: r.name, qty: got, company: target.name, total: r.holdings[target.name].qty }]); return; }
      }
    }
    let s;
    if (r.style === "trend") s = alive.slice().sort((a, b) => dayChange(b) - dayChange(a))[0];
    else s = stockBy(pick(r.likes.filter(n => stockBy(n) && !stockBy(n).bankrupt)) || pick(alive).name) || pick(alive);
    if (!s || s.bankrupt) return;
    if (r.style === "cautious" && dayChange(s) < -3) return;
    const have = r.holdings[s.name] ? r.holdings[s.name].qty : 0;
    rivalBuy(r, s, Math.min(RIVAL_NORMAL_CAP - have, Math.floor(r.cash * (0.15 + Math.random() * 0.25) / s.price)));
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Job, mini-games, side hustles, personal loan
// ═══════════════════════════════════════════════════════════════════════════

function dailyWork(notes, tut) {
  state.lastSalary = 0; state.lastWorkTax = 0; state.incToday = 0;
  let gross = 0;
  const c = state.career, j = state.job;
  if (j) {
    const emp = stockBy(j.company);
    if (!emp || emp.bankrupt) {
      state.job = null; state.jobGap = JOB_LAYOFF_DAYS;
      notes.push(["news.jobLost", { company: j.company }]);
    } else if (j.startsIn > 0) {
      j.startsIn--;
    } else if (!isSunday()) {
      gross += salaryPerDay();
      c.xp += JOB_DAILY_XP; c.since++;
      if (c.since >= REVIEW_WORKDAYS) {
        c.since = 0;
        if (c.level < JOB_MAX_LEVEL) {
          const need = JOB_XP_NEEDED[c.level];
          if (c.xp >= need) {
            c.xp -= need; c.level++;
            notes.push(["news.promoted", { level: c.level, amount: salaryPerDay() }]);
            unlock("promoted");
            if (c.level === JOB_MAX_LEVEL) unlock("vp");
            sound("rankup");
          } else notes.push(["news.noPromo", { xp: c.xp, need }]);
        }
      }
      // Layoffs in a crisis: weaker companies fire sooner. Not if you control the company.
      if (!tut && inCrisis() && !isOwned(j.company) && Math.random() < (emp.reputation < 50 ? 0.05 : 0.025)) {
        state.job = null; state.jobGap = JOB_LAYOFF_DAYS;
        notes.push(["news.laidOff", { company: j.company }]);
        sound("bad");
      }
    }
    if (state.job) state.job.played = false;
  }
  gross += sideIncome();
  if (gross > 0) { const r = earn(gross); state.lastSalary = r.net; state.lastWorkTax = r.tax; }
  if (state.personalDebt > 0) state.personalDebt = round2(state.personalDebt * (1 + PERSONAL_LOAN_RATE));
}

function applyJob(company) {
  const s = stockBy(company);
  if (!s || s.bankrupt || !COMPANY_GAMES[company]) return;
  if (state.job && state.job.company === company) return;
  const gap = state.job ? JOB_SWITCH_DAYS : state.jobGap;
  state.job = { company, startsIn: gap, played: false };
  state.jobGap = 0;
  addNews([["news.hired", { level: state.career.level, company }]], "good");
  sound("goal");
  if (ui.modal && ui.modal.type === "jobs") ui.modal = null;
  save(); render();
}

function finishMiniGame(score) {
  if (!state.job) { ui.modal = null; return render(); }
  const tier = MG_TIERS.find(x => score >= x.min) || null;
  const bonus = tier ? Math.round(salaryPerDay() * tier.pay) : 0;
  const xp = tier ? tier.xp : 0;
  const paid = bonus ? earn(bonus) : { net: 0, tax: 0 };
  state.career.xp += xp;
  if (state.steps) state.steps.flags.mg = true;
  state.job.played = true;
  if (tier && tier.id === "perfect") unlock("perfect");
  if (score >= 0.5) goalProgress("minigame");
  sound(tier ? (tier.id === "perfect" || tier.id === "gold" ? "achievement" : "goal") : "error");
  if (tier && tier.id !== "bronze") confetti();
  ui.modal = { type: "mgresult", tier: tier ? tier.id : "none", bonus: paid.net, tax: paid.tax, xp, pct: Math.round(score * 100) };
  checkMilestones(totalValue());
  save(); render();
}

function buyHustle(id) {
  const h = HUSTLES.find(x => x.id === id);
  if (!h) return;
  if (hustleCount(id) >= HUSTLE_MAX) return msg(t("err.hustleMax"));
  const cost = hustleCost(h);
  if (state.cash < cost) return msg(t("err.hustleCash", { cost: fmtShort(cost) }));
  state.cash = round2(state.cash - cost);
  state.hustles[id] = hustleCount(id) + 1;
  addNews([["news.hustleBought", { hustle: id, amount: h.income }]], "good");
  sound("buy");
  save(); render();
}

function takeLoan() {
  if (state.personalDebt > 0) return msg(t("err.loanMax"));
  state.cash = round2(state.cash + PERSONAL_LOAN);
  state.personalDebt = PERSONAL_LOAN;
  addNews([["news.loanTaken", { amount: PERSONAL_LOAN, pct: String(PERSONAL_LOAN_RATE * 100) }]]);
  save(); render();
}
function repayLoan() {
  const pay = Math.min(state.cash, state.personalDebt);
  if (pay < 0.01) return msg(t("err.noCash"));
  state.cash = round2(state.cash - pay);
  state.personalDebt = round2(state.personalDebt - pay);
  if (state.personalDebt < 0.01) state.personalDebt = 0;
  addNews([["news.loanRepaid", { amount: pay, debt: state.personalDebt }]], "good");
  save(); render();
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
  return Math.max(0, Math.min(freeShares(s), Math.floor(state.cash / (s.price * (1 + feeRate())))));
}

function buyStock(name) {
  const s = stockBy(name);
  if (!s || s.bankrupt) return;
  const qty = readAmount(name);
  if (!qty) return msg(t("err.amount"));
  if (qty > freeShares(s)) return msg(t("err.noShares", { n: freeShares(s), company: name }));
  // Employee perk: 10% off the first few shares of your employer each day.
  const empQty = state.job && state.job.company === name && state.job.startsIn === 0 ? Math.max(0, Math.min(qty, EMPLOYEE_DISCOUNT_SHARES - state.today.emp)) : 0;
  const cost = s.price * qty - s.price * empQty * EMPLOYEE_DISCOUNT, fee = cost * feeRate();
  if (state.cash < cost + fee) return msg(t("err.cash", { n: maxBuyable(s) }));
  state.cash = round2(state.cash - cost - fee);
  state.today.emp += empQty;
  const h = state.holdings[name] || { qty: 0, avg: s.price };
  h.avg = (h.avg * h.qty + (cost + fee)) / (h.qty + qty);
  h.qty += qty;
  state.holdings[name] = h;
  logTrade(name, "buy", qty, s.price);
  unlock("first_buy");
  if (cost >= MIN_XP_TRADE_VALUE) {
    if (state.today.buyXp < MAX_BUY_XP_PER_DAY) { state.today.buyXp++; awardXP(XP_REWARDS.buy, null); }
    goalProgress("buys");
  }
  addNews([["news.bought", { qty, company: name, price: s.price, fee }]]);
  sound("buy");
  afterAction();
}

function sellStock(name) {
  const s = stockBy(name);
  const qty = readAmount(name);
  const h = state.holdings[name];
  if (!h || !qty) return msg(t("err.amount"));
  if (qty > h.qty) return msg(t("err.notEnoughShares", { n: h.qty, company: name }));
  const gross = s.price * qty, fee = gross * feeRate();
  const profit = gross - fee - h.avg * qty;
  state.cash = round2(state.cash + gross - fee);
  h.qty -= qty;
  if (h.qty <= 0) delete state.holdings[name];
  logTrade(name, "sell", qty, s.price);
  if (profit > 0 && state.steps) state.steps.flags.profit = true;
  if (profit > 0 && gross >= MIN_XP_TRADE_VALUE && state.today.sellXp < MAX_SELL_XP_PER_DAY) {
    state.today.sellXp++;
    awardXP(XP_REWARDS.sell_profit, "xp.reason.profit");
  }
  addNews([["news.sold", { qty, company: name, price: s.price, signed: profit }]], profit >= 0 ? "good" : "bad");
  sound("sell");
  afterAction();
}

function openShort(name) {
  const s = stockBy(name);
  if (!s || s.bankrupt) return;
  if (isOwned(name)) return msg(t("err.shortOwn"));
  const qty = readAmount(name);
  if (!qty) return msg(t("err.amount"));
  const value = s.price * qty, margin = value * SHORT_MARGIN, fee = value * feeRate();
  if (state.cash < margin + fee) return msg(t("err.shortCash", { amount: fmtShort(margin + fee) }));
  state.cash = round2(state.cash - margin - fee);
  const sh = state.shorts[name] || { qty: 0, entry: s.price, margin: 0 };
  sh.entry = (sh.entry * sh.qty + s.price * qty) / (sh.qty + qty);
  sh.qty += qty; sh.margin += margin;
  state.shorts[name] = sh;
  logTrade(name, "short", qty, s.price);
  goalProgress("short");
  addNews([["news.shortOpen", { qty, company: name, price: s.price, margin }]]);
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
  addNews([["news.shortClose", { company: name, signed: pnl }]], pnl >= 0 ? "good" : "bad");
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
  if (s.companyCash < cost) { msg(t("err.companyCash", { company: s.name, cash: fmtShort(s.companyCash), cost: fmtShort(cost) })); return false; }
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
        addNews([["news.marketing", { company: s.name }]], "good");
      }
      break;
    case "employees":
      if ((done = spend(s, ACTION_COSTS.employees))) {
        s.employees += 100; s.volatility = Math.max(0.01, s.volatility - 0.003); ceoDelta(s, { leadership: 1 });
        addNews([["news.employees", { company: s.name }]], "good");
      }
      break;
    case "research":
      if ((done = spend(s, ACTION_COSTS.research))) {
        s.research = clamp(s.research + 8, 0, 100); s.price = round2(s.price * 1.03); ceoDelta(s, { innovation: 1 });
        addNews([["news.research", { company: s.name }]], "good");
      }
      break;
    case "risk": {
      const prof = s.custom ? D.DEFAULT_RISK : D.RISK_PROFILES[s.name];
      if (!prof) return msg(t("err.noRisk", { company: s.name }));
      if (!(done = spend(s, ACTION_COSTS.risk))) break;
      const ok = Math.random() < clamp(prof.chance + s.ceo.innovation / 600, 0.05, 0.88);
      s.reputation = clamp(s.reputation + (ok ? 5 : -6), 0, 100);
      s.price = round2(s.price * (ok ? prof.up : prof.down));
      ceoDelta(s, ok ? { innovation: 2 } : { reliability: -2 });
      addNews([[ok ? "news.riskOk" : "news.riskFail", { company: s.name }]], ok ? "good" : "bad");
      if (ok) { awardXP(XP_REWARDS.risk_success, "xp.reason.risk"); unlock("risk_win"); sound("buy"); } else sound("bad");
      break;
    }
    case "ceo": {
      if (!(done = spend(s, ACTION_COSTS.ceo))) break;
      const c = randomCeo();
      s.playerCEO = false; s.ceo = c;
      s.reputation = clamp(s.reputation + Math.floor((c.reliability - 50) / 12), 0, 100);
      addNews([["news.newCeo", { company: s.name, ceo: c.name }]]);
      break;
    }
    case "autopilot": s.autopilot = !s.autopilot; done = false; save(); render(); return;
    case "selfceo":
      if (qtyOf(s.name) < CEO_THRESHOLD) return msg(t("err.needCeo", { n: CEO_THRESHOLD }));
      if (s.playerCEO) return;
      becomeCEO(s); done = true;
      break;
    case "factory":
      if ((done = spend(s, D.factoryCost(s.factories)))) {
        const income = D.factoryUnit(s.factories);
        s.factories++; s.employees += 120; s.price = round2(s.price * 1.05); ceoDelta(s, { leadership: 1, reliability: 1 });
        addNews([["news.factory", { company: s.name, income }]], "good");
      }
      break;
    case "product": {
      if (!(done = spend(s, ACTION_COSTS.product))) break;
      const pname = pick(D.PRODUCT_IDEAS[s.name] || D.GENERIC_PRODUCTS);
      const chance = clamp(0.2 + s.research / 280 + s.reputation / 450 + s.ceo.innovation / 550 + synergyBonus(s.name, "product"), 0.08, 0.85);
      const ok = Math.random() < chance;
      s.products.push({ name: pname, result: ok ? "Hit" : "Flop" });
      if (s.products.length > 20) s.products.shift();
      s.reputation = clamp(s.reputation + (ok ? 10 : -7), 0, 100);
      s.price = round2(s.price * (ok ? 1.16 : 0.93));
      ceoDelta(s, ok ? { innovation: 2 } : { reliability: -1 });
      addNews([[ok ? "news.productHit" : "news.productFlop", { company: s.name, product: pname }]], ok ? "good" : "bad");
      if (ok) { awardXP(XP_REWARDS.product_hit, "xp.reason.product"); unlock("hit_product"); sound("buy"); } else sound("bad");
      break;
    }
    case "loan":
      if (s.debt + LOAN_AMOUNT > MAX_DEBT) return msg(t("err.maxDebt", { amount: fmtShort(MAX_DEBT) }));
      s.companyCash += LOAN_AMOUNT; s.debt += LOAN_AMOUNT; s.reputation = clamp(s.reputation - 3, 0, 100);
      addNews([["news.loan", { company: s.name, loan: LOAN_AMOUNT, n: loanCount(s), max: MAX_LOANS }]]);
      done = true;
      break;
    case "repay": {
      if (s.debt <= 0) return msg(t("err.noDebt"));
      const pay = Math.min(s.debt, s.companyCash, 50000);
      if (pay <= 0) return msg(t("err.noCashRepay", { company: s.name }));
      s.companyCash = round2(s.companyCash - pay); s.debt = round2(s.debt - pay); s.reputation = clamp(s.reputation + 1, 0, 100);
      addNews([["news.repay", { company: s.name, amount: pay, debt: s.debt }]], "good");
      if (s.debt <= 0) unlock("no_debt");
      done = true;
      break;
    }
    case "inject": {
      const amount = Math.min(state.cash, arg === "all" ? state.cash : Number(arg));
      if (amount < 1) return msg(t("err.noCash"));
      state.cash = round2(state.cash - amount); s.companyCash = round2(s.companyCash + amount);
      addNews([["news.inject", { company: s.name, amount }]]);
      done = true;
      break;
    }
    case "dividend":
      s.dividendRate = Number(arg);
      addNews([["news.dividend", { company: s.name, pct: s.dividendRate }]]);
      break;
    case "market": done = openMarket(s, arg); break;
    case "takeover": done = takeover(s); break;
    case "war": done = startWar(s, arg); break;
  }
  if (done && action !== "inject" && action !== "dividend") {
    goalProgress("actions");
    if (state.steps) state.steps.flags.improve = true;
  }
  afterAction();
}

function openMarket(s, market) {
  if (s.markets.includes(market)) { msg(t("err.marketActive", { company: s.name, market: marketName(market) })); return false; }
  if (!spend(s, MARKET_COSTS[market])) return false;
  if (Math.random() < MARKET_FAIL_CHANCE[market]) {
    s.reputation = clamp(s.reputation - 10, 0, 100); s.price = round2(s.price * 0.95); ceoDelta(s, { reliability: -2 });
    addNews([["news.marketFail", { company: s.name, market }]], "bad");
    sound("bad");
  } else {
    s.markets.push(market);
    s.reputation = clamp(s.reputation + 7, 0, 100); s.price = round2(s.price * 1.07); ceoDelta(s, { leadership: 1 });
    addNews([["news.marketOpen", { company: s.name, market, pct: MARKET_INCOME_BONUS[market] * 100 }]], "good");
    if (MARKETS.every(m => s.markets.includes(m))) unlock("all_markets");
  }
  return true;
}

function takeover(buyer) {
  const target = stockBy(ui.takeoverTarget);
  if (!target || target.bankrupt || target.name === buyer.name || isOwned(target.name)) { msg(t("err.target")); return false; }
  const cost = round2(target.price * 100 * 1.25);
  if (buyer.companyCash < cost) { msg(t("err.takeoverCash", { cost: fmtShort(cost), company: buyer.name, cash: fmtShort(buyer.companyCash) })); return false; }
  const ok = Math.random() < clamp((buyer.reputation + buyer.ceo.leadership) / 250, 0.15, 0.78);
  if (ok) {
    buyer.companyCash = round2(buyer.companyCash - cost);
    buyer.reputation = clamp(buyer.reputation + 5, 0, 100); buyer.price = round2(buyer.price * 1.04);
    target.controlledBy = buyer.name;
    addNews([["news.takeoverOk", { buyer: buyer.name, company: target.name }]], "good");
    awardXP(XP_REWARDS.takeover, "xp.reason.takeover");
    unlock("takeover_win");
    ui.takeoverTarget = "";
    sound("achievement");
  } else {
    const lost = round2(cost * 0.2);
    buyer.companyCash = round2(buyer.companyCash - lost);
    buyer.reputation = clamp(buyer.reputation - 9, 0, 100); buyer.price = round2(buyer.price * 0.91);
    addNews([["news.takeoverFail", { buyer: buyer.name, company: target.name, amount: lost }]], "bad");
    sound("bad");
  }
  return true;
}

function startWar(att, type) {
  const def = stockBy(ui.warTarget);
  if (!def || def.bankrupt || isOwned(def.name)) { msg(t("err.warTarget")); return false; }
  if (att.lastWarDay === state.day) { msg(t("err.warToday", { company: att.name })); return false; }
  if (!spend(att, WAR_COSTS[type])) return false;
  att.lastWarDay = state.day;
  if (type === "price") { att.price = round2(att.price * 0.99); def.price = round2(def.price * 0.95); def.reputation = clamp(def.reputation - 2, 0, 100); }
  else if (type === "ads") { att.price = round2(att.price * 1.03); att.reputation = clamp(att.reputation + 4, 0, 100); def.price = round2(def.price * 0.98); def.reputation = clamp(def.reputation - 4, 0, 100); }
  else { const n = Math.min(80, def.employees); att.employees += n; def.employees -= n; att.price = round2(att.price * 1.02); def.price = round2(def.price * 0.98); }
  addNews([["news.war", { company: att.name, type, target: def.name }]]);
  unlock("war_started");
  return true;
}

function resolveChoice(i) {
  const pc = state.pendingChoice;
  if (!pc) return;
  state.tips.seen.choice = true;
  const ev = D.CHOICE_EVENTS.find(e => e.id === pc.id);
  const s = stockBy(pc.company);
  const opt = ev && ev.options[i];
  if (!opt || !s || s.bankrupt) { state.pendingChoice = null; ui.modal = null; renderModal(); return; }
  if (opt.pay && s.companyCash < opt.pay) return msg(t("err.choiceCash"));
  if (opt.pay) s.companyCash = round2(s.companyCash - opt.pay);
  addNews([opt.run(s)]);
  s.history[s.history.length - 1] = s.price;
  state.pendingChoice = null;
  ui.modal = null;
  afterAction();
}

function foundCompany() {
  if (state.ipoDone) return;
  if (totalValue() < IPO_THRESHOLD) return msg(t("err.ipoValue", { amount: fmtShort(IPO_THRESHOLD) }));
  const cost = IPO_SHARES * IPO_PRICE * 2;
  if (state.cash < cost) return msg(t("err.ipoCash", { amount: fmtShort(cost) }));
  const name = ui.ipoName.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 16) return msg(t("err.ipoName"));
  if (state.stocks.some(s => s.name.toLowerCase() === name.toLowerCase())) return msg(t("err.ipoTaken"));
  state.cash = round2(state.cash - cost);
  const s = makeStock({ name, sector: ui.ipoSector, price: IPO_PRICE, volatility: 0.05, reputation: 60, employees: 800, research: 55, markets: ["Europa"], companyCash: IPO_SHARES * IPO_PRICE, custom: true, ceo: { name: "", leadership: 60, innovation: 60, reliability: 60, isPlayer: true } });
  s.playerCEO = true;
  state.stocks.push(s);
  state.holdings[name] = { qty: IPO_SHARES, avg: IPO_PRICE };
  state.qtyPrev[name] = IPO_SHARES;
  state.rewarded.own[name] = true; state.rewarded.ceo[name] = true;
  state.ipoDone = true;
  logTrade(name, "buy", IPO_SHARES, IPO_PRICE);
  addNews([["news.ipo", { company: name }]], "good");
  unlock("ipo");
  confetti(true);
  ui.modal = null; ui.selected = name; ui.tab = "company";
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

function msg(text) { toast(text, "warn"); sound("error"); }

// ═══════════════════════════════════════════════════════════════════════════
// Save / load
// ═══════════════════════════════════════════════════════════════════════════

function save() {
  if (!state || ui.placeholder) return;
  if (state.gameOver && diff().permadeath) return;
  storageSet(SAVE_KEY, JSON.stringify(state));
}
const loadSave = () => migrate(safeParse(storageGet(SAVE_KEY)));

function exportSave() {
  const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `investor-simulator-day-${state.day}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importSave(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const s = migrate(safeParse(reader.result));
    if (!s) return msg(t("err.badSave"));
    state = s; ui.placeholder = false; ui.tutorial = null;
    ui.selected = ownedNames()[0] || null; ui.tab = "market"; ui.modal = null;
    save(); toast(t("save.loaded")); render();
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
      if (document.hidden || ui.modal || !state || state.gameOver || state.gameWon || ui.tutorial) return;
      advanceDay();
    }, SPEEDS[i]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Confetti (drawn in code) and toasts
// ═══════════════════════════════════════════════════════════════════════════

const confettiCanvas = document.getElementById("confetti");
let confettiParts = [], confettiRunning = false;
function confetti(big = false) {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const w = window.innerWidth, h = window.innerHeight;
  const colors = ["#7c3aed", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a78bfa"];
  for (let i = 0; i < (big ? 160 : 70); i++) {
    confettiParts.push({ x: w / 2 + (Math.random() - 0.5) * w * 0.4, y: h * 0.35, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 12 - 4,
      r: 3 + Math.random() * 4, c: pick(colors), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, life: 0 });
  }
  if (!confettiRunning) { confettiRunning = true; requestAnimationFrame(confettiStep); }
}
function confettiStep() {
  const dpr = window.devicePixelRatio || 1, w = window.innerWidth, h = window.innerHeight;
  if (confettiCanvas.width !== w * dpr || confettiCanvas.height !== h * dpr) { confettiCanvas.width = w * dpr; confettiCanvas.height = h * dpr; }
  const ctx = confettiCanvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  confettiParts.forEach(p => {
    p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life++;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - p.life / 140);
    ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore();
  });
  confettiParts = confettiParts.filter(p => p.y < h + 20 && p.life < 140);
  if (confettiParts.length) requestAnimationFrame(confettiStep);
  else { confettiRunning = false; ctx.clearRect(0, 0, w, h); }
}

const toastRoot = document.getElementById("toasts");
function toast(text, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`; el.textContent = text;
  toastRoot.appendChild(el);
  while (toastRoot.children.length > 3) toastRoot.firstChild.remove();
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, kind === "big" ? 3500 : 2600);
}

// ═══════════════════════════════════════════════════════════════════════════
// Tutorial
// ═══════════════════════════════════════════════════════════════════════════
// Each step: target (CSS selector to highlight), done() → true moves on. Steps without done() show a "Next" button.

const TUT = "EuroBank";            // the company you take over
const TUT_TRADE = "FreshMart";     // the share you trade for a quick profit
const TUT_TRADE_QTY = 10;
const TUTORIAL_STEPS = [
  { id: "welcome" },
  // 1. Trade
  { id: "news", target: () => `#newsrow .news`, tab: "market" },
  { id: "buy", target: () => `.stock[data-name="${TUT_TRADE}"]`, tab: "market", done: () => qtyOf(TUT_TRADE) >= TUT_TRADE_QTY },
  { id: "nextday", target: () => `.next`, done: () => state.day >= 2 },
  { id: "profit", target: () => `[data-act="tab"][data-arg="portfolio"]`, done: () => ui.tab === "portfolio" },
  { id: "gain", target: () => `#main .card` },
  { id: "sell", target: () => `.stock[data-name="${TUT_TRADE}"]`, tab: "market", done: () => qtyOf(TUT_TRADE) === 0 },
  // 2. Work
  { id: "work", target: () => `[data-act="tab"][data-arg="work"]`, done: () => ui.tab === "work" },
  { id: "job", target: () => `#job-card`, tab: "work", done: () => !!state.job },
  { id: "overtime", target: () => `[data-act="overtime"]`, tab: "work", done: () => !!state.job && state.job.played },
  // 3. Own
  { id: "own", target: () => `.stock[data-name="${TUT}"]`, tab: "market", done: () => qtyOf(TUT) >= OWNERSHIP_THRESHOLD },
  { id: "owner", target: () => `[data-act="tab"][data-arg="company"]`, done: () => ui.tab === "company" },
  { id: "dividend", target: () => `#dividend-row`, tab: "company", done: () => stockBy(TUT).dividendRate === 50 },
  { id: "factory", target: () => `#company-actions`, tab: "company", done: () => stockBy(TUT).factories >= 1 },
  { id: "payday", target: () => `.next`, done: () => state.day >= 3 },
  { id: "income", target: () => `#newsrow .mini` },
  // 4. The daily routine
  { id: "done" },
];

function tutParams() {
  const h = state.holdings[TUT_TRADE], tr = stockBy(TUT_TRADE);
  return { company: TUT, trade: TUT_TRADE, n: OWNERSHIP_THRESHOLD, qty: TUT_TRADE_QTY,
    gain: fmtShort(h ? (tr.price - h.avg) * h.qty : 0), cost: fmtShort(D.factoryCost(stockBy(TUT).factories)) };
}
function tutorialStep() { return ui.tutorial ? TUTORIAL_STEPS[ui.tutorial.step] : null; }
function tutorialTick() {
  const st = tutorialStep();
  if (!st || !st.done || !st.done()) return;
  ui.tutorial.step++;
  sound("goal");
  const next = tutorialStep();
  if (next && next.tab && ui.tab !== next.tab) ui.tab = next.tab;
  if (next && next.id === "owner") ui.selected = TUT;
}
function renderTutorial() {
  const box = $("tutorial");
  document.querySelectorAll(".tut-target").forEach(el => el.classList.remove("tut-target"));
  const st = tutorialStep();
  if (!st) { box.hidden = true; return; }
  const n = TUTORIAL_STEPS.indexOf(st);
  const last = n === TUTORIAL_STEPS.length - 1;
  box.hidden = false;
  box.innerHTML = `<div class="tut-top"><span class="label">🎓 ${t("tut.title")} • ${n + 1}/${TUTORIAL_STEPS.length}</span>
      <button class="x" data-act="tut-skip" aria-label="${esc(t("tut.skip"))}">✕</button></div>
    <h3>${t(`tut.${st.id}.title`, tutParams())}</h3>
    <p>${t(`tut.${st.id}.text`, tutParams())}</p>
    ${last ? `<ol class="tut-loop">${[1, 2, 3, 4, 5].map(k => `<li>${t(`tut.loop.${k}`)}</li>`).join("")}</ol>` : ""}
    <div class="btn-row">
      ${last ? btn(t("tut.finish"), "tut-finish", { color: "#22c55e", cls: "lg" })
        : st.done ? `<span class="tut-wait">${t("tut.waiting")}</span>` : btn(t("tut.next"), "tut-next", { color: "#a78bfa" })}
    </div>`;
  if (st.target) {
    const el = document.querySelector(st.target());
    if (el) {
      el.classList.add("tut-target");
      if (ui.tutorial.scrolledTo !== n) {
        ui.tutorial.scrolledTo = n;
        requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "center" }));
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);

function sparkline(hist, n = 30) {
  const h = hist.slice(-n);
  if (h.length < 2) return `<svg class="spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"></svg>`;
  const min = Math.min(...h), max = Math.max(...h), range = max - min || 1;
  const pts = h.map((v, i) => `${(i / (h.length - 1) * 120).toFixed(1)},${(36 - ((v - min) / range) * 32 - 2).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${h[h.length - 1] >= h[0] ? "#22c55e" : "#ef4444"}" stroke-width="1.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}
const badge = (txt, c = "#7c3aed") => `<span class="badge" style="--c:${c}">${txt}</span>`;
function statBar(label, value, color, max = 100) {
  return `<div class="statbar"><div class="statbar-top"><span>${label}</span><span>${Math.round(value)}/${max}</span></div><div class="bar"><div style="width:${clamp(value / max * 100, 0, 100)}%;background:${color}"></div></div></div>`;
}
function btn(label, act, { arg = "", color = "#7c3aed", disabled = false, cls = "", title = "", id = "" } = {}) {
  return `<button class="btn ${cls}" style="--c:${color}" data-act="${act}" data-arg="${esc(arg)}" ${id ? `id="${id}"` : ""} ${disabled ? "disabled" : ""} ${title ? `title="${esc(title)}"` : ""}>${label}</button>`;
}
function langSelect() {
  return `<select class="input lang-select" data-lang aria-label="${esc(t("settings.language"))}">${Object.entries(I18N.languages).map(([k, l]) => `<option value="${k}" ${I18N.lang === k ? "selected" : ""}>${l.flag} ${l.name}</option>`).join("")}</select>`;
}

function renderHeader() {
  document.title = t("app.title");
  $("brand-title").textContent = t("app.title");
  const status = state.depression ? t("status.depression", { n: state.depressionDays }) : state.recession ? t("status.recession", { n: state.recessionDays }) : t("status.normal");
  const col = state.depression ? "#ef4444" : state.recession ? "#f97316" : "#22c55e";
  $("dayline").innerHTML = `${t("day", { n: state.day })} • <span style="color:${col}">${status}</span> • ${esc(ui.tutorial ? t("tut.title") : t(`diff.${state.difficulty}.label`))}`;
  const tv = totalValue();
  $("stats").innerHTML = [[t("stat.cash"), fmtShort(state.cash), "#22c55e"], [t("stat.portfolio"), fmtShort(longValue() + shortsValue()), "#e2e8f0"], [t("stat.total"), fmtShort(tv), "#a78bfa"]]
    .map(([l, v, c]) => `<div class="card stat"><span class="label">${l}</span><strong style="color:${c}">${v}</strong></div>`).join("");
  const p = Math.min(100, tv / WIN_TARGET * 100);
  $("progress").innerHTML = `<div class="progress-top"><span>${t("goal.win")}</span><span>${I18N.num(p, 2)}%</span></div><div class="bar thin"><div style="width:${p}%;background:#7c3aed"></div></div>`;
  const n = state.news[0], g = state.goal;
  $("newsrow").innerHTML = `
    <div class="card news ${n ? n.kind : ""}"><span class="kicker">${t("news.title")}</span><div>${n ? esc(I18N.newsText(n)) : ""}</div></div>
    ${state.lastDividend > 0 ? `<div class="card news good mini"><span class="kicker">${t("dividend")}</span><strong>+${fmtShort(state.lastDividend)}</strong>${state.lastDivTax > 0 ? `<span class="muted small-t">${t("tax.paid", { amount: fmtShort(state.lastDivTax) })}</span>` : ""}</div>` : ""}
    ${state.lastSalary > 0 ? `<div class="card news good mini"><span class="kicker">${t("job.card")}</span><strong>+${fmtShort(state.lastSalary)}</strong>${state.lastWorkTax > 0 ? `<span class="muted small-t">${t("tax.paid", { amount: fmtShort(state.lastWorkTax) })}</span>` : ""}</div>` : ""}
    ${renderTip()}${renderSteps()}
    ${g && !ui.tutorial ? `<div class="card news goal ${g.done ? "done" : ""}"><span class="kicker">🎯 ${t("goal.daily")} ${g.done ? "✓" : `(+${g.xp} XP)`}</span><div>${esc(goalText(g))}${!g.done && ["buys", "actions"].includes(g.type) ? ` — ${g.progress}/${g.target}` : ""}</div></div>` : ""}`;
  $("controlbar").innerHTML = `
    <button class="next" data-act="next" ${state.gameOver || state.gameWon ? "disabled" : ""}>${t("nextDay")}</button>
    <div class="speed" role="group" aria-label="${esc(t("autoplay"))}">
      ${SPEED_LABELS.map((l, i) => `<button class="${ui.speed === i ? "on" : ""}" data-act="speed" data-arg="${i}" aria-pressed="${ui.speed === i}" ${ui.tutorial && i ? "disabled" : ""} title="${esc(i ? t("autoplay.speed", { speed: l }) : t("autoplay.pause"))}">${l}</button>`).join("")}
    </div>`;
  $("foot").innerHTML = `<a href="online.html">🌐 ${t("menu.online")}</a> • ${t("footer.rules")}`;
}

function renderTip() {
  const id = state.tips.queue[0];
  if (!id || ui.tutorial) return "";
  return `<div class="card news tip"><span class="kicker">💡 ${t("tip.title")}</span><div>${t(`tip.${id}`)}</div>
    <div class="mt8">${btn(t("tip.ok"), "tip-ok", { color: "#f59e0b", cls: "small" })}</div></div>`;
}
function renderSteps() {
  const st = state.steps;
  if (!st || ui.tutorial) return "";
  const next = FIRST_STEPS.find(id => !st.done[id]);
  const n = FIRST_STEPS.filter(id => st.done[id]).length;
  return `<div class="card news steps"><span class="kicker">🧭 ${t("steps.title")} ${n}/${FIRST_STEPS.length} (+${FIRST_STEP_XP} XP)</span>
    ${FIRST_STEPS.map(id => `<div class="step ${st.done[id] ? "ok" : id === next ? "now" : ""}">${st.done[id] ? "✓" : id === next ? "▸" : "•"} ${t(`steps.${id}`, { n: OWNERSHIP_THRESHOLD })}</div>`).join("")}</div>`;
}

function renderTabs() {
  const owned = ownedNames();
  const tabs = [["market", `📊 ${t("tab.market")}`], ["portfolio", `💼 ${t("tab.portfolio")}`],
    ["company", `🏢 ${t("tab.companies")}${owned.length ? ` (${owned.length})` : ""}`],
    ["work", `💼 ${t("tab.work")}${(canWorkToday() && !state.job.played) || !state.job ? `<span class="tab-dot"></span>` : ""}`], ["rivals", `🦈 ${t("tab.rivals")}`],
    ["investor", `🎖️ ${t("tab.investor")}`], ["achievements", `🏅 ${t("tab.achievements")}`], ["settings", `⚙️ ${t("tab.settings")}`]];
  $("tabs").innerHTML = tabs.map(([k, l]) => {
    const dis = k === "company" && !owned.length;
    return `<button class="tab ${ui.tab === k ? "on" : ""}" data-act="tab" data-arg="${k}" ${dis ? `disabled title="${esc(t("company.none"))}"` : ""}>${l}</button>`;
  }).join("") + `<button class="tab" data-act="glossary" aria-label="${esc(t("glossary.title"))}" title="${esc(t("glossary.title"))}">❓</button>`;
}

function stockMatchesFilter(s) {
  const f = ui.marketFilter;
  if (f === "all") return true;
  if (f === "mine") return qtyOf(s.name) > 0 || !!state.shorts[s.name] || isOwned(s.name) || state.alerts.some(a => a.name === s.name);
  return s.sector === f;
}

function renderMarket() {
  const fr = feeRate();
  const flashNow = ui.flashDay === state.day && state.day > 1;
  ui.flashDay = 0;
  const sectors = [...new Set(state.stocks.map(s => s.sector))];
  const filters = `<div class="chips filter">${[["all", t("filter.all")], ["mine", t("filter.mine")], ...sectors.map(s => [s, sectorName(s)])]
    .map(([k, l]) => `<button class="chip ${ui.marketFilter === k ? "on" : ""}" data-act="filter" data-arg="${k}">${esc(l)}</button>`).join("")}</div>`;
  const list = state.stocks.filter(stockMatchesFilter);
  const cards = list.map(s => {
    const q = qtyOf(s.name);
    const ch = dayChange(s), up = ch >= 0;
    const flash = flashNow && Math.abs(ch) > 0.01 ? (up ? "flash-up" : "flash-down") : "";
    const owned = isOwned(s.name);
    const sh = state.shorts[s.name];
    const rq = maxRivalQty(s.name);
    const nAlerts = state.alerts.filter(a => a.name === s.name).length;
    const hint = q >= CEO_THRESHOLD ? t("hint.ceo") : q >= OWNERSHIP_THRESHOLD ? t("hint.owner", { n: CEO_THRESHOLD - q }) : q > 0 ? t("hint.more", { n: OWNERSHIP_THRESHOLD - q }) : t("hint.start", { n: OWNERSHIP_THRESHOLD });
    return `<article class="stock ${s.bankrupt ? "dead" : ""}" data-name="${esc(s.name)}">
      <div class="stock-top">
        <div class="stock-id">
          <button class="linkish" data-act="chart" data-arg="${esc(s.name)}" title="${esc(t("chart.big"))}">${esc(s.name)} <span aria-hidden="true">🔍</span></button>
          <div class="sub">${s.bankrupt ? `💀 ${t("bankrupt")}` : `${companyLevel(s)} • ${sectorName(s.sector)} • ${s.markets.map(marketName).join(", ")}`}</div>
          ${s.bankrupt ? "" : `<div class="sub">${t("stock.info", { n: I18N.num(s.shares), pct: s.dividendRate })}${q ? ` • ${t("stock.stake", { pct: I18N.num(stakePct(s), stakePct(s) < 10 ? 1 : 0) })}` : ""}</div>`}
          <div class="badges">
            ${owned ? badge(t("badge.owned")) : ""}${s.playerCEO ? badge("CEO", "#f59e0b") : ""}
            ${s.controlledBy ? badge(t("badge.via", { company: esc(s.controlledBy) }), "#6366f1") : ""}
            ${sh ? badge(`${t("short")} ${sh.qty}`, "#ec4899") : ""}
            ${state.lostTo[s.name] ? badge(t("badge.lost"), "#ef4444") : ""}
          </div>
        </div>
        <div class="stock-price">
          <div class="price ${flash}">€${fmt(s.price)}</div>
          <div class="chg" style="color:${up ? "#22c55e" : "#ef4444"}">${up ? "▲" : "▼"} ${pct(Math.abs(ch))}% ${t("today")}</div>
          <button class="spark-btn" data-act="chart" data-arg="${esc(s.name)}" aria-label="${esc(t("chart.big"))}">${sparkline(s.history)}</button>
        </div>
      </div>
      ${s.bankrupt ? "" : `
      <div class="trade-row">
        <input class="input" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="${esc(t("amount"))}" autocomplete="off"
          data-amount="${esc(s.name)}" data-focuskey="amt-${esc(s.name)}" value="${esc(ui.amounts[s.name] || "")}" aria-label="${esc(t("amount"))} ${esc(s.name)}">
        ${btn("Max", "max", { arg: s.name, color: "#64748b", cls: "small" })}
        <button class="btn small bell ${nAlerts ? "active" : ""}" style="--c:#f59e0b" data-act="alerts" data-arg="${esc(s.name)}" aria-label="${esc(t("alert.title"))}" title="${esc(t("alert.title"))}">🔔${nAlerts ? `<span class="count">${nAlerts}</span>` : ""}</button>
      </div>
      <div class="trade-btns">
        ${btn(t("buy"), "buy", { arg: s.name, color: "#22c55e" })}
        ${btn(`${t("sell")} (${q})`, "sell", { arg: s.name, color: "#ef4444", disabled: q === 0 })}
        ${sh ? btn(t("short.close"), "cover", { arg: s.name, color: "#ec4899" })
             : btn(t("short"), "short", { arg: s.name, color: "#ec4899", disabled: owned, title: owned ? t("err.shortOwn") : t("short.help") })}
      </div>
      <div class="hint">${hint}${rq ? ` • ${t("hint.rivals", { n: rq })}` : ""}</div>`}
    </article>`;
  }).join("");
  return `<p class="fee-note">${t("fee.note", { fee: I18N.num(fr * 100, 2), rank: esc(rankName(rankIndex())) })}</p>
    ${filters}
    <div class="grid">${cards || `<div class="card muted">${t("filter.empty")}</div>`}</div>`;
}

function renderPortfolio() {
  const longs = state.stocks.filter(s => qtyOf(s.name) > 0).map(s => {
    const h = state.holdings[s.name];
    const value = h.qty * s.price, pl = value - h.avg * h.qty;
    const p = h.avg ? pl / (h.avg * h.qty) * 100 : 0;
    return `<div class="card"><div class="row-between">
        <div><strong>${esc(s.name)}</strong>${s.bankrupt ? " 💀" : ""}<div class="muted">${t("portfolio.line", { n: h.qty, price: I18N.money(h.avg) })}</div></div>
        <div class="right"><strong>${fmtShort(value)}</strong>
          <div style="color:${pl >= 0 ? "#22c55e" : "#ef4444"}" class="small-t">${pl >= 0 ? "▲" : "▼"} ${fmtShort(Math.abs(pl))} (${pl >= 0 ? "+" : ""}${pct(p)}%)</div></div>
      </div>
      <button class="spark-btn wide" data-act="chart" data-arg="${esc(s.name)}" aria-label="${esc(t("chart.big"))}">${sparkline(s.history)}</button></div>`;
  }).join("");
  const shorts = Object.keys(state.shorts).map(n => {
    const sh = state.shorts[n], s = stockBy(n), pnl = (sh.entry - s.price) * sh.qty;
    return `<div class="card"><div class="row-between">
        <div><strong>${esc(n)}</strong> ${badge(t("short"), "#ec4899")}<div class="muted">${t("short.line", { n: sh.qty, price: I18N.money(sh.entry), margin: fmtShort(sh.margin) })}</div></div>
        <div class="right"><strong style="color:${pnl >= 0 ? "#22c55e" : "#ef4444"}">${pnl >= 0 ? "+" : ""}${fmtShort(pnl)}</strong><div class="muted">${t("short.fee", { amount: fmtShort(sh.qty * s.price * SHORT_DAILY_FEE) })}</div></div>
      </div><div class="mt8">${btn(t("short.close"), "cover", { arg: n, color: "#ec4899" })}</div></div>`;
  }).join("");
  const alerts = state.alerts.length ? `<div class="card span-all"><span class="label">🔔 ${t("alert.title")}</span>
      ${state.alerts.map(a => `<div class="sum-row"><span>${esc(a.name)} ${a.dir === "above" ? "≥" : "≤"} ${I18N.money(a.price)} <span class="muted small-t">(${t("alert.now", { price: I18N.money(stockBy(a.name).price) })})</span></span>
        <button class="btn small" style="--c:#ef4444" data-act="alert-del" data-arg="${a.id}" aria-label="${esc(t("delete"))}">✕</button></div>`).join("")}</div>` : "";
  const tv = totalValue(), ipoCost = IPO_SHARES * IPO_PRICE * 2;
  const ipo = state.ipoDone
    ? `<div class="card"><span class="label">🔔 ${t("ipo.title")}</span><div class="muted">${t("ipo.done")}</div></div>`
    : `<div class="card"><span class="label">🔔 ${t("ipo.title")}</span>
        <div class="muted">${t("ipo.text", { threshold: fmtShort(IPO_THRESHOLD), cost: fmtShort(ipoCost), n: IPO_SHARES })}</div>
        <div class="mt8">${btn(t("ipo.button"), "ipo", { color: "#f59e0b", disabled: tv < IPO_THRESHOLD })}</div>
        ${tv < IPO_THRESHOLD ? `<div class="bar thin mt8"><div style="width:${Math.min(100, tv / IPO_THRESHOLD * 100)}%;background:#f59e0b"></div></div>` : ""}</div>`;
  return `<div class="grid">
    ${longs || `<div class="card muted">${t("portfolio.empty")}</div>`}
    ${shorts}${alerts}
    <div class="card span-all">
      ${[[t("stat.cash"), state.cash], [t("portfolio.shares"), longValue()], [t("portfolio.shorts"), shortsValue()], [t("stat.total"), tv]].map(([k, v], i, a) =>
        `<div class="sum-row ${i === a.length - 1 ? "total" : ""}"><span>${k}</span><span>${fmtShort(v)}</span></div>`).join("")}
    </div>
    <div class="span-all">${ipo}</div>
  </div>`;
}

function renderCompany() {
  const owned = ownedNames();
  if (!owned.length) return `<div class="card muted">${t("company.none")}</div>`;
  if (!ui.selected || !owned.includes(ui.selected)) ui.selected = owned[0];
  const s = stockBy(ui.selected);
  const q = qtyOf(s.name), profit = calcProfit(s);
  const syn = activeSynergies().filter(sy => sy.global || sy.names.includes(s.name));
  const tr = topRival(s.name);
  const chips = `<div class="chips">${owned.map(n => `<button class="chip ${n === s.name ? "on" : ""}" data-act="select" data-arg="${esc(n)}">🏢 ${esc(n)}</button>`).join("")}</div>`;
  const opts = state.stocks.filter(o => o.name !== s.name && !isOwned(o.name) && !o.bankrupt);
  if (ui.takeoverTarget && !opts.some(o => o.name === ui.takeoverTarget)) ui.takeoverTarget = "";
  if (ui.warTarget && !opts.some(o => o.name === ui.warTarget)) ui.warTarget = "";
  const k = (key, p) => t(key, p);
  return `${chips}
  <div class="card company">
    <div class="company-head">
      <div>
        <h2>${esc(s.name)} ${s.playerCEO ? badge("CEO", "#f59e0b") : ""}</h2>
        <div class="muted">${companyLevel(s)} • ${sectorName(s.sector)} • CEO: ${esc(ceoName(s))} • ${s.controlledBy ? k("company.via", { company: esc(s.controlledBy) }) : k("company.youHold", { n: q })}</div>
        <div class="muted mt4">${k("company.cash")}: <span style="color:${s.companyCash < 0 ? "#ef4444" : "#22c55e"}">${fmtShort(s.companyCash)}</span>
          • ${k("company.debt")}: <span style="color:${s.debt > 0 ? "#f97316" : "#64748b"}">${fmtShort(s.debt)}</span>${s.debt > 0 ? ` (${loanCount(s)}/${MAX_LOANS})` : ""}
          ${tr && tr.q > 0 ? ` • <span style="color:${tr.r.color}">${esc(tr.r.name)}: ${tr.q}</span>` : ""}</div>
        ${s.companyCash < -150000 ? `<div class="warn mt4">⚠ ${k("company.lowCash", { amount: fmtShort(-300000), company: esc(s.name) })}</div>` : ""}
      </div>
      <div class="kpis">
        ${[[k("kpi.income"), fmtShort(calcIncome(s))], [k("kpi.costs"), fmtShort(calcCosts(s))], [k("kpi.profit"), fmtShort(profit), profit >= 0 ? "#22c55e" : "#ef4444"],
           [k("kpi.dividend"), fmtShort(Math.max(0, profit * s.dividendRate / 100) * qtyOf(s.name) / s.shares), "#a78bfa"]]
          .map(([l, v, c]) => `<div class="kpi"><span>${l}</span><strong style="color:${c || "#e2e8f0"}">${v}</strong></div>`).join("")}
      </div>
    </div>
    <div class="cols3">
      <div><span class="label">${k("company.stats")}</span>${statBar(k("stat.reputation"), s.reputation, "#7c3aed")}${statBar(k("stat.research"), s.research, "#06b6d4")}
        <div class="muted">${k("company.staff", { emp: I18N.num(s.employees), fac: s.factories })}</div></div>
      <div><span class="label">CEO — ${esc(ceoName(s))}</span>${statBar(k("stat.leadership"), s.ceo.leadership, "#f59e0b")}${statBar(k("stat.innovation"), s.ceo.innovation, "#22c55e")}${statBar(k("stat.reliability"), s.ceo.reliability, "#06b6d4")}</div>
      <div><span class="label">${k("company.products")}</span>
        ${s.products.length ? s.products.slice(-6).map(p => `<div class="row-between small-t mb3"><span>${esc(p.name)}</span>${badge(k(`product.${p.result}`), p.result === "Hit" ? "#22c55e" : "#ef4444")}</div>`).join("") : `<div class="muted">${k("company.noProducts")}</div>`}
        ${syn.length ? `<span class="label mt8">${k("company.synergies")}</span>${syn.map(sy => `<div class="small-t" style="color:#22c55e">🔗 ${k(`syn.${sy.id}.label`)}</div>`).join("")}` : ""}</div>
    </div>
    <div class="section"><div class="row-between"><span class="muted small-t">${k("company.stake", { pct: I18N.num(stakePct(s), 1), qty: I18N.num(qtyOf(s.name)), n: I18N.num(s.shares) })}</span>
      ${btn(`🤖 ${k(s.autopilot ? "autopilot.on" : "autopilot.off")}`, "c:autopilot", { color: s.autopilot ? "#22c55e" : "#64748b", cls: "small", title: k("autopilot.help") })}</div>
      ${s.autopilot ? `<div class="muted small-t mt4">${k("autopilot.help")}</div>` : ""}</div>
    <div class="section" id="dividend-row"><span class="label">${k("company.dividendTitle", { pct: s.dividendRate })}</span>
      <div class="muted mb6">${k("company.dividendText", { pct: s.dividendRate })}</div>
      <div class="btn-row">${[0, 10, 25, 50, 75].map(r => btn(`${r}%`, "c:dividend", { arg: r, color: s.dividendRate === r ? "#a78bfa" : "#64748b", cls: s.dividendRate === r ? "active" : "" })).join("")}</div>
    </div>
    <div class="section" id="company-actions"><span class="label">${k("company.actions")}</span>
      <div class="actions">
        ${btn(k("act.marketing", { cost: fmtShort(5000) }), "c:marketing", { color: "#22c55e" })}
        ${btn(k("act.employees", { cost: fmtShort(12000) }), "c:employees", { color: "#3b82f6" })}
        ${btn(k("act.research", { cost: fmtShort(20000) }), "c:research", { color: "#a78bfa" })}
        ${btn(k("act.risk", { cost: fmtShort(30000) }), "c:risk", { color: "#ef4444", disabled: !s.custom && !D.RISK_PROFILES[s.name] })}
        ${btn(k("act.product", { cost: fmtShort(25000) }), "c:product", { color: "#ec4899" })}
        ${btn(k("act.factory", { cost: fmtShort(D.factoryCost(s.factories)) }), "c:factory", { color: "#f97316" })}
        ${btn(k("act.ceo", { cost: fmtShort(15000) }), "c:ceo", { color: "#94a3b8" })}
        ${btn(k("act.selfceo"), "c:selfceo", { color: "#f59e0b", disabled: s.playerCEO || q < CEO_THRESHOLD, title: q < CEO_THRESHOLD ? k("err.needCeo", { n: CEO_THRESHOLD }) : "" })}
        ${btn(`${k("act.loan", { amount: fmtShort(LOAN_AMOUNT) })}${s.debt ? ` (${loanCount(s)}/${MAX_LOANS})` : ""}`, "c:loan", { color: "#06b6d4", disabled: s.debt + LOAN_AMOUNT > MAX_DEBT })}
        ${btn(k("act.repay", { amount: fmtShort(50000) }), "c:repay", { color: "#14b8a6", disabled: s.debt <= 0 })}
      </div>
      <div class="muted mt8 mb6">${k("company.interest", { pct: I18N.num(interestRate(s) * 100, 2) })}</div>
      <span class="label">${k("company.inject")}</span>
      <div class="btn-row">${[10000, 50000, 250000].map(a => btn(fmtShort(a), "c:inject", { arg: a, color: "#84cc16", disabled: state.cash < 1 })).join("")}${btn(k("all"), "c:inject", { arg: "all", color: "#84cc16", disabled: state.cash < 1 })}</div>
    </div>
    <div class="cols3 section">
      <div class="sub-card"><span class="label">${k("company.expansion")}</span>
        <div class="stack">${MARKETS.map(m => {
          const has = s.markets.includes(m);
          return btn(`${marketName(m)} ${has ? "✓" : `${fmtShort(MARKET_COSTS[m])} • +${MARKET_INCOME_BONUS[m] * 100}%${MARKET_FAIL_CHANCE[m] ? ` • ${k("risk.pct", { pct: Math.round(MARKET_FAIL_CHANCE[m] * 100) })}` : ""}`}`, "c:market", { arg: m, color: has ? "#64748b" : "#7c3aed", disabled: has });
        }).join("")}</div></div>
      <div class="sub-card"><span class="label">${k("company.takeover")}</span>
        <select class="input" data-select="takeoverTarget" aria-label="${esc(k("company.takeover"))}">
          <option value="">${k("pick.target")}</option>
          ${opts.map(o => `<option value="${esc(o.name)}" ${ui.takeoverTarget === o.name ? "selected" : ""}>${esc(o.name)} (~${fmtShort(o.price * 125)})</option>`).join("")}
        </select>
        <div class="muted mt4 mb6">${k("company.takeoverOdds", { pct: Math.round(clamp((s.reputation + s.ceo.leadership) / 250, 0.15, 0.78) * 100) })}</div>
        ${btn(k("company.bid"), "c:takeover", { color: "#6366f1", disabled: !ui.takeoverTarget })}</div>
      <div class="sub-card"><span class="label">${k("company.war")}</span>
        <select class="input" data-select="warTarget" aria-label="${esc(k("company.war"))}">
          <option value="">${k("pick.competitor")}</option>
          ${opts.map(o => `<option value="${esc(o.name)}" ${ui.warTarget === o.name ? "selected" : ""}>${esc(o.name)}</option>`).join("")}
        </select>
        <div class="stack mt8">
          ${btn(k("war.btn.price", { cost: fmtShort(20000) }), "c:war", { arg: "price", color: "#ef4444", disabled: !ui.warTarget })}
          ${btn(k("war.btn.ads", { cost: fmtShort(15000) }), "c:war", { arg: "ads", color: "#f59e0b", disabled: !ui.warTarget })}
          ${btn(k("war.btn.talent", { cost: fmtShort(10000) }), "c:war", { arg: "talent", color: "#3b82f6", disabled: !ui.warTarget })}
        </div></div>
    </div>
  </div>`;
}

function employerList() {
  return `<div class="stack">${state.stocks.filter(s => !s.custom && !s.bankrupt && COMPANY_GAMES[s.name]).map(s => {
    const mine = state.job && state.job.company === s.name;
    return `<div class="row-between job-row"><div><strong>${esc(s.name)}</strong>
      <div class="muted small-t">${sectorName(s.sector)} • ${t("job.game", { game: t(`mg.${COMPANY_GAMES[s.name]}.name`) })}</div></div>
      ${btn(mine ? "✓" : t("job.apply"), "job-apply", { arg: s.name, color: "#22c55e", disabled: mine })}</div>`;
  }).join("")}</div>`;
}

function renderWork() {
  const c = state.career, j = state.job;
  const levelName = t(`job.level.${c.level}`);
  let jobCard;
  if (!j) {
    jobCard = `<div class="card span-all" id="job-card"><span class="label">💼 ${t("job.title")}</span>
      <div class="mb6">${t("job.none")}</div>
      <div class="muted small-t mb6">${t("job.startLevel", { level: levelName })} • ${t("job.salary", { amount: fmtShort(salaryPerDay()) })}${state.jobGap ? ` • ${t("job.startsIn", { n: state.jobGap })}` : ""}</div>
      ${employerList()}</div>`;
  } else {
    const need = c.level < JOB_MAX_LEVEL ? JOB_XP_NEEDED[c.level] : 0;
    const game = t(`mg.${COMPANY_GAMES[j.company]}.name`);
    const can = canWorkToday() && !j.played;
    jobCard = `<div class="card span-all">
      <div class="row-between"><div><span class="label">💼 ${t("job.title")}</span>
        <div class="rank">${esc(levelName)}</div><div class="muted">${t("job.employer")}: <b>${esc(j.company)}</b></div></div>
        <div class="right"><div class="big-num">${t("job.salary", { amount: fmtShort(salaryPerDay()) })}</div><div class="muted small-t">${t("job.salaryYear", { amount: fmtShort(JOB_SALARIES[c.level]) })}</div>${incomeTax(salaryPerDay()) > 0 ? `<div class="muted small-t">${t("tax.net", { amount: fmtShort(salaryPerDay() - incomeTax(salaryPerDay())) })}</div>` : ""}</div></div>
      ${need ? `<div class="progress-top mt8"><span>${t("job.xp", { xp: c.xp, need })}</span><span>${t("job.review", { n: REVIEW_WORKDAYS - c.since })}</span></div>
        <div class="bar"><div style="width:${Math.min(100, c.xp / need * 100)}%;background:#22c55e"></div></div>` : `<div class="mt8" style="color:#f59e0b">${t("job.maxLevel")}</div>`}
      ${j.startsIn > 0 ? `<div class="warn mt8">${t("job.startsIn", { n: j.startsIn })}</div>` : isSunday() ? `<div class="warn mt8">😴 ${t("job.sunday")}</div>` : ""}
      <div class="btn-row mt12">
        ${btn(j.played ? t("job.overtimeDone") : `🎮 ${t("job.overtime", { game })}`, "overtime", { color: "#f59e0b", cls: "lg", disabled: !can })}
        ${btn(t("job.switch"), "jobs", { color: "#64748b" })}
      </div>
      <div class="muted small-t mt8">${t("job.overtimeHelp")}</div>
      <div class="muted small-t mt4">🎁 ${t("job.perk", { n: EMPLOYEE_DISCOUNT_SHARES, company: esc(j.company) })}</div></div>`;
  }
  const side = sideIncome();
  const hustles = `<div class="card span-all"><span class="label">🍋 ${t("hustle.title")}</span>
    <div class="muted small-t mb6">${t("hustle.help")}${side ? ` <b style="color:#22c55e">${t("hustle.total", { amount: fmtShort(side) })}</b>` : ""}</div>
    <div class="grid hustle-grid">${HUSTLES.map(h => {
      const n = hustleCount(h.id), cost = hustleCost(h);
      return `<div class="sub-card"><div class="row-between"><strong>${h.icon} ${t(`hustle.${h.id}`)}</strong><span class="small-t" style="color:#22c55e">${t("hustle.income", { amount: fmtShort(h.income) })}</span></div>
        <div class="muted small-t mb6">${t("hustle.owned", { n, max: HUSTLE_MAX })}</div>
        ${btn(n >= HUSTLE_MAX ? "✓" : t("hustle.buy", { cost: fmtShort(cost) }), "hustle-buy", { arg: h.id, color: "#84cc16", disabled: n >= HUSTLE_MAX || state.cash < cost })}</div>`;
    }).join("")}</div></div>`;
  const loan = `<div class="card span-all"><span class="label">💳 ${t("loan.title")}</span>
    <div class="muted small-t mb6">${t("loan.help", { amount: fmtShort(PERSONAL_LOAN), pct: I18N.num(PERSONAL_LOAN_RATE * 100, 1), limit: fmtShort(BANKRUPT_LIMIT) })}</div>
    <div class="row-between"><div>${state.personalDebt > 0 ? `<span style="color:#f97316">${t("loan.debt", { amount: fmtShort(state.personalDebt) })}</span>` : `<span class="muted">${t("loan.none")}</span>`}</div>
    <div class="btn-row">${state.personalDebt > 0 ? btn(t("loan.repay", { amount: fmtShort(Math.min(state.cash, state.personalDebt)) }), "loan-repay", { color: "#14b8a6", disabled: state.cash < 0.01 })
      : btn(t("loan.take", { amount: fmtShort(PERSONAL_LOAN) }), "loan-take", { color: "#06b6d4" })}</div></div></div>`;
  const tx = TAXES[state.difficulty];
  const taxCard = `<div class="card span-all muted small-t">🧾 ${tx ? t("tax.info", { a: tx.bands[0][1] * 100, b: tx.bands[1][1] * 100, c: tx.bands[2][1] * 100, d: tx.dividend * 100, x: fmtShort(tx.bands[0][0]), y: fmtShort(tx.bands[1][0]) }) : t("tax.none")}</div>`;
  return `<div class="grid">${jobCard}${hustles}${loan}${taxCard}</div>`;
}

function renderRivals() {
  const me = totalValue();
  const rows = [{ name: t("you"), icon: "🧑‍💼", color: "#a78bfa", worth: me, style: rankName(rankIndex()), me: true },
    ...state.rivals.map(r => ({ name: r.name, icon: r.icon, color: r.color, worth: rivalWorth(r), style: t(`style.${r.style}`) }))].sort((a, b) => b.worth - a.worth);
  return `<div class="grid">
    <div class="card span-all"><span class="label">${t("rivals.ranking")}</span>
      ${rows.map((x, i) => `<div class="sum-row ${x.me ? "total" : ""}"><span>${i + 1}. ${x.icon} <span style="color:${x.color}">${esc(x.name)}</span> <span class="muted">(${esc(x.style)})</span></span><span>${fmtShort(x.worth)}</span></div>`).join("")}
    </div>
    ${state.rivals.map(r => {
      const hs = Object.keys(r.holdings).filter(n => r.holdings[n].qty > 0);
      return `<div class="card"><div class="row-between"><strong style="color:${r.color}">${r.icon} ${esc(r.name)}</strong>${badge(t(`style.${r.style}`), r.color)}</div>
        <div class="muted mt4">${t("stat.cash")}: ${fmtShort(r.cash)}</div>
        <div class="mt8">${hs.length ? hs.map(n => {
          const threat = isOwned(n) || state.lostTo[n] === r.name;
          return `<div class="row-between small-t mb3"><span>${esc(n)}</span><span style="color:${threat ? "#ef4444" : "#94a3b8"}">${t("shares.n", { n: r.holdings[n].qty })}${threat ? " ⚠" : ""}</span></div>`;
        }).join("") : `<div class="muted">${t("rivals.none")}</div>`}</div></div>`;
    }).join("")}
    <div class="card span-all muted">${t(state.difficulty === "easy" ? "rivals.helpEasy" : "rivals.help", { name: RIVAL_TEMPLATES[0].name, day: state.difficulty === "hardcore" ? 10 : RIVAL_HOSTILE_FROM_DAY })}</div>
  </div>`;
}

function renderInvestor() {
  const ri = rankIndex(), rk = INVESTOR_RANKS[ri], next = INVESTOR_RANKS[ri + 1];
  const into = state.xp - rk.xpNeeded, span = next ? next.xpNeeded - rk.xpNeeded : 1;
  const g = state.goal;
  const active = activeSynergies();
  return `<div class="grid">
    <div class="card span-all">
      <div class="row-between"><div><div class="rank" style="color:${rk.color}">${rankName(ri)}</div><div class="muted">${t("xp.total", { xp: state.xp })}</div></div><div class="rank-icon">${rk.icon}</div></div>
      ${next ? `<div class="progress-top mt8"><span>${rankName(ri)} → ${rankName(ri + 1)}</span><span>${into}/${span} XP</span></div>
        <div class="bar"><div style="width:${Math.min(100, into / span * 100)}%;background:${rk.color}"></div></div>` : `<div style="color:${rk.color}" class="mt8">${t("rank.max")}</div>`}
    </div>
    <div class="card"><span class="label">${t("investor.fees")}</span><div class="big-num">${I18N.num(feeRate() * 100, 2)}%</div>
      <div class="mt8">${INVESTOR_RANKS.map((r, i) => `<div class="row-between small-t" style="color:${ri >= i ? "#22c55e" : "#475569"}"><span>${ri >= i ? "✓" : "○"} ${rankName(i)}</span><span>${I18N.num(diff().fee * (1 - i * RANK_FEE_REDUCTION) * 100, 2)}%</span></div>`).join("")}</div></div>
    <div class="card"><span class="label">🎯 ${t("goal.daily")}</span>
      ${g ? `<div>${esc(goalText(g))}</div><div class="muted mt4">${g.done ? `✓ ${t("goal.done")}` : t("goal.reward", { xp: g.xp })}</div>` : ""}
      <div class="muted mt8">${t("goal.count", { n: state.goalsDone })}</div></div>
    <div class="card"><span class="label">${t("investor.earn")}</span>
      ${[["buy", XP_REWARDS.buy], ["sell", XP_REWARDS.sell_profit], ["own", XP_REWARDS.own_company], ["ceo", XP_REWARDS.become_ceo], ["product", XP_REWARDS.product_hit],
         ["risk", XP_REWARDS.risk_success], ["takeover", XP_REWARDS.takeover], ["recession", XP_REWARDS.survive_recession], ["depression", XP_REWARDS.survive_depression]]
        .map(([key, v]) => `<div class="row-between small-t"><span class="muted">${t(`xp.list.${key}`)}</span><span style="color:#a78bfa">+${v}</span></div>`).join("")}</div>
    <div class="card"><span class="label">🔗 ${t("investor.synergies")}</span>
      ${D.SYNERGIES.map(sy => { const on = active.includes(sy);
        return `<div class="mb6"><div style="color:${on ? "#22c55e" : "#94a3b8"}">${on ? "✓" : "○"} ${t(`syn.${sy.id}.label`)}</div><div class="muted small-t">${t(`syn.${sy.id}.desc`)}</div></div>`; }).join("")}</div>
    <div class="card"><span class="label">${t("investor.dividendTitle")}</span><div class="muted lh">${t("investor.dividendText", { amount: fmtShort(-300000) })}</div></div>
  </div>`;
}

function renderAchievements() {
  return `<div class="muted mb6">${t("ach.count", { n: state.achievements.length, total: ACHIEVEMENTS.length, xp: state.xp })}</div>
  <div class="grid ach-grid">${ACHIEVEMENTS.map(a => {
    const on = state.achievements.includes(a.id);
    return `<div class="card ach ${on ? "on" : ""}"><div class="ach-icon">${on ? a.icon : "🔒"}</div><div><strong>${t(`ach.${a.id}.label`)}</strong><div class="muted small-t">${t(`ach.${a.id}.desc`, { n: OWN_MANY })}</div>${a.xp ? `<div class="small-t" style="color:${on ? "#a78bfa" : "#475569"}">+${a.xp} XP</div>` : ""}</div></div>`;
  }).join("")}</div>`;
}

function renderSettings() {
  return `<div class="grid">
    <div class="card"><span class="label">🌍 ${t("settings.language")}</span>${langSelect()}</div>
    <div class="card"><span class="label">${t("settings.sound")}</span>
      ${btn(Sound.enabled ? `🔊 ${t("settings.soundOn")}` : `🔇 ${t("settings.soundOff")}`, "sound", { color: Sound.enabled ? "#22c55e" : "#64748b" })}
      <div class="muted small-t mt8">${t("settings.soundCredit")}</div></div>
    <div class="card"><span class="label">${t("settings.save")}</span>
      <div class="muted mb6">${t("settings.saveText")}${diff().permadeath ? ` ${t("settings.permadeath")}` : ""}</div>
      <div class="btn-row">${btn(`💾 ${t("settings.export")}`, "export", { color: "#06b6d4" })}
        <label class="btn" style="--c:#06b6d4">📂 ${t("settings.import")}<input type="file" accept="application/json,.json" data-import hidden></label></div></div>
    <div class="card"><span class="label">${t("settings.game")}</span>
      <div class="muted mb6">${t("settings.gameInfo", { diff: esc(t(`diff.${state.difficulty}.label`)), start: `${state.setupIcon} ${esc(t(`setup.${state.setupId}.label`))}` })}</div>
      <div class="btn-row">${btn(`☰ ${t("menu.title")}`, "menu", { color: "#a78bfa" })}${btn(`↺ ${t("settings.newGame")}`, "newgame", { color: "#ef4444" })}</div></div>
    <div class="card span-all"><span class="label">${t("settings.keys")}</span><div class="muted small-t lh">${t("settings.keysText")}</div></div>
  </div>`;
}

function render() {
  if (!state) return;
  tutorialTick();
  checkSteps();
  renderHeader();
  renderTabs();
  const main = $("main");
  const ae = document.activeElement;
  if (ae && ae.tagName === "SELECT" && main.contains(ae)) { renderTutorial(); return; }
  let focusKey = null, ss = null, se = null;
  if (ae && ae.dataset && ae.dataset.focuskey) { focusKey = ae.dataset.focuskey; try { ss = ae.selectionStart; se = ae.selectionEnd; } catch { /* ignore */ } }
  const views = { market: renderMarket, portfolio: renderPortfolio, company: renderCompany, work: renderWork, rivals: renderRivals, investor: renderInvestor, achievements: renderAchievements, settings: renderSettings };
  main.innerHTML = (views[ui.tab] || renderMarket)();
  if (focusKey) {
    const el = document.querySelector(`[data-focuskey="${CSS.escape(focusKey)}"]`);
    if (el) { el.focus({ preventScroll: true }); try { if (ss != null) el.setSelectionRange(ss, se); } catch { /* ignore */ } }
  }
  renderModal();
  renderTutorial();
}

// ═══════════════════════════════════════════════════════════════════════════
// Modals
// ═══════════════════════════════════════════════════════════════════════════

function openModal(m) { ui.modal = m; renderModal(); }
function closeModal() {
  if (!ui.modal) return;
  if (ui.modal.type === "choice" && state && state.pendingChoice) return;
  if (ui.modal.type === "end" || ui.modal.type === "minigame") return;
  if (ui.modal.type === "menu" && (ui.placeholder && !ui.tutorial)) return; // first start: pick something
  ui.modal = null; renderModal();
}

function renderMenu() {
  const saved = loadSave();
  const canContinue = saved && !saved.gameOver && !saved.gameWon;
  const inGame = state && !ui.placeholder;
  if (ui.menuStep === "difficulty") {
    return `<div class="row-between"><h2>${t("menu.chooseDiff")}</h2><button class="x" data-act="menu-back" aria-label="${esc(t("back"))}">←</button></div>
      <div class="stack mt8">${Object.keys(DIFFICULTIES).map(k => `<button class="diff" data-act="start" data-arg="${k}"><strong>${t(`diff.${k}.label`)}</strong><span class="muted small-t">${t(`diff.${k}.desc`)}</span></button>`).join("")}</div>
      ${canContinue || inGame ? `<p class="muted small-t mt8">${t("menu.overwrite")}</p>` : ""}`;
  }
  return `<div class="menu-head"><div class="menu-logo">▸</div><h2>${t("app.title")}</h2><p class="muted">${t("menu.tagline")}</p></div>
    <div class="stack menu-buttons">
      ${inGame ? `<button class="menu-btn primary" data-act="close">▶ ${t("menu.resume")}<span>${t("day", { n: state.day })}</span></button>`
        : canContinue ? `<button class="menu-btn primary" data-act="continue">▶ ${t("menu.continue")}<span>${t("day", { n: saved.day })} • ${esc(t(`diff.${saved.difficulty}.label`))}</span></button>` : ""}
      <button class="menu-btn ${canContinue || inGame ? "" : "primary"}" data-act="menu-play">🎮 ${t("menu.play")}<span>${t("menu.playSub")}</span></button>
      <button class="menu-btn" data-act="tutorial">🎓 ${t("menu.tutorial")}<span>${t("menu.tutorialSub")}</span></button>
      <a class="menu-btn" href="online.html">🌐 ${t("menu.online")}<span>${t("menu.onlineSub")}</span></a>
    </div>
    <div class="menu-foot">${langSelect()}
      <button class="btn small" style="--c:${Sound.enabled ? "#22c55e" : "#64748b"}" data-act="sound" aria-label="${esc(t("settings.sound"))}">${Sound.enabled ? "🔊" : "🔇"}</button></div>`;
}

function renderModal() {
  const root = $("modal-root");
  const m = ui.modal;
  if (!m) { root.innerHTML = ""; document.body.classList.remove("modal-open"); return; }
  document.body.classList.add("modal-open");
  let inner = "", dismissable = true;

  if (m.type === "menu") {
    dismissable = !(ui.placeholder && !ui.tutorial);
    inner = renderMenu();
  } else if (m.type === "end") {
    dismissable = false;
    const won = state.gameWon, ri = rankIndex();
    inner = `<div class="end-icon">${won ? "🏆" : "💸"}</div>
      <h2 style="color:${won ? "#22c55e" : "#ef4444"}">${won ? t("end.won") : t("end.lost")}</h2>
      <p class="muted">${won ? t("end.wonText", { n: state.day }) : t("end.lostText", { n: state.day })}${!won && diff().permadeath ? ` ${t("end.permadeath")}` : ""}</p>
      <p>${t("end.final")}: <strong>${fmtShort(totalValue())}</strong></p>
      <p>${t("end.rank")}: <strong style="color:${INVESTOR_RANKS[ri].color}">${rankName(ri)}</strong> (${state.xp} XP) • ${t("tab.achievements")}: ${state.achievements.length}/${ACHIEVEMENTS.length}</p>
      <div class="btn-row center mt12">${btn(t("settings.newGame"), "newgame-confirmed", { color: "#a78bfa", cls: "lg" })}</div>`;
  } else if (m.type === "choice") {
    dismissable = false;
    const pc = state.pendingChoice;
    const ev = pc && D.CHOICE_EVENTS.find(e => e.id === pc.id);
    const s = pc && stockBy(pc.company);
    if (!ev || !s) { ui.modal = null; state.pendingChoice = null; root.innerHTML = ""; document.body.classList.remove("modal-open"); return; }
    inner = `<h2>${t(`choice.${ev.id}.title`)}</h2><p>${esc(t(`choice.${ev.id}.text`, { company: s.name }))}</p><p class="muted small-t">${t("choice.cash", { company: esc(s.name), cash: fmtShort(s.companyCash) })}</p>
      ${state.tips.seen.choice ? "" : `<p class="tip-line">💡 ${t("tip.choice")}</p>`}
      <div class="stack mt8">${ev.options.map((o, i) => btn(esc(t(`choice.${ev.id}.o${i}`)), "choose", { arg: i, color: i === 0 ? "#22c55e" : "#94a3b8", disabled: !!(o.pay && s.companyCash < o.pay), cls: "lg" })).join("")}</div>`;
  } else if (m.type === "chart") {
    const s = stockBy(m.name);
    if (!s) { ui.modal = null; root.innerHTML = ""; return; }
    const h = state.holdings[s.name];
    inner = `<div class="row-between"><h2>${esc(s.name)}</h2><button class="x" data-act="close" aria-label="${esc(t("close"))}">✕</button></div>
      <div class="muted small-t">${I18N.money(s.price)} • ${t("chart.days", { n: s.history.length })}${h ? ` • ${t("chart.avg", { price: I18N.money(h.avg) })}` : ""}</div>
      <div class="chart-wrap"><canvas id="bigchart"></canvas></div>
      <div class="legend small-t"><span><i style="background:#22c55e"></i>${t("buy")}</span><span><i style="background:#ef4444"></i>${t("sell")}</span><span><i style="background:#ec4899"></i>${t("short")}</span><span><i style="background:#f59e0b"></i>${t("chart.avgShort")}</span></div>`;
  } else if (m.type === "alerts") {
    const s = stockBy(m.name);
    if (!s) { ui.modal = null; root.innerHTML = ""; return; }
    const mine = state.alerts.filter(a => a.name === s.name);
    inner = `<div class="row-between"><h2>🔔 ${esc(s.name)}</h2><button class="x" data-act="close" aria-label="${esc(t("close"))}">✕</button></div>
      <p class="muted small-t">${t("alert.help", { price: I18N.money(s.price) })}</p>
      <input class="input" type="text" inputmode="decimal" data-alert-price data-focuskey="alert-price" value="${esc(ui.alertPrice)}" placeholder="${esc(t("alert.pricePh"))}">
      <div class="btn-row mt8">${btn(`▲ ${t("alert.above")}`, "alert-add", { arg: "above", color: "#22c55e" })}${btn(`▼ ${t("alert.below")}`, "alert-add", { arg: "below", color: "#ef4444" })}</div>
      ${mine.length ? `<span class="label mt12">${t("alert.active")}</span>${mine.map(a => `<div class="sum-row"><span>${a.dir === "above" ? "≥" : "≤"} ${I18N.money(a.price)}</span><button class="btn small" style="--c:#ef4444" data-act="alert-del" data-arg="${a.id}" aria-label="${esc(t("delete"))}">✕</button></div>`).join("")}` : ""}`;
  } else if (m.type === "ipo") {
    inner = `<div class="row-between"><h2>🔔 ${t("ipo.title")}</h2><button class="x" data-act="close" aria-label="${esc(t("close"))}">✕</button></div>
      <p class="muted small-t">${t("ipo.modalText", { cost: fmtShort(IPO_SHARES * IPO_PRICE * 2), n: IPO_SHARES, price: fmtShort(IPO_PRICE) })}</p>
      <span class="label">${t("ipo.name")}</span>
      <input class="input" type="text" maxlength="16" data-ipo-name data-focuskey="ipo-name" value="${esc(ui.ipoName)}" placeholder="NovaCorp">
      <span class="label mt8">${t("ipo.sector")}</span>
      <select class="input" data-ipo-sector>${D.SECTORS.map(k => `<option value="${k}" ${ui.ipoSector === k ? "selected" : ""}>${esc(sectorName(k))}</option>`).join("")}</select>
      <div class="btn-row mt12">${btn(t("ipo.go"), "ipo-go", { color: "#f59e0b", cls: "lg" })}</div>`;
  } else if (m.type === "glossary") {
    inner = `<div class="row-between"><h2>❓ ${t("glossary.title")}</h2><button class="x" data-act="close" aria-label="${esc(t("close"))}">✕</button></div>
      <dl class="glossary">${GLOSSARY.map(k => `<dt>${t(`glossary.${k}`)}</dt><dd>${t(`glossary.${k}.text`, { n: OWNERSHIP_THRESHOLD, ceo: CEO_THRESHOLD })}</dd>`).join("")}</dl>`;
  } else if (m.type === "jobs") {
    inner = `<div class="row-between"><h2>💼 ${t("job.pick")}</h2><button class="x" data-act="close" aria-label="${esc(t("close"))}">✕</button></div>
      <p class="muted small-t">${t("job.startLevel", { level: t(`job.level.${state.career.level}`) })} • ${t("job.salary", { amount: fmtShort(salaryPerDay()) })}${state.job ? ` • ${t("job.switchNote", { n: JOB_SWITCH_DAYS })}` : ""}</p>
      ${employerList()}`;
  } else if (m.type === "minigame") {
    if ($("mg-root")) return;                 // a mini-game is running: don't rebuild it
    inner = `<div class="row-between"><span class="label">🎮 ${t("mg.title")}</span><button class="x" data-act="mg-quit" aria-label="${esc(t("mg.giveUp"))}" title="${esc(t("mg.giveUp"))}">✕</button></div><div id="mg-root"></div>`;
    dismissable = false;
  } else if (m.type === "mgresult") {
    inner = `<div class="end-icon">${{ perfect: "💎", gold: "🥇", silver: "🥈", bronze: "🥉", none: "😅" }[m.tier]}</div>
      <h2>${t(`mg.result.${m.tier}`)}</h2><p class="muted">${t("mg.score", { pct: m.pct })}</p>
      ${m.bonus ? `<p><strong style="color:#22c55e">${t("mg.reward", { amount: fmtShort(m.bonus), xp: m.xp })}</strong>${m.tax > 0 ? `<br><span class="muted small-t">${t("tax.paid", { amount: fmtShort(m.tax) })}</span>` : ""}</p>` : ""}
      <div class="btn-row center mt12">${btn(t("mg.done"), "close", { color: "#a78bfa", cls: "lg" })}</div>`;
  } else if (m.type === "confirm-new") {
    inner = `<h2>${t("confirm.newTitle")}</h2><p class="muted">${t("confirm.newText", { n: state.day })}</p>
      <div class="btn-row mt12">${btn(t("confirm.yes"), "newgame-confirmed", { color: "#ef4444", cls: "lg" })}${btn(t("cancel"), "close", { color: "#64748b", cls: "lg" })}</div>`;
  }

  const ae = document.activeElement;
  const keepFocus = ae && ae.dataset && ae.dataset.focuskey && root.contains(ae) ? ae.dataset.focuskey : null;
  root.innerHTML = `<div class="modal-backdrop" ${dismissable ? `data-act="close"` : ""}></div>
    <div class="modal ${m.type === "chart" ? "wide" : ""} ${m.type === "menu" ? "menu" : ""}" role="dialog" aria-modal="true">${inner}</div>`;
  if (m.type === "chart") requestAnimationFrame(() => drawChart(m.name));
  if (m.type === "minigame") MiniGames.start(m.game, $("mg-root"), finishMiniGame);
  if (keepFocus) { const el = root.querySelector(`[data-focuskey="${keepFocus}"]`); if (el) el.focus(); }
}

function drawChart(name) {
  const canvas = $("bigchart"), s = stockBy(name);
  if (!canvas || !s) return;
  const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const hist = s.history, startDay = state.day - hist.length + 1;
  const holding = state.holdings[name];
  const vals = hist.concat(holding ? [holding.avg] : []);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max === min) { max += 1; min = Math.max(0, min - 1); }
  const pad = (max - min) * 0.08; min -= pad; max += pad;
  const P = { l: w < 420 ? 50 : 64, r: 10, t: 10, b: 22 };
  const X = i => P.l + (hist.length === 1 ? 0.5 : i / (hist.length - 1)) * (w - P.l - P.r);
  const Y = v => P.t + (1 - (v - min) / (max - min)) * (h - P.t - P.b);
  ctx.font = "11px 'IBM Plex Mono', monospace"; ctx.strokeStyle = "#1e293b"; ctx.fillStyle = "#64748b"; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const v = min + (max - min) * i / 4, y = Y(v);
    ctx.beginPath(); ctx.moveTo(P.l, y); ctx.lineTo(w - P.r, y); ctx.stroke();
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText(v >= 1000 ? fmtShort(v) : "€" + I18N.num(v, v < 10 ? 2 : 0), P.l - 6, y);
  }
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  const ticks = Math.min(5, hist.length);
  for (let i = 0; i < ticks; i++) { const idx = Math.round(i * (hist.length - 1) / Math.max(1, ticks - 1)); ctx.fillText(t("day.short", { n: startDay + idx }), X(idx), h - P.b + 6); }
  if (holding) { ctx.setLineDash([5, 4]); ctx.strokeStyle = "#f59e0b"; ctx.beginPath(); ctx.moveTo(P.l, Y(holding.avg)); ctx.lineTo(w - P.r, Y(holding.avg)); ctx.stroke(); ctx.setLineDash([]); }
  state.alerts.filter(a => a.name === name && a.price >= min && a.price <= max).forEach(a => {
    ctx.setLineDash([2, 4]); ctx.strokeStyle = a.dir === "above" ? "#22c55e88" : "#ef444488";
    ctx.beginPath(); ctx.moveTo(P.l, Y(a.price)); ctx.lineTo(w - P.r, Y(a.price)); ctx.stroke(); ctx.setLineDash([]);
  });
  const up = hist[hist.length - 1] >= hist[0];
  const grad = ctx.createLinearGradient(0, P.t, 0, h - P.b);
  grad.addColorStop(0, up ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath(); hist.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.lineTo(X(hist.length - 1), h - P.b); ctx.lineTo(X(0), h - P.b); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
  ctx.beginPath(); hist.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.strokeStyle = up ? "#22c55e" : "#ef4444"; ctx.lineWidth = 2; ctx.stroke();
  const colors = { buy: "#22c55e", sell: "#ef4444", short: "#ec4899", cover: "#ec4899" };
  state.trades.filter(tr => tr.name === name && tr.day >= startDay).forEach(tr => {
    const x = X(tr.day - startDay), y = Y(tr.price), isUp = tr.type === "buy" || tr.type === "cover";
    ctx.fillStyle = colors[tr.type]; ctx.beginPath();
    if (isUp) { ctx.moveTo(x, y - 2); ctx.lineTo(x - 6, y + 9); ctx.lineTo(x + 6, y + 9); }
    else { ctx.moveTo(x, y + 2); ctx.lineTo(x - 6, y - 9); ctx.lineTo(x + 6, y - 9); }
    ctx.closePath(); ctx.fill();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Events
// ═══════════════════════════════════════════════════════════════════════════

function openMenu() { setSpeed(0); ui.menuStep = "main"; openModal({ type: "menu" }); }

// The screen is redrawn after most clicks, so the pressed button is replaced by a new one.
// Let that new button spring back up, so a tap feels like really pushing it.
function popAfterRender(act, arg) {
  requestAnimationFrame(() => {
    const sel = `[data-act="${CSS.escape(act)}"]` + (arg !== undefined ? `[data-arg="${CSS.escape(arg)}"]` : "");
    const el = document.querySelector(`#app ${sel}, #modal-root ${sel}`);
    if (!el || el.disabled) return;
    el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
  });
}

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const act = el.dataset.act, arg = el.dataset.arg;
  popAfterRender(act, arg);
  if (act.startsWith("c:")) return companyAction(act.slice(2), arg);
  switch (act) {
    case "tip-ok": state.tips.queue.shift(); save(); render(); break;
    case "glossary": setSpeed(0); openModal({ type: "glossary" }); break;
    case "next": advanceDay(); break;
    case "speed": setSpeed(Number(arg)); render(); break;
    case "tab": ui.tab = arg; render(); window.scrollTo({ top: Math.min(window.scrollY, $("tabs").offsetTop - 8) }); break;
    case "filter": ui.marketFilter = arg; render(); break;
    case "select": ui.selected = arg; render(); break;
    case "buy": buyStock(arg); break;
    case "sell": sellStock(arg); break;
    case "short": openShort(arg); break;
    case "cover": coverShort(arg); break;
    case "max": { const s = stockBy(arg); const mb = maxBuyable(s); ui.amounts[arg] = String(mb > 0 ? mb : qtyOf(arg) || ""); render(); break; }
    case "chart": openModal({ type: "chart", name: arg }); break;
    case "alerts": { const s = stockBy(arg); ui.alertPrice = (s.price * 1.05).toFixed(2); openModal({ type: "alerts", name: arg }); break; }
    case "alert-add": addAlert(ui.modal.name, arg); break;
    case "alert-del": state.alerts = state.alerts.filter(a => String(a.id) !== arg); save(); render(); break;
    case "close": closeModal(); break;
    case "choose": resolveChoice(Number(arg)); break;
    case "ipo": ui.ipoName = ""; openModal({ type: "ipo" }); break;
    case "ipo-go": foundCompany(); break;
    case "sound": Sound.enabled = !Sound.enabled; render(); sound("buy"); break;
    case "export": exportSave(); break;
    case "menu": openMenu(); break;
    case "menu-play": ui.menuStep = "difficulty"; renderModal(); break;
    case "menu-back": ui.menuStep = "main"; renderModal(); break;
    case "newgame": openModal({ type: "confirm-new" }); break;
    case "newgame-confirmed": state = null; ui.tutorial = null; boot(true); break;
    case "continue": {
      const s = loadSave();
      if (s) { state = s; ui.placeholder = false; ui.tutorial = null; ui.modal = null; ui.selected = ownedNames()[0] || null; ui.tab = "market"; if (state.pendingChoice) ui.modal = { type: "choice" }; render(); }
      break;
    }
    case "start": newGame(arg); ui.modal = { type: "jobs" }; render(); break;
    case "jobs": openModal({ type: "jobs" }); break;
    case "job-apply": applyJob(arg); break;
    case "overtime": if (canWorkToday() && !state.job.played) { setSpeed(0); openModal({ type: "minigame", game: COMPANY_GAMES[state.job.company] }); } break;
    case "mg-quit": MiniGames.stop(); finishMiniGame(0); break;
    case "hustle-buy": buyHustle(arg); break;
    case "loan-take": takeLoan(); break;
    case "loan-repay": repayLoan(); break;
    case "tutorial": ui.modal = null; newGame("normal", { tutorial: true }); render(); break;
    case "tut-next": ui.tutorial.step++; { const n = tutorialStep(); if (n && n.tab) ui.tab = n.tab; } render(); break;
    case "tut-skip": ui.tutorial = null; state = null; boot(true); break;
    case "tut-finish": unlockTutorialAndExit(); break;
  }
});

function unlockTutorialAndExit() {
  // The tutorial game isn't kept, but the achievement carries over to the next real game via a flag.
  storageSet("inv-tutorial-done", "1");
  ui.tutorial = null; state = null;
  boot(true);
  ui.menuStep = "difficulty"; renderModal();
}

document.addEventListener("input", e => {
  const tg = e.target;
  if (tg.dataset.amount !== undefined) {
    const clean = tg.value.replace(/[^\d]/g, "").slice(0, 12);
    if (clean !== tg.value) tg.value = clean;
    ui.amounts[tg.dataset.amount] = clean;
  } else if (tg.dataset.ipoName !== undefined) ui.ipoName = tg.value;
  else if (tg.dataset.alertPrice !== undefined) ui.alertPrice = tg.value.replace(/[^\d.,]/g, "");
});
document.addEventListener("change", e => {
  const tg = e.target;
  if (tg.dataset.select) { ui[tg.dataset.select] = tg.value; tg.blur(); render(); }
  else if (tg.dataset.lang !== undefined) I18N.setLang(tg.value);
  else if (tg.dataset.ipoSector !== undefined) ui.ipoSector = tg.value;
  else if (tg.dataset.import !== undefined && tg.files && tg.files[0]) importSave(tg.files[0]);
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeModal(); return; }
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea") {
    if (e.key === "Enter" && e.target.dataset.amount) buyStock(e.target.dataset.amount);
    if (e.key === "Enter" && e.target.dataset.ipoName !== undefined) foundCompany();
    return;
  }
  if (!state || ui.modal) return;
  if (e.altKey && /^[1-8]$/.test(e.key)) {
    const order = ["market", "portfolio", "company", "work", "rivals", "investor", "achievements", "settings"];
    const k = order[Number(e.key) - 1];
    if (k !== "company" || ownedNames().length) { ui.tab = k; render(); }
    e.preventDefault(); return;
  }
  if ((e.key === " " || e.key === "Enter") && !(e.target.closest && e.target.closest("button"))) { e.preventDefault(); advanceDay(); }
  else if (/^[0-3]$/.test(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey && !ui.tutorial) { setSpeed(Number(e.key)); render(); }
});

let resizeRaf = 0;
window.addEventListener("resize", () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(() => { if (ui.modal && ui.modal.type === "chart") drawChart(ui.modal.name); }); });
document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
I18N.onChange(() => render());

// ═══════════════════════════════════════════════════════════════════════════
// Boot
// ═══════════════════════════════════════════════════════════════════════════

function boot(fresh = false) {
  setSpeed(0);
  if (!state) {
    const saved = fresh ? null : loadSave();
    if (saved && !saved.gameOver && !saved.gameWon) { state = saved; ui.placeholder = false; }
    else newGame("normal", { persist: false });
  }
  ui.menuStep = "main";
  ui.modal = { type: "menu" };
  render();
}

// Carry the tutorial achievement into the next real game.
const _newGame = newGame;
newGame = function (diffKey, opts = {}) {
  _newGame(diffKey, opts);
  if (!opts.tutorial && storageGet("inv-tutorial-done") === "1" && opts.persist !== false) {
    if (!state.achievements.includes("tutorial")) { state.achievements.push("tutorial"); state.xp += 25; }
    storageDel("inv-tutorial-done");
    save();
  }
};

window.__game = { get state() { return state; }, advanceDay, newGame: (d, o) => { newGame(d, o); ui.modal = null; render(); }, render, ui };

boot();

})();
