import { AlertTriangle, RotateCcw, Siren } from 'lucide-react';
import type { AuctionBatchStatus, ScenarioInputScenario } from '@workspace/api-client-react';
import { SectionTitle } from './ui-pieces';

const scenarios: Array<{
  id: ScenarioInputScenario;
  title: string;
  description: string;
  icon: typeof AlertTriangle;
  danger?: boolean;
}> = [
  {
    id: 'quorum-failure',
    title: 'Quorum failure',
    description: 'Too few committee shares to reveal.',
    icon: AlertTriangle,
  },
  {
    id: 'decryption-timeout',
    title: 'Reveal timeout',
    description: 'Simulate a decryption deadline miss.',
    icon: Siren,
  },
  {
    id: 'invalid-order',
    title: 'Invalid order',
    description: 'Introduce a rejected order condition.',
    icon: AlertTriangle,
  },
  {
    id: 'reset',
    title: 'Reset simulation',
    description: 'Restore the baseline market state.',
    icon: RotateCcw,
    danger: true,
  },
];

export function ScenarioControls({
  pending,
  activeScenario,
  batchStatus,
  onRun,
}: {
  pending: boolean;
  activeScenario?: ScenarioInputScenario;
  batchStatus: AuctionBatchStatus;
  onRun: (scenario: ScenarioInputScenario) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#d9d7c9] bg-[#fbfaf5] p-5 shadow-sm sm:p-6">
      <SectionTitle eyebrow="Failure lab" title="Try a scenario" />
      <p className="-mt-2 mb-3 text-[11px] leading-relaxed text-muted-foreground">
        Inspect what the system does when an assumption fails. These controls modify the shared demo state.
      </p>
      <div className="space-y-1">
        {scenarios.map((scenario) => {
          const Icon = scenario.icon;
          const isActive = activeScenario === scenario.id;
          const canRun = !pending && (batchStatus === 'COLLECTING' || scenario.id === 'reset');

          return (
            <button
              data-testid={`button-scenario-${scenario.id}`}
              key={scenario.id}
              type="button"
              disabled={!canRun}
              onClick={() => onRun(scenario.id)}
              className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition hover:bg-[#f1f0e8] disabled:opacity-55"
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${scenario.danger ? 'bg-[#f6e9e3] text-[#a7503b]' : 'bg-[#eaf0e9] text-[#4b715d]'}`}>
                <Icon size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-xs font-semibold ${scenario.danger ? 'text-[#9c4d3a]' : 'text-[#334b3e]'}`}>
                  {isActive ? 'Running…' : scenario.title}
                </span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  {batchStatus !== 'COLLECTING' && scenario.id !== 'reset'
                    ? 'Reset the simulation to run this scenario.'
                    : scenario.description}
                </span>
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#718176] opacity-0 transition-opacity group-hover:opacity-100">
                Run
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 rounded-lg border border-[#e4e1d5] bg-[#f6f5ef] px-3 py-2.5">
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Failure scenarios are descriptive demos, not adversarial testing or evidence of security.
        </p>
      </div>
    </section>
  );
}
