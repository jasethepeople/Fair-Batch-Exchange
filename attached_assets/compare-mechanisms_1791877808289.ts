/**
 * Compares the engine's max-volume uniform-price rule with the McAfee double
 * auction on identical order sets.
 *
 * Run:  npx tsx scripts/compare-mechanisms.ts
 *
 * Experiment 1 - efficiency: realized gains from trade and volume.
 * Experiment 2 - manipulation: how much can one trader gain by shading a limit
 *   price, for a small order versus a large one?
 */
import {
  cancelSealedOrder,
  clearActiveBatch,
  getExchangeSnapshot,
  runExchangeScenario,
  submitSealedOrder,
} from "../src/lib/exchange-engine";
import { clearMcAfee, type McOrder } from "../src/lib/mcafee";

const U = 1_000_000;
let seed = 2026;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

type Spec = { side: "buy" | "sell"; quantity: number; limitPrice: number };

// DEPTH=0 (default): thin books, 2-8 extra orders of 0.1-2.1 units.
// DEPTH=n: deep books, n extra orders of 0.02-0.22 units.
const DEPTH = Number(process.env.DEPTH ?? 0);

function randomOthers(): Spec[] {
  const n = DEPTH > 0 ? DEPTH : 2 + Math.floor(rnd() * 7);
  return Array.from({ length: n }, () => ({
    side: rnd() < 0.5 ? ("buy" as const) : ("sell" as const),
    quantity: DEPTH > 0 ? round(0.02 + rnd() * 0.2, 2) : round(0.1 + rnd() * 2, 2),
    limitPrice: round(95 + rnd() * 10, 2),
  }));
}

type Outcome = {
  engine: { fill: number; price: number | null; welfare: number; volume: number };
  mcafee: { fill: number; price: number | null; welfare: number; volume: number; surplus: number };
};

/** Run one batch through both mechanisms. `mineId` is the order we track. */
function runBoth(specs: Spec[], mine?: Spec): Outcome & { mineFillEngine: number; mineFillMc: number } {
  runExchangeScenario("reset");
  for (const o of getExchangeSnapshot().orders) if (o.isMine) cancelSealedOrder(o.id);
  for (const s of specs) submitSealedOrder(s as never);
  const mineId = mine ? submitSealedOrder(mine as never).id : null;
  const snap = clearActiveBatch(getExchangeSnapshot().batch.id);

  const live = snap.orders.filter((o) => o.side && o.limitPrice !== null && o.quantity !== null);
  const mc: McOrder[] = live.map((o) => ({
    id: o.id,
    side: o.side as "buy" | "sell",
    units: Math.round((o.quantity as number) * U),
    price: o.limitPrice as number,
  }));
  const r = clearMcAfee(mc);

  let engineWelfare = 0;
  for (const o of live) {
    const sign = o.side === "buy" ? 1 : -1;
    engineWelfare += sign * o.filledQuantity * (o.limitPrice as number);
  }
  let mcWelfare = 0;
  for (const o of mc) {
    const sign = o.side === "buy" ? 1 : -1;
    mcWelfare += sign * ((r.fills.get(o.id) ?? 0) / U) * o.price;
  }

  const mineEngine = snap.orders.find((o) => o.id === mineId);
  return {
    engine: {
      fill: mineEngine?.filledQuantity ?? 0,
      price: snap.batch.clearingPrice ?? null,
      welfare: engineWelfare,
      volume: snap.batch.matchedVolume,
    },
    mcafee: {
      fill: (r.fills.get(mineId ?? "") ?? 0) / U,
      price: r.buyerPrice,
      welfare: mcWelfare,
      volume: r.tradedUnits / U,
      surplus: r.mechanismSurplus / U,
    },
    mineFillEngine: mineEngine?.filledQuantity ?? 0,
    mineFillMc: (r.fills.get(mineId ?? "") ?? 0) / U,
  };
}

// ---------------------------------------------------------------- Experiment 1
{
  const N = DEPTH > 0 ? 300 : 2000;
  let volE = 0, volM = 0, welE = 0, welM = 0, surplus = 0, reduction = 0, uniform = 0;
  for (let i = 0; i < N; i += 1) {
    const out = runBoth(randomOthers());
    volE += out.engine.volume;
    volM += out.mcafee.volume;
    welE += out.engine.welfare;
    welM += out.mcafee.welfare;
    surplus += out.mcafee.surplus;
    // classify the McAfee rule by whether buyer and seller prices differ
  }
  console.log("EXPERIMENT 1: efficiency over", N, "random batches");
  console.log({
    volumeRatio: round(volM / volE, 6),
    welfareRatio: round(welM / welE, 6),
    mechanismSurplusPctOfWelfare: round((surplus / welM) * 100, 4),
  });
  void reduction; void uniform;
}

// ---------------------------------------------------------------- Experiment 2
function manipulation(quantity: number, scenarios: number) {
  const shades = Array.from({ length: 41 }, (_, i) => round(i * 0.1, 1)); // 0.0 .. 4.0
  let gainE = 0, gainM = 0, profitableE = 0, profitableM = 0;
  let utilE0 = 0, utilM0 = 0;
  for (let s = 0; s < scenarios; s += 1) {
    const others = randomOthers();
    const value = round(98 + rnd() * 5, 2); // true value of the strategic buyer
    let bestE = -Infinity, bestM = -Infinity, truthE = 0, truthM = 0;
    for (const d of shades) {
      const out = runBoth(others, { side: "buy", quantity, limitPrice: round(value - d, 2) });
      const uE = out.mineFillEngine * (value - (out.engine.price ?? value));
      const uM = out.mineFillMc * (value - (out.mcafee.price ?? value));
      if (d === 0) { truthE = uE; truthM = uM; }
      bestE = Math.max(bestE, uE);
      bestM = Math.max(bestM, uM);
    }
    gainE += bestE - truthE;
    gainM += bestM - truthM;
    utilE0 += truthE;
    utilM0 += truthM;
    if (bestE - truthE > 1e-9) profitableE += 1;
    if (bestM - truthM > 1e-9) profitableM += 1;
  }
  return {
    orderSize: quantity,
    scenarios,
    avgTruthfulUtility: { maxVolume: round(utilE0 / scenarios, 4), mcAfee: round(utilM0 / scenarios, 4) },
    avgGainFromShading: { maxVolume: round(gainE / scenarios, 4), mcAfee: round(gainM / scenarios, 4) },
    pctScenariosShadingPays: {
      maxVolume: round((profitableE / scenarios) * 100, 1),
      mcAfee: round((profitableM / scenarios) * 100, 1),
    },
  };
}

console.log("\nEXPERIMENT 2: can one buyer profit by under-bidding their true value?");
console.log(JSON.stringify(manipulation(0.05, 100), null, 2));
console.log(JSON.stringify(manipulation(DEPTH > 0 ? 1 : 4, 100), null, 2));
