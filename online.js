"use strict";
(() => {

const { t } = I18N;

// ═══════════════════════════════════════════════════════════════════════════
// Server address
// ═══════════════════════════════════════════════════════════════════════════
// The online game server. Every copy of the page (GitHub Pages, itch.io, a local file)
// connects here, except when the page is served by a game server itself:
// on Render, or on your own computer/network while testing with `npm start`.
const SERVER_URL = "wss://investering-spel.onrender.com/ws";

const SESSION_KEY = "inv-online-session";
const NAME_KEY = "inv-online-name";
const SERVER_KEY = "inv-online-server";
const NOTIFY_KEY = "inv-online-notify";        // badges + sounds for chat/deals
const SYSNOTIFY_KEY = "inv-online-sysnotify";  // phone/computer notifications while the tab is hidden

function storageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function storageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
function storageDel(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }

function serverUrl() {
  const custom = (storageGet(SERVER_KEY) || "").trim();
  if (custom) return custom;
  const h = location.hostname;
  const servedByGameServer = /^https?:$/.test(location.protocol) && (
    /\.onrender\.com$/.test(h) ||                                   // the Render deployment
    h === "localhost" || h === "127.0.0.1" || h === "[::1]" ||       // npm start on this computer
    /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(h));           // npm start, opened from a phone on the same Wi-Fi
  return servedByGameServer ? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws` : SERVER_URL;
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = v => I18N.num(v, 2);
const fmtShort = v => I18N.moneyShort(v);
const pct = v => I18N.num(v, 1);
const marketName = m => t(`market.${m}`);
const sound = n => window.Sound && Sound.play(n);
const badge = (txt, c = "#7c3aed") => `<span class="badge" style="--c:${c}">${txt}</span>`;
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
function parsePrice(txt) {
  let s = String(txt || "").replace(/[^\d.,]/g, "");
  const lastSep = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  if (lastSep >= 0) s = s.slice(0, lastSep).replace(/[.,]/g, "") + "." + s.slice(lastSep + 1);
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}
function langSelect() {
  return `<select class="input lang-select" data-lang aria-label="${esc(t("settings.language"))}">${Object.entries(I18N.languages).map(([k, l]) => `<option value="${k}" ${I18N.lang === k ? "selected" : ""}>${l.flag} ${l.name}</option>`).join("")}</select>`;
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

let room = null, clockOffset = 0, ws = null, connected = false, wantOpen = false, retry = 0, pending = null;
let lastNewsKey = "", lastDay = 0;

const ui = {
  tab: "market", amounts: {}, selected: null, chatDraft: "", modal: null, alertPrice: "",
  name: storageGet(NAME_KEY) || "",
  joinCode: (new URLSearchParams(location.search).get("room") || "").toUpperCase().slice(0, 4),
  settings: { speed: "normal", target: "10m", startCash: 50000, dayLimit: 100 },
  deal: { to: "", giveCash: "", giveStock: "", giveQty: "", wantCash: "", wantStock: "", wantQty: "" },
  seenChat: 0, seenDeals: new Set(),
  notify: storageGet(NOTIFY_KEY) !== "0",
  sysNotify: storageGet(SYSNOTIFY_KEY) === "1",
};

// ── Price alerts (stored in this browser, per room) ─────────────────────────
const alertsKey = () => `inv-online-alerts-${room ? room.code : ""}`;
function getAlerts() { try { return JSON.parse(storageGet(alertsKey()) || "[]"); } catch { return []; } }
function setAlerts(a) { storageSet(alertsKey(), JSON.stringify(a)); }
function checkAlerts() {
  if (!room || room.phase !== "playing") return;
  const alerts = getAlerts(); if (!alerts.length) return;
  const keep = [], hit = [];
  alerts.forEach(a => {
    const s = room.stocks.find(x => x.name === a.name);
    if (!s || s.bankrupt) return;
    (a.dir === "above" ? s.price >= a.price : s.price <= a.price) ? hit.push({ a, s }) : keep.push(a);
  });
  if (!hit.length) return;
  setAlerts(keep);
  hit.forEach(({ a, s }) => {
    const text = t(`alert.hit.${a.dir}`, { company: s.name, price: I18N.money(s.price), target: I18N.money(a.price) });
    toast(text, "big");
    systemNotify(t("alert.title"), text);
  });
  sound("alert");
}

// ── Notifications ────────────────────────────────────────────────────────────
function systemNotify(title, body) {
  if (!ui.sysNotify || !document.hidden || !("Notification" in window) || Notification.permission !== "granted") return;
  try { new Notification(title, { body, tag: "investor-online" }); } catch { /* some phones only allow this from a service worker */ }
}
function unreadChat() {
  if (!room || !room.me) return 0;
  return room.chat.filter(m => m.n > ui.seenChat && m.id !== room.me.id).length;
}
function unseenDeals() {
  if (!room || !room.me) return 0;
  return room.deals.filter(d => d.to === room.me.id && !ui.seenDeals.has(d.id)).length;
}
function markSeen() {
  if (!room) return;
  if (ui.tab === "chat" && room.chat.length) ui.seenChat = Math.max(ui.seenChat, room.chat[room.chat.length - 1].n || 0);
  if (ui.tab === "deals") room.deals.forEach(d => ui.seenDeals.add(d.id));
}

// ═══════════════════════════════════════════════════════════════════════════
// Connection
// ═══════════════════════════════════════════════════════════════════════════

function connect(first) {
  const url = serverUrl();
  wantOpen = true;
  if (first) pending = first;
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) { if (ws.readyState === 1) flush(); return; }
  setConn(t("conn.connecting"));
  try { ws = new WebSocket(url); } catch { setConn(t("conn.badUrl"), "bad"); return; }
  ws.onopen = () => {
    connected = true; retry = 0; setConn("");
    const sess = loadSession();
    if (sess && !pending) send({ t: "rejoin", token: sess.token });
    flush();
  };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } onMessage(m); };
  ws.onclose = ev => {
    connected = false; ws = null;
    if (ev.code === 4000) { wantOpen = false; setConn(t("conn.elsewhere"), "bad"); return; }
    if (!wantOpen) return;
    retry++;
    const wait = Math.min(15000, 800 * 2 ** Math.min(retry, 5));
    setConn(retry > 2 ? t("conn.retry", { n: Math.round(wait / 1000) }) : t("conn.lost"), "bad");
    setTimeout(() => { if (wantOpen) connect(); }, wait);
  };
  ws.onerror = () => {};
}
function flush() { if (pending) { send(pending); pending = null; } }
function send(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); else pending = m; }
function setConn(text, kind = "") { const el = $("conn"); el.hidden = !text; el.textContent = text; el.className = `conn ${kind}`; }
function loadSession() { try { return JSON.parse(storageGet(SESSION_KEY) || "null"); } catch { return null; } }

function onMessage(m) {
  switch (m.t) {
    case "joined":
      storageSet(SESSION_KEY, JSON.stringify({ token: m.token, code: m.code }));
      history.replaceState(null, "", `?room=${m.code}`);
      break;
    case "rejoin-failed": storageDel(SESSION_KEY); room = null; render(); break;
    case "left":
      storageDel(SESSION_KEY); room = null; ui.tab = "market"; ui.modal = null;
      history.replaceState(null, "", location.pathname); render();
      break;
    case "error":
      toast(I18N.msg([[m.key, m.params]]), "warn"); sound("error");
      break;
    case "notice": {
      const text = t(`notice.${m.kind}`, { player: m.params.player });
      if (ui.notify) { toast(text, m.kind === "dealOffer" ? "big" : ""); sound("deal"); }
      systemNotify(t("app.titleOnline"), text);
      break;
    }
    case "state": onState(m.room); break;
  }
}

function onState(next) {
  const prev = room;
  room = next; clockOffset = room.serverNow - Date.now();
  if (prev && prev.phase === "lobby" && room.phase === "playing") { ui.tab = "market"; toast(t("online.started"), "big"); sound("goal"); }
  if (prev && prev.phase === "playing" && room.phase === "ended") sound(room.winnerId === (room.me && room.me.id) ? "win" : "bad");

  if (room.phase === "playing" && room.me) {
    if (lastDay && room.day > lastDay) sound("day");
    // Lost a company to another player?
    if (prev && prev.stocks) room.stocks.forEach(s => {
      const old = prev.stocks.find(x => x.name === s.name);
      if (old && old.ownerId === room.me.id && s.ownerId && s.ownerId !== room.me.id) { sound("takeover"); }
    });
    // New chat messages from others.
    const newest = room.chat.length ? room.chat[room.chat.length - 1] : null;
    const prevNewest = prev && prev.chat && prev.chat.length ? prev.chat[prev.chat.length - 1].n : 0;
    if (newest && newest.n > prevNewest && newest.id !== room.me.id && prev) {
      if (ui.tab !== "chat" && ui.notify) sound("chat");
      systemNotify(newest.name, newest.text);
    }
  }
  const n = room.news[0]; const key = n ? `${n.day}|${JSON.stringify(n.parts)}` : "";
  if (key && key !== lastNewsKey && lastNewsKey && /takeoverPlayer|ceoPlayer|end\./.test(key)) toast(I18N.newsText(n), "big");
  lastNewsKey = key; lastDay = room.day;
  if (ui.seenChat === 0 && !prev && room.chat.length) ui.seenChat = room.chat[room.chat.length - 1].n || 0; // don't flag old chat after a reload
  markSeen();
  checkAlerts();
  render();
}

// ═══════════════════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════════════════

const stockOwner = s => room.players.find(p => p.id === s.ownerId);
const playerBy = id => room.players.find(p => p.id === id);
const myOwned = () => room.stocks.filter(s => s.ownerId === room.me.id && !s.bankrupt);

function renderHeader() {
  document.title = t("app.titleOnline");
  $("brand-title").textContent = t("app.titleOnline");
  $("foot").innerHTML = `<a href="index.html">← ${t("online.solo")}</a> • ${t("online.footer")}`;
  const stats = $("stats"), dayline = $("dayline"), progress = $("progress"), newsrow = $("newsrow"), bar = $("controlbar");
  if (!room || !room.me || room.phase === "lobby") {
    stats.innerHTML = ""; progress.innerHTML = ""; newsrow.innerHTML = ""; bar.hidden = true;
    dayline.textContent = room ? t("online.waiting", { code: room.code }) : t("online.tagline");
    return;
  }
  const me = room.me;
  const rank = room.players.slice().sort((a, b) => b.netWorth - a.netWorth).findIndex(p => p.id === me.id) + 1;
  const status = room.depression ? `<span style="color:#ef4444">⚠ ${t("status.depressionShort")}</span>` : room.recession ? `<span style="color:#f97316">📉 ${t("status.recessionShort")}</span>` : `<span style="color:#22c55e">📊 ${t("status.normalShort")}</span>`;
  dayline.innerHTML = `${t("day", { n: room.day })}${room.settings.dayLimit ? `/${room.settings.dayLimit}` : ""} • ${status} • ${t("online.room")} <b>${esc(room.code)}</b>`;
  stats.innerHTML = [[t("stat.cash"), fmtShort(me.cash), "#22c55e"], [t("stat.total"), fmtShort(me.netWorth), "#a78bfa"], [t("online.position"), `#${rank}/${room.players.length}`, "#f59e0b"]]
    .map(([l, v, c]) => `<div class="card stat"><span class="label">${l}</span><strong style="color:${c}">${v}</strong></div>`).join("");
  const p = Math.min(100, me.netWorth / room.target * 100);
  progress.innerHTML = `<div class="progress-top"><span>${t("online.goal", { target: fmtShort(room.target) })}</span><span>${I18N.num(p, 2)}%</span></div><div class="bar thin"><div style="width:${p}%;background:${me.color}"></div></div>`;
  const n = room.news[0];
  newsrow.innerHTML = `<div class="card news ${n ? n.kind : ""}"><span class="kicker">${t("news.title")} • ${t("day.short", { n: n ? n.day : "" })}</span><div>${n ? esc(I18N.newsText(n)) : ""}</div></div>
    ${me.lastDividend > 0 ? `<div class="card news good mini"><span class="kicker">${t("dividend")}</span><strong>+${fmtShort(me.lastDividend)}</strong></div>` : ""}`;

  if (room.phase !== "playing") { bar.hidden = true; return; }
  bar.hidden = false;
  const active = room.players.filter(pl => pl.connected && !pl.afk);
  const skipping = active.filter(pl => pl.skip).length;
  const paused = room.pausedUntil > Date.now() + clockOffset;
  bar.innerHTML = `
    <div class="timer" aria-label="${esc(t("online.timer"))}">
      <div class="timer-top"><span id="timer-text">${t("day", { n: room.day })}</span><span>⏩ ${skipping}/${active.length}</span></div>
      <div class="bar"><div id="timer-fill" style="background:${paused ? "#f59e0b" : "#7c3aed"}"></div></div>
    </div>
    <button class="toggle ${me.skip ? "on" : ""}" data-act="skip" aria-pressed="${me.skip}" title="${esc(t("online.skipHelp"))}">⏩ ${me.skip ? t("online.ready") : t("online.skip")}</button>
    <button class="toggle ${me.autoSkip ? "on" : ""}" data-act="autoskip" aria-pressed="${me.autoSkip}" title="${esc(t("online.autoHelp"))}">🔁 ${t("online.auto")}</button>
    <button class="toggle ${paused ? "on" : ""}" data-act="pause" ${!paused && me.pauseTokens <= 0 ? "disabled" : ""} title="${esc(paused ? t("online.resume") : t("online.pauseHelp", { n: me.pauseTokens }))}">${paused ? "▶" : "⏸"} ${paused ? "" : me.pauseTokens}</button>`;
  updateTimer();
}

function updateTimer() {
  const fill = $("timer-fill"), text = $("timer-text");
  if (!fill || !room || room.phase !== "playing") return;
  const now = Date.now() + clockOffset;
  const left = Math.max(0, room.dayEndsAt - now);
  if (room.pausedUntil > now) { fill.style.width = "100%"; text.textContent = t("online.paused", { n: Math.ceil((room.pausedUntil - now) / 1000) }); }
  else { fill.style.width = `${clamp(left / room.dayMs * 100, 0, 100)}%`; text.textContent = t("online.dayLeft", { day: room.day, n: Math.ceil(left / 1000) }); }
}
(function loop() { updateTimer(); requestAnimationFrame(loop); })();

function renderTabs() {
  const tabs = $("tabs");
  if (!room || room.phase === "lobby" || !room.me) { tabs.innerHTML = ""; return; }
  const owned = myOwned().length;
  const dot = n => (n && ui.notify ? `<span class="tab-badge">${n > 9 ? "9+" : n}</span>` : "");
  tabs.innerHTML = [["market", `📊 ${t("tab.market")}`], ["company", `🏢 ${t("tab.myCompanies")}${owned ? ` (${owned})` : ""}`], ["deals", `🤝 ${t("tab.deals")}${dot(unseenDeals())}`],
    ["players", `🏆 ${t("tab.players")}`], ["chat", `💬 ${t("tab.chat")}${dot(unreadChat())}`], ["news", `📰 ${t("tab.news")}`], ["settings", `⚙️`]]
    .map(([k, l]) => `<button class="tab ${ui.tab === k ? "on" : ""}" data-act="tab" data-arg="${k}" ${k === "settings" ? `aria-label="${esc(t("tab.settings"))}"` : ""}>${l}</button>`).join("");
}

function select(label, key, opts, val) {
  return `<label class="field"><span class="label">${label}</span><select class="input" data-setting="${key}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
}
function settingsFields(s) {
  return `${select(t("online.speed"), "speed", [["calm", t("online.speed.calm")], ["normal", t("online.speed.normal")], ["turbo", t("online.speed.turbo")]], s.speed)}
    ${select(t("online.target"), "target", [["1m", fmtShort(1e6)], ["10m", fmtShort(1e7)], ["100m", fmtShort(1e8)], ["1b", fmtShort(1e9)]], s.target)}
    ${select(t("online.startCash"), "startCash", [[10000, fmtShort(10000)], [50000, fmtShort(50000)], [250000, fmtShort(250000)]], s.startCash)}
    ${select(t("online.dayLimit"), "dayLimit", [[50, t("online.days", { n: 50 })], [100, t("online.days", { n: 100 })], [200, t("online.days", { n: 200 })], [0, t("online.noLimit")]], s.dayLimit)}`;
}

function renderMenu() {
  return `<div class="grid menu">
    <div class="card span-all"><div class="row-between"><span class="label">${t("online.yourName")}</span><div class="mini-lang">${langSelect()}</div></div>
      <input class="input" type="text" maxlength="16" placeholder="${esc(t("online.namePh"))}" data-field="name" data-focuskey="name" value="${esc(ui.name)}" autocomplete="nickname"></div>
    <div class="card"><span class="label">🆕 ${t("online.create")}</span>
      <div class="form-grid">${settingsFields(ui.settings)}</div>
      <div class="mt12">${btn(t("online.createBtn"), "create", { color: "#22c55e", cls: "lg wide" })}</div></div>
    <div class="card"><span class="label">🔑 ${t("online.join")}</span>
      <input class="input code-input" type="text" maxlength="4" placeholder="ABCD" data-field="joinCode" data-focuskey="code" value="${esc(ui.joinCode)}" autocapitalize="characters" autocomplete="off" spellcheck="false">
      <div class="mt12">${btn(t("online.joinBtn"), "join", { color: "#a78bfa", cls: "lg wide" })}</div>
      <p class="muted small-t mt8">${t("online.joinHelp")}</p></div>
    <details class="card span-all server-box">
      <summary class="label">⚙️ ${t("online.server")} — ${esc(serverUrl())}</summary>
      <p class="muted small-t">${t("online.serverHelp")}</p>
      <input class="input" type="text" placeholder="wss://…/ws" data-field="server" value="${esc(storageGet(SERVER_KEY) || "")}" spellcheck="false" autocomplete="off">
    </details>
    <div class="card span-all muted small-t lh">${t("online.howto")}</div>
  </div>`;
}

function renderLobby() {
  const me = room.me, host = me.isHost, s = room.settings;
  const link = `${location.origin}${location.pathname}?room=${room.code}`;
  const speedLabel = { calm: t("online.speed.calm"), normal: t("online.speed.normal"), turbo: t("online.speed.turbo") };
  return `<div class="grid">
    <div class="card span-all lobby-code"><span class="label">${t("online.code")}</span><div class="code">${esc(room.code)}</div>
      <div class="btn-row center mt8">${btn(`📋 ${t("online.copy")}`, "copy", { arg: link, color: "#06b6d4" })}${navigator.share ? btn(`📤 ${t("online.share")}`, "share", { arg: link, color: "#06b6d4" }) : ""}</div></div>
    <div class="card"><span class="label">${t("online.players", { n: room.players.length, max: 8 })}</span>
      ${room.players.map(p => `<div class="sum-row"><span><span class="dot" style="background:${p.color}"></span>${esc(p.name)}${p.id === room.hostId ? " 👑" : ""}${p.id === me.id ? ` (${t("you")})` : ""}</span><span class="muted small-t">${p.connected ? t("online.ready") : t("conn.connecting")}</span></div>`).join("")}</div>
    <div class="card"><span class="label">${t("online.settings")} ${host ? "" : `(${t("online.hostChooses")})`}</span>
      ${host ? `<div class="form-grid">${settingsFields(s)}</div>` : `<div class="muted lh">${t("online.speed")}: ${speedLabel[s.speed]}<br>${t("online.target")}: ${fmtShort(room.target)}<br>${t("online.startCash")}: ${fmtShort(s.startCash)}<br>${t("online.dayLimit")}: ${s.dayLimit ? t("online.days", { n: s.dayLimit }) : t("online.noLimit")}</div>`}</div>
    <div class="span-all btn-row center">
      ${host ? btn(room.players.length < 2 ? `▶ ${t("online.startTest")}` : `▶ ${t("online.start")}`, "start", { color: "#22c55e", cls: "lg" }) : `<div class="muted">${t("online.waitHost")}</div>`}
      ${btn(t("online.leave"), "leave", { color: "#64748b", cls: "lg" })}
    </div>
  </div>`;
}

function renderMarket() {
  const me = room.me, alerts = getAlerts();
  return `<p class="fee-note">${t("online.feeNote")}</p>
  <div class="grid">${room.stocks.map(s => {
    const q = me.holdings[s.name] || 0, owner = stockOwner(s), ch = dayChange(s), up = ch >= 0, sh = me.shorts[s.name];
    const others = room.players.filter(p => p.id !== me.id && (p.holdings[s.name] || 0) > 0).sort((a, b) => b.holdings[s.name] - a.holdings[s.name]).slice(0, 3);
    const mine = s.ownerId === me.id;
    const nAlerts = alerts.filter(a => a.name === s.name).length;
    return `<article class="stock ${s.bankrupt ? "dead" : ""}">
      <div class="stock-top">
        <div class="stock-id"><strong>${esc(s.name)}</strong>
          <div class="sub">${s.bankrupt ? `💀 ${t("bankrupt")}` : `${t(`sector.${s.sector}`)} • ${esc(s.markets.map(marketName).join(", "))}`}</div>
          <div class="badges">${owner ? badge(mine ? t("online.yourCompany") : `👑 ${esc(owner.name)}`, owner.color) : badge(t("online.free"), "#64748b")}${sh ? badge(`${t("short")} ${sh.qty}`, "#ec4899") : ""}</div>
        </div>
        <div class="stock-price"><div class="price">€${fmt(s.price)}</div>
          <div class="chg" style="color:${up ? "#22c55e" : "#ef4444"}">${up ? "▲" : "▼"} ${pct(Math.abs(ch))}%</div>${sparkline(s.history)}</div>
      </div>
      ${s.bankrupt ? "" : `
      <div class="trade-row">
        <input class="input" type="text" inputmode="numeric" pattern="[0-9]*" placeholder="${esc(t("amount"))}" autocomplete="off" data-amount="${esc(s.name)}" data-focuskey="amt-${esc(s.name)}" value="${esc(ui.amounts[s.name] || "")}" aria-label="${esc(t("amount"))} ${esc(s.name)}">
        ${btn("Max", "max", { arg: s.name, color: "#64748b", cls: "small" })}
        <button class="btn small bell" style="--c:#f59e0b" data-act="alerts" data-arg="${esc(s.name)}" aria-label="${esc(t("alert.title"))}">🔔${nAlerts ? `<span class="count">${nAlerts}</span>` : ""}</button>
      </div>
      <div class="trade-btns">
        ${btn(t("buy"), "buy", { arg: s.name, color: "#22c55e" })}
        ${btn(`${t("sell")} (${q})`, "sell", { arg: s.name, color: "#ef4444", disabled: !q })}
        ${sh ? btn(t("short.close"), "cover", { arg: s.name, color: "#ec4899" }) : btn(t("short"), "short", { arg: s.name, color: "#ec4899", disabled: mine })}
      </div>
      <div class="hint">${t("online.you", { n: q })}${others.length ? " • " + others.map(p => `<span style="color:${p.color}">${esc(p.name)} ${p.holdings[s.name]}</span>`).join(" • ") : ""}</div>`}
    </article>`;
  }).join("")}</div>`;
}

function renderCompany() {
  const owned = myOwned();
  if (!owned.length) return `<div class="card muted lh">${t("online.noCompany")}</div>`;
  if (!owned.some(s => s.name === ui.selected)) ui.selected = owned[0].name;
  const s = owned.find(x => x.name === ui.selected), me = room.me;
  const chips = `<div class="chips">${owned.map(o => `<button class="chip ${o.name === s.name ? "on" : ""}" data-act="select" data-arg="${esc(o.name)}">🏢 ${esc(o.name)}</button>`).join("")}</div>`;
  const rivals = room.players.filter(p => p.id !== me.id && (p.holdings[s.name] || 0) > 0).sort((a, b) => b.holdings[s.name] - a.holdings[s.name]);
  const myQ = me.holdings[s.name] || 0;
  const threat = rivals[0] && rivals[0].holdings[s.name] >= myQ * 0.8;
  const c = extra => ({ ...extra, extra: `data-stock="${esc(s.name)}"` });
  return `${chips}
  <div class="card company">
    <div class="company-head">
      <div><h2>${esc(s.name)} ${s.ceoId === me.id ? badge("CEO", "#f59e0b") : ""}</h2>
        <div class="muted">CEO: ${esc(s.ceo.name)} • ${t(`sector.${s.sector}`)} • ${esc(s.markets.map(marketName).join(", "))} • ${t("company.youHold", { n: myQ })}</div>
        <div class="muted mt4">${t("company.cash")}: <span style="color:${s.companyCash < 0 ? "#ef4444" : "#22c55e"}">${fmtShort(s.companyCash)}</span> • ${t("company.debt")}: ${fmtShort(s.debt)} • ${t("company.interest", { pct: I18N.num(s.interest * 100, 2) })}</div>
        ${rivals.length ? `<div class="mt4 small-t ${threat ? "warn" : "muted"}">${threat ? "⚠ " : ""}${t("online.otherHolders")}: ${rivals.map(p => `<span style="color:${p.color}">${esc(p.name)} ${p.holdings[s.name]}</span>`).join(", ")}</div>` : ""}
      </div>
      <div class="kpis">${[[t("kpi.income"), fmtShort(s.income)], [t("kpi.costs"), fmtShort(s.costs)], [t("kpi.profit"), fmtShort(s.profit), s.profit >= 0 ? "#22c55e" : "#ef4444"], [t("online.dividendPool"), fmtShort(Math.max(0, s.profit * s.dividendRate / 100)), "#a78bfa"]]
        .map(([l, v, col]) => `<div class="kpi"><span>${l}</span><strong style="color:${col || "#e2e8f0"}">${v}</strong></div>`).join("")}</div>
    </div>
    <div class="cols3">
      <div><span class="label">${t("company.stats")}</span>${statBar(t("stat.reputation"), s.reputation, "#7c3aed")}${statBar(t("stat.research"), s.research, "#06b6d4")}<div class="muted">${t("company.staff", { emp: I18N.num(s.employees), fac: s.factories })}</div></div>
      <div><span class="label">CEO</span>${statBar(t("stat.leadership"), s.ceo.leadership, "#f59e0b")}${statBar(t("stat.innovation"), s.ceo.innovation, "#22c55e")}${statBar(t("stat.reliability"), s.ceo.reliability, "#06b6d4")}</div>
      <div><span class="label">${t("company.products")}</span>${s.products.length ? s.products.slice(-5).map(p => `<div class="row-between small-t mb3"><span>${esc(p.name)}</span>${badge(t(`product.${p.result}`), p.result === "Hit" ? "#22c55e" : "#ef4444")}</div>`).join("") : `<div class="muted">${t("company.noProducts")}</div>`}</div>
    </div>
    <div class="section"><span class="label">${t("online.dividendTitle", { pct: s.dividendRate })}</span>
      <div class="btn-row">${[0, 10, 25, 50, 75].map(r => btn(`${r}%`, "co", c({ arg: `dividend:${r}`, color: s.dividendRate === r ? "#a78bfa" : "#64748b", cls: s.dividendRate === r ? "active" : "" }))).join("")}</div></div>
    <div class="section"><span class="label">${t("online.actions")}</span>
      <div class="actions">
        ${btn(t("act.marketing", { cost: fmtShort(5000) }), "co", c({ arg: "marketing", color: "#22c55e" }))}
        ${btn(t("act.employees", { cost: fmtShort(12000) }), "co", c({ arg: "employees", color: "#3b82f6" }))}
        ${btn(t("act.research", { cost: fmtShort(20000) }), "co", c({ arg: "research", color: "#a78bfa" }))}
        ${btn(t("act.risk", { cost: fmtShort(30000) }), "co", c({ arg: "risk", color: "#ef4444", disabled: !s.hasRisk }))}
        ${btn(t("act.product", { cost: fmtShort(25000) }), "co", c({ arg: "product", color: "#ec4899" }))}
        ${btn(t("act.factory", { cost: fmtShort(50000) }), "co", c({ arg: "factory", color: "#f97316" }))}
        ${btn(t("act.ceo", { cost: fmtShort(15000) }), "co", c({ arg: "ceo", color: "#94a3b8", disabled: !!s.ceoId }))}
        ${btn(t("act.loan", { amount: fmtShort(100000) }), "co", c({ arg: "loan", color: "#06b6d4", disabled: s.debt + 100000 > 500000 }))}
        ${btn(t("act.repay", { amount: fmtShort(50000) }), "co", c({ arg: "repay", color: "#14b8a6", disabled: s.debt <= 0 }))}
      </div></div>
    <div class="cols3 section">
      <div class="sub-card"><span class="label">${t("company.expansion")}</span><div class="stack">
        ${[["Europa", 20000, 0], ["Amerika", 40000, 18], ["Azië", 70000, 32]].map(([m, cost, risk]) => {
          const has = s.markets.includes(m);
          return btn(`${marketName(m)} ${has ? "✓" : `${fmtShort(cost)}${risk ? ` • ${t("risk.pct", { pct: risk })}` : ""}`}`, "co", c({ arg: `market:${m}`, color: has ? "#64748b" : "#7c3aed", disabled: has }));
        }).join("")}</div></div>
      <div class="sub-card"><span class="label">${t("company.inject")}</span><div class="btn-row">
        ${[10000, 50000, 250000].map(a => btn(fmtShort(a), "co", c({ arg: `inject:${a}`, color: "#84cc16", disabled: me.cash < 1 }))).join("")}
        ${btn(t("all"), "co", c({ arg: "inject:all", color: "#84cc16", disabled: me.cash < 1 }))}</div></div>
    </div>
  </div>`;
}

function dealSideText(side) {
  const parts = [];
  if (side.cash) parts.push(fmtShort(side.cash));
  if (side.qty) parts.push(t("deal.shares", { n: side.qty, company: side.stock }));
  return parts.length ? parts.join(" + ") : t("deal.nothing");
}

function renderDeals() {
  const me = room.me, d = ui.deal;
  const others = room.players.filter(p => p.id !== me.id);
  const incoming = room.deals.filter(x => x.to === me.id), outgoing = room.deals.filter(x => x.from === me.id);
  const stocksOpt = (val, onlyMine) => `<option value="">—</option>${room.stocks.filter(s => !s.bankrupt && (!onlyMine || (me.holdings[s.name] || 0) > 0)).map(s => `<option value="${esc(s.name)}" ${val === s.name ? "selected" : ""}>${esc(s.name)}${onlyMine ? ` (${me.holdings[s.name]})` : ""}</option>`).join("")}`;
  const row = (x, incomingRow) => {
    const other = playerBy(incomingRow ? x.from : x.to);
    const left = Math.max(0, 3 - (room.day - x.day));
    return `<div class="card deal-card">
      <div class="row-between"><strong style="color:${other ? other.color : "#fff"}">${esc(other ? other.name : "?")}</strong><span class="muted small-t">${t("deal.expires", { n: left })}</span></div>
      <div class="deal-swap mt8">
        <div><span class="label">${incomingRow ? t("deal.youGet") : t("deal.youGive")}</span>${esc(dealSideText(x.give))}</div>
        <div class="swap-icon">⇄</div>
        <div><span class="label">${incomingRow ? t("deal.youGive") : t("deal.youGet")}</span>${esc(dealSideText(x.want))}</div>
      </div>
      <div class="btn-row mt8">${incomingRow ? `${btn(`✓ ${t("deal.accept")}`, "deal-accept", { arg: x.id, color: "#22c55e" })}${btn(`✕ ${t("deal.decline")}`, "deal-decline", { arg: x.id, color: "#ef4444" })}`
        : btn(t("deal.cancel"), "deal-cancel", { arg: x.id, color: "#64748b" })}</div>
    </div>`;
  };
  return `<div class="grid">
    <div class="card span-all"><span class="label">🤝 ${t("deal.new")}</span>
      <p class="muted small-t">${t("deal.help")}</p>
      ${others.length ? `
      <label class="field"><span class="label">${t("deal.with")}</span><select class="input" data-deal="to"><option value="">${t("deal.pickPlayer")}</option>${others.map(p => `<option value="${p.id}" ${d.to === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      <div class="deal-form mt8">
        <div class="sub-card"><span class="label">${t("deal.youGive")}</span>
          <input class="input" type="text" inputmode="numeric" placeholder="${esc(t("deal.cashPh"))}" data-deal="giveCash" data-focuskey="dgc" value="${esc(d.giveCash)}">
          <div class="trade-row mt8"><select class="input" data-deal="giveStock">${stocksOpt(d.giveStock, true)}</select>
          <input class="input" type="text" inputmode="numeric" placeholder="${esc(t("amount"))}" data-deal="giveQty" data-focuskey="dgq" value="${esc(d.giveQty)}"></div></div>
        <div class="swap-icon">⇄</div>
        <div class="sub-card"><span class="label">${t("deal.youWant")}</span>
          <input class="input" type="text" inputmode="numeric" placeholder="${esc(t("deal.cashPh"))}" data-deal="wantCash" data-focuskey="dwc" value="${esc(d.wantCash)}">
          <div class="trade-row mt8"><select class="input" data-deal="wantStock">${stocksOpt(d.wantStock, false)}</select>
          <input class="input" type="text" inputmode="numeric" placeholder="${esc(t("amount"))}" data-deal="wantQty" data-focuskey="dwq" value="${esc(d.wantQty)}"></div></div>
      </div>
      <div class="mt12">${btn(t("deal.send"), "deal-send", { color: "#22c55e", cls: "lg" })}</div>` : `<div class="muted">${t("deal.alone")}</div>`}
    </div>
    <div class="span-all"><span class="label">${t("deal.incoming")} (${incoming.length})</span></div>
    ${incoming.length ? incoming.map(x => row(x, true)).join("") : `<div class="card muted span-all">${t("deal.none")}</div>`}
    <div class="span-all"><span class="label">${t("deal.outgoing")} (${outgoing.length}/3)</span></div>
    ${outgoing.length ? outgoing.map(x => row(x, false)).join("") : `<div class="card muted span-all">${t("deal.none")}</div>`}
  </div>`;
}

function renderPlayers() {
  const ranked = room.players.slice().sort((a, b) => b.netWorth - a.netWorth);
  return `<div class="grid">
    <div class="card span-all"><span class="label">${t("rivals.ranking")}</span>
      ${ranked.map((p, i) => {
        const owns = room.stocks.filter(s => s.ownerId === p.id).map(s => s.name);
        const st = !p.connected ? t("online.offline") : p.afk ? t("online.afk") : p.skip ? `⏩ ${t("online.ready")}` : t("online.playing");
        return `<div class="sum-row ${p.id === room.me.id ? "total" : ""}"><span><span class="dot" style="background:${p.color}"></span>${i + 1}. ${esc(p.name)}${p.id === room.me.id ? ` (${t("you")})` : ""} <span class="muted small-t">${st}${owns.length ? ` • 👑 ${esc(owns.join(", "))}` : ""}</span></span><span>${fmtShort(p.netWorth)}</span></div>`;
      }).join("")}</div>
    <div class="card span-all muted small-t lh">${t("online.afkHelp")}</div>
  </div>`;
}

function renderChat() {
  return `<div class="card chat">
    <div class="chat-log" id="chat-log">${room.chat.length ? room.chat.map(m => `<div class="chat-msg"><b style="color:${m.color}">${esc(m.name)}</b> ${esc(m.text)}</div>`).join("") : `<div class="muted">${t("chat.empty")}</div>`}</div>
    <form class="chat-form" data-form="chat"><input class="input" type="text" maxlength="160" placeholder="${esc(t("chat.ph"))}" data-field="chatDraft" data-focuskey="chat" value="${esc(ui.chatDraft)}" autocomplete="off">
      <button class="btn" style="--c:#a78bfa" type="submit">${t("chat.send")}</button></form>
    <div class="btn-row mt8">${["👋", "😂", "🚀", "📉", "💸", "🤝", "😈"].map(e => `<button class="btn small" style="--c:#64748b" data-act="emoji" data-arg="${e}">${e}</button>`).join("")}</div>
  </div>`;
}

function renderNews() {
  return `<div class="card">${room.news.map(n => `<div class="sum-row"><span class="${n.kind === "bad" ? "warn" : ""}">${esc(I18N.newsText(n))}</span><span class="muted small-t">${t("day.short", { n: n.day })}</span></div>`).join("")}</div>`;
}

function renderSettings() {
  const sysSupported = "Notification" in window;
  return `<div class="grid">
    <div class="card"><span class="label">🌍 ${t("settings.language")}</span>${langSelect()}</div>
    <div class="card"><span class="label">${t("settings.sound")}</span>${btn(Sound.enabled ? `🔊 ${t("settings.soundOn")}` : `🔇 ${t("settings.soundOff")}`, "sound", { color: Sound.enabled ? "#22c55e" : "#64748b" })}</div>
    <div class="card"><span class="label">🔴 ${t("settings.notify")}</span>
      <div class="muted small-t mb6">${t("settings.notifyText")}</div>
      ${btn(ui.notify ? t("settings.on") : t("settings.off"), "notify", { color: ui.notify ? "#22c55e" : "#64748b" })}</div>
    <div class="card"><span class="label">📱 ${t("settings.sysNotify")}</span>
      <div class="muted small-t mb6">${sysSupported ? t("settings.sysNotifyText") : t("settings.sysNotifyNo")}</div>
      ${btn(ui.sysNotify ? t("settings.on") : t("settings.off"), "sysnotify", { color: ui.sysNotify ? "#22c55e" : "#64748b", disabled: !sysSupported })}</div>
    <div class="card span-all">${btn(`🚪 ${t("online.leave")}`, "leave", { color: "#ef4444" })}</div>
  </div>`;
}

function renderEnded() {
  const ranked = room.players.slice().sort((a, b) => b.netWorth - a.netWorth);
  const winner = playerBy(room.winnerId), iWon = winner && winner.id === room.me.id;
  return `<div class="card end">
    <div class="end-icon">${iWon ? "🏆" : "🏁"}</div>
    <h2 style="color:${iWon ? "#22c55e" : "#e2e8f0"}">${iWon ? t("end.youWin") : t("end.playerWins", { player: esc(winner ? winner.name : "?") })}</h2>
    <p class="muted">${room.end ? esc(I18N.msg([room.end])) : ""}</p>
    <div class="mt12">${ranked.map((p, i) => `<div class="sum-row ${p.id === room.me.id ? "total" : ""}"><span>${["🥇", "🥈", "🥉"][i] || `${i + 1}.`} <span style="color:${p.color}">${esc(p.name)}</span></span><span>${fmtShort(p.netWorth)}</span></div>`).join("")}</div>
    ${room.worth ? `<span class="label mt12">${t("end.chart")}</span><div class="chart-wrap end-chart"><canvas id="worthchart"></canvas></div>
      <div class="legend small-t">${room.players.map(p => `<span><i style="background:${p.color}"></i>${esc(p.name)}</span>`).join("")}</div>` : ""}
    <div class="btn-row center mt12">${btn(t("online.backMenu"), "leave", { color: "#a78bfa", cls: "lg" })}</div>
  </div>`;
}

function drawWorthChart() {
  const canvas = $("worthchart");
  if (!canvas || !room || !room.worth) return;
  const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const series = room.players.map(p => ({ p, v: room.worth[p.id] || [] })).filter(s => s.v.length);
  const len = Math.max(...series.map(s => s.v.length), 2);
  const all = series.flatMap(s => s.v);
  let min = Math.min(0, ...all), max = Math.max(...all, 1);
  const P = { l: w < 420 ? 50 : 62, r: 10, t: 10, b: 22 };
  const X = i => P.l + i / (len - 1) * (w - P.l - P.r);
  const Y = v => P.t + (1 - (v - min) / (max - min)) * (h - P.t - P.b);
  ctx.font = "11px 'IBM Plex Mono', monospace"; ctx.strokeStyle = "#1e293b"; ctx.fillStyle = "#64748b"; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const v = min + (max - min) * i / 4, y = Y(v);
    ctx.beginPath(); ctx.moveTo(P.l, y); ctx.lineTo(w - P.r, y); ctx.stroke();
    ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(fmtShort(v), P.l - 6, y);
  }
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let i = 0; i < 5; i++) { const idx = Math.round(i * (len - 1) / 4); ctx.fillText(t("day.short", { n: idx + 1 }), X(idx), h - P.b + 6); }
  series.forEach(({ p, v }) => {
    const off = len - v.length; // players who joined later start further right
    ctx.beginPath(); v.forEach((val, i) => (i ? ctx.lineTo(X(i + off), Y(val)) : ctx.moveTo(X(i + off), Y(val))));
    ctx.strokeStyle = p.color; ctx.lineWidth = p.id === room.me.id ? 3 : 2; ctx.stroke();
  });
}

function renderModal() {
  const root = $("modal-root");
  const ch = room && room.phase === "playing" && room.me && room.me.choice;
  if (ch) {
    document.body.classList.add("modal-open");
    root.innerHTML = `<div class="modal-backdrop"></div><div class="modal" role="dialog" aria-modal="true">
      <h2>${t(`choice.${ch.id}.title`)}</h2><p>${esc(t(`choice.${ch.id}.text`, { company: ch.stock }))}</p>
      <p class="muted small-t">${t("choice.cash", { company: esc(ch.stock), cash: fmtShort(ch.companyCash) })} • ${t("choice.timeout")}</p>
      <div class="stack mt8">${ch.options.map((o, i) => btn(esc(t(`choice.${ch.id}.o${i}`)), "choose", { arg: i, color: i === 0 ? "#22c55e" : "#94a3b8", cls: "lg", disabled: o.pay > ch.companyCash })).join("")}</div></div>`;
    return;
  }
  if (ui.modal && ui.modal.type === "alerts" && room && room.stocks) {
    const s = room.stocks.find(x => x.name === ui.modal.name);
    if (s) {
      const mine = getAlerts().filter(a => a.name === s.name);
      const ae = document.activeElement, keep = ae && ae.dataset && ae.dataset.focuskey === "alert-price";
      document.body.classList.add("modal-open");
      root.innerHTML = `<div class="modal-backdrop" data-act="close"></div><div class="modal" role="dialog" aria-modal="true">
        <div class="row-between"><h2>🔔 ${esc(s.name)}</h2><button class="x" data-act="close" aria-label="${esc(t("close"))}">✕</button></div>
        <p class="muted small-t">${t("alert.help", { price: I18N.money(s.price) })}</p>
        <input class="input" type="text" inputmode="decimal" data-alert-price data-focuskey="alert-price" value="${esc(ui.alertPrice)}" placeholder="${esc(t("alert.pricePh"))}">
        <div class="btn-row mt8">${btn(`▲ ${t("alert.above")}`, "alert-add", { arg: "above", color: "#22c55e" })}${btn(`▼ ${t("alert.below")}`, "alert-add", { arg: "below", color: "#ef4444" })}</div>
        ${mine.length ? `<span class="label mt12">${t("alert.active")}</span>${mine.map(a => `<div class="sum-row"><span>${a.dir === "above" ? "≥" : "≤"} ${I18N.money(a.price)}</span><button class="btn small" style="--c:#ef4444" data-act="alert-del" data-arg="${a.id}" aria-label="${esc(t("delete"))}">✕</button></div>`).join("")}` : ""}
      </div>`;
      if (keep) { const el = root.querySelector("[data-alert-price]"); if (el) el.focus(); }
      return;
    }
  }
  root.innerHTML = ""; document.body.classList.remove("modal-open");
}

function render() {
  renderHeader();
  renderTabs();
  const main = $("main");
  const ae = document.activeElement;
  if (ae && ae.tagName === "SELECT" && main.contains(ae)) { renderModal(); return; }
  let focusKey = null, ss = null, se = null;
  if (ae && ae.dataset && ae.dataset.focuskey && main.contains(ae)) { focusKey = ae.dataset.focuskey; try { ss = ae.selectionStart; se = ae.selectionEnd; } catch { /* ignore */ } }
  const log = $("chat-log");
  const atBottom = !log || log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  let html;
  if (!room || !room.me) html = renderMenu();
  else if (room.phase === "lobby") html = renderLobby();
  else if (room.phase === "ended") html = renderEnded();
  else html = ({ market: renderMarket, company: renderCompany, deals: renderDeals, players: renderPlayers, chat: renderChat, news: renderNews, settings: renderSettings }[ui.tab] || renderMarket)();
  main.innerHTML = html;
  const newLog = $("chat-log");
  if (newLog && atBottom) newLog.scrollTop = newLog.scrollHeight;
  if (focusKey) {
    const el = main.querySelector(`[data-focuskey="${CSS.escape(focusKey)}"]`);
    if (el) { el.focus({ preventScroll: true }); try { if (ss != null) el.setSelectionRange(ss, se); } catch { /* ignore */ } }
  }
  if (room && room.phase === "ended") requestAnimationFrame(drawWorthChart);
  renderModal();
}

// ═══════════════════════════════════════════════════════════════════════════
// Input
// ═══════════════════════════════════════════════════════════════════════════

const readInt = v => { const n = Math.floor(Number(String(v || "").replace(/[^\d]/g, ""))); return n > 0 ? n : 0; };
function needName() {
  ui.name = ui.name.trim();
  if (!ui.name) { toast(t("online.needName"), "warn"); const el = document.querySelector("[data-field=name]"); if (el) el.focus(); return true; }
  storageSet(NAME_KEY, ui.name);
  return false;
}
function sendDeal() {
  const d = ui.deal;
  if (!d.to) return toast(t("deal.pickPlayer"), "warn");
  const give = { cash: readInt(d.giveCash), stock: d.giveStock || null, qty: d.giveStock ? readInt(d.giveQty) : 0 };
  const want = { cash: readInt(d.wantCash), stock: d.wantStock || null, qty: d.wantStock ? readInt(d.wantQty) : 0 };
  if (!give.cash && !give.qty && !want.cash && !want.qty) return toast(t("err.dealEmpty"), "warn");
  send({ t: "deal_offer", to: d.to, give, want });
  ui.deal = { to: d.to, giveCash: "", giveStock: "", giveQty: "", wantCash: "", wantStock: "", wantQty: "" };
  toast(t("deal.sent"));
  sound("deal");
}

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const act = el.dataset.act, arg = el.dataset.arg;
  switch (act) {
    case "create": if (needName()) return; connect({ t: "create", name: ui.name, settings: ui.settings }); break;
    case "join": {
      if (needName()) return;
      const code = ui.joinCode.trim().toUpperCase();
      if (code.length !== 4) return toast(t("online.codeLength"), "warn");
      connect({ t: "join", code, name: ui.name });
      break;
    }
    case "start": send({ t: "start" }); break;
    case "leave": send({ t: "leave" }); break;
    case "copy": (navigator.clipboard ? navigator.clipboard.writeText(arg) : Promise.reject()).then(() => toast(t("online.copied")), () => toast(arg)); break;
    case "share": navigator.share({ title: t("app.titleOnline"), text: t("online.shareText", { code: room.code }), url: arg }).catch(() => {}); break;
    case "tab": ui.tab = arg; markSeen(); render(); break;
    case "select": ui.selected = arg; render(); break;
    case "buy": case "sell": case "short": {
      const q = readInt(ui.amounts[arg]);
      if (!q) { toast(t("err.amount"), "warn"); sound("error"); return; }
      send({ t: act, stock: arg, qty: q });
      sound(act === "buy" ? "buy" : "sell");
      break;
    }
    case "cover": send({ t: "cover", stock: arg }); sound("buy"); break;
    case "max": {
      const s = room.stocks.find(x => x.name === arg);
      const canBuy = Math.floor(room.me.cash / (s.price * 1.02));
      ui.amounts[arg] = String(canBuy > 0 ? canBuy : room.me.holdings[arg] || "");
      render(); break;
    }
    case "co": {
      const [action, value] = arg.split(":");
      send({ t: "company", stock: el.dataset.stock, action, value: action === "dividend" ? Number(value) : value });
      break;
    }
    case "choose": send({ t: "choice", option: Number(arg) }); break;
    case "skip": send({ t: "skip", on: !room.me.skip }); break;
    case "autoskip": send({ t: "autoskip", on: !room.me.autoSkip }); break;
    case "pause": send({ t: "pause" }); break;
    case "emoji": send({ t: "chat", text: arg }); break;
    case "deal-send": sendDeal(); break;
    case "deal-accept": send({ t: "deal_accept", id: Number(arg) }); sound("buy"); break;
    case "deal-decline": send({ t: "deal_decline", id: Number(arg) }); break;
    case "deal-cancel": send({ t: "deal_cancel", id: Number(arg) }); break;
    case "alerts": { const s = room.stocks.find(x => x.name === arg); ui.alertPrice = (s.price * 1.05).toFixed(2); ui.modal = { type: "alerts", name: arg }; renderModal(); break; }
    case "alert-add": {
      const s = room.stocks.find(x => x.name === ui.modal.name), price = parsePrice(ui.alertPrice);
      if (!(price > 0)) { toast(t("alert.invalid"), "warn"); break; }
      if (arg === "above" && price <= s.price) { toast(t("alert.mustAbove", { price: I18N.money(s.price) }), "warn"); break; }
      if (arg === "below" && price >= s.price) { toast(t("alert.mustBelow", { price: I18N.money(s.price) }), "warn"); break; }
      const a = getAlerts(); if (a.length >= 20) { toast(t("alert.max", { n: 20 }), "warn"); break; }
      a.push({ id: Date.now(), name: s.name, dir: arg, price: Math.round(price * 100) / 100 }); setAlerts(a);
      toast(t("alert.set", { company: s.name })); render(); break;
    }
    case "alert-del": setAlerts(getAlerts().filter(a => String(a.id) !== arg)); render(); break;
    case "close": ui.modal = null; renderModal(); break;
    case "sound": Sound.enabled = !Sound.enabled; render(); sound("buy"); break;
    case "notify": ui.notify = !ui.notify; storageSet(NOTIFY_KEY, ui.notify ? "1" : "0"); render(); break;
    case "sysnotify":
      if (ui.sysNotify) { ui.sysNotify = false; storageSet(SYSNOTIFY_KEY, "0"); render(); break; }
      Notification.requestPermission().then(p => {
        ui.sysNotify = p === "granted"; storageSet(SYSNOTIFY_KEY, ui.sysNotify ? "1" : "0");
        if (!ui.sysNotify) toast(t("settings.sysNotifyDenied"), "warn");
        render();
      });
      break;
  }
});

document.addEventListener("input", e => {
  const tg = e.target;
  if (tg.dataset.amount !== undefined) {
    const clean = tg.value.replace(/[^\d]/g, "").slice(0, 9);
    if (clean !== tg.value) tg.value = clean;
    ui.amounts[tg.dataset.amount] = clean;
  } else if (tg.dataset.deal && tg.tagName === "INPUT") {
    const clean = tg.value.replace(/[^\d]/g, "").slice(0, 12);
    if (clean !== tg.value) tg.value = clean;
    ui.deal[tg.dataset.deal] = clean;
  } else if (tg.dataset.alertPrice !== undefined) ui.alertPrice = tg.value.replace(/[^\d.,]/g, "");
  else if (tg.dataset.field === "joinCode") {
    const clean = tg.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    if (clean !== tg.value) tg.value = clean;
    ui.joinCode = clean;
  } else if (tg.dataset.field === "server") {
    const v = tg.value.trim();
    if (v) storageSet(SERVER_KEY, v); else storageDel(SERVER_KEY);
  } else if (tg.dataset.field) ui[tg.dataset.field] = tg.value;
});

document.addEventListener("change", e => {
  const tg = e.target;
  if (tg.dataset.lang !== undefined) { I18N.setLang(tg.value); return; }
  if (tg.dataset.deal && tg.tagName === "SELECT") { ui.deal[tg.dataset.deal] = tg.value; tg.blur(); render(); return; }
  if (!tg.dataset.setting) return;
  const k = tg.dataset.setting;
  const v = k === "startCash" || k === "dayLimit" ? Number(tg.value) : tg.value;
  if (room && room.phase === "lobby" && room.me && room.me.isHost) send({ t: "settings", settings: { [k]: v } });
  else ui.settings[k] = v;
  tg.blur();
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
  if (e.key === "Escape" && ui.modal) { ui.modal = null; renderModal(); return; }
  const tg = e.target;
  if (e.key !== "Enter" || !tg.dataset) return;
  if (tg.dataset.amount) { const q = readInt(ui.amounts[tg.dataset.amount]); if (q) { send({ t: "buy", stock: tg.dataset.amount, qty: q }); sound("buy"); } }
  else if (tg.dataset.field === "joinCode" || (tg.dataset.field === "name" && ui.joinCode.length === 4)) document.querySelector("[data-act=join]").click();
});

document.addEventListener("visibilitychange", () => { if (!document.hidden && wantOpen && !connected) { retry = 0; connect(); } });
window.addEventListener("resize", () => { if (room && room.phase === "ended") drawWorthChart(); });
I18N.onChange(() => render());

// ═══════════════════════════════════════════════════════════════════════════
// Boot: rejoin a running game automatically.
// ═══════════════════════════════════════════════════════════════════════════

render();
if (loadSession()) connect();
window.__online = { get room() { return room; }, ui, send };

})();
