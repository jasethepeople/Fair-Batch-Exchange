/**
 * Seeded tests of unilateral shading, order splitting, and coordinated
 * same-side shading under shallow or deep synthetic books.
 *
 * Run: pnpm --filter @workspace/api-server run strategy:risk
 * Deep book: DEPTH=60 pnpm --filter @workspace/api-server run strategy:risk
 */
import { clearMaxVolume, type VolumeOrder } from "../src/lib/max-volume";
import { clearMcAfee, type McOrder } from "../src/lib/mcafee";

const UNIT_SCALE = 1_000_000;
const depth = Number(process.env.DEPTH ?? 0);
const scenarioCount = depth > 0 ? 75 : 100;
let seed = 20261014;
let identityCounter = 0;

const random = () =>
  (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const round = (value: number, digits: number) =>
  Math.round(value * 10 ** digits) / 10 ** digits;

type Side = "buy" | "sell";
type Spec = {
  id: string;
  tieBreaker: string;
  side: Side;
  quantity: number;
  limitPrice: number;
};
type Outcome = {
  fills: Map<string, number>;
  buyerPrice: number | null;
  sellerPrice: number | null;
};
type Outcomes = { maxVolume: Outcome; mcafee: Outcome };

const demoOrders: Spec[] = [
  { id: "demo-b1", tieBreaker: "demo-b1", side: "buy", quantity: 2.5, limitPrice: 101.2 },
  { id: "demo-b2", tieBreaker: "demo-b2", side: "buy", quantity: 3, limitPrice: 99.8 },
  { id: "demo-s1", tieBreaker: "demo-s1", side: "sell", quantity: 1.25, limitPrice: 98.6 },
  { id: "demo-s2", tieBreaker: "demo-s2", side: "sell", quantity: 2.5, limitPrice: 100.1 },
  { id: "demo-s3", tieBreaker: "demo-s3", side: "sell", quantity: 2, limitPrice: 101.2 },
];

function identity(prefix: string): string {
  const randomPart = Math.floor(random() * 1_000_000_000).toString().padStart(9, "0");
  return `${prefix}-${randomPart}-${identityCounter++}`;
}

function makeOrder(side: Side, quantity: number, limitPrice: number): Spec {
  const id = identity("order");
  return {
    id,
    tieBreaker: identity("commitment"),
    side,
    quantity,
    limitPrice,
  };
}

function randomOthers(): Spec[] {
  const count = depth > 0 ? depth : 2 + Math.floor(random() * 7);
  return Array.from({ length: count }, () =>
    makeOrder(
      random() < 0.5 ? "buy" : "sell",
      depth > 0 ? round(0.02 + random() * 0.2, 2) : round(0.1 + random() * 2, 2),
      round(95 + random() * 10, 2),
    ),
  );
}

function clear(orders: Spec[], includeDemoOrders = true): Outcomes {
  const book = includeDemoOrders ? [...demoOrders, ...orders] : orders;
  const maxOrders: VolumeOrder[] = book.map((order) => ({
    id: order.id,
    side: order.side,
    units: Math.round(order.quantity * UNIT_SCALE),
    price: order.limitPrice,
    tieBreaker: order.tieBreaker,
  }));
  const mcOrders: McOrder[] = book.map((order) => ({
    id: order.id,
    side: order.side,
    units: Math.round(order.quantity * UNIT_SCALE),
    price: order.limitPrice,
  }));

  const max = clearMaxVolume(maxOrders, 100);
  const mc = clearMcAfee(mcOrders);
  return {
    maxVolume: {
      fills: max.fills,
      buyerPrice: max.price,
      sellerPrice: max.price,
    },
    mcafee: {
      fills: mc.fills,
      buyerPrice: mc.buyerPrice,
      sellerPrice: mc.sellerPrice,
    },
  };
}

function utility(
  outcome: Outcome,
  ids: string[],
  side: Side,
  trueValueOrCost: number,
): number {
  const settlementPrice = side === "buy" ? outcome.buyerPrice : outcome.sellerPrice;
  if (settlementPrice === null) return 0;
  const fill = ids.reduce(
    (total, id) => total + (outcome.fills.get(id) ?? 0),
    0,
  ) / UNIT_SCALE;
  return side === "buy"
    ? fill * (trueValueOrCost - settlementPrice)
    : fill * (settlementPrice - trueValueOrCost);
}

function summarize(gains: number[]) {
  const sorted = [...gains].sort((a, b) => a - b);
  const percentile = (value: number) =>
    round(sorted[Math.min(sorted.length - 1, Math.ceil(value * sorted.length) - 1)] ?? 0, 6);
  return {
    averageBestGain: round(gains.reduce((sum, gain) => sum + gain, 0) / gains.length, 6),
    scenariosWithPositiveGainPct: round(
      (gains.filter((gain) => gain > 1e-9).length / gains.length) * 100,
      1,
    ),
    p95Gain: percentile(0.95),
    maxGain: percentile(1),
  };
}

function summarizeUtilityChange(changes: number[]) {
  const summary = summarize(changes);
  return {
    averageUtilityChange: summary.averageBestGain,
    scenariosWithPositiveChangePct: summary.scenariosWithPositiveGainPct,
    p95UtilityChange: summary.p95Gain,
    maxUtilityChange: summary.maxGain,
  };
}

function shading(side: Side, quantity: number) {
  const gains = { maxVolume: [] as number[], mcafee: [] as number[] };
  const truthfulUtilityTotal = { maxVolume: 0, mcafee: 0 };

  for (let scenario = 0; scenario < scenarioCount; scenario += 1) {
    const others = randomOthers();
    const trueValueOrCost = round(98 + random() * 5, 2);
    const strategicOrder = makeOrder(side, quantity, trueValueOrCost);
    const shades = Array.from({ length: 41 }, (_, index) => round(index * 0.1, 1));
    const best = { maxVolume: 0, mcafee: 0 };
    let truthful = { maxVolume: 0, mcafee: 0 };

    for (const shade of shades) {
      const limitPrice = side === "buy"
        ? round(trueValueOrCost - shade, 2)
        : round(trueValueOrCost + shade, 2);
      const result = clear([...others, { ...strategicOrder, limitPrice }]);
      const buyerUtility = utility(result.maxVolume, [strategicOrder.id], side, trueValueOrCost);
      const mcAfeeUtility = utility(result.mcafee, [strategicOrder.id], side, trueValueOrCost);
      if (shade === 0) {
        truthful = { maxVolume: buyerUtility, mcafee: mcAfeeUtility };
      }
      best.maxVolume = Math.max(best.maxVolume, buyerUtility);
      best.mcafee = Math.max(best.mcafee, mcAfeeUtility);
    }

    truthfulUtilityTotal.maxVolume += truthful.maxVolume;
    truthfulUtilityTotal.mcafee += truthful.mcafee;
    gains.maxVolume.push(best.maxVolume - truthful.maxVolume);
    gains.mcafee.push(best.mcafee - truthful.mcafee);
  }

  return {
    side,
    orderSize: quantity,
    scenarios: scenarioCount,
    averageTruthfulUtility: {
      maxVolume: round(truthfulUtilityTotal.maxVolume / scenarioCount, 6),
      mcafee: round(truthfulUtilityTotal.mcafee / scenarioCount, 6),
    },
    maxVolume: summarize(gains.maxVolume),
    mcafee: summarize(gains.mcafee),
  };
}

function splitQuantity(quantity: number, pieces: number): number[] {
  const totalUnits = Math.round(quantity * UNIT_SCALE);
  const baseUnits = Math.floor(totalUnits / pieces);
  let remainder = totalUnits - baseUnits * pieces;
  return Array.from({ length: pieces }, () => {
    const units = baseUnits + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return units / UNIT_SCALE;
  });
}

function orderSplitting(side: Side, quantity: number, pieces: number) {
  const gains = { maxVolume: [] as number[], mcafee: [] as number[] };

  for (let scenario = 0; scenario < scenarioCount; scenario += 1) {
    const trueValueOrCost = side === "buy" ? 102 : 98;
    const commonLimit = 100;
    const totalUnits = Math.round(quantity * UNIT_SCALE);
    let crossingUnits = Math.ceil((4 * totalUnits) / 3);
    if (crossingUnits % 2 !== 0) crossingUnits += 1;
    const peer = makeOrder(side, quantity, commonLimit);
    const counterparty = makeOrder(
      side === "buy" ? "sell" : "buy",
      crossingUnits / UNIT_SCALE,
      side === "buy" ? 99 : 101,
    );
    const single = makeOrder(side, quantity, commonLimit);
    const baseline = clear([peer, counterparty, single], false);
    const baseUtility = {
      maxVolume: utility(baseline.maxVolume, [single.id], side, trueValueOrCost),
      mcafee: utility(baseline.mcafee, [single.id], side, trueValueOrCost),
    };

    const splitOrders = splitQuantity(quantity, pieces).map((piece) =>
      makeOrder(side, piece, commonLimit),
    );
    const split = clear([peer, counterparty, ...splitOrders], false);
    const splitIds = splitOrders.map((order) => order.id);
    gains.maxVolume.push(
      utility(split.maxVolume, splitIds, side, trueValueOrCost) - baseUtility.maxVolume,
    );
    gains.mcafee.push(
      utility(split.mcafee, splitIds, side, trueValueOrCost) - baseUtility.mcafee,
    );
  }

  return {
    side,
    totalOrderSize: quantity,
    pieces,
    scenarios: scenarioCount,
    maxVolume: summarizeUtilityChange(gains.maxVolume),
    mcafee: summarizeUtilityChange(gains.mcafee),
  };
}

function coordinatedBuyerShading(quantityEach: number) {
  const gains = { maxVolume: [] as number[], mcafee: [] as number[] };

  for (let scenario = 0; scenario < scenarioCount; scenario += 1) {
    const others = randomOthers();
    const buyerValues = [
      round(98 + random() * 5, 2),
      round(98 + random() * 5, 2),
    ];
    const members = buyerValues.map((value) => makeOrder("buy", quantityEach, value));
    const truthfulOrders = members.map((member, index) => ({
      ...member,
      limitPrice: buyerValues[index],
    }));
    const truthfulResult = clear([...others, ...truthfulOrders]);
    const truthfulUtility = {
      maxVolume: members.reduce(
        (total, member, index) =>
          total + utility(truthfulResult.maxVolume, [member.id], "buy", buyerValues[index]),
        0,
      ),
      mcafee: members.reduce(
        (total, member, index) =>
          total + utility(truthfulResult.mcafee, [member.id], "buy", buyerValues[index]),
        0,
      ),
    };

    const best = { maxVolume: truthfulUtility.maxVolume, mcafee: truthfulUtility.mcafee };
    for (let shade = 0; shade <= 4; shade = round(shade + 0.1, 1)) {
      const shadedOrders = members.map((member, index) => ({
        ...member,
        limitPrice: round(buyerValues[index] - shade, 2),
      }));
      const result = clear([...others, ...shadedOrders]);
      best.maxVolume = Math.max(
        best.maxVolume,
        members.reduce(
          (total, member, index) =>
            total + utility(result.maxVolume, [member.id], "buy", buyerValues[index]),
          0,
        ),
      );
      best.mcafee = Math.max(
        best.mcafee,
        members.reduce(
          (total, member, index) =>
            total + utility(result.mcafee, [member.id], "buy", buyerValues[index]),
          0,
        ),
      );
    }

    gains.maxVolume.push(best.maxVolume - truthfulUtility.maxVolume);
    gains.mcafee.push(best.mcafee - truthfulUtility.mcafee);
  }

  return {
    coalition: "two buyers shading bids by the same amount",
    quantityPerBuyer: quantityEach,
    scenarios: scenarioCount,
    maxVolume: summarize(gains.maxVolume),
    mcafee: summarize(gains.mcafee),
  };
}

const largeSize = depth > 0 ? 1 : 4;
console.log(JSON.stringify({
  experiment: "unilateral limit-price shading",
  syntheticOtherOrdersPerBook: depth > 0 ? depth : "random 2-8",
  scenariosPerCase: scenarioCount,
  shadeRange: "0.0 to 4.0 in 0.1 increments",
  results: [
    shading("buy", 0.05),
    shading("buy", largeSize),
    shading("sell", 0.05),
    shading("sell", largeSize),
  ],
}, null, 2));

console.log(JSON.stringify({
  experiment: "same-price order splitting",
  note: "A controlled marginal-price tie book isolates allocation remainder effects. Splits keep total quantity and limit price unchanged; owner utility assumes a buyer value of 102 or seller cost of 98.",
  results: (["buy", "sell"] as const).flatMap((side) =>
    [0.05, largeSize].flatMap((quantity) =>
      [2, 4].map((pieces) => orderSplitting(side, quantity, pieces)),
    ),
  ),
}, null, 2));

console.log(JSON.stringify({
  experiment: "coordinated same-side shading",
  note: "Two buyers coordinate a common bid reduction; no cross-side cartel or side payment is modeled.",
  results: [coordinatedBuyerShading(0.05)],
}, null, 2));
