import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import medicinesRouter from "./medicines";
import batchesRouter from "./batches";
import suppliersRouter from "./suppliers";
import customersRouter from "./customers";
import doctorsRouter from "./doctors";
import salesRouter from "./sales";
import analyticsRouter from "./analytics";
import alertsRouter from "./alerts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(medicinesRouter);
router.use(batchesRouter);
router.use(suppliersRouter);
router.use(customersRouter);
router.use(doctorsRouter);
router.use(salesRouter);
router.use(analyticsRouter);
router.use(alertsRouter);

export default router;
