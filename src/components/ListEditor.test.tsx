import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListEditor } from './ListEditor';

describe('ListEditor', () => {
  it('renders existing items and adds a new one', async () => {
    const onChange = vi.fn();
    render(<ListEditor label="Style" items={['Be direct.']} onChange={onChange} placeholder="Add a line" />);
    expect(screen.getByDisplayValue('Be direct.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /add style/i }));
    expect(onChange).toHaveBeenCalledWith(['Be direct.', '']);
  });

  it('removes an item', async () => {
    const onChange = vi.fn();
    render(<ListEditor label="Style" items={['a', 'b']} onChange={onChange} placeholder="x" />);
    await userEvent.click(screen.getAllByRole('button', { name: /remove/i })[0]);
    expect(onChange).toHaveBeenCalledWith(['b']);
  });
});
