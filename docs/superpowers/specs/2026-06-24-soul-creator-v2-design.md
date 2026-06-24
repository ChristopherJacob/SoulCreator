# SOUL Creator v2 — AGENTS.md, Updatable Knowledge Pack & Offline PWA

**Date:** 2026-06-24
**Status:** Approved (design), pending implementation plan
**Author:** Claude (with Chris Jacob)
**Builds on:** [2026-06-22-soul-creator-design.md](./2026-06-22-soul-creator-design.md)

## Purpose

Extend the shipped SOUL Creator with three capabilities that were out of scope
for v1:

1. **AGENTS.md authoring** — a second tab that authors `AGENTS.md` (the
   project-specific counterpart to instance-wide `SOUL.md`) with the same
   guided + scored + gated treatment.
2. **Offline-first PWA** — installable, fully functional with zero
   connectivity; the network only ever *enriches*, never gates.
3. **Updatable best-practices knowledge** — the rules that define "best-of-breed"
   are externalized into a versioned, declarative **knowledge pack** the app can
   re-fetch from GitHub, so the tool's understanding of SOUL/AGENTS best
   practices can improve without an app release. Updates are **notify-and-apply**
   (transparent, user-controlled), never silent.

## Provenance of the current best-practices knowledge

v1's understanding was distilled from two NousResearch Hermes docs pages and
hardcoded across `scoring.ts` (regexes, weights, the 4–8 line sweet spot, tips),
`generator.ts` (canonical headings), and `presets.ts` (persona library). v2
externalizes that encoded knowledge into the pack.

### Tracked sources (seed the v1 pack; watched for future updates)

- Hermes — Personality & SOUL.md:
  https://hermes-agent.nousresearch.com/docs/user-guide/features/personality
- Hermes — Use SOUL.md with Hermes:
  https://hermes-agent.nousresearch.com/docs/guides/use-soul-with-hermes
- agents.md open standard:
  https://agents.md/ and https://github.com/agentsmd/agents.md
- Hermes — AGENTS.md context files / project instructions:
  https://hermes-agent.nousresearch.com/docs/user-guide/features/context-files
  and the exemplar https://github.com/NousResearch/hermes-agent/blob/main/AGENTS.md

Key AGENTS.md facts driving the design:

- Plain Markdown, **no required fields**; headings are semantic hints.
- Recommended sections: project overview, build/test commands, code style,
  testing, security, commit/PR rules; plus a **"Boundaries: Always do / Ask
  first / Never do"** pattern.
- **Exact commands** (with full flags) are the single highest-ROI section.
- Aim for **≤ 150 lines** — long files bury signal.
- Hermes loads the top-level `AGENTS.md` from the working directory at session
  start; subdirectory files are discovered lazily. (Instance-wide identity →
  `SOUL.md`; project context → `AGENTS.md`.)

## Decisions (locked)

- **Standalone meaning:** installable, offline-first **PWA** (not a native
  desktop app). Brings v1's deferred PWA item back into scope.
- **Update model:** **notify & let user apply** — a non-intrusive banner; scores
  stay stable until the user opts in. A "revert to bundled" escape hatch always
  exists.
- **Pack scope:** **full data-driven rule engine** — rubric, sections, gates,
  and presets are all pack data, interpreted by a safe in-app engine.
- **AGENTS.md depth:** **full mirror** — guided sections + live rule-engine
  scoring + export gates, symmetric with SOUL.
- **Knowledge sources:** **Hermes docs + agents.md standard** (Hermes for SOUL;
  Hermes + agents.md for AGENTS).
- **Architecture:** **generalized DocType abstraction** — SOUL and AGENTS are
  two instances of one generic doc model parameterized by the pack.

## Security guardrail (non-negotiable)

The knowledge pack is **declarative data only — never fetched executable code.**
The app downloads JSON describing rules; the *interpreter* that runs those rules
ships inside the signed, bundled app. No `eval`/`Function` of remote content.

### Reconciling "full data-driven" with "no remote code"

The engine supports a **fixed, rich vocabulary of composable check primitives**
baked into the interpreter (see Rule Engine below). Rules are pure JSON that
compose these primitives. Consequently:

- **Ships via pack update, no app release:** weights, regexes, thresholds, point
  bands, tips, section definitions, gates, and presets — i.e. everything that
  actually changes as best practices evolve.
- **Still needs an app release:** a genuinely *new primitive kind* (a check shape
  none of the built-ins can express). Handled gracefully via `schemaVersion`
  (below) rather than by executing remote logic.

## Architecture

Single-page React + Vite + TypeScript app, local-first, no backend, now an
installable offline PWA. Layout adds a **tab bar** (`SOUL.md | AGENTS.md`) under
the global header. The active tab swaps the **doc-type binding** that feeds the
generic builder, preview, score, and export components. App-global chrome
(online/offline + pack-version indicator, update banner) sits above the tabs.

### Module map

Existing pure modules are generalized from "SOUL-only" to "doc-type-driven."

| Module | Status | Responsibility |
|--------|--------|----------------|
| `lib/pack/schema.ts` | **new** | Types + validator for the knowledge-pack JSON (rules, sections, presets, gates, versions). |
| `lib/pack/engine.ts` | **new** | Safe declarative interpreter: `(rubric, draft) → {score, categories[]}` and `(gateSpec, draft) → GateResult`. Only runs the fixed primitive vocabulary over data. |
| `lib/pack/baseline.ts` | **new** | The bundled v1 pack (Hermes + agents.md), so the app works offline on first run. |
| `lib/pack/update.ts` | **new** | Fetch manifest, compare versions, validate, store available/active pack; pure logic with injectable `fetch`. |
| `lib/docTypes.ts` | **new** | Runtime binding of a doc's identity (`soul`/`agents`): id, display name, ordered section defs, which pack rubric/presets/gate apply. |
| `lib/model.ts` | changed | `Draft` becomes generic: a map of `sectionId → string | string[]`. `SoulDraft`/`AgentsDraft` are doc-type instances. `cleanLines` retained. |
| `lib/generator.ts` | changed | `generate(docType, draft, pack)` walks the doc type's section list; rules for trimming/omission/bullets preserved. |
| `lib/scoring.ts` | removed | Logic moves into `pack/engine.ts`; data moves into `pack/baseline.ts`. |
| `lib/presets.ts` | changed | Thin accessor over the active pack's presets (per doc type). |
| `lib/storage.ts` | changed | Namespaced drafts (`draft:soul`, `draft:agents`), `activePack`, `availablePack`, `lastCheckedAt`, `activeTab`. |

Boundary test still holds: `pack/*`, `generator`, `docTypes`, `storage` are pure
and React-free, unit-testable in isolation. UI consumes them through props.

## Knowledge pack

### Shape

```jsonc
{
  "packVersion": "3",              // content version (monotonic)
  "schemaVersion": 2,              // interpreter compatibility (see below)
  "publishedAt": "2026-06-24",
  "summary": "Tightened hype list; added Boundaries rule to AGENTS.",
  "docTypes": {
    "soul":   { "sections": [ /* SectionDef */ ], "rubric": [ /* Rule */ ], "gate": [ /* GateRule */ ], "presets": [ /* Preset */ ] },
    "agents": { "sections": [ ... ], "rubric": [ ... ], "gate": [ ... ], "presets": [ ... ] }
  }
}
```

`SectionDef`: `{ id, heading, kind: "text" | "list", optional: boolean, placeholder, help }`.

`Rule`: `{ id, label, max, target, check, params, direction: "reward" | "penalty", tips: { pass, fail } }`.

`GateRule`: `{ id, check, params, message }` — a subset of rules whose failure
blocks export.

### Rule engine — fixed primitive vocabulary

The interpreter supports exactly these `check` kinds in v1 (`schemaVersion: 2`):

| Primitive | Use | Behavior |
|-----------|-----|----------|
| `textLength` | identity present & concrete | score bands by char count of a text section |
| `lineCount` | conciseness sweet spot | score bands by total line count (SOUL 4–8; AGENTS ≤150) |
| `listSize` | avoid/defaults/boundaries clarity | score bands by list length |
| `patternRatio` | style specificity / commands concreteness | % of lines matching a regex → scaled reward |
| `patternPenalty` | hype, SOUL portability leaks | each regex match subtracts points |
| `structure` | canonical headings present | reward presence of required sections |

`params` carries regex **strings** (compiled by the interpreter against
length-capped input — drafts are already bounded), numeric thresholds, and point
bands. Tips support simple interpolation of matched tokens (e.g. list the leaks
found). Adding regexes/thresholds/bands/tips is pure data; adding a *new
primitive* increments `schemaVersion`.

### Versioning & compatibility

- `packVersion` — content; drives "newer available" detection.
- `schemaVersion` — set of primitives the pack relies on. The app declares the
  max `schemaVersion` it supports. If a fetched pack's `schemaVersion` exceeds
  it, the app **declines to apply** and shows "update the app to get newer
  checks" instead of breaking.

## Update mechanism

### Hosting

Static files in this repo, served via **GitHub Pages** (CORS-clean):

- `packs/manifest.json` — `{ latest, schemaVersion, url, publishedAt, summary }`.
- `packs/pack-N.json` — full, **immutable** versioned pack. Old versions never
  mutate, so any app build has a stable target.

The base URL is a build-time constant.

### Check/apply flow

```
on app load AND on manual "Check for updates":
  if offline            → skip silently; use active pack
  fetch manifest.json (cheap; ETag-friendly)
    latest <= active.version            → up to date; no UI
    manifest.schemaVersion > app max    → banner: "Update the app for newer checks"
    newer & compatible:
      fetch pack-N.json; validate against schema
        invalid  → ignore + log; keep active pack (never apply a bad pack)
        valid    → store as availablePack; show banner:
                   "Best-practices update vN available · [What changed] [Apply] [Dismiss]"
```

- **Apply** swaps `activePack` in storage; score/tips/sections recompute live.
  **Drafts are never touched** — only the rubric/guidance changes.
- **Revert to bundled vN** is always available.
- No polling: check once per load + the manual button; throttled via
  `lastCheckedAt`.

## AGENTS.md doc type

Defined entirely in the pack. Canonical sections (all guided, most optional):

| Section | Kind | Purpose |
|---------|------|---------|
| Project overview | text | 1–3 sentences: what this repo is |
| Setup & commands | list | **Exact** build/test/run commands with flags |
| Code style | list | Conventions, formatting, idioms |
| Testing | list | How to run tests; what must pass |
| Architecture | list | Key modules/boundaries |
| Boundaries | list | Always do / Ask first / Never do |
| Commit & PR | list | Message format, review expectations |

### Rubric (mirror of SOUL's, re-parameterized)

- **Commands concreteness** (`patternRatio`, reward) — rewards real command
  tokens (`npm`, `pytest`, `docker`…). The *inverse* of SOUL's portability
  penalty: task-specific content is exactly what belongs here.
- **Specificity** (`patternPenalty` on vague filler like "follow best
  practices") — penalize emptiness.
- **Conciseness** (`lineCount`) — sweet spot tuned to **≤150 lines**.
- **Boundaries present** (`listSize`/`structure`) — reward an explicit
  Always/Ask/Never triad.
- **No-hype** — shared with SOUL.
- **Structure** — canonical headings present.

### Gates

Export enabled once AGENTS.md has a **project overview** and **at least one
concrete command**. No portability penalty (that gate is SOUL-specific).

## UI

- **Tab bar** under the header: `SOUL.md | AGENTS.md`. Switching swaps the
  doc-type binding feeding the generic builder/preview/score/export. Active tab
  persisted (`activeTab`).
- **Header chrome (app-global):** online/offline + active pack version
  indicator (e.g. "offline · pack v3"); update banner when an applicable update
  is available.
- Per-tab autosave, presets, gates — identical behavior across both docs.

### Cross-tab integration — "Move to AGENTS.md"

When SOUL's portability check flags a leak (file path, command, etc.), its tip
becomes actionable: **"This belongs in AGENTS.md → [Move to AGENTS.md]."**
Clicking appends the offending line to the best-fit AGENTS.md section (commands
→ Setup & commands; paths → Architecture; else a catch-all section) and switches
tabs. Scoped to a **single safe append** (no fancy parsing). This turns the
tool's signature correctness signal into a one-click fix and is the concrete
reason both docs live in one app.

## PWA / offline

- Add `vite-plugin-pwa` (Workbox) → generates service worker + web app manifest;
  lightest path that keeps the existing Vite build.
- **Caching:** app shell (HTML/JS/CSS) **cache-first** → launches offline,
  installable. Pack manifest/files **network-first with cache fallback** → fresh
  when online, last-known when offline.
- **Web app manifest:** name, icons (reuse `favicon.svg`/`icons.svg`),
  `display: standalone`, dark theme color → installable to desktop/home screen.
- Online/offline indicator in the header so update behavior is never mysterious.

The tool is fully functional with zero connectivity; the network only enriches.

## Testing strategy

- **`pack/engine`** — unit-test each of the six primitives (bands, ratios,
  penalties) against fixture rules.
- **`pack/schema`** — round-trip valid packs; reject malformed packs (missing
  fields, unknown primitive → declined).
- **`pack/update`** — mock `fetch`: offline skips; newer-compatible → available
  banner; newer-incompatible-schema → "update app"; invalid pack → ignored;
  apply → recompute; revert → restores bundled.
- **`generator`** — both doc types emit correct canonical structure; omission
  rules hold; single trailing newline.
- **AGENTS rubric (via baseline pack)** — commands rewarded (not penalized),
  boundaries triad scored, 150-line sweet spot, gate logic.
- **SOUL rubric parity** — baseline pack reproduces v1 scoring behavior
  (regression guard against the scoring → pack migration).
- **Component smoke** — tab switch swaps rubric/preview; gate toggles export per
  tab; "Move to AGENTS.md" appends + switches tabs.
- **PWA** — build emits a service worker + valid web manifest (build-level
  assertion).
- Vitest throughout, mirroring the existing suite.

## Migration notes

- The v1 `scoring.ts` behavior is preserved exactly inside the baseline pack's
  `soul` rubric; a parity test locks this so the refactor is behavior-neutral.
- Existing single `draft` localStorage key is migrated to `draft:soul` on first
  v2 load (one-time, non-destructive).

## Out of scope (v2)

- Native desktop packaging (Tauri/Electron) — PWA covers "standalone."
- Executing remote rule logic / arbitrary new primitives without an app release
  (security line; handled via `schemaVersion` fallback).
- Authoring nested/per-directory AGENTS.md files — single top-level doc only.
- Backend, accounts, cloud sync, direct filesystem writes (browser limitation).
- Rich cross-tab parsing beyond the single safe append.

## Success criteria check

- *AGENTS.md creation as a 2nd tab* → full-mirror doc type with its own canonical
  sections, inverted rubric, gates, presets, and live preview.
- *Standalone app* → installable offline-first PWA; fully functional with no
  network.
- *Update its understanding of best practices* → versioned declarative knowledge
  pack fetched from GitHub, notify-and-apply, distilled from Hermes docs +
  agents.md, with a safe interpreter and graceful schema-version fallback.
- *Consistent with v1 / prompt-forge lineage* → same guided-builder + live-scoring
  + local-first model, generalized to two doc types and an updatable rubric.
