import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cancelSealedOrder,
  clearActiveBatch,
  getExchangeSnapshot,
  runExchangeScenario,
  submitSealedOrder,
} from "./exchange-engine";

test("active batch settles through McAfee and reports each side's price", () => {
  const initial = runExchangeScenario("reset");
  const result = clearActiveBatch(initial.batch.id);

  assert.equal(result.batch.status, "SETTLED");
  assert.equal(result.batch.clearingRule, "trade-reduction");
  assert.equal(result.batch.buyerPrice, 100.4);
  assert.equal(result.batch.sellerPrice, 100.1);
  assert.ok(result.batch.matchedVolume > 0);
  assert.ok(result.batch.mechanismSurplus > 0);
  assert.ok(result.orders.some((order) => order.side !== null && order.filledQuantity > 0));
  assert.equal(result.stats.lastBuyerPrice, 100.4);
  assert.equal(result.stats.lastSellerPrice, 100.1);
  assert.equal(getExchangeSnapshot().batch.clearingRule, "trade-reduction");
});

test("expired cutoff blocks new orders and cancellations but leaves the batch clearable", () => {
  const initial = runExchangeScenario("reset");
  const ownOrder = submitSealedOrder({ side: "buy", quantity: 0.25, limitPrice: 99 });
  const originalNow = Date.now;

  try {
    Date.now = () => initial.batch.cutoffAt.getTime();

    assert.equal(getExchangeSnapshot().batch.secondsToCutoff, 0);
    assert.throws(
      () => submitSealedOrder({ side: "sell", quantity: 0.25, limitPrice: 101 }),
      /order window has closed/i,
    );
    assert.equal(cancelSealedOrder(ownOrder.id), null);

    const cleared = clearActiveBatch(initial.batch.id);
    assert.equal(cleared.batch.status, "SETTLED");
  } finally {
    Date.now = originalNow;
  }
});
