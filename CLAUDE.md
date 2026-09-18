# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static dashboard for GitHub Pages (`https://gillus.github.io/EuroEnergy/`) that maps European energy data country by country. Data comes from Eurostat. Stack: Vite + TypeScript + ECharts, with `d3-geo` for the map projection. The UI is in Italian.

## Commands

```bash
npm run dev          # Vite dev server → http://localhost:5173/EuroEnergy/
npm run build        # tsc --noEmit && vite build → dist/
npm run preview      # serve dist/ with the production base path
npm test             # vitest (JSON-stat parser)
npx vitest run tests/jsonstat.test.ts -t "attaches status flags"   # single test
npm run lint         # tsc --noEmit
npm run data         # re-download Eurostat data into public/data/
npm run geo          # re-download and clip country boundaries into public/geo/
```

The Vite `base` is `/EuroEnergy/`. The app loads its data at runtime with `import.meta.env.BASE_URL`, so the page only works under that path, even in dev.

## Architecture

**Data pipeline (`scripts/`, Node, run with tsx)**
- `fetch-data.ts` queries the Eurostat dissemination API (JSON-stat 2.0) for 5 datasets: `nrg_ind_ren`, `nrg_bal_peh`, `nrg_ind_eff`, `nrg_ind_id` and `demo_pjan`.
- `scripts/lib/jsonstat.ts` flattens each response into cells.
- The script writes compact files to `public/data/*.json`, in the shape `{dataset, unit, series: {variant: {geo: {year: [value, flag]}}}}` (types in `src/types.ts`), plus `meta.json` with the Eurostat update dates.
- It writes nothing unless every dataset succeeds, so a failed run keeps the committed data.
- The data files are committed. The `update-data.yml` workflow refreshes them monthly and then triggers `deploy.yml` explicitly, because pushes made with `GITHUB_TOKEN` don't trigger other workflows.

**Shared modules (imported by both the scripts and the browser)**
- `src/countries.ts` lists the geo codes the pipeline keeps, with their Italian names. Eurostat uses EL for Greece and UK for the United Kingdom.
- `src/mix.ts` maps SIEC codes to electricity sources. `fetch-data.ts` uses it to compute the mix, and the UI uses it for labels and colors.

**Frontend (`src/`)**
- `indicators.ts` is the registry of everything the map can show. The "Indicatore" menu lists `GROUPS`, and each group's `metrics` are its variants. A metric's `value()` reads the raw files. `readMetric()` applies the per-capita conversion using the population series.
- To add an indicator, add a metric here. If it needs a new dataset, also add it to `fetch-data.ts` and `data.ts`.
- `map.ts` draws the ECharts choropleth.
  - It uses a piecewise `visualMap`. `classBreaks()` computes the breaks once over all years, so colors stay comparable while the year slider moves. It uses quantiles unless the metric sets fixed `breaks`, and gives zero its own class when many values are 0.
  - Regions are matched by `properties.name`, which holds the geo code.
- `charts.ts` draws the trend chart (country vs EU27), the detail chart (all variants of the group, or the stacked electricity mix) and the ranking chart. Options are merged, rather than rebuilt, when only the year changes.
- `main.ts` holds the state: metric, year, per-capita toggle and selected country. It syncs that state to the URL hash (`#i=<metric>&a=<year>&p=<geo>&pc=1`).

## Eurostat data gotchas (verified against the API)

- In `nrg_bal_peh`, `RA100` (hydro) already **excludes** pumped storage (`RA130`), and `RA000` = RA100 + RA200 + RA300 + RA4xx + BIOE. Pumped hydro is therefore shown as its own non-renewable source.
- Estonia's oil shale shows up under `S2000` and `C0350-0370` (manufactured gases), so both belong to the "solid fossil" source. Without them Estonia's "Altro" share rises from under 1% to about 17%.
- The EU27 aggregate in `nrg_bal_peh` lacks `BIOE`. The pipeline rebuilds the EU27 mix as the sum of the 27 member states.
- The `nrg_ind_eff` series `PEC2020-2030`/`FEC2020-2030` are empty. Use `PEC_EED`/`FEC_EED`.
- Import dependency can be far below zero for net exporters (Norway is about -500%). The ranking axis is floored at -100 through `axisFloor`.
- GISCO country boundaries at 1:20M don't include Kosovo (XK), so XK has data in the charts but no shape on the map.
- The `updated` timestamps from Eurostat use `+0200` offsets. `formatDate()` normalizes them to `+02:00`, the form Safari accepts.

## Conventions

- The project owner writes in Italian: UI text, README, commit messages. Code comments are in English.
- Deployment needs GitHub Pages with Source set to "GitHub Actions" in the repo settings.
