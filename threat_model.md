# Threat Model

## Project Overview

Fair Exchange is currently a browser-based batch-auction simulation built with
React/Vite and an Express API. It keeps exchange state in API-process memory.
The exchange routes are public; there is no trader authentication, wallet
signature, blockchain consensus, asset custody, or production threshold
cryptography in the current implementation. The API receives order terms in
plaintext. Its committee, order reveal, and failure scenarios are simulated.

The target design in `whitepaper-outline.md` is a non-custodial digital-goods
exchange with signed encrypted orders, a consensus-defined batch, threshold
decryption, McAfee clearing, and atomic settlement. A timelock path and
automatic cancellation/refund are proposed recovery mechanisms, not implemented
features. This model separates the current demo's actual security properties
from requirements for that target protocol.

Relevant adversaries include public API callers, strategic or Sybil traders,
malicious or colluding committee members, a compromised frontend/API operator,
and failures or reorgs in the future consensus and settlement layers. Target
guarantees depend on the selected chain's finality and the reviewed
cryptographic scheme; those choices remain open.

## Assets

- **Order terms and trading intent** — side, quantity, limit price, owner, and
  timing. Premature disclosure can enable front-running, selective censorship,
  or strategic order placement.
- **Order authorization and inclusion** — the trader's signature, batch
  membership, cutoff, and canonical ordering. Modification, replay, omission,
  or reordering can change allocation and settlement.
- **Threshold decryption keys and shares** — compromise or collusion can expose
  all encrypted orders protected by the affected key epoch; lost or withheld
  shares can halt a batch.
- **Batch result and settlement state** — matched quantity, fills, buyer/seller
  prices, refunds, and any collateral or digital goods. In the target protocol,
  inconsistent results or non-atomic settlement can cause direct loss.
- **Trader signing keys and recovery credentials** — these authorize orders,
  cancellations, and claims. The current simulation does not use wallet keys.
- **Protocol funds and validator bonds** — future settlement assets and
  committee incentives must be protected from theft, freezing, or unauthorized
  redirection. The current simulation holds no such assets.
- **Audit and verification evidence** — signed submissions, consensus
  inclusion, decryption proofs, clearing results, and settlement receipts are
  needed to investigate disputes. The current audit list is in-memory and
  simulated.

## Trust Boundaries

- **Browser to API (`/api`)** — the browser is untrusted. Current exchange
  endpoints have no authentication or per-trader authorization. The Express
  app enables CORS for all origins. Input schemas provide basic shape/range
  validation, not proof of identity or ownership.
- **API process and order state** — the API holds plaintext order terms and
  controls the one in-memory exchange state. Redacting terms in a response
  protects only against that response; it does not protect data from the API
  operator, process compromise, or other code with access to memory.
- **Consensus and validator committee (target only)** — encrypted submissions,
  cutoff, batch snapshot, membership, and threshold-share release must be
  agreed under a public consensus rule. No such boundary exists in the demo.
- **Committee to decryption/recovery paths (target only)** — threshold shares
  and any timelock key path cross separate trust assumptions. Their release
  must be tied to the same finalized batch and recovery state.
- **Protocol to settlement layer (target only)** — a contract or other
  verifiable settlement system must apply only the canonical clearing result
  and make fills, transfers, and refunds atomic. No settlement layer is
  connected today.
- **Pre-reveal to public reveal** — order terms are intentionally confidential
  before the batch is irrevocably closed and may be disclosed after settlement.
  The protocol must define what is revealed after an abort and what happens to
  cancelled orders.
- **Development demo to production** — simulation routes and assumptions are
  not production controls. No real asset or censorship-resistance guarantee
  follows from a passing demo scenario.

## Scan Anchors

- **Current API entry points:** `artifacts/api-server/src/index.ts`,
  `artifacts/api-server/src/app.ts`, and
  `artifacts/api-server/src/routes/exchange.ts`.
- **Highest-risk current logic:** `artifacts/api-server/src/lib/exchange-engine.ts`
  (plaintext orders, ownership flag, batch state, simulated committee and
  settlement) and `artifacts/api-server/src/lib/mcafee.ts` (clearing logic).
- **API contract:** `lib/api-spec/openapi.yaml`; verify any generated client
  types against this source.
- **Public surfaces:** `GET /api/exchange`, order submission, cancellation,
  batch clearing, and simulation scenarios are exposed without authentication.
  There is no admin role or protocol contract in the current demo.
- **Development/research-only:** `artifacts/api-server/scripts/`,
  mechanism tests, `STRATEGY_RISK_REPORT.md`, and the UI simulation controls.
  They are not production protocol components.

## Threat Categories

### Spoofing

The current API has no trader identity or wallet signature. `cancelSealedOrder`
checks an internal `isMine` flag rather than binding the request to an
authenticated caller; order IDs are visible in the exchange snapshot. In the
shared simulation, a caller who can address another simulated user's order may
cancel it before cutoff. The displayed five-member committee is also not
authenticated and releases no cryptographic shares.

For the target protocol, order and cancellation actions **MUST** be signed by
the trader's key and domain-separated by chain/protocol, batch, nonce, and
expiry. The protocol **MUST** reject replayed or cross-batch signatures.
Committee identities, membership, DKG contributions, and share proofs
**MUST** be verifiable against the finalized committee state.

### Tampering

The API accepts plaintext orders and calculates a demo SHA-256 identifier; this
is not a cryptographic commitment to a user-signed order. The current clear
route can settle a collecting batch without checking that the cutoff has
elapsed, and simulated quorum state is an in-process boolean/count rather than
verified shares. A centralized process can therefore change the state or
settle a batch early. These are prototype limitations, not asset-loss
vulnerabilities while no real assets are connected.

The target protocol **MUST** bind each order to its signed encrypted payload,
batch ID, and validity proof; enforce price, quantity, precision, and nonce
bounds; and verify that every included order belongs to the canonical finalized
batch snapshot. Cutoff and order ordering **MUST** be consensus-defined, and
clearing **MUST NOT** occur before that cutoff. All validators and settlement
participants **MUST** be able to reproduce the same McAfee result, including
partial fills and deterministic tie-breaking. Settlement and refunds **MUST**
be atomic and derived from that result, not operator-supplied values.

The strategy-risk experiments show that divisible-order allocation and
same-price tie-breaking can change trader outcomes. The protocol **MUST NOT**
claim single-unit McAfee incentive properties for divisible or split orders
without a proof for the actual allocation, fee, and tie-breaking rules.

### Repudiation

The demo audit trail is mutable process memory, capped at 100 events, and is
not an independently verifiable record. It cannot prove who submitted an
order, which batch included it, whether a share was released, or what a
settlement contract executed.

The target protocol **MUST** expose verifiable signed submission receipts,
batch inclusion and cutoff proofs, decryption/share proofs, deterministic
clearing evidence, and settlement/refund receipts. Any off-chain logs **MUST**
be treated as diagnostic only and **MUST NOT** be the sole evidence for a
trader's claim.

### Information Disclosure

Order terms are stored in plaintext in the API process. The current UI/API
redaction does not provide confidentiality from the server or its operator,
and the displayed truncated hash is not threshold encryption or a proof of
validity. After a successful simulated settlement, terms are intentionally
returned publicly. Network, submission timing, and order metadata may also
reveal activity in a real deployment.

The target protocol **MUST** encrypt order contents before submission using a
reviewed, suitably chosen threshold scheme with a verifiable DKG; fewer than
the threshold number of valid shares **MUST NOT** recover plaintext. Encryption
must be bound to the batch and key epoch, with publicly verifiable proofs for
well-formed orders that do not expose the terms. Committee operators,
frontends, RPC providers, and public observers **MUST NOT** receive plaintext
before the batch's defined reveal point. Padding and metadata leakage **MUST**
be documented and minimized. Disclosure after settlement or abort **MUST** be
explicitly specified, including treatment of cancelled and expired orders.

### Denial of Service

The demo has public mutation routes, a 5,000-order batch cap, in-memory state,
and no application-level rate limit. A caller can consume resources or disrupt
the shared simulation; restarting the API resets state. In the target design,
committee members can withhold shares, participants can spam or split orders,
and a stalled fallback can block every user in a batch.

The target protocol **MUST** have bounded batch sizes, bounded proof
verification work, a consensus-enforced submission window, and a permissionless
way to progress or abort a stalled batch. A fallback **MUST** have deterministic
activation conditions and **MUST NOT** allow selective decryption or selective
settlement. Timelock recovery **MUST** act on the same immutable, finalized
batch snapshot and either complete its specified deterministic settlement or
irrevocably abort it; a revealed or aborted batch **MUST NOT** be revived or
replayed. If neither the committee path nor recovery path completes, the batch
**MUST** become un-settleable and collateral/goods **MUST** be automatically
refundable. Fees, deposits, per-batch limits, and slashing may discourage spam
or withholding, but their effects on small traders and Sybil resistance require
explicit economic analysis. Production API deployment **MUST** also set
request-size limits, rate limits, and restrictive CORS policies appropriate to
its clients.

### Elevation of Privilege

The current API process is the effective central operator: it owns all order
state, chooses simulated committee state, and can reset or abort a batch via
public simulation routes. This is acceptable only as a clearly labeled demo;
it does not demonstrate neutrality or decentralization.

The target protocol **MUST NOT** depend on a privileged administrator or
operator key to pause, censor, reorder, decrypt, settle, redirect funds, or
change the auction rule. Contracts and consensus **MUST** enforce permissionless
state transitions and fixed rule versions. Any upgrade mechanism, if one is
introduced, **MUST** be narrowly scoped, publicly verifiable, time-delayed,
and paired with a user exit/refund path; an upgrade key would otherwise
reintroduce the gatekeeper the design intends to remove. Critical contracts,
cryptographic implementations, and the clearing implementation **MUST** receive
independent review and adversarial testing before real assets are enabled.
