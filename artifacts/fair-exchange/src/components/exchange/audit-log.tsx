import { ArrowUpRight, FileClock } from 'lucide-react';
import type { AuditEvent } from '@workspace/api-client-react';
import { SectionTitle, StatusTag } from './ui-pieces';

function eventTone(status: string): 'good' | 'warn' | 'bad' | 'neutral' {
  if (status === 'SUCCESS') return 'good';
  if (status === 'WARNING') return 'warn';
  if (status === 'FAILURE') return 'bad';
  return 'neutral';
}

function displayTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function AuditLog({ events }: { events: AuditEvent[] }) {
  return (
    <section className="rounded-2xl border border-[#d9d7c9] bg-[#fbfaf5] shadow-sm">
      <div className="flex items-end justify-between px-5 pt-5 sm:px-6">
        <SectionTitle eyebrow="Trace / Live state" title="Audit trail" />
        <span className="mb-4 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#60776a]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6b9672]" /> API event stream
        </span>
      </div>
      <div className="border-t border-[#e8e5db]">
        {events.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-9 text-center">
            <FileClock size={19} className="mb-2 text-[#6e8577]" />
            <p className="text-xs font-semibold text-[#354b41]">No audit events yet</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Events will appear as the simulation progresses.</p>
          </div>
        ) : (
          <div className="max-h-[366px] overflow-auto">
            {events.map((event) => (
              <div key={event.id} data-testid={`event-audit-${event.id}`} className="grid grid-cols-[70px_1fr_auto] gap-3 border-t border-[#eeece4] px-5 py-3 first:border-t-0 sm:grid-cols-[82px_1fr_auto] sm:px-6">
                <time className="pt-0.5 font-mono text-[9px] tabular-nums text-muted-foreground" dateTime={event.timestamp}>
                  {displayTime(event.timestamp)}
                </time>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="truncate text-xs font-semibold text-[#354b41]">{event.event}</p>
                    <ArrowUpRight size={11} className="shrink-0 text-[#839286]" />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">{event.detail}</p>
                </div>
                <StatusTag tone={eventTone(event.status)}>{event.status}</StatusTag>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-[#e8e5db] px-5 py-3 sm:px-6">
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Event records reflect simulated protocol state and are not an independently verified audit.
        </p>
      </div>
    </section>
  );
}
