import assert from "node:assert/strict";
import { test } from "node:test";
import { clearActiveBatch, getExchangeSnapshot, runExchangeScenario } from "./exchange-engine";

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
