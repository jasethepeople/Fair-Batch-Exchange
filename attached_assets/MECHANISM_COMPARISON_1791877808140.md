# Max-volume uniform price vs McAfee double auction

Both mechanisms were run on identical order sets, using the real engine for the max-volume rule. Seeded, reproducible: `npx tsx scripts/compare-mechanisms.ts` (add `DEPTH=60` for deep books).

## Summary

- **Efficiency:** Both trade the same volume and realize the same gains from trade (ratio 1.0), since McAfee drops at most one micro-unit.
- **Who gets the gains:** Under McAfee's trade-reduction rule the mechanism keeps the buy/sell spread. That was about **25% of total gains in thin books** and **10% in deep books**.
- **Manipulation:** McAfee's truthfulness holds for single-unit traders. With divisible orders it does not hold here. Under-bidding paid off far more often under McAfee than under the max-volume rule.

## Results: can one buyer profit by under-bidding their true value?

Share of scenarios where shading the limit price (0 to 4.0 below true value) beat bidding truthfully, and the average gain.

| Books | Order size | Max-volume: shading pays | McAfee: shading pays | Avg gain (max-vol / McAfee) |
|---|---|---|---|---|
| Thin (7-14 orders) | 0.05 | 0.7% | 34% | 0.0001 / 0.0124 |
| Thin | 4 | 23.3% | 39.3% | 0.267 / 0.519 |
| Deep (65 orders) | 0.05 | 1% | 51% | 0 / 0.0073 |
| Deep | 1 | 7% | 46% | 0.0117 / 0.1119 |

Average truthful utility was also lower under McAfee (for example 1.66 vs 1.37 for the large thin-book buyer), because buyers pay the marginal bid rather than a midpoint and the spread goes to the mechanism.

## Why

McAfee's proof treats every unit as a separate single-unit trader. A divisible order is many units at one price, and its marginal units can set the price it pays. That gives even small orders room to gain by shading.

## Limits of this test

- Synthetic random books, a fixed reference price, one strategy family (buyer price shading), and other traders who don't react. This is evidence, not proof.
- Quantities and price tick sizes affect the numbers.
- Sybil splitting, collusion, and sell-side manipulation were not tested.

## Implication for the design

Max-volume uniform pricing looks like the better default for divisible orders. McAfee remains useful as a reference, or if orders are restricted to fixed single units. Large traders can still move the max-volume price, so size limits or other mitigations are an open question for the paper.
