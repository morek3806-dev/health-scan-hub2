import { Router, type IRouter } from "express";
import {
  db,
  saleLinesTable,
  salesTable,
  medicinesTable,
  medicineBatchesTable,
  doctorsTable,
} from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/analytics/velocity", async (_req, res): Promise<void> => {
  const since = new Date(Date.now() - 30 * 86400000);
  const rows = await db
    .select({
      medicineId: medicinesTable.id,
      name: medicinesTable.name,
      unitsSold30d: sql<number>`COALESCE(SUM(${saleLinesTable.qty}), 0)::int`,
      revenueMinor30d: sql<number>`COALESCE(SUM(${saleLinesTable.qty} * ${saleLinesTable.sellPriceMinor}), 0)::bigint`,
      profitMinor30d: sql<number>`COALESCE(SUM(${saleLinesTable.qty} * (${saleLinesTable.sellPriceMinor} - ${saleLinesTable.buyPriceMinor})), 0)::bigint`,
      qtyOnHand: sql<number>`COALESCE((SELECT SUM(qty_on_hand) FROM medicine_batches WHERE medicine_id = ${medicinesTable.id}), 0)::int`,
    })
    .from(medicinesTable)
    .leftJoin(
      saleLinesTable,
      eq(saleLinesTable.medicineId, medicinesTable.id),
    )
    .leftJoin(
      salesTable,
      and(eq(salesTable.id, saleLinesTable.saleId), gte(salesTable.soldAt, since)),
    )
    .groupBy(medicinesTable.id);

  const enriched = rows.map((r) => {
    const units = Number(r.unitsSold30d);
    const band = units >= 50 ? "fast" : units >= 10 ? "normal" : "slow";
    return {
      medicineId: r.medicineId,
      name: r.name,
      unitsSold30d: units,
      qtyOnHand: Number(r.qtyOnHand),
      revenueMinor30d: Number(r.revenueMinor30d),
      profitMinor30d: Number(r.profitMinor30d),
      band,
    };
  });

  enriched.sort((a, b) => b.unitsSold30d - a.unitsSold30d);
  res.json({
    fast: enriched.filter((r) => r.band !== "slow").slice(0, 10),
    slow: enriched
      .filter((r) => r.qtyOnHand > 0)
      .sort((a, b) => a.unitsSold30d - b.unitsSold30d)
      .slice(0, 10),
  });
});

router.get("/analytics/doctors", async (_req, res): Promise<void> => {
  const since = new Date(Date.now() - 30 * 86400000);
  const rows = await db
    .select({
      doctorId: doctorsTable.id,
      doctorName: doctorsTable.name,
      scriptCount: sql<number>`COUNT(${salesTable.id})::int`,
      revenueMinor: sql<number>`COALESCE(SUM(${salesTable.totalMinor}), 0)::bigint`,
    })
    .from(doctorsTable)
    .leftJoin(
      salesTable,
      and(eq(salesTable.doctorId, doctorsTable.id), gte(salesTable.soldAt, since)),
    )
    .groupBy(doctorsTable.id)
    .orderBy(sql`COALESCE(SUM(${salesTable.totalMinor}), 0) DESC`);
  res.json(
    rows.map((r) => ({
      doctorId: r.doctorId,
      doctorName: r.doctorName,
      scriptCount: Number(r.scriptCount),
      revenueMinor: Number(r.revenueMinor),
    })),
  );
});

// Touch the import so the unused-batches table doesn't trigger lint complaints.
void medicineBatchesTable;

export default router;
