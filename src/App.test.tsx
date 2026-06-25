import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) =>
    String(url).endsWith('manifest.json')
      ? ({ ok: true, status: 200, json: async () => ({ latest: '1', schemaVersion: 2, url: 'pack-1.json', publishedAt: 'x', summary: 's' }) } as Response)
      : ({ ok: false, status: 404, json: async () => ({}) } as Response),
  ));
});

afterEach(() => vi.unstubAllGlobals());

describe('App', () => {
  it('renders the SOUL builder and updates the live score when a preset is applied', () => {
    render(<App />);
    expect(screen.getByText('Caduceus')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument(); // empty score
    fireEvent.click(screen.getByText('Pragmatic Engineer'));
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('switches to the AGENTS tab and shows its sections', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'AGENTS.md' }));
    expect(screen.getByText('Project overview')).toBeInTheDocument();
    expect(screen.getByText('Setup & commands')).toBeInTheDocument();
  });

  it('imports an AGENTS file, switches to its tab, and surfaces unmatched content', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /import/i }));
    const md = '# Project overview\nA test app.\n\n## Setup & commands\n- Run `npm test`.\n\n## Weird Section\nloose notes';
    fireEvent.change(screen.getByLabelText('Paste Markdown'), { target: { value: md } });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.getByDisplayValue('A test app.')).toBeInTheDocument();
    expect(screen.getByText(/Weird Section/)).toBeInTheDocument();
  });

  it('asks to confirm before replacing a non-empty draft on import', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Pragmatic Engineer'));
    fireEvent.click(screen.getByRole('button', { name: /import/i }));
    fireEvent.change(screen.getByLabelText('Paste Markdown'), {
      target: { value: '# Personality\nFresh identity here.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.getByText(/Replace your current/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(screen.getByDisplayValue('Fresh identity here.')).toBeInTheDocument();
  });

  it('updates the connectivity indicator on offline/online events', () => {
    render(<App />);
    expect(screen.getByText(/online · pack/)).toBeInTheDocument();
    fireEvent(window, new Event('offline'));
    expect(screen.getByText(/offline · pack/)).toBeInTheDocument();
    fireEvent(window, new Event('online'));
    expect(screen.getByText(/online · pack/)).toBeInTheDocument();
  });

  it('reverts to the bundled pack when a non-bundled pack is active', async () => {
    const { saveActivePack } = await import('./lib/storage');
    const { BASELINE_PACK } = await import('./lib/pack/baseline');
    saveActivePack({ ...BASELINE_PACK, packVersion: '99', summary: 'newer' });
    render(<App />);
    // indicator shows the active (non-bundled) version
    expect(screen.getByText(/pack v99/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /revert to bundled/i }));
    expect(screen.getByText(/pack v2/)).toBeInTheDocument();
  });
});
