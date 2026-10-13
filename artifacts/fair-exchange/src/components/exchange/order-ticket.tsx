import { useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, LockKeyhole, Send } from 'lucide-react';
import { OrderInputSide, type AuctionBatch } from '@workspace/api-client-react';
import { SectionTitle, StatusTag } from './ui-pieces';

export function OrderTicket({
  batch,
  pending,
  onSubmit,
}: {
  batch: AuctionBatch;
  pending: boolean;
  onSubmit: (side: 'buy' | 'sell', quantity: number, limitPrice: number) => void;
}) {
  const [side, setSide] = useState<'buy' | 'sell'>(OrderInputSide.buy);
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [validation, setValidation] = useState('');
  const canSubmit = batch.status === 'COLLECTING' && !pending;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedQuantity = Number(quantity);
    const parsedPrice = Number(limitPrice);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setValidation('Enter a quantity and limit price greater than zero.');
      return;
    }
    setValidation('');
    onSubmit(side, parsedQuantity, parsedPrice);
  }

  return (
    <section className="rounded-2xl border border-[#d9d7c9] bg-[#fbfaf5] p-5 shadow-sm sm:p-6">
      <SectionTitle
        eyebrow="01 / Commit"
        title="Place a sealed order"
        trailing={<LockKeyhole size={17} className="text-[#577267]" aria-label="Sealed order" />}
      />
      <div className="mb-4 flex rounded-xl bg-[#efeee6] p-1">
        <button
          type="button"
          data-testid="button-side-buy"
          aria-pressed={side === 'buy'}
          onClick={() => setSide('buy')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors ${side === 'buy' ? 'bg-[#2d5c4c] text-[#f5f2e8] shadow-sm' : 'text-[#66766e] hover:text-[#213a35]'}`}
        >
          <ArrowDownLeft size={15} /> Buy
        </button>
        <button
          type="button"
          data-testid="button-side-sell"
          aria-pressed={side === 'sell'}
          onClick={() => setSide('sell')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors ${side === 'sell' ? 'bg-[#d97555] text-white shadow-sm' : 'text-[#66766e] hover:text-[#213a35]'}`}
        >
          <ArrowUpRight size={15} /> Sell
        </button>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[#354941]">
            Quantity <span className="font-mono font-normal text-muted-foreground">BASE</span>
          </span>
          <input
            data-testid="input-order-quantity"
            type="number"
            min="0.000001"
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="0.00"
            disabled={!canSubmit}
            className="h-11 w-full rounded-lg border border-[#dcdacf] bg-[#f8f7f1] px-3 font-mono text-sm text-[#213a35] outline-none transition focus:border-[#547969] focus:ring-2 focus:ring-[#2d5c4c]/10 disabled:opacity-50"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[#354941]">
            Limit price <span className="font-mono font-normal text-muted-foreground">QUOTE / BASE</span>
          </span>
          <input
            data-testid="input-order-limit-price"
            type="number"
            min="0.000001"
            step="any"
            value={limitPrice}
            onChange={(event) => setLimitPrice(event.target.value)}
            placeholder="0.00"
            disabled={!canSubmit}
            className="h-11 w-full rounded-lg border border-[#dcdacf] bg-[#f8f7f1] px-3 font-mono text-sm text-[#213a35] outline-none transition focus:border-[#547969] focus:ring-2 focus:ring-[#2d5c4c]/10 disabled:opacity-50"
            required
          />
        </label>
        {validation && <p role="alert" className="text-xs text-[#a64237]">{validation}</p>}
        <button
          data-testid="button-submit-order"
          type="submit"
          disabled={!canSubmit}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#213a35] text-sm font-semibold text-[#f7f4e9] transition hover:bg-[#2f5c4c] disabled:opacity-45"
        >
          <Send size={14} />
          {pending ? 'Submitting sealed order…' : `Submit ${side} order`}
        </button>
      </form>
      <div className="mt-4 rounded-lg border border-[#e1dfd3] bg-[#f4f3eb] p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#586960]">What the market sees</span>
          <StatusTag tone="good">Sealed</StatusTag>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Your submitted order appears as a commitment. Order details are hidden until simulated reveal.
        </p>
      </div>
      {!canSubmit && (
        <p className="mt-3 text-xs text-muted-foreground" role="status">
          New orders are disabled while this batch is {batch.status.toLowerCase()}.
        </p>
      )}
    </section>
  );
}
