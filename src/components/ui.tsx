import { useId, useRef, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import type { IconName, Visibility } from '../types';
import { Icon } from './Icon';
import { Link } from '../app/router';

type Variant = 'primary' | 'ghost' | 'danger' | 'default';
const cls = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ');

export function Button({ variant = 'default', size, icon, loading, block, className, children, disabled, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm'; icon?: IconName; loading?: boolean; block?: boolean }) {
  return (
    <button className={cls('btn', variant !== 'default' && `btn-${variant}`, size && `btn-${size}`, block && 'btn-block', className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="spinner" aria-hidden="true" /> : icon && <Icon name={icon} />}
      {children}
    </button>
  );
}
export function LinkButton({ to, variant = 'default', size, icon, block, children, className }:
  { to: string; variant?: Variant; size?: 'sm'; icon?: IconName; block?: boolean; children: ReactNode; className?: string }) {
  return <Link to={to} className={cls('btn', variant !== 'default' && `btn-${variant}`, size && `btn-${size}`, block && 'btn-block', className)}>{icon && <Icon name={icon} />}{children}</Link>;
}

export function Panel({ title, icon, actions, children, quiet, className, id }: { title?: string; icon?: IconName; actions?: ReactNode; children: ReactNode; quiet?: boolean; className?: string; id?: string }) {
  return (
    <section className={cls('panel', quiet && 'panel-quiet', className)} id={id}>
      {(title || actions) && (
        <div className="panel-head">
          {title && <h2 className="panel-title">{icon && <Icon name={icon} />}{title}</h2>}
          {actions && <div className="row" style={{ marginLeft: 'auto' }}>{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export const DemoBadge = ({ text = 'Dados fictícios' }: { text?: string }) => <span className="badge badge-demo"><Icon name="info" />{text}</span>;
export const Badge = ({ tone, children }: { tone?: 'ok' | 'bad' | 'accent'; children: ReactNode }) => <span className={cls('badge', tone && `badge-${tone}`)}>{children}</span>;

const VIS: Record<Visibility, { label: string; icon: IconName }> = {
  publico: { label: 'Público', icon: 'eye' },
  jogadores: { label: 'Visível aos jogadores', icon: 'users' },
  mestre: { label: 'Privado do mestre', icon: 'lock' },
};
export const VisTag = ({ v }: { v: Visibility }) => <span className={`vis vis-${v}`}><Icon name={VIS[v].icon} />{VIS[v].label}</span>;

export function Meter({ label, now, max, kind, small }: { label: string; now: number; max: number; kind: 'pv' | 'alma'; small?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (now / max) * 100)) : 0;
  return (
    <div className={cls('meter', `meter-${kind}`, small && 'meter-sm')}>
      <div className="meter-top"><span>{label}</span><b>{now}<span className="muted"> / {max}</span></b></div>
      <div className="meter-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={now}><div className="meter-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function Alert({ tone = 'info', icon, children }: { tone?: 'info' | 'warn' | 'bad' | 'ok'; icon?: IconName; children: ReactNode }) {
  const def: IconName = tone === 'bad' ? 'alert' : tone === 'ok' ? 'check' : tone === 'warn' ? 'alert' : 'info';
  return <div className={`alert alert-${tone}`} role={tone === 'bad' ? 'alert' : 'status'}><Icon name={icon ?? def} /><div>{children}</div></div>;
}

export function EmptyState({ icon = 'mask', title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty"><Icon name={icon} /><h3>{title}</h3>{children && <p style={{ margin: 0, maxWidth: '46ch' }}>{children}</p>}{action}</div>;
}

export function PageHead({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-head fade-in">
      <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{children && <p>{children}</p>}</div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      <div className="field-msg">{error ? <div className="field-error" id={`${htmlFor}-err`}><Icon name="alert" />{error}</div> : hint ? <div className="hint" id={`${htmlFor}-hint`}>{hint}</div> : null}</div>
    </div>
  );
}

export function Switch({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="switch">
      <div><div id={id}>{label}</div>{desc && <div className="hint">{desc}</div>}</div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} onClick={() => onChange(!checked)} />
    </div>
  );
}

export function Seg<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[]; label: string }) {
  return <div className="seg" role="group" aria-label={label}>{items.map((i) => <button key={i.id} type="button" aria-pressed={value === i.id} onClick={() => onChange(i.id)}>{i.label}</button>)}</div>;
}

export function Tabs<T extends string>({ items, value, onChange, label }: { items: { id: T; label: string; icon?: IconName }[]; value: T; onChange: (v: T) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent) => {
    const tabs = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []);
    const focused = tabs.indexOf(document.activeElement as HTMLElement);
    const i = focused >= 0 ? focused : items.findIndex((t) => t.id === value); // as setas partem da aba focada
    const next = e.key === 'ArrowRight' ? (i + 1) % items.length : e.key === 'ArrowLeft' ? (i - 1 + items.length) % items.length : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault(); onChange(items[next].id);
    requestAnimationFrame(() => ref.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus());
  };
  return (
    <div className="tabs" role="tablist" aria-label={label} ref={ref} onKeyDown={onKey}>
      {items.map((t) => (
        <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={value === t.id} aria-controls={`panel-${t.id}`} tabIndex={value === t.id ? 0 : -1} className="tab" onClick={() => onChange(t.id)}>
          {t.icon && <Icon name={t.icon} />}{t.label}
        </button>
      ))}
    </div>
  );
}
export const TabPanel = ({ id, children }: { id: string; children: ReactNode }) => <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="fade-in" tabIndex={0}>{children}</div>;
