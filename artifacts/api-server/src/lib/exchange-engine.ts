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

const UNIT_SCALE = 1_000_000;
const MAX_AUDIT_EVENTS = 100;
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

type Candidate = {
  price: number;
  volumeUnits: number;
  imbalanceUnits: number;
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
    clearingPrice: null,
    matchedVolume: 0,
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
  lastClearingPrice: 99.9,
};

let state = createInitialState(18, defaultStats, []);

function totalUnits(orders: PrivateOrder[]): number {
  return orders.reduce((total, order) => total + toUnits(order.quantity), 0);
}

function findClearingCandidate(
  orders: PrivateOrder[],
  referencePrice: number,
): Candidate | null {
  const candidatePrices = [
    ...new Set([
      referencePrice,
      ...orders.map((order) => Number(order.limitPrice.toFixed(8))),
    ]),
  ];

  let best: Candidate | null = null;

  for (const price of candidatePrices) {
    const demand = totalUnits(
      orders.filter((order) => order.side === "buy" && order.limitPrice >= price),
    );
    const supply = totalUnits(
      orders.filter((order) => order.side === "sell" && order.limitPrice <= price),
    );
    const candidate: Candidate = {
      price,
      volumeUnits: Math.min(demand, supply),
      imbalanceUnits: Math.abs(demand - supply),
    };

    if (!best || candidate.volumeUnits > best.volumeUnits) {
      best = candidate;
      continue;
    }

    if (candidate.volumeUnits < best.volumeUnits) {
      continue;
    }

    if (candidate.imbalanceUnits < best.imbalanceUnits) {
      best = candidate;
      continue;
    }

    if (candidate.imbalanceUnits > best.imbalanceUnits) {
      continue;
    }

    const distance = Math.abs(candidate.price - referencePrice);
    const bestDistance = Math.abs(best.price - referencePrice);
    if (distance < bestDistance || (distance === bestDistance && candidate.price < best.price)) {
      best = candidate;
    }
  }

  return best;
}

function allocateProRata(
  orders: PrivateOrder[],
  targetUnits: number,
): Map<string, number> {
  const allocations = new Map<string, number>();
  const groupUnits = totalUnits(orders);

  if (targetUnits <= 0 || groupUnits <= 0) {
    return allocations;
  }

  let assignedUnits = 0;
  const remainders = orders.map((order) => {
    const exact = (toUnits(order.quantity) * targetUnits) / groupUnits;
    const floor = Math.floor(exact);
    allocations.set(order.id, floor);
    assignedUnits += floor;
    return {
      id: order.id,
      fractional: exact - floor,
      commitment: order.commitment,
    };
  });

  remainders.sort(
    (left, right) =>
      right.fractional - left.fractional ||
      left.commitment.localeCompare(right.commitment),
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
  orders: PrivateOrder[],
  side: Side,
  clearingPrice: number,
  targetUnits: number,
): Map<string, number> {
  const eligible = orders
    .filter((order) =>
      side === "buy"
        ? order.side === "buy" && order.limitPrice >= clearingPrice
        : order.side === "sell" && order.limitPrice <= clearingPrice,
    )
    .sort((left, right) =>
      side === "buy"
        ? right.limitPrice - left.limitPrice
        : left.limitPrice - right.limitPrice,
    );

  const byPrice = new Map<number, PrivateOrder[]>();
  for (const order of eligible) {
    const priceGroup = byPrice.get(order.limitPrice) ?? [];
    priceGroup.push(order);
    byPrice.set(order.limitPrice, priceGroup);
  }

  const priceGroups = [...byPrice.entries()].sort(([left], [right]) =>
    side === "buy" ? right - left : left - right,
  );
  const allocations = new Map<string, number>();
  let remainingUnits = targetUnits;

  for (const [, group] of priceGroups) {
    if (remainingUnits <= 0) {
      break;
    }

    const groupUnits = totalUnits(group);
    if (groupUnits <= remainingUnits) {
      for (const order of group) {
        allocations.set(order.id, toUnits(order.quantity));
      }
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
  const candidate = findClearingCandidate(liveOrders, state.market.referencePrice);
  const matchedUnits = candidate?.volumeUnits ?? 0;

  if (!candidate || matchedUnits === 0) {
    for (const order of liveOrders) {
      order.status = "UNFILLED";
    }
    state.batch.clearingPrice = null;
    state.batch.matchedVolume = 0;
    state.batch.outcome =
      "No compatible buy and sell orders crossed. No trade was settled.";
    addAuditEvent(
      state,
      "Batch settled with no trade",
      state.batch.outcome,
      "WARNING",
    );
  } else {
    const buyAllocations = allocateSide(
      liveOrders,
      "buy",
      candidate.price,
      matchedUnits,
    );
    const sellAllocations = allocateSide(
      liveOrders,
      "sell",
      candidate.price,
      matchedUnits,
    );

    for (const order of liveOrders) {
      const fillUnits =
        buyAllocations.get(order.id) ?? sellAllocations.get(order.id) ?? 0;
      order.filledQuantity = fromUnits(fillUnits);
      if (fillUnits === 0) {
        order.status = "UNFILLED";
      } else if (fillUnits === toUnits(order.quantity)) {
        order.status = "FILLED";
      } else {
        order.status = "PARTIALLY_FILLED";
      }
    }

    state.batch.clearingPrice = candidate.price;
    state.batch.matchedVolume = fromUnits(matchedUnits);
    state.batch.outcome =
      "Uniform-price result: maximum executable volume; then lowest imbalance; then closest to the reference price; then lower price. Marginal orders at each price level share pro rata.";
    state.stats.totalVolume += fromUnits(matchedUnits);
    state.stats.lastClearingPrice = candidate.price;
    addAuditEvent(
      state,
      "Uniform-price batch settled",
      `${fromUnits(matchedUnits)} ETH cleared at $${candidate.price.toFixed(2)} per ETH. All fills in the batch use the same price.`,
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
  state.batch.clearingPrice = null;
  state.batch.matchedVolume = 0;
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
