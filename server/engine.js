"use strict";
// Multiplayer game engine. Pure game rules: no networking, no DOM.
// The server owns one `room` object per game and calls these functions.

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const MAX_PLAYERS = 8;
const OWNERSHIP_THRESHOLD = 50;
const CEO_THRESHOLD = 100;
const HISTORY_LEN = 60;
const FEE = 0.006;                 // 0.6% per trade
const PRICE_IMPACT = 0.0004;       // per share traded, capped
const MAX_IMPACT = 0.08;
const SHORT_MARGIN = 0.5;
const SHORT_DAILY_FEE = 0.001;
const SHORT_MARGIN_CALL = 0.15;
const AFK_DAYS = 3;                // inactive this many days → counts as skipping
const PAUSE_MS = 30000;
const PAUSE_TOKENS = 2;
const CHOICE_CHANCE = 0.06;

const SPEEDS = { calm: 20000, normal: 10000, turbo: 4000 };
const TARGETS = { "1m": 1e6, "10m": 1e7, "100m": 1e8, "1b": 1e9 };
const START_CASH = [10000, 50000, 250000];
const DAY_LIMITS = [0, 50, 100, 200];

const MARKETS = ["Europa", "Amerika", "Azië"];
const MARKET_COSTS = { Europa: 20000, Amerika: 40000, Azië: 70000 };
const MARKET_FAIL_CHANCE = { Europa: 0, Amerika: 0.18, Azië: 0.32 };
const MARKET_INCOME_BONUS = { Europa: 0, Amerika: 0.25, Azië: 0.4 };
const MARKET_DRIFT = { Europa: 0.0005, Amerika: 0.001, Azië: 0.0015 };

const FACTORY_COST = 50000;
const FACTORY_DAILY_INCOME = 3500;
const LOAN_AMOUNT = 100000;
const MAX_DEBT = 500000;
const ACTION_COSTS = { marketing: 5000, employees: 12000, research: 20000, risk: 30000, ceo: 15000, factory: FACTORY_COST, product: 25000 };

const PLAYER_COLORS = ["#a78bfa", "#22c55e", "#f59e0b", "#06b6d4", "#ef4444", "#ec4899", "#84cc16", "#f97316"];
const CEO_NAMES = ["Lina Storm", "Omar Van Dijk", "Victor Chen", "Aya Moreau", "Nora Steel", "Jonas Peeters", "Iris Laurent", "Karim Benali"];

const PRODUCT_IDEAS = {
  TechNova:  ["AI Assistant", "Gaming Laptop", "Smartphone", "Cloud Platform"],
  GreenVolt: ["Solar Roof", "Home Battery", "Wind Turbine", "Eco Charger"],
  EuroBank:  ["Premium Account", "Safe Loan System", "Mobile Banking", "Fraud Shield"],
  MedFuture: ["Health Scanner", "Medical AI", "Recovery Device", "Smart Lab"],
  SpaceY:    ["Reusable Rocket", "Moon Cargo", "Satellite Net", "Mars Prototype"],
};
const RISK_PROFILES = {
  TechNova:  { chance: 0.58, up: 1.22, down: 0.91 },
  GreenVolt: { chance: 0.68, up: 1.14, down: 0.94 },
  MedFuture: { chance: 0.38, up: 1.42, down: 0.80 },
  SpaceY:    { chance: 0.20, up: 2.00, down: 0.50 },
};

const MARKET_EVENTS = [
  { title: "AI-hype trekt investeerders naar TechNova.", affected: ["TechNova"], multiplier: 1.1 },
  { title: "Energieprijzen stijgen. GreenVolt wint aandacht.", affected: ["GreenVolt"], multiplier: 1.08 },
  { title: "Banken winnen vertrouwen. EuroBank stabiel omhoog.", affected: ["EuroBank"], multiplier: 1.03 },
  { title: "Medische doorbraak. MedFuture profiteert.", affected: ["MedFuture"], multiplier: 1.12 },
  { title: "SpaceY schiet wild heen en weer.", affected: ["SpaceY"], multiplier: () => (Math.random() > 0.5 ? 1.22 : 0.75) },
  { title: "Renteangst raakt de markt. Risico-aandelen dalen.", affected: ["TechNova", "GreenVolt", "MedFuture", "SpaceY"], multiplier: 0.95 },
  { title: "Optimisme keert terug. Bijna alle aandelen stijgen.", affected: "*", multiplier: 1.05 },
  { title: "Consumenten geven minder uit. Groeibedrijven raken klappen.", affected: ["TechNova", "GreenVolt", "MedFuture", "SpaceY"], multiplier: 0.93 },
  { title: "Speculanten pompen SpaceY opnieuw omhoog.", affected: ["SpaceY"], multiplier: 1.3 },
  { title: "Rustige handelsdag. Weinig nieuws.", affected: [], multiplier: 1 },
];

// Choice events. The LAST option is the safe default, picked automatically on timeout.
const CHOICE_EVENTS = [
  { id: "scandal", title: "📰 Journalist dreigt met onthulling", text: c => `Een journalist heeft vervelende documenten over ${c}.`,
    options: [
      { label: "Betaal €20K om het stil te houden", pay: 20000, run: s => {
        if (Math.random() < 0.3) { s.reputation = clamp(s.reputation - 15, 0, 100); s.price = round2(s.price * 0.85); return `Het lekt toch uit. ${s.name} verliest 15%.`; }
        return `Het verhaal over ${s.name} verdwijnt.`; } },
      { label: "Open kaart spelen", run: s => { s.reputation = clamp(s.reputation - 5, 0, 100); return `${s.name} speelt open kaart. Reputatie −5.`; } },
    ] },
  { id: "union", title: "✊ Vakbond eist loonsverhoging", text: c => `Werknemers van ${c} dreigen met staking.`,
    options: [
      { label: "Akkoord (€15K bonus)", pay: 15000, run: s => { s.reputation = clamp(s.reputation + 4, 0, 100); return `Tevreden personeel bij ${s.name}.`; } },
      { label: "Weigeren", run: s => {
        if (Math.random() < 0.5) { s.price = round2(s.price * 0.92); s.employees = Math.floor(s.employees * 0.95); return `Staking bij ${s.name}! Koers −8%.`; }
        return `De vakbond van ${s.name} geeft toe.`; } },
    ] },
  { id: "patent", title: "📜 Patent te koop", text: c => `Een concurrent wil een patent verkopen aan ${c} voor €40K.`,
    options: [
      { label: "Kopen (€40K)", pay: 40000, run: s => {
        if (Math.random() < 0.3) { s.research = clamp(s.research + 2, 0, 100); return `Het patent van ${s.name} blijkt weinig waard.`; }
        s.research = clamp(s.research + 12, 0, 100); s.price = round2(s.price * 1.04); return `Topdeal! ${s.name} onderzoek +12, koers +4%.`; } },
      { label: "Afslaan", run: s => `${s.name} laat het patent liggen.` },
    ] },
  { id: "influencer", title: "📱 Influencer-deal", text: c => `Een influencer wil ${c} promoten voor €10K.`,
    options: [
      { label: "Doen (€10K)", pay: 10000, run: s => {
        if (Math.random() < 0.6) { s.reputation = clamp(s.reputation + 10, 0, 100); s.price = round2(s.price * 1.06); return `Viraal! ${s.name} +6%.`; }
        s.reputation = clamp(s.reputation - 6, 0, 100); return `Backlash online voor ${s.name}.`; } },
      { label: "Nee, bedankt", run: s => `${s.name} houdt het rustig.` },
    ] },
];

const STOCK_DEFS = [
  { name: "TechNova",  price: 120, volatility: 0.09, reputation: 50, employees: 1200, research: 50, markets: ["Europa"],  companyCash: 50000,  ceo: { name: "Mila Vos",        leadership: 60, innovation: 75, reliability: 55 } },
  { name: "GreenVolt", price: 80,  volatility: 0.07, reputation: 50, employees: 900,  research: 50, markets: ["Europa"],  companyCash: 35000,  ceo: { name: "Noah Verbruggen", leadership: 58, innovation: 65, reliability: 70 } },
  { name: "EuroBank",  price: 60,  volatility: 0.01, reputation: 70, employees: 2400, research: 35, markets: ["Europa"],  companyCash: 120000, ceo: { name: "Elise De Smet",   leadership: 72, innovation: 35, reliability: 90 } },
  { name: "MedFuture", price: 95,  volatility: 0.08, reputation: 55, employees: 1100, research: 60, markets: ["Europa"],  companyCash: 60000,  ceo: { name: "Samira Haddad",   leadership: 55, innovation: 85, reliability: 60 } },
  { name: "SpaceY",    price: 150, volatility: 0.22, reputation: 65, employees: 700,  research: 80, markets: ["Amerika"], companyCash: 80000,  ceo: { name: "Rex Orion",       leadership: 45, innovation: 95, reliability: 30 } },
];

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
const round2 = v => Math.round(v * 100) / 100;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const isInt = v => Number.isInteger(v);

function fmtShort(v) {
  const sign = v < 0 ? "−" : ""; const a = Math.abs(v);
  if (a >= 1e9) return `${sign}€${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}€${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}€${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K`;
  return `${sign}€${a.toFixed(0)}`;
}
function randomCeo() {
  return { name: pick(CEO_NAMES), leadership: 40 + Math.floor(Math.random() * 56), innovation: 30 + Math.floor(Math.random() * 66), reliability: 35 + Math.floor(Math.random() * 61) };
}

// ═══════════════════════════════════════════════════════════════════════════
// Room lifecycle
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_SETTINGS = { speed: "normal", target: "10m", startCash: 50000, dayLimit: 100 };
// Invalid values fall back to `base` (the current settings), so a bad field never resets the others.
function sanitizeSettings(s = {}, base = DEFAULT_SETTINGS) {
  s = s && typeof s === "object" ? s : {};
  return {
    speed: SPEEDS[s.speed] ? s.speed : base.speed,
    target: TARGETS[s.target] ? s.target : base.target,
    startCash: START_CASH.includes(s.startCash) ? s.startCash : base.startCash,
    dayLimit: DAY_LIMITS.includes(s.dayLimit) ? s.dayLimit : base.dayLimit,
  };
}

function createRoom(code, settings) {
  return {
    code, phase: "lobby", hostId: null, settings: sanitizeSettings(settings),
    day: 0, dayEndsAt: 0, pausedUntil: 0, pausedBy: null,
    stocks: [], players: {}, order: [],
    recession: false, recessionDays: 0, depression: false, depressionDays: 0,
    news: [], chat: [], winnerId: null, endReason: "",
    emptySince: 0, version: 0,
  };
}

function makeStock(def) {
  return {
    name: def.name, price: def.price, volatility: def.volatility, reputation: def.reputation,
    employees: def.employees, research: def.research, factories: 0, markets: [...def.markets],
    debt: 0, companyCash: def.companyCash, dividendRate: 10, ceo: { ...def.ceo }, ceoId: null,
    ownerId: null, products: [], bankrupt: false, history: [def.price],
  };
}

function addPlayer(room, id, name) {
  if (room.order.length >= MAX_PLAYERS) return { error: "Deze kamer is vol (max 8 spelers)." };
  if (room.phase === "ended") return { error: "Dit spel is al afgelopen." };
  const clean = String(name || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 16) || "Speler";
  let unique = clean, n = 2;
  while (Object.values(room.players).some(p => p.name.toLowerCase() === unique.toLowerCase())) unique = `${clean.slice(0, 13)} ${n++}`;
  const color = PLAYER_COLORS.find(c => !Object.values(room.players).some(p => p.color === c)) || pick(PLAYER_COLORS);
  room.players[id] = {
    id, name: unique, color, cash: room.settings.startCash, holdings: {}, avg: {}, shorts: {},
    connected: true, skip: false, autoSkip: false, lastActiveDay: room.day, pauseTokens: PAUSE_TOKENS,
    pendingChoice: null, lastDividend: 0,
  };
  room.order.push(id);
  if (!room.hostId) room.hostId = id;
  if (room.phase === "playing") addNews(room, `${unique} doet mee aan het spel.`);
  return { player: room.players[id] };
}

function removePlayer(room, id) {
  // Only used in the lobby. During a game a player stays (disconnected) so they can come back.
  const p = room.players[id];
  if (!p) return;
  delete room.players[id];
  room.order = room.order.filter(x => x !== id);
  if (room.hostId === id) room.hostId = room.order[0] || null;
}

function startGame(room, now) {
  room.phase = "playing";
  room.day = 1;
  room.stocks = STOCK_DEFS.map(makeStock);
  room.dayEndsAt = now + SPEEDS[room.settings.speed];
  Object.values(room.players).forEach(p => { p.lastActiveDay = 1; p.cash = room.settings.startCash; });
  addNews(room, `Het spel start! Doel: ${fmtShort(TARGETS[room.settings.target])}${room.settings.dayLimit ? ` of de rijkste na dag ${room.settings.dayLimit}` : ""}.`);
  room.version++;
}

// ═══════════════════════════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════════════════════════

const stockBy = (room, name) => room.stocks.find(s => s.name === name);
const qty = (p, name) => p.holdings[name] || 0;

function shortEquity(room, p, name) {
  const sh = p.shorts[name]; if (!sh) return 0;
  return sh.margin + (sh.entry - stockBy(room, name).price) * sh.qty;
}
function netWorth(room, p) {
  let t = p.cash;
  for (const n in p.holdings) { const s = stockBy(room, n); if (s) t += p.holdings[n] * s.price; }
  for (const n in p.shorts) t += shortEquity(room, p, n);
  return t;
}
function activePlayers(room) {
  return Object.values(room.players).filter(p => p.connected && room.day - p.lastActiveDay < AFK_DAYS);
}

function econMult(room) { return room.depression ? 0.6 : room.recession ? 0.78 : 1; }
function calcIncome(room, s) {
  const base = s.employees * 4 + s.factories * FACTORY_DAILY_INCOME;
  return base * (1 + s.markets.reduce((t, m) => t + MARKET_INCOME_BONUS[m], 0)) * econMult(room);
}
function interestRate(s) { return s.ceo.reliability >= 75 ? 0.0012 : s.ceo.reliability >= 50 ? 0.002 : 0.003; }
function calcCosts(room, s) { return s.employees * (room.recession || room.depression ? 2.4 : 2) + s.debt * interestRate(s); }
function calcProfit(room, s) { return calcIncome(room, s) - calcCosts(room, s); }

function dailyDrift(s) {
  const rep = s.reputation <= 20 ? -0.006 : s.reputation <= 40 ? -0.002 : s.reputation <= 60 ? 0 : s.reputation <= 80 ? 0.0015 : 0.0025;
  const res = s.research < 20 ? 0 : s.research < 40 ? 0.0005 : s.research < 60 ? 0.001 : s.research < 80 ? 0.002 : 0.003;
  const mk = s.markets.reduce((t, m) => t + MARKET_DRIFT[m], 0);
  return rep + res + mk + (s.ceo.leadership - 50) / 25000 + (s.ceo.reliability - 50) / 30000;
}

function addNews(room, text, kind = "info") {
  room.news.unshift({ day: room.day, text, kind });
  if (room.news.length > 30) room.news.length = 30;
}

// ═══════════════════════════════════════════════════════════════════════════
// Ownership: whoever holds the most shares (and at least 50) controls a company.
// The current owner keeps control on a tie.
// ═══════════════════════════════════════════════════════════════════════════

function updateOwnership(room, s) {
  if (s.bankrupt) { s.ownerId = null; s.ceoId = null; return; }
  const ps = Object.values(room.players);
  const max = ps.reduce((m, p) => Math.max(m, qty(p, s.name)), 0);
  let owner = null;
  if (max >= OWNERSHIP_THRESHOLD) {
    const cur = room.players[s.ownerId];
    owner = cur && qty(cur, s.name) === max ? cur : ps.find(p => qty(p, s.name) === max);
  }
  const newId = owner ? owner.id : null;
  if (newId !== s.ownerId) {
    const prev = room.players[s.ownerId];
    if (owner && prev) addNews(room, `⚔️ ${owner.name} neemt ${s.name} over van ${prev.name}!`, "bad");
    else if (owner) addNews(room, `${owner.name} heeft nu controle over ${s.name}.`, "good");
    else if (prev) addNews(room, `${prev.name} verliest de controle over ${s.name}.`, "bad");
    s.ownerId = newId;
  }
  // CEO follows the owner once they hold 100 shares.
  const wantCeo = owner && qty(owner, s.name) >= CEO_THRESHOLD ? owner.id : null;
  if (wantCeo && s.ceoId !== wantCeo) {
    s.ceoId = wantCeo;
    s.ceo = { name: owner.name, leadership: 60, innovation: 60, reliability: 60 };
    addNews(room, `👔 ${owner.name} is nu CEO van ${s.name}.`, "good");
  } else if (!wantCeo && s.ceoId) {
    s.ceoId = null;
    s.ceo = randomCeo();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Player actions. Every input is validated here: the client is never trusted.
// Returns { error } or { ok: true, info? }.
// ═══════════════════════════════════════════════════════════════════════════

function impact(q) { return Math.min(MAX_IMPACT, q * PRICE_IMPACT); }

function handleAction(room, p, msg, now) {
  if (room.phase !== "playing") return { error: "Het spel loopt niet." };
  const markActive = () => { p.lastActiveDay = room.day; };

  switch (msg.t) {
    case "buy": case "sell": case "short": case "cover": {
      const s = stockBy(room, msg.stock);
      if (!s || s.bankrupt) return { error: "Dit aandeel is niet beschikbaar." };
      const q = msg.t === "cover" ? (p.shorts[s.name] ? p.shorts[s.name].qty : 0) : msg.qty;
      if (!isInt(q) || q < 1 || q > 1e7) return { error: "Vul een geldig aantal in." };
      const i = impact(q);
      if (msg.t === "buy") {
        const price = s.price * (1 + i / 2);
        const total = price * q * (1 + FEE);
        if (p.cash < total) return { error: `Niet genoeg cash. Kost ${fmtShort(total)}.` };
        p.cash = round2(p.cash - total);
        const old = qty(p, s.name);
        p.avg[s.name] = ((p.avg[s.name] || 0) * old + total) / (old + q);
        p.holdings[s.name] = old + q;
        s.price = round2(s.price * (1 + i));
      } else if (msg.t === "sell") {
        if (qty(p, s.name) < q) return { error: `Je hebt maar ${qty(p, s.name)} aandelen.` };
        const price = s.price * (1 - i / 2);
        p.cash = round2(p.cash + price * q * (1 - FEE));
        p.holdings[s.name] -= q;
        if (!p.holdings[s.name]) { delete p.holdings[s.name]; delete p.avg[s.name]; }
        s.price = round2(Math.max(0.01, s.price * (1 - i)));
      } else if (msg.t === "short") {
        if (s.ownerId === p.id) return { error: "Je kunt je eigen bedrijf niet shorten." };
        const price = s.price * (1 - i / 2);
        const margin = price * q * SHORT_MARGIN, fee = price * q * FEE;
        if (p.cash < margin + fee) return { error: `Shorten vraagt ${fmtShort(margin + fee)} onderpand.` };
        p.cash = round2(p.cash - margin - fee);
        const sh = p.shorts[s.name] || { qty: 0, entry: price, margin: 0 };
        sh.entry = (sh.entry * sh.qty + price * q) / (sh.qty + q);
        sh.qty += q; sh.margin += margin;
        p.shorts[s.name] = sh;
        s.price = round2(Math.max(0.01, s.price * (1 - i)));
      } else {
        const sh = p.shorts[s.name];
        if (!sh) return { error: "Geen short-positie." };
        const price = s.price * (1 + i / 2);
        p.cash = round2(p.cash + Math.max(0, sh.margin + (sh.entry - price) * sh.qty - price * sh.qty * FEE));
        delete p.shorts[s.name];
        s.price = round2(s.price * (1 + i));
      }
      s.history[s.history.length - 1] = s.price;
      updateOwnership(room, s);
      markActive();
      return { ok: true };
    }

    case "company": return companyAction(room, p, msg, markActive);

    case "choice": {
      const pc = p.pendingChoice;
      if (!pc) return { error: "Geen openstaande keuze." };
      if (!isInt(msg.option)) return { error: "Ongeldige keuze." };
      const r = resolveChoice(room, p, msg.option);
      if (r.error) return r;
      markActive();
      return { ok: true };
    }

    case "skip":
      p.skip = !!msg.on; if (!msg.on) p.autoSkip = false;
      markActive();
      return { ok: true };
    case "autoskip":
      p.autoSkip = !!msg.on; p.skip = p.autoSkip || p.skip;
      markActive();
      return { ok: true };

    case "pause": {
      if (room.pausedUntil > now) {
        if (room.pausedBy !== p.id) return { error: "Het spel is al gepauzeerd." };
        room.dayEndsAt -= room.pausedUntil - now; // resume early: give back unused time
        room.pausedUntil = 0; room.pausedBy = null;
        addNews(room, `${p.name} hervat het spel.`);
        return { ok: true };
      }
      if (p.pauseTokens <= 0) return { error: "Je pauzes zijn op." };
      p.pauseTokens--;
      room.pausedUntil = now + PAUSE_MS; room.pausedBy = p.id;
      room.dayEndsAt += PAUSE_MS;
      addNews(room, `⏸ ${p.name} pauzeert het spel (30 s).`);
      markActive();
      return { ok: true };
    }
  }
  return { error: "Onbekende actie." };
}

function companyAction(room, p, msg, markActive) {
  const s = stockBy(room, msg.stock);
  if (!s || s.bankrupt) return { error: "Bedrijf niet beschikbaar." };
  if (s.ownerId !== p.id) return { error: `Je bestuurt ${s.name} niet.` };
  const spend = cost => {
    if (s.companyCash < cost) return { error: `Niet genoeg bedrijfskas. ${s.name} heeft ${fmtShort(s.companyCash)}, nodig ${fmtShort(cost)}.` };
    s.companyCash = round2(s.companyCash - cost);
    return null;
  };
  const ceoUp = (k, d) => { if (s.ceoId === p.id) s.ceo[k] = clamp(s.ceo[k] + d, 0, 100); };
  let err = null, text = "";

  switch (msg.action) {
    case "marketing":
      if ((err = spend(ACTION_COSTS.marketing))) return err;
      s.reputation = clamp(s.reputation + 8, 0, 100); s.price = round2(s.price * 1.025); ceoUp("leadership", 1);
      text = `${s.name}: marketingcampagne.`; break;
    case "employees":
      if ((err = spend(ACTION_COSTS.employees))) return err;
      s.employees += 100; s.volatility = Math.max(0.01, s.volatility - 0.003); ceoUp("leadership", 1);
      text = `${s.name}: 100 werknemers aangenomen.`; break;
    case "research":
      if ((err = spend(ACTION_COSTS.research))) return err;
      s.research = clamp(s.research + 8, 0, 100); s.price = round2(s.price * 1.03); ceoUp("innovation", 1);
      text = `${s.name}: onderzoek verbeterd.`; break;
    case "factory":
      if ((err = spend(ACTION_COSTS.factory))) return err;
      s.factories++; s.employees += 120; s.price = round2(s.price * 1.05); ceoUp("leadership", 1);
      text = `${s.name}: nieuwe fabriek.`; break;
    case "risk": {
      const prof = RISK_PROFILES[s.name];
      if (!prof) return { error: `${s.name} doet geen risicoprojecten.` };
      if ((err = spend(ACTION_COSTS.risk))) return err;
      const ok = Math.random() < clamp(prof.chance + s.ceo.innovation / 600, 0.05, 0.88);
      s.reputation = clamp(s.reputation + (ok ? 5 : -6), 0, 100);
      s.price = round2(s.price * (ok ? prof.up : prof.down));
      text = ok ? `🎲 ${s.name}: risicoproject geslaagd!` : `🎲 ${s.name}: risicoproject mislukt.`; break;
    }
    case "product": {
      if ((err = spend(ACTION_COSTS.product))) return err;
      const name = pick(PRODUCT_IDEAS[s.name] || ["Nieuw product"]);
      const ok = Math.random() < clamp(0.2 + s.research / 280 + s.reputation / 450 + s.ceo.innovation / 550, 0.08, 0.85);
      s.products.push({ name, result: ok ? "Hit" : "Flop" }); if (s.products.length > 10) s.products.shift();
      s.reputation = clamp(s.reputation + (ok ? 10 : -7), 0, 100); s.price = round2(s.price * (ok ? 1.16 : 0.93));
      text = ok ? `🚀 ${s.name}: ${name} is een hit!` : `${s.name}: ${name} flopt.`; break;
    }
    case "ceo":
      if (s.ceoId) return { error: "Jij bent zelf CEO. Verkoop onder de 100 aandelen om een externe CEO te krijgen." };
      if ((err = spend(ACTION_COSTS.ceo))) return err;
      s.ceo = randomCeo();
      text = `${s.name}: nieuwe CEO ${s.ceo.name}.`; break;
    case "loan":
      if (s.debt + LOAN_AMOUNT > MAX_DEBT) return { error: `Maximum ${fmtShort(MAX_DEBT)} schuld.` };
      s.companyCash += LOAN_AMOUNT; s.debt += LOAN_AMOUNT; s.reputation = clamp(s.reputation - 3, 0, 100);
      text = `${s.name}: lening van €100K.`; break;
    case "repay": {
      const pay = Math.min(s.debt, s.companyCash, 50000);
      if (pay <= 0) return { error: s.debt <= 0 ? "Geen schuld." : "Geen bedrijfskas om af te lossen." };
      s.companyCash = round2(s.companyCash - pay); s.debt = round2(s.debt - pay);
      text = `${s.name}: ${fmtShort(pay)} schuld afgelost.`; break;
    }
    case "dividend":
      if (![0, 10, 25, 50, 75].includes(msg.value)) return { error: "Ongeldig percentage." };
      s.dividendRate = msg.value;
      text = `${s.name}: dividend nu ${s.dividendRate}% (voor alle aandeelhouders).`; break;
    case "market": {
      if (!MARKETS.includes(msg.value)) return { error: "Onbekende markt." };
      if (s.markets.includes(msg.value)) return { error: `${s.name} is al actief in ${msg.value}.` };
      if ((err = spend(MARKET_COSTS[msg.value]))) return err;
      if (Math.random() < MARKET_FAIL_CHANCE[msg.value]) {
        s.reputation = clamp(s.reputation - 10, 0, 100); s.price = round2(s.price * 0.95);
        text = `${s.name} mislukt in ${msg.value}.`;
      } else {
        s.markets.push(msg.value); s.reputation = clamp(s.reputation + 7, 0, 100); s.price = round2(s.price * 1.07);
        text = `🌍 ${s.name} opent ${msg.value}!`;
      }
      break;
    }
    case "inject": {
      const amount = msg.value === "all" ? p.cash : Number(msg.value);
      if (![10000, 50000, 250000].includes(amount) && msg.value !== "all") return { error: "Ongeldig bedrag." };
      const a = Math.min(p.cash, amount);
      if (a < 1) return { error: "Je hebt geen cash." };
      p.cash = round2(p.cash - a); s.companyCash = round2(s.companyCash + a);
      text = `${p.name} legt ${fmtShort(a)} in bij ${s.name}.`; break;
    }
    default: return { error: "Onbekende bedrijfsactie." };
  }
  s.history[s.history.length - 1] = s.price;
  addNews(room, text);
  markActive();
  return { ok: true };
}

function resolveChoice(room, p, index) {
  const pc = p.pendingChoice;
  const ev = CHOICE_EVENTS.find(e => e.id === pc.id);
  const s = stockBy(room, pc.stock);
  p.pendingChoice = null;
  if (!ev || !s || s.bankrupt || s.ownerId !== p.id) return { ok: true };
  const opt = ev.options[index];
  if (!opt) { p.pendingChoice = pc; return { error: "Ongeldige keuze." }; }
  if (opt.pay && s.companyCash < opt.pay) { p.pendingChoice = pc; return { error: "Niet genoeg bedrijfskas." }; }
  if (opt.pay) s.companyCash = round2(s.companyCash - opt.pay);
  addNews(room, opt.run(s));
  s.history[s.history.length - 1] = s.price;
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// Time: called every ~250 ms by the server. Returns true when state changed.
// ═══════════════════════════════════════════════════════════════════════════

function tick(room, now) {
  if (room.phase !== "playing") return false;
  let changed = false;

  if (room.pausedUntil) {
    if (now < room.pausedUntil) return false;
    room.pausedUntil = 0; room.pausedBy = null; changed = true;
  }
  // Nobody connected: freeze the clock instead of playing on without anyone.
  if (!Object.values(room.players).some(p => p.connected)) {
    room.dayEndsAt = now + SPEEDS[room.settings.speed];
    return changed;
  }
  const active = activePlayers(room);
  const allSkip = active.length > 0 && active.every(p => p.skip || p.autoSkip);
  if (now >= room.dayEndsAt || allSkip) {
    advanceDay(room);
    room.dayEndsAt = now + SPEEDS[room.settings.speed];
    changed = true;
  }
  return changed;
}

function advanceDay(room) {
  const ev = pick(MARKET_EVENTS);
  const mult = typeof ev.multiplier === "function" ? ev.multiplier() : ev.multiplier;
  const notes = [];
  const players = Object.values(room.players);
  players.forEach(p => { p.lastDividend = 0; });

  // Unanswered choices from the previous day: the safe (last) option is applied.
  players.forEach(p => {
    if (p.pendingChoice) {
      const ev2 = CHOICE_EVENTS.find(e => e.id === p.pendingChoice.id);
      resolveChoice(room, p, ev2 ? ev2.options.length - 1 : 0);
    }
  });

  room.stocks.forEach(s => {
    if (s.bankrupt) return;
    const profit = calcProfit(room, s);
    if (s.ownerId && profit > 0) {
      // Dividend goes to every player shareholder, pro rata.
      const pool = profit * s.dividendRate / 100;
      const holders = players.filter(p => qty(p, s.name) > 0);
      const total = holders.reduce((t, p) => t + qty(p, s.name), 0);
      holders.forEach(p => { const d = pool * qty(p, s.name) / total; p.cash = round2(p.cash + d); p.lastDividend += d; });
      s.companyCash += profit - pool;
    } else {
      s.companyCash += profit;
    }
    if (!s.ownerId) aiManage(s);
    s.companyCash = round2(s.companyCash);

    let price = s.price;
    if (ev.affected === "*" || ev.affected.includes(s.name)) price *= mult;
    if (s.name === "EuroBank") price *= Math.random() > 0.5 ? 1.002 : 0.998;
    else price += (Math.random() - 0.5) * s.volatility * price;
    price *= 1 + dailyDrift(s);
    if (room.recession) price *= s.name === "EuroBank" ? 0.993 : s.name === "SpaceY" ? 0.96 : 0.978;
    if (room.depression) price *= 0.985;
    if (s.name === "SpaceY" && price > 1200 && Math.random() < 0.18) { price *= 0.55; notes.push("SpaceY-bubbel knapt!"); }
    if (Math.random() < 0.008 * ((100 - s.ceo.reliability) / 100)) { price *= 0.92; s.reputation = clamp(s.reputation - 8, 0, 100); notes.push(`${s.name}: schandaal.`); }

    s.price = round2(Math.max(0, price));
    s.history.push(s.price);
    if (s.history.length > HISTORY_LEN) s.history.shift();

    if (s.price < 1.5 || s.companyCash < -300000) bankrupt(room, s, notes);
  });

  // Short positions: borrow fee and margin calls.
  players.forEach(p => {
    for (const n of Object.keys(p.shorts)) {
      const sh = p.shorts[n]; const s = stockBy(room, n);
      const fee = sh.qty * s.price * SHORT_DAILY_FEE;
      if (p.cash >= fee) p.cash = round2(p.cash - fee); else sh.margin -= fee;
      const eq = shortEquity(room, p, n);
      if (eq < sh.qty * s.price * SHORT_MARGIN_CALL) {
        p.cash = round2(p.cash + Math.max(0, eq));
        delete p.shorts[n];
        notes.push(`Margin call voor ${p.name} op ${n}.`);
      }
    }
  });

  // Economic cycle
  const roll = Math.random();
  let headline = ev.title;
  if (room.depression) {
    room.depressionDays++;
    if (room.depressionDays >= 6 && roll < 0.25) { room.depression = false; room.depressionDays = 0; headline = "HERSTEL — De depressie is voorbij."; }
  } else if (room.recession) {
    room.recessionDays++;
    if (room.recessionDays >= 8 && roll < 0.12) {
      room.recession = false; room.recessionDays = 0; room.depression = true; room.depressionDays = 1;
      room.stocks.forEach(s => { if (!s.bankrupt) { s.price = round2(s.price * 0.6); s.history[s.history.length - 1] = s.price; } });
      headline = "DEPRESSIE — Alle aandelen verliezen 40%.";
    } else if (room.recessionDays >= 5 && roll < 0.28) { room.recession = false; room.recessionDays = 0; headline = `HERSTEL — ${ev.title}`; }
  } else if (roll < 0.035) { room.recession = true; room.recessionDays = 1; headline = `RECESSIE — ${ev.title}`; }
  addNews(room, [headline, ...notes].join(" "), /RECESSIE|DEPRESSIE/.test(headline) ? "bad" : /HERSTEL/.test(headline) ? "good" : "info");

  room.day++;
  players.forEach(p => { if (!p.autoSkip) p.skip = false; });

  // New choice events for owners.
  players.forEach(p => {
    if (!p.connected || p.pendingChoice) return;
    const owned = room.stocks.filter(s => s.ownerId === p.id);
    if (owned.length && Math.random() < CHOICE_CHANCE) {
      p.pendingChoice = { id: pick(CHOICE_EVENTS).id, stock: pick(owned).name, day: room.day };
    }
  });

  room.stocks.forEach(s => updateOwnership(room, s));
  checkEnd(room);
}

function aiManage(s) {
  if (s.companyCash > 150000 && Math.random() < 0.03) { s.companyCash -= FACTORY_COST; s.factories++; s.employees += 120; }
  else if (s.companyCash > 60000 && Math.random() < 0.04) { s.companyCash -= 20000; s.research = clamp(s.research + 5, 0, 100); }
}

function bankrupt(room, s, notes) {
  s.bankrupt = true; s.price = 0; s.employees = 0; s.companyCash = 0; s.debt = 0;
  notes.push(`💀 ${s.name} is failliet!`);
  Object.values(room.players).forEach(p => {
    const sh = p.shorts[s.name];
    if (sh) { p.cash = round2(p.cash + sh.margin + sh.entry * sh.qty); delete p.shorts[s.name]; }
  });
  updateOwnership(room, s);
}

function checkEnd(room) {
  const players = Object.values(room.players);
  if (!players.length) return;
  const target = TARGETS[room.settings.target];
  const ranked = players.slice().sort((a, b) => netWorth(room, b) - netWorth(room, a));
  if (netWorth(room, ranked[0]) >= target) {
    endGame(room, ranked[0].id, `${ranked[0].name} bereikt als eerste ${fmtShort(target)}!`);
  } else if (room.settings.dayLimit && room.day > room.settings.dayLimit) {
    endGame(room, ranked[0].id, `Dag ${room.settings.dayLimit} voorbij. ${ranked[0].name} is de rijkste!`);
  }
}
function endGame(room, winnerId, reason) {
  room.phase = "ended"; room.winnerId = winnerId; room.endReason = reason;
  addNews(room, `🏆 ${reason}`, "good");
}

// ═══════════════════════════════════════════════════════════════════════════
// What a player gets to see. Other players' pending choices stay private.
// ═══════════════════════════════════════════════════════════════════════════

function viewFor(room, playerId, now) {
  const me = room.players[playerId];
  let choice = null;
  if (me && me.pendingChoice) {
    const ev = CHOICE_EVENTS.find(e => e.id === me.pendingChoice.id);
    const s = stockBy(room, me.pendingChoice.stock);
    if (ev && s) choice = { title: ev.title, text: ev.text(s.name), stock: s.name, companyCash: s.companyCash,
      options: ev.options.map(o => ({ label: o.label, pay: o.pay || 0 })) };
  }
  const players = room.order.map(id => room.players[id]).filter(Boolean).map(p => ({
    id: p.id, name: p.name, color: p.color, connected: p.connected,
    netWorth: room.phase === "lobby" ? p.cash : round2(netWorth(room, p)),
    cash: p.cash, holdings: p.holdings, skip: p.skip || p.autoSkip,
    afk: room.phase === "playing" && room.day - p.lastActiveDay >= AFK_DAYS,
  }));
  return {
    code: room.code, phase: room.phase, hostId: room.hostId, settings: room.settings,
    day: room.day, dayMs: SPEEDS[room.settings.speed], dayEndsAt: room.dayEndsAt,
    pausedUntil: room.pausedUntil, pausedBy: room.pausedBy, serverNow: now,
    recession: room.recession, depression: room.depression,
    target: TARGETS[room.settings.target],
    stocks: room.stocks.map(s => ({
      ...s, profit: round2(calcProfit(room, s)), income: round2(calcIncome(room, s)), costs: round2(calcCosts(room, s)),
      interest: interestRate(s),
    })),
    players, news: room.news.slice(0, 12), chat: room.chat.slice(-30),
    winnerId: room.winnerId, endReason: room.endReason,
    me: me ? {
      id: me.id, name: me.name, color: me.color, cash: me.cash, holdings: me.holdings, avg: me.avg, shorts: me.shorts,
      skip: me.skip, autoSkip: me.autoSkip, pauseTokens: me.pauseTokens, lastDividend: round2(me.lastDividend),
      netWorth: round2(netWorth(room, me)), choice, isHost: room.hostId === me.id,
    } : null,
  };
}

module.exports = {
  createRoom, addPlayer, removePlayer, startGame, handleAction, tick, viewFor, sanitizeSettings, addNews,
  MAX_PLAYERS, SPEEDS, TARGETS, START_CASH, DAY_LIMITS,
  // exported for tests
  _internal: { advanceDay, netWorth, updateOwnership, stockBy },
};
