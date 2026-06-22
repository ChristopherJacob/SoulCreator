import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { SoulDraft } from '../lib/model';
import { generateSoul } from '../lib/generator';
import { exportGate } from '../lib/scoring';

interface Props {
  draft: SoulDraft;
}

export function PreviewPane({ draft }: Props) {
  const markdown = useMemo(() => generateSoul(draft), [draft]);
  const gate = useMemo(() => exportGate(draft), [draft]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SOUL.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="preview-pane">
      <div className="export-bar">
        <button type="button" onClick={copy} disabled={!gate.ok}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button type="button" onClick={download} disabled={!gate.ok}>
          Download SOUL.md
        </button>
      </div>
      {!gate.ok && (
        <ul className="gate-reasons">
          {gate.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
      <div className="preview-markdown">
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
      <details className="preview-raw">
        <summary>Raw Markdown</summary>
        <pre>{markdown}</pre>
      </details>
    </div>
  );
}
