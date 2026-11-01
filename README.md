# Obelisk Calc

The Idle Obelisk Miner community calculators from the wiki's
[External Resources](https://shminer.miraheze.org/wiki/External_Resources) page, in one
mobile-friendly web app. Each calculator credits and links its original author.

- Inputs save on your device (localStorage).
- Paste your in-game `EXPORTSTATS` once on the **Stats** page; calculators with a
  "Fill from EXPORTSTATS" button read it from there.
- Number fields accept game notation (`1.5sxdc`, `326oc`) or scientific (`3.2e45`).

Game icons in `public/icons/` are Idle Obelisk Miner art by Checkbox Team, taken from the
[Idle Obelisk Miner Wiki](https://shminer.miraheze.org/) and credited in the app footer.

## Develop

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # formula checks against the original sheets' values
npm run build   # outputs dist/
```

## Deploy (GitHub Pages)

Push to `main` on GitHub, then in the repo's **Settings → Pages** set **Source** to
**GitHub Actions**. `.github/workflows/deploy.yml` tests, builds and publishes `dist/`.
The build uses relative paths and hash routing, so any repo name works.

## Adding a calculator

Each calculator is a `CalculatorDef` in `src/calculators/` with:

- `sections`: the inputs
- `compute(values)`: returns the outputs, tables and notes

Register it in `src/calculators/index.ts`. Keep the formulas as exported pure functions,
and add a test in `calculators.test.ts` using values the original sheet computed.

## Status

**Ported:** Pickaxe Damage, Skill Points, Obelisk Fight, Contracts & Damage,
Best Floor to Farm (ores and veins), Transmuter vs BoP, Cherry Gem vs D20, Frogger Gem Rate, Drone Cards & Shards, Relic
Expectations, Late World 3 Checklist, and the five wiki calculators (Drone Grade, Drone
Points, Level Exp, Lootbug Speed, Prestige Points).

**Linked, not ported yet** (shown under "Not ported yet" in the app): Total Resources,
Ore & Bar, Ultimate Gem Calculator (divine odds done; gem engine in progress), Fishing Gem Spending, Star Gain
Checklist (Ob60), Archaeology Calculator, Damage Ledger. Tools that run on their own
server or as desktop programs (Relic Solver, Arch Optimizer, Event Simulator) stay as links.

### Where the ports differ from the originals

- **Relic Expectations:** the original Data tab skips some rows in its stage sums
  (`SUM(K3:K7)` leaves out row 8; rare totals leave out column M), which double-counts
  some relics and loses others. This port gives out every relic exactly once. The
  sheet's own divine odds came from an Apps Script that isn't in the export; divine
  reroll odds come from Ultimate Gem 2.2's DivineChest Calc and Rody's Relic DLC tabs
  instead, counting divine chests as guaranteed divines.
- **Skill Points:** the freebie count no longer subtracts your shards twice.
- **Contracts:** the last two World 4 upgrades used the wrong cost column in the
  sheet; they now use their own.
