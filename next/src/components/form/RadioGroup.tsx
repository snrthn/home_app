'use client';

export interface RadioOption {
  label: string;
  value: string;
}

// 单选胶囊组（性别等），统一视觉
export function RadioGroup({
  value,
  options,
  onChange,
}: {
  value: string;
  options: RadioOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="radio-group">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          className={`radio-pill ${value === o.value ? 'radio-pill-active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
