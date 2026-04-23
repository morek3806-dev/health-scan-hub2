import { Router, type IRouter } from "express";
import {
  db,
  medicineBatchesTable,
  medicinesTable,
  suppliersTable,
} from "@workspace/db";
import { and, asc, eq, ilike, lte, or, sql } from "drizzle-orm";
import { batchView } from "./medicines";

const router: IRouter = Router();

router.get("/batches", async (req, res): Promise<void> => {
  const status = String(req.query.status ?? "all");
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const today = new Date();
  const sixtyDays = new Date(today.getTime() + 60 * 86400000)
    .toISOString()
    .slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const conditions = [] as ReturnType<typeof eq>[];
  if (search) {
    const cond = or(
      ilike(medicinesTable.name, `%${search}%`),
      ilike(medicineBatchesTable.batchNumber, `%${search}%`),
    );
    if (cond) conditions.push(cond);
  }
  if (status === "low") {
    conditions.push(sql`${medicineBatchesTable.qtyOnHand} <= ${medicinesTable.reorderLevel}` as never);
  } else if (status === "near_expiry") {
    conditions.push(lte(medicineBatchesTable.expiryDate, sixtyDays));
    conditions.push(sql`${medicineBatchesTable.expiryDate} >= ${todayStr}` as never);
  } else if (status === "expired") {
    conditions.push(sql`${medicineBatchesTable.expiryDate} < ${todayStr}` as never);
  }

  const rows = await db
    .select({
      batch: medicineBatchesTable,
      med: medicinesTable,
      supplierName: suppliersTable.name,
    })
    .from(medicineBatchesTable)
    .innerJoin(medicinesTable, eq(medicinesTable.id, medicineBatchesTable.medicineId))
    .leftJoin(suppliersTable, eq(suppliersTable.id, medicineBatchesTable.supplierId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(medicineBatchesTable.expiryDate));

  res.json(rows.map((r) => batchView(r.batch, r.med, today, r.supplierName)));
});

router.post("/batches", async (req, res): Promise<void> => {
  const b = req.body ?? {};
  if (!b.medicineName || !b.batchNumber || !b.expiryDate) {
    res.status(400).json({ error: "medicineName, batchNumber, expiryDate required" });
    return;
  }
  let medicineId: string | null = b.medicineId ?? null;
  if (!medicineId) {
    const [existing] = await db
      .select()
      .from(medicinesTable)
      .where(eq(medicinesTable.name, b.medicineName));
    if (existing) {
      medicineId = existing.id;
    } else {
      const [created] = await db
        .insert(medicinesTable)
        .values({ name: b.medicineName, genericName: b.genericName ?? null })
        .returning();
      medicineId = created.id;
    }
  }
  const qty = Number(b.qtyReceived) || 0;
  const [batch] = await db
    .insert(medicineBatchesTable)
    .values({
      medicineId: medicineId!,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      buyPriceMinor: Number(b.buyPriceMinor) || 0,
      sellPriceMinor: Number(b.sellPriceMinor) || 0,
      qtyReceived: qty,
      qtyOnHand: qty,
      supplierId: b.supplierId ?? null,
      rawOcrText: b.rawOcrText ?? null,
    })
    .returning();
  const [med] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, medicineId!));
  res.status(201).json(batchView(batch, med, new Date()));
});

router.get("/batches/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db
    .select({
      batch: medicineBatchesTable,
      med: medicinesTable,
      supplierName: suppliersTable.name,
    })
    .from(medicineBatchesTable)
    .innerJoin(medicinesTable, eq(medicinesTable.id, medicineBatchesTable.medicineId))
    .leftJoin(suppliersTable, eq(suppliersTable.id, medicineBatchesTable.supplierId))
    .where(eq(medicineBatchesTable.id, id));
  if (!row) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(batchView(row.batch, row.med, new Date(), row.supplierName));
});

router.delete("/batches/:id", async (req, res): Promise<void> => {
  await db.delete(medicineBatchesTable).where(eq(medicineBatchesTable.id, String(req.params.id)));
  res.sendStatus(204);
});

export default router;
