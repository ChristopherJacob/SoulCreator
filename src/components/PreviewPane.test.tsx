import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreviewPane } from './PreviewPane';
import { EMPTY_DRAFT } from '../lib/model';
import { PRESETS } from '../lib/presets';

describe('PreviewPane', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('disables copy and shows gate reasons for an empty draft', () => {
    render(<PreviewPane draft={EMPTY_DRAFT} />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeDisabled();
    expect(screen.getByText(/add an identity/i)).toBeInTheDocument();
  });

  it('enables copy for a strong preset draft', async () => {
    render(<PreviewPane draft={PRESETS[0].draft} />);
    const copy = screen.getByRole('button', { name: /copy/i });
    expect(copy).toBeEnabled();
    await userEvent.click(copy);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});
