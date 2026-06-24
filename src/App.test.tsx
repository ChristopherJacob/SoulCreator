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
    expect(screen.getByText('SOUL Creator')).toBeInTheDocument();
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
});
