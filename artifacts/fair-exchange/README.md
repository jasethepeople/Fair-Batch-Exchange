# Fair Exchange

Fair Exchange is a browser-based prototype of a decentralized batch-auction
venue. This build is a simulation only. It does not connect to a blockchain,
hold assets, accept wallet keys, or provide production encryption or consensus.

## What is implemented

- A seeded ETH/USD demo market and a batch of sealed limit orders.
- A deterministic uniform-price auction engine.
- Price selection that maximizes executable volume, then minimizes imbalance,
  then chooses the price closest to the reference price, then the lower price.
- Price-priority order groups with pro-rata allocation at a partially filled
  price level. A commitment digest breaks exact rounding-remainder ties.
- A simulated committee threshold, share collection, reveal, timeout, quorum
  failure, and invalid-order failure lifecycle.
- An event log and repeatable success/failure scenarios.
- In-memory state. Restarting the API resets the simulation.

## What is not implemented

The simulation does not encrypt orders in transit or at rest. The API receives
the plaintext order terms and keeps them in server memory; it only hides terms
from the demo's public response until reveal. The displayed SHA-256 digest is
not a threshold-encryption scheme or a proof of order validity. There are no
wallet signatures, asset transfers, smart contracts, distributed validators,
network-level censorship guarantees, persistent identity, or adversarial
security protections. The service and its demo identity are centralized.

Do not use this prototype to trade real assets or treat its committee,
neutrality, or censorship-resistance indicators as security claims.

## Auction rules in this simulation

The engine evaluates the reference price and each submitted limit price as
candidate clearing prices. It chooses a candidate with the greatest executable
quantity. Ties are resolved by the lowest absolute demand/supply imbalance,
then distance to the reference price, then the lower price. More competitive
price levels are filled first. When only part of a price level can fill, the
remaining quantity is divided pro rata; whole micro-units left by rounding go
to the largest fractional remainders, then the lexicographically smaller
commitment digest. Both sides receive the same clearing price.

These are explicit prototype policies, not a claim that this is the only
economically appropriate auction design. Before testnet use, model strategic
behavior, order spam, Sybil participation, griefing, collusion, validator
availability, and the incentives for timely share release.

## Failure modes represented

- Fewer than the required threshold shares arrive: abort without revealing
  sealed terms.
- The threshold is reached but reveal times out: abort without settlement.
- An order fails the simulated validity check: abort without settlement.
- No compatible buy/sell orders cross: settle the batch with no trade.

Real implementations also need explicit responses to equivocation, invalid
shares, unavailable or malicious committee members, data-availability loss,
reorganizations, replay, denial of service, and disagreements about the
canonical batch state.

## Suggested development phases

1. **Simulation:** specify auction and tie-breaking rules; run economic
   simulations across thin, liquid, volatile, and adversarial markets.
2. **Protocol specification:** define the encrypted order format, commitment
   proofs, threshold scheme, committee selection and rotation, batch ordering,
   settlement, and every abort/recovery path.
3. **Independent review:** threat-model the protocol and contracts; formally
   verify critical invariants and commission independent cryptographic,
   smart-contract, and economic reviews.
4. **Public testnet:** use test assets only, publish reproducible builds and
   monitoring, run adversarial exercises, and make the committee and failure
   assumptions observable.
5. **Production decision:** proceed only after review findings are resolved.
   The target architecture must remain non-custodial, have no privileged
   administrative keys or central operator, and document any unavoidable
   trust assumptions.

This repository currently implements phase 1's interactive simulation, not
phases 2–5.
