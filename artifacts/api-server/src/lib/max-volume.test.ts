import assert from "node:assert/strict";
import { test } from "node:test";
import { clearMaxVolume, type VolumeOrder } from "./max-volume";

test("max-volume comparator finds the greatest executable quantity", () => {
  const orders: VolumeOrder[] = [
    { id: "b1", side: "buy", units: 2, price: 10, tieBreaker: "b1" },
    { id: "b2", side: "buy", units: 2, price: 10, tieBreaker: "b2" },
    { id: "s1", side: "sell", units: 3, price: 9, tieBreaker: "s1" },
  ];
  const result = clearMaxVolume(orders, 100);

  assert.equal(result.price, 10);
  assert.equal(result.tradedUnits, 3);
  assert.deepEqual([...result.fills].sort(), [["b1", 2], ["b2", 1], ["s1", 3]]);
});

test("max-volume comparator returns no fills when the book does not cross", () => {
  const result = clearMaxVolume(
    [
      { id: "b1", side: "buy", units: 5, price: 9, tieBreaker: "b1" },
      { id: "s1", side: "sell", units: 5, price: 10, tieBreaker: "s1" },
    ],
    100,
  );

  assert.equal(result.price, null);
  assert.equal(result.tradedUnits, 0);
  assert.equal(result.fills.size, 0);
});
