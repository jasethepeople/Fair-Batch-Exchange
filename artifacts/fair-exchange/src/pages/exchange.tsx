import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  BookOpen,
  CircleDot,
  Clock3,
  Command,
  FileCheck2,
  RefreshCw,
  Shield,
  Sparkles,
} from 'lucide-react';
import {
  getGetExchangeQueryKey,
  useCancelOrder,
  useClearBatch,
  useGetExchange,
  useRunExchangeScenario,
  useSubmitOrder,
  type ScenarioInputScenario,
} from '@workspace/api-client-react';
import { MarketOverview } from '@/components/exchange/market-overview';
import { OrderTicket } from '@/components/exchange/order-ticket';
import { OrderFlow } from '@/components/exchange/order-flow';
import { CommitteePanel } from '@/components/exchange/committee-panel';
import { AuctionResult } from '@/components/exchange/auction-result';
import { ScenarioControls } from '@/components/exchange/scenario-controls';
import { AuditLog } from '@/components/exchange/audit-log';

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    if (/order window has closed/i.test(error.message)) {
      return 'The order window closed before the request reached the server. Clear this batch or reset the simulation to accept new orders.';
    }
    return error.message;
  }
  return 'The request could not be completed. Check the simulation service and try again.';
}

function LoadingConsole() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="flex h-[76px] items-center border-b border-[#dcdacf] bg-[#f7f6ef] px-5 sm:px-8">
        <div className="h-9 w-9 animate-pulse rounded-xl bg-[#dce4d9]" />
        <div className="ml-3">
          <div className="h-4 w-32 animate-pulse rounded bg-[#dce4d9]" />
          <div className="mt-2 h-2.5 w-24 animate-pulse rounded bg-[#e8e6dc]" />
        </div>
      </header>
      <main className="mx-auto grid max-w-[1440px] gap-5 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="h-[270px] animate-pulse rounded-2xl bg-[#e9e8de]" />
          <div className="h-[370px] animate-pulse rounded-2xl bg-[#e9e8de]" />
        </div>
        <div className="space-y-5">
          <div className="h-[285px] animate-pulse rounded-2xl bg-[#e9e8de]" />
          <div className="h-[260px] animate-pulse rounded-2xl bg-[#e9e8de]" />
        </div>
      </main>
      <p className="sr-only" role="status">Loading exchange simulation</p>
    </div>
  );
}

function ErrorConsole({ onRetry, message }: { onRetry: () => void; message: string }) {
  return (
    <main className="console-grid flex min-h-[100dvh] items-center justify-center bg-background px-5 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-[#dfc9bc] bg-[#fbfaf5] p-7 text-center shadow-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f5e9df] text-[#a9573e]">
          <Activity size={20} />
        </span>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Connection interrupted</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-[-0.05em] text-[#213a35]">The simulation is not responding</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{message}</p>
        <button
          data-testid="button-retry-exchange"
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-[#213a35] px-4 text-sm font-semibold text-[#f7f4e9] hover:bg-[#315d4d]"
        >
          <RefreshCw size={14} /> Retry connection
        </button>
      </section>
    </main>
  );
}

export default function ExchangePage() {
  const queryClient = useQueryClient();
  const exchangeQuery = useGetExchange();
  const submitOrder = useSubmitOrder();
  const clearBatch = useClearBatch();
  const runScenario = useRunExchangeScenario();
  const cancelOrder = useCancelOrder();
  const [notice, setNotice] = useState('');
  const [activeScenario, setActiveScenario] = useState<ScenarioInputScenario>();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  async function refreshExchange() {
    await queryClient.invalidateQueries({ queryKey: getGetExchangeQueryKey() });
  }

  if (exchangeQuery.isLoading) return <LoadingConsole />;
  if (exchangeQuery.isError || !exchangeQuery.data) {
    return <ErrorConsole onRetry={() => void exchangeQuery.refetch()} message={errorMessage(exchangeQuery.error)} />;
  }

  const snapshot = exchangeQuery.data;
  const secondsToCutoff = snapshot.batch.status === 'COLLECTING'
    ? Math.max(0, Math.ceil((new Date(snapshot.batch.cutoffAt).getTime() - now) / 1000))
    : 0;
  const orderWindowOpen = snapshot.batch.status === 'COLLECTING' && secondsToCutoff > 0;
  const isPending = submitOrder.isPending || clearBatch.isPending || runScenario.isPending || cancelOrder.isPending;
  const mutationError = submitOrder.error || clearBatch.error || runScenario.error || cancelOrder.error;

  function mutationSuccess(message: string) {
    setNotice(message);
    void refreshExchange();
  }

  function handleSubmit(side: 'buy' | 'sell', quantity: number, limitPrice: number) {
    setNotice('');
    submitOrder.mutate(
      { data: { side, quantity, limitPrice } },
      { onSuccess: () => mutationSuccess('Order committed. Its contents remain sealed until batch reveal.') },
    );
  }

  function handleClear() {
    setNotice('');
    clearBatch.mutate(
      { batchId: snapshot.batch.id },
      { onSuccess: () => mutationSuccess('Batch reveal and simulated McAfee clearing completed.') },
    );
  }

  function handleScenario(scenario: ScenarioInputScenario) {
    setNotice('');
    setActiveScenario(scenario);
    runScenario.mutate(
      { data: { scenario } },
      {
        onSuccess: () => {
          mutationSuccess(`Scenario applied: ${scenario.replace('-', ' ')}.`);
          setActiveScenario(undefined);
        },
        onError: () => setActiveScenario(undefined),
      },
    );
  }

  function handleCancel(orderId: string) {
    setNotice('');
    cancelOrder.mutate(
      { orderId },
      { onSuccess: () => mutationSuccess('Sealed order canceled before the batch cutoff.') },
    );
  }

  const navItems = [
    { label: 'Market desk', href: '#market', icon: Activity },
    { label: 'Order queue', href: '#orders', icon: BookOpen },
    { label: 'Committee', href: '#committee', icon: Shield },
    { label: 'Audit trail', href: '#audit', icon: FileCheck2 },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#f2f1e9] text-[#213a35]">
      <header className="sticky top-0 z-30 flex min-h-[72px] items-center justify-between border-b border-[#dedbcf] bg-[#f7f6ef]/95 px-4 backdrop-blur-md sm:px-7">
        <a href="#market" className="flex items-center gap-3" data-testid="link-brand-home">
          <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-[#213a35] text-[#edf0df]">
            <span className="absolute left-[9px] top-[10px] h-4 w-4 rounded-tl-lg border-l-2 border-t-2 border-[#d97555]" />
            <span className="absolute bottom-[9px] right-[9px] h-4 w-4 rounded-br-lg border-b-2 border-r-2 border-[#8da996]" />
            <Command size={14} className="relative" />
          </span>
          <span>
            <span className="block font-display text-[16px] font-extrabold leading-tight tracking-[-0.055em]">Fair Exchange</span>
            <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.15em] text-[#708078]">Batch auction desk</span>
          </span>
        </a>
        <nav aria-label="Console sections" className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}
                key={item.label}
                href={item.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#64756c] transition hover:bg-[#eae9df] hover:text-[#243f35]"
              >
                <Icon size={13} /> {item.label}
              </a>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-[#d8ddce] bg-[#edf1e7] px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#53705b] sm:inline-flex">
            <CircleDot size={10} className="text-[#719477]" /> {snapshot.simulationOnly ? 'Simulation only' : 'Demo API state'}
          </span>
          <button
            data-testid="button-refresh-exchange"
            type="button"
            aria-label="Refresh exchange state"
            onClick={() => void exchangeQuery.refetch()}
            disabled={exchangeQuery.isFetching || isPending}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#dedbcf] bg-[#fbfaf5] text-[#4f665b] transition hover:bg-[#eeede4] disabled:opacity-50"
          >
            <RefreshCw size={14} className={exchangeQuery.isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1512px] lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden min-h-[calc(100dvh-72px)] border-r border-[#dfddd2] bg-[#efeee6] px-4 py-6 lg:block">
          <div className="px-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#899188]">Exchange</p>
            <p className="mt-1 text-xs font-semibold text-[#43584d]">Simulated markets</p>
          </div>
          <div className="mt-5 rounded-xl border border-[#d8d8cb] bg-[#f8f7f0] p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#7a857b]">Active desk</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#759b78]" />
            </div>
            <p className="mt-2 font-display text-sm font-bold tracking-[-0.03em]">{snapshot.market.baseAsset} / {snapshot.market.quoteAsset}</p>
            <p className="mt-1 font-mono text-[10px] text-[#728077]">Round {String(snapshot.batch.round).padStart(3, '0')}</p>
          </div>
          <nav aria-label="Exchange desk" className="mt-5 space-y-1">
            {navItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  href={item.href}
                  data-testid={`link-sidebar-${item.label.toLowerCase().replaceAll(' ', '-')}`}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${index === 0 ? 'bg-[#dfe8dc] text-[#315541]' : 'text-[#718077] hover:bg-[#e7e6dd] hover:text-[#354c3f]'}`}
                >
                  <Icon size={14} />
                  {item.label}
                  {item.label === 'Order queue' && <span className="ml-auto font-mono text-[9px] text-[#78877d]">{snapshot.batch.submittedOrderCount}</span>}
                </a>
              );
            })}
          </nav>
          <div className="mt-8 border-t border-[#dbd9cf] pt-5">
            <p className="px-3 font-mono text-[9px] uppercase tracking-[0.16em] text-[#899188]">Protocol sequence</p>
            <ol className="mt-3 space-y-3 px-3">
              <li className="flex items-start gap-2.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#dce9dd] font-mono text-[9px] text-[#42684e]">01</span>
                <span className="pt-0.5 text-[10px] leading-relaxed text-[#607268]">Commit sealed orders</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[9px] ${snapshot.committee.quorumReached ? 'bg-[#dce9dd] text-[#42684e]' : 'bg-[#e7e5dc] text-[#737e74]'}`}>02</span>
                <span className="pt-0.5 text-[10px] leading-relaxed text-[#607268]">Reach share threshold</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[9px] ${snapshot.batch.status === 'SETTLED' ? 'bg-[#dce9dd] text-[#42684e]' : 'bg-[#e7e5dc] text-[#737e74]'}`}>03</span>
                <span className="pt-0.5 text-[10px] leading-relaxed text-[#607268]">Reveal and apply McAfee rule</span>
              </li>
            </ol>
          </div>
          <div className="mt-8 rounded-xl bg-[#213a35] p-3.5 text-[#e6eee3]">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-[#d97555]" />
              <p className="font-mono text-[9px] uppercase tracking-[0.12em]">Fairness by design</p>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[#bdcbbd]">
              The simulator makes trust assumptions visible. It is not a production exchange.
            </p>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-5 sm:px-7 sm:py-7 lg:px-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 enter-up">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#7d897f]">Exchange console / Live simulation</p>
              <h1 className="mt-1 font-display text-[26px] font-extrabold leading-tight tracking-[-0.06em] text-[#213a35] sm:text-[30px]">
                Trading without the race
              </h1>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#dcdacf] bg-[#f8f7f1] px-3 py-2">
              <Clock3 size={13} className="text-[#74857a]" />
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#66766e]">Batch-based · non-custodial concept</span>
            </div>
          </div>

          {notice && (
            <div data-testid="status-mutation-success" role="status" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#cfe0d1] bg-[#edf4eb] px-4 py-3 text-xs font-medium text-[#38674c] enter-up">
              <span>{notice}</span>
              <button data-testid="button-dismiss-success" type="button" aria-label="Dismiss success message" onClick={() => setNotice('')} className="text-[#54745b] hover:text-[#213a35]">Dismiss</button>
            </div>
          )}
          {mutationError && (
            <div data-testid="status-mutation-error" role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-[#e6c7bd] bg-[#f8eae5] px-4 py-3 text-xs text-[#944939]">
              <span>{errorMessage(mutationError)}</span>
              <button data-testid="button-dismiss-error" type="button" onClick={() => { submitOrder.reset(); clearBatch.reset(); runScenario.reset(); cancelOrder.reset(); }} className="shrink-0 font-semibold underline underline-offset-2">
                Dismiss
              </button>
            </div>
          )}

          <div id="market" className="enter-up">
            <MarketOverview snapshot={snapshot} secondsToCutoff={secondsToCutoff} />
          </div>
          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_352px]">
            <div className="min-w-0 space-y-5">
              <div id="orders" className="grid items-start gap-5 md:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)]">
                <div className="enter-up enter-delay-1">
                  <OrderTicket
                    batch={snapshot.batch}
                    orderWindowOpen={orderWindowOpen}
                    pending={submitOrder.isPending}
                    onSubmit={handleSubmit}
                  />
                </div>
                <div className="enter-up enter-delay-2">
                  <OrderFlow
                    orders={snapshot.orders}
                    batch={snapshot.batch}
                    orderWindowOpen={orderWindowOpen}
                    market={snapshot.market}
                    onCancel={handleCancel}
                    cancellingOrderId={cancelOrder.isPending ? cancelOrder.variables?.orderId : undefined}
                  />
                </div>
              </div>
              <div id="audit" className="enter-up enter-delay-3">
                <AuditLog events={snapshot.auditEvents} />
              </div>
            </div>
            <div className="space-y-5">
              <div className="enter-up enter-delay-1">
                <AuctionResult
                  batch={snapshot.batch}
                  market={snapshot.market}
                  pending={clearBatch.isPending}
                  onClear={handleClear}
                />
              </div>
              <div id="committee" className="enter-up enter-delay-2">
                <CommitteePanel committee={snapshot.committee} />
              </div>
              <div className="enter-up enter-delay-3">
                <ScenarioControls
                  pending={runScenario.isPending}
                  activeScenario={activeScenario}
                  batchStatus={snapshot.batch.status}
                  onRun={handleScenario}
                />
              </div>
            </div>
          </div>
          <footer className="mt-7 flex flex-col gap-2 border-t border-[#dedbcf] py-4 text-[10px] text-[#77837a] sm:flex-row sm:items-center sm:justify-between">
            <p>This browser demo runs through a centralized simulation API; the target protocol excludes privileged operator keys.</p>
            <p className="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.09em]">
              <Shield size={11} /> Simulated protocol · no real funds or assets
            </p>
          </footer>
        </main>
      </div>
      <a
        href="#market"
        data-testid="link-back-to-market"
        aria-label="Back to market overview"
        className="fixed bottom-5 right-5 z-20 grid h-11 w-11 place-items-center rounded-full bg-[#d97555] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#c76647] lg:hidden"
      >
        <ArrowRight size={16} className="-rotate-90" />
      </a>
    </div>
  );
}
