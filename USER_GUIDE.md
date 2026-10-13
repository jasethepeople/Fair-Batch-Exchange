# Fair Exchange: user guide

Fair Exchange is an interactive simulation of a batch-auction exchange. It
does not touch real money, wallets, or a blockchain. State resets when the API
server restarts.

## Run it

```sh
pnpm install
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/fair-exchange run dev
```

The Replit artifact workflows provide the API and web-app ports automatically.
The simulator itself stores all state in memory.

## Use it

1. **Place a sealed order.** Choose buy or sell, then enter a quantity and a
   limit price (the worst price you will accept).
2. **Inspect the order queue.** Your order appears as a commitment; terms are
   hidden from the public API response until a successful simulated reveal.
3. **Cancel your own order** while the batch is still collecting.
4. **Reveal and clear the batch.** The button is available when the simulated
   committee has reached its 3-of-5 threshold.
5. **Read the McAfee result.** The result reports matched quantity, the price
   paid by buyers, the price received by sellers, and any mechanism surplus.

## Reading the result

- **Uniform-price branch:** every filled buyer and seller uses the same price.
- **Trade-reduction branch:** the rule removes one marginal micro-unit from
  the crossing allocation. Buyers pay the marginal bid and sellers receive the
  marginal ask; the retained spread appears as mechanism surplus.
- **No trade:** no compatible crossing exists, or trade reduction removes the
  only crossing unit.
- **Partial fills:** more competitive price levels fill first. Orders at a
  tied marginal price share quantity pro rata; integer remainders use a
  deterministic order-id tie-break.
- **Committee shares:** the demo shows simulated shares only. They do not come
  from a live validator committee.
- **Audit trail:** lists simulated protocol events, not an independently
  verified or tamper-proof audit.

## Strategy and fairness caveat

The classic McAfee truthfulness result is for single-unit traders under its
stated assumptions. This simulator accepts divisible quantities and therefore
does **not** claim strategy-proof bidding. Its included synthetic comparison
finds that under-bidding was profitable more often under McAfee in the tested
scenarios; the results are evidence for further research, not a general proof.

## Failure lab

Use **Quorum failure**, **Reveal timeout**, or **Invalid order** to see the
simulation abort without settlement or reveal. **Reset simulation** restores a
fresh demonstration batch.

## What is not real

Orders are not encrypted: the API receives plaintext. The committee, share
release, validation, and reveal are simulated. There are no wallet signatures,
asset transfers, contracts, persistent identity, or decentralized consensus.
Do not treat any indicator in the app as a security, neutrality, or
censorship-resistance claim.

## Developer commands

```sh
pnpm --filter @workspace/api-server run test:mechanisms
pnpm --filter @workspace/api-server run compare:mechanisms
DEPTH=60 pnpm --filter @workspace/api-server run compare:mechanisms
```

`artifacts/api-server/src/lib/mcafee.ts` is the active clearing mechanism.
`artifacts/api-server/src/lib/max-volume.ts` is retained only as a comparator.
See `MECHANISM_COMPARISON.md` and `whitepaper-outline.md`.
