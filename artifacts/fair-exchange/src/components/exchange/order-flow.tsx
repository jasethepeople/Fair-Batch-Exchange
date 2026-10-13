import { useState } from 'react';
import { Eye, EyeOff, Fingerprint, X } from 'lucide-react';
import type { AuctionBatch, Market, Order } from '@workspace/api-client-react';
import { SectionTitle, StatusTag } from './ui-pieces';

function formatPrice(value: number | null, quoteAsset: string) {
  if (value === null) return '—';
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${quoteAsset}`;
}

function shortCommitment(value: string) {
  if (value.length <= 23) return value;
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function toneForStatus(status: string): 'good' | 'warn' | 'bad' | 'neutral' | 'accent' {
  if (status === 'FILLED') return 'good';
  if (status === 'PARTIALLY_FILLED') return 'warn';
  if (status === 'ABORTED' || status === 'CANCELLED') return 'bad';
  if (status === 'SEALED') return 'accent';
  return 'neutral';
}

export function OrderFlow({
  orders,
  batch,
  market,
  onCancel,
  cancellingOrderId,
}: {
  orders: Order[];
  batch: AuctionBatch;
  market: Market;
  onCancel: (orderId: string) => void;
  cancellingOrderId?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const revealed = batch.status === 'SETTLED';
  const aborted = batch.status === 'ABORTED';
  const displayed = showAll ? orders : orders.slice(0, 7);

  return (
    <section className="rounded-2xl border border-[#d9d7c9] bg-[#fbfaf5] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <SectionTitle
          eyebrow="Order flow / Batch"
          title="Sealed order queue"
          trailing={undefined}
        />
        <button
          data-testid="button-toggle-order-visibility"
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="mb-4 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium text-[#526a5e] hover:bg-[#efeee6]"
        >
          {showAll ? <EyeOff size={13} /> : <Eye size={13} />}
          {showAll ? 'Show fewer' : 'View all'}
        </button>
      </div>
      <div className="border-t border-[#e8e5db]">
        <div className="hidden grid-cols-[minmax(0,1.2fr)_0.65fr_0.75fr_1fr_auto] gap-3 bg-[#f4f3eb] px-6 py-2.5 font-mono text-[9px] uppercase tracking-[0.11em] text-muted-foreground sm:grid">
          <span>Participant / commitment</span>
          <span>Side</span>
          <span>Quantity</span>
          <span>Limit price</span>
          <span>State</span>
        </div>
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-[#edf0e9] text-[#547164]">
              <Fingerprint size={18} />
            </div>
            <p className="text-sm font-semibold text-[#31483e]">No orders committed yet</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
              New commitments will appear here without revealing their contents.
            </p>
          </div>
        ) : (
          <div>
            {displayed.map((order) => {
              const hidden = order.side === null || order.quantity === null || order.limitPrice === null;
              const canCancel = order.isMine && order.status === 'SEALED' && batch.status === 'COLLECTING';

              return (
                <div
                  key={order.id}
                  data-testid={`row-order-${order.id}`}
                  className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[#eeece4] px-5 py-3.5 first:border-t-0 sm:grid-cols-[minmax(0,1.2fr)_0.65fr_0.75fr_1fr_auto] sm:items-center sm:gap-3 sm:px-6"
                >
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[9px] font-medium ${order.isMine ? 'bg-[#dce9df] text-[#315b45]' : 'bg-[#ebe8dc] text-[#756f5e]'}`}>
                        {order.ownerLabel.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[#31463d]">
                          {order.ownerLabel}
                          {order.isMine && <span className="ml-1.5 font-mono text-[9px] uppercase tracking-wider text-[#708078]">you</span>}
                        </p>
                        <p className="truncate font-mono text-[9px] text-muted-foreground" title={order.commitment}>
                          {shortCommitment(order.commitment)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:block">
                    <span className="w-16 text-[9px] uppercase tracking-wider text-muted-foreground sm:hidden">Side</span>
                    {hidden ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <EyeOff size={12} /> Hidden
                      </span>
                    ) : (
                      <span className={`text-xs font-semibold uppercase ${order.side === 'buy' ? 'text-[#337354]' : 'text-[#b85c3e]'}`}>{order.side}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:block">
                    <span className="w-16 text-[9px] uppercase tracking-wider text-muted-foreground sm:hidden">Size</span>
                    <span className="font-mono text-xs text-[#33483f]">{hidden ? '••••' : `${order.quantity} ${market.baseAsset}`}</span>
                  </div>
                  <div className="flex items-center gap-2 sm:block">
                    <span className="w-16 text-[9px] uppercase tracking-wider text-muted-foreground sm:hidden">Limit</span>
                    <span className="font-mono text-xs text-[#33483f]">{formatPrice(order.limitPrice, market.quoteAsset)}</span>
                  </div>
                  <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:justify-end">
                    <StatusTag tone={toneForStatus(order.status)}>{order.status.replace('_', ' ')}</StatusTag>
                    {canCancel && (
                      <button
                        data-testid={`button-cancel-order-${order.id}`}
                        type="button"
                        disabled={cancellingOrderId === order.id}
                        onClick={() => {
                          if (window.confirm('Cancel this sealed order before the batch cutoff?')) onCancel(order.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-[#9c4b3d] hover:bg-[#f6e9e4] disabled:opacity-40"
                        aria-label={`Cancel order ${order.id}`}
                      >
                        <X size={12} /> {cancellingOrderId === order.id ? 'Canceling' : 'Cancel'}
                      </button>
                    )}
                  </div>
                  {order.privacyNote && (
                    <p className="col-span-2 flex items-center gap-1.5 text-[10px] text-muted-foreground sm:hidden">
                      <EyeOff size={10} /> {order.privacyNote}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex items-start gap-2 border-t border-[#e8e5db] bg-[#f6f5ef] px-5 py-3.5 sm:px-6">
        <Fingerprint size={14} className="mt-0.5 shrink-0 text-[#547164]" />
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          {revealed
            ? 'Batch reveal is simulated. Commitment and order details are displayed from API state; no real encryption is used.'
            : aborted
              ? 'The batch aborted without reveal. Order terms remain hidden; commitments are demo identifiers, not cryptographic guarantees.'
              : 'Order contents remain hidden in the API response until reveal. Commitments are demo identifiers, not cryptographic guarantees.'}
        </p>
      </div>
    </section>
  );
}
