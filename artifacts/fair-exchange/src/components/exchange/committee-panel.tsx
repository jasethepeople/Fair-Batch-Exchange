import { Check, Circle, ShieldAlert, UsersRound } from 'lucide-react';
import type { Committee } from '@workspace/api-client-react';
import { SectionTitle, StatusTag } from './ui-pieces';

export function CommitteePanel({ committee }: { committee: Committee }) {
  const sharePercent = committee.totalMembers > 0
    ? Math.min(100, Math.round((committee.sharesReceived / committee.threshold) * 100))
    : 0;

  return (
    <section className="rounded-2xl border border-[#d9d7c9] bg-[#fbfaf5] p-5 shadow-sm sm:p-6">
      <SectionTitle
        eyebrow="02 / Quorum"
        title="Committee shares"
        trailing={<UsersRound size={17} className="text-[#577267]" />}
      />
      <div className={`rounded-xl border p-4 ${committee.quorumReached ? 'border-[#cddfce] bg-[#eef4eb]' : 'border-[#ebd8bc] bg-[#faf1e3]'}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Quorum status</p>
            <p className={`mt-1 text-sm font-bold ${committee.quorumReached ? 'text-[#356449]' : 'text-[#8c5c1d]'}`}>
              {committee.quorumReached ? 'Threshold reached' : 'Waiting for enough shares'}
            </p>
          </div>
          <StatusTag tone={committee.quorumReached ? 'good' : 'warn'}>
            {committee.sharesReceived} / {committee.threshold} shares
          </StatusTag>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/80">
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${committee.quorumReached ? 'bg-[#4c8061]' : 'bg-[#d69a48]'}`}
            style={{ width: `${sharePercent}%` }}
          />
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          {committee.quorumReached
            ? 'The simulated quorum can authorize reveal and McAfee clearing.'
            : `At least ${committee.threshold} shares are needed; ${Math.max(0, committee.threshold - committee.sharesReceived)} more required.`}
        </p>
      </div>
      <div className="mt-4 space-y-2">
        {committee.members.map((member) => {
          const hasShare = member.shareReceived;
          const isFailure = member.status === 'OFFLINE' || member.status === 'SLASHED';

          return (
            <div key={member.id} data-testid={`status-member-${member.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-[#f5f3eb]">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${hasShare ? 'bg-[#dfede1] text-[#38654c]' : isFailure ? 'bg-[#f4e5df] text-[#a6533f]' : 'bg-[#ecebe3] text-[#778077]'}`}>
                  {hasShare ? <Check size={12} /> : isFailure ? <ShieldAlert size={12} /> : <Circle size={10} />}
                </span>
                <span className="truncate text-xs font-semibold text-[#3c5047]">{member.label}</span>
              </div>
              <span className={`font-mono text-[9px] uppercase tracking-[0.08em] ${hasShare ? 'text-[#4f795f]' : isFailure ? 'text-[#a6533f]' : 'text-muted-foreground'}`}>
                {member.status.replace('_', ' ')}
              </span>
            </div>
          );
        })}
        {committee.members.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#d8d8ca] px-4 py-6 text-center">
            <p className="text-xs font-medium text-[#52675c]">No committee members reported</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Committee state is supplied by the simulation API.</p>
          </div>
        )}
      </div>
      <p className="mt-3 border-t border-[#e9e6dc] pt-3 text-[10px] leading-relaxed text-muted-foreground">
        Committee members are named simulation actors. Shares and quorum do not represent a live cryptographic committee.
      </p>
    </section>
  );
}
