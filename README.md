# Investor Simulator

## ▶ Play

- 🎮 **Solo:** https://jasonkinney797.github.io/investering-spel/
- 🌐 **Online (2–8 players):** https://jasonkinney797.github.io/investering-spel/online.html

A browser game about stocks and running companies. Buy shares, take control of companies (50 shares), become CEO (100 shares), beat your rivals and reach **€1 billion**.

Plain **HTML, CSS and JavaScript**: no build step and no dependencies. Open `index.html` in a browser, or host it on GitHub Pages.

🌍 **Languages:** English (default), Nederlands, Français, Español, Deutsch, Português. The game picks your browser's language automatically; change it in the menu or settings.

## Features

- **Start menu**: Play, Tutorial, or Online, plus a language picker and a sound toggle.
- **Tutorial**: an 11-step guided tour in a calm practice market (buy, become owner, dividend, next day, company actions, alerts, rivals).
- **10 companies in 10 sectors**: TechNova, GreenVolt, EuroBank, MedFuture, SpaceY, PixelForge (gaming), FreshMart (retail), SkyLine Air (transport), BuildCo (construction), StreamWave (media). Filter the market by sector or "Mine".
- **Price alerts**: tap 🔔 on a stock to get notified when it goes above or below a price.
- **Saving**: autosaves in the browser, plus export and import of a save file.
- **Rivals (AI investors)**: three rivals trade every day. From day 20, Victor Vale can buy up shares of your companies in a hostile takeover. Buy more shares to fight back.
- **Short selling**: earn money when a price falls. Requires 50% collateral, costs 0.1% per day, and closes automatically on a margin call.
- **Auto-play**: 1×, 2× or 5× speed, plus a pause button.
- **News choices**: events where you decide (scandal, strike, patent, subsidy, influencer).
- **Multiple markets**: a company can be active in Europe, America and Asia at the same time. Each market adds income.
- **Sector synergies**: bonuses for owning certain combinations of companies.
- **IPO**: from €10M in total value you can take your own company public.
- **Large charts**: click a stock for its price history, with your buys, sells and average buy price marked.
- **Difficulty levels**: Easy, Normal, Hardcore (going bankrupt deletes your save).
- **Daily goals**: a new goal every day for extra XP.
- **Sound and confetti**: real sound effects (Kenney, CC0, in `assets/sounds/`), can be turned off. Confetti for achievements.

## Controls

- **Mobile and tablet**: works in portrait and landscape. The "next day" button and the speed control are fixed at the bottom of the screen, and the tabs scroll sideways.
- **PC keyboard shortcuts**: Space/Enter = next day, 0–3 = speed, Alt+1–7 = tabs, Esc = close a window.

## Balance changes compared to the React version

- Rank perks lower **transaction fees** instead of giving a discount below the market price, so buying and then selling straight away can no longer make money.
- XP for buying and selling has a daily limit. XP for gaining a company or becoming CEO is given once per company.
- The number of loans is based on actual debt, so the maximum of 5 can no longer be bypassed.
- A risk project only gives XP if it was actually carried out.
- A depression has a beginning and an end. The XP is given when you survive it.
- A takeover gives control through the buying company, not free shares.
- Competition wars are aimed at competitors, at most once per day per company.

## Online mode (2–8 players)

`online.html` is the multiplayer version: everyone trades on the same market. The server (`server/`) holds the game state and checks every action, so players can't cheat from the browser console.

**How it plays**
- Whoever holds the most shares of a company (at least 50) controls it. Buy more than another player to take their company away.
- Dividends are shared among all shareholders, in proportion to how many shares each holds. The owner sets the percentage.
- Big orders move the price for everyone. Fees plus price impact mean buying and selling straight away always loses money.
- Days run on a timer (calm 20 s, normal 10 s, turbo 4 s). If everyone presses ⏩ Skip, the next day starts at once. 🔁 Auto keeps skip switched on.
- Nobody can stall the game: players inactive for 3 days count as skipping (as long as someone else wants to skip), and each player has 2 pauses of 30 seconds.
- A news choice that isn't answered before the next day gets the safe option automatically.
- **Deals 🤝**: offer another player shares and/or cash in exchange for their shares and/or cash. They have 3 days to accept; both sides are checked again at the moment of accepting.
- **Notifications**: red badges on Chat and Deals plus a sound. You can turn them off, and optionally get phone/computer notifications while the tab is in the background.
- **Price alerts** work online too (stored in your own browser).
- **End screen chart**: everyone's net worth over the whole game.
- Every player sees the game, news and errors in their own language.
- If your connection drops, you stay in the game. Reload the page or open the room link to continue.
- The first player to reach the target wins, or the richest player after the last day.

**Run locally**
```
npm install
npm start          # → http://localhost:8080/online.html
npm test           # automated server tests
```
Open the page in two browser tabs (or on your phone, using your PC's IP address) to play against yourself.

**Put it online (free, Render.com)**
1. Sign in at render.com with GitHub → **New** → **Blueprint** → choose this repo. `render.yaml` sets everything up.
2. After the deploy you get an address like `https://investering-spel.onrender.com`. The whole game (solo and online) works there directly.
3. The online page on GitHub Pages connects to this Render server automatically (`SERVER_URL` in `online.js`).

The free Render plan sleeps after 15 minutes without players. The first visit after that takes up to a minute to wake it.

## Translations

All text lives in `lang/*.js` (one file per language, same keys as `lang/en.js`). To add a language: copy `lang/en.js`, translate the values (keep `{placeholders}` as they are), add it to `LANGS` in `i18n.js`, and add a `<script>` line in `index.html` and `online.html`.

## Credits

Sound effects: [Kenney](https://kenney.nl) (CC0) — see `assets/sounds/LICENSE.txt`.
