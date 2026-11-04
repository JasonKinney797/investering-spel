"use strict";
// Sound effects (Kenney, CC0) from assets/sounds/. Shared by solo and online.
// Uses WebAudio for low latency; falls back to <audio> when files can't be fetched (file://).
(function () {
  const NAMES = ["buy", "sell", "day", "achievement", "rankup", "goal", "bad", "error", "win", "chat", "takeover", "deal", "alert"];
  const STORE_KEY = "inv-sound";
  const script = document.currentScript;
  const BASE = script ? new URL("assets/sounds/", script.src).href : "assets/sounds/";
  const MIN_GAP_MS = 70;   // the same sound can't stack up when many events happen at once

  let enabled = (() => { try { return localStorage.getItem(STORE_KEY) !== "0"; } catch { return true; } })();
  // Opened as a local file: fetch() isn't allowed there, so play through <audio> elements instead.
  let ctx = null, loading = null, useElements = location.protocol === "file:";
  const buffers = {}, last = {};

  function context() {
    if (useElements) return null;
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { useElements = true; return null; }
    ctx = new AC();
    load();
    return ctx;
  }
  function load() {
    if (loading) return loading;
    loading = Promise.all(NAMES.map(n =>
      fetch(BASE + n + ".mp3")
        .then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(b => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
        .then(buf => { buffers[n] = buf; })
        .catch(() => { useElements = true; })
    ));
    return loading;
  }

  function play(name) {
    if (!enabled || !NAMES.includes(name)) return;
    const now = performance.now();
    if (last[name] && now - last[name] < MIN_GAP_MS) return;
    last[name] = now;
    const c = context();
    if (c && c.state === "suspended") c.resume().catch(() => {});
    const buf = buffers[name];
    if (c && buf) {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start();
    } else if (useElements || !c) {
      try { const a = new Audio(BASE + name + ".mp3"); a.play().catch(() => {}); } catch { /* ignore */ }
    }
  }

  // Browsers only allow audio after a user gesture: prepare on the first tap/click/key.
  const unlock = () => { const c = context(); if (c && c.state === "suspended") c.resume().catch(() => {}); };
  ["pointerdown", "keydown"].forEach(ev => window.addEventListener(ev, unlock, { once: true, capture: true }));

  window.Sound = {
    play,
    get enabled() { return enabled; },
    set enabled(v) {
      enabled = !!v;
      try { localStorage.setItem(STORE_KEY, enabled ? "1" : "0"); } catch { /* ignore */ }
    },
  };
})();
