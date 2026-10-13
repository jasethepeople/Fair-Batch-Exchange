import assert from "node:assert/strict";
import { test } from "node:test";
import { clearMcAfee, type McOrder } from "./mcafee";

function book(bids: number[], asks: number[]): McOrder[] {
  return [
    ...bids.map((price, i) => ({ id: `b${i}`, side: "buy" as const, units: 1, price })),
    ...asks.map((price, i) => ({ id: `s${i}`, side: "sell" as const, units: 1, price })),
  ];
}

test("textbook example: uniform price at the midpoint", () => {
  const result = clearMcAfee(book([10, 8, 6, 4], [1, 3, 5, 7]));
  assert.equal(result.rule, "uniform");
  assert.equal(result.tradedUnits, 3);
  assert.equal(result.buyerPrice, 5.5);
  assert.equal(result.sellerPrice, 5.5);
  assert.equal(result.mechanismSurplus, 0);
});

test("trade reduction when the midpoint falls outside the marginal pair", () => {
  const result = clearMcAfee(book([10, 9, 8, 7], [1, 2, 3, 9.5]));
  assert.equal(result.rule, "trade-reduction");
  assert.equal(result.tradedUnits, 2);
  assert.equal(result.buyerPrice, 8);
  assert.equal(result.sellerPrice, 3);
  assert.equal(result.mechanismSurplus, 10);
  assert.equal(result.fills.get("b2"), undefined);
  assert.equal(result.fills.get("s2"), undefined);
});

test("trade reduction when one side has no next unit", () => {
  const result = clearMcAfee(book([10, 9, 8], [1, 2, 3]));
  assert.equal(result.rule, "trade-reduction");
  assert.equal(result.tradedUnits, 2);
  assert.equal(result.buyerPrice, 8);
  assert.equal(result.sellerPrice, 3);
});

test("no trade when nothing crosses or one side is empty", () => {
  assert.equal(clearMcAfee(book([5, 4], [6, 7])).tradedUnits, 0);
  assert.equal(clearMcAfee(book([5, 4], [])).tradedUnits, 0);
  assert.equal(clearMcAfee([]).rule, "none");
});

test("a single crossing pair is dropped entirely", () => {
  assert.equal(clearMcAfee(book([10], [1])).tradedUnits, 0);
});

test("results do not depend on input order", () => {
  const orders = book([10, 8, 6, 4], [1, 3, 5, 7]);
  const first = clearMcAfee(orders);
  const second = clearMcAfee([...orders].reverse());
  assert.equal(first.buyerPrice, second.buyerPrice);
  assert.deepEqual([...first.fills].sort(), [...second.fills].sort());
});

test("randomized invariants", () => {
  let seed = 7;
  const random = () =>
    (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

  for (let run = 0; run < 3000; run += 1) {
    const orders: McOrder[] = [];
    const orderCount = Math.floor(random() * 14);
    for (let i = 0; i < orderCount; i += 1) {
      orders.push({
        id: `o${i}`,
        side: random() < 0.5 ? "buy" : "sell",
        units: 1 + Math.floor(random() * 5_000_000),
        price: 90 + Math.floor(random() * 200) / 10,
      });
    }

    const result = clearMcAfee(orders);
    let buyFill = 0;
    let sellFill = 0;
    for (const order of orders) {
      const fill = result.fills.get(order.id) ?? 0;
      assert.ok(fill >= 0 && fill <= order.units, "no over-fill");
      if (fill > 0) {
        if (order.side === "buy") {
          buyFill += fill;
          assert.ok(order.price >= (result.buyerPrice as number), "buyer never pays above limit");
        } else {
          sellFill += fill;
          assert.ok(order.price <= (result.sellerPrice as number), "seller never receives below limit");
        }
      }
    }
    assert.equal(buyFill, result.tradedUnits);
    assert.equal(sellFill, result.tradedUnits);
    assert.ok(result.mechanismSurplus >= 0, "weakly budget balanced");
  }
});

test("rejects duplicate ids and unsafe quantities", () => {
  assert.throws(
    () => clearMcAfee([...book([10], [1]), { id: "b0", side: "buy", units: 1, price: 10 }]),
    /unique/,
  );
  assert.throws(
    () => clearMcAfee([{ id: "large", side: "buy", units: Number.MAX_SAFE_INTEGER + 1, price: 10 }]),
    /safe integers/,
  );
});
