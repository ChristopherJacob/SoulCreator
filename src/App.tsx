import { useEffect, useMemo, useState } from 'react';
import { SoulDraft, EMPTY_DRAFT } from './lib/model';
import { scoreSoul } from './lib/scoring';
import { loadDraft, saveDraft } from './lib/storage';
import { BuilderForm } from './components/BuilderForm';
import { PresetPicker } from './components/PresetPicker';
import { ScorePanel } from './components/ScorePanel';
import { PreviewPane } from './components/PreviewPane';
import './App.css';

export default function App() {
  const [draft, setDraft] = useState<SoulDraft>(() => loadDraft() ?? EMPTY_DRAFT);
  const score = useMemo(() => scoreSoul(draft), [draft]);

  useEffect(() => {
    const id = setTimeout(() => saveDraft(draft), 300);
    return () => clearTimeout(id);
  }, [draft]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>SOUL Creator</h1>
        <p>Craft a best-of-breed <code>SOUL.md</code> for your Hermes agent.</p>
      </header>

      <PresetPicker onApply={setDraft} />

      <main className="panes">
        <section className="pane pane-left">
          <BuilderForm draft={draft} onChange={setDraft} />
        </section>
        <section className="pane pane-right">
          <PreviewPane draft={draft} />
          <ScorePanel result={score} />
        </section>
      </main>

      <footer className="app-footer">
        Place the result at <code>~/.hermes/SOUL.md</code>. Project-specific rules belong in <code>AGENTS.md</code>.
      </footer>
    </div>
  );
}
