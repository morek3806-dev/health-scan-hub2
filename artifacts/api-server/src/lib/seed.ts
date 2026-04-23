import {
  db,
  medicinesTable,
  medicineBatchesTable,
  suppliersTable,
  customersTable,
  doctorsTable,
  purchaseOrdersTable,
  purchaseLinesTable,
  supplierPaymentsTable,
  salesTable,
  saleLinesTable,
  udhariEntriesTable,
} from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

function daysFromNow(d: number): string {
  const dt = new Date(Date.now() + d * 86400000);
  return dt.toISOString().slice(0, 10);
}

function ts(d: number): Date {
  return new Date(Date.now() + d * 86400000);
}

export async function seedIfEmpty(): Promise<void> {
  const [{ n }] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(medicinesTable);
  if (Number(n) > 0) {
    logger.info({ medicineCount: Number(n) }, "Seed skipped: data already present");
    return;
  }
  logger.info("Seeding pharmacy demo data...");

  // Suppliers
  const suppliers = await db
    .insert(suppliersTable)
    .values([
      { name: "MediPlus Distributors", contactPhone: "+91 98200 11122", gstin: "27AAACM4321P1Z5", address: "Andheri East, Mumbai", creditDays: 30 },
      { name: "HealthMart Wholesale", contactPhone: "+91 98200 33344", gstin: "27AAFCH7654N1Z2", address: "Dadar West, Mumbai", creditDays: 45 },
      { name: "Apollo Pharma Supply", contactPhone: "+91 98200 55566", gstin: "27AAACA1234B1ZX", address: "Goregaon, Mumbai", creditDays: 30 },
    ])
    .returning();

  // Doctors
  const doctors = await db
    .insert(doctorsTable)
    .values([
      { name: "Dr. R. Mehta", qualification: "MBBS, MD", clinic: "Mehta Clinic", phone: "+91 99876 11122", registrationNo: "MH-12345" },
      { name: "Dr. S. Khan", qualification: "MBBS", clinic: "Khan Family Practice", phone: "+91 99876 22233", registrationNo: "MH-22334" },
      { name: "Dr. A. Iyer", qualification: "MBBS, DCH", clinic: "Sunshine Pediatrics", phone: "+91 99876 33344", registrationNo: "MH-33445" },
      { name: "Dr. P. Nair", qualification: "BDS", clinic: "Smile Dental", phone: "+91 99876 44455", registrationNo: "MH-44556" },
    ])
    .returning();

  // Customers
  const customers = await db
    .insert(customersTable)
    .values([
      { name: "Anita Sharma", phone: "+91 98765 11111", address: "Plot 14, Sector 2", udhariLimitMinor: 500000 },
      { name: "Rohan Patel", phone: "+91 98765 22222", udhariLimitMinor: 300000 },
      { name: "Walk-in Customer", phone: null, udhariLimitMinor: 0 },
      { name: "Mrs. D'Souza", phone: "+91 98765 33333", address: "Flat 8, Rose Apts", udhariLimitMinor: 1000000 },
      { name: "Vikram Singh", phone: "+91 98765 44444", udhariLimitMinor: 200000 },
    ])
    .returning();

  // Medicines (catalog)
  const meds = await db
    .insert(medicinesTable)
    .values([
      { name: "Paracetamol", genericName: "Acetaminophen", strength: "500mg", form: "tablet", hsnCode: "30049099", gstPct: "12.00", reorderLevel: 30 },
      { name: "Amoxicillin", genericName: "Amoxicillin", strength: "500mg", form: "capsule", hsnCode: "30041040", gstPct: "12.00", reorderLevel: 20 },
      { name: "Cetirizine", genericName: "Cetirizine HCl", strength: "10mg", form: "tablet", hsnCode: "30049099", gstPct: "12.00", reorderLevel: 25 },
      { name: "Pantoprazole", genericName: "Pantoprazole", strength: "40mg", form: "tablet", hsnCode: "30049099", gstPct: "12.00", reorderLevel: 20 },
      { name: "Aspirin", genericName: "Aspirin", strength: "75mg", form: "tablet", hsnCode: "30049099", gstPct: "5.00", reorderLevel: 15 },
      { name: "Salbutamol", genericName: "Salbutamol", strength: "100mcg", form: "inhaler", hsnCode: "30049099", gstPct: "12.00", reorderLevel: 5 },
      { name: "Losartan", genericName: "Losartan Potassium", strength: "50mg", form: "tablet", hsnCode: "30049099", gstPct: "12.00", reorderLevel: 15 },
      { name: "Metformin", genericName: "Metformin HCl", strength: "500mg", form: "tablet", hsnCode: "30049099", gstPct: "12.00", reorderLevel: 30 },
      { name: "Azithromycin", genericName: "Azithromycin", strength: "500mg", form: "tablet", hsnCode: "30041040", gstPct: "12.00", reorderLevel: 12 },
      { name: "Vitamin D3", genericName: "Cholecalciferol", strength: "60000 IU", form: "capsule", hsnCode: "30049099", gstPct: "12.00", reorderLevel: 20 },
      { name: "ORS Sachet", genericName: "Oral Rehydration Salt", strength: null, form: "sachet", hsnCode: "30049099", gstPct: "5.00", reorderLevel: 30 },
      { name: "Cough Syrup", genericName: "Dextromethorphan", strength: "100ml", form: "syrup", hsnCode: "30049099", gstPct: "12.00", reorderLevel: 10 },
    ])
    .returning();

  const medByName = Object.fromEntries(meds.map((m) => [m.name, m]));

  // Batches across the suppliers + medicines
  const batchSpec: Array<{
    name: string;
    batch: string;
    expDays: number;
    buy: number;
    sell: number;
    qty: number;
    supplierIdx: number;
  }> = [
    { name: "Paracetamol", batch: "PCT-2027A", expDays: 540, buy: 1800, sell: 4500, qty: 220, supplierIdx: 0 },
    { name: "Paracetamol", batch: "PCT-2026B", expDays: 200, buy: 1700, sell: 4500, qty: 60, supplierIdx: 0 },
    { name: "Amoxicillin", batch: "AMX-998", expDays: 380, buy: 6500, sell: 12000, qty: 80, supplierIdx: 0 },
    { name: "Amoxicillin", batch: "AMX-AGED", expDays: 25, buy: 6300, sell: 12000, qty: 12, supplierIdx: 0 },
    { name: "Cetirizine", batch: "CTZ-220", expDays: 600, buy: 1200, sell: 3500, qty: 180, supplierIdx: 1 },
    { name: "Pantoprazole", batch: "PNT-554", expDays: 420, buy: 4400, sell: 9500, qty: 95, supplierIdx: 1 },
    { name: "Aspirin", batch: "ASP-OLD-4", expDays: 4, buy: 900, sell: 2500, qty: 6, supplierIdx: 1 },
    { name: "Aspirin", batch: "ASP-FRESH", expDays: 720, buy: 950, sell: 2500, qty: 90, supplierIdx: 1 },
    { name: "Salbutamol", batch: "SLB-INH-7", expDays: 300, buy: 14000, sell: 24000, qty: 3, supplierIdx: 2 },
    { name: "Losartan", batch: "LOS-50-12", expDays: 540, buy: 5500, sell: 11000, qty: 9, supplierIdx: 2 },
    { name: "Metformin", batch: "MET-500-A", expDays: 660, buy: 1800, sell: 4500, qty: 240, supplierIdx: 2 },
    { name: "Azithromycin", batch: "AZT-500-B", expDays: 480, buy: 8500, sell: 16500, qty: 55, supplierIdx: 0 },
    { name: "Vitamin D3", batch: "VTD-60K-A", expDays: 720, buy: 4200, sell: 9500, qty: 110, supplierIdx: 2 },
    { name: "ORS Sachet", batch: "ORS-A", expDays: 540, buy: 800, sell: 2000, qty: 200, supplierIdx: 1 },
    { name: "Cough Syrup", batch: "COU-100-1", expDays: 365, buy: 5500, sell: 12000, qty: 40, supplierIdx: 0 },
    { name: "Cough Syrup", batch: "COU-100-EXP", expDays: -10, buy: 5500, sell: 12000, qty: 4, supplierIdx: 0 },
  ];

  const batches: (typeof medicineBatchesTable.$inferSelect)[] = [];
  for (const b of batchSpec) {
    const med = medByName[b.name];
    const [row] = await db
      .insert(medicineBatchesTable)
      .values({
        medicineId: med.id,
        batchNumber: b.batch,
        expiryDate: daysFromNow(b.expDays),
        buyPriceMinor: b.buy,
        sellPriceMinor: b.sell,
        qtyReceived: b.qty,
        qtyOnHand: b.qty,
        supplierId: suppliers[b.supplierIdx].id,
      })
      .returning();
    batches.push(row);
  }

  // Purchase orders (some pending, some paid)
  const poSpecs = [
    { supplierIdx: 0, invoice: "MP-2287", days: -10, due: 20, paid: 0, batchIdx: [0, 2] },
    { supplierIdx: 0, invoice: "MP-2271", days: -25, due: 5, paid: 18000, batchIdx: [11, 14] },
    { supplierIdx: 0, invoice: "MP-2245", days: -55, due: -25, paid: 999999999, batchIdx: [3, 15] },
    { supplierIdx: 1, invoice: "HM-1188", days: -8, due: 22, paid: 0, batchIdx: [4, 5, 7] },
    { supplierIdx: 1, invoice: "HM-1170", days: -40, due: -10, paid: 12000, batchIdx: [6, 13] },
    { supplierIdx: 2, invoice: "AP-908", days: -12, due: 18, paid: 0, batchIdx: [8, 9, 10, 12] },
  ];
  for (const p of poSpecs) {
    let total = 0;
    const lineBatches = p.batchIdx.map((i) => batches[i]);
    for (const b of lineBatches) total += b.qtyReceived * b.buyPriceMinor;
    const [po] = await db
      .insert(purchaseOrdersTable)
      .values({
        supplierId: suppliers[p.supplierIdx].id,
        invoiceNumber: p.invoice,
        invoiceDate: daysFromNow(p.days),
        dueDate: daysFromNow(p.due),
        totalMinor: total,
        paidMinor: Math.min(p.paid, total),
      })
      .returning();
    for (const b of lineBatches) {
      await db.insert(purchaseLinesTable).values({
        purchaseOrderId: po.id,
        medicineId: b.medicineId,
        batchId: b.id,
        qty: b.qtyReceived,
        buyPriceMinor: b.buyPriceMinor,
      });
    }
    if (p.paid > 0 && p.paid < 999999999) {
      await db.insert(supplierPaymentsTable).values({
        supplierId: suppliers[p.supplierIdx].id,
        purchaseOrderId: po.id,
        amountMinor: Math.min(p.paid, total),
        method: "upi",
        reference: "UPI-" + Math.floor(Math.random() * 1e9),
      });
    } else if (p.paid >= 999999999) {
      await db.insert(supplierPaymentsTable).values({
        supplierId: suppliers[p.supplierIdx].id,
        purchaseOrderId: po.id,
        amountMinor: total,
        method: "bank",
        reference: "NEFT-" + Math.floor(Math.random() * 1e9),
      });
    }
  }

  // Sales — spread across last 14 days, plus a few today, with various payment methods + doctor refs
  const saleSpecs: Array<{
    daysAgo: number;
    lines: Array<{ batchIdx: number; qty: number; discount?: number }>;
    customerIdx: number | null;
    doctorIdx: number | null;
    payment: "cash" | "upi" | "card" | "udhari";
    rx?: string;
  }> = [
    // Today
    { daysAgo: 0, lines: [{ batchIdx: 0, qty: 2 }, { batchIdx: 2, qty: 1 }], customerIdx: 0, doctorIdx: 0, payment: "udhari", rx: "Rx-1042" },
    { daysAgo: 0, lines: [{ batchIdx: 4, qty: 1 }], customerIdx: 2, doctorIdx: null, payment: "cash" },
    { daysAgo: 0, lines: [{ batchIdx: 5, qty: 2 }, { batchIdx: 12, qty: 1 }], customerIdx: 1, doctorIdx: 1, payment: "upi", rx: "Rx-1043" },
    { daysAgo: 0, lines: [{ batchIdx: 0, qty: 4 }, { batchIdx: 4, qty: 2 }], customerIdx: 3, doctorIdx: 0, payment: "card" },
    { daysAgo: 0, lines: [{ batchIdx: 10, qty: 1 }], customerIdx: 4, doctorIdx: 1, payment: "upi" },
    // Past 14 days
    { daysAgo: 1, lines: [{ batchIdx: 0, qty: 3 }, { batchIdx: 5, qty: 1 }], customerIdx: 3, doctorIdx: 0, payment: "cash" },
    { daysAgo: 1, lines: [{ batchIdx: 11, qty: 1 }], customerIdx: 1, doctorIdx: 1, payment: "udhari" },
    { daysAgo: 2, lines: [{ batchIdx: 4, qty: 2 }, { batchIdx: 13, qty: 5 }], customerIdx: 0, doctorIdx: 2, payment: "upi" },
    { daysAgo: 2, lines: [{ batchIdx: 14, qty: 2 }], customerIdx: 2, doctorIdx: null, payment: "cash" },
    { daysAgo: 3, lines: [{ batchIdx: 0, qty: 6 }, { batchIdx: 4, qty: 3 }], customerIdx: 3, doctorIdx: 0, payment: "card" },
    { daysAgo: 3, lines: [{ batchIdx: 12, qty: 2 }], customerIdx: 4, doctorIdx: null, payment: "upi" },
    { daysAgo: 4, lines: [{ batchIdx: 2, qty: 2 }, { batchIdx: 0, qty: 2 }], customerIdx: 0, doctorIdx: 0, payment: "udhari" },
    { daysAgo: 5, lines: [{ batchIdx: 5, qty: 1 }], customerIdx: 1, doctorIdx: 1, payment: "cash" },
    { daysAgo: 5, lines: [{ batchIdx: 4, qty: 1 }, { batchIdx: 11, qty: 1 }], customerIdx: 3, doctorIdx: 1, payment: "upi" },
    { daysAgo: 6, lines: [{ batchIdx: 0, qty: 8 }], customerIdx: 2, doctorIdx: null, payment: "cash" },
    { daysAgo: 7, lines: [{ batchIdx: 13, qty: 4 }, { batchIdx: 12, qty: 1 }], customerIdx: 0, doctorIdx: 0, payment: "udhari" },
    { daysAgo: 8, lines: [{ batchIdx: 4, qty: 2 }], customerIdx: 1, doctorIdx: 1, payment: "card" },
    { daysAgo: 9, lines: [{ batchIdx: 0, qty: 5 }, { batchIdx: 5, qty: 2 }], customerIdx: 3, doctorIdx: 0, payment: "upi" },
    { daysAgo: 10, lines: [{ batchIdx: 2, qty: 3 }], customerIdx: 4, doctorIdx: null, payment: "cash" },
    { daysAgo: 11, lines: [{ batchIdx: 11, qty: 2 }], customerIdx: 0, doctorIdx: 0, payment: "udhari" },
    { daysAgo: 12, lines: [{ batchIdx: 14, qty: 1 }], customerIdx: 1, doctorIdx: 1, payment: "cash" },
    { daysAgo: 13, lines: [{ batchIdx: 0, qty: 4 }, { batchIdx: 4, qty: 1 }], customerIdx: 3, doctorIdx: 0, payment: "upi" },
  ];

  let invCounter = 1;
  for (const s of saleSpecs) {
    let subtotal = 0;
    let cost = 0;
    let totalDiscount = 0;
    const lineRows: (typeof saleLinesTable.$inferInsert)[] = [];

    for (const line of s.lines) {
      const batch = batches[line.batchIdx];
      const sell = batch.sellPriceMinor;
      const buy = batch.buyPriceMinor;
      const lineDiscount = line.discount ?? 0;
      subtotal += line.qty * sell;
      cost += line.qty * buy;
      totalDiscount += lineDiscount;
      lineRows.push({
        saleId: "",
        medicineId: batch.medicineId,
        batchId: batch.id,
        qty: line.qty,
        sellPriceMinor: sell,
        buyPriceMinor: buy,
        discountMinor: lineDiscount,
        taxMinor: 0,
      });
      // decrement stock
      await db
        .update(medicineBatchesTable)
        .set({ qtyOnHand: sql`${medicineBatchesTable.qtyOnHand} - ${line.qty}` })
        .where(sql`id = ${batch.id}`);
      batch.qtyOnHand -= line.qty;
    }

    const total = subtotal - totalDiscount;
    const paid = s.payment === "udhari" ? 0 : total;
    const invoiceNo = `INV-${String(invCounter++).padStart(6, "0")}`;

    const [sale] = await db
      .insert(salesTable)
      .values({
        invoiceNo,
        customerId: s.customerIdx != null ? customers[s.customerIdx].id : null,
        doctorId: s.doctorIdx != null ? doctors[s.doctorIdx].id : null,
        prescriptionNo: s.rx ?? null,
        subtotalMinor: subtotal,
        taxMinor: 0,
        discountMinor: totalDiscount,
        totalMinor: total,
        paidMinor: paid,
        costMinor: cost,
        paymentMethod: s.payment,
        soldAt: ts(-s.daysAgo),
      })
      .returning();

    for (const r of lineRows) r.saleId = sale.id;
    await db.insert(saleLinesTable).values(lineRows);

    if (s.payment === "udhari" && s.customerIdx != null) {
      await db.insert(udhariEntriesTable).values({
        customerId: customers[s.customerIdx].id,
        saleId: sale.id,
        amountMinor: total,
        note: `Sale on credit ${invoiceNo}`,
        enteredAt: ts(-s.daysAgo),
      });
    }
  }

  // A couple of customer payments to make ledgers interesting
  await db.insert(udhariEntriesTable).values([
    { customerId: customers[0].id, amountMinor: -50000, note: "Cash payment received", enteredAt: ts(-3) },
    { customerId: customers[1].id, amountMinor: -10000, note: "UPI payment received", enteredAt: ts(-2) },
  ]);

  logger.info("Seed complete");
}
