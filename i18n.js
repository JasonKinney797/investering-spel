"use strict";
// Translation system shared by solo (index.html) and online (online.html).
// Language files in lang/*.js call I18N.add("xx", { key: "text with {param}" }).
(function () {
  const LANGS = {
    en: { name: "English",    locale: "en-GB", flag: "🇬🇧" },
    nl: { name: "Nederlands", locale: "nl-BE", flag: "🇳🇱" },
    fr: { name: "Français",   locale: "fr-FR", flag: "🇫🇷" },
    es: { name: "Español",    locale: "es-ES", flag: "🇪🇸" },
    de: { name: "Deutsch",    locale: "de-DE", flag: "🇩🇪" },
    pt: { name: "Português",  locale: "pt-PT", flag: "🇵🇹" },
  };
  const STORE_KEY = "inv-lang";
  const dicts = {};
  const listeners = [];

  function stored() { try { return localStorage.getItem(STORE_KEY); } catch { return null; } }
  function detect() {
    const s = stored();
    if (s && LANGS[s]) return s;
    const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"]);
    for (const p of prefs) { const c = String(p).slice(0, 2).toLowerCase(); if (LANGS[c]) return c; }
    return "en";
  }
  let lang = detect();
  document.documentElement.lang = lang;

  function add(code, dict) { dicts[code] = Object.assign(dicts[code] || {}, dict); }
  function raw(key) {
    if (dicts[lang] && dicts[lang][key] !== undefined) return dicts[lang][key];
    if (dicts.en && dicts.en[key] !== undefined) return dicts.en[key];
    return undefined;
  }
  function has(key) { return raw(key) !== undefined; }

  // t("buy.done", { qty: 5 }) → "Bought 5 shares"
  function t(key, params) {
    let s = raw(key);
    if (s === undefined) return key;
    if (typeof s === "function") return s(params || {});
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined && params[k] !== null ? params[k] : m));
    return s;
  }

  function setLang(code) {
    if (!LANGS[code] || code === lang) return;
    lang = code;
    try { localStorage.setItem(STORE_KEY, code); } catch { /* ignore */ }
    document.documentElement.lang = code;
    listeners.forEach(f => { try { f(code); } catch (e) { console.error(e); } });
  }
  const locale = () => LANGS[lang].locale;

  // ── Number formatting in the current language ──────────────────────────────
  function num(v, digits = 0) {
    if (!isFinite(v)) return "∞";
    return Number(v).toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function money(v) { return isFinite(v) ? `${v < 0 ? "−" : ""}€${num(Math.abs(v), 2)}` : "∞"; }
  function moneyShort(v) {
    if (!isFinite(v)) return "∞";
    const sign = v < 0 ? "−" : ""; const a = Math.abs(v);
    if (a >= 1e9) return `${sign}€${num(a / 1e9, 2)}B`;
    if (a >= 1e6) return `${sign}€${num(a / 1e6, 2)}M`;
    if (a >= 1e3) { const k = a / 1e3; return `${sign}€${num(k, a >= 1e4 || Number.isInteger(k) ? 0 : 1)}K`; }
    return `${sign}€${num(a, 0)}`;
  }

  // ── Structured messages ─────────────────────────────────────────────────────
  // News is stored as parts: [["news.buy", { qty: 5, company: "TechNova", price: 120 }], …]
  // so it can be shown in whatever language the reader picks, even later.
  const MONEY_SHORT = new Set(["amount", "cost", "value", "target", "gain", "pnl", "fee", "cash", "margin", "pay", "loan", "debt", "income"]);
  function fmtParams(p) {
    if (!p) return p;
    const out = {};
    for (const k in p) {
      const v = p[k];
      if (k === "price") out[k] = money(v);
      else if (MONEY_SHORT.has(k) && typeof v === "number") out[k] = moneyShort(v);
      else if (k === "signed" && typeof v === "number") out[k] = (v >= 0 ? "+" : "") + moneyShort(v);
      else if (k === "market") out[k] = t(`market.${v}`);
      else if (k === "event") out[k] = t(`event.${v}`);
      else if (k === "sector") out[k] = t(`sector.${v}`);
      else if (k === "type") out[k] = t(`war.${v}`);
      else if (k === "pct" && typeof v === "number") out[k] = num(v, 0);
      else if (typeof v === "number") out[k] = num(v, 0);
      else out[k] = v;
    }
    return out;
  }
  function msg(parts) {
    if (!parts) return "";
    if (typeof parts === "string") return parts;
    if (!Array.isArray(parts[0])) parts = [parts];
    return parts.map(([k, p]) => t(k, fmtParams(p))).join(" ");
  }
  // Old saves stored plain text; new ones store parts.
  const newsText = n => (n.parts ? msg(n.parts) : n.text || "");

  window.I18N = {
    add, t, has, setLang, msg, newsText, num, money, moneyShort,
    get lang() { return lang; }, locale, languages: LANGS,
    onChange: f => listeners.push(f),
  };
})();
