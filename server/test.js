"use strict";
// End-to-end test: starts the real server on a free port and plays with fake clients.
// Run with: npm test
const assert = require("assert");
const { WebSocket } = require("ws");

process.env.PORT = process.env.TEST_PORT || "18080";
const { server, rooms } = require("./server");
const engine = require("./engine");
const URL = `ws://localhost:${process.env.PORT}/ws`;

function client(name) {
  const ws = new WebSocket(URL);
  const c = { ws, name, state: null, errors: [], token: null, waiters: [] };
  ws.on("message", raw => {
    const m = JSON.parse(raw);
    if (m.t === "state") c.state = m.room;
    if (m.t === "joined") c.token = m.token;
    if (m.t === "error") c.errors.push(m.key);
    if (m.t === "notice") (c.notices = c.notices || []).push(m.kind);
    c.waiters = c.waiters.filter(w => !w(m));
  });
  c.send = obj => ws.send(JSON.stringify(obj));
  c.until = (pred, ms = 3000) => new Promise((res, rej) => {
    if (c.state && pred(c.state)) return res(c.state);
    const t = setTimeout(() => rej(new Error(`${name}: timeout after step "${step}" (day ${c.state && c.state.day}, errors: ${c.errors.slice(-2).join(" | ")})`)), ms);
    c.waiters.push(m => { if (m.t === "state" && pred(m.room)) { clearTimeout(t); res(m.room); return true; } return false; });
  });
  c.open = new Promise(r => ws.on("open", r));
  return c;
}
let step = "start";
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => server.listening ? r() : server.once("listening", r));
  const a = client("Anna"), b = client("Bram"), x = client("Xavi");
  await Promise.all([a.open, b.open, x.open]);

  // Lobby
  step = 'Lobby';
  a.send({ t: "create", name: "Anna", settings: { speed: "turbo", target: "1m", startCash: 250000, dayLimit: 50 } });
  const s0 = await a.until(s => s.phase === "lobby");
  const code = s0.code;
  assert.match(code, /^[A-Z2-9]{4}$/);
  b.send({ t: "join", code, name: "Bram" });
  x.send({ t: "join", code: "ZZZZ", name: "Xavi" });
  await a.until(s => s.players.length === 2);
  await sleep(100);
  assert.ok(x.errors.includes("err.noRoom"), "bad code rejected");
  b.send({ t: "start" });
  await sleep(100);
  assert.ok(b.errors.includes("err.hostOnly"), "only host can start");
  a.send({ t: "settings", settings: { speed: "calm", target: "nonsense" } });
  await a.until(s => s.settings.speed === "calm" && s.settings.target === "1m");
  a.send({ t: "start" });
  await b.until(s => s.phase === "playing" && s.day === 1);

  // Trading + ownership
  step = 'Trading + ownership';
  a.send({ t: "buy", stock: "EuroBank", qty: 60 });
  await b.until(s => s.stocks.find(x => x.name === "EuroBank").ownerId === s.players.find(p => p.name === "Anna").id);
  b.send({ t: "buy", stock: "EuroBank", qty: 120 });
  const s1 = await a.until(s => s.stocks.find(x => x.name === "EuroBank").ownerId === s.players.find(p => p.name === "Bram").id);
  assert.ok(s1.news.some(n => n.parts[0][0] === "news.takeoverPlayer" && n.parts[0][1].company === "EuroBank"), "takeover news");
  assert.strictEqual(s1.stocks.length, 10, "10 companies online");
  assert.strictEqual(s1.stocks.find(x => x.name === "EuroBank").ceo.name, "Bram", "Bram is CEO at 100+");

  // Validation: no cheating
  step = 'Validation: no cheating';
  const before = a.state.me.cash;
  for (const bad of [{ t: "buy", stock: "EuroBank", qty: -5 }, { t: "buy", stock: "EuroBank", qty: 1.5 }, { t: "buy", stock: "Nope", qty: 1 },
    { t: "sell", stock: "SpaceY", qty: 10 }, { t: "company", stock: "EuroBank", action: "factory" }, { t: "buy", stock: "TechNova", qty: 1e9 }]) a.send(bad);
  await sleep(200);
  assert.strictEqual(a.state.me.cash, before, "invalid actions change nothing");
  assert.ok(a.errors.length >= 5, "errors reported");

  // Round trip loses money (fees + price impact): no free money
  step = 'Round trip loses money (fees + price impact): no free money';
  const c0 = a.state.me.cash;
  a.send({ t: "buy", stock: "TechNova", qty: 200 }); await sleep(80);
  a.send({ t: "sell", stock: "TechNova", qty: 200 }); await sleep(120);
  assert.ok(a.state.me.cash < c0, "round trip costs money");

  // Company action by owner, dividend, choice resolution is private
  step = 'Company action by owner, dividend, choice resolution is private';
  b.send({ t: "company", stock: "EuroBank", action: "dividend", value: 75 });
  await a.until(s => s.stocks.find(x => x.name === "EuroBank").dividendRate === 75);
  b.send({ t: "company", stock: "EuroBank", action: "factory" });
  await a.until(s => s.stocks.find(x => x.name === "EuroBank").factories === 1);

  // Skip: both skip → next day immediately (calm = 20 s timer, so this proves the vote works)
  step = 'Skip: both skip → next day immediately (calm = 20 s timer, so this proves the vote works)';
  const d = a.state.day;
  a.send({ t: "skip", on: true }); b.send({ t: "skip", on: true });
  await a.until(s => s.day === d + 1, 1500);
  await b.until(s => s.day === d + 1, 1500);
  // Dividend paid pro rata to both holders of EuroBank (Anna 60, Bram 120)
  step = 'Dividend paid pro rata to both holders of EuroBank (Anna 60, Bram 120)';
  assert.ok(a.state.me.lastDividend > 0 && b.state.me.lastDividend > a.state.me.lastDividend, "pro-rata dividend");
  assert.ok(!a.state.players.some(p => p.skip), "skip resets each day");

  // Auto-skip stays on
  step = 'Auto-skip stays on';
  a.send({ t: "autoskip", on: true }); b.send({ t: "autoskip", on: true });
  await a.until(s => s.day >= d + 3, 2500);
  a.send({ t: "autoskip", on: false }); b.send({ t: "autoskip", on: false });
  await sleep(150);

  // Pause: stops the clock even when everyone wants to skip
  step = 'Pause: stops the clock even when everyone wants to skip';
  a.send({ t: "pause" });
  await a.until(s => s.pausedUntil > 0);
  const pd = a.state.day;
  b.send({ t: "skip", on: true }); a.send({ t: "skip", on: true });
  await sleep(600);
  assert.strictEqual(a.state.day, pd, "paused: no new day");
  a.send({ t: "pause" }); // resume early (only the pauser)
  await a.until(s => s.day === pd + 1, 1500);
  assert.strictEqual(a.state.me.pauseTokens, 1, "one pause token used");

  // Disconnect + rejoin with token keeps holdings
  step = 'Disconnect + rejoin with token keeps holdings';
  const tokenB = b.token;
  b.ws.close();
  await a.until(s => s.players.find(p => p.name === "Bram").connected === false);
  const b2 = client("Bram2"); await b2.open;
  b2.send({ t: "rejoin", token: tokenB });
  const sb = await b2.until(s => s.me && s.me.name === "Bram");
  assert.strictEqual(sb.me.holdings.EuroBank, 120, "holdings kept after rejoin");
  b2.send({ t: "rejoin", token: "fake-token" });

  // Deals: offer → notice → accept swaps assets atomically; invalid offers rejected
  step = "Deals";
  const bId = a.state.players.find(p => p.name === "Bram").id;
  const aId = a.state.me.id;
  a.send({ t: "deal_offer", to: aId, give: { cash: 10 }, want: {} });               // to yourself
  a.send({ t: "deal_offer", to: bId, give: {}, want: {} });                         // empty
  a.send({ t: "deal_offer", to: bId, give: { stock: "SpaceY", qty: 5 }, want: {} }); // shares you don't have
  a.send({ t: "deal_offer", to: bId, give: { cash: -5 }, want: { cash: 1 } });      // negative
  await sleep(200);
  ["err.dealPlayer", "err.dealEmpty", "err.dealYouLack", "err.dealInvalid"].forEach(k => assert.ok(a.errors.includes(k), "deal error " + k));
  const aCash0 = a.state.me.cash;
  a.send({ t: "deal_offer", to: bId, give: { cash: 5000 }, want: { stock: "EuroBank", qty: 10 } });
  const sDeal = await b2.until(s => s.deals.length === 1);
  await sleep(100);
  assert.ok((b2.notices || []).includes("dealOffer"), "receiver notified");
  assert.strictEqual(x.state && x.state.deals ? x.state.deals.length : 0, 0, "deals are private");
  b2.send({ t: "deal_accept", id: sDeal.deals[0].id });
  const sAfter = await a.until(s => s.deals.length === 0 && (s.me.holdings.EuroBank || 0) === 70);
  assert.ok(Math.abs(sAfter.me.cash - (aCash0 - 5000)) < 0.01, "cash moved");
  await b2.until(s => s.me.holdings.EuroBank === 110);
  assert.ok(sAfter.news.some(n => n.parts[0][0] === "news.deal"), "deal news");
  a.send({ t: "deal_accept", id: 999 });
  await sleep(100);
  assert.ok(a.errors.includes("err.dealGone"), "unknown deal rejected");

  // Chat is sanitized and rate limited
  step = 'Chat is sanitized and rate limited';
  a.send({ t: "chat", text: "hoi <b>allemaal</b>" }); a.send({ t: "chat", text: "spam" });
  await sleep(200);
  assert.strictEqual(a.state.chat.length, 1, "chat rate limit");

  // Ownership privacy: other players can't see someone's pending choice
  step = "Ownership privacy: other players can't see someone's pending choice";
  const room = rooms.get(code);
  const anna = Object.values(room.players).find(p => p.name === "Anna");
  room.stocks.find(s => s.name === "GreenVolt").ownerId = anna.id;
  anna.pendingChoice = { id: "influencer", stock: "GreenVolt", day: room.day };
  const viewA = engine.viewFor(room, anna.id, Date.now());
  const viewB = engine.viewFor(room, Object.values(room.players).find(p => p.name === "Bram").id, Date.now());
  assert.ok(viewA.me.choice && !viewB.me.choice, "choice is private");
  // Unanswered choice → safe default at next day
  step = 'Unanswered choice → safe default at next day';
  engine._internal.advanceDay(room);
  assert.strictEqual(anna.pendingChoice === null || anna.pendingChoice.day === room.day, true, "choice auto-resolved");

  // Long simulation: no NaN, game ends by target or day limit
  step = 'Long simulation: no NaN, game ends by target or day limit';
  for (let i = 0; i < 400 && room.phase === "playing"; i++) {
    engine._internal.advanceDay(room);
    for (const s of room.stocks) assert.ok(Number.isFinite(s.price) && Number.isFinite(s.companyCash), "finite numbers");
    for (const p of Object.values(room.players)) assert.ok(Number.isFinite(p.cash), "finite cash");
  }
  assert.strictEqual(room.phase, "ended", "game ends (day limit 50)");
  assert.ok(room.winnerId, "winner chosen");
  const endView = engine.viewFor(room, anna.id, Date.now());
  assert.ok(endView.worth && endView.worth[anna.id].length > 40, "net worth history for the end chart");
  assert.ok(Array.isArray(endView.end) && endView.end[0].startsWith("end."), "end reason is a translation key");

  // AFK players count as skipping
  step = 'AFK players count as skipping';
  const r2 = engine.createRoom("TEST", { speed: "calm" });
  engine.addPlayer(r2, "p1", "Een"); engine.addPlayer(r2, "p2", "Twee");
  engine.startGame(r2, Date.now());
  r2.players.p2.lastActiveDay = -10; // AFK
  r2.players.p1.skip = true;
  assert.ok(engine.tick(r2, Date.now()), "AFK player does not block skipping");
  // Everyone on auto-skip for days (no other clicks) keeps skipping
  r2.players.p1.skip = false; r2.players.p1.autoSkip = true; r2.players.p2.autoSkip = true;
  r2.players.p1.lastActiveDay = r2.players.p2.lastActiveDay = -50;
  const dayBefore = r2.day;
  for (let i = 0; i < 10; i++) engine.tick(r2, Date.now());
  assert.strictEqual(r2.day, dayBefore + 10, "auto-skip players keep the game moving");
  // Everyone idle without skip: wait for the timer instead of racing ahead
  r2.players.p1.autoSkip = r2.players.p2.autoSkip = false; r2.players.p1.skip = r2.players.p2.skip = false;
  const idleDay = r2.day;
  engine.tick(r2, Date.now());
  assert.strictEqual(r2.day, idleDay, "idle room does not fast-forward");

  // Static files are served, other paths are not
  step = 'Static files are served, other paths are not';
  const get = p => new Promise(res => require("http").get(`http://localhost:${process.env.PORT}${p}`, r => { r.resume(); res(r.statusCode); }));
  assert.strictEqual(await get("/online.html"), 200);
  assert.strictEqual(await get("/lang/fr.js"), 200);
  assert.strictEqual(await get("/assets/sounds/buy.mp3"), 200);
  assert.strictEqual(await get("/companies.js"), 200);
  assert.strictEqual(await get("/lang/../server/engine.js"), 404);
  assert.strictEqual(await get("/server/engine.js"), 404);
  assert.strictEqual(await get("/../package.json"), 404);
  assert.strictEqual(await get("/health"), 200);

  console.log("✓ All server tests passed");
  [a, x, b2].forEach(c => c.ws.close());
  process.exit(0);
})().catch(e => { console.error("✗ Test failed:", e); process.exit(1); });
