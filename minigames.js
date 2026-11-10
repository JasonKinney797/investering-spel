"use strict";
// Overtime mini-games for the job system. One per company.
// MiniGames.start(id, element, done) shows an intro, runs the game and calls done(score) with a score from 0 to 1.
(function () {
  const t = (k, p) => I18N.t(k, p);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let timers = [], raf = 0, active = false;
  const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const every = (fn, ms) => { const id = setInterval(fn, ms); timers.push(id); return id; };
  function stop() {
    active = false;
    timers.forEach(id => { clearTimeout(id); clearInterval(id); });
    timers = [];
    cancelAnimationFrame(raf);
  }

  function shell(el, id) {
    el.innerHTML = `<div class="mg"><div class="mg-head"><strong>${t(`mg.${id}.name`)}</strong><span id="mg-info"></span></div>
      <div class="bar"><div id="mg-time" style="width:100%;background:#f59e0b"></div></div><div class="mg-body" id="mg-body"></div></div>`;
    return el.querySelector("#mg-body");
  }
  const info = txt => { const e = document.getElementById("mg-info"); if (e) e.textContent = txt; };
  function countdown(seconds, onEnd) {
    const start = performance.now();
    every(() => {
      const left = 1 - (performance.now() - start) / (seconds * 1000);
      const b = document.getElementById("mg-time");
      if (b) b.style.width = `${Math.max(0, left * 100)}%`;
      if (left <= 0) onEnd();
    }, 100);
  }

  // ── Engine: timed multiple choice ──────────────────────────────────────────
  function quiz(el, id, finish, { seconds, total, gen }) {
    const body = shell(el, id);
    let n = 0, ok = 0, locked = false;
    const next = () => {
      if (n >= total) return finish(ok / total);
      const q = gen();
      locked = false;
      info(`${n + 1}/${total}`);
      body.innerHTML = `<div class="mg-prompt">${q.prompt}</div><div class="mg-opts c${q.options.length}">${q.options.map((o, i) =>
        `<button class="mg-opt" data-i="${i}" data-ok="${o.ok ? 1 : 0}">${o.label}</button>`).join("")}</div>`;
      body.querySelectorAll(".mg-opt").forEach(b => { b.onclick = () => {
        if (locked) return;
        locked = true;
        const good = b.dataset.ok === "1";
        if (good) ok++;
        b.classList.add(good ? "good" : "bad");
        n++;
        later(next, 160);
      }; });
    };
    countdown(seconds, () => finish(ok / total));
    next();
  }

  const GEN = {
    change() {
      const price = (21 + Math.floor(Math.random() * 359)) * 5;              // cents, €1.05–€18.95
      const paid = [500, 1000, 2000].find(v => v > price);
      const change = paid - price;
      const wrong = shuffle([change + 10, change - 10, change + 100, change - 100, change + 50, change - 50, change + 5].filter(v => v > 0 && v !== change)).slice(0, 3);
      const m = v => I18N.money(v / 100);
      return { prompt: `🛒 ${t("mg.paid", { price: m(price), paid: m(paid) })}`, options: shuffle([{ label: m(change), ok: true }, ...wrong.map(v => ({ label: m(v), ok: false }))]) };
    },
    fake() {
      let value = pick([5, 10, 20, 50, 100, 200, 500]), word = "EURO", symbol = "€";
      const fake = Math.random() < 0.5;
      if (fake) {
        const flaw = Math.floor(Math.random() * 3);
        if (flaw === 0) value = pick([15, 25, 30, 70, 150, 300]);
        else if (flaw === 1) word = pick(["EVRO", "EURQ", "EUR0", "EORU", "EURO0"]);
        else symbol = pick(["$", "£"]);
      }
      return { prompt: `<div class="note"><b>${symbol}${value}</b><small>${word}</small></div>`,
        options: [{ label: `✅ ${t("mg.real")}`, ok: !fake }, { label: `❌ ${t("mg.fakeBtn")}`, ok: fake }] };
    },
    gatesFactory() {
      const cities = shuffle(["PAR", "NYC", "TOK", "ROM", "DXB", "SYD", "RIO", "BER"]).slice(0, 3);
      const gates = ["A", "B", "C"];
      return () => {
        const i = Math.floor(Math.random() * 3);
        return { prompt: `<div class="legend-line">${gates.map((g, k) => `${g} = ${cities[k]}`).join(" &nbsp;•&nbsp; ")}</div><div class="bag">🧳 ${cities[i]}</div>`,
          options: gates.map((g, k) => ({ label: t("mg.gate", { g }), ok: k === i })) };
      };
    },
    compare() {
      const fmtViews = v => (v >= 1e6 && Math.random() < 0.7 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}K`);
      const shown = s => (s.endsWith("M") ? parseFloat(s) * 1e6 : parseFloat(s) * 1e3);
      let a, b;
      do {
        const v = 60000 + Math.random() * 3000000;
        a = fmtViews(v); b = fmtViews(v * (0.55 + Math.random() * 1.1));
      } while (shown(a) === shown(b));
      const icons = shuffle(["🐱", "🎸", "⚽", "🍕", "🚗", "🎮", "💃", "🐶"]);
      return { prompt: `📺 ${t("mg.compare.how")}`, options: [a, b].map((s, k) => ({ label: `<span class="vid">${icons[k]}</span>${s} ${t("mg.views")}`, ok: shown(s) === Math.max(shown(a), shown(b)) })) };
    },
  };

  // ── Engine: stop the moving marker in the zone ─────────────────────────────
  function timing(el, id, finish, { rounds, stack }) {
    const body = shell(el, id);
    body.innerHTML = `<div class="mg-stage" id="mg-stage"></div><div class="track"><div class="zone" id="mg-zone"></div><div class="marker" id="mg-marker"></div></div>
      <button class="mg-big" id="mg-stop">${t("mg.stop")}</button>`;
    const zone = body.querySelector("#mg-zone"), marker = body.querySelector("#mg-marker"), stage = body.querySelector("#mg-stage");
    let r = 0, sum = 0, pos = 0, dir = 1, center = 0.5, hw = 0.12, speed = 0.9, last = performance.now(), waiting = false;
    const setup = () => {
      center = 0.2 + Math.random() * 0.6; hw = 0.12 - r * 0.015; speed = 0.85 + r * 0.3; waiting = false;
      zone.style.left = `${(center - hw) * 100}%`; zone.style.width = `${hw * 200}%`;
      info(t("mg.round", { n: r + 1, total: rounds }));
      stage.textContent = stack ? "🏢".repeat(r + 1) : "🚀".repeat(r + 1);
    };
    const frame = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!waiting) {
        pos += dir * speed * dt;
        if (pos > 1) { pos = 1; dir = -1; } else if (pos < 0) { pos = 0; dir = 1; }
        marker.style.left = `${pos * 100}%`;
      }
      raf = requestAnimationFrame(frame);
    };
    body.querySelector("#mg-stop").onclick = () => {
      if (waiting) return;
      waiting = true;
      const d = Math.abs(pos - center);
      const s = d <= hw * 0.35 ? 1 : Math.max(0, 1 - (d - hw * 0.35) / (hw * 1.8));
      sum += s;
      marker.classList.add(s >= 0.5 ? "good" : "bad");
      r++;
      later(() => { marker.classList.remove("good", "bad"); if (r >= rounds) finish(sum / rounds); else setup(); }, 450);
    };
    countdown(8 * rounds, () => finish(sum / rounds));
    setup();
    raf = requestAnimationFrame(frame);
  }

  // ── Engine: tap things before they vanish ──────────────────────────────────
  function whack(el, id, finish) {
    const body = shell(el, id);
    body.innerHTML = `<div class="grid9">${Array.from({ length: 9 }, (_, i) => `<button class="cell" data-i="${i}"></button>`).join("")}</div>`;
    const cells = [...body.querySelectorAll(".cell")];
    let spawned = 0, hits = 0;
    cells.forEach(c => { c.onclick = () => { if (c.dataset.bug === "1") { hits++; c.dataset.bug = "0"; c.textContent = "💥"; later(() => { if (c.dataset.bug !== "1") c.textContent = ""; }, 150); info(`${hits}`); } }; });
    every(() => {
      const free = cells.filter(c => c.dataset.bug !== "1");
      if (!free.length) return;
      const c = pick(free);
      c.dataset.bug = "1"; c.textContent = "🐛"; spawned++;
      later(() => { if (c.dataset.bug === "1") { c.dataset.bug = "0"; c.textContent = ""; } }, 900);
    }, 620);
    countdown(18, () => finish(spawned ? hits / spawned : 0));
  }

  // ── Engine: keep the needle in the zone ────────────────────────────────────
  function balance(el, id, finish) {
    const body = shell(el, id);
    body.innerHTML = `<div class="mg-stage">⚡</div><div class="track"><div class="zone" style="left:35%;width:30%"></div><div class="marker" id="mg-marker" style="left:50%"></div></div>
      <div class="mg-opts c2"><button class="mg-big" id="mg-left">◀</button><button class="mg-big" id="mg-right">▶</button></div>`;
    const marker = body.querySelector("#mg-marker");
    let v = 50, d = 0, inZone = 0, total = 0;
    body.querySelector("#mg-left").onclick = () => { d -= 3; };
    body.querySelector("#mg-right").onclick = () => { d += 3; };
    every(() => {
      d = clamp(d + (Math.random() - 0.5) * 1.7, -4.5, 4.5);
      v += d;
      if (v <= 0 || v >= 100) { v = clamp(v, 0, 100); d = 0; }
      total++;
      const ok = v >= 35 && v <= 65;
      if (ok) inZone++;
      marker.style.left = `${v}%`;
      marker.classList.toggle("bad", !ok);
      info(`${Math.round(inZone / total * 100)}%`);
    }, 100);
    countdown(20, () => finish(total ? inZone / total : 0));
  }

  // ── Engine: repeat the sequence ────────────────────────────────────────────
  function memory(el, id, finish) {
    const body = shell(el, id);
    const colors = ["#ef4444", "#22c55e", "#3b82f6", "#f59e0b"];
    body.innerHTML = `<div class="mg-stage" id="mg-stage"></div><div class="tubes">${colors.map((c, i) => `<button class="tube" data-i="${i}" style="--c:${c}">🧪</button>`).join("")}</div>`;
    const tubes = [...body.querySelectorAll(".tube")], stage = body.querySelector("#mg-stage");
    const lengths = [3, 4, 5, 6];
    let r = 0, good = 0, seq = [], at = 0, input = false;
    const flash = i => { tubes[i].classList.add("lit"); later(() => tubes[i].classList.remove("lit"), 330); };
    const round = () => {
      if (r >= lengths.length) return finish(good / lengths.length);
      seq = Array.from({ length: lengths[r] }, () => Math.floor(Math.random() * 4));
      at = 0; input = false;
      info(t("mg.round", { n: r + 1, total: lengths.length }));
      stage.textContent = t("mg.watch");
      seq.forEach((c, k) => later(() => flash(c), 500 + k * 520));
      later(() => { input = true; stage.textContent = t("mg.repeat"); }, 500 + seq.length * 520);
    };
    tubes.forEach(b => { b.onclick = () => {
      if (!input) return;
      const i = Number(b.dataset.i);
      flash(i);
      if (i !== seq[at]) { input = false; stage.textContent = "❌"; r++; later(round, 600); return; }
      at++;
      if (at >= seq.length) { input = false; good++; stage.textContent = "✅"; r++; later(round, 600); }
    }; });
    countdown(50, () => finish(good / lengths.length));
    round();
  }

  // ── Engine: find the odd one out ───────────────────────────────────────────
  function spotdiff(el, id, finish) {
    const body = shell(el, id);
    const pairs = [["😀", "😃"], ["🔒", "🔓"], ["🌕", "🌖"], ["🕐", "🕑"], ["📗", "📘"], ["🙂", "🙃"], ["🍎", "🍅"], ["⬆️", "↗️"]];
    const rounds = 6;
    let r = 0, good = 0, locked = false;
    const set = shuffle(pairs.slice());
    const next = () => {
      if (r >= rounds) return finish(good / rounds);
      locked = false;
      const [a, b] = Math.random() < 0.5 ? set[r] : [set[r][1], set[r][0]];
      const odd = Math.floor(Math.random() * 25);
      info(t("mg.round", { n: r + 1, total: rounds }));
      body.innerHTML = `<div class="grid25">${Array.from({ length: 25 }, (_, i) => `<button class="cell" data-ok="${i === odd ? 1 : 0}">${i === odd ? b : a}</button>`).join("")}</div>`;
      body.querySelectorAll(".cell").forEach(c => { c.onclick = () => {
        if (locked) return;
        locked = true;
        const ok = c.dataset.ok === "1";
        if (ok) good++;
        c.classList.add(ok ? "good" : "bad");
        r++;
        later(next, 220);
      }; });
    };
    countdown(32, () => finish(good / rounds));
    next();
  }

  const GAMES = {
    change:  (el, f) => quiz(el, "change", f, { seconds: 32, total: 6, gen: GEN.change }),
    fake:    (el, f) => quiz(el, "fake", f, { seconds: 25, total: 10, gen: GEN.fake }),
    gates:   (el, f) => quiz(el, "gates", f, { seconds: 25, total: 12, gen: GEN.gatesFactory() }),
    compare: (el, f) => quiz(el, "compare", f, { seconds: 22, total: 12, gen: GEN.compare }),
    launch:  (el, f) => timing(el, "launch", f, { rounds: 3 }),
    stack:   (el, f) => timing(el, "stack", f, { rounds: 5, stack: true }),
    bugs:    (el, f) => whack(el, "bugs", f),
    balance: (el, f) => balance(el, "balance", f),
    memory:  (el, f) => memory(el, "memory", f),
    diff:    (el, f) => spotdiff(el, "diff", f),
  };

  function start(id, el, done) {
    stop();
    if (!GAMES[id]) return done(0);
    el.innerHTML = `<div class="mg mg-intro"><div class="mg-icon">🎮</div><h2>${t(`mg.${id}.name`)}</h2><p>${t(`mg.${id}.how`)}</p>
      <button class="mg-big" id="mg-start">${t("mg.start")}</button></div>`;
    el.querySelector("#mg-start").onclick = () => {
      active = true;
      GAMES[id](el, score => {
        if (!active) return;
        stop();
        done(clamp(Number(score) || 0, 0, 1));
      });
    };
  }

  window.MiniGames = { start, stop, ids: Object.keys(GAMES) };
})();
