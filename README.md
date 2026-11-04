# Investeer Simulator

https://jasonkinney797.github.io/investering-spel/

A browser game about stocks and running companies. Buy shares, take control of companies (50 shares), become CEO (100 shares), beat your rivals and reach **€1 billion**.

Plain **HTML, CSS and JavaScript**: no build step and no dependencies. Open `index.html` in a browser, or host it on GitHub Pages.

## Features

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
- **Sound and confetti**: WebAudio sound effects (can be turned off) and animations.

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
