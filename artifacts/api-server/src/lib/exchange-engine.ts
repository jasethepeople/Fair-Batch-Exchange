import { createHash, randomUUID } from "node:crypto";
import type {
  AuditEvent,
  AuditEventStatus,
  AuctionBatch,
  Committee,
  CommitteeMember,
  ExchangeSnapshot,
  ExchangeStats,
  Market,
  Order,
  OrderInput,
} from "@workspace/api-zod";
import { clearMcAfee } from "./mcafee";

const UNIT_SCALE = 1_000_000;
const MAX_AUDIT_EVENTS = 100;
const MAX_BATCH_ORDERS = 5_000;
const THRESHOLD = 3;
const VALIDATOR_COUNT = 5;
const SIMULATION_ONLY = true;

type Side = "buy" | "sell";

type PrivateOrder = Order & {
  side: Side;
  quantity: number;
  limitPrice: number;
  salt: string;
};

type EngineState = {
  market: Market;
  batch: AuctionBatch;
  orders: PrivateOrder[];
  committee: Committee;
  stats: ExchangeStats;
  auditEvents: AuditEvent[];
};

function toUnits(quantity: number): number {
  return Math.round(quantity * UNIT_SCALE);
}

function fromUnits(quantity: number): number {
  return quantity / UNIT_SCALE;
}

function makeOrder(
  batchId: string,
  side: Side,
  quantity: number,
  limitPrice: number,
  ownerLabel: string,
  isMine: boolean,
): PrivateOrder {
  const id = randomUUID();
  const salt = randomUUID();
  const digest = createHash("sha256")
    .update(`${id}:${side}:${quantity}:${limitPrice}:${salt}`)
    .digest("hex");

  return {
    id,
    batchId,
    side,
    quantity,
    limitPrice,
    filledQuantity: 0,
    status: "SEALED",
    commitment: `0x${digest.slice(0, 20)}…`,
    createdAt: new Date(),
    ownerLabel,
    isMine,
    privacyNote: "Order terms hidden until a successful batch reveal.",
    salt,
  };
}

function createCommittee(receivedShares: number): Committee {
  const members: CommitteeMember[] = Array.from(
    { length: VALIDATOR_COUNT },
    (_, index) => {
      const shareReceived = index < receivedShares;
      return {
        id: `validator-${String(index + 1).padStart(2, "0")}`,
        label: `Validator ${String(index + 1).padStart(2, "0")}`,
        status: shareReceived ? "SHARE_RECEIVED" : "READY",
        shareReceived,
      };
    },
  );

  return {
    threshold: THRESHOLD,
    totalMembers: VALIDATOR_COUNT,
    sharesReceived: receivedShares,
    quorumReached: receivedShares >= THRESHOLD,
    members,
  };
}

function addAuditEvent(
  state: EngineState,
  event: string,
  detail: string,
  status: AuditEventStatus = "INFO",
): void {
  state.auditEvents.unshift({
    id: randomUUID(),
    timestamp: new Date(),
    event,
    detail,
    status,
  });
  state.auditEvents = state.auditEvents.slice(0, MAX_AUDIT_EVENTS);
}

function seedOrders(batchId: string): PrivateOrder[] {
  return [
    makeOrder(batchId, "buy", 2.5, 101.2, "Trader 04", false),
    makeOrder(batchId, "buy", 1.75, 100.4, "You", true),
    makeOrder(batchId, "buy", 3, 99.8, "Trader 17", false),
    makeOrder(batchId, "sell", 1.25, 98.6, "Trader 09", false),
    makeOrder(batchId, "sell", 2.5, 100.1, "Trader 22", false),
    makeOrder(batchId, "sell", 2, 101.2, "Trader 31", false),
  ];
}

function createInitialState(
  round: number,
  stats: ExchangeStats,
  auditEvents: AuditEvent[],
): EngineState {
  const batchId = `batch-${randomUUID().slice(0, 8)}`;
  const market: Market = {
    id: "ETH-USD",
    baseAsset: "ETH",
    quoteAsset: "USD",
    referencePrice: 100,
  };
  const batch: AuctionBatch = {
    id: batchId,
    round,
    status: "COLLECTING",
    cutoffAt: new Date(Date.now() + 120_000),
    secondsToCutoff: 120,
    thresholdShares: THRESHOLD,
    sharesReceived: 4,
    quorumReached: true,
    submittedOrderCount: 6,
    clearingRule: "none",
    buyerPrice: null,
    sellerPrice: null,
    matchedVolume: 0,
    mechanismSurplus: 0,
    outcome: null,
  };
  const state: EngineState = {
    market,
    batch,
    orders: seedOrders(batchId),
    committee: createCommittee(4),
    stats,
    auditEvents,
  };

  addAuditEvent(
    state,
    "New batch opened",
    `Batch ${batchId} is accepting sealed limit orders. Auction rules are fixed for this round.`,
  );

  return state;
}

const defaultStats: ExchangeStats = {
  totalVolume: 12.5,
  settledBatches: 17,
  abortedBatches: 1,
  activeOrders: 0,
  lastBuyerPrice: 99.9,
  lastSellerPrice: 99.9,
  lastClearingRule: "uniform",
};

let state = createInitialState(18, defaultStats, []);

function revealOrder(order: PrivateOrder): Order {
  const { salt: _salt, ...publicOrder } = order;
  return {
    ...publicOrder,
    privacyNote:
      order.status === "CANCELLED"
        ? "Cancelled before reveal; order terms remain hidden."
        : "Order terms revealed after threshold-backed batch processing.",
  };
}

function redactOrder(order: PrivateOrder): Order {
  const { salt: _salt, ...publicOrder } = order;
  return {
    ...publicOrder,
    side: null,
    quantity: null,
    limitPrice: null,
    privacyNote:
      order.status === "CANCELLED"
        ? "Cancelled before reveal; order terms remain hidden."
        : "Order terms hidden until a successful batch reveal.",
  };
}

function publicOrder(order: PrivateOrder): Order {
  if (state.batch.status === "SETTLED" && order.status !== "CANCELLED") {
    return revealOrder(order);
  }
  return redactOrder(order);
}

function updateOrderStatusesAfterAbort(): void {
  for (const order of state.orders) {
    if (order.status === "SEALED") {
      order.status = "ABORTED";
    }
  }
}

export function getExchangeSnapshot(): ExchangeSnapshot {
  const secondsToCutoff =
    state.batch.status === "COLLECTING"
      ? Math.max(0, Math.ceil((state.batch.cutoffAt.getTime() - Date.now()) / 1000))
      : 0;
  state.batch.secondsToCutoff = secondsToCutoff;
  state.stats.activeOrders = state.orders.filter(
    (order) => order.status === "SEALED",
  ).length;

  return {
    market: { ...state.market },
    batch: { ...state.batch },
    orders: state.orders.map(publicOrder),
    committee: {
      ...state.committee,
      members: state.committee.members.map((member) => ({ ...member })),
    },
    stats: { ...state.stats },
    auditEvents: state.auditEvents.map((event) => ({ ...event })),
    simulationOnly: SIMULATION_ONLY,
  };
}

export function submitSealedOrder(input: OrderInput): Order {
  if (state.batch.status !== "COLLECTING") {
    throw new Error("This batch is no longer accepting orders.");
  }
  if (Date.now() >= state.batch.cutoffAt.getTime()) {
    throw new Error("The order window has closed. Clear or reset the batch.");
  }
  if (state.batch.submittedOrderCount >= MAX_BATCH_ORDERS) {
    throw new Error(`This demo batch is limited to ${MAX_BATCH_ORDERS} submitted orders.`);
  }

  const order = makeOrder(
    state.batch.id,
    input.side,
    input.quantity,
    input.limitPrice,
    "You",
    true,
  );
  state.orders.unshift(order);
  state.batch.submittedOrderCount += 1;
  addAuditEvent(
    state,
    "Sealed order submitted",
    `A ${input.side} order entered the batch. Its terms remain hidden from other participants.`,
  );

  return redactOrder(order);
}

export function cancelSealedOrder(orderId: string): Order | null {
  const order = state.orders.find((candidate) => candidate.id === orderId);
  if (!order || !order.isMine || order.status !== "SEALED") {
    return null;
  }
  if (state.batch.status !== "COLLECTING") {
    return null;
  }

  order.status = "CANCELLED";
  addAuditEvent(
    state,
    "Order cancelled",
    "A participant withdrew their sealed order before the batch cutoff.",
    "WARNING",
  );

  return redactOrder(order);
}

export function clearActiveBatch(batchId: string): ExchangeSnapshot {
  if (batchId !== state.batch.id) {
    throw new Error("Batch not found.");
  }
  if (state.batch.status !== "COLLECTING") {
    throw new Error("This batch is not available to clear.");
  }
  if (!state.committee.quorumReached) {
    throw new Error("The committee has not reached the threshold. The batch cannot be revealed.");
  }

  state.batch.status = "DECRYPTING";
  state.batch.sharesReceived = state.committee.sharesReceived;
  addAuditEvent(
    state,
    "Threshold reveal started",
    `${state.committee.sharesReceived} of ${state.committee.totalMembers} simulated committee shares were received; threshold is ${state.committee.threshold}.`,
  );

  const liveOrders = state.orders.filter((order) => order.status === "SEALED");
  state.batch.status = "CLEARING";
  const result = clearMcAfee(
    liveOrders.map((order) => ({
      id: order.id,
      side: order.side,
      units: toUnits(order.quantity),
      price: order.limitPrice,
    })),
  );
  const matchedUnits = result.tradedUnits;
  const mechanismSurplus = Number((result.mechanismSurplus / UNIT_SCALE).toFixed(6));

  state.batch.clearingRule = result.rule;
  state.batch.buyerPrice = result.buyerPrice;
  state.batch.sellerPrice = result.sellerPrice;
  state.batch.matchedVolume = fromUnits(matchedUnits);
  state.batch.mechanismSurplus = mechanismSurplus;

  if (matchedUnits === 0) {
    for (const order of liveOrders) {
      order.status = "UNFILLED";
    }
    state.batch.outcome =
      "The McAfee crossing rule found no trade to settle. In particular, a single crossing pair is reduced to zero trades.";
    state.stats.lastBuyerPrice = null;
    state.stats.lastSellerPrice = null;
    state.stats.lastClearingRule = "none";
    addAuditEvent(
      state,
      "Batch settled with no trade",
      state.batch.outcome,
      "WARNING",
    );
  } else {
    for (const order of liveOrders) {
      const fillUnits = result.fills.get(order.id) ?? 0;
      order.filledQuantity = fromUnits(fillUnits);
      if (fillUnits === 0) {
        order.status = "UNFILLED";
      } else if (fillUnits === toUnits(order.quantity)) {
        order.status = "FILLED";
      } else {
        order.status = "PARTIALLY_FILLED";
      }
    }

    const buyerPrice = result.buyerPrice as number;
    const sellerPrice = result.sellerPrice as number;
    const priceText = (price: number) =>
      `${state.market.quoteAsset} ${price.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      })}`;
    state.batch.outcome =
      result.rule === "uniform"
        ? `McAfee uniform-price branch: ${fromUnits(matchedUnits)} ${state.market.baseAsset} traded. Buyers pay ${priceText(buyerPrice)} and sellers receive ${priceText(sellerPrice)}.`
        : `McAfee trade-reduction branch: ${fromUnits(matchedUnits)} ${state.market.baseAsset} traded. Buyers pay ${priceText(buyerPrice)}; sellers receive ${priceText(sellerPrice)}. The mechanism retains ${state.market.quoteAsset} ${mechanismSurplus.toFixed(6)} from the spread.`;
    state.stats.totalVolume += fromUnits(matchedUnits);
    state.stats.lastBuyerPrice = buyerPrice;
    state.stats.lastSellerPrice = sellerPrice;
    state.stats.lastClearingRule = result.rule;
    const event = result.rule === "uniform"
      ? "McAfee uniform-price batch settled"
      : "McAfee trade-reduction batch settled";
    addAuditEvent(
      state,
      event,
      `${fromUnits(matchedUnits)} ${state.market.baseAsset} traded; buyer price ${priceText(buyerPrice)}, seller price ${priceText(sellerPrice)}, mechanism surplus ${state.market.quoteAsset} ${mechanismSurplus.toFixed(6)}.`,
      "SUCCESS",
    );
  }

  state.batch.status = "SETTLED";
  state.batch.outcome ??= "Batch settled.";
  state.stats.settledBatches += 1;
  addAuditEvent(
    state,
    "Batch reveal complete",
    "Order terms are now visible in this simulation after the batch result was fixed.",
    "SUCCESS",
  );

  return getExchangeSnapshot();
}

function abortCurrentBatch(
  reason: string,
  event: string,
  status: AuditEventStatus,
): ExchangeSnapshot {
  state.batch.status = "ABORTED";
  state.batch.clearingRule = "none";
  state.batch.buyerPrice = null;
  state.batch.sellerPrice = null;
  state.batch.matchedVolume = 0;
  state.batch.mechanismSurplus = 0;
  state.batch.outcome = reason;
  updateOrderStatusesAfterAbort();
  state.stats.abortedBatches += 1;
  addAuditEvent(state, event, reason, status);
  return getExchangeSnapshot();
}

export function runExchangeScenario(
  scenario: "reset" | "quorum-failure" | "decryption-timeout" | "invalid-order",
): ExchangeSnapshot {
  if (scenario === "reset") {
    const nextRound = state.batch.round + 1;
    const preservedStats = { ...state.stats };
    const preservedEvents = [...state.auditEvents];
    state = createInitialState(nextRound, preservedStats, preservedEvents);
    addAuditEvent(
      state,
      "Simulation reset",
      "A fresh batch and repeatable demonstration orders are ready.",
      "SUCCESS",
    );
    return getExchangeSnapshot();
  }

  if (state.batch.status !== "COLLECTING") {
    throw new Error("Reset the simulation before running another scenario.");
  }

  if (scenario === "quorum-failure") {
    const receivedShares = THRESHOLD - 1;
    state.committee = createCommittee(receivedShares);
    state.batch.sharesReceived = receivedShares;
    state.batch.quorumReached = false;
    return abortCurrentBatch(
      `Batch aborted: ${receivedShares} of ${THRESHOLD} required committee shares arrived. Sealed terms were not revealed.`,
      "Quorum failure",
      "FAILURE",
    );
  }

  if (scenario === "decryption-timeout") {
    state.committee = createCommittee(THRESHOLD);
    state.batch.sharesReceived = THRESHOLD;
    state.batch.quorumReached = true;
    state.batch.status = "DECRYPTING";
    return abortCurrentBatch(
      "Batch aborted: the simulated reveal did not complete before its timeout. No trade was settled.",
      "Reveal timeout",
      "FAILURE",
    );
  }

  state.committee = createCommittee(THRESHOLD);
  state.batch.sharesReceived = THRESHOLD;
  state.batch.quorumReached = true;
  state.batch.status = "DECRYPTING";
  return abortCurrentBatch(
    "Batch aborted: an order commitment failed the simulated validity check. No trade was settled.",
    "Order validity failure",
    "FAILURE",
  );
}
