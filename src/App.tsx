import { useCallback, useEffect, useMemo, useState } from 'react';
import { emptyDraft, type Draft } from './lib/model';
import { parseMarkdown, type ParseResult } from './lib/parser';
import { ImportPanel } from './components/ImportPanel';
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

  const [online, setOnline] = useState(navigator.onLine);

  const [importing, setImporting] = useState(false);
  const [unmatched, setUnmatched] = useState<ParseResult['unmatched']>([]);
  const [pendingImport, setPendingImport] = useState<ParseResult | null>(null);

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

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

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

  const revertToBundled = useCallback(() => {
    saveActivePack(BASELINE_PACK);
    clearAvailablePack();
    setPack(BASELINE_PACK);
    setBanner({ kind: 'none' });
  }, []);

  const sectionsByDoc = {
    soul: pack.docTypes.soul.sections,
    agents: pack.docTypes.agents.sections,
  };

  const draftHasContent = (d: Draft): boolean =>
    Object.values(d).some((v) =>
      Array.isArray(v) ? v.some((s) => s.trim() !== '') : typeof v === 'string' && v.trim() !== '',
    );

  const applyImport = (result: ParseResult) => {
    setDrafts((prev) => ({ ...prev, [result.docId]: result.draft }));
    selectTab(result.docId);
    setUnmatched(result.unmatched);
    setPendingImport(null);
    setImporting(false);
  };

  const handleImport = (markdown: string) => {
    const result = parseMarkdown(markdown, active, sectionsByDoc);
    if (draftHasContent(drafts[result.docId])) setPendingImport(result);
    else applyImport(result);
  };

  const handleMoveLeaks = () => {
    const moved = moveLeaksToAgents(drafts.soul, drafts.agents, pack.docTypes.soul.sections);
    setDrafts({ soul: moved.soul, agents: moved.agents });
    selectTab('agents');
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="" width={72} height={72} />
          <div className="brand-text">
            <h1>Caduceus</h1>
            <p className="tagline">Identity and instructions, in balance.</p>
          </div>
        </div>
        <p>{docType.blurb}</p>
        <p className="pack-indicator">
          {online ? 'online' : 'offline'} · pack v{pack.packVersion}
          {pack.packVersion !== BASELINE_PACK.packVersion && (
            <button type="button" className="revert-pack" onClick={revertToBundled}>
              Revert to bundled (v{BASELINE_PACK.packVersion})
            </button>
          )}
        </p>
      </header>

      <UpdateBanner state={banner} onApply={applyUpdate} onDismiss={dismissUpdate} />
      <div className="tab-row">
        <TabBar active={active} onSelect={selectTab} />
        <button type="button" className="import-toggle" onClick={() => setImporting((v) => !v)}>
          Import…
        </button>
      </div>
      {importing && <ImportPanel onImport={handleImport} onClose={() => setImporting(false)} />}
      {pendingImport && (
        <div className="import-confirm" role="alertdialog" aria-label="Confirm import replace">
          <span>Replace your current {docTypeById(pendingImport.docId).label} draft with the imported file?</span>
          <span className="import-buttons">
            <button type="button" onClick={() => applyImport(pendingImport)}>Replace</button>
            <button type="button" className="ghost" onClick={() => setPendingImport(null)}>Keep current</button>
          </span>
        </div>
      )}
      {unmatched.length > 0 && (
        <div className="unmatched-panel" role="status">
          <div className="unmatched-head">
            <strong>Unmatched content</strong> — couldn't place these; move them in manually.
            <button type="button" className="ghost" onClick={() => setUnmatched([])}>Dismiss</button>
          </div>
          <ul>
            {unmatched.map((u, i) => (
              <li key={i}><em>{u.heading || '(no heading)'}</em><pre>{u.body}</pre></li>
            ))}
          </ul>
        </div>
      )}
      <PresetPicker presets={presetsFor(pack, active)} onApply={setDraft} />

      <main className="panes">
        <section className="pane pane-left">
          <BuilderForm sections={docPack.sections} draft={draft} onChange={setDraft} />
        </section>
        <section className="pane pane-right">
          <PreviewPane sections={docPack.sections} gate={docPack.gate} draft={draft} filename={docType.filename} />
          <ScorePanel result={score} onMoveLeaks={active === 'soul' ? handleMoveLeaks : undefined} moveLeaksKey="portability" />
        </section>
      </main>

      <footer className="app-footer">
        <code>SOUL.md</code> → <code>~/.hermes/SOUL.md</code> (identity). <code>AGENTS.md</code> → your repo root (project rules).
      </footer>
    </div>
  );
}
