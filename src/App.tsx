import { useCallback, useEffect, useMemo, useState } from 'react';
import { emptyDraft, type Draft } from './lib/model';
import { scoreDraft } from './lib/pack/engine';
import { presetsFor } from './lib/presets';
import { BASELINE_PACK } from './lib/pack/baseline';
import { docTypeById } from './lib/docTypes';
import type { DocId, Pack } from './lib/pack/schema';
import { checkForUpdate } from './lib/pack/update';
import { PACK_BASE_URL } from './lib/config';
import {
  loadDraft, saveDraft, loadActivePack, migrateLegacyDraft,
  loadActiveTab, saveActiveTab,
  saveActivePack, saveAvailablePack, clearAvailablePack, loadAvailablePack,
} from './lib/storage';
import { UpdateBanner, type BannerState } from './components/UpdateBanner';
import { moveLeaksToAgents } from './lib/crossTab';
import { TabBar } from './components/TabBar';
import { BuilderForm } from './components/BuilderForm';
import { PresetPicker } from './components/PresetPicker';
import { ScorePanel } from './components/ScorePanel';
import { PreviewPane } from './components/PreviewPane';
import './App.css';

export default function App() {
  const [pack, setPack] = useState<Pack>(() => loadActivePack() ?? BASELINE_PACK);
  const [banner, setBanner] = useState<BannerState>({ kind: 'none' });
  const [active, setActive] = useState<DocId>(() => loadActiveTab() ?? 'soul');

  const [drafts, setDrafts] = useState<Record<DocId, Draft>>(() => {
    migrateLegacyDraft();
    return {
      soul: loadDraft('soul') ?? emptyDraft(pack.docTypes.soul.sections),
      agents: loadDraft('agents') ?? emptyDraft(pack.docTypes.agents.sections),
    };
  });

  const docType = docTypeById(active);
  const docPack = pack.docTypes[active];
  const draft = drafts[active];

  const setDraft = (next: Draft) => setDrafts((prev) => ({ ...prev, [active]: next }));

  const score = useMemo(
    () => scoreDraft(docPack.rubric, draft, docPack.sections),
    [docPack, draft],
  );

  useEffect(() => {
    const id = setTimeout(() => saveDraft(active, draft), 300);
    return () => clearTimeout(id);
  }, [active, draft]);

  const selectTab = (id: DocId) => {
    setActive(id);
    saveActiveTab(id);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = loadAvailablePack();
      if (cached) {
        setBanner({ kind: 'available', version: cached.packVersion, summary: cached.summary });
        return;
      }
      const out = await checkForUpdate({
        fetch: fetch.bind(window),
        baseUrl: PACK_BASE_URL,
        online: navigator.onLine,
        activeVersion: pack.packVersion,
      });
      if (cancelled) return;
      if (out.kind === 'available') {
        saveAvailablePack(out.pack);
        setBanner({ kind: 'available', version: out.pack.packVersion, summary: out.pack.summary });
      } else if (out.kind === 'needs-app-update') {
        setBanner({ kind: 'needs-app-update', version: out.manifest.latest });
      }
    })();
    return () => { cancelled = true; };
  }, [pack.packVersion]);

  const applyUpdate = useCallback(() => {
    const next = loadAvailablePack();
    if (!next) return;
    saveActivePack(next);
    clearAvailablePack();
    setPack(next);
    setBanner({ kind: 'none' });
  }, []);

  const dismissUpdate = useCallback(() => setBanner({ kind: 'none' }), []);

  const handleMoveLeaks = () => {
    const moved = moveLeaksToAgents(drafts.soul, drafts.agents, pack.docTypes.soul.sections);
    setDrafts({ soul: moved.soul, agents: moved.agents });
    selectTab('agents');
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>SOUL Creator</h1>
        <p>{docType.blurb}</p>
        <p className="pack-indicator">
          {navigator.onLine ? 'online' : 'offline'} · pack v{pack.packVersion}
        </p>
      </header>

      <UpdateBanner state={banner} onApply={applyUpdate} onDismiss={dismissUpdate} />
      <TabBar active={active} onSelect={selectTab} />
      <PresetPicker presets={presetsFor(pack, active)} onApply={setDraft} />

      <main className="panes">
        <section className="pane pane-left">
          <BuilderForm sections={docPack.sections} draft={draft} onChange={setDraft} />
        </section>
        <section className="pane pane-right">
          <PreviewPane sections={docPack.sections} gate={docPack.gate} draft={draft} filename={docType.filename} />
          <ScorePanel result={score} onMoveLeaks={active === 'soul' ? handleMoveLeaks : undefined} />
        </section>
      </main>

      <footer className="app-footer">
        <code>SOUL.md</code> → <code>~/.hermes/SOUL.md</code> (identity). <code>AGENTS.md</code> → your repo root (project rules).
      </footer>
    </div>
  );
}
