# White Paper Outline: Decentralized Batch-Auction Exchange

*Working draft. Hypothetical design. Not legal or financial advice.*

**Audience note:** Write sections 1, 2, 5, and 6 so a general reader can follow them. Sections 3 and 4 are for technical reviewers. Add a 2-3 page plain-language summary at the front.

---

## 0. Abstract (half a page)
- One paragraph: what the system is, what problem it solves, how it works at a high level.
- State the core claim: a market where skill beats speed and secrecy, with no single party able to see, reorder, censor, or halt trading.

## 1. The Problem
- **Speed games:** Front-running, sandwiching, latency arbitrage. Who profits from seeing orders first.
- **Gatekeepers:** Broker halts (GameStop, January 2021), custodial risk, single points of control.
- **Structural lock-in:** Multi-day settlement and collateral calls that let intermediaries change the rules mid-game.
- Include real numbers: how much value sandwiching extracts on-chain today (cite current data when drafting).

## 2. The Design in Plain Language
- Walk through one trade from start to finish: user signs an encrypted order, batch closes, orders decrypt, one price clears for everyone, funds settle atomically.
- Diagram: the layers (consensus, encrypted submission, clearing, settlement).
- State the principles: no custody, no admin keys, no operator, open verification.

## 3. The Mechanism
- **McAfee double auction:** Sort bids and asks, find the largest k where bid k ≥ ask k, compute the candidate price, trade k or k-1 pairs.
- **Properties:** Weakly budget balanced, at most one unit of lost volume. Truthful only for single-unit traders; simulation shows manipulation returns with divisible orders (see MECHANISM_COMPARISON.md). Compare against max-volume uniform pricing and justify the choice.
- **Encrypted batches:** Threshold encryption to a validator committee (DKG), fixed-length batches, cutoff set by consensus.
- **Dual decryption path:** Committee fast path plus timelock backstop (beacon-based or VDF), with automatic cancel-and-refund as the last fallback.
- Include pseudocode for the clearing function and a worked example with real numbers.

## 4. Security and Failure Modes
- **Committee collusion or downtime:** Large committee, slashing, timelock backstop.
- **Sybil order-splitting:** McAfee isn't Sybil-proof. Fees, deposits, minimum sizes, per-batch caps.
- **Contract bugs:** Immutability means no patches. Audits, formal verification, caps at launch, bug bounty.
- **Choke points:** Frontends, RPC providers, stablecoins, validator jurisdictions. Mitigations for each.
- **Bridges and cross-chain liquidity:** Highest risk component. Defer or cap.
- Be candid about what is unsolved.

## 5. Fees and Economics
- **Principle:** Fees exist to keep the system secure and running, nothing more.
- **Per-order fee:** Doubles as Sybil resistance, so it is a security feature as well as revenue.
- **Validator and committee payment:** Cover node costs and decryption duties.
- **Auction surplus:** Route to user rebates or validators, not a team wallet.
- Include a simple model: expected fee per trade at different volumes, and the break-even for validator costs.

## 6. Neutrality and User Responsibilities
- The protocol is neutral infrastructure: non-custodial, no reporting function, no admin control.
- Each user is responsible for their own legal and tax obligations under local law.
- Provide a trade-history export so users can self-report easily if they choose.
- Describe governance honestly: minimal or none, with the upgrade policy stated clearly.

## 7. Open Questions
- Which quote asset has no freeze switch?
- New chain, rollup, or application on an existing chain?
- Batch length versus latency: what do real users tolerate?
- How to bootstrap liquidity on a batch-only venue?
- How to attract the scarce reviewers: cryptographers, auditors, auction theorists.

## 8. Roadmap
- Phase 0: Publish this paper, the clearing spec, and a simulator.
- Phase 1: Clearing and escrow contracts on a testnet.
- Phase 2: Encrypted batches with the dual decryption path.
- Phase 3: Anti-Sybil tuning from simulation and testnet data.
- Phase 4: Audits, formal verification, long public testnet.

## Appendices
- A. Clearing algorithm with proofs or proof sketches
- B. Simulator code and results
- C. Threat model table
- D. Glossary for general readers
- E. References (McAfee 1992, threshold encryption, timelock encryption, batch auction deployments)
