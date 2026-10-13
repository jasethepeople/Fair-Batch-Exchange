import { useEffect, useState } from 'react';
import { Activity, ArrowUpRight, Clock3, Layers3, ShieldCheck } from 'lucide-react';
import type { ExchangeSnapshot } from '@workspace/api-client-react';
import { Metric, StatusTag } from './ui-pieces';

function price(value: number | null | undefined, quoteAsset: string) {
  if (value == null) return '—';
  return `${quoteAsset} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function MarketOverview({ snapshot }: { snapshot: ExchangeSnapshot }) {
  const { market, batch, stats } = snapshot;
  const [now, setNow] = useState(() => Date.now());
  const phase = batch.status.toLowerCase().replace('_', ' ');
  const seconds = batch.status === 'COLLECTING'
    ? Math.max(0, Math.ceil((new Date(batch.cutoffAt).getTime() - now) / 1000))
    : 0;
  const timeLabel = seconds >= 60
    ? `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
    : `${seconds}s`;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#d9d7c9] bg-[#fbfaf5] shadow-sm">
      <div className="console-grid relative px-5 pb-6 pt-5 sm:px-7 sm:pt-7">
        <div className="absolute right-6 top-6 hidden h-24 w-24 rounded-full border border-[#d7e0d8] sm:block">
          <div className="absolute inset-3 rounded-full border border-[#d7e0d8]" />
          <div className="absolute inset-7 rounded-full border border-[#d7e0d8]" />
          <span className="absolute -right-1 top-1/2 h-2 w-2 rounded-full bg-[#d97555]" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusTag tone={batch.status === 'COLLECTING' ? 'good' : batch.status === 'ABORTED' ? 'bad' : 'warn'}>
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
            {phase}
          </StatusTag>
          <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
            Round {String(batch.round).padStart(3, '0')}
          </span>
        </div>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              {market.baseAsset} <span className="text-[#d97555]">/</span> {market.quoteAsset}
              <span className="ml-2 text-muted-foreground/65">· {market.id}</span>
            </p>
            <div className="mt-2 flex items-baseline gap-3">
              <h1 className="font-display text-4xl font-extrabold leading-none tracking-[-0.075em] text-[#213a35] sm:text-[50px]">
                {price(market.referencePrice, market.quoteAsset)}
              </h1>
              <span className="hidden items-center gap-1 text-xs font-semibold text-[#55786a] sm:inline-flex">
                <ArrowUpRight size={13} /> Reference
              </span>
            </div>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              One price for every matched order. Orders stay sealed until the batch closes.
            </p>
          </div>
          <div className="flex gap-5 rounded-xl border border-[#deded3] bg-[#f6f5ed]/85 px-4 py-3">
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                <Clock3 size={13} />
                <span className="font-mono text-[9px] uppercase tracking-[0.12em]">Cutoff</span>
              </div>
              <p className="font-mono text-base font-medium tabular-nums text-[#213a35]">{timeLabel}</p>
            </div>
            <div className="w-px bg-[#deded3]" />
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                <Layers3 size={13} />
                <span className="font-mono text-[9px] uppercase tracking-[0.12em]">Batch</span>
              </div>
              <p className="font-mono text-base font-medium text-[#213a35]">#{batch.id.slice(-4).toUpperCase()}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-[#e5e2d8] border-t border-[#e5e2d8] sm:grid-cols-4 sm:divide-y-0">
        <div className="px-5 py-4 sm:px-6">
          <Metric label="Reference price" value={price(market.referencePrice, market.quoteAsset)} />
        </div>
        <div className="px-5 py-4 sm:px-6">
          <Metric label="Last clearing" value={price(stats.lastClearingPrice, market.quoteAsset)} detail="Uniform price" />
        </div>
        <div className="px-5 py-4 sm:px-6">
          <Metric label="Matched volume" value={batch.matchedVolume.toLocaleString()} detail={`${market.baseAsset} this batch`} />
        </div>
        <div className="px-5 py-4 sm:px-6">
          <Metric label="Batch orders" value={String(batch.submittedOrderCount)} detail={`${stats.activeOrders} active across exchange`} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e5e2d8] bg-[#f3f2e9] px-5 py-3 sm:px-7">
        <span className="inline-flex items-center gap-2 text-[11px] font-medium text-[#486458]">
          <ShieldCheck size={14} /> Protocol steps and cryptography are simulated
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
          <Activity size={12} /> No funds · no wallet · no live assets
        </span>
      </div>
    </section>
  );
}
