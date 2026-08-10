'use client';

import { useState } from 'react';

// 标签输入（师傅技能等）：回车或失焦添加，点击 × 移除
export function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  const remove = (t: string) => onChange(value.filter((x) => x !== t));

  return (
    <div>
      {value.length > 0 && (
        <div className="tag-box">
          {value.map((t) => (
            <span key={t} className="tag">
              {t}
              <button type="button" onClick={() => remove(t)} aria-label="移除">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className="input"
        value={draft}
        placeholder={placeholder ?? '输入后回车添加'}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}
