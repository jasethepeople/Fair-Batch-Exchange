/**
 * McAfee (1992) double auction, adapted to divisible quantities.
 *
 * Every order is treated as `units` identical one-unit orders at its limit
 * price (integer micro-units, like the main engine). Units are ranked by price
 * priority: bids high-to-low, asks low-to-high.
 *
 *   1. k = the largest unit index where the k-th bid >= the k-th ask.
 *   2. p = midpoint of the (k+1)-th bid and (k+1)-th ask (if both exist).
 *   3. If ask_k <= p <= bid_k, trade k units at the single price p.
 *      Otherwise trade k-1 units: buyers pay bid_k, sellers receive ask_k,
 *      and the spread is kept by the mechanism (trade reduction).
 *
 * Pure and deterministic: no clock, no randomness, no I/O.
 * Orders at the same price are ordered by id so results are reproducible.
 *
 * Caveat: McAfee's truthfulness proof covers single-unit traders. A trader who
 * holds several units around the margin can still influence the price.
 * See scripts/compare-mechanisms.ts for measurements.
 */

export type McSide = "buy" | "sell";

export type McOrder = {
  id: string;
  side: McSide;
  /** Integer micro-units. */
  units: number;
  /** Limit price (any consistent scale). */
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
  /** Units filled per order id (orders with no fill are omitted). */
  fills: Map<string, number>;
  /** (buyerPrice - sellerPrice) * tradedUnits; zero under the uniform rule. */
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
    cumulative.push(running);
  }
  return { sorted, cumulative, total: running };
}

/** Price of the j-th unit (1-based) in a ranked book, or null past the end. */
function priceAtUnit(book: Ranked, j: number): number | null {
  if (j < 1 || j > book.total) return null;
  for (let i = 0; i < book.cumulative.length; i += 1) {
    if (book.cumulative[i] >= j) return book.sorted[i].price;
  }
  return null;
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

    let assigned = 0;
    const parts = group.map((order) => {
      const exact = (order.units * remaining) / groupUnits;
      const floor = Math.floor(exact);
      fills.set(order.id, floor);
      assigned += floor;
      return { id: order.id, fraction: exact - floor };
    });
    parts.sort((a, b) => b.fraction - a.fraction || a.id.localeCompare(b.id));
    for (let i = 0; i < remaining - assigned; i += 1) {
      fills.set(parts[i].id, (fills.get(parts[i].id) ?? 0) + 1);
    }
    remaining = 0;
  }

  for (const [id, units] of fills) if (units === 0) fills.delete(id);
  return fills;
}

const NO_TRADE: McResult = {
  rule: "none",
  tradedUnits: 0,
  buyerPrice: null,
  sellerPrice: null,
  fills: new Map(),
  mechanismSurplus: 0,
};

export function clearMcAfee(orders: McOrder[]): McResult {
  const bids = rank(orders, "buy");
  const asks = rank(orders, "sell");
  const reach = Math.min(bids.total, asks.total);
  const crosses = (j: number) =>
    (priceAtUnit(bids, j) as number) >= (priceAtUnit(asks, j) as number);

  if (reach === 0 || !crosses(1)) return { ...NO_TRADE, fills: new Map() };

  // The spread between the j-th bid and j-th ask only shrinks as j grows,
  // so the largest crossing j can be found by binary search.
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
    const p = (bidNext + askNext) / 2;
    if (askK <= p && p <= bidK) {
      const buys = allocate(bids, k);
      const sells = allocate(asks, k);
      return {
        rule: "uniform",
        tradedUnits: k,
        buyerPrice: p,
        sellerPrice: p,
        fills: new Map([...buys, ...sells]),
        mechanismSurplus: 0,
      };
    }
  }

  const traded = k - 1;
  if (traded <= 0) return { ...NO_TRADE, fills: new Map() };
  return {
    rule: "trade-reduction",
    tradedUnits: traded,
    buyerPrice: bidK,
    sellerPrice: askK,
    fills: new Map([...allocate(bids, traded), ...allocate(asks, traded)]),
    mechanismSurplus: (bidK - askK) * traded,
  };
}
