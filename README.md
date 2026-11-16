# Potluck — a lean make.fun frontend

![make.fun bounty](https://make.fun/badge/makefun-frontend-01.svg)
![rank](https://make.fun/badge/makefun-frontend-01/KuntoSadewo/makefun-frontend-01/rank.svg)
![reward](https://make.fun/badge/makefun-frontend-01/KuntoSadewo/makefun-frontend-01/reward.svg)

An entry for the make.fun bounty **[Build the best make.fun frontend](https://make.fun/c/makefun-frontend-01)**.

Potluck is a small, fast, read-only web client for [make.fun](https://make.fun), built as plain static files with no framework and no build step. It reads only the public make.fun API (`GET https://make.fun/api/...`) and shows the four surfaces a visitor needs:

| Route | Surface |
| --- | --- |
| `#/` | The live bounty board — every open bounty with its live pot, entry fee, deadline countdown and entry count, with type-to-filter and paged rendering |
| `#/bounty/<slug>` | A bounty's page — summary, facts, the rewards table with the live pot split (base + entry-fee share), description and rules |
| `#/bounty/<slug>/leaderboard` | That bounty's leaderboard — ranked entries with entrant avatars, judge win rates and links through to profiles |
| `#/u/<handle>` | An account's public profile — identity links, track record and every entry they have submitted |

## Why it is fast

- **Tiny first load.** Vanilla ES modules and one stylesheet; no framework, no fonts to download, nothing from any origin besides the app itself and make.fun.
- **Cached, revalidated API reads.** Responses are cached in memory per URL and revalidated with their ETags (the API binds ETags to the minute, so a repeat read inside the minute costs a 304). In-flight requests are de-duplicated, and going back to a view refetches nothing.
- **Cheap updates.** Long lists render in pages, board filtering rewrites only the grid, and countdowns tick locally every 30 seconds — no polling, no page rebuilds.
- **Deadline-honest.** A bounty past its deadline reads "Closed" even while its API status still says open, because the deadline — not the status field — decides whether it still takes entries.

## Run it

```sh
node serve.ts            # serves app/ at http://localhost:8080
# or: node serve.ts --port 8090
```

Then open the printed URL in a browser. Any static file server pointed at `app/` works the same way.

## Hand in the entry

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library in `vendor/makefun-frontend.ts` (the kit's copy, unchanged):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Running it twice produces byte-identical output.

## Layout

- `app/` — the frontend: `index.html`, `app.js` (router + the four views), `api.js` (ETag-caching data layer), `fmt.js` (formatting + a safe mini-Markdown renderer), `style.css`
- `screenshots/` — three screenshots of the running app on live data; `shots.json` names each shot's route and viewport
- `vendor/makefun-frontend.ts` — the kit's dossier library, copied unchanged
- `main.ts`, `serve.ts` — the hand-in program and a local dev server

## License

MIT — see `LICENSE`.
