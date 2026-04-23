import { Router, type IRouter } from "express";
import {
  db,
  suppliersTable,
  purchaseOrdersTable,
  purchaseLinesTable,
  supplierPaymentsTable,
  medicinesTable,
  medicineBatchesTable,
} from "@workspace/db";
import { asc, eq, sql } from "drizzle-orm";

const router: IRouter = Router();

function poView(po: typeof purchaseOrdersTable.$inferSelect, supplierName: string) {
  const status =
    po.paidMinor >= po.totalMinor ? "paid" : po.paidMinor > 0 ? "partial" : "pending";
  return {
    id: po.id,
    supplierId: po.supplierId,
    supplierName,
    invoiceNumber: po.invoiceNumber,
    invoiceDate: po.invoiceDate,
    dueDate: po.dueDate,
    totalMinor: Number(po.totalMinor),
    paidMinor: Number(po.paidMinor),
    status,
    notes: po.notes,
  };
}

router.get("/suppliers", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      s: suppliersTable,
      totalPurchasedMinor: sql<number>`COALESCE(SUM(${purchaseOrdersTable.totalMinor}), 0)::bigint`,
      paidMinor: sql<number>`COALESCE(SUM(${purchaseOrdersTable.paidMinor}), 0)::bigint`,
      invoiceCount: sql<number>`COUNT(${purchaseOrdersTable.id})::int`,
      nextDueDate: sql<string | null>`MIN(${purchaseOrdersTable.dueDate}) FILTER (WHERE ${purchaseOrdersTable.paidMinor} < ${purchaseOrdersTable.totalMinor})`,
    })
    .from(suppliersTable)
    .leftJoin(purchaseOrdersTable, eq(purchaseOrdersTable.supplierId, suppliersTable.id))
    .groupBy(suppliersTable.id)
    .orderBy(asc(suppliersTable.name));

  res.json(
    rows.map((r) => ({
      id: r.s.id,
      name: r.s.name,
      contactPhone: r.s.contactPhone,
      gstin: r.s.gstin,
      address: r.s.address,
      creditDays: r.s.creditDays,
      totalPurchasedMinor: Number(r.totalPurchasedMinor),
      outstandingMinor: Number(r.totalPurchasedMinor) - Number(r.paidMinor),
      invoiceCount: Number(r.invoiceCount),
      nextDueDate: r.nextDueDate,
    })),
  );
});

router.post("/suppliers", async (req, res): Promise<void> => {
  const b = req.body ?? {};
  if (!b.name) {
    res.status(400).json({ error: "name required" });
    return;
  }
  const [row] = await db
    .insert(suppliersTable)
    .values({
      name: b.name,
      contactPhone: b.contactPhone ?? null,
      gstin: b.gstin ?? null,
      address: b.address ?? null,
      creditDays: typeof b.creditDays === "number" ? b.creditDays : 30,
    })
    .returning();
  res.status(201).json(row);
});

router.get("/suppliers/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [s] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!s) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const pos = await db
    .select()
    .from(purchaseOrdersTable)
    .where(eq(purchaseOrdersTable.supplierId, id))
    .orderBy(sql`${purchaseOrdersTable.invoiceDate} DESC`);
  const totals = pos.reduce(
    (acc, p) => ({
      total: acc.total + Number(p.totalMinor),
      paid: acc.paid + Number(p.paidMinor),
    }),
    { total: 0, paid: 0 },
  );
  const nextDue = pos
    .filter((p) => Number(p.paidMinor) < Number(p.totalMinor))
    .map((p) => p.dueDate)
    .filter(Boolean)
    .sort()[0] ?? null;
  res.json({
    id: s.id,
    name: s.name,
    contactPhone: s.contactPhone,
    gstin: s.gstin,
    address: s.address,
    creditDays: s.creditDays,
    totalPurchasedMinor: totals.total,
    outstandingMinor: totals.total - totals.paid,
    invoiceCount: pos.length,
    nextDueDate: nextDue,
    invoices: pos.map((po) => poView(po, s.name)),
  });
});

router.post("/purchase-orders", async (req, res): Promise<void> => {
  const b = req.body ?? {};
  if (!b.supplierId || !b.invoiceNumber || !b.invoiceDate || !Array.isArray(b.lines) || !b.lines.length) {
    res.status(400).json({ error: "supplierId, invoiceNumber, invoiceDate, lines required" });
    return;
  }
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, b.supplierId));
  if (!supplier) {
    res.status(404).json({ error: "supplier not found" });
    return;
  }

  const result = await db.transaction(async (tx) => {
    let total = 0;
    const [po] = await tx
      .insert(purchaseOrdersTable)
      .values({
        supplierId: b.supplierId,
        invoiceNumber: b.invoiceNumber,
        invoiceDate: b.invoiceDate,
        dueDate: b.dueDate ?? null,
        notes: b.notes ?? null,
      })
      .returning();

    for (const line of b.lines) {
      let medicineId: string | null = line.medicineId ?? null;
      if (!medicineId) {
        const [existing] = await tx
          .select()
          .from(medicinesTable)
          .where(eq(medicinesTable.name, line.medicineName));
        if (existing) {
          medicineId = existing.id;
        } else {
          const [created] = await tx
            .insert(medicinesTable)
            .values({ name: line.medicineName })
            .returning();
          medicineId = created.id;
        }
      }
      const qty = Number(line.qty) || 0;
      const buy = Number(line.buyPriceMinor) || 0;
      const sell = Number(line.sellPriceMinor) || 0;

      const [batch] = await tx
        .insert(medicineBatchesTable)
        .values({
          medicineId: medicineId!,
          batchNumber: line.batchNumber,
          expiryDate: line.expiryDate,
          buyPriceMinor: buy,
          sellPriceMinor: sell,
          qtyReceived: qty,
          qtyOnHand: qty,
          supplierId: b.supplierId,
        })
        .returning();

      await tx.insert(purchaseLinesTable).values({
        purchaseOrderId: po.id,
        medicineId: medicineId!,
        batchId: batch.id,
        qty,
        buyPriceMinor: buy,
      });
      total += qty * buy;
    }

    const [updated] = await tx
      .update(purchaseOrdersTable)
      .set({ totalMinor: total })
      .where(eq(purchaseOrdersTable.id, po.id))
      .returning();
    return updated;
  });

  res.status(201).json(poView(result, supplier.name));
});

router.post("/purchase-orders/:id/payments", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const b = req.body ?? {};
  if (!b.amountMinor || !b.method) {
    res.status(400).json({ error: "amountMinor, method required" });
    return;
  }
  const [po] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, id));
  if (!po) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    await tx.insert(supplierPaymentsTable).values({
      supplierId: po.supplierId,
      purchaseOrderId: po.id,
      amountMinor: Number(b.amountMinor),
      method: b.method,
      reference: b.reference ?? null,
    });
    const [u] = await tx
      .update(purchaseOrdersTable)
      .set({ paidMinor: Number(po.paidMinor) + Number(b.amountMinor) })
      .where(eq(purchaseOrdersTable.id, po.id))
      .returning();
    return u;
  });
  const [s] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, po.supplierId));
  res.status(201).json(poView(updated, s.name));
});

export default router;
