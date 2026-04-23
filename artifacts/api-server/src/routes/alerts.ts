import { Router, type IRouter } from "express";
import {
  db,
  alertsTable,
  medicineBatchesTable,
  medicinesTable,
  purchaseOrdersTable,
  suppliersTable,
} from "@workspace/db";
import { and, eq, lte, sql } from "drizzle-orm";

const router: IRouter = Router();

async function regenerateAlerts() {
  await db.delete(alertsTable).where(eq(alertsTable.acknowledged, false));

  const todayStr = new Date().toISOString().slice(0, 10);
  const sixtyStr = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

  const lowStock = await db
    .select({ b: medicineBatchesTable, m: medicinesTable })
    .from(medicineBatchesTable)
    .innerJoin(medicinesTable, eq(medicinesTable.id, medicineBatchesTable.medicineId))
    .where(sql`${medicineBatchesTable.qtyOnHand} <= ${medicinesTable.reorderLevel}`);

  for (const r of lowStock) {
    await db.insert(alertsTable).values({
      kind: "low_stock",
      title: `Low stock: ${r.m.name}`,
      message: `${r.b.qtyOnHand} units left in batch ${r.b.batchNumber}`,
      medicineId: r.m.id,
      batchId: r.b.id,
    });
  }

  const expiring = await db
    .select({ b: medicineBatchesTable, m: medicinesTable })
    .from(medicineBatchesTable)
    .innerJoin(medicinesTable, eq(medicinesTable.id, medicineBatchesTable.medicineId))
    .where(
      and(
        lte(medicineBatchesTable.expiryDate, sixtyStr),
        sql`${medicineBatchesTable.qtyOnHand} > 0`,
      ),
    );

  for (const r of expiring) {
    const expired = r.b.expiryDate < todayStr;
    await db.insert(alertsTable).values({
      kind: "near_expiry",
      title: `${expired ? "Expired" : "Near expiry"}: ${r.m.name}`,
      message: `Batch ${r.b.batchNumber} expires ${r.b.expiryDate} · ${r.b.qtyOnHand} units`,
      medicineId: r.m.id,
      batchId: r.b.id,
    });
  }

  const overdue = await db
    .select({ p: purchaseOrdersTable, s: suppliersTable })
    .from(purchaseOrdersTable)
    .innerJoin(suppliersTable, eq(suppliersTable.id, purchaseOrdersTable.supplierId))
    .where(
      and(
        lte(purchaseOrdersTable.dueDate, todayStr),
        sql`${purchaseOrdersTable.paidMinor} < ${purchaseOrdersTable.totalMinor}`,
      ),
    );
  for (const r of overdue) {
    const due = Number(r.p.totalMinor) - Number(r.p.paidMinor);
    await db.insert(alertsTable).values({
      kind: "overdue_payment",
      title: `Overdue: ${r.s.name}`,
      message: `Invoice ${r.p.invoiceNumber} · ₹${(due / 100).toFixed(2)} due ${r.p.dueDate}`,
      purchaseOrderId: r.p.id,
    });
  }
}

router.get("/alerts", async (_req, res): Promise<void> => {
  await regenerateAlerts();
  const rows = await db
    .select()
    .from(alertsTable)
    .where(eq(alertsTable.acknowledged, false))
    .orderBy(sql`${alertsTable.createdAt} DESC`)
    .limit(100);
  res.json(rows);
});

router.post("/alerts/:id/ack", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db
    .update(alertsTable)
    .set({ acknowledged: true })
    .where(eq(alertsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(row);
});

export default router;
