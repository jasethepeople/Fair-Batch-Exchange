# McAfee double auction vs max-volume uniform pricing

This report compares the **active McAfee rule** with the prior max-volume
uniform-price rule, using identical seeded demo orders and synthetic orders.
Run the reproducible experiment with:

```sh
pnpm --filter @workspace/api-server run compare:mechanisms
```

The script also accepts `DEPTH=60` for a separate deep-book experiment. The
numbers below are from the default shallow-book run (2,000 books and 100
under-bidding trials for each strategic order size).

## Results

| Measure | Max-volume | McAfee |
|---|---:|---:|
| Total matched volume ratio (McAfee / max-volume) | — | 1.000000 |
| Gains-from-trade ratio (McAfee / max-volume) | — | 1.000000 |
| McAfee retained surplus as share of McAfee gains-from-trade | — | 25.1264% |
| Batches using uniform-price branch | — | 1 / 2,000 |
| Batches using trade-reduction branch | — | 1,999 / 2,000 |

### Can a buyer gain by under-bidding their true value?

For each synthetic book, a buyer's limit price was varied from their assumed
true value down by up to 4.0. “Shading pays” means the best tested shade gave
higher utility than truthful bidding.

| Order size | Max-volume: shading pays | McAfee: shading pays | Average gain from shading (max-volume / McAfee) |
|---:|---:|---:|---:|
| 0.05 | 1% | 36% | 0.0001 / 0.0131 |
| 4 | 21% | 36% | 0.3010 / 0.5219 |

Average truthful utility was 0.0466 / 0.0325 for the small buyer and
1.7935 / 1.5300 for the larger buyer (max-volume / McAfee). Values are in the
simulation's quote-asset units.

## Interpretation and limitations

- The experiment supports the warning that McAfee's single-unit truthfulness
  result does not carry over to the simulator's divisible orders. It does not
  prove either mechanism safe from manipulation.
- The test uses seeded synthetic books, a fixed reference price, one buyer
  shading strategy, and other traders who do not react. It is not a market
  study or a security proof.
- Sybil splitting, collusion, sell-side strategies, adaptive traders, and
  adversarially selected books were not tested.
- The McAfee branch may give buyers and sellers different prices; the retained
  spread is reported as mechanism surplus. The max-volume comparator always
  charges one price to both sides.
- The exact results depend on quantities, price ticks, tie-breaking, and the
  supplied demo book. Deep-book output should be generated and reviewed
  separately rather than inferred from these shallow-book numbers.

McAfee is active in the simulator because the project selected it for
exploration. The max-volume implementation remains a research comparator.
Before using either in a real market, specify the trader model and economic
properties precisely and obtain independent mechanism-design review.
