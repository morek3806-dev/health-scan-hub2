import { Router, type IRouter } from "express";
import { db, medicinesTable, medicineBatchesTable } from "@workspace/db";
import { eq, ilike, or, sql, asc } from "drizzle-orm";
import { asInt } from "../lib/money";

const router: IRouter = Router();

router.get("/medicines", async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const where = search
    ? or(
        ilike(medicinesTable.name, `%${search}%`),
        ilike(medicinesTable.genericName, `%${search}%`),
      )
    : undefined;

  const rows = await db
    .select({
      id: medicinesTable.id,
      name: medicinesTable.name,
      genericName: medicinesTable.genericName,
      strength: medicinesTable.strength,
      form: medicinesTable.form,
      hsnCode: medicinesTable.hsnCode,
      gstPct: medicinesTable.gstPct,
      reorderLevel: medicinesTable.reorderLevel,
      isActive: medicinesTable.isActive,
      qtyOnHand: sql<number>`COALESCE(SUM(${medicineBatchesTable.qtyOnHand}), 0)::int`,
      sellPriceMinor: sql<number>`COALESCE(MIN(${medicineBatchesTable.sellPriceMinor}), 0)::int`,
    })
    .from(medicinesTable)
    .leftJoin(medicineBatchesTable, eq(medicineBatchesTable.medicineId, medicinesTable.id))
    .where(where)
    .groupBy(medicinesTable.id)
    .orderBy(asc(medicinesTable.name));

  res.json(
    rows.map((r) => ({
      ...r,
      gstPct: Number(r.gstPct),
      qtyOnHand: asInt(r.qtyOnHand),
      sellPriceMinor: asInt(r.sellPriceMinor),
    })),
  );
});

router.post("/medicines", async (req, res): Promise<void> => {
  const b = req.body ?? {};
  if (!b.name || typeof b.name !== "string") {
    res.status(400).json({ error: "name required" });
    return;
  }
  const [row] = await db
    .insert(medicinesTable)
    .values({
      name: b.name,
      genericName: b.genericName ?? null,
      strength: b.strength ?? null,
      form: b.form ?? null,
      hsnCode: b.hsnCode ?? null,
      gstPct: b.gstPct != null ? String(b.gstPct) : "12.00",
      reorderLevel: typeof b.reorderLevel === "number" ? b.reorderLevel : 10,
    })
    .returning();
  res.status(201).json({
    id: row.id,
    name: row.name,
    genericName: row.genericName,
    strength: row.strength,
    form: row.form,
    hsnCode: row.hsnCode,
    gstPct: Number(row.gstPct),
    reorderLevel: row.reorderLevel,
    isActive: row.isActive,
    qtyOnHand: 0,
    sellPriceMinor: 0,
  });
});

router.get("/medicines/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [med] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, id));
  if (!med) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const batches = await db
    .select()
    .from(medicineBatchesTable)
    .where(eq(medicineBatchesTable.medicineId, id))
    .orderBy(asc(medicineBatchesTable.expiryDate));

  const today = new Date();
  res.json({
    id: med.id,
    name: med.name,
    genericName: med.genericName,
    strength: med.strength,
    form: med.form,
    hsnCode: med.hsnCode,
    gstPct: Number(med.gstPct),
    reorderLevel: med.reorderLevel,
    isActive: med.isActive,
    qtyOnHand: batches.reduce((s, b) => s + b.qtyOnHand, 0),
    sellPriceMinor: batches[0]?.sellPriceMinor ?? 0,
    batches: batches.map((b) => batchView(b, med, today)),
  });
});

router.put("/medicines/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const b = req.body ?? {};
  if (!b.name || typeof b.name !== "string") {
    res.status(400).json({ error: "name required" });
    return;
  }
  const [row] = await db
    .update(medicinesTable)
    .set({
      name: b.name,
      genericName: b.genericName ?? null,
      strength: b.strength ?? null,
      form: b.form ?? null,
      hsnCode: b.hsnCode ?? null,
      gstPct: b.gstPct != null ? String(b.gstPct) : "12.00",
      reorderLevel: typeof b.reorderLevel === "number" ? b.reorderLevel : 10,
    })
    .where(eq(medicinesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({
    id: row.id,
    name: row.name,
    genericName: row.genericName,
    strength: row.strength,
    form: row.form,
    hsnCode: row.hsnCode,
    gstPct: Number(row.gstPct),
    reorderLevel: row.reorderLevel,
    isActive: row.isActive,
    qtyOnHand: 0,
    sellPriceMinor: 0,
  });
});

router.delete("/medicines/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const batches = await db
    .select({ qty: medicineBatchesTable.qtyOnHand })
    .from(medicineBatchesTable)
    .where(eq(medicineBatchesTable.medicineId, id));
  const totalStock = batches.reduce((s, b) => s + b.qtyOnHand, 0);
  if (totalStock > 0) {
    res.status(409).json({
      error: "Medicine still has stock. Delete or sell all batches first.",
    });
    return;
  }
  try {
    await db.delete(medicineBatchesTable).where(eq(medicineBatchesTable.medicineId, id));
    const result = await db.delete(medicinesTable).where(eq(medicinesTable.id, id)).returning({ id: medicinesTable.id });
    if (result.length === 0) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.status(204).send();
  } catch {
    res.status(409).json({
      error: "Cannot delete: medicine has sales history. Mark inactive instead.",
    });
  }
});

export function batchView(
  b: typeof medicineBatchesTable.$inferSelect,
  med: { id: string; name: string; genericName: string | null; reorderLevel: number },
  today: Date,
  supplierName: string | null = null,
): unknown {
  const expiry = new Date(b.expiryDate);
  const daysToExpiry = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  const status =
    daysToExpiry < 0
      ? "expired"
      : daysToExpiry <= 60
      ? "near_expiry"
      : b.qtyOnHand <= med.reorderLevel
      ? "low"
      : "ok";
  return {
    id: b.id,
    medicineId: b.medicineId,
    medicineName: med.name,
    genericName: med.genericName,
    batchNumber: b.batchNumber,
    expiryDate: b.expiryDate,
    buyPriceMinor: b.buyPriceMinor,
    sellPriceMinor: b.sellPriceMinor,
    qtyReceived: b.qtyReceived,
    qtyOnHand: b.qtyOnHand,
    supplierId: b.supplierId,
    supplierName,
    rawOcrText: b.rawOcrText,
    daysToExpiry,
    status,
  };
}

export default router;
