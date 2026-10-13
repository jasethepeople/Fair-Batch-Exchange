import { Router, type IRouter } from "express";
import {
  CancelOrderParams,
  CancelOrderResponse,
  ClearBatchParams,
  ClearBatchResponse,
  GetExchangeResponse,
  RunExchangeScenarioBody,
  RunExchangeScenarioResponse,
  SubmitOrderBody,
  SubmitOrderResponse,
} from "@workspace/api-zod";
import {
  cancelSealedOrder,
  clearActiveBatch,
  getExchangeSnapshot,
  runExchangeScenario,
  submitSealedOrder,
} from "../lib/exchange-engine";

const router: IRouter = Router();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The exchange simulation failed.";
}

router.get("/exchange", (_req, res): void => {
  res.json(GetExchangeResponse.parse(getExchangeSnapshot()));
});

router.post("/exchange/orders", (req, res): void => {
  const parsed = SubmitOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const order = submitSealedOrder(parsed.data);
    res.status(201).json(SubmitOrderResponse.parse(order));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post("/exchange/batches/:batchId/clear", (req, res): void => {
  const parsed = ClearBatchParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const snapshot = clearActiveBatch(parsed.data.batchId);
    res.json(ClearBatchResponse.parse(snapshot));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post("/exchange/simulations", (req, res): void => {
  const parsed = RunExchangeScenarioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const snapshot = runExchangeScenario(parsed.data.scenario);
    res.json(RunExchangeScenarioResponse.parse(snapshot));
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post("/exchange/orders/:orderId/cancel", (req, res): void => {
  const parsed = CancelOrderParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const order = cancelSealedOrder(parsed.data.orderId);
  if (!order) {
    res.status(400).json({ error: "This order cannot be cancelled." });
    return;
  }

  res.json(CancelOrderResponse.parse(order));
});

export default router;
