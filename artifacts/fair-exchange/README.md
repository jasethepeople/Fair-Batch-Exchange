# Fair Exchange

Fair Exchange is a browser-based prototype of a decentralized batch-auction
venue. This build is a simulation only. It does not connect to a blockchain,
hold assets, accept wallet keys, or provide production encryption or consensus.

## What is implemented

- A seeded ETH/USD demo market and a batch of sealed limit orders.
- An active McAfee (1992) double-auction clearing rule, adapted to quantities
  represented in integer micro-units.
- The McAfee uniform-price branch when its next-unit midpoint falls inside the
  marginal bid/ask interval.
- The McAfee trade-reduction branch otherwise: one micro-unit is removed and
  buyers pay the marginal bid while sellers receive the marginal ask. The
  retained spread is reported as mechanism surplus.
- Price-priority allocation and pro-rata fills within equal-price groups;
  deterministic order IDs resolve rounding remainders.
- A max-volume uniform-price implementation retained as a research comparator.
- Tests for the mechanism branches, no-trade cases, price limits, allocation
  invariants, randomized books, and engine integration.
- A simulated committee threshold, reveal, timeout, quorum-failure, and
  invalid-order lifecycle.
- An event log and repeatable success/failure scenarios.
- In-memory state. Restarting the API resets the simulation.

Run the mechanism tests and the seeded economic comparison with:

```sh
pnpm --filter @workspace/api-server run test:mechanisms
pnpm --filter @workspace/api-server run compare:mechanisms
```

## Economic limitation

McAfee's classic truthfulness guarantee is for single-unit traders under its
stated assumptions. This simulation accepts divisible order quantities, and
its marginal allocation and deterministic tie-breaking do not establish
strategy-proof behavior. The accompanying seeded comparison found
under-bidding profitable more often under McAfee than under the max-volume
comparator in the tested cases. That is a bounded synthetic experiment, not a
proof that either mechanism is safe from manipulation.

See `MECHANISM_COMPARISON.md` for the methodology and results.

## What is not implemented

The simulation does not encrypt orders in transit or at rest. The API receives
plaintext order terms and keeps them in server memory; it only hides terms from
the demo's public response until a successful reveal. The displayed SHA-256
digest is not threshold encryption or a proof of order validity. There are no
wallet signatures, asset transfers, smart contracts, distributed validators,
network-level censorship guarantees, persistent identity, or adversarial
security protections. The service and its demo identity are centralized.

Do not use this prototype to trade real assets or treat its committee,
neutrality, or censorship-resistance indicators as security claims.

## Failure modes represented

- Fewer than the required threshold shares arrive: abort without revealing
  sealed terms.
- The threshold is reached but reveal times out: abort without settlement.
- An order fails the simulated validity check: abort without settlement.
- McAfee's rule produces no trade, including a single crossing unit removed
  by trade reduction.

Real implementations also need explicit responses to equivocation, invalid
shares, unavailable or malicious committee members, data-availability loss,
reorganizations, replay, denial of service, and disagreements about the
canonical batch state.

## Suggested development phases

1. **Simulation:** specify auction and tie-breaking rules; model divisible
   trading, shading, Sybil behavior, collusion, and adversarial books.
2. **Protocol specification:** define the encrypted order format, validity
   proofs, threshold scheme, committee selection and rotation, batch ordering,
   settlement, and every abort/recovery path.
3. **Independent review:** threat-model the protocol and contracts; formally
   verify critical invariants and commission independent cryptographic,
   smart-contract, and mechanism-design reviews.
4. **Public testnet:** use test assets only, publish reproducible builds and
   monitoring, run adversarial exercises, and make committee and failure
   assumptions observable.
5. **Production decision:** proceed only after review findings are resolved.
   The target architecture must remain non-custodial, have no privileged
   administrative keys or central operator, and document unavoidable trust
   assumptions.

This repository currently implements an interactive mechanism simulation,
not the decentralized protocol or testnet phases.
