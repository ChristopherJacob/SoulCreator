import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

beforeEach(() => localStorage.clear());

describe('App', () => {
  it('renders the SOUL builder and updates the live score when a preset is applied', () => {
    render(<App />);
    expect(screen.getByText('SOUL Creator')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument(); // empty score
    fireEvent.click(screen.getByText('Pragmatic Engineer'));
    expect(screen.getByText('100')).toBeInTheDocument();
  });
});
