import { Router, type IRouter } from "express";
import {
  db,
  salesTable,
  saleLinesTable,
  medicineBatchesTable,
  medicinesTable,
  customersTable,
  doctorsTable,
  udhariEntriesTable,
} from "@workspace/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";

const router: IRouter = Router();

async function nextInvoiceNo(tx: { select: typeof db.select }) {
  const [{ count }] = await tx
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(salesTable);
  const n = Number(count) + 1;
  return `INV-${String(n).padStart(6, "0")}`;
}

router.get("/sales", async (req, res): Promise<void> => {
  const from = typeof req.query.from === "string" ? req.query.from : null;
  const to = typeof req.query.to === "string" ? req.query.to : null;
  const conds = [] as ReturnType<typeof eq>[];
  if (from) conds.push(gte(salesTable.soldAt, new Date(from)) as never);
  if (to) conds.push(lte(salesTable.soldAt, new Date(`${to}T23:59:59Z`)) as never);

  const rows = await db
    .select({
      s: salesTable,
      customerName: customersTable.name,
      doctorName: doctorsTable.name,
    })
    .from(salesTable)
    .leftJoin(customersTable, eq(customersTable.id, salesTable.customerId))
    .leftJoin(doctorsTable, eq(doctorsTable.id, salesTable.doctorId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(sql`${salesTable.soldAt} DESC`)
    .limit(200);

  res.json(
    rows.map((r) => ({
      id: r.s.id,
      invoiceNo: r.s.invoiceNo,
      customerName: r.customerName,
      doctorName: r.doctorName,
      totalMinor: Number(r.s.totalMinor),
      profitMinor: Number(r.s.totalMinor) - Number(r.s.costMinor),
      paymentMethod: r.s.paymentMethod,
      soldAt: r.s.soldAt,
    })),
  );
});

router.post("/sales", async (req, res): Promise<void> => {
  const b = req.body ?? {};
  if (!Array.isArray(b.lines) || !b.lines.length) {
    res.status(400).json({ error: "lines required" });
    return;
  }
  if (!b.paymentMethod) {
    res.status(400).json({ error: "paymentMethod required" });
    return;
  }

  try {
    const sale = await db.transaction(async (tx) => {
      let subtotal = 0;
      let cost = 0;
      let totalDiscount = Number(b.discountMinor) || 0;
      const lineInserts: (typeof saleLinesTable.$inferInsert)[] = [];

      for (const line of b.lines) {
        const [batch] = await tx
          .select()
          .from(medicineBatchesTable)
          .where(eq(medicineBatchesTable.id, line.batchId));
        if (!batch) throw new Error(`Batch ${line.batchId} not found`);
        const qty = Number(line.qty);
        if (qty > batch.qtyOnHand) {
          throw new Error(`Insufficient stock for batch ${batch.batchNumber}`);
        }
        const sell = Number(line.sellPriceMinor) || batch.sellPriceMinor;
        const buy = batch.buyPriceMinor;
        const lineDiscount = Number(line.discountMinor) || 0;
        subtotal += qty * sell;
        cost += qty * buy;
        totalDiscount += lineDiscount;
        lineInserts.push({
          saleId: "", // filled after sale insert
          medicineId: batch.medicineId,
          batchId: batch.id,
          qty,
          sellPriceMinor: sell,
          buyPriceMinor: buy,
          discountMinor: lineDiscount,
          taxMinor: 0,
        });
        await tx
          .update(medicineBatchesTable)
          .set({ qtyOnHand: batch.qtyOnHand - qty })
          .where(eq(medicineBatchesTable.id, batch.id));
      }

      const total = subtotal - totalDiscount;
      const paid =
        typeof b.paidMinor === "number" ? b.paidMinor : b.paymentMethod === "udhari" ? 0 : total;
      const invoiceNo = await nextInvoiceNo(tx);

      const [sale] = await tx
        .insert(salesTable)
        .values({
          invoiceNo,
          customerId: b.customerId ?? null,
          doctorId: b.doctorId ?? null,
          prescriptionNo: b.prescriptionNo ?? null,
          subtotalMinor: subtotal,
          taxMinor: 0,
          discountMinor: totalDiscount,
          totalMinor: total,
          paidMinor: paid,
          costMinor: cost,
          paymentMethod: b.paymentMethod,
        })
        .returning();

      for (const li of lineInserts) {
        li.saleId = sale.id;
      }
      await tx.insert(saleLinesTable).values(lineInserts);

      if (b.paymentMethod === "udhari" && b.customerId && total - paid > 0) {
        await tx.insert(udhariEntriesTable).values({
          customerId: b.customerId,
          saleId: sale.id,
          amountMinor: total - paid,
          note: `Sale on credit ${invoiceNo}`,
        });
      }
      return sale;
    });

    const detail = await loadSaleDetail(sale.id);
    res.status(201).json(detail);
  } catch (err) {
    req.log.warn({ err }, "createSale failed");
    res.status(400).json({ error: err instanceof Error ? err.message : "sale failed" });
  }
});

router.get("/sales/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const detail = await loadSaleDetail(id);
  if (!detail) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json(detail);
});

async function loadSaleDetail(id: string) {
  const [row] = await db
    .select({
      s: salesTable,
      customerName: customersTable.name,
      doctorName: doctorsTable.name,
    })
    .from(salesTable)
    .leftJoin(customersTable, eq(customersTable.id, salesTable.customerId))
    .leftJoin(doctorsTable, eq(doctorsTable.id, salesTable.doctorId))
    .where(eq(salesTable.id, id));
  if (!row) return null;
  const lines = await db
    .select({
      l: saleLinesTable,
      med: medicinesTable,
      batch: medicineBatchesTable,
    })
    .from(saleLinesTable)
    .innerJoin(medicinesTable, eq(medicinesTable.id, saleLinesTable.medicineId))
    .innerJoin(medicineBatchesTable, eq(medicineBatchesTable.id, saleLinesTable.batchId))
    .where(eq(saleLinesTable.saleId, id));

  return {
    id: row.s.id,
    invoiceNo: row.s.invoiceNo,
    customerId: row.s.customerId,
    customerName: row.customerName,
    doctorId: row.s.doctorId,
    doctorName: row.doctorName,
    prescriptionNo: row.s.prescriptionNo,
    subtotalMinor: Number(row.s.subtotalMinor),
    taxMinor: Number(row.s.taxMinor),
    discountMinor: Number(row.s.discountMinor),
    totalMinor: Number(row.s.totalMinor),
    paidMinor: Number(row.s.paidMinor),
    costMinor: Number(row.s.costMinor),
    profitMinor: Number(row.s.totalMinor) - Number(row.s.costMinor),
    paymentMethod: row.s.paymentMethod,
    soldAt: row.s.soldAt,
    lines: lines.map((x) => ({
      id: x.l.id,
      batchId: x.l.batchId,
      medicineName: x.med.name,
      batchNumber: x.batch.batchNumber,
      qty: x.l.qty,
      sellPriceMinor: Number(x.l.sellPriceMinor),
      buyPriceMinor: Number(x.l.buyPriceMinor),
      discountMinor: Number(x.l.discountMinor),
      lineTotalMinor: x.l.qty * Number(x.l.sellPriceMinor) - Number(x.l.discountMinor),
    })),
  };
}

export default router;
