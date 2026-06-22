import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScorePanel } from './ScorePanel';
import { scoreSoul } from '../lib/scoring';
import { PRESETS } from '../lib/presets';

describe('ScorePanel', () => {
  it('shows the total score and category rows', () => {
    const result = scoreSoul(PRESETS[0].draft);
    render(<ScorePanel result={result} />);
    expect(screen.getByText(String(result.score))).toBeInTheDocument();
    expect(screen.getByText(/identity/i)).toBeInTheDocument();
    expect(screen.getByText(/portability/i)).toBeInTheDocument();
  });
});
