<p align="center">
  <img src="logo.png" alt="Caduceus" width="220" />
</p>

<h1 align="center">Caduceus</h1>

<p align="center"><em>Identity and instructions, in balance.</em></p>

<p align="center">
  A slick, local-first web tool for authoring best-of-breed
  <a href="https://hermes-agent.nousresearch.com"><code>SOUL.md</code></a> and
  <code>AGENTS.md</code> files for <a href="https://hermes-agent.nousresearch.com">Hermes</a> agents —
  guided, scored, and offline-ready.
</p>

<p align="center">
  <a href="https://christopherjacob.github.io/Caduceus/"><b>▶ Live app</b></a>
</p>

---

## What it is

A Hermes agent reads two kinds of context, and Caduceus authors both — the two
serpents of the staff:

- **`SOUL.md`** — the agent's durable **identity**: tone, voice, boundaries, and
  defaults. Instance-wide, lives at `~/.hermes/SOUL.md`. It should follow the
  agent *everywhere*.
- **`AGENTS.md`** — a project's **instructions**: setup, exact commands, code
  style, testing, and boundaries. Lives in your repo root. It belongs to *that
  project*.

The guiding rule Caduceus enforces: *if it should follow you everywhere, it
belongs in SOUL.md; if it belongs to a project, it belongs in AGENTS.md.*

## Why use it

- **Two tabs, one tool.** Author `SOUL.md` and `AGENTS.md` side by side, each
  with its own guided sections, presets, and live Markdown preview.
- **Live 1–100 quality score.** A transparent rubric grades each draft and emits
  actionable tips. Copy and Download stay **gated** until the draft clears the
  bar.
- **Portability check + one-click fix.** `SOUL.md` is scored for task-specific
  leakage (file paths, ports, commands). When it finds some, it offers
  **“Move to AGENTS.md”** — relocating those lines to the right file in one
  click. This is the signature Hermes-correctness signal.
- **Installable, offline-first PWA.** Install it to your desktop or home screen;
  it works with no connectivity. The network only ever *enriches*.
- **Self-updating best practices.** The scoring rubric, sections, gates, and
  presets all come from a versioned **knowledge pack** distilled from the Hermes
  docs and the [agents.md](https://agents.md) standard. When online, Caduceus
  checks GitHub for a newer pack and offers a one-click, **revertable** update —
  *notify-and-apply*, never silent. The pack is **declarative data**; the app
  never executes remote code.

## Use

1. Pick the **SOUL.md** or **AGENTS.md** tab.
2. Start from a preset or a blank slate.
3. Fill the guided sections; watch the live preview and score.
4. On SOUL.md, if the Portability check flags task-specific lines, click
   **Move to AGENTS.md** to relocate them.
5. **Copy** or **Download** once the draft clears the gate, then place the file:
   `SOUL.md` → `~/.hermes/SOUL.md`; `AGENTS.md` → your repo root.

## Develop

```bash
npm install
npm run dev          # start the app
npm test             # fast unit/component tests
npm run test:build   # build-level tests: pack publish + PWA artifacts (run before shipping)
npm run build        # production build (tsc + vite)
npm run lint         # eslint
```

### Best-practices knowledge pack

The pack is published as static JSON under [`public/packs/`](public/packs) and
served at `<base>/packs/`. The app validates both the manifest and the pack
(structure **and** schema version) before applying anything, and declines packs
that need a newer app than is installed. Regenerate the published pack from the
bundled baseline after editing `src/lib/pack/baseline.ts`:

```bash
npm run pack:build
```

## Deploy

The app is a static site deployed to GitHub Pages. Pushing to `main` runs the
GitHub Actions workflow (`.github/workflows/deploy.yml`), which builds with
`VITE_BASE=/Caduceus/` (the project-site subpath, so asset and pack URLs resolve)
and publishes `dist/`.

A manual fallback is available for one-off deploys:

```bash
npm run deploy        # builds with VITE_BASE=/Caduceus/ and pushes dist/ to gh-pages
VITE_BASE=/Other/ npm run deploy   # override the base for a different project path
```

Building with the wrong base yields a blank page, so always go through
`npm run deploy` (or CI) rather than a bare `vite build`. Packs are served from
`<base>/packs/`, and the app's update checks read from the URL in
`src/lib/config.ts` (override at build time with `VITE_PACK_BASE_URL`).

## How it's built

React + Vite + TypeScript, no backend. The scoring/generation core is a set of
pure, React-free modules — a safe declarative **rule engine** (a fixed set of
check primitives, no `eval`) reads the knowledge pack to score and gate any
document type. SOUL.md and AGENTS.md are two instances of one generic model, so
the builder, preview, score, and export UI are written once and parameterized by
the pack.
