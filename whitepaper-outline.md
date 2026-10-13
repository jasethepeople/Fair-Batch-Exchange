# White paper outline: decentralized batch-auction exchange

*Working draft. Hypothetical design. Not legal or financial advice.*

**Audience:** Sections 1, 2, 5, and 6 should be understandable to a general
reader. Sections 3 and 4 are for technical reviewers. Add a 2–3 page
plain-language summary.

## 0. Abstract

Describe the intended market, the problems it addresses, and the limits of the
current simulation. State the core claim as a design goal—not a demonstrated
property—until the protocol and threat model support it.

## 1. The problem

- Speed games: front-running, sandwiching, and latency arbitrage.
- Gatekeepers: broker halts, custodial risk, and single points of control.
- Structural lock-in: settlement delays and collateral rules that intermediaries
  can change.
- Use current, cited data when drafting empirical claims.

## 2. Design in plain language

- Walk through one trade: signed encrypted order, batch cutoff, reveal, auction
  clearing, and atomic settlement.
- Diagram the consensus, encrypted submission, clearing, and settlement layers.
- State the target principles: non-custodial operation, no privileged admin
  keys, no central operator, and public verification.
- Clearly separate these target properties from the centralized, unencrypted
  simulator.

## 3. The mechanism

- Specify the active McAfee double auction: rank unit bids and asks, find the
  largest crossing quantity, test the next-unit midpoint, and otherwise apply
  trade reduction.
- Define who pays and receives in each branch, the retained spread, partial
  fills, equal-price allocation, price precision, and tie-breaking.
- State the classic incentive result only with its assumptions. It applies to
  single-unit traders; divisible orders, Sybil splitting, and the simulator's
  pro-rata marginal allocation require separate analysis.
- Compare against max-volume uniform pricing using the reproducible
  `MECHANISM_COMPARISON.md` experiment. Treat the synthetic results as evidence,
  not proof.
- Specify encrypted batches: threshold scheme and DKG, fixed-size batches,
  cutoff and ordering rules determined by consensus.
- Define a dual decryption path: committee fast path, timelock backstop, then
  automatic cancel-and-refund if neither path succeeds.
- Include pseudocode, invariants, worked numerical examples, and proofs or
  proof sketches.

## 4. Security and failure modes

- Committee collusion or downtime: evaluate committee size, incentives, and
  timelock recovery.
- Sybil order-splitting: analyze fees, deposits, minimums, and per-batch caps.
- Contract bugs: plan independent audits, formal verification, launch caps, and
  a bug bounty before real assets.
- Choke points: frontends, RPC providers, stable assets, and validator
  jurisdictions; identify mitigations and residual risks.
- Defer or cap bridges and cross-chain liquidity.
- Be explicit about what remains unsolved.

## 5. Fees and economics

- Fees should fund protocol security and operations.
- Analyze per-order fees as both an economic cost and possible Sybil defense.
- Model validator payments and the incentives to release shares on time.
- Specify the destination of any auction surplus, such as rebates or validator
  compensation; do not imply a team-controlled wallet.
- Estimate fees, volumes, operating costs, and validator break-even points.

## 6. Neutrality and user responsibilities

- Explain the intended neutral, non-custodial protocol and the practical
  governance and upgrade policy.
- State legal and tax responsibilities without presenting the protocol as legal
  advice.
- Provide a user-controlled trade-history export if the product reaches a
  real-asset phase.

## 7. Open questions

- Which quote asset has no freeze switch?
- New chain, rollup, or application on an existing chain?
- How do batch length and latency affect users?
- How will a batch-only venue bootstrap liquidity?
- How will reviewers in cryptography, security, and auction theory be engaged?

## 8. Roadmap

1. **Simulation:** specify the auction, compare economic policies, and test
   thin, liquid, volatile, and adversarial markets.
2. **Protocol specification:** define encrypted orders, validity proofs,
   threshold decryption, committee lifecycle, batch ordering, settlement, and
   every abort/recovery path.
3. **Independent review:** threat-model the protocol and contracts; formally
   verify critical invariants and commission cryptographic, smart-contract,
   and mechanism-design review.
4. **Public testnet:** test assets only, reproducible builds, monitoring,
   adversarial exercises, and visible committee/failure assumptions.
5. **Production decision:** proceed only after reviews and testnet findings are
   resolved. Preserve non-custody and remove privileged administrative keys.

## Appendices

- Clearing pseudocode and proof sketches
- Simulator code and reproducible results
- Threat-model table
- General-reader glossary
- References: McAfee (1992), threshold encryption, timelock encryption, and
  batch-auction deployments
