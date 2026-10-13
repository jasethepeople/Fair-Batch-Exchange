import assert from "node:assert/strict";
import { test } from "node:test";
import { clearMcAfee, type McOrder } from "./mcafee";

const U = 1; // one unit per order keeps the textbook examples readable

function book(bids: number[], asks: number[]): McOrder[] {
  return [
    ...bids.map((price, i) => ({ id: `b${i}`, side: "buy" as const, units: U, price })),
    ...asks.map((price, i) => ({ id: `s${i}`, side: "sell" as const, units: U, price })),
  ];
}

test("textbook example: uniform price at the midpoint", () => {
  // bids 10,8,6,4 / asks 1,3,5,7 -> k=3, p=(4+7)/2=5.5, ask_3=5 <= 5.5 <= bid_3=6
  const r = clearMcAfee(book([10, 8, 6, 4], [1, 3, 5, 7]));
  assert.equal(r.rule, "uniform");
  assert.equal(r.tradedUnits, 3);
  assert.equal(r.buyerPrice, 5.5);
  assert.equal(r.sellerPrice, 5.5);
  assert.equal(r.mechanismSurplus, 0);
});

test("trade reduction when the midpoint falls outside the marginal pair", () => {
  // bids 10,9,8,7 / asks 1,2,3,9.5 -> k=3, p=8.25 > bid_3=8 -> trade 2 units
  const r = clearMcAfee(book([10, 9, 8, 7], [1, 2, 3, 9.5]));
  assert.equal(r.rule, "trade-reduction");
  assert.equal(r.tradedUnits, 2);
  assert.equal(r.buyerPrice, 8);
  assert.equal(r.sellerPrice, 3);
  assert.equal(r.mechanismSurplus, 10);
  assert.equal(r.fills.get("b2"), undefined); // the marginal bid is dropped
  assert.equal(r.fills.get("s2"), undefined); // and so is the marginal ask
});

test("trade reduction when there is no (k+1)-th unit on one side", () => {
  const r = clearMcAfee(book([10, 9, 8], [1, 2, 3]));
  assert.equal(r.rule, "trade-reduction");
  assert.equal(r.tradedUnits, 2);
  assert.equal(r.buyerPrice, 8);
  assert.equal(r.sellerPrice, 3);
});

test("no trade when nothing crosses, or a side is empty", () => {
  assert.equal(clearMcAfee(book([5, 4], [6, 7])).tradedUnits, 0);
  assert.equal(clearMcAfee(book([5, 4], [])).tradedUnits, 0);
  assert.equal(clearMcAfee([]).rule, "none");
});

test("a single crossing pair is dropped entirely (cost of truthfulness)", () => {
  assert.equal(clearMcAfee(book([10], [1])).tradedUnits, 0);
});

test("results do not depend on input order", () => {
  const orders = book([10, 8, 6, 4], [1, 3, 5, 7]);
  const a = clearMcAfee(orders);
  const b = clearMcAfee([...orders].reverse());
  assert.equal(a.buyerPrice, b.buyerPrice);
  assert.deepEqual([...a.fills].sort(), [...b.fills].sort());
});

test("randomized invariants", () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let run = 0; run < 3000; run += 1) {
    const orders: McOrder[] = [];
    const n = Math.floor(rnd() * 14);
    for (let i = 0; i < n; i += 1) {
      orders.push({
        id: `o${i}`,
        side: rnd() < 0.5 ? "buy" : "sell",
        units: 1 + Math.floor(rnd() * 5_000_000),
        price: 90 + Math.floor(rnd() * 200) / 10,
      });
    }
    const r = clearMcAfee(orders);
    let buyFill = 0;
    let sellFill = 0;
    for (const order of orders) {
      const fill = r.fills.get(order.id) ?? 0;
      assert.ok(fill >= 0 && fill <= order.units, "no over-fill");
      if (fill > 0) {
        if (order.side === "buy") {
          buyFill += fill;
          assert.ok(order.price >= (r.buyerPrice as number), "buyer never pays above limit");
        } else {
          sellFill += fill;
          assert.ok(order.price <= (r.sellerPrice as number), "seller never paid below limit");
        }
      }
    }
    assert.equal(buyFill, r.tradedUnits);
    assert.equal(sellFill, r.tradedUnits);
    assert.ok(r.mechanismSurplus >= 0, "weakly budget balanced");
  }
});
