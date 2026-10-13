import { ArrowRight, Scale, Sparkles } from 'lucide-react';
import type { AuctionBatch, Market } from '@workspace/api-client-react';
import { SectionTitle, StatusTag } from './ui-pieces';

function formatPrice(value: number | null, quote: string, settled: boolean, aborted: boolean) {
  if (value !== null) {
    return `${quote} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (aborted) return 'Not settled';
  return settled ? 'No trade' : 'Pending reveal';
}

export function AuctionResult({
  batch,
  market,
  pending,
  onClear,
}: {
  batch: AuctionBatch;
  market: Market;
  pending: boolean;
  onClear: () => void;
}) {
  const settled = batch.status === 'SETTLED';
  const aborted = batch.status === 'ABORTED';
  const canClear = batch.status === 'COLLECTING' && batch.quorumReached && batch.submittedOrderCount > 0 && !pending;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#2f5548] bg-[#213a35] text-[#f5f1e6] shadow-sm">
      <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
        <SectionTitle
          eyebrow="03 / Reveal & match"
          title="Uniform-price result"
          trailing={<Scale size={17} className="text-[#bdcbbd]" />}
        />
        <StatusTag tone={settled ? 'good' : aborted ? 'bad' : 'neutral'}>
          {settled ? 'Settled' : aborted ? 'Aborted' : 'Awaiting reveal'}
        </StatusTag>
      </div>
      <div className="mx-5 rounded-xl border border-white/10 bg-white/[0.055] p-4 sm:mx-6 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#afc0b4]">Clearing price</p>
            <p className="mt-2 font-display text-3xl font-extrabold tracking-[-0.06em] text-[#f7f3e7] sm:text-4xl">
              {formatPrice(batch.clearingPrice, market.quoteAsset, settled, aborted)}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#afc0b4]">Matched volume</p>
            <p className="mt-2 font-mono text-xl font-medium tabular-nums text-[#f7f3e7]">
              {batch.matchedVolume.toLocaleString()} <span className="text-xs text-[#b7c7ba]">{market.baseAsset}</span>
            </p>
          </div>
        </div>
        <div className="my-4 flex items-center gap-2 text-[10px] text-[#bdcbbd]">
          <span className="h-px flex-1 bg-white/10" />
          <span className="inline-flex items-center gap-1.5"><Sparkles size={12} /> one price for all matched orders</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <p className="text-xs leading-relaxed text-[#bdcbbd]">
          {batch.outcome || (settled
            ? 'Orders were matched at the same simulated clearing price.'
            : aborted
              ? 'The batch did not settle. No orders were matched.'
              : 'Reveal and matching are available once the simulated committee quorum is reached.')}
        </p>
      </div>
      {!settled && !aborted && (
        <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          <button
            data-testid="button-clear-batch"
            type="button"
            disabled={!canClear}
            onClick={onClear}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#d97555] px-4 text-sm font-bold text-white transition hover:bg-[#e18464] disabled:bg-[#536b60] disabled:text-[#c4cec4] disabled:opacity-70"
          >
            {pending ? 'Running simulated auction…' : 'Reveal & clear batch'}
            {!pending && <ArrowRight size={15} />}
          </button>
          {!canClear && (
            <p className="mt-2 text-center text-[10px] text-[#b6c2b6]">
              {batch.status !== 'COLLECTING'
                ? 'This batch is no longer collecting orders.'
                : !batch.quorumReached
                  ? 'Quorum is required before simulated reveal.'
                  : 'At least one submitted order is needed to clear.'}
            </p>
          )}
        </div>
      )}
      {(settled || aborted) && (
        <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
          <p className="text-center text-[10px] leading-relaxed text-[#c1cbc1]">
            Result reflects API simulation output only. Cryptography, matching, and protocol security are not production implementations.
          </p>
        </div>
      )}
    </section>
  );
}
