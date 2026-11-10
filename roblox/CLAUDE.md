# Stonks Tycoon — rules for Claude

This folder is a Roblox game, synced to Roblox Studio with **Script Sync**. Claude controls Studio through the **built-in Roblox Studio MCP**.

## Always
1. **Read `GAME_DESIGN.md` before building anything.** It is the single source of truth. If a request conflicts with it, say so and ask before deviating. If the design changes, update `GAME_DESIGN.md` in the same step.
2. Work **one phase at a time** from `ROADMAP.md`. Don't start the next phase on your own.
3. After every change: **playtest through MCP**, read the Output, and report what you saw (errors, prints, what happened). Don't say it works without having tested.
4. Keep explanations short and simple. The developer is learning; explain what you built in plain words.

## Code rules (Luau)
- Use `--!strict` at the top of every script where possible, and typed function signatures.
- **The server is the authority.** The client only *requests* actions through remotes. The server validates every argument (type, range, ownership), checks cooldowns, and rate-limits (~10 requests/s per player). The client never decides money, prices, shares or rewards.
- **All tunable numbers live in `ReplicatedStorage/Shared/Config/*.luau`.** No magic numbers in services.
- Services in `ServerScriptService/Services/` and controllers in `StarterPlayerScripts/Controllers/` are ModuleScripts with `Init()` and `Start()`, started by `Main.server.luau` / `Main.client.luau`.
- All remotes are created in one place: `ReplicatedStorage/Shared/Remotes.luau`.
- Find world objects with **CollectionService tags** (e.g. `Pad`, `Collector`, `BuildingSpot`), not by long names.
- Save player data only through `DataService` (ProfileStore). Never call DataStoreService elsewhere.
- File names: `Name.server.luau` (Script), `Name.client.luau` (LocalScript), `Name.luau` (ModuleScript).
- No `wait()` / `spawn()`: use `task.wait()` / `task.spawn()` / `task.delay()`.
- Disconnect connections and clean up when a player leaves.

## UI rules
- Build ScreenGuis in `StarterGui` through MCP. Style per `GAME_DESIGN.md` §7: Fredoka One titles, chunky rounded buttons (UICorner 12–16, UIStroke 3 px dark), press animation, short numbers.
- **Phone first:** use Scale sizing + UIAspectRatioConstraint, buttons ≥ 48 px, nothing important in the bottom corners. Test in the phone emulator.

## Safety
- Never insert Toolbox/free models that contain scripts without showing the scripts to the developer first.
- No paid random items, no paid takeover advantages (see `GAME_DESIGN.md` §8).
- Debug commands (give cash, force event) only work in Studio (`RunService:IsStudio()`).

## Git
- Commit after each finished phase with a clear message. The `.rbxlx` place file is not committed.
