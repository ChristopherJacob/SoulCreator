import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateBanner } from './UpdateBanner';

describe('UpdateBanner', () => {
  it('renders nothing when there is no update', () => {
    const { container } = render(<UpdateBanner state={{ kind: 'none' }} onApply={() => {}} onDismiss={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows version + summary and fires apply/dismiss', () => {
    const onApply = vi.fn();
    const onDismiss = vi.fn();
    render(<UpdateBanner state={{ kind: 'available', version: '3', summary: 'Tightened hype list.' }} onApply={onApply} onDismiss={onDismiss} />);
    expect(screen.getByText(/v3/)).toBeInTheDocument();
    expect(screen.getByText(/Tightened hype list\./)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Apply'));
    fireEvent.click(screen.getByText('Dismiss'));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows an app-update notice without an apply button', () => {
    render(<UpdateBanner state={{ kind: 'needs-app-update', version: '9' }} onApply={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText(/update the app/i)).toBeInTheDocument();
    expect(screen.queryByText('Apply')).toBeNull();
  });
});
