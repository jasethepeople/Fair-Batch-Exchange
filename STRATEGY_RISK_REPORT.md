# Strategy-risk experiments

This report expands the earlier buyer-only comparison in
`MECHANISM_COMPARISON.md`. Reproduce it with:

```sh
pnpm --filter @workspace/api-server run strategy:risk
DEPTH=60 pnpm --filter @workspace/api-server run strategy:risk
```

## Method

- Shading and coordinated-buyer experiments clear the same five seeded demo
  orders and generated synthetic book under both policies.
- The default run tests 100 books per condition with 2–8 additional orders.
  `DEPTH=60` tests 75 books per condition with 60 additional orders.
- Trader values and costs are sampled from 98–103. Shade searches change a
  limit by 0.0–4.0 in 0.1 increments. Utility is measured before fees and
  without collateral or external payments.
- “Average gain” is the best tested strategy's utility minus truthful utility.
  “Scenarios improved” counts cases where that gain was positive. The grid is
  finite, so it can miss better strategies outside the tested range.
- The order-splitting experiment uses a constructed marginal-price tie book,
  keeps total quantity and the submitted price fixed, and randomizes order IDs
  and commitment tie-breaks. It does not include the seeded demo orders; it
  isolates rounding effects and is not a random market sample.
- The coalition experiment coordinates two buyers using the same bid reduction.
  It does not model a buyer–seller cartel, side payments, or collusion among
  other traders.

## Unilateral shading

Average best gain is in quote-asset units. Each cell is
“scenarios improved / average gain.”

### Shallow books: 100 scenarios per condition

| Side | Size | Max-volume uniform | McAfee |
|---|---:|---:|---:|
| Buy | 0.05 | 1% / 0.000570 | 31% / 0.012250 |
| Buy | 4 | 20% / 0.297986 | 37% / 0.611820 |
| Sell | 0.05 | 4% / 0.001045 | 16% / 0.005630 |
| Sell | 4 | 17% / 0.101317 | 40% / 0.839559 |

### Deeper books: 60 additional orders, 75 scenarios per condition

| Side | Size | Max-volume uniform | McAfee |
|---|---:|---:|---:|
| Buy | 0.05 | 1.3% / 0.000033 | 46.7% / 0.006373 |
| Buy | 1 | 14.7% / 0.025789 | 48% / 0.174546 |
| Sell | 0.05 | 0% / 0 | 0% / 0 |
| Sell | 1 | 2.7% / 0.003851 | 13.3% / 0.034785 |

### Coordinated buyers

Two buyers shaded their bids down by the same amount.

| Book | Max-volume uniform | McAfee |
|---|---:|---:|
| Shallow | 0% / 0 | 35% / 0.012725 |
| 60 additional orders | 0% / 0 | 61.3% / 0.012073 |

## Order splitting and marginal allocation

In the controlled equal-price books, splitting produced at most a one-micro-unit
fill change. For the tested McAfee cases, the average utility changes were
approximately `−0.000001` to `+0.000001`; the direction depended on whether
the split lots' IDs won the deterministic remainder tie-break. The selected
max-volume cases showed no average change because their target quantities
aligned with the pro-rata division.

Separate deterministic regression fixtures demonstrate that splitting can
change a marginal allocation under **both** policies when the remainder
parity differs: four same-price lots capture one additional micro-unit versus
one unsplit order when the split lots' IDs or commitment tie-breaks are
favored. This is an allocation/tie-break sensitivity, not evidence that
splitting is generally profitable. It also shows why tests that cover only
aggregate volume can miss identity-level allocation effects.

## Limits

These experiments are exploratory, not proofs of strategy-proofness or
market-wide manipulation resistance. They assume independent synthetic
opponents who do not react, no fees, no collateral constraints, and no
repeated-game reputation. Results vary with order sizes, price ticks,
tie-breaking, and the supplied seed book. The larger McAfee shading gains are
a warning for this divisible-order adaptation, not a universal ranking of
auction mechanisms. No live-market data or cross-side cartel strategy was
tested.
