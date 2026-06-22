interface Props {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}

export function ListEditor({ label, items, onChange, placeholder }: Props) {
  const update = (i: number, value: string) =>
    onChange(items.map((item, idx) => (idx === i ? value : item)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, '']);

  return (
    <div className="list-editor">
      {items.map((item, i) => (
        <div className="list-row" key={i}>
          <input
            value={item}
            placeholder={placeholder}
            onChange={(e) => update(i, e.target.value)}
          />
          <button type="button" aria-label={`Remove ${label} item`} onClick={() => remove(i)}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="add-btn" onClick={add}>
        + Add {label}
      </button>
    </div>
  );
}
