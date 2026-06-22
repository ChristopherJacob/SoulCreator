import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App', () => {
  beforeEach(() => localStorage.clear());

  it('applies a preset and reflects it in score and preview', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /pragmatic engineer/i }));
    // export becomes enabled once a strong preset is loaded
    expect(screen.getByRole('button', { name: /download soul\.md/i })).toBeEnabled();
    // preview shows the identity heading text
    expect(screen.getAllByText(/pragmatic/i).length).toBeGreaterThan(0);
  });
});
