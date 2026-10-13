/**
 * McAfee (1992) double auction, adapted to divisible quantities.
 *
 * Quantity is represented in integer micro-units. Units are ranked by price
 * priority, and orders tied at the marginal price share fills pro rata.
 *
 * The rule first finds the largest crossing unit k. If the midpoint formed by
 * the next bid and ask is inside the marginal bid/ask interval, k units trade
 * at that uniform price. Otherwise it trades k - 1 units: buyers pay bid_k,
 * sellers receive ask_k, and the mechanism retains the spread.
 *
 * McAfee's classic truthfulness guarantee is for single-unit traders. This
 * divisible-order adaptation is not strategy-proof; see the comparison report.
 */

export type McSide = "buy" | "sell";

export type McOrder = {
  id: string;
  side: McSide;
  /** Integer micro-units. */
  units: number;
  /** Limit price, in any consistent scale. */
  price: number;
};

export type McRule = "none" | "uniform" | "trade-reduction";

export type McResult = {
  rule: McRule;
  tradedUnits: number;
  /** Price every buyer pays per unit, or null when nothing trades. */
  buyerPrice: number | null;
  /** Price every seller receives per unit, or null when nothing trades. */
  sellerPrice: number | null;
  /** Units filled per order id; unfilled orders are omitted. */
  fills: Map<string, number>;
  /** (buyerPrice - sellerPrice) * tradedUnits, in price × micro-unit scale. */
  mechanismSurplus: number;
};

type Ranked = { sorted: McOrder[]; cumulative: number[]; total: number };

function rank(orders: McOrder[], side: McSide): Ranked {
  const sorted = orders
    .filter((order) => order.side === side && order.units > 0)
    .sort(
      (a, b) =>
        (side === "buy" ? b.price - a.price : a.price - b.price) ||
        a.id.localeCompare(b.id),
    );
  const cumulative: number[] = [];
  let running = 0;
  for (const order of sorted) {
    running += order.units;
    if (!Number.isSafeInteger(running)) {
      throw new RangeError("Aggregate order quantity exceeds safe integer precision.");
    }
    cumulative.push(running);
  }
  return { sorted, cumulative, total: running };
}

/** Price of the j-th unit (1-based) in a ranked book, or null past the end. */
function priceAtUnit(book: Ranked, j: number): number | null {
  if (j < 1 || j > book.total) return null;
  let lo = 0;
  let hi = book.cumulative.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (book.cumulative[mid] >= j) hi = mid;
    else lo = mid + 1;
  }
  return book.sorted[lo]?.price ?? null;
}

/** Fill the best-priced `target` units; split the marginal price level pro rata. */
function allocate(book: Ranked, target: number): Map<string, number> {
  const fills = new Map<string, number>();
  if (target <= 0) return fills;

  const groups: McOrder[][] = [];
  for (const order of book.sorted) {
    const last = groups[groups.length - 1];
    if (last && last[0].price === order.price) last.push(order);
    else groups.push([order]);
  }

  let remaining = target;
  for (const group of groups) {
    if (remaining <= 0) break;
    const groupUnits = group.reduce((sum, order) => sum + order.units, 0);
    if (groupUnits <= remaining) {
      for (const order of group) fills.set(order.id, order.units);
      remaining -= groupUnits;
      continue;
    }

    const denominator = BigInt(groupUnits);
    const targetUnits = BigInt(remaining);
    let assigned = 0;
    const parts = group.map((order) => {
      const numerator = BigInt(order.units) * targetUnits;
      const floor = Number(numerator / denominator);
      fills.set(order.id, floor);
      assigned += floor;
      return { id: order.id, remainder: numerator % denominator };
    });
    parts.sort(
      (a, b) =>
        (a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : 0) ||
        a.id.localeCompare(b.id),
    );
    for (let i = 0; i < remaining - assigned; i += 1) {
      fills.set(parts[i].id, (fills.get(parts[i].id) ?? 0) + 1);
    }
    remaining = 0;
  }

  for (const [id, units] of fills) if (units === 0) fills.delete(id);
  return fills;
}

const noTrade = (): McResult => ({
  rule: "none",
  tradedUnits: 0,
  buyerPrice: null,
  sellerPrice: null,
  fills: new Map(),
  mechanismSurplus: 0,
});

export function clearMcAfee(orders: McOrder[]): McResult {
  const seen = new Set<string>();
  for (const order of orders) {
    if (!order.id || seen.has(order.id)) {
      throw new Error("McAfee orders must have unique, non-empty ids.");
    }
    seen.add(order.id);
    if (!Number.isSafeInteger(order.units) || order.units < 0) {
      throw new RangeError("McAfee order quantities must be non-negative safe integers.");
    }
    if (!Number.isFinite(order.price)) {
      throw new RangeError("McAfee order prices must be finite numbers.");
    }
  }

  const bids = rank(orders, "buy");
  const asks = rank(orders, "sell");
  const reach = Math.min(bids.total, asks.total);
  const crosses = (j: number) =>
    (priceAtUnit(bids, j) as number) >= (priceAtUnit(asks, j) as number);

  if (reach === 0 || !crosses(1)) return noTrade();

  // Sorted bid and ask prices make the crossing condition monotone.
  let lo = 1;
  let hi = reach;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (crosses(mid)) lo = mid;
    else hi = mid - 1;
  }
  const k = lo;

  const bidK = priceAtUnit(bids, k) as number;
  const askK = priceAtUnit(asks, k) as number;
  const bidNext = priceAtUnit(bids, k + 1);
  const askNext = priceAtUnit(asks, k + 1);

  if (bidNext !== null && askNext !== null) {
    const price = (bidNext + askNext) / 2;
    if (askK <= price && price <= bidK) {
      return {
        rule: "uniform",
        tradedUnits: k,
        buyerPrice: price,
        sellerPrice: price,
        fills: new Map([...allocate(bids, k), ...allocate(asks, k)]),
        mechanismSurplus: 0,
      };
    }
  }

  const tradedUnits = k - 1;
  if (tradedUnits <= 0) return noTrade();
  return {
    rule: "trade-reduction",
    tradedUnits,
    buyerPrice: bidK,
    sellerPrice: askK,
    fills: new Map([
      ...allocate(bids, tradedUnits),
      ...allocate(asks, tradedUnits),
    ]),
    mechanismSurplus: (bidK - askK) * tradedUnits,
  };
}
