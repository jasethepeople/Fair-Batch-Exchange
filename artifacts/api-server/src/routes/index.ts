import { Router, type IRouter } from "express";
import healthRouter from "./health";
import exchangeRouter from "./exchange";

const router: IRouter = Router();

router.use(healthRouter);
router.use(exchangeRouter);

export default router;
