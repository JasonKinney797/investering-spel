# 🗺️ Roadmap — build it phase by phase

**How to use this:** do the phases in order. For each phase:
1. Copy the **prompt** into Claude Code (with Studio open and MCP connected).
2. Let Claude build it, then **playtest yourself** with the checklist.
3. Only when every box is ticked: `git add . && git commit -m "Phase X done"`.
4. Something wrong? Tell Claude exactly what you saw ("I clicked Buy 10 and nothing happened, Output says ...").

Every prompt starts with **"Read GAME_DESIGN.md and CLAUDE.md first."** Claude must always follow the design document.

> Estimated time: phases 1–6 (a playable game) take about 2–4 weeks of evenings. Phases 7–12 (launch-ready) take another 3–5 weeks.

---

## Phase 0 — Setup ✅
Follow `SETUP.md` to the end. Done when Script Sync and MCP are verified and committed.

---

## Phase 1 — The plot and the first loop
**Goal:** one player can collect cash and buy pads on their plot. The core of every tycoon.

**Prompt:**
> Read GAME_DESIGN.md and CLAUDE.md first. Build phase 1: create `ReplicatedStorage/Shared/Config/Economy.luau` with the Street stage pads from §4.1 (cost formula 25 × 1.55^n), a `Format.luau` number formatter, `Remotes.luau`, and on the server `PlotService` + `CollectorService`. Build one plot in Workspace (via MCP) with tagged pads in a path and a collector pad. Walking onto a pad buys it if you have enough cash (server checks). Income per second goes into the collector bank (cap 10 minutes); touching the collector moves it to your cash. Add a simple HUD showing cash. Playtest via MCP and show me the Output.

**Checklist:**
- [ ] You start with the Lemonade Stand, earning $1/s
- [ ] Collecting moves the bank to your cash, with a sound and a "+$X" pop
- [ ] Only the next pad is visible; buying it builds something visible
- [ ] You can't buy without enough cash (no errors in Output)
- [ ] The cash counter updates smoothly

## Phase 2 — Saving + 8 plots + offline income
**Prompt:**
> Read GAME_DESIGN.md and CLAUDE.md first. Build phase 2: add ProfileStore and DataService (save everything from §11). Make 8 plots around a central plaza area (placeholder parts for now) and assign a free plot to each joining player with their name above it. Add offline income (§4.7) with the Welcome Back pop-up. Test with 2 players in Studio (Test → Clients and Servers) and by leaving and rejoining.

**Checklist:**
- [ ] Leave and rejoin: pads and cash are still there
- [ ] Two test players each get their own plot
- [ ] Rejoin after a few minutes: "Welcome back" with the right amount
- [ ] No DataStore errors in Output (enable *Studio Access to API Services* in Game Settings → Security)

## Phase 3 — The Stock Exchange
**Prompt:**
> Read GAME_DESIGN.md and CLAUDE.md first. Build phase 3: `Config/Companies.luau` with the 10 companies from §5, `MarketService` with the 200-share pool, price ticks every 30 s, price impact, sell fee and dividends (§4.2). Build the plaza with a big stock board, and a Stock Board UI with one card per company (style from §7: chunky, company colour, ▲/▼, Buy 1/10/Max, Sell). Shares auto-sell when a player leaves. Playtest and show me prices moving.

**Checklist:**
- [ ] Prices change every 30 s; the cards show green ▲ / red ▼
- [ ] Buy 1/10/Max works and the price rises when you buy
- [ ] Dividends arrive every tick ("+$X dividends")
- [ ] Selling gives cash minus 2%; buying then selling at once loses a bit
- [ ] Leaving the game converts shares to saved cash

## Phase 4 — Control & takeovers ⭐ (the social heart)
**Prompt:**
> Read GAME_DESIGN.md and CLAUDE.md first. Build phase 4: `ControlService` (§4.3): control = ≥50 shares and the most shares; the company building appears on the controller's plot (placeholder building in the company colour + a sign); building income `price × 0.1`/s; Buyout at price × 1.25 with the seller getting paid and notified; 2-minute protection shield; building flies to the new owner's plot; server announcements. Test with 2 players taking a company from each other.

**Checklist:**
- [ ] 50 shares → the building appears on your plot + confetti + announcement
- [ ] The other player does a Buyout → the building moves, the loser gets paid and sees how much
- [ ] Protection: a Buyout within 2 minutes is refused with a clear message
- [ ] The building's income shows up in the collector
- [ ] (Optional now) set up StyLua + Selene (see SETUP.md)

## Phase 5 — Market events + juice
**Prompt:**
> Read GAME_DESIGN.md and CLAUDE.md first. Build phase 5: `EventService` with all events from §4.4 (every 4–6 min), an event banner + siren for everyone, a "Next event" timer in the HUD. Add the juice from §3: coins flying into the counter, number pops, confetti, button press animations, all sounds from §7. Playtest an event of each type (add a debug command to force events in Studio only).

**Checklist:**
- [ ] Every event works and is clearly announced to everyone
- [ ] The timer counts down correctly
- [ ] It *feels* good: buying, collecting and control all have sound + an effect
- [ ] Money Rain coins can be collected by walking

## Phase 6 — HUD, Goal Tracker & FTUE ⭐ (the "what now?" fix)
**Prompt:**
> Read GAME_DESIGN.md and CLAUDE.md first. Build phase 6: the full HUD layout from §7 (phone-first), the Goal Tracker with progress bar + beam to the target (`GoalService` with the priority list from §9), and the first-5-minutes FTUE from §6. Add teleport buttons. Test on the smallest phone emulator in Studio and on PC.

**Checklist:**
- [ ] A brand-new player is guided without any reading: collect → pads → Exchange → shares → control
- [ ] The Goal Tracker **never** shows nothing; there is always a next step with a beam
- [ ] Everything is readable and tappable on a small phone
- [ ] **Test with someone who has never played** (e.g. your parents!). Watch without helping. Where do they get stuck? Fix that first.

> 🎉 **After phase 6 you have a playable game.** Publish privately and let 3–5 people (friends, family) play. Write down what they say.

## Phase 7 — IPO + Mall & Skyscraper stages + leaderboards
**Prompt:**
> Read GAME_DESIGN.md and CLAUDE.md first. Build phase 7: Mall and Skyscraper pad stages (§4.1), `IPOService` (§4.6) with the multiplier, IPO tokens, the Golden Shares upgrade tree and the bell ceremony, and `LeaderboardService` (server HUD top 3 + global boards on the plaza). Add a debug command to give cash in Studio only, so we can test IPO quickly.

**Checklist:**
- [ ] The plot grows visibly from Street → Mall → Skyscraper
- [ ] IPO resets the right things and keeps the right things (§4.6)
- [ ] The multiplier is visible and works
- [ ] Leaderboards update

## Phase 8 — CEOs
**Prompt:**
> Read GAME_DESIGN.md and CLAUDE.md first. Build phase 8: `Config/CEOs.luau` + `CEOService` (§4.5): Headhunter machine on the plaza, Basic/Elite search with the odds always shown, an exciting reveal animation (rarity colours), inventory UI, equip 3, fuse 3 → shiny, boosts applied. CEOs follow the player (simple placeholder models for now).

**Checklist:**
- [ ] The odds are visible before every search
- [ ] Boosts really change income/dividends (check the numbers)
- [ ] The reveal is exciting; legendary is extra special
- [ ] Fusing works and CEOs are saved

## Phase 9 — Quests, daily rewards, codes
**Prompt:**
> Read GAME_DESIGN.md and CLAUDE.md first. Build phase 9: `QuestService` (§4.8): 3 daily quests + 1 weekly, the 7-day reward calendar (a missed day pauses the streak), and a Codes menu with server-side codes (start with LAUNCH = 100 gems). Quests appear in the Goal Tracker when almost done.

**Checklist:**
- [ ] Quests refresh daily and pay out once
- [ ] The daily calendar works across days (test by changing the saved date in Studio)
- [ ] A code works once per player, wrong codes give a friendly message

## Phase 10 — Shop & monetization
**Prompt:**
> Read GAME_DESIGN.md and CLAUDE.md first. Build phase 10: `MonetizationService` + Shop UI (§8): game passes and dev products with a correct ProcessReceipt (idempotent, saved). Create the passes/products in the Creator Hub first and put the IDs in the config. Nothing that gives a takeover advantage.

**Checklist:**
- [ ] Every pass/product works in Studio test purchases
- [ ] A purchase is never applied twice and never lost (rejoin test)
- [ ] The shop looks clean, with "Best value" marked

## Phase 11 — Art, polish, performance, security
**Prompt:**
> Read GAME_DESIGN.md and CLAUDE.md first. Phase 11: review all scripts for security (every remote validated and rate-limited, the client never decides money), performance (MicroProfiler, part count, nothing heavy every frame), and mobile UX. Then we replace placeholders: company buildings, plaza, CEO models. Make a list of the 10 most visible models to improve first.

**Checklist:**
- [ ] No warnings/errors in Output during a 15-minute session
- [ ] Runs smoothly on the phone emulator; check on a real phone too
- [ ] Exploit test: ask Claude to try firing every remote with wrong values; nothing breaks
- [ ] Buildings look good (Blender/Studio), with a consistent low-poly style

## Phase 12 — Launch 🚀
- [ ] **Icon (512×512)** + **thumbnails (1920×1080)**: same click rules as the itch.io cover (one focal point, a face/emotion, readable when small). Show a takeover moment!
- [ ] Game description + update log, with the LAUNCH code
- [ ] Set **age rating questionnaire** and Experience Guidelines in the Creator Hub
- [ ] Analytics checked: the FTUE funnel works
- [ ] Soft launch: friends + family + a small Discord, then fix the top 3 problems
- [ ] Optional: a small **Roblox Ads / Sponsored** budget to get the first players in
- [ ] TikTok/YouTube Shorts: clips of takeovers, crashes, legendary CEO reveals
- [ ] **Weekly updates** after launch (§10). The first 4 weeks matter most.
