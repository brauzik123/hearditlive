import { useLayoutEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useI18n } from '../../../i18n/client';

// Small building blocks shared by the log form sections.

export function EntryTypeToggle({ value, onChange }) {
  const { t } = useI18n();
  return (
    <div role="radiogroup" className="flex rounded-full border border-border bg-surface p-1">
      {[
        { id: 'attended', label: t('log.went') },
        { id: 'planned', label: t('log.going') },
      ].map((opt) => (
        <button
          key={opt.id}
          role="radio"
          aria-checked={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={`flex-1 rounded-full py-2 text-sm font-bold transition ${
            value === opt.id ? 'bg-brand text-brand-foreground' : 'text-muted hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function StepProgress({ steps, current }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => (
        <div key={label} className="flex flex-1 flex-col gap-1">
          <div className={`h-1.5 rounded-full ${i <= current ? 'bg-brand' : 'bg-surface-light'}`} />
          <span className={`text-[10px] ${i === current ? 'text-foreground' : 'text-muted'}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="marquee text-3xl">{title}</h2>
      {children}
    </section>
  );
}

export function Field({ label, icon: Icon, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="flex items-center gap-1.5 text-muted">
        {Icon && <Icon size={14} />} {label}
      </span>
      {children}
    </label>
  );
}

// Textarea that grows with its content instead of scrolling inside itself.
export function AutoGrowTextarea({ value, onChange, className = '', minRows = 2, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={onChange}
      className={`field resize-none overflow-hidden ${className}`}
      {...props}
    />
  );
}

export function PhotoPicker({ onPick, multiple = false, disabled, className, children }) {
  const inputRef = useRef(null);
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className={`${className} disabled:opacity-50`}>
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onPick(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}

export function ChipInput({ items, onAdd, onRemove, placeholder, icon: Icon }) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const submit = () => {
    const v = value.trim();
    if (v) {
      onAdd(v);
      setValue('');
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          className="field"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          onClick={submit}
          aria-label={t('common.add')}
          className="rounded-lg border border-border bg-surface-light px-3 transition hover:border-brand"
        >
          <Plus size={16} />
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="flex items-center gap-1.5 rounded-full border border-border bg-surface-light px-3 py-1 text-xs">
              {Icon && <Icon size={12} />} {item}
              <button onClick={() => onRemove(item)} aria-label={t('common.remove')} className="text-muted hover:text-foreground">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Suggestion list under an input; closes on pick or outside tap.
export function Suggestions({ items, onPick, render }) {
  if (!items.length) return null;
  return (
    <ul className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)]">
      {items.map((item, i) => (
        <li key={i}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item)}
            className="w-full px-3 py-2.5 text-left text-sm hover:bg-surface-light"
          >
            {render(item)}
          </button>
        </li>
      ))}
    </ul>
  );
}
