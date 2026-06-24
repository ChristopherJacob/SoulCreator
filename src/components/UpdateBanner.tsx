export type BannerState =
  | { kind: 'none' }
  | { kind: 'available'; version: string; summary: string }
  | { kind: 'needs-app-update'; version: string };

interface Props {
  state: BannerState;
  onApply: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ state, onApply, onDismiss }: Props) {
  if (state.kind === 'none') return null;

  return (
    <div className="update-banner" role="status">
      {state.kind === 'available' ? (
        <>
          <span>Best-practices update <strong>v{state.version}</strong> available — {state.summary}</span>
          <span className="update-actions">
            <button type="button" onClick={onApply}>Apply</button>
            <button type="button" className="ghost" onClick={onDismiss}>Dismiss</button>
          </span>
        </>
      ) : (
        <>
          <span>A newer pack (<strong>v{state.version}</strong>) needs a newer app version. Please update the app.</span>
          <span className="update-actions">
            <button type="button" className="ghost" onClick={onDismiss}>Dismiss</button>
          </span>
        </>
      )}
    </div>
  );
}
