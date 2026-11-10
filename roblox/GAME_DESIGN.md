# 📈 STONKS TYCOON — Game Design Document

> Working title. Alternatives: *Stock City Tycoon*, *Billionaire Plaza*, *Money Tower Tycoon*. Search Roblox before you pick: the name must not already belong to a big game. Keep the word **Tycoon** in it, because players search for it.
>
> This document is the **single source of truth**. Give it to Claude in every Studio session as context (just like Roblox's own `WAVE_SURVIVAL.md` example). Build exactly what is written here, phase by phase (see `ROADMAP.md`). If something changes, change it **here first**.

---

## 1. The pitch (one sentence)

**Build your own business empire on your plot, buy shares of 10 crazy companies at the giant Stock Exchange, take over companies from other players, and go public (IPO) to grow even bigger.**

- **Genre:** Tycoon + simulator with a social stock market.
- **Audience:** ages 9–14 first (easy to start), with real depth for teens (timing, takeovers, events).
- **Platform focus:** phone first (most Roblox players), then PC, tablet and console.
- **Players per server:** 8 (one plot each).
- **Session length:** 10–30 minutes. Each loop takes **30 seconds to 2 minutes**.

### Why this can work (from the research)
- Tycoons are Roblox's most reliably profitable genre, and they all share the same skeleton: produce → collect → upgrade.
- The recent mega hits combine **simple actions + instant rewards + a social twist** (stealing or taking things from each other) + **offline progress** + **server-wide events**.
- Stock games already on Roblox are dry and full of charts. **Nobody has a fun, colourful, kid-friendly stock tycoon.** That's our gap.

---

## 2. The core loop (read this first)

```
        ┌──────────────────────────────────────────────┐
        │                                              │
        ▼                                              │
   1. COLLECT 💰  ──►  2. BUILD 🏗️  ──►  3. INVEST 📈  ──►  4. CONTROL 👑
   cash from your      buy upgrade      buy shares at      own a company →
   collector pad       pads on your     the Exchange       its building appears
                       plot (more $/s)  (dividends)        on YOUR plot (big $/s)
```

**Every loop, the player sees their plot get bigger and the numbers go up.** That's the whole game. Everything else (events, CEOs, IPO, quests) feeds this loop.

### The three loops

| Loop | Length | What happens | Why players come back |
|---|---|---|---|
| **Core loop** | 30 s – 2 min | Collect → buy pad or shares → see your income rise | Instant reward, always a next purchase visible |
| **Session loop** | 10 – 30 min | Finish a plot stage, gain control of a company, survive a market event, finish quests | Clear goals, events every few minutes |
| **Long loop** | days – weeks | IPO (rebirth) → permanent multiplier → bigger plot stages → rarer CEOs → leaderboards | Progress you keep, collection, being #1 |

### The golden rule: **the player must never ask "what now?"**
This came straight from testing the web version: the tutorial worked, but afterwards players didn't know the loop.
- A **Goal Tracker** is always visible at the top of the screen: "▶ Next: Buy the Food Truck ($224)". It always shows exactly one next goal.
- A **glowing beam/arrow** points to where that goal is (a pad, the Exchange, a company card).
- The goal list never runs out (see §9).

---

## 3. The world

```
                 [ Plot 1 ]   [ Plot 2 ]   [ Plot 3 ]
          [ Plot 8 ]                               [ Plot 4 ]
                       ╔═══════════════════╗
                       ║  STOCK EXCHANGE   ║  ← giant ticker screens,
                       ║  (central plaza)  ║    stock board, event stage,
                       ╚═══════════════════╝    Headhunter machine, leaderboards
          [ Plot 7 ]                               [ Plot 5 ]
                       [ Plot 6 ]
```

- **Spawn:** in the plaza. Each player is automatically given a free plot (their name floats above it).
- **Plaza (Stock Exchange):** the central social hub. A big stock board wall shows all 10 companies live, with an event stage for announcements, the **Headhunter** machine (CEOs), leaderboards and the code-redeem desk.
- **Plots:** start as an empty lot with a Lemonade Stand. They grow in 3 stages: **Street → Mall → Skyscraper**. Owned companies appear as **their own branded buildings** on the plot.
- **Movement:** walking plus an optional sprint. A plot is about 20 seconds' walk from the plaza. Add a **teleport button** ("🏦 Exchange" / "🏠 My plot") in the HUD so phone players don't have to walk.

### Art direction
- **Bright, cartoony, low-poly "money city"** with saturated colours, clean shapes, a sunny skybox and soft shadows.
- Each company has its **own colour + logo + building shape**, so it's recognisable from far away (see §5).
- **Juice everywhere:** cash pops out of the collector, coins fly into the HUD counter, buildings "pop" in when bought, confetti when you gain control.
- **References** (inspiration only, don't copy): the `ui-styles/09-modern-cartoon-simulator`, `10-chunky-candy-buttons` and `previews/tycoon-user-interface` folders in github.com/izzyfrm/roblox-ai.

---

## 4. Systems in detail

### 4.1 Your plot: tycoon pads (the "build" step)
Classic tycoon pads: walk onto a glowing pad → if you have the money, it gets bought and something gets built.

- **Collector pad:** stand on it (or tap the floating "Collect" button) → all banked cash goes into your wallet. Bank cap: 10 minutes of income (so players come back).
- **Pads are in a path,** so the next pad only appears after the previous one is bought. That gives always one clear next step.
- **Pad cost formula:** `cost(n) = 25 × 1.55^n` (n = pad number, starting at 0). Income gain grows with it.
- **Stages:** pads 1–10 = **Street**, 11–20 = **Mall** (the plot expands upward), 21–30 = **Skyscraper**. Finishing a stage plays a big celebration and unlocks the next.

**First 10 pads (Street stage)**

| # | Pad | Cost | Effect |
|---|---|---|---|
| 0 | Lemonade Stand | free | +$1/s |
| 1 | Bigger Cups | $39 | +$1/s |
| 2 | Cash Register | $60 | +$2/s |
| 3 | Neon Sign | $93 | income ×1.2 |
| 4 | Ice Machine | $144 | +$4/s |
| 5 | Food Truck | $224 | +$7/s |
| 6 | Street Lights | $347 | income ×1.2 |
| 7 | Tiny Shop | $537 | +$15/s |
| 8 | Delivery Bike | $833 | +$25/s |
| 9 | Corner Store | $1.3K | +$40/s, **unlocks Mall stage** |

Mall and Skyscraper pads follow the same pattern (balance in Studio with the economy config file; every number lives in **one config module**, see §11).

### 4.2 The Stock Exchange (the "invest" step)
- **10 companies** (from the web game), in **3 price tiers** so the market stays useful at every stage:

| Tier | Companies | Start price | Feel |
|---|---|---|---|
| 1 — Starter | FreshMart 🛒, EuroBank 🏦, GreenVolt ⚡ | $20 – $80 | Safe, slow, steady |
| 2 — Growth | TechNova 💻, MedFuture 💊, BuildCo 🏗️, SkyLine Air ✈️ | $500 – $2K | Bigger swings |
| 3 — Moonshot | PixelForge 🎮, StreamWave 📺, SpaceY 🚀 | $10K – $50K | Wild, huge rewards |

- **Shares per company per server:** 200 (a shared pool, so shares are scarce and players compete).
- **Buying:** Buy 1 / 10 / Max on each company card. Each share bought pushes the price up a little (+0.25% per share), each share sold pushes it down.
- **Selling:** 2% fee, so quick flips don't make free money.
- **Price ticks:** every **30 seconds**: small random move + a slow upward drift + the event effect. Prices stay within −50% and +200% of the base price (no infinite pumping, no instant crash to zero).
- **Dividends:** every tick, each share pays `price × 0.4%`, shown as "+$12 dividends" floating text. Passive income for everyone who holds shares.
- **When you leave the server:** your shares are **automatically sold** at the current price and the cash is saved. Shares belong to one server; cash, plot and everything else is saved.

### 4.3 Control & takeovers (the social twist)
- **Control:** have **at least 50 shares AND the most shares** of a company → you control it.
- **Reward:** the company's **building appears on your plot** (animated build-up + confetti + announcement "👑 Max now controls SpaceY!") and produces `price × 0.1` per second into your collector. Plus a crown above your name.
- **Takeover:** when the pool is empty, you can do a **Buyout**: you buy shares from the biggest holder for **price × 1.25**.
  - The seller **gets that money**: "💰 Lisa bought 20 of your SpaceY shares, you earned $25K!". **Losing never feels like being robbed;** you always get paid.
  - If you lose control, the building **flies over to the new owner's plot** (a fun animation everyone sees).
- **Protection:** after gaining control, the company has **2 minutes of takeover protection** (shield icon). This is free for everyone and **never for sale** (no pay-to-win).
- **Companies nobody controls** are run by an NPC ("🤖 Market Bot") with a calm, grey building on the plaza.

### 4.4 Market events (server-wide, every 4–6 minutes)
A siren plus a big banner for everyone at the same time. Players react together, which creates shared moments and clips.

| Event | Duration | Effect | Player reaction |
|---|---|---|---|
| 🐂 **Bull Run** | 60 s | All prices +2% per tick | Buy now! |
| 💥 **Market Crash** | instant | All prices −15%, then slow recovery | Buy cheap (or panic sell) |
| 🚀 **Hype Train** | 60 s | One company +30% over 60 s | Everyone rushes to that card |
| 🌟 **Golden Hour** | 60 s | All collector income ×2 | Run to your collector |
| 🎁 **Money Rain** | 30 s | Coins rain on the plaza, collect by walking | Run around, social chaos |
| 🫧 **SpaceY Bubble** | when SpaceY > 2.5× base | 30% chance per tick of −45% | Sell in time? |

- A **next event timer** is always visible in the HUD ("Next event: 2:14"). That anticipation keeps players in the server.

### 4.5 CEOs (collection — the "pets" of this game)
- Cute original mascots that follow you around and **boost your empire**. Equip **3** (4 with a game pass).
- Get them at the **Headhunter** machine in the plaza: **Basic Search** (cash, price scales with your stage) or **Elite Search** (gems). **The odds are always shown** on screen.

| Rarity | Chance (Basic) | Example CEOs | Boost range |
|---|---|---|---|
| Common | 60% | Hustle Hamster, Coffee Cat | +5–10% |
| Rare | 27% | Piggy Banker, Bull Broker | +12–20% |
| Epic | 10% | Bear Analyst, Robo Trader | +25–40% |
| Legendary | 2.7% | Golden Goose, Diamond Duck | +60–100% |
| Mythic | 0.3% | Dragon Dealer | +150% |

- **Boost types:** collector income, dividend %, buy discount on shares, offline income, event bonus.
- **Fuse:** 3 identical CEOs become a ✨ Shiny version (×1.5 boost). That gives a use for duplicates.
- **Searches cost in-game currency only** (cash or gems, where gems are also earnable). This keeps it within Roblox's rules on random items and fairer for kids. **Trading** between players comes later (phase 9+, with strong confirm screens).

### 4.6 IPO (rebirth — the long loop)
- **Requirement:** Skyscraper stage completed + net worth ≥ the IPO target (×2.5 more each IPO).
- **What resets:** plot pads, wallet cash, shares.
- **What you keep:** CEOs, gems, cosmetics, IPO count.
- **Rewards:**
  - Permanent **income multiplier** `1 + 0.5 × IPOs` (IPO 1 = ×1.5, IPO 4 = ×3).
  - **IPO Tokens** for the **Golden Shares** upgrade tree: +5% dividends, start with $X, a bigger collector bank, faster ticks of your own buildings, +1 starting pad.
  - A new **plot theme** every few IPOs (neon city, island, space station) to show off.
  - A **🔔 IPO bell ceremony:** your name on the plaza screen.

### 4.7 Offline income
- Your plot keeps earning at **25%** for up to **8 hours** while you're offline (12 h with the VIP pass).
- On joining: a "Welcome back! While you were away you earned **$1.2M**" pop-up with a **Claim** button, and a **Claim ×2** option (once a day free, otherwise a small gem cost or a 15 Robux dev product). No ads.

### 4.8 Quests, daily rewards, codes
- **Daily reward streak:** 7-day calendar (cash → gems → Basic Search → ... → day 7 Epic CEO search). Missing a day doesn't reset to 0, just pauses (kinder for kids).
- **3 daily quests** + **1 weekly quest**, e.g. "Collect $50K", "Own 2 companies at once", "Buy during a Crash", "Survive a takeover". Rewards: gems + cash.
- **Codes:** a "Codes" button with a text box. Redeem codes from updates/social media (e.g. `LAUNCH` = 100 gems). A classic Roblox growth tool.

### 4.9 Leaderboards
- **Server:** the net worth ranking in the HUD (top 3 shown) and on a board in the plaza.
- **Global:** a plaza wall with all-time richest, most IPOs and most takeovers, updated every few minutes.

---

## 5. The 10 companies

| Company | Tier | Colour | Building on your plot | Personality |
|---|---|---|---|---|
| FreshMart 🛒 | 1 | Green #22C55E | Supermarket with a giant apple | Safe, slow |
| EuroBank 🏦 | 1 | Navy #1E3A8A | Classic bank with columns and a vault | Super stable |
| GreenVolt ⚡ | 1 | Lime #84CC16 | Wind turbine + solar roof | Steady grower |
| TechNova 💻 | 2 | Violet #7C3AED | Glass tower with a holo logo | Hype spikes |
| MedFuture 💊 | 2 | Teal #14B8A6 | White lab with a spinning DNA helix | Breakthroughs |
| BuildCo 🏗️ | 2 | Orange #F97316 | Crane + half-built tower that grows | Booms in good times |
| SkyLine Air ✈️ | 2 | Sky #0EA5E9 | Mini airport with a looping plane | Crashes in bad times |
| PixelForge 🎮 | 3 | Pink #EC4899 | Arcade with a giant controller | Wild |
| StreamWave 📺 | 3 | Red #EF4444 | Studio with a huge play button screen | Viral swings |
| SpaceY 🚀 | 3 | Black/gold | Launch pad + rocket that launches on events | Bubbles! |

All names and logos are original (fictional companies, no real brands).

---

## 6. First 5 minutes (FTUE: onboarding through playing, not reading)
Each step uses the Goal Tracker + beam + one short line of text. No walls of text.

| Time | Goal Tracker says | What happens |
|---|---|---|
| 0:00 | "Collect your cash! 💰" | Beam to the collector. Lemonade Stand already earning. |
| 0:15 | "Buy Bigger Cups ($39)" | First pad purchase, a pop + sound |
| 0:45 | "Buy 2 more upgrades" | Pads 2–3, income visibly rises |
| 1:30 | "Go to the Stock Exchange! 🏦" | Beam to plaza (or tap teleport) |
| 1:50 | "Buy 10 FreshMart shares" | Card highlighted, Buy 10 pulses |
| 2:20 | "Wait for dividends… 💵" | Next tick: "+$X dividends!" big pop-up |
| 2:50 | "Own FreshMart: reach 50 shares!" | Progress bar 10/50 on the card |
| 4:00 | "👑 You control FreshMart!" | Building appears on plot, confetti |
| 4:30 | "Go collect from your new building" | Beam home, big collect |
| 5:00 | "Next: Buy the Food Truck" | Normal goal chain continues forever |

**Rule:** first purchase within 30 seconds, first company control within ~5 minutes, first IPO within ~60–90 minutes.

---

## 7. UI / HUD

### Layout (phone-first, landscape)
```
┌───────────────────────────────────────────────────────────┐
│ 💰 $12.4K  💎 85        ▶ Next: Buy Food Truck ($224)   ⚙️ │
│                         [════════░░░░] 64%                  │
│ 🛒 Shop                                     📈 Market: 🐂   │
│ 👔 CEOs                                     Next event 2:14 │
│ 🔔 IPO                                      🏆 1. Max $2M   │
│ 📋 Quests (2)                                  2. You $1.2M │
│ 🎁 Codes                                                    │
│                                                             │
│ [🏦 Exchange] [🏠 My plot]                     ( Collect ) │
└───────────────────────────────────────────────────────────┘
```
- **Top-left:** currencies (big, coin icon animates when it changes).
- **Top-centre:** the Goal Tracker (always visible, with progress bar).
- **Left column:** menu buttons with icons + red badges for news (quest done, free search).
- **Right:** market status, next event timer, top-3 server leaderboard.
- **Bottom:** teleport buttons + contextual action (Collect, Buy).

### Style rules
- **Fonts:** **Fredoka One** for titles and numbers, **Builder Sans** (Roblox) for small text. Both are built into Roblox.
- **Buttons:** chunky, rounded (UICorner 12–16), **3 px dark outline** (UIStroke), slight gradient, shadow underneath. Press: scale to 0.92 and back with a "pop" sound. Hover (PC): scale 1.05.
- **Colours:** green = buy/OK, red = sell/close, gold = money, purple = premium/gems, blue = info. Background panels: white or cream with dark outline, readable on any skybox.
- **Numbers:** always short: 1.2K, 3.4M, 5.6B, 7.8T, 9.1Qa. Animate counting up.
- **Mobile:** minimum button size 48×48 px, nothing important in the bottom corners (thumb + jump button), test on the smallest phone emulator in Studio.
- **Stock board card:** company colour + logo + name, big price, green ▲ / red ▼ with %, a mini sparkline, "You: 12 | 👑 Max: 60", and Buy 1 / 10 / Max + Sell buttons.

### Sound (CC0, from github.com/izzyfrm/roblox-ai `sfx/cc0-audio`, plus Roblox's free audio library)
| Moment | Sound |
|---|---|
| Collect cash | coin-pickup |
| Buy pad / shares | button-press + unlock |
| Gain control | level-up + reward |
| Lose control | notification (soft, not sad) |
| Event siren | power-up / notification |
| CEO reveal | chest-open, then reward (legendary: extra sparkle) |
| Error (not enough cash) | error-buzz (quiet) |
| Background | upbeat lo-fi / funk loop from Roblox's licensed music library |

---

## 8. Monetization (fair and kid-friendly)
**Rules:** nothing that lets you take over others more easily, no paid protection, no paid random items. Everything sold is **convenience, speed or cosmetics**.

| Type | Item | Price (Robux) | Effect |
|---|---|---|---|
| Game pass | 💰 2× Cash | 299 | All collector income ×2 |
| Game pass | 🤖 Auto Collect | 149 | Cash goes straight to your wallet |
| Game pass | 👑 VIP | 399 | VIP plaza lounge, name tag, 12 h offline cap, +10% dividends |
| Game pass | 👔 +1 CEO Slot | 199 | Equip 4 CEOs |
| Game pass | ⚡ Fast Walk | 99 | Faster movement |
| Dev product | Gem packs | 49 – 999 | Gems (for Elite searches, cosmetics) |
| Dev product | Cash boost | 25 – 499 | Cash = X minutes of your current income (always useful) |
| Dev product | 2× Offline claim | 15 | Double the welcome-back money |
| Cosmetic | Building skins, trails, name colours | 50 – 300 | Show-off only |

- **Premium Payouts:** Roblox pays you for Premium players' time in your game, which is another reason retention matters more than quick sales.
- **Shop UI:** a clean grid (see the shop references in the roblox-ai repo), the best value marked "⭐ Best value", never fake timers.

---

## 9. The never-ending goal chain (the "what now?" fix)
The Goal Tracker picks the **first unfinished** goal from this priority list:
1. FTUE step (first 5 minutes only).
2. A daily/weekly quest that is almost finished (≥ 80%).
3. The next plot pad you can afford **within 60 seconds** of income.
4. Control of the **cheapest company you don't control yet**.
5. Next plot stage (Mall / Skyscraper).
6. IPO progress ("IPO: 45% — reach $5M net worth").
7. A free/affordable CEO search.

So there is **always** one concrete next step, with a beam pointing to it.

---

## 10. Retention & live ops

| Day | Hook |
|---|---|
| Day 1 | FTUE, first control, first CEO, daily reward day 1 |
| Day 2 | Offline income pop-up, daily reward day 2, new quests |
| Day 3–7 | Streak towards the day-7 Epic search, first IPO |
| Weekly | Update with a new event, CEO or plot theme. New code in the update log. |
| Monthly | Seasonal event (e.g. 🎃 Spooky Market, 🎄 Winter Stocks) with limited CEOs |

**Analytics** (Roblox AnalyticsService, set up from the start):
- **Onboarding funnel:** each FTUE step logged (where do players drop?).
- **Economy events:** every cash/gem source and sink.
- **Custom events:** first control, first takeover, IPO, event participation.
- **Targets to aim for:** D1 retention ≥ 25%, D7 ≥ 8%, average session ≥ 12 minutes, FTUE completion ≥ 70%. Check the Roblox Creator Hub analytics every week.

---

## 11. Technical design (for Claude in Studio)

### Principles
- **The server decides everything.** The client only sends requests ("I want to buy 10 SpaceY") through RemoteFunctions/RemoteEvents. The server checks cash, limits, cooldowns and rate limits. **Never trust the client.**
- **All numbers in one place:** `ReplicatedStorage/Shared/Config/Economy.luau`, so balancing never means hunting through scripts.
- **Data:** ProfileStore (community module by loleris) for session-locked saving. Save: cash, gems, pads bought, stage, IPO count, IPO tokens, CEOs, cosmetics, quests, daily streak, last-online time, settings.
- **Shares are per server** and are not saved (auto-sold on leave → cash saved).

### Folder structure (Script Sync)
```
ServerScriptService/
  Main.server.luau              -- starts all services in order
  Services/
    DataService.luau            -- ProfileStore load/save, session lock
    PlotService.luau            -- assign plots, pads, stages, buildings
    CollectorService.luau       -- income per second, bank, collect
    MarketService.luau          -- prices, ticks, buy/sell, dividends, pool
    ControlService.luau         -- who controls what, takeovers, protection
    EventService.luau           -- market events schedule + effects
    CEOService.luau             -- searches, odds, equip, fuse, boosts
    IPOService.luau             -- rebirth, tokens, upgrade tree
    QuestService.luau           -- daily/weekly quests, daily rewards, codes
    GoalService.luau            -- computes each player's next goal (§9)
    LeaderboardService.luau     -- server + global (OrderedDataStore)
    MonetizationService.luau    -- game passes, dev products (ProcessReceipt)
    AnalyticsService.luau       -- funnel + economy events wrapper
ReplicatedStorage/
  Shared/
    Config/Economy.luau         -- ALL numbers (pads, prices, odds, timings)
    Config/Companies.luau       -- 10 companies (name, tier, colour, base price, volatility)
    Config/CEOs.luau            -- CEO list, rarity, boosts
    Remotes.luau                -- creates/returns all RemoteEvents/Functions
    Format.luau                 -- 1.2K / 3.4M number formatting
    Signal.luau                 -- small event helper
  Packages/                     -- ProfileStore etc.
StarterPlayerScripts/
  Main.client.luau              -- starts all controllers
  Controllers/
    HUDController.luau          -- currencies, goal tracker, buttons, badges
    BoardController.luau        -- stock board cards
    PlotController.luau         -- pad prompts, collect effects
    EffectsController.luau      -- coins flying, confetti, number pops, sounds
    EventController.luau        -- banners, sirens, timers
    CEOController.luau          -- search reveal animation, inventory UI
    ShopController.luau         -- game passes + products UI
    BeamController.luau         -- goal beam/arrow
StarterGui/                     -- built in Studio via MCP (ScreenGuis), styled per §7
Workspace/
  Plaza/  Plots/Plot1..8/  -- built in Studio (models), pads as tagged parts
```
- Use **CollectionService tags** for pads, collectors and building spots, so scripts find parts by tag instead of by name.
- **Rate limits:** max ~10 buy requests/second per player, ignore the rest.
- **Performance:** ticks every 30 s; income is calculated per second on the server and pushed to clients at most twice a second; effects run on the client only.

---

## 12. What's NOT in version 1
Trading CEOs between players, clans/teams, a custom private-server market, more than 10 companies, mini-games, real-time chat features beyond Roblox chat. These come after launch, based on what players do (analytics + feedback).
