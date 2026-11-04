"use strict";
(() => {

// ═══════════════════════════════════════════════════════════════════════════
// Server address
// ═══════════════════════════════════════════════════════════════════════════
// When this page is served by the game server itself (npm start, or Render), it
// connects to that same address. Anywhere else (GitHub Pages, or opening the
// file directly) it uses this server:
const SERVER_URL = "wss://investering-spel.onrender.com/ws";

const SESSION_KEY = "inv-online-session";
const NAME_KEY = "inv-online-name";
const SERVER_KEY = "inv-online-server";

function storageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function storageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
function storageDel(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }

function serverUrl() {
  const custom = (storageGet(SERVER_KEY) || "").trim();
  if (custom) return custom;
  if (/^https?:$/.test(location.protocol) && !/github\.io$/.test(location.hostname)) {
    return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
  }
  return SERVER_URL;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function fmt(v) { return isFinite(v) ? v.toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "∞"; }
function fmtShort(v) {
  if (!isFinite(v)) return "∞";
  const sign = v < 0 ? "−" : ""; const a = Math.abs(v);
  if (a >= 1e9) return `${sign}€${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}€${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${sign}€${(a / 1e3).toFixed(0)}K`;
  if (a >= 1e3) return `${sign}€${(a / 1e3).toFixed(1)}K`;
  return `${sign}€${a.toFixed(0)}`;
}
const badge = (t, c = "#7c3aed") => `<span class="badge" style="--c:${c}">${t}</span>`;
function btn(label, act, { arg = "", color = "#7c3aed", disabled = false, cls = "", title = "", extra = "" } = {}) {
  return `<button class="btn ${cls}" style="--c:${color}" data-act="${act}" data-arg="${esc(arg)}" ${extra} ${disabled ? "disabled" : ""} ${title ? `title="${esc(title)}"` : ""}>${label}</button>`;
}
function statBar(label, value, color) {
  return `<div class="statbar"><div class="statbar-top"><span>${label}</span><span>${Math.round(value)}/100</span></div><div class="bar"><div style="width:${clamp(value, 0, 100)}%;background:${color}"></div></div></div>`;
}
function sparkline(h) {
  h = h.slice(-30);
  if (h.length < 2) return `<svg class="spark" viewBox="0 0 120 36" aria-hidden="true"></svg>`;
  const min = Math.min(...h), max = Math.max(...h), r = max - min || 1;
  const pts = h.map((v, i) => `${(i / (h.length - 1) * 120).toFixed(1)},${(36 - (v - min) / r * 32 - 2).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${h[h.length - 1] >= h[0] ? "#22c55e" : "#ef4444"}" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
}
function dayChange(s) {
  const h = s.history; if (h.length < 2 || !h[h.length - 2]) return 0;
  return (h[h.length - 1] - h[h.length - 2]) / h[h.length - 2] * 100;
}

const toastRoot = $("toasts");
function toast(text, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`; el.textContent = text;
  toastRoot.appendChild(el);
  while (toastRoot.children.length > 3) toastRoot.firstChild.remove();
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, 2800);
}

// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════

let room = null;         // last view from the server
let clockOffset = 0;     // serverNow − Date.now()
let ws = null;
let connected = false;
let wantOpen = false;    // reconnect automatically while true
let retry = 0;
let pending = null;      // message to send once the socket is open
let lastNewsKey = "";

const ui = {
  tab: "market", amounts: {}, selected: null, chatDraft: "",
  name: storageGet(NAME_KEY) || "",
  joinCode: (new URLSearchParams(location.search).get("room") || "").toUpperCase().slice(0, 4),
  settings: { speed: "normal", target: "10m", startCash: 50000, dayLimit: 100 },
};

// ═══════════════════════════════════════════════════════════════════════════
// Connection
// ═══════════════════════════════════════════════════════════════════════════

function connect(first) {
  const url = serverUrl();
  if (!url) { setConn("Geen server ingesteld. Vul het serveradres in onder ‘Server’.", "bad"); return; }
  wantOpen = true;
  if (first) pending = first;
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) { if (ws.readyState === 1) flush(); return; }
  setConn("Verbinden met de server…");
  try { ws = new WebSocket(url); } catch { setConn("Ongeldig serveradres.", "bad"); return; }

  ws.onopen = () => {
    connected = true; retry = 0; setConn("");
    const sess = loadSession();
    if (sess && !pending) send({ t: "rejoin", token: sess.token });
    flush();
  };
  ws.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    onMessage(m);
  };
  ws.onclose = ev => {
    connected = false; ws = null;
    if (ev.code === 4000) { wantOpen = false; setConn("Dit spel is geopend in een ander tabblad of apparaat.", "bad"); return; }
    if (!wantOpen) return;
    retry++;
    const wait = Math.min(15000, 800 * 2 ** Math.min(retry, 5));
    setConn(retry > 2 ? `Geen verbinding. Opnieuw proberen over ${Math.round(wait / 1000)} s… (gratis servers kunnen tot 1 minuut nodig hebben om op te starten)` : "Verbinding kwijt. Opnieuw verbinden…", "bad");
    setTimeout(() => { if (wantOpen) connect(); }, wait);
  };
  ws.onerror = () => {};
}
function flush() { if (pending) { send(pending); pending = null; } }
function send(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); else pending = m; }

function setConn(text, kind = "") {
  const el = $("conn");
  el.hidden = !text; el.textContent = text; el.className = `conn ${kind}`;
}

function loadSession() { try { return JSON.parse(storageGet(SESSION_KEY) || "null"); } catch { return null; } }

function onMessage(m) {
  switch (m.t) {
    case "joined":
      storageSet(SESSION_KEY, JSON.stringify({ token: m.token, code: m.code }));
      history.replaceState(null, "", `?room=${m.code}`);
      break;
    case "rejoin-failed":
      storageDel(SESSION_KEY); room = null; render();
      break;
    case "left":
      storageDel(SESSION_KEY); room = null; ui.tab = "market";
      history.replaceState(null, "", location.pathname); render();
      break;
    case "error":
      toast(m.text, "warn");
      break;
    case "state": {
      const prevPhase = room && room.phase;
      room = m.room; clockOffset = room.serverNow - Date.now();
      const n = room.news[0]; const key = n ? `${n.day}|${n.text}` : "";
      if (key && key !== lastNewsKey && lastNewsKey && /⚔️|🏆|👔/.test(n.text)) toast(n.text, "big");
      lastNewsKey = key;
      if (prevPhase === "lobby" && room.phase === "playing") { ui.tab = "market"; toast("Het spel is begonnen!", "big"); }
      render();
      break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════════════════

const stockOwner = s => room.players.find(p => p.id === s.ownerId);
const myOwned = () => room.stocks.filter(s => s.ownerId === room.me.id && !s.bankrupt);

function renderHeader() {
  const stats = $("stats"), dayline = $("dayline"), progress = $("progress"), newsrow = $("newsrow"), bar = $("controlbar");
  if (!room || !room.me || room.phase === "lobby") {
    stats.innerHTML = ""; progress.innerHTML = ""; newsrow.innerHTML = ""; bar.hidden = true;
    dayline.textContent = room ? `Kamer ${room.code} • wachten op de start` : "Speel met vrienden op dezelfde beurs";
    return;
  }
  const me = room.me;
  const rank = room.players.slice().sort((a, b) => b.netWorth - a.netWorth).findIndex(p => p.id === me.id) + 1;
  const status = room.depression ? `<span style="color:#ef4444">⚠ DEPRESSIE</span>` : room.recession ? `<span style="color:#f97316">📉 RECESSIE</span>` : `<span style="color:#22c55e">📊 Normaal</span>`;
  dayline.innerHTML = `Dag ${room.day}${room.settings.dayLimit ? `/${room.settings.dayLimit}` : ""} • ${status} • Kamer <b>${esc(room.code)}</b>`;
  stats.innerHTML = [["Cash", fmtShort(me.cash), "#22c55e"], ["Totaal", fmtShort(me.netWorth), "#a78bfa"], ["Positie", `#${rank}/${room.players.length}`, "#f59e0b"]]
    .map(([l, v, c]) => `<div class="card stat"><span class="label">${l}</span><strong style="color:${c}">${v}</strong></div>`).join("");
  const pct = Math.min(100, me.netWorth / room.target * 100);
  progress.innerHTML = `<div class="progress-top"><span>Doel: ${fmtShort(room.target)}</span><span>${pct.toFixed(2)}%</span></div><div class="bar thin"><div style="width:${pct}%;background:${me.color}"></div></div>`;
  const n = room.news[0];
  newsrow.innerHTML = `<div class="card news ${n ? n.kind : ""}"><span class="kicker">Nieuws • dag ${n ? n.day : ""}</span><div>${n ? esc(n.text) : ""}</div></div>
    ${me.lastDividend > 0 ? `<div class="card news good mini"><span class="kicker">Dividend</span><strong>+${fmtShort(me.lastDividend)}</strong></div>` : ""}`;

  if (room.phase !== "playing") { bar.hidden = true; return; }
  bar.hidden = false;
  const active = room.players.filter(p => p.connected && !p.afk);
  const skipping = active.filter(p => p.skip).length;
  const paused = room.pausedUntil > Date.now() + clockOffset;
  bar.innerHTML = `
    <div class="timer" aria-label="Tijd tot de volgende dag">
      <div class="timer-top"><span id="timer-text">Dag ${room.day}</span><span>⏩ ${skipping}/${active.length}</span></div>
      <div class="bar"><div id="timer-fill" style="background:${paused ? "#f59e0b" : "#7c3aed"}"></div></div>
    </div>
    <button class="toggle ${me.skip ? "on" : ""}" data-act="skip" aria-pressed="${me.skip}" title="Volgende dag zodra iedereen klaar is">⏩ ${me.skip ? "Klaar" : "Skip"}</button>
    <button class="toggle ${me.autoSkip ? "on" : ""}" data-act="autoskip" aria-pressed="${me.autoSkip}" title="Altijd skippen: je hoeft niet elke dag te klikken">🔁 Auto</button>
    <button class="toggle ${paused ? "on" : ""}" data-act="pause" ${!paused && me.pauseTokens <= 0 ? "disabled" : ""} title="${paused ? (room.pausedBy === me.id ? "Hervatten" : "Gepauzeerd door een speler") : `Pauze 30 s (nog ${me.pauseTokens})`}">${paused ? "▶" : "⏸"} ${paused ? "" : me.pauseTokens}</button>`;
  updateTimer();
}

function updateTimer() {
  const fill = $("timer-fill"), text = $("timer-text");
  if (!fill || !room || room.phase !== "playing") return;
  const now = Date.now() + clockOffset;
  const paused = room.pausedUntil > now;
  const left = Math.max(0, room.dayEndsAt - now);
  if (paused) {
    fill.style.width = "100%";
    text.textContent = `⏸ Pauze ${Math.ceil((room.pausedUntil - now) / 1000)} s`;
  } else {
    fill.style.width = `${clamp(left / room.dayMs * 100, 0, 100)}%`;
    text.textContent = `Dag ${room.day} • nog ${Math.ceil(left / 1000)} s`;
  }
}
(function loop() { updateTimer(); requestAnimationFrame(loop); })();

function renderTabs() {
  const tabs = $("tabs");
  if (!room || room.phase === "lobby" || !room.me) { tabs.innerHTML = ""; return; }
  const owned = myOwned().length;
  const unread = room.chat.length;
  tabs.innerHTML = [["market", "📊 Markt"], ["company", `🏢 Mijn bedrijven${owned ? ` (${owned})` : ""}`], ["players", "🏆 Spelers"], ["chat", `💬 Chat${unread ? ` (${unread})` : ""}`], ["news", "📰 Nieuws"]]
    .map(([k, l]) => `<button class="tab ${ui.tab === k ? "on" : ""}" data-act="tab" data-arg="${k}">${l}</button>`).join("");
}

function renderMenu() {
  const url = serverUrl();
  return `<div class="grid menu">
    <div class="card span-all">
      <span class="label">Jouw naam</span>
      <input class="input" type="text" maxlength="16" placeholder="Bijv. Jason" data-field="name" data-focuskey="name" value="${esc(ui.name)}" autocomplete="nickname">
    </div>
    <div class="card">
      <span class="label">🆕 Nieuwe kamer maken</span>
      <div class="form-grid">
        ${select("Dagduur", "speed", [["calm", "Rustig — 20 s"], ["normal", "Normaal — 10 s"], ["turbo", "Turbo — 4 s"]], ui.settings.speed)}
        ${select("Doel", "target", [["1m", "€1 miljoen"], ["10m", "€10 miljoen"], ["100m", "€100 miljoen"], ["1b", "€1 miljard"]], ui.settings.target)}
        ${select("Startgeld", "startCash", [[10000, "€10K"], [50000, "€50K"], [250000, "€250K"]], ui.settings.startCash)}
        ${select("Max. dagen", "dayLimit", [[50, "50 dagen"], [100, "100 dagen"], [200, "200 dagen"], [0, "Geen limiet"]], ui.settings.dayLimit)}
      </div>
      <div class="mt12">${btn("Kamer maken", "create", { color: "#22c55e", cls: "lg wide" })}</div>
    </div>
    <div class="card">
      <span class="label">🔑 Meedoen met een code</span>
      <input class="input code-input" type="text" maxlength="4" placeholder="ABCD" data-field="joinCode" data-focuskey="code" value="${esc(ui.joinCode)}" autocapitalize="characters" autocomplete="off" spellcheck="false">
      <div class="mt12">${btn("Meedoen", "join", { color: "#a78bfa", cls: "lg wide" })}</div>
      <p class="muted small-t mt8">Vraag de code aan wie de kamer maakte, of open de link die je kreeg.</p>
    </div>
    <details class="card span-all server-box" ${url ? "" : "open"}>
      <summary class="label">⚙️ Server ${url ? `— ${esc(url)}` : "— niet ingesteld"}</summary>
      <p class="muted small-t">Laat leeg om automatisch te verbinden. Alleen nodig als deze pagina niet door de spelserver zelf wordt geserveerd (bijv. GitHub Pages).</p>
      <input class="input" type="text" placeholder="wss://jouw-server.onrender.com/ws" data-field="server" value="${esc(storageGet(SERVER_KEY) || "")}" spellcheck="false" autocomplete="off">
    </details>
    <div class="card span-all muted small-t lh">
      <b>Zo werkt het:</b> iedereen handelt op dezelfde beurs. Wie de meeste aandelen van een bedrijf heeft (minstens 50) bestuurt het, en het dividend gaat naar alle aandeelhouders. De dagen lopen vanzelf; als iedereen op ⏩ drukt gaat het sneller. Wie het eerst het doel haalt, of na de laatste dag het rijkst is, wint.
    </div>
  </div>`;
}
function select(label, key, opts, val) {
  return `<label class="field"><span class="label">${label}</span><select class="input" data-setting="${key}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
}

function renderLobby() {
  const me = room.me; const host = me.isHost;
  const link = `${location.origin}${location.pathname}?room=${room.code}`;
  const s = room.settings;
  const labels = { speed: { calm: "Rustig (20 s)", normal: "Normaal (10 s)", turbo: "Turbo (4 s)" }, target: { "1m": "€1M", "10m": "€10M", "100m": "€100M", "1b": "€1B" } };
  return `<div class="grid">
    <div class="card span-all lobby-code">
      <span class="label">Kamercode</span>
      <div class="code">${esc(room.code)}</div>
      <div class="btn-row center mt8">${btn("📋 Link kopiëren", "copy", { arg: link, color: "#06b6d4" })}${navigator.share ? btn("📤 Delen", "share", { arg: link, color: "#06b6d4" }) : ""}</div>
    </div>
    <div class="card">
      <span class="label">Spelers (${room.players.length}/8)</span>
      ${room.players.map(p => `<div class="sum-row"><span><span class="dot" style="background:${p.color}"></span>${esc(p.name)}${p.id === room.hostId ? " 👑" : ""}${p.id === me.id ? " (jij)" : ""}</span><span class="muted small-t">${p.connected ? "klaar" : "verbinden…"}</span></div>`).join("")}
    </div>
    <div class="card">
      <span class="label">Instellingen ${host ? "" : "(host kiest)"}</span>
      ${host ? `<div class="form-grid">
        ${select("Dagduur", "speed", [["calm", "Rustig — 20 s"], ["normal", "Normaal — 10 s"], ["turbo", "Turbo — 4 s"]], s.speed)}
        ${select("Doel", "target", [["1m", "€1 miljoen"], ["10m", "€10 miljoen"], ["100m", "€100 miljoen"], ["1b", "€1 miljard"]], s.target)}
        ${select("Startgeld", "startCash", [[10000, "€10K"], [50000, "€50K"], [250000, "€250K"]], s.startCash)}
        ${select("Max. dagen", "dayLimit", [[50, "50 dagen"], [100, "100 dagen"], [200, "200 dagen"], [0, "Geen limiet"]], s.dayLimit)}
      </div>` : `<div class="muted lh">Dag: ${labels.speed[s.speed]}<br>Doel: ${labels.target[s.target]}<br>Startgeld: ${fmtShort(s.startCash)}<br>Max. dagen: ${s.dayLimit || "geen limiet"}</div>`}
    </div>
    <div class="span-all btn-row center">
      ${host ? btn(room.players.length < 2 ? "▶ Start (alleen testen)" : "▶ Start het spel", "start", { color: "#22c55e", cls: "lg" }) : `<div class="muted">Wachten tot de host het spel start…</div>`}
      ${btn("Verlaten", "leave", { color: "#64748b", cls: "lg" })}
    </div>
  </div>`;
}

function renderMarket() {
  const me = room.me;
  return `<p class="fee-note">Kosten: <strong>0,6%</strong> per transactie. Grote orders verschuiven de koers voor iedereen.</p>
  <div class="grid">${room.stocks.map(s => {
    const q = me.holdings[s.name] || 0;
    const owner = stockOwner(s);
    const ch = dayChange(s); const up = ch >= 0;
    const sh = me.shorts[s.name];
    const others = room.players.filter(p => p.id !== me.id && (p.holdings[s.name] || 0) > 0)
      .sort((a, b) => b.holdings[s.name] - a.holdings[s.name]).slice(0, 3);
    const mineOwned = s.ownerId === me.id;
    return `<article class="stock ${s.bankrupt ? "dead" : ""}">
      <div class="stock-top">
        <div class="stock-id">
          <strong>${esc(s.name)}</strong>
          <div class="sub">${s.bankrupt ? "💀 Failliet" : `${esc(s.markets.join(", "))} • CEO ${esc(s.ceo.name)}`}</div>
          <div class="badges">
            ${owner ? badge(mineOwned ? "Jouw bedrijf" : `👑 ${esc(owner.name)}`, owner.color) : badge("Vrij", "#64748b")}
            ${sh ? badge(`Short ${sh.qty}`, "#ec4899") : ""}
          </div>
        </div>
        <div class="stock-price">
          <div class="price">€${fmt(s.price)}</div>
          <div class="chg" style="color:${up ? "#22c55e" : "#ef4444"}">${up ? "▲" : "▼"} ${Math.abs(ch).toFixed(1)}%</div>
          ${sparkline(s.history)}
        </div>
      </div>
      ${s.bankrupt ? "" : `
      <div class="trade-row">
        <input class="input" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="Aantal" autocomplete="off"
          data-amount="${esc(s.name)}" data-focuskey="amt-${esc(s.name)}" value="${esc(ui.amounts[s.name] || "")}" aria-label="Aantal ${esc(s.name)}">
        ${btn("Max", "max", { arg: s.name, color: "#64748b", cls: "small" })}
      </div>
      <div class="trade-btns">
        ${btn("Kopen", "buy", { arg: s.name, color: "#22c55e" })}
        ${btn(`Verkopen (${q})`, "sell", { arg: s.name, color: "#ef4444", disabled: !q })}
        ${sh ? btn("Short sluiten", "cover", { arg: s.name, color: "#ec4899" }) : btn("Short", "short", { arg: s.name, color: "#ec4899", disabled: mineOwned })}
      </div>
      <div class="hint">Jij: ${q}${others.length ? " • " + others.map(p => `<span style="color:${p.color}">${esc(p.name)} ${p.holdings[s.name]}</span>`).join(" • ") : ""}</div>`}
    </article>`;
  }).join("")}</div>`;
}

function renderCompany() {
  const owned = myOwned();
  if (!owned.length) return `<div class="card muted lh">Je bestuurt nog geen bedrijf. Koop minstens 50 aandelen, en meer dan elke andere speler, om de controle te krijgen.</div>`;
  if (!owned.some(s => s.name === ui.selected)) ui.selected = owned[0].name;
  const s = owned.find(x => x.name === ui.selected);
  const me = room.me;
  const chips = `<div class="chips">${owned.map(o => `<button class="chip ${o.name === s.name ? "on" : ""}" data-act="select" data-arg="${esc(o.name)}">🏢 ${esc(o.name)}</button>`).join("")}</div>`;
  const rivals = room.players.filter(p => p.id !== me.id && (p.holdings[s.name] || 0) > 0).sort((a, b) => b.holdings[s.name] - a.holdings[s.name]);
  const myQ = me.holdings[s.name] || 0;
  const threat = rivals[0] && rivals[0].holdings[s.name] >= myQ * 0.8;
  const c = (a, extra = {}) => ({ ...extra, extra: `data-stock="${esc(s.name)}"` });
  return `${chips}
  <div class="card company">
    <div class="company-head">
      <div>
        <h2>${esc(s.name)} ${s.ceoId === me.id ? badge("CEO", "#f59e0b") : ""}</h2>
        <div class="muted">CEO: ${esc(s.ceo.name)} • ${esc(s.markets.join(", "))} • jij: ${myQ} aandelen</div>
        <div class="muted mt4">Kas: <span style="color:${s.companyCash < 0 ? "#ef4444" : "#22c55e"}">${fmtShort(s.companyCash)}</span> • Schuld: ${fmtShort(s.debt)} • Rente ${(s.interest * 100).toFixed(2)}%/dag</div>
        ${rivals.length ? `<div class="mt4 small-t ${threat ? "warn" : "muted"}">${threat ? "⚠ " : ""}Andere aandeelhouders: ${rivals.map(p => `<span style="color:${p.color}">${esc(p.name)} ${p.holdings[s.name]}</span>`).join(", ")}</div>` : ""}
      </div>
      <div class="kpis">
        ${[["Inkomen/dag", fmtShort(s.income)], ["Kosten/dag", fmtShort(s.costs)], ["Winst/dag", fmtShort(s.profit), s.profit >= 0 ? "#22c55e" : "#ef4444"], ["Dividendpot", fmtShort(Math.max(0, s.profit * s.dividendRate / 100)), "#a78bfa"]]
          .map(([l, v, col]) => `<div class="kpi"><span>${l}</span><strong style="color:${col || "#e2e8f0"}">${v}</strong></div>`).join("")}
      </div>
    </div>
    <div class="cols3">
      <div><span class="label">Bedrijf</span>${statBar("Reputatie", s.reputation, "#7c3aed")}${statBar("Onderzoek", s.research, "#06b6d4")}
        <div class="muted">Werknemers ${s.employees} • Fabrieken ${s.factories}</div></div>
      <div><span class="label">CEO</span>${statBar("Leiderschap", s.ceo.leadership, "#f59e0b")}${statBar("Innovatie", s.ceo.innovation, "#22c55e")}${statBar("Betrouwbaarheid", s.ceo.reliability, "#06b6d4")}</div>
      <div><span class="label">Producten</span>${s.products.length ? s.products.slice(-5).map(p => `<div class="row-between small-t mb3"><span>${esc(p.name)}</span>${badge(p.result, p.result === "Hit" ? "#22c55e" : "#ef4444")}</div>`).join("") : `<div class="muted">Nog geen producten.</div>`}</div>
    </div>
    <div class="section"><span class="label">Dividend — ${s.dividendRate}% van de winst, verdeeld over alle aandeelhouders</span>
      <div class="btn-row">${[0, 10, 25, 50, 75].map(r => btn(`${r}%`, "co", c(0, { arg: `dividend:${r}`, color: s.dividendRate === r ? "#a78bfa" : "#64748b", cls: s.dividendRate === r ? "active" : "" }))).join("")}</div>
    </div>
    <div class="section"><span class="label">Acties (betaald uit de bedrijfskas)</span>
      <div class="actions">
        ${btn("Marketing €5K", "co", c(0, { arg: "marketing", color: "#22c55e" }))}
        ${btn("Werknemers €12K", "co", c(0, { arg: "employees", color: "#3b82f6" }))}
        ${btn("Onderzoek €20K", "co", c(0, { arg: "research", color: "#a78bfa" }))}
        ${btn("Risicoproject €30K", "co", c(0, { arg: "risk", color: "#ef4444", disabled: s.name === "EuroBank" }))}
        ${btn("Product €25K", "co", c(0, { arg: "product", color: "#ec4899" }))}
        ${btn("Fabriek €50K", "co", c(0, { arg: "factory", color: "#f97316" }))}
        ${btn("CEO vervangen €15K", "co", c(0, { arg: "ceo", color: "#94a3b8", disabled: !!s.ceoId }))}
        ${btn("Lening +€100K", "co", c(0, { arg: "loan", color: "#06b6d4", disabled: s.debt + 100000 > 500000 }))}
        ${btn("Aflossen €50K", "co", c(0, { arg: "repay", color: "#14b8a6", disabled: s.debt <= 0 }))}
      </div>
    </div>
    <div class="cols3 section">
      <div class="sub-card"><span class="label">Marktexpansie</span><div class="stack">
        ${[["Europa", 20000, 0], ["Amerika", 40000, 18], ["Azië", 70000, 32]].map(([m, cost, risk]) => {
          const has = s.markets.includes(m);
          return btn(`${m} ${has ? "✓" : `€${cost / 1000}K${risk ? ` • ${risk}% risico` : ""}`}`, "co", c(0, { arg: `market:${m}`, color: has ? "#64748b" : "#7c3aed", disabled: has }));
        }).join("")}</div></div>
      <div class="sub-card"><span class="label">Cash inleggen (jouw cash → bedrijfskas)</span><div class="btn-row">
        ${btn("€10K", "co", c(0, { arg: "inject:10000", color: "#84cc16", disabled: me.cash < 1 }))}
        ${btn("€50K", "co", c(0, { arg: "inject:50000", color: "#84cc16", disabled: me.cash < 1 }))}
        ${btn("€250K", "co", c(0, { arg: "inject:250000", color: "#84cc16", disabled: me.cash < 1 }))}
        ${btn("Alles", "co", c(0, { arg: "inject:all", color: "#84cc16", disabled: me.cash < 1 }))}
      </div></div>
    </div>
  </div>`;
}

function renderPlayers() {
  const ranked = room.players.slice().sort((a, b) => b.netWorth - a.netWorth);
  return `<div class="grid">
    <div class="card span-all"><span class="label">Ranglijst</span>
      ${ranked.map((p, i) => {
        const owns = room.stocks.filter(s => s.ownerId === p.id).map(s => s.name);
        const state = !p.connected ? "offline" : p.afk ? "afwezig" : p.skip ? "⏩ klaar" : "speelt";
        return `<div class="sum-row ${p.id === room.me.id ? "total" : ""}">
          <span><span class="dot" style="background:${p.color}"></span>${i + 1}. ${esc(p.name)}${p.id === room.me.id ? " (jij)" : ""} <span class="muted small-t">${state}${owns.length ? ` • 👑 ${esc(owns.join(", "))}` : ""}</span></span>
          <span>${fmtShort(p.netWorth)}</span></div>`;
      }).join("")}
    </div>
    <div class="card span-all muted small-t lh">Wie 3 dagen niets doet telt automatisch als ‘klaar’, zodat niemand het spel ophoudt. Wie de verbinding verliest blijft in het spel en kan terugkomen met dezelfde link.</div>
  </div>`;
}

function renderChat() {
  return `<div class="card chat">
    <div class="chat-log" id="chat-log">${room.chat.length ? room.chat.map(m => `<div class="chat-msg"><b style="color:${m.color}">${esc(m.name)}</b> ${esc(m.text)}</div>`).join("") : `<div class="muted">Nog geen berichten. Zeg hallo 👋</div>`}</div>
    <form class="chat-form" data-form="chat">
      <input class="input" type="text" maxlength="160" placeholder="Bericht…" data-field="chatDraft" data-focuskey="chat" value="${esc(ui.chatDraft)}" autocomplete="off">
      <button class="btn" style="--c:#a78bfa" type="submit">Stuur</button>
    </form>
    <div class="btn-row mt8">${["👋", "😂", "🚀", "📉", "💸", "🤝", "😈"].map(e => `<button class="btn small" style="--c:#64748b" data-act="emoji" data-arg="${e}">${e}</button>`).join("")}</div>
  </div>`;
}

function renderNews() {
  return `<div class="card">${room.news.map(n => `<div class="sum-row"><span class="${n.kind === "bad" ? "warn" : ""}">${esc(n.text)}</span><span class="muted small-t">d${n.day}</span></div>`).join("")}</div>`;
}

function renderEnded() {
  const ranked = room.players.slice().sort((a, b) => b.netWorth - a.netWorth);
  const winner = room.players.find(p => p.id === room.winnerId);
  const iWon = winner && winner.id === room.me.id;
  return `<div class="card end">
    <div class="end-icon">${iWon ? "🏆" : "🏁"}</div>
    <h2 style="color:${iWon ? "#22c55e" : "#e2e8f0"}">${iWon ? "Jij wint!" : `${esc(winner ? winner.name : "?")} wint!`}</h2>
    <p class="muted">${esc(room.endReason)}</p>
    <div class="mt12">${ranked.map((p, i) => `<div class="sum-row ${p.id === room.me.id ? "total" : ""}"><span>${["🥇", "🥈", "🥉"][i] || `${i + 1}.`} <span style="color:${p.color}">${esc(p.name)}</span></span><span>${fmtShort(p.netWorth)}</span></div>`).join("")}</div>
    <div class="btn-row center mt12">${btn("Terug naar menu", "leave", { color: "#a78bfa", cls: "lg" })}</div>
  </div>`;
}

function renderChoice() {
  const root = $("modal-root");
  const ch = room && room.phase === "playing" && room.me && room.me.choice;
  if (!ch) { root.innerHTML = ""; document.body.classList.remove("modal-open"); return; }
  document.body.classList.add("modal-open");
  root.innerHTML = `<div class="modal-backdrop"></div><div class="modal" role="dialog" aria-modal="true">
    <h2>${esc(ch.title)}</h2><p>${esc(ch.text)}</p>
    <p class="muted small-t">Bedrijfskas ${esc(ch.stock)}: ${fmtShort(ch.companyCash)} • Geen keuze voor de volgende dag = laatste optie.</p>
    <div class="stack mt8">${ch.options.map((o, i) => btn(esc(o.label), "choose", { arg: i, color: i === 0 ? "#22c55e" : "#94a3b8", cls: "lg", disabled: o.pay > ch.companyCash })).join("")}</div>
  </div>`;
}

function render() {
  renderHeader();
  renderTabs();
  const main = $("main");
  const ae = document.activeElement;
  if (ae && ae.tagName === "SELECT" && main.contains(ae)) { renderChoice(); return; }
  let focusKey = null, ss = null, se = null;
  if (ae && ae.dataset && ae.dataset.focuskey) { focusKey = ae.dataset.focuskey; try { ss = ae.selectionStart; se = ae.selectionEnd; } catch { /* ignore */ } }
  const chatLog = $("chat-log");
  const chatAtBottom = !chatLog || chatLog.scrollHeight - chatLog.scrollTop - chatLog.clientHeight < 40;

  let html;
  if (!room || !room.me) html = renderMenu();
  else if (room.phase === "lobby") html = renderLobby();
  else if (room.phase === "ended") html = renderEnded();
  else html = ({ market: renderMarket, company: renderCompany, players: renderPlayers, chat: renderChat, news: renderNews }[ui.tab] || renderMarket)();
  main.innerHTML = html;

  const log = $("chat-log");
  if (log && chatAtBottom) log.scrollTop = log.scrollHeight;
  if (focusKey) {
    const el = main.querySelector(`[data-focuskey="${CSS.escape(focusKey)}"]`);
    if (el) { el.focus({ preventScroll: true }); try { if (ss != null) el.setSelectionRange(ss, se); } catch { /* ignore */ } }
  }
  renderChoice();
}

// ═══════════════════════════════════════════════════════════════════════════
// Input
// ═══════════════════════════════════════════════════════════════════════════

function readAmount(name) {
  const n = Math.floor(Number(String(ui.amounts[name] || "").replace(/[^\d]/g, "")));
  return n > 0 ? n : 0;
}
function needName() {
  ui.name = ui.name.trim();
  if (!ui.name) { toast("Vul eerst je naam in.", "warn"); const el = document.querySelector("[data-field=name]"); if (el) el.focus(); return true; }
  storageSet(NAME_KEY, ui.name);
  return false;
}

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const act = el.dataset.act, arg = el.dataset.arg;
  switch (act) {
    case "create":
      if (needName()) return;
      connect({ t: "create", name: ui.name, settings: ui.settings });
      break;
    case "join": {
      if (needName()) return;
      const code = ui.joinCode.trim().toUpperCase();
      if (code.length !== 4) return toast("Een kamercode heeft 4 tekens.", "warn");
      connect({ t: "join", code, name: ui.name });
      break;
    }
    case "start": send({ t: "start" }); break;
    case "leave": send({ t: "leave" }); break;
    case "copy":
      (navigator.clipboard ? navigator.clipboard.writeText(arg) : Promise.reject()).then(() => toast("Link gekopieerd!"), () => toast(arg));
      break;
    case "share": navigator.share({ title: "Investeer Online", text: `Speel mee! Code ${room.code}`, url: arg }).catch(() => {}); break;
    case "tab": ui.tab = arg; render(); break;
    case "select": ui.selected = arg; render(); break;
    case "buy": case "sell": case "short": {
      const q = readAmount(arg);
      if (!q) return toast("Vul een geldig aantal in.", "warn");
      send({ t: act, stock: arg, qty: q });
      break;
    }
    case "cover": send({ t: "cover", stock: arg }); break;
    case "max": {
      const s = room.stocks.find(x => x.name === arg);
      const canBuy = Math.floor(room.me.cash / (s.price * 1.02));
      ui.amounts[arg] = String(canBuy > 0 ? canBuy : room.me.holdings[arg] || "");
      render(); break;
    }
    case "co": {
      const [action, value] = arg.split(":");
      const v = action === "dividend" ? Number(value) : value;
      send({ t: "company", stock: el.dataset.stock, action, value: v });
      break;
    }
    case "choose": send({ t: "choice", option: Number(arg) }); break;
    case "skip": send({ t: "skip", on: !room.me.skip }); break;
    case "autoskip": send({ t: "autoskip", on: !room.me.autoSkip }); break;
    case "pause": send({ t: "pause" }); break;
    case "emoji": send({ t: "chat", text: arg }); break;
  }
});

document.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.amount !== undefined) {
    const clean = t.value.replace(/[^\d]/g, "").slice(0, 9);
    if (clean !== t.value) t.value = clean;
    ui.amounts[t.dataset.amount] = clean;
  } else if (t.dataset.field === "joinCode") {
    const clean = t.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    if (clean !== t.value) t.value = clean;
    ui.joinCode = clean;
  } else if (t.dataset.field === "server") {
    const v = t.value.trim();
    if (v) storageSet(SERVER_KEY, v); else storageDel(SERVER_KEY);
  } else if (t.dataset.field) {
    ui[t.dataset.field] = t.value;
  }
});

document.addEventListener("change", e => {
  const t = e.target;
  if (!t.dataset.setting) return;
  const k = t.dataset.setting;
  const v = k === "startCash" || k === "dayLimit" ? Number(t.value) : t.value;
  if (room && room.phase === "lobby" && room.me && room.me.isHost) send({ t: "settings", settings: { [k]: v } });
  else ui.settings[k] = v;
  t.blur();
});

document.addEventListener("submit", e => {
  if (e.target.dataset.form !== "chat") return;
  e.preventDefault();
  const text = ui.chatDraft.trim();
  if (!text) return;
  send({ t: "chat", text });
  ui.chatDraft = "";
  const inp = e.target.querySelector("input"); if (inp) inp.value = "";
});

document.addEventListener("keydown", e => {
  const t = e.target;
  if (e.key !== "Enter") return;
  if (t.dataset && t.dataset.amount) send({ t: "buy", stock: t.dataset.amount, qty: readAmount(t.dataset.amount) });
  else if (t.dataset && t.dataset.field === "joinCode") document.querySelector("[data-act=join]").click();
  else if (t.dataset && t.dataset.field === "name" && ui.joinCode.length === 4) document.querySelector("[data-act=join]").click();
});

// Phones drop sockets when the screen locks: reconnect as soon as the page is visible again.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && wantOpen && !connected) { retry = 0; connect(); }
});

// ═══════════════════════════════════════════════════════════════════════════
// Boot: rejoin a running game automatically.
// ═══════════════════════════════════════════════════════════════════════════

render();
if (loadSession() && serverUrl()) connect();
window.__online = { get room() { return room; }, ui, send };

})();
