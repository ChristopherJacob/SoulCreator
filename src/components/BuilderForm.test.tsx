import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuilderForm } from './BuilderForm';
import { EMPTY_DRAFT, SoulDraft } from '../lib/model';

// Realistic stateful host: BuilderForm is a controlled component, so visibility
// of optional sections must be driven by the draft the parent feeds back.
function Harness({ initial = EMPTY_DRAFT }: { initial?: SoulDraft }) {
  const [draft, setDraft] = useState<SoulDraft>(initial);
  return <BuilderForm draft={draft} onChange={setDraft} />;
}

describe('BuilderForm', () => {
  it('edits the identity field', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText(/identity/i), 'Hi');
    expect(screen.getByLabelText(/identity/i)).toHaveValue('Hi');
  });

  it('reveals the optional domain posture section on demand', async () => {
    render(<Harness />);
    expect(screen.queryByLabelText(/domain title/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /add domain posture/i }));
    expect(screen.getByLabelText(/domain title/i)).toBeInTheDocument();
  });

  it('removing an optional section clears it from the draft and re-hides it', async () => {
    render(<Harness initial={{ ...EMPTY_DRAFT, examples: ['Say when something is a bad idea.'] }} />);
    expect(screen.getByDisplayValue(/say when something/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /remove examples/i }));
    expect(screen.queryByDisplayValue(/say when something/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add examples/i })).toBeInTheDocument();
  });
});
