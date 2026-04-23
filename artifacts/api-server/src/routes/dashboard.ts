import { Router, type IRouter } from "express";
import {
  db,
  salesTable,
  medicineBatchesTable,
  medicinesTable,
  udhariEntriesTable,
  purchaseOrdersTable,
  alertsTable,
} from "@workspace/db";
import { and, gte, lte, sql, eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayStr = new Date().toISOString().slice(0, 10);
  const sixtyDaysStr = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

  const [todaySales] = await db
    .select({
      sales: sql<number>`COALESCE(SUM(${salesTable.totalMinor}), 0)::bigint`,
      cost: sql<number>`COALESCE(SUM(${salesTable.costMinor}), 0)::bigint`,
    })
    .from(salesTable)
    .where(gte(salesTable.soldAt, startOfDay));

  const [lowStock] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(medicineBatchesTable)
    .innerJoin(medicinesTable, eq(medicinesTable.id, medicineBatchesTable.medicineId))
    .where(sql`${medicineBatchesTable.qtyOnHand} <= ${medicinesTable.reorderLevel}`);

  const [nearExpiry] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(medicineBatchesTable)
    .where(
      and(
        gte(medicineBatchesTable.expiryDate, todayStr),
        lte(medicineBatchesTable.expiryDate, sixtyDaysStr),
      ),
    );

  const [expired] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(medicineBatchesTable)
    .where(sql`${medicineBatchesTable.expiryDate} < ${todayStr}`);

  const [udhari] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${udhariEntriesTable.amountMinor}), 0)::bigint`,
    })
    .from(udhariEntriesTable);

  const [supplierDues] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${purchaseOrdersTable.totalMinor} - ${purchaseOrdersTable.paidMinor}), 0)::bigint`,
    })
    .from(purchaseOrdersTable);

  const [openAlerts] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(alertsTable)
    .where(eq(alertsTable.acknowledged, false));

  res.json({
    salesTodayMinor: Number(todaySales.sales),
    costTodayMinor: Number(todaySales.cost),
    profitTodayMinor: Number(todaySales.sales) - Number(todaySales.cost),
    lowStockCount: Number(lowStock.n),
    nearExpiryCount: Number(nearExpiry.n),
    expiredCount: Number(expired.n),
    udhariOutstandingMinor: Math.max(0, Number(udhari.total)),
    supplierDuesMinor: Math.max(0, Number(supplierDues.total)),
    openAlertsCount: Number(openAlerts.n),
    currency: "INR",
  });
});

router.get("/dashboard/profit-trend", async (req, res): Promise<void> => {
  const days = Math.max(1, Math.min(90, Number(req.query.days) || 7));
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const rows = await db
    .select({
      date: sql<string>`to_char(${salesTable.soldAt}, 'YYYY-MM-DD')`,
      sales: sql<number>`COALESCE(SUM(${salesTable.totalMinor}), 0)::bigint`,
      cost: sql<number>`COALESCE(SUM(${salesTable.costMinor}), 0)::bigint`,
    })
    .from(salesTable)
    .where(gte(salesTable.soldAt, start))
    .groupBy(sql`to_char(${salesTable.soldAt}, 'YYYY-MM-DD')`);

  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const r = byDate.get(key);
    out.push({
      date: key,
      salesMinor: r ? Number(r.sales) : 0,
      profitMinor: r ? Number(r.sales) - Number(r.cost) : 0,
    });
  }
  res.json(out);
});

export default router;
