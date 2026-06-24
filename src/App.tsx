import { useEffect, useMemo, useState } from 'react';
import { emptyDraft, type Draft } from './lib/model';
import { scoreDraft } from './lib/pack/engine';
import { presetsFor } from './lib/presets';
import { BASELINE_PACK } from './lib/pack/baseline';
import { docTypeById } from './lib/docTypes';
import {
  loadDraft, saveDraft, loadActivePack, migrateLegacyDraft,
} from './lib/storage';
import { BuilderForm } from './components/BuilderForm';
import { PresetPicker } from './components/PresetPicker';
import { ScorePanel } from './components/ScorePanel';
import { PreviewPane } from './components/PreviewPane';
import './App.css';

export default function App() {
  const pack = useMemo(() => loadActivePack() ?? BASELINE_PACK, []);
  const docType = docTypeById('soul');
  const docPack = pack.docTypes.soul;

  const [draft, setDraft] = useState<Draft>(() => {
    migrateLegacyDraft();
    return loadDraft('soul') ?? emptyDraft(docPack.sections);
  });

  const score = useMemo(
    () => scoreDraft(docPack.rubric, draft, docPack.sections),
    [docPack, draft],
  );

  useEffect(() => {
    const id = setTimeout(() => saveDraft('soul', draft), 300);
    return () => clearTimeout(id);
  }, [draft]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>SOUL Creator</h1>
        <p>{docType.blurb}</p>
      </header>

      <PresetPicker presets={presetsFor(pack, 'soul')} onApply={setDraft} />

      <main className="panes">
        <section className="pane pane-left">
          <BuilderForm sections={docPack.sections} draft={draft} onChange={setDraft} />
        </section>
        <section className="pane pane-right">
          <PreviewPane sections={docPack.sections} gate={docPack.gate} draft={draft} filename={docType.filename} />
          <ScorePanel result={score} />
        </section>
      </main>

      <footer className="app-footer">
        Place the result at <code>~/.hermes/SOUL.md</code>. Project-specific rules belong in <code>AGENTS.md</code>.
      </footer>
    </div>
  );
}
