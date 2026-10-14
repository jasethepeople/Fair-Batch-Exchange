import assert from "node:assert/strict";
import { test } from "node:test";
import { clearMaxVolume } from "./max-volume";
import { clearMcAfee } from "./mcafee";

test("splitting a marginal McAfee bid can gain one unit through order-id tie-breaking", () => {
  const commonSell = [{ id: "supply", side: "sell" as const, units: 8, price: 9 }];
  const unsplit = clearMcAfee([
    { id: "z-owner", side: "buy", units: 4, price: 10 },
    { id: "a-rival", side: "buy", units: 4, price: 10 },
    ...commonSell,
  ]);
  const split = clearMcAfee([
    { id: "a-owner-1", side: "buy", units: 1, price: 10 },
    { id: "b-owner-2", side: "buy", units: 1, price: 10 },
    { id: "c-owner-3", side: "buy", units: 1, price: 10 },
    { id: "d-owner-4", side: "buy", units: 1, price: 10 },
    { id: "z-rival", side: "buy", units: 4, price: 10 },
    ...commonSell,
  ]);

  assert.equal(unsplit.rule, "trade-reduction");
  assert.equal(unsplit.tradedUnits, 7);
  assert.equal(unsplit.fills.get("z-owner"), 3);
  assert.equal(split.tradedUnits, 7);
  assert.equal(
    ["a-owner-1", "b-owner-2", "c-owner-3", "d-owner-4"].reduce(
      (sum, id) => sum + (split.fills.get(id) ?? 0),
      0,
    ),
    4,
  );
});

test("splitting can change max-volume pro-rata remainders at the marginal price", () => {
  const unsplit = clearMaxVolume(
    [
      { id: "owner", side: "buy", units: 2, price: 10, tieBreaker: "z-owner" },
      { id: "rival", side: "buy", units: 2, price: 10, tieBreaker: "a-rival" },
      { id: "supply", side: "sell", units: 3, price: 9, tieBreaker: "supply" },
    ],
    100,
  );
  const split = clearMaxVolume(
    [
      { id: "owner-1", side: "buy", units: 1, price: 10, tieBreaker: "a-owner-1" },
      { id: "owner-2", side: "buy", units: 1, price: 10, tieBreaker: "b-owner-2" },
      { id: "rival", side: "buy", units: 2, price: 10, tieBreaker: "z-rival" },
      { id: "supply", side: "sell", units: 3, price: 9, tieBreaker: "supply" },
    ],
    100,
  );

  assert.equal(unsplit.tradedUnits, 3);
  assert.equal(unsplit.fills.get("owner"), 1);
  assert.equal(split.tradedUnits, 3);
  assert.equal((split.fills.get("owner-1") ?? 0) + (split.fills.get("owner-2") ?? 0), 2);
});
