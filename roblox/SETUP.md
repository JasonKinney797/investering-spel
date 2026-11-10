# 🛠️ Setup — the complete toolkit (Windows)

Do this **once**, in order. It takes about 45 minutes. After step 7 the setup is done and you only follow `ROADMAP.md`.

Everything here is based on Roblox's official "Build with a coding harness" guide (create.roblox.com/docs/ai/coding-harness) and their external tools page.

---

## The stack (what each tool does)

| Tool | What for | Needed? |
|---|---|---|
| **Roblox Studio** | Building the world, testing, publishing | ✅ Required (you have it) |
| **Claude Code** (VS Code extension or Claude desktop app) | Claude writes scripts, builds UI and playtests through MCP | ✅ Required |
| **VS Code** | Editor where Claude Code runs and where you see the script files | ✅ Required |
| **Git** + GitHub | Saves every version of your code, so mistakes can be undone | ✅ Required |
| **Studio MCP** (built into Studio) | Lets Claude control Studio: read the game tree, build GUIs, playtest | ✅ Required |
| **Script Sync** (Studio beta feature) | Syncs scripts between Studio and files on your laptop | ✅ Required |
| Roblox skills for Claude | Extra Roblox/Luau knowledge for Claude | ⭐ Recommended |
| StyLua + Selene + luau-lsp (via Rokit) | Auto-formatting, error checking, autocompletion | 👍 Nice to have (phase 4+) |
| Blender + Roblox Blender plugin | Custom 3D buildings | 👍 Later (polish phase) |
| Rojo + Wally | Pro alternative to Script Sync + packages | ❌ Not needed now (Script Sync is simpler and official) |

---

## Step 1 — Install the basics
Open **PowerShell** (Start menu → type "PowerShell") and run:
```powershell
winget install --id Git.Git -e --source winget
winget install --id Microsoft.VisualStudioCode -e --source winget
```
Restart your laptop afterwards.

## Step 2 — Claude Code in VS Code
1. Open VS Code → Extensions (the 4-squares icon) → search **"Claude Code"** → Install (the one published by Anthropic).
2. Click the Claude icon in the left bar and **sign in** with your Claude account.

## Step 3 — Get the project on your laptop
In PowerShell:
```powershell
cd $HOME\Documents
git clone https://github.com/JasonKinney797/investering-spel.git
```
Then in VS Code: **File → Open Folder → `Documents\investering-spel\roblox`**.
This `roblox` folder is the Roblox project. The design documents are already in it.

## Step 4 — Create the place in Studio
1. Open Roblox Studio → **New** → **Baseplate**.
2. **File → Save to File As…** → save as `StonksTycoon.rbxlx` **inside** `Documents\investering-spel\roblox`. (It is in `.gitignore`, so the big place file isn't uploaded to GitHub; scripts are, through Script Sync.)
3. Also **File → Publish to Roblox** (private) so Studio's cloud saving works too.

## Step 5 — Turn on Script Sync
1. Studio → **File → Beta Features** → enable **Script Sync** → Save → **restart Studio**.
2. In the Explorer, right-click each of these services → **Script Sync → Sync to…** → choose the **`roblox` folder** (the top folder, not a subfolder):
   - `ServerScriptService`
   - `ReplicatedStorage`
   - `StarterPlayer → StarterPlayerScripts`
3. Test: in VS Code, ask Claude: *"Create ServerScriptService/Test.server.luau that prints 'sync works'."* → it should appear in Studio's Explorer. Delete it afterwards.

## Step 6 — Connect Claude to Studio (MCP)
1. Studio → open the **Assistant** window → click **⋯** → **Manage MCP Servers**.
2. Turn on **"Enable Studio as MCP server"**.
3. Under **Quick connect**, switch on **Claude Code** (or VS Code).
4. Restart Studio **and** VS Code.
5. In Claude Code, type `/mcp`. You should see the Roblox Studio server as connected.
6. Test: ask Claude *"Use the Roblox Studio MCP to list what is in Workspace."* Approve the tool when asked.
7. Full test: *"Edit the test script, playtest the game and tell me what the Output shows."* You should see Studio start a playtest by itself.

> Note: the old open-source `Roblox/studio-rust-mcp-server` on GitHub was archived in April 2026, because MCP is now **built into Studio**. Don't install it. Community MCP servers (e.g. robloxstudio-mcp) aren't needed and some are being archived.

## Step 7 — Give Claude the rules and Roblox skills
1. The file `roblox/CLAUDE.md` is already there. Claude Code reads it automatically every session (project rules, folder structure, how to test).
2. **Roblox skills (recommended, pick one):** community skill packs that teach Claude Roblox/Luau best practices. Look at the GitHub page first (stars, last update, what's inside), because they're third-party:
   - `TabooHarmony/roblox-brain`: 28 Roblox/Luau skills, loads only what's needed.
   - `gamedev-skills/awesome-gamedev-agent-skills` (skill `roblox-luau`): services, events, RemoteEvents.
   - `christopher-buss/skills`: Roblox/Luau/ECS skills, hooks and plugins.

   Install (in the `roblox` folder, in a terminal): `npx skills add <owner/repo>`. Install **one** pack to start; too many overlapping skills confuse more than they help.
3. Commit: `git add . && git commit -m "Setup done: Script Sync + MCP verified"`.

**✅ Setup done.** Open `ROADMAP.md` and start phase 1.

---

## Later: quality tools (from phase 4)
These catch bugs and keep code tidy. Ask Claude to set them up; it's done via **Rokit** (a tool manager):
```powershell
# Claude can run these for you:
# install Rokit from github.com/rojo-rbx/rokit (Windows installer), then in the roblox folder:
rokit init
rokit add JohnnyMorganz/StyLua
rokit add Kampfkarren/selene
rokit add JohnnyMorganz/luau-lsp
```
- **StyLua:** formats all code the same way.
- **Selene:** finds common mistakes (unused variables, wrong API use).
- **luau-lsp** (VS Code extension "Luau Language Server"): autocompletion and type errors while typing.

## Later: Blender (polish phase, for custom buildings)
1. Install **Blender** (blender.org, free).
2. Install the **Roblox Blender plugin** (create.roblox.com/docs/art/modeling/roblox-blender-plugin). It uploads models straight from Blender to Studio as packages.
3. Tips:
   - **Keep models low-poly.** Very heavy meshes get simplified or fail to upload. A building should be a few thousand triangles.
   - **Scale:** the plugin exports 1 Blender metre = 1 stud by default.
   - Group a building's parts in one **Collection** → upload as one package. With *Package Auto Update*, changes in Blender show up in Studio.
4. **Before Blender:** start with Studio parts and simple shapes. Claude can build them through MCP. Only replace the most visible things (company buildings, plaza) with Blender models when the gameplay works.

## Assets: what you may and may not use
- ✅ **Sounds:** CC0 sounds from github.com/izzyfrm/roblox-ai (`sfx/cc0-audio`) and Roblox's own free audio library. Upload your own sounds via Studio's Asset Manager (Roblox may require account verification for audio).
- ✅ **Fonts:** Roblox's built-in fonts (Fredoka One, Builder Sans).
- ⚠️ **The images in roblox-ai are references only.** Use them for inspiration, not in your game.
- ⚠️ **Free models from the Toolbox:** only use ones **without scripts**, and check them. Scripts in free models are a common source of viruses/backdoors in Roblox games. Claude can check a model for scripts through MCP.

## Videos worth watching
- **Roblox's official companion video** on the "Build with a coding harness" page (create.roblox.com/docs/ai/coding-harness): exactly this setup, building a game phase by phase with an AI agent.
- On YouTube, search for **"Roblox Studio MCP Claude Code"** (the newest setup videos), **"Roblox tycoon tutorial 2026"** and **"Roblox UI design simulator"**. Well-known Roblox tutorial channels include GnomeCode, AlvinBlox, TheDevKing and B Ricey. Always check the upload date, because older videos show outdated setups.
