import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Draft } from '../lib/model';
import type { SectionDef, GateRule } from '../lib/pack/schema';
import { generate } from '../lib/generator';
import { evaluateGate } from '../lib/pack/engine';

interface Props {
  sections: SectionDef[];
  gate: GateRule[];
  draft: Draft;
  filename: string;
}

export function PreviewPane({ sections, gate, draft, filename }: Props) {
  const markdown = useMemo(() => generate(sections, draft), [sections, draft]);
  const result = useMemo(() => evaluateGate(gate, draft, sections), [gate, draft, sections]);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 1500);
  };

  const download = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="preview-pane">
      <div className="export-bar">
        <button type="button" onClick={copy} disabled={!result.ok}>
          {copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
        </button>
        <button type="button" onClick={download} disabled={!result.ok}>Download {filename}</button>
      </div>
      {!result.ok && (
        <ul className="gate-reasons">
          {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
      <div className="preview-markdown"><ReactMarkdown>{markdown}</ReactMarkdown></div>
      <details className="preview-raw"><summary>Raw Markdown</summary><pre>{markdown}</pre></details>
    </div>
  );
}
