# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Dò số Vietlott" — a client-only React 18 + Vite 5 + TypeScript SPA that checks a user's Vietlott ticket numbers against the **entire draw history**, ranks draws by best prize won, and shows frequency stats plus "for fun" predictions. No backend, no env vars, no runtime dependencies beyond React. UI text and code comments are in Vietnamese — keep that convention. Git origin: `hoangduytn1703/do-ve-so` (branch `main`). Personal project, not affiliated with Vietlott.

## Commands

```bash
npm install
npm run dev      # Vite dev server, http://localhost:5173
npm run build    # tsc -b (type-check only, noEmit) && vite build -> dist/
npm run preview  # serve the built dist/
```

There is **no lint and no test setup** (no ESLint, no test runner, no test files). `npm run build` is the only correctness gate: `tsconfig.json` is `strict` with `noUnusedLocals` / `noUnusedParameters`, so unused variables fail the build.

**Deploy:** `.github/workflows/deploy.yml` runs on push to `main` (or manual `workflow_dispatch`): Node 20, `npm ci`, `npm run build`, uploads `dist/` to GitHub Pages. It's the only workflow. `vite.config.ts` sets `base: './'` so the app works under `https://<user>.github.io/<repo>/`. Keep asset paths relative.

## Architecture

Two parallel game "families", each with its own data module and views. `App.tsx` holds game/view selection state and picks a family:

- **Number games** (`src/games.ts`): Mega 6/45 (`power645`), Power 6/55 (`power655`), Lotto 5/35 (`power535`), Keno (`keno`). Each `Game` config declares `maxNumber`, `pickCount`, `mainCount`, bonus-ball info, `extraPick` (Lotto 5/35's separate lucky number 1–12), `maxBao` (max numbers for a combination ticket) and a `getTier()` prize table. Keno is fully defined (`kind: 'keno'`, `KENO_TABLE`), but `App.tsx` filters it out of the game picker.
- **3-digit games** (`src/digits.ts`): Max 3D (`max3d`, modes `max3d-basic` / `max3d-plus`) and Max 3D Pro (`max3dpro`). Draws are normalized to `tiers: string[][]` = [Đặc biệt, Nhất, Nhì, Ba] (raw tier keys have inconsistent casing, e.g. "Giải ba"). The Predict tab is a placeholder for these games.

Views: `SearchView` / `StatsView` / `PredictView` for number games, `DigitsSearchView` / `DigitsStatsView` for digit games. `src/analysis.ts` has the frequency stats (`computeStats`, `computeExtraStats`) and the prediction methods (`PREDICT_METHODS`, `predict`).

### Data flow

1. **Source:** JSONL fetched straight from the browser at `https://raw.githubusercontent.com/vietvudanh/vietlott-data/main/data/<file>.jsonl` (`power645`, `power655`, `power535`, `keno`, `3d`, `3d_pro`). That third-party repo scrapes Vietlott daily through its own GitHub Actions. This repo has no scraper.
2. **Gap-fill data:** `public/data/*.jsonl` holds draws the upstream source lacks, scraped once from the Vietlott API: `power645-early.jsonl` (draws #001–#197), `power535-missing.jsonl`, `3d-missing.jsonl`, `3d_pro-missing.jsonl`. They're wired in through `extraDataUrl` (prefixed with Vite `BASE_URL`), fetched in parallel, and merged by `id`. **The main source wins on duplicates**, and a missing extra file is non-fatal.
3. **Row format:** `{date, id, result}`. For number games `result` is `number[]`, with the bonus ball at index `mainCount`. For digit games `result` is an object keyed by prize-tier name. Draw ids are compared via `idNum()` (strips non-digits, e.g. Keno `#0110271`).
4. **Caching:** `loadDraws` uses an in-memory `Map`, then `localStorage` key `vietlott:<gameId>:<CACHE_VERSION>` with a 6-hour TTL. Bump `CACHE_VERSION` in `games.ts` when the data format or sources change. Games with `noCache: true` (Keno, ~12MB) stay in RAM only. `loadDigitDraws` uses only the in-memory cache.
5. **Matching:** `matchDraw` / `searchDraws` (games.ts) and `matchDigitDraw` / `searchDigitDraws` (digits.ts). Results are sorted by tier rank, then total prize, then match count, then newest draw. An optional `limit` scans only the N most recent draws.

### Prize-rule logic (be careful when editing)

- **Combination tickets (vé bao):** every pickCount-subset counts as an independent ticket and prizes add up. Counts are computed in closed form with `comb()`, not by enumeration. Each family needs special handling: Power 6/55 counts only the subsets that contain the drawn bonus number. Lotto 5/35 counts each chosen lucky number as its own set of combinations.
- Jackpot tiers have `minPrize: true`. Their prize is the minimum starting amount, so totals are displayed as "≥ …".
- Max 3D basic: each pick is scored on its own and repeats across tiers accumulate. Max 3D+ / Pro: picks are scored as a pair, with one highest prize per ticket. Pro requires the Special pair in the correct order, and reversed order wins "Phụ đặc biệt".
- Prize amounts are hard-coded from Vietlott's official rules (`rulesUrl` per game).

### Other localStorage keys

`vietlott:favs:<gameId>` and `vietlott:dfavs:<gameId>` store favorite number sets (max 10 per game). `vietlott:disclaimer-dismissed` stores the disclaimer state. Every storage access is wrapped in try/catch, so the app must keep working when storage is blocked.

## Notes

- `README.md` (Vietnamese) describes features for Mega/Power/Lotto only. Max 3D / Max 3D Pro support was added later.
- `.claude/` is currently empty. There are no Cursor or Copilot instruction files.
- `dist/` is a gitignored build output. `tsconfig.tsbuildinfo` is also a build artifact but is committed, so builds may modify it.
