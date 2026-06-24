# SOUL Creator

A slick, local-first web tool for authoring best-of-breed [Hermes](https://hermes-agent.nousresearch.com) identity and project-instruction files — `SOUL.md` and `AGENTS.md`.

## Why

The Hermes system-prompt stack separates durable identity from project detail:

- **`SOUL.md`** (slot #1) — portable identity: tone, voice, boundaries, defaults. Lives at `~/.hermes/SOUL.md` and applies to every project.
- **`AGENTS.md`** (repo root) — project-specific instructions: commands, paths, architecture notes, test patterns. Checked in alongside your code.

SOUL Creator guides you through both via two tabs, scores each draft 1–100 against the canonical rubric, and blocks export until the draft clears the quality bar. The SOUL tab's portability check flags task-specific leakage (commands, paths, flags) and offers one-click relocation to AGENTS.md.

## Features

- **Two-tab authoring** — switch between SOUL.md and AGENTS.md; each has its own sections, rubric, gate, and presets.
- **Move to AGENTS.md** — when SOUL's portability check flags leaking content, one click moves those lines to the right AGENTS sections and switches you to that tab.
- **Offline-first PWA** — install to desktop or home screen; works with no connectivity once cached. A service worker precaches all assets.
- **Best-practices updates** — the scoring rubric, sections, gates, and presets come from a versioned knowledge pack distilled from the Hermes docs and the `AGENTS.md` standard. When online, the app checks GitHub for a newer pack and shows a banner with a one-click, revertable apply. The pack is declarative JSON data — no remote code is ever executed. Regenerate the published pack with `npm run pack:build`.

## Develop

```bash
npm install
npm run dev              # start the dev server
npm test                 # fast unit/component tests (~58)
npm run test:build       # build-level tests: pack publish + PWA artifacts (run before shipping)
npm run build            # production build (tsc -b && vite build)
npm run lint             # ESLint
```

## Deploy

For GitHub Pages project sites, set the base path so asset paths and pack URLs resolve correctly:

```bash
VITE_BASE=/SoulCreator/ npm run build
```

Published packs are served from `<base>/packs/` (e.g. `https://you.github.io/SoulCreator/packs/`).

## Use

1. Pick a preset or start blank.
2. Switch between the **SOUL** and **AGENTS** tabs to author each file.
3. Edit the sections in the left pane; watch the live preview and score on the right.
4. If SOUL's portability check flags leaking lines, click **Move to AGENTS.md** to relocate them automatically.
5. Once the score clears the gate, Copy or Download the file:
   - `SOUL.md` → `~/.hermes/SOUL.md` (identity, applied everywhere).
   - `AGENTS.md` → your repo root (project rules, committed with your code).
