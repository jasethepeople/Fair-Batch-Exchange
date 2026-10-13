/**
 * Compare the active McAfee rule with the max-volume uniform-price comparator.
 * Both mechanisms receive the exact same deterministic synthetic books.
 *
 * Run: pnpm exec tsx artifacts/api-server/scripts/compare-mechanisms.ts
 * Deep books: DEPTH=60 pnpm exec tsx artifacts/api-server/scripts/compare-mechanisms.ts
 */
import { clearMaxVolume, type VolumeOrder } from "../src/lib/max-volume";
import { clearMcAfee, type McOrder } from "../src/lib/mcafee";

const UNIT_SCALE = 1_000_000;
let seed = 2026;
const random = () =>
  (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const round = (value: number, digits: number) =>
  Math.round(value * 10 ** digits) / 10 ** digits;
const depth = Number(process.env.DEPTH ?? 0);

type Spec = { side: "buy" | "sell"; quantity: number; limitPrice: number };

const demoOrders: Spec[] = [
  { side: "buy", quantity: 2.5, limitPrice: 101.2 },
  { side: "buy", quantity: 3, limitPrice: 99.8 },
  { side: "sell", quantity: 1.25, limitPrice: 98.6 },
  { side: "sell", quantity: 2.5, limitPrice: 100.1 },
  { side: "sell", quantity: 2, limitPrice: 101.2 },
];

function randomOthers(): Spec[] {
  const count = depth > 0 ? depth : 2 + Math.floor(random() * 7);
  return Array.from({ length: count }, () => ({
    side: random() < 0.5 ? "buy" : "sell",
    quantity: depth > 0 ? round(0.02 + random() * 0.2, 2) : round(0.1 + random() * 2, 2),
    limitPrice: round(95 + random() * 10, 2),
  }));
}

function toBooks(specs: Spec[]): { maxVolume: VolumeOrder[]; mcafee: McOrder[] } {
  return {
    maxVolume: specs.map((spec, index) => ({
      id: `order-${index}`,
      side: spec.side,
      units: Math.round(spec.quantity * UNIT_SCALE),
      price: spec.limitPrice,
      tieBreaker: `commitment-${String(index).padStart(6, "0")}`,
    })),
    mcafee: specs.map((spec, index) => ({
      id: `order-${index}`,
      side: spec.side,
      units: Math.round(spec.quantity * UNIT_SCALE),
      price: spec.limitPrice,
    })),
  };
}

function analyze(specs: Spec[]) {
  const allSpecs = [...demoOrders, ...specs];
  const books = toBooks(allSpecs);
  const max = clearMaxVolume(books.maxVolume, 100);
  const mcafee = clearMcAfee(books.mcafee);

  const welfare = (fills: Map<string, number>) =>
    allSpecs.reduce((sum, order, index) => {
      const fill = (fills.get(`order-${index}`) ?? 0) / UNIT_SCALE;
      return sum + (order.side === "buy" ? 1 : -1) * fill * order.limitPrice;
    }, 0);

  return {
    maxVolume: {
      volume: max.tradedUnits / UNIT_SCALE,
      price: max.price,
      welfare: welfare(max.fills),
      buyerPrice: max.price,
      sellerPrice: max.price,
      mechanismSurplus: 0,
      fills: max.fills,
    },
    mcafee: {
      volume: mcafee.tradedUnits / UNIT_SCALE,
      price: mcafee.buyerPrice,
      welfare: welfare(mcafee.fills),
      buyerPrice: mcafee.buyerPrice,
      sellerPrice: mcafee.sellerPrice,
      mechanismSurplus: mcafee.mechanismSurplus / UNIT_SCALE,
      fills: mcafee.fills,
      rule: mcafee.rule,
    },
  };
}

// Experiment 1: efficiency, gains from trade, and surplus retained by McAfee.
{
  const count = depth > 0 ? 300 : 2_000;
  let volumeMax = 0;
  let volumeMcAfee = 0;
  let welfareMax = 0;
  let welfareMcAfee = 0;
  let retainedSurplus = 0;
  let uniformBatches = 0;
  let reducedBatches = 0;

  for (let i = 0; i < count; i += 1) {
    const result = analyze(randomOthers());
    volumeMax += result.maxVolume.volume;
    volumeMcAfee += result.mcafee.volume;
    welfareMax += result.maxVolume.welfare;
    welfareMcAfee += result.mcafee.welfare;
    retainedSurplus += result.mcafee.mechanismSurplus;
    if (result.mcafee.rule === "uniform") uniformBatches += 1;
    if (result.mcafee.rule === "trade-reduction") reducedBatches += 1;
  }

  const safeRatio = (numerator: number, denominator: number) =>
    denominator === 0 ? null : round(numerator / denominator, 6);
  console.log("EXPERIMENT 1: same synthetic books, both mechanisms");
  console.log({
    batches: count,
    volumeRatioMcAfeeToMaxVolume: safeRatio(volumeMcAfee, volumeMax),
    gainsFromTradeRatio: safeRatio(welfareMcAfee, welfareMax),
    retainedMcAfeeSurplusPctOfMcAfeeWelfare:
      welfareMcAfee === 0 ? null : round((retainedSurplus / welfareMcAfee) * 100, 4),
    uniformBatches,
    tradeReductionBatches: reducedBatches,
  });
}

// Experiment 2: buyer utility from truthful bidding versus limit-price shading.
function manipulation(quantity: number, scenarios: number) {
  const shades = Array.from({ length: 41 }, (_, index) => round(index * 0.1, 1));
  let gainMax = 0;
  let gainMcAfee = 0;
  let profitableMax = 0;
  let profitableMcAfee = 0;
  let truthfulUtilityMax = 0;
  let truthfulUtilityMcAfee = 0;

  for (let scenario = 0; scenario < scenarios; scenario += 1) {
    const others = randomOthers();
    const trueValue = round(98 + random() * 5, 2);
    let bestMax = -Infinity;
    let bestMcAfee = -Infinity;
    let truthMax = 0;
    let truthMcAfee = 0;

    for (const shade of shades) {
      const buyer: Spec = {
        side: "buy",
        quantity,
        limitPrice: round(trueValue - shade, 2),
      };
      const specs = [...others, buyer];
      const result = analyze(specs);
      const mineId = `order-${demoOrders.length + specs.length - 1}`;
      const filledMax = (result.maxVolume.fills.get(mineId) ?? 0) / UNIT_SCALE;
      const filledMcAfee = (result.mcafee.fills.get(mineId) ?? 0) / UNIT_SCALE;
      const utilityMax = filledMax * (trueValue - (result.maxVolume.buyerPrice ?? trueValue));
      const utilityMcAfee = filledMcAfee * (trueValue - (result.mcafee.buyerPrice ?? trueValue));
      if (shade === 0) {
        truthMax = utilityMax;
        truthMcAfee = utilityMcAfee;
      }
      bestMax = Math.max(bestMax, utilityMax);
      bestMcAfee = Math.max(bestMcAfee, utilityMcAfee);
    }

    gainMax += bestMax - truthMax;
    gainMcAfee += bestMcAfee - truthMcAfee;
    truthfulUtilityMax += truthMax;
    truthfulUtilityMcAfee += truthMcAfee;
    if (bestMax - truthMax > 1e-9) profitableMax += 1;
    if (bestMcAfee - truthMcAfee > 1e-9) profitableMcAfee += 1;
  }

  return {
    orderSize: quantity,
    scenarios,
    avgTruthfulUtility: {
      maxVolume: round(truthfulUtilityMax / scenarios, 4),
      mcAfee: round(truthfulUtilityMcAfee / scenarios, 4),
    },
    avgGainFromShading: {
      maxVolume: round(gainMax / scenarios, 4),
      mcAfee: round(gainMcAfee / scenarios, 4),
    },
    pctScenariosShadingPays: {
      maxVolume: round((profitableMax / scenarios) * 100, 1),
      mcAfee: round((profitableMcAfee / scenarios) * 100, 1),
    },
  };
}

console.log("\nEXPERIMENT 2: can one buyer gain by under-bidding their true value?");
console.log(JSON.stringify(manipulation(0.05, 100), null, 2));
console.log(JSON.stringify(manipulation(depth > 0 ? 1 : 4, 100), null, 2));
