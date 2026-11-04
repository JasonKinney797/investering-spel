"use strict";
// Investeer Simulator — online game server.
// One Node.js process: serves the website (HTTP) and runs the games (WebSocket on /ws).
// Start with:  npm install  &&  npm start   →  http://localhost:8080/online.html

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const engine = require("./engine");

const PORT = Number(process.env.PORT) || 8080;
const ROOT = path.resolve(__dirname, "..");
const TICK_MS = 250;
const MAX_ROOMS = 500;
const EMPTY_ROOM_TTL = 30 * 60 * 1000;       // delete a room 30 min after the last player left
const MSG_PER_SEC = 20;
const CHAT_GAP_MS = 700;
const LOBBY_GRACE_MS = 20000;               // lobby seat is kept this long after a disconnect

// ─── Static website ──────────────────────────────────────────────────────────

const STATIC_FILES = new Set(["/index.html", "/online.html", "/style.css", "/online.css", "/game.js", "/online.js"]);
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true, rooms: rooms.size, players: playerCount() }));
  }
  const file = url.pathname === "/" ? "/index.html" : url.pathname;
  if (req.method !== "GET" || !STATIC_FILES.has(file)) { res.writeHead(404); return res.end("Niet gevonden"); }
  fs.readFile(path.join(ROOT, file), (err, data) => {
    if (err) { res.writeHead(404); return res.end("Niet gevonden"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)], "cache-control": "no-cache" });
    res.end(data);
  });
});

// ─── Rooms & sessions ────────────────────────────────────────────────────────

const rooms = new Map();     // code → room (engine state)
const sockets = new Map();   // code → Set<ws>
const tokens = new Map();    // secret token → { code, id }   (lets a player reconnect)

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode() {
  for (let i = 0; i < 50; i++) {
    let c = ""; for (let j = 0; j < 4; j++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
  return null;
}
const newId = () => crypto.randomBytes(6).toString("hex");        // public, visible to other players
const newToken = () => crypto.randomBytes(18).toString("base64url"); // secret, only for this player

function playerCount() { let n = 0; sockets.forEach(s => { n += s.size; }); return n; }

function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }

function broadcast(code) {
  const room = rooms.get(code); const set = sockets.get(code);
  if (!room || !set) return;
  const now = Date.now();
  set.forEach(ws => send(ws, { t: "state", room: engine.viewFor(room, ws.playerId, now) }));
}

function attach(ws, code, id, token) {
  // A player may only have one live connection: close an older one (e.g. another tab).
  const set = sockets.get(code) || new Set();
  set.forEach(other => { if (other !== ws && other.playerId === id) { other.replaced = true; other.close(4000, "Elders geopend"); } });
  set.add(ws); sockets.set(code, set);
  ws.roomCode = code; ws.playerId = id;
  const room = rooms.get(code);
  room.players[id].connected = true;
  room.emptySince = 0;
  send(ws, { t: "joined", code, token, id });
}

function detach(ws) {
  const code = ws.roomCode; if (!code) return;
  const set = sockets.get(code); if (set) set.delete(ws);
  const room = rooms.get(code);
  ws.roomCode = null;
  if (!room || ws.replaced) return;
  const p = room.players[ws.playerId];
  if (!p) return;
  if (room.phase === "lobby") {
    p.connected = false; p.leftAt = Date.now(); // removed after a short grace period (page reloads)
  } else {
    p.connected = false;
    engine.addNews(room, `${p.name} heeft de verbinding verbroken.`);
  }
  if (!set || set.size === 0) room.emptySince = Date.now();
  broadcast(code);
}

// ─── Message handling ────────────────────────────────────────────────────────

function handle(ws, msg) {
  if (!msg || typeof msg.t !== "string") return;
  const room = ws.roomCode ? rooms.get(ws.roomCode) : null;

  switch (msg.t) {
    case "create": {
      if (room) return send(ws, { t: "error", text: "Je zit al in een kamer." });
      if (rooms.size >= MAX_ROOMS) return send(ws, { t: "error", text: "De server is vol. Probeer later opnieuw." });
      const code = newCode();
      if (!code) return send(ws, { t: "error", text: "Kon geen kamer maken." });
      const r = engine.createRoom(code, msg.settings);
      rooms.set(code, r);
      const id = newId(); const token = newToken();
      engine.addPlayer(r, id, msg.name);
      tokens.set(token, { code, id });
      attach(ws, code, id, token);
      return broadcast(code);
    }
    case "join": {
      if (room) return send(ws, { t: "error", text: "Je zit al in een kamer." });
      const code = String(msg.code || "").toUpperCase().trim();
      const r = rooms.get(code);
      if (!r) return send(ws, { t: "error", text: `Kamer ${code || "?"} bestaat niet.` });
      const id = newId(); const token = newToken();
      const res = engine.addPlayer(r, id, msg.name);
      if (res.error) return send(ws, { t: "error", text: res.error });
      tokens.set(token, { code, id });
      attach(ws, code, id, token);
      return broadcast(code);
    }
    case "rejoin": {
      const info = tokens.get(String(msg.token || ""));
      if (!info || !rooms.has(info.code) || !rooms.get(info.code).players[info.id]) return send(ws, { t: "rejoin-failed" });
      attach(ws, info.code, info.id, msg.token);
      engine.addNews(rooms.get(info.code), `${rooms.get(info.code).players[info.id].name} is terug.`);
      return broadcast(info.code);
    }
  }

  if (!room) return send(ws, { t: "error", text: "Je zit niet in een kamer." });
  const p = room.players[ws.playerId];
  if (!p) return;

  switch (msg.t) {
    case "leave": {
      for (const [t, v] of tokens) if (v.code === room.code && v.id === p.id) tokens.delete(t);
      const code = room.code;
      if (room.phase === "lobby") { detach(ws); engine.removePlayer(room, p.id); broadcast(code); }
      else { const set = sockets.get(code); if (set) set.delete(ws); ws.roomCode = null; p.connected = false; engine.addNews(room, `${p.name} heeft het spel verlaten.`); broadcast(code); }
      return send(ws, { t: "left" });
    }
    case "settings":
      if (room.hostId !== p.id || room.phase !== "lobby") return;
      room.settings = engine.sanitizeSettings(msg.settings, room.settings);
      return broadcast(room.code);
    case "start":
      if (room.hostId !== p.id) return send(ws, { t: "error", text: "Alleen de host kan starten." });
      if (room.phase !== "lobby") return;
      engine.startGame(room, Date.now());
      return broadcast(room.code);
    case "chat": {
      const text = String(msg.text || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 160);
      if (!text) return;
      const now = Date.now();
      if (now - (ws.lastChat || 0) < CHAT_GAP_MS) return;
      ws.lastChat = now;
      room.chat.push({ id: p.id, name: p.name, color: p.color, text, at: now });
      if (room.chat.length > 60) room.chat.shift();
      return broadcast(room.code);
    }
    default: {
      const res = engine.handleAction(room, p, msg, Date.now());
      if (res.error) send(ws, { t: "error", text: res.error });
      broadcast(room.code);
    }
  }
}

// ─── WebSocket server ────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 4096 });

wss.on("connection", ws => {
  ws.isAlive = true;
  ws.bucket = MSG_PER_SEC; ws.bucketAt = Date.now();
  ws.on("pong", () => { ws.isAlive = true; });
  ws.on("message", raw => {
    // Simple rate limit: refill MSG_PER_SEC tokens per second.
    const now = Date.now();
    ws.bucket = Math.min(MSG_PER_SEC, ws.bucket + (now - ws.bucketAt) / 1000 * MSG_PER_SEC); ws.bucketAt = now;
    if (ws.bucket < 1) return;
    ws.bucket--;
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    try { handle(ws, msg); } catch (e) { console.error("handle error", e); send(ws, { t: "error", text: "Serverfout." }); }
  });
  ws.on("close", () => detach(ws));
  ws.on("error", () => {});
});

// Game clock: advance days, clean up empty rooms.
setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, code) => {
    const set = sockets.get(code);
    if ((!set || set.size === 0) && room.emptySince && now - room.emptySince > EMPTY_ROOM_TTL) {
      rooms.delete(code); sockets.delete(code);
      for (const [t, v] of tokens) if (v.code === code) tokens.delete(t);
      return;
    }
    if (room.phase === "lobby") {
      const gone = Object.values(room.players).filter(p => !p.connected && now - (p.leftAt || 0) > LOBBY_GRACE_MS);
      if (gone.length) {
        gone.forEach(p => {
          engine.removePlayer(room, p.id);
          for (const [t, v] of tokens) if (v.code === code && v.id === p.id) tokens.delete(t);
        });
        broadcast(code);
      }
    }
    if (engine.tick(room, now)) broadcast(code);
  });
}, TICK_MS);

// Drop connections that stopped answering (phone went to sleep, network lost).
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false; ws.ping();
  });
}, 30000);

server.listen(PORT, () => console.log(`Investeer Simulator server op http://localhost:${PORT}  (online: /online.html)`));

module.exports = { server, rooms };
