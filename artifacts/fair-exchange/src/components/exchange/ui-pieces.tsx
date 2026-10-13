import { type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, CircleHelp } from 'lucide-react';

export function SectionTitle({
  eyebrow,
  title,
  trailing,
}: {
  eyebrow?: string;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display text-[19px] font-bold tracking-[-0.04em] text-foreground">
          {title}
        </h2>
      </div>
      {trailing}
    </div>
  );
}

export function StatusTag({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent';
}) {
  const tones = {
    neutral: 'bg-muted text-muted-foreground',
    good: 'bg-[#e5f0e8] text-[#286246]',
    warn: 'bg-[#f8edda] text-[#8d5c18]',
    bad: 'bg-[#f7e7e4] text-[#9d4036]',
    accent: 'bg-[#f8e8df] text-[#a44f34]',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Metric({
  label,
  value,
  detail,
  direction,
}: {
  label: string;
  value: string;
  detail?: string;
  direction?: 'up' | 'down';
}) {
  const DirectionIcon = direction === 'up' ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="min-w-0">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-[25px] font-bold leading-none tracking-[-0.055em] text-foreground">
          {value}
        </span>
        {direction && <DirectionIcon aria-hidden="true" size={14} className="text-primary" />}
      </div>
      {detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

export function InfoHint({ children }: { children: ReactNode }) {
  return (
    <span className="group relative inline-flex items-center">
      <CircleHelp size={14} className="text-muted-foreground" aria-hidden="true" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg bg-[#213a35] p-3 text-xs leading-relaxed text-[#f4f0e8] opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {children}
      </span>
    </span>
  );
}
