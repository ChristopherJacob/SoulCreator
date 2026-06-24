import { useEffect, useMemo, useState } from 'react';
import { emptyDraft, type Draft } from './lib/model';
import { scoreDraft } from './lib/pack/engine';
import { presetsFor } from './lib/presets';
import { BASELINE_PACK } from './lib/pack/baseline';
import { docTypeById } from './lib/docTypes';
import type { DocId } from './lib/pack/schema';
import {
  loadDraft, saveDraft, loadActivePack, migrateLegacyDraft,
  loadActiveTab, saveActiveTab,
} from './lib/storage';
import { moveLeaksToAgents } from './lib/crossTab';
import { TabBar } from './components/TabBar';
import { BuilderForm } from './components/BuilderForm';
import { PresetPicker } from './components/PresetPicker';
import { ScorePanel } from './components/ScorePanel';
import { PreviewPane } from './components/PreviewPane';
import './App.css';

export default function App() {
  const pack = useMemo(() => loadActivePack() ?? BASELINE_PACK, []);
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
      </header>

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
