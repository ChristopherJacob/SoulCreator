import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PreviewPane } from './PreviewPane';
import { BASELINE_PACK } from '../lib/pack/baseline';

const soul = BASELINE_PACK.docTypes.soul;

describe('PreviewPane', () => {
  it('disables export when gated and lists reasons', () => {
    render(<PreviewPane sections={soul.sections} gate={soul.gate} filename="SOUL.md"
      draft={{ identity: '', style: [], avoid: [], defaults: [] }} />);
    expect(screen.getByText('Download SOUL.md')).toBeDisabled();
    expect(screen.getByText('Add an Identity statement.')).toBeInTheDocument();
  });

  it('enables export for a valid draft', () => {
    render(<PreviewPane sections={soul.sections} gate={soul.gate} filename="SOUL.md"
      draft={{ identity: 'I am Hermes, careful.', style: ['Be direct.'], avoid: [], defaults: [] }} />);
    expect(screen.getByText('Download SOUL.md')).not.toBeDisabled();
  });

  it('shows a failure state when copying to the clipboard rejects', async () => {
    const soul = BASELINE_PACK.docTypes.soul;
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    render(<PreviewPane sections={soul.sections} gate={soul.gate} filename="SOUL.md"
      draft={{ identity: 'I am Hermes, careful.', style: ['Be direct.'], avoid: [], defaults: [] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(screen.getByText('Copy failed')).toBeInTheDocument());
    vi.unstubAllGlobals();
  });
});
