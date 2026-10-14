import { ArrowRight, Scale, Sparkles } from 'lucide-react';
import type { AuctionBatch, Market } from '@workspace/api-client-react';
import { StatusTag } from './ui-pieces';

function formatPrice(value: number | null, quote: string, settled: boolean, aborted: boolean) {
  if (value !== null) {
    return `${quote} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
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
  const ruleLabel = batch.clearingRule === 'trade-reduction'
    ? 'Trade-reduction branch'
    : batch.clearingRule === 'uniform'
      ? 'Uniform-price branch'
      : settled
        ? 'No crossing trade'
        : 'McAfee double auction';
  const ruleTone = batch.clearingRule === 'trade-reduction' ? 'accent' : 'neutral';

  return (
    <section className="overflow-hidden rounded-2xl border border-[#2f5548] bg-[#213a35] text-[#f5f1e6] shadow-sm">
      <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#afc0b4]">
            03 / Reveal & {batch.clearingRule === 'trade-reduction' ? 'trade reduction' : 'match'}
          </p>
          <h2 className="font-display text-lg font-bold tracking-[-0.04em] text-[#f7f3e7]">
            McAfee result
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <Scale size={17} className="text-[#bdcbbd]" />
          <StatusTag tone={settled ? 'good' : aborted ? 'bad' : ruleTone}>
            {settled ? 'Settled' : aborted ? 'Aborted' : 'Awaiting reveal'}
          </StatusTag>
        </div>
      </div>
      <p className="px-5 pb-3 font-mono text-[9px] uppercase tracking-[0.1em] text-[#afc0b4] sm:px-6">
        {ruleLabel}
      </p>
      <div className="mx-5 rounded-xl border border-white/10 bg-white/[0.055] p-4 sm:mx-6 sm:p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#afc0b4]">Buyer pays</p>
            <p data-testid="text-buyer-price" className="mt-2 break-words font-display text-xl font-extrabold tracking-[-0.05em] text-[#f7f3e7] sm:text-2xl">
              {formatPrice(batch.buyerPrice, market.quoteAsset, settled, aborted)}
            </p>
          </div>
          <div className="min-w-0 border-l border-white/10 pl-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#afc0b4]">Seller receives</p>
            <p data-testid="text-seller-price" className="mt-2 break-words font-display text-xl font-extrabold tracking-[-0.05em] text-[#f7f3e7] sm:text-2xl">
              {formatPrice(batch.sellerPrice, market.quoteAsset, settled, aborted)}
            </p>
          </div>
        </div>
        <div className="my-4 flex items-center gap-2 text-[10px] text-[#bdcbbd]">
          <span className="h-px flex-1 bg-white/10" />
          <span className="inline-flex items-center gap-1.5"><Sparkles size={12} /> one price or McAfee trade reduction</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#afc0b4]">Matched volume</p>
          <p data-testid="text-matched-volume" className="font-mono text-base font-medium tabular-nums text-[#f7f3e7]">
            {batch.matchedVolume.toLocaleString()} <span className="text-xs text-[#b7c7ba]">{market.baseAsset}</span>
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#afc0b4]">Mechanism surplus</p>
          <p className="font-mono text-xs tabular-nums text-[#d7e1d6]">
            {market.quoteAsset} {batch.mechanismSurplus.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
          </p>
        </div>
        <p className="text-xs leading-relaxed text-[#bdcbbd]">
          {batch.outcome || (settled
            ? 'The batch settled using the displayed McAfee price branch.'
            : aborted
              ? 'The batch did not settle. No orders were matched.'
              : 'Reveal and McAfee matching are available once the simulated committee quorum is reached.')}
        </p>
        <p className="mt-3 border-t border-white/10 pt-3 text-[10px] leading-relaxed text-[#d1d9ce]">
          McAfee’s classic truthfulness guarantee is for single-unit traders. This demo accepts divisible quantities and does not establish strategy-proof behavior.
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
            {pending ? 'Running simulated auction…' : 'Reveal & run McAfee auction'}
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
