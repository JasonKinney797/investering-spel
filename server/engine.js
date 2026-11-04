"use strict";
// Multiplayer game engine. Pure game rules: no networking, no DOM.
// All player-visible messages are translation keys + params: [key, params].
// The browser translates them, so every player sees the game in their own language.

const D = require("../companies.js");

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const MAX_PLAYERS = 8;
const OWNERSHIP_THRESHOLD = 50;
const CEO_THRESHOLD = 100;
const HISTORY_LEN = 60;
const WORTH_HISTORY_LEN = 400;
const FEE = 0.006;
const PRICE_IMPACT = 0.0004;
const MAX_IMPACT = 0.08;
const SHORT_MARGIN = 0.5;
const SHORT_DAILY_FEE = 0.001;
const SHORT_MARGIN_CALL = 0.15;
const AFK_DAYS = 3;
const PAUSE_MS = 30000;
const PAUSE_TOKENS = 2;
const CHOICE_CHANCE = 0.06;
const MAX_OPEN_DEALS = 3;
const DEAL_DAYS = 3;
const MAX_DEAL_CASH = 1e12;

const SPEEDS = { calm: 20000, normal: 10000, turbo: 4000 };
const TARGETS = { "1m": 1e6, "10m": 1e7, "100m": 1e8, "1b": 1e9 };
const START_CASH = [10000, 50000, 250000];
const DAY_LIMITS = [0, 50, 100, 200];

const MARKETS = D.MARKETS;
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

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
const round2 = v => Math.round(v * 100) / 100;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const isInt = v => Number.isInteger(v);
const err = (key, params = {}) => ({ error: [key, params] });

function randomCeo() {
  return { name: pick(D.CEO_NAMES), leadership: 40 + Math.floor(Math.random() * 56), innovation: 30 + Math.floor(Math.random() * 66), reliability: 35 + Math.floor(Math.random() * 61) };
}

// ═══════════════════════════════════════════════════════════════════════════
// Room lifecycle
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_SETTINGS = { speed: "normal", target: "10m", startCash: 50000, dayLimit: 100 };
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
    stocks: [], players: {}, order: [], deals: [], nextDealId: 1, worth: {},
    recession: false, recessionDays: 0, depression: false, depressionDays: 0,
    news: [], chat: [], chatSeq: 0, winnerId: null, end: null, emptySince: 0,
  };
}

function makeStock(def) {
  return {
    name: def.name, sector: def.sector, price: def.price, volatility: def.volatility, reputation: def.reputation,
    employees: def.employees, research: def.research, factories: 0, markets: [...def.markets], recession: def.recession,
    debt: 0, companyCash: def.companyCash, dividendRate: 10, ceo: { ...def.ceo }, ceoId: null,
    ownerId: null, products: [], bankrupt: false, history: [def.price],
  };
}

function addPlayer(room, id, name) {
  if (room.order.length >= MAX_PLAYERS) return err("err.roomFull");
  if (room.phase === "ended") return err("err.gameOver");
  const clean = String(name || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 16) || "Player";
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
  if (room.phase === "playing") {
    room.worth[id] = [room.settings.startCash];
    addNews(room, [["news.joined", { player: unique }]]);
  }
  return { player: room.players[id] };
}

function removePlayer(room, id) {
  if (!room.players[id]) return;
  delete room.players[id];
  room.order = room.order.filter(x => x !== id);
  room.deals = room.deals.filter(d => d.from !== id && d.to !== id);
  if (room.hostId === id) room.hostId = room.order[0] || null;
}

function startGame(room, now) {
  room.phase = "playing";
  room.day = 1;
  room.stocks = D.STOCK_DEFS.map(makeStock);
  room.dayEndsAt = now + SPEEDS[room.settings.speed];
  Object.values(room.players).forEach(p => { p.lastActiveDay = 1; p.cash = room.settings.startCash; room.worth[p.id] = [p.cash]; });
  addNews(room, [[room.settings.dayLimit ? "news.startLimit" : "news.start", { target: TARGETS[room.settings.target], days: room.settings.dayLimit }]]);
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
  let tt = p.cash;
  for (const n in p.holdings) { const s = stockBy(room, n); if (s) tt += p.holdings[n] * s.price; }
  for (const n in p.shorts) tt += shortEquity(room, p, n);
  return tt;
}
// Inactive for AFK_DAYS days, unless they switched on auto-skip (that's a deliberate choice, not being away).
const isAfk = (room, p) => !p.autoSkip && room.day - p.lastActiveDay >= AFK_DAYS;

const econMult = room => (room.depression ? 0.6 : room.recession ? 0.78 : 1);
function calcIncome(room, s) {
  const base = s.employees * 4 + s.factories * FACTORY_DAILY_INCOME;
  return base * (1 + s.markets.reduce((tt, m) => tt + MARKET_INCOME_BONUS[m], 0)) * econMult(room);
}
const interestRate = s => (s.ceo.reliability >= 75 ? 0.0012 : s.ceo.reliability >= 50 ? 0.002 : 0.003);
const calcCosts = (room, s) => s.employees * (room.recession || room.depression ? 2.4 : 2) + s.debt * interestRate(s);
const calcProfit = (room, s) => calcIncome(room, s) - calcCosts(room, s);

function dailyDrift(s) {
  const rep = s.reputation <= 20 ? -0.006 : s.reputation <= 40 ? -0.002 : s.reputation <= 60 ? 0 : s.reputation <= 80 ? 0.0015 : 0.0025;
  const res = s.research < 20 ? 0 : s.research < 40 ? 0.0005 : s.research < 60 ? 0.001 : s.research < 80 ? 0.002 : 0.003;
  const mk = s.markets.reduce((tt, m) => tt + MARKET_DRIFT[m], 0);
  return rep + res + mk + (s.ceo.leadership - 50) / 25000 + (s.ceo.reliability - 50) / 30000;
}

// parts: [[key, params], …]
function addNews(room, parts, kind = "info") {
  room.news.unshift({ day: room.day, parts, kind });
  if (room.news.length > 30) room.news.length = 30;
}

// ═══════════════════════════════════════════════════════════════════════════
// Ownership: most shares (and at least 50) controls a company. Ties keep the current owner.
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
    if (owner && prev) addNews(room, [["news.takeoverPlayer", { player: owner.name, company: s.name, prev: prev.name }]], "bad");
    else if (owner) addNews(room, [["news.controlPlayer", { player: owner.name, company: s.name }]], "good");
    else if (prev) addNews(room, [["news.lostPlayer", { player: prev.name, company: s.name }]], "bad");
    s.ownerId = newId;
  }
  const wantCeo = owner && qty(owner, s.name) >= CEO_THRESHOLD ? owner.id : null;
  if (wantCeo && s.ceoId !== wantCeo) {
    s.ceoId = wantCeo;
    s.ceo = { name: owner.name, leadership: 60, innovation: 60, reliability: 60 };
    addNews(room, [["news.ceoPlayer", { player: owner.name, company: s.name }]], "good");
  } else if (!wantCeo && s.ceoId) {
    s.ceoId = null; s.ceo = randomCeo();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Player actions. Every input is validated: the client is never trusted.
// Returns { error: [key, params] } or { ok: true }.
// ═══════════════════════════════════════════════════════════════════════════

const impact = q => Math.min(MAX_IMPACT, q * PRICE_IMPACT);

function handleAction(room, p, msg, now) {
  if (room.phase !== "playing") return err("err.notPlaying");
  const markActive = () => { p.lastActiveDay = room.day; };

  switch (msg.t) {
    case "buy": case "sell": case "short": case "cover": {
      const s = stockBy(room, msg.stock);
      if (!s || s.bankrupt) return err("err.unavailable");
      const q = msg.t === "cover" ? (p.shorts[s.name] ? p.shorts[s.name].qty : 0) : msg.qty;
      if (!isInt(q) || q < 1 || q > 1e7) return err("err.amount");
      const i = impact(q);
      if (msg.t === "buy") {
        const price = s.price * (1 + i / 2);
        const total = price * q * (1 + FEE);
        if (p.cash < total) return err("err.cashCost", { cost: total });
        p.cash = round2(p.cash - total);
        const old = qty(p, s.name);
        p.avg[s.name] = ((p.avg[s.name] || 0) * old + total) / (old + q);
        p.holdings[s.name] = old + q;
        s.price = round2(s.price * (1 + i));
      } else if (msg.t === "sell") {
        if (qty(p, s.name) < q) return err("err.notEnoughShares", { n: qty(p, s.name), company: s.name });
        const price = s.price * (1 - i / 2);
        p.cash = round2(p.cash + price * q * (1 - FEE));
        p.holdings[s.name] -= q;
        if (!p.holdings[s.name]) { delete p.holdings[s.name]; delete p.avg[s.name]; }
        s.price = round2(Math.max(0.01, s.price * (1 - i)));
      } else if (msg.t === "short") {
        if (s.ownerId === p.id) return err("err.shortOwn");
        const price = s.price * (1 - i / 2);
        const margin = price * q * SHORT_MARGIN, fee = price * q * FEE;
        if (p.cash < margin + fee) return err("err.shortCash", { amount: margin + fee });
        p.cash = round2(p.cash - margin - fee);
        const sh = p.shorts[s.name] || { qty: 0, entry: price, margin: 0 };
        sh.entry = (sh.entry * sh.qty + price * q) / (sh.qty + q);
        sh.qty += q; sh.margin += margin;
        p.shorts[s.name] = sh;
        s.price = round2(Math.max(0.01, s.price * (1 - i)));
      } else {
        const sh = p.shorts[s.name];
        if (!sh) return err("err.noShort");
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
    case "deal_offer": return dealOffer(room, p, msg, markActive);
    case "deal_accept": return dealAccept(room, p, msg, markActive);
    case "deal_decline": case "deal_cancel": return dealClose(room, p, msg, markActive);

    case "choice": {
      if (!p.pendingChoice) return err("err.noChoice");
      if (!isInt(msg.option)) return err("err.badChoice");
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
        if (room.pausedBy !== p.id) return err("err.alreadyPaused");
        room.dayEndsAt -= room.pausedUntil - now;
        room.pausedUntil = 0; room.pausedBy = null;
        addNews(room, [["news.resumed", { player: p.name }]]);
        return { ok: true };
      }
      if (p.pauseTokens <= 0) return err("err.noPauses");
      p.pauseTokens--;
      room.pausedUntil = now + PAUSE_MS; room.pausedBy = p.id;
      room.dayEndsAt += PAUSE_MS;
      addNews(room, [["news.paused", { player: p.name, n: PAUSE_MS / 1000 }]]);
      markActive();
      return { ok: true };
    }
  }
  return err("err.unknown");
}

function companyAction(room, p, msg, markActive) {
  const s = stockBy(room, msg.stock);
  if (!s || s.bankrupt) return err("err.unavailable");
  if (s.ownerId !== p.id) return err("err.notYours", { company: s.name });
  const spend = cost => {
    if (s.companyCash < cost) return err("err.companyCash", { company: s.name, cash: s.companyCash, cost });
    s.companyCash = round2(s.companyCash - cost);
    return null;
  };
  const ceoUp = (k, d) => { if (s.ceoId === p.id) s.ceo[k] = clamp(s.ceo[k] + d, 0, 100); };
  let e = null, part = null, kind = "info";

  switch (msg.action) {
    case "marketing":
      if ((e = spend(ACTION_COSTS.marketing))) return e;
      s.reputation = clamp(s.reputation + 8, 0, 100); s.price = round2(s.price * 1.025); ceoUp("leadership", 1);
      part = ["news.marketing", { company: s.name }]; break;
    case "employees":
      if ((e = spend(ACTION_COSTS.employees))) return e;
      s.employees += 100; s.volatility = Math.max(0.01, s.volatility - 0.003); ceoUp("leadership", 1);
      part = ["news.employees", { company: s.name }]; break;
    case "research":
      if ((e = spend(ACTION_COSTS.research))) return e;
      s.research = clamp(s.research + 8, 0, 100); s.price = round2(s.price * 1.03); ceoUp("innovation", 1);
      part = ["news.research", { company: s.name }]; break;
    case "factory":
      if ((e = spend(ACTION_COSTS.factory))) return e;
      s.factories++; s.employees += 120; s.price = round2(s.price * 1.05); ceoUp("leadership", 1);
      part = ["news.factory", { company: s.name, income: FACTORY_DAILY_INCOME }]; break;
    case "risk": {
      const prof = D.RISK_PROFILES[s.name];
      if (!prof) return err("err.noRisk", { company: s.name });
      if ((e = spend(ACTION_COSTS.risk))) return e;
      const ok = Math.random() < clamp(prof.chance + s.ceo.innovation / 600, 0.05, 0.88);
      s.reputation = clamp(s.reputation + (ok ? 5 : -6), 0, 100);
      s.price = round2(s.price * (ok ? prof.up : prof.down));
      part = [ok ? "news.riskOk" : "news.riskFail", { company: s.name }]; kind = ok ? "good" : "bad"; break;
    }
    case "product": {
      if ((e = spend(ACTION_COSTS.product))) return e;
      const name = pick(D.PRODUCT_IDEAS[s.name] || D.GENERIC_PRODUCTS);
      const ok = Math.random() < clamp(0.2 + s.research / 280 + s.reputation / 450 + s.ceo.innovation / 550, 0.08, 0.85);
      s.products.push({ name, result: ok ? "Hit" : "Flop" }); if (s.products.length > 10) s.products.shift();
      s.reputation = clamp(s.reputation + (ok ? 10 : -7), 0, 100); s.price = round2(s.price * (ok ? 1.16 : 0.93));
      part = [ok ? "news.productHit" : "news.productFlop", { company: s.name, product: name }]; kind = ok ? "good" : "bad"; break;
    }
    case "ceo":
      if (s.ceoId) return err("err.selfCeo");
      if ((e = spend(ACTION_COSTS.ceo))) return e;
      s.ceo = randomCeo();
      part = ["news.newCeo", { company: s.name, ceo: s.ceo.name }]; break;
    case "loan":
      if (s.debt + LOAN_AMOUNT > MAX_DEBT) return err("err.maxDebt", { amount: MAX_DEBT });
      s.companyCash += LOAN_AMOUNT; s.debt += LOAN_AMOUNT; s.reputation = clamp(s.reputation - 3, 0, 100);
      part = ["news.loanShort", { company: s.name, loan: LOAN_AMOUNT }]; break;
    case "repay": {
      const pay = Math.min(s.debt, s.companyCash, 50000);
      if (pay <= 0) return err(s.debt <= 0 ? "err.noDebt" : "err.noCashRepay", { company: s.name });
      s.companyCash = round2(s.companyCash - pay); s.debt = round2(s.debt - pay);
      part = ["news.repay", { company: s.name, amount: pay, debt: s.debt }]; kind = "good"; break;
    }
    case "dividend":
      if (![0, 10, 25, 50, 75].includes(msg.value)) return err("err.unknown");
      s.dividendRate = msg.value;
      part = ["news.dividendAll", { company: s.name, pct: s.dividendRate }]; break;
    case "market": {
      if (!MARKETS.includes(msg.value)) return err("err.unknown");
      if (s.markets.includes(msg.value)) return err("err.marketActive", { company: s.name, market: msg.value });
      if ((e = spend(MARKET_COSTS[msg.value]))) return e;
      if (Math.random() < MARKET_FAIL_CHANCE[msg.value]) {
        s.reputation = clamp(s.reputation - 10, 0, 100); s.price = round2(s.price * 0.95);
        part = ["news.marketFail", { company: s.name, market: msg.value }]; kind = "bad";
      } else {
        s.markets.push(msg.value); s.reputation = clamp(s.reputation + 7, 0, 100); s.price = round2(s.price * 1.07);
        part = ["news.marketOpen", { company: s.name, market: msg.value, pct: MARKET_INCOME_BONUS[msg.value] * 100 }]; kind = "good";
      }
      break;
    }
    case "inject": {
      if (![10000, 50000, 250000].includes(Number(msg.value)) && msg.value !== "all") return err("err.unknown");
      const a = Math.min(p.cash, msg.value === "all" ? p.cash : Number(msg.value));
      if (a < 1) return err("err.noCash");
      p.cash = round2(p.cash - a); s.companyCash = round2(s.companyCash + a);
      part = ["news.injectPlayer", { player: p.name, company: s.name, amount: a }]; break;
    }
    default: return err("err.unknown");
  }
  s.history[s.history.length - 1] = s.price;
  addNews(room, [part], kind);
  markActive();
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// Deals between players: swap shares and/or cash. Checked again when accepted.
// side = { cash, stock, qty }
// ═══════════════════════════════════════════════════════════════════════════

function cleanSide(room, side) {
  side = side && typeof side === "object" ? side : {};
  const cash = Number(side.cash) || 0;
  const q = Number(side.qty) || 0;
  if (!isInt(cash) || cash < 0 || cash > MAX_DEAL_CASH) return null;
  if (!isInt(q) || q < 0 || q > 1e7) return null;
  let stock = null;
  if (q > 0) {
    const s = stockBy(room, side.stock);
    if (!s || s.bankrupt) return null;
    stock = s.name;
  }
  return { cash, stock, qty: stock ? q : 0 };
}
const sideEmpty = s => !s.cash && !s.qty;
function canGive(p, side) {
  if (p.cash < side.cash) return false;
  if (side.qty && qty(p, side.stock) < side.qty) return false;
  return true;
}
function transfer(room, from, to, side) {
  if (side.cash) { from.cash = round2(from.cash - side.cash); to.cash = round2(to.cash + side.cash); }
  if (side.qty) {
    const s = stockBy(room, side.stock);
    from.holdings[side.stock] -= side.qty;
    if (!from.holdings[side.stock]) { delete from.holdings[side.stock]; delete from.avg[side.stock]; }
    const old = qty(to, side.stock);
    to.avg[side.stock] = ((to.avg[side.stock] || 0) * old + s.price * side.qty) / (old + side.qty);
    to.holdings[side.stock] = old + side.qty;
  }
}

function dealOffer(room, p, msg, markActive) {
  const to = room.players[msg.to];
  if (!to || to.id === p.id) return err("err.dealPlayer");
  const give = cleanSide(room, msg.give), want = cleanSide(room, msg.want);
  if (!give || !want) return err("err.dealInvalid");
  if (sideEmpty(give) && sideEmpty(want)) return err("err.dealEmpty");
  if (!canGive(p, give)) return err("err.dealYouLack");
  if (room.deals.filter(d => d.from === p.id).length >= MAX_OPEN_DEALS) return err("err.dealMax", { n: MAX_OPEN_DEALS });
  room.deals.push({ id: room.nextDealId++, from: p.id, to: to.id, give, want, day: room.day });
  markActive();
  return { ok: true, notify: to.id };
}

function dealAccept(room, p, msg, markActive) {
  const d = room.deals.find(x => x.id === msg.id && x.to === p.id);
  if (!d) return err("err.dealGone");
  const from = room.players[d.from];
  if (!from) { room.deals = room.deals.filter(x => x !== d); return err("err.dealGone"); }
  if (!canGive(from, d.give)) return err("err.dealTheyLack", { player: from.name });
  if (!canGive(p, d.want)) return err("err.dealYouLack");
  transfer(room, from, p, d.give);
  transfer(room, p, from, d.want);
  room.deals = room.deals.filter(x => x !== d);
  // A deal might now leave the other open offers impossible; they're re-checked on accept anyway.
  [d.give.stock, d.want.stock].filter(Boolean).forEach(n => updateOwnership(room, stockBy(room, n)));
  addNews(room, [["news.deal", { a: from.name, b: p.name }]], "good");
  markActive();
  return { ok: true, notify: from.id };
}

function dealClose(room, p, msg, markActive) {
  const d = room.deals.find(x => x.id === msg.id && (msg.t === "deal_cancel" ? x.from === p.id : x.to === p.id));
  if (!d) return err("err.dealGone");
  room.deals = room.deals.filter(x => x !== d);
  markActive();
  return { ok: true, notify: msg.t === "deal_decline" ? d.from : d.to, declined: msg.t === "deal_decline" };
}

// ═══════════════════════════════════════════════════════════════════════════
// Choices
// ═══════════════════════════════════════════════════════════════════════════

function resolveChoice(room, p, index) {
  const pc = p.pendingChoice;
  const ev = D.CHOICE_EVENTS.find(e => e.id === pc.id);
  const s = stockBy(room, pc.stock);
  p.pendingChoice = null;
  if (!ev || !s || s.bankrupt || s.ownerId !== p.id) return { ok: true };
  const opt = ev.options[index];
  if (!opt) { p.pendingChoice = pc; return err("err.badChoice"); }
  if (opt.pay && s.companyCash < opt.pay) { p.pendingChoice = pc; return err("err.choiceCash"); }
  if (opt.pay) s.companyCash = round2(s.companyCash - opt.pay);
  addNews(room, [opt.run(s)]);
  s.history[s.history.length - 1] = s.price;
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// Time
// ═══════════════════════════════════════════════════════════════════════════

function tick(room, now) {
  if (room.phase !== "playing") return false;
  let changed = false;
  if (room.pausedUntil) {
    if (now < room.pausedUntil) return false;
    room.pausedUntil = 0; room.pausedBy = null; changed = true;
  }
  if (!Object.values(room.players).some(p => p.connected)) {
    room.dayEndsAt = now + SPEEDS[room.settings.speed];
    return changed;
  }
  // Next day early when every connected player is ready (or away), and at least one actually asked for it.
  // If everyone is merely idle, the normal timer runs, so an empty-handed room never races ahead.
  const online = Object.values(room.players).filter(p => p.connected);
  const wants = p => p.skip || p.autoSkip;
  const allSkip = online.some(wants) && online.every(p => wants(p) || isAfk(room, p));
  if (now >= room.dayEndsAt || allSkip) {
    advanceDay(room);
    room.dayEndsAt = now + SPEEDS[room.settings.speed];
    changed = true;
  }
  return changed;
}

function advanceDay(room) {
  const ev = pick(D.MARKET_EVENTS);
  const mult = typeof ev.multiplier === "function" ? ev.multiplier() : ev.multiplier;
  const notes = [];
  const players = Object.values(room.players);
  players.forEach(p => { p.lastDividend = 0; });

  players.forEach(p => {
    if (p.pendingChoice) {
      const ev2 = D.CHOICE_EVENTS.find(e => e.id === p.pendingChoice.id);
      resolveChoice(room, p, ev2 ? ev2.options.length - 1 : 0);
    }
  });

  room.stocks.forEach(s => {
    if (s.bankrupt) return;
    const profit = calcProfit(room, s);
    if (s.ownerId && profit > 0) {
      const pool = profit * s.dividendRate / 100;
      const holders = players.filter(p => qty(p, s.name) > 0);
      const total = holders.reduce((tt, p) => tt + qty(p, s.name), 0);
      holders.forEach(p => { const d = pool * qty(p, s.name) / total; p.cash = round2(p.cash + d); p.lastDividend += d; });
      s.companyCash += profit - pool;
    } else s.companyCash += profit;
    if (!s.ownerId) aiManage(s);
    s.companyCash = round2(s.companyCash);

    let price = s.price;
    if (ev.affected === "*" || ev.affected.includes(s.name)) price *= mult;
    if (s.name === "EuroBank") price *= Math.random() > 0.5 ? 1.002 : 0.998;
    else price += (Math.random() - 0.5) * s.volatility * price;
    price *= 1 + dailyDrift(s);
    if (room.recession) price *= s.recession;
    if (room.depression) price *= 0.985;
    if (s.name === "SpaceY" && price > 1200 && Math.random() < 0.18) { price *= 0.55; notes.push(["news.bubble", {}]); }
    if (Math.random() < 0.008 * ((100 - s.ceo.reliability) / 100)) { price *= 0.92; s.reputation = clamp(s.reputation - 8, 0, 100); notes.push(["news.scandal", { company: s.name }]); }

    s.price = round2(Math.max(0, price));
    s.history.push(s.price);
    if (s.history.length > HISTORY_LEN) s.history.shift();
    if (s.price < 1.5 || s.companyCash < -300000) bankrupt(room, s, notes);
  });

  players.forEach(p => {
    for (const n of Object.keys(p.shorts)) {
      const sh = p.shorts[n], s = stockBy(room, n);
      const fee = sh.qty * s.price * SHORT_DAILY_FEE;
      if (p.cash >= fee) p.cash = round2(p.cash - fee); else sh.margin -= fee;
      const eq = shortEquity(room, p, n);
      if (eq < sh.qty * s.price * SHORT_MARGIN_CALL) {
        p.cash = round2(p.cash + Math.max(0, eq));
        delete p.shorts[n];
        notes.push(["news.marginCallPlayer", { player: p.name, company: n }]);
      }
    }
  });

  const roll = Math.random();
  let headline = [`event.${ev.id}`, {}], kind = "info";
  if (room.depression) {
    room.depressionDays++;
    if (room.depressionDays >= 6 && roll < 0.25) { room.depression = false; room.depressionDays = 0; headline = ["news.depressionOver", {}]; kind = "good"; }
  } else if (room.recession) {
    room.recessionDays++;
    if (room.recessionDays >= 8 && roll < 0.12) {
      room.recession = false; room.recessionDays = 0; room.depression = true; room.depressionDays = 1;
      room.stocks.forEach(s => { if (!s.bankrupt) { s.price = round2(s.price * 0.6); s.history[s.history.length - 1] = s.price; } });
      headline = ["news.depression", {}]; kind = "bad";
    } else if (room.recessionDays >= 5 && roll < 0.28) { room.recession = false; room.recessionDays = 0; headline = ["news.recovery", { event: ev.id }]; kind = "good"; }
  } else if (roll < 0.035) { room.recession = true; room.recessionDays = 1; headline = ["news.recession", { event: ev.id }]; kind = "bad"; }
  addNews(room, [headline, ...notes], kind);

  room.day++;
  players.forEach(p => { if (!p.autoSkip) p.skip = false; });
  room.deals = room.deals.filter(d => room.day - d.day <= DEAL_DAYS);

  players.forEach(p => {
    if (!p.connected || p.pendingChoice) return;
    const owned = room.stocks.filter(s => s.ownerId === p.id);
    if (owned.length && Math.random() < CHOICE_CHANCE) p.pendingChoice = { id: pick(D.CHOICE_EVENTS).id, stock: pick(owned).name, day: room.day };
  });

  room.stocks.forEach(s => updateOwnership(room, s));
  players.forEach(p => {
    const h = room.worth[p.id] || (room.worth[p.id] = []);
    h.push(round2(netWorth(room, p)));
    if (h.length > WORTH_HISTORY_LEN) h.shift();
  });
  checkEnd(room);
}

function aiManage(s) {
  if (s.companyCash > 150000 && Math.random() < 0.03) { s.companyCash -= FACTORY_COST; s.factories++; s.employees += 120; }
  else if (s.companyCash > 60000 && Math.random() < 0.04) { s.companyCash -= 20000; s.research = clamp(s.research + 5, 0, 100); }
}

function bankrupt(room, s, notes) {
  s.bankrupt = true; s.price = 0; s.employees = 0; s.companyCash = 0; s.debt = 0;
  notes.push(["news.bankrupt", { company: s.name }]);
  Object.values(room.players).forEach(p => {
    const sh = p.shorts[s.name];
    if (sh) { p.cash = round2(p.cash + sh.margin + sh.entry * sh.qty); delete p.shorts[s.name]; }
  });
  room.deals = room.deals.filter(d => d.give.stock !== s.name && d.want.stock !== s.name);
  updateOwnership(room, s);
}

function checkEnd(room) {
  const players = Object.values(room.players);
  if (!players.length) return;
  const target = TARGETS[room.settings.target];
  const ranked = players.slice().sort((a, b) => netWorth(room, b) - netWorth(room, a));
  if (netWorth(room, ranked[0]) >= target) endGame(room, ranked[0].id, ["end.target", { player: ranked[0].name, target }]);
  else if (room.settings.dayLimit && room.day > room.settings.dayLimit) endGame(room, ranked[0].id, ["end.days", { player: ranked[0].name, days: room.settings.dayLimit }]);
}
function endGame(room, winnerId, reason) {
  room.phase = "ended"; room.winnerId = winnerId; room.end = reason;
  addNews(room, [reason], "good");
}

// ═══════════════════════════════════════════════════════════════════════════
// What a player gets to see. Choices and deals stay private.
// ═══════════════════════════════════════════════════════════════════════════

function viewFor(room, playerId, now) {
  const me = room.players[playerId];
  let choice = null;
  if (me && me.pendingChoice) {
    const ev = D.CHOICE_EVENTS.find(e => e.id === me.pendingChoice.id);
    const s = stockBy(room, me.pendingChoice.stock);
    if (ev && s) choice = { id: ev.id, stock: s.name, companyCash: s.companyCash, options: ev.options.map(o => ({ pay: o.pay || 0 })) };
  }
  const players = room.order.map(id => room.players[id]).filter(Boolean).map(p => ({
    id: p.id, name: p.name, color: p.color, connected: p.connected,
    netWorth: room.phase === "lobby" ? p.cash : round2(netWorth(room, p)),
    cash: p.cash, holdings: p.holdings, skip: p.skip || p.autoSkip,
    afk: room.phase === "playing" && isAfk(room, p),
  }));
  return {
    code: room.code, phase: room.phase, hostId: room.hostId, settings: room.settings,
    day: room.day, dayMs: SPEEDS[room.settings.speed], dayEndsAt: room.dayEndsAt,
    pausedUntil: room.pausedUntil, pausedBy: room.pausedBy, serverNow: now,
    recession: room.recession, depression: room.depression, target: TARGETS[room.settings.target],
    stocks: room.stocks.map(s => ({ ...s, profit: round2(calcProfit(room, s)), income: round2(calcIncome(room, s)), costs: round2(calcCosts(room, s)), interest: interestRate(s), hasRisk: !!D.RISK_PROFILES[s.name] })),
    players, news: room.news.slice(0, 15), chat: room.chat.slice(-40),
    deals: me ? room.deals.filter(d => d.from === me.id || d.to === me.id) : [],
    worth: room.phase === "ended" ? room.worth : null,
    winnerId: room.winnerId, end: room.end,
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
  _internal: { advanceDay, netWorth, updateOwnership, stockBy },
};
