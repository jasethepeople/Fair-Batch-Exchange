/** Max-volume uniform-price policy retained as a research comparator. */
export type VolumeSide = "buy" | "sell";

export type VolumeOrder = {
  id: string;
  side: VolumeSide;
  units: number;
  price: number;
  tieBreaker: string;
};

export type VolumeResult = {
  price: number | null;
  tradedUnits: number;
  fills: Map<string, number>;
};

type Candidate = { price: number; volume: number; imbalance: number };

function totalUnits(orders: VolumeOrder[]): number {
  return orders.reduce((total, order) => total + order.units, 0);
}

function allocateProRata(
  orders: VolumeOrder[],
  targetUnits: number,
): Map<string, number> {
  const allocations = new Map<string, number>();
  const groupUnits = totalUnits(orders);
  if (targetUnits <= 0 || groupUnits <= 0) return allocations;

  let assignedUnits = 0;
  const remainders = orders.map((order) => {
    const numerator = BigInt(order.units) * BigInt(targetUnits);
    const denominator = BigInt(groupUnits);
    const floor = Number(numerator / denominator);
    allocations.set(order.id, floor);
    assignedUnits += floor;
    return { id: order.id, remainder: numerator % denominator, tieBreaker: order.tieBreaker };
  });

  remainders.sort(
    (left, right) =>
      (left.remainder > right.remainder ? -1 : left.remainder < right.remainder ? 1 : 0) ||
      left.tieBreaker.localeCompare(right.tieBreaker),
  );

  for (let index = 0; index < targetUnits - assignedUnits; index += 1) {
    const recipient = remainders[index];
    if (recipient) {
      allocations.set(recipient.id, (allocations.get(recipient.id) ?? 0) + 1);
    }
  }
  return allocations;
}

function allocateSide(
  orders: VolumeOrder[],
  side: VolumeSide,
  price: number,
  targetUnits: number,
): Map<string, number> {
  const eligible = orders
    .filter((order) =>
      side === "buy"
        ? order.side === "buy" && order.price >= price
        : order.side === "sell" && order.price <= price,
    )
    .sort((left, right) =>
      (side === "buy" ? right.price - left.price : left.price - right.price) ||
      left.tieBreaker.localeCompare(right.tieBreaker),
    );

  const byPrice = new Map<number, VolumeOrder[]>();
  for (const order of eligible) {
    const group = byPrice.get(order.price) ?? [];
    group.push(order);
    byPrice.set(order.price, group);
  }

  const priceGroups = [...byPrice.entries()].sort(([left], [right]) =>
    side === "buy" ? right - left : left - right,
  );
  const allocations = new Map<string, number>();
  let remainingUnits = targetUnits;

  for (const [, group] of priceGroups) {
    if (remainingUnits <= 0) break;
    const groupUnits = totalUnits(group);
    if (groupUnits <= remainingUnits) {
      for (const order of group) allocations.set(order.id, order.units);
      remainingUnits -= groupUnits;
      continue;
    }
    for (const [orderId, quantityUnits] of allocateProRata(group, remainingUnits)) {
      allocations.set(orderId, quantityUnits);
    }
    remainingUnits = 0;
  }
  return allocations;
}

export function clearMaxVolume(
  orders: VolumeOrder[],
  referencePrice: number,
): VolumeResult {
  const candidatePrices = [
    ...new Set([
      referencePrice,
      ...orders.map((order) => Number(order.price.toFixed(8))),
    ]),
  ];
  let best: Candidate | null = null;

  for (const price of candidatePrices) {
    const demand = totalUnits(
      orders.filter((order) => order.side === "buy" && order.price >= price),
    );
    const supply = totalUnits(
      orders.filter((order) => order.side === "sell" && order.price <= price),
    );
    const candidate = {
      price,
      volume: Math.min(demand, supply),
      imbalance: Math.abs(demand - supply),
    };

    if (!best || candidate.volume > best.volume) {
      best = candidate;
      continue;
    }
    if (candidate.volume < best.volume || candidate.imbalance > best.imbalance) continue;
    if (candidate.imbalance < best.imbalance) {
      best = candidate;
      continue;
    }

    const distance = Math.abs(candidate.price - referencePrice);
    const bestDistance = Math.abs(best.price - referencePrice);
    if (distance < bestDistance || (distance === bestDistance && candidate.price < best.price)) {
      best = candidate;
    }
  }

  if (!best || best.volume <= 0) {
    return { price: null, tradedUnits: 0, fills: new Map() };
  }

  return {
    price: best.price,
    tradedUnits: best.volume,
    fills: new Map([
      ...allocateSide(orders, "buy", best.price, best.volume),
      ...allocateSide(orders, "sell", best.price, best.volume),
    ]),
  };
}
