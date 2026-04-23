import { Router, type IRouter } from "express";
import { db, customersTable, udhariEntriesTable } from "@workspace/db";
import { asc, eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/customers", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      c: customersTable,
      balanceMinor: sql<number>`COALESCE(SUM(${udhariEntriesTable.amountMinor}), 0)::bigint`,
      lastActivityAt: sql<Date | null>`MAX(${udhariEntriesTable.enteredAt})`,
    })
    .from(customersTable)
    .leftJoin(udhariEntriesTable, eq(udhariEntriesTable.customerId, customersTable.id))
    .groupBy(customersTable.id)
    .orderBy(asc(customersTable.name));
  res.json(
    rows.map((r) => ({
      id: r.c.id,
      name: r.c.name,
      phone: r.c.phone,
      address: r.c.address,
      udhariLimitMinor: Number(r.c.udhariLimitMinor),
      notes: r.c.notes,
      balanceMinor: Number(r.balanceMinor),
      lastActivityAt: r.lastActivityAt ?? null,
    })),
  );
});

router.post("/customers", async (req, res): Promise<void> => {
  const b = req.body ?? {};
  if (!b.name) {
    res.status(400).json({ error: "name required" });
    return;
  }
  const [row] = await db
    .insert(customersTable)
    .values({
      name: b.name,
      phone: b.phone ?? null,
      address: b.address ?? null,
      udhariLimitMinor: typeof b.udhariLimitMinor === "number" ? b.udhariLimitMinor : 0,
      notes: b.notes ?? null,
    })
    .returning();
  res.status(201).json({ ...row, udhariLimitMinor: Number(row.udhariLimitMinor) });
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [c] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  if (!c) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const entries = await db
    .select()
    .from(udhariEntriesTable)
    .where(eq(udhariEntriesTable.customerId, id))
    .orderBy(sql`${udhariEntriesTable.enteredAt} DESC`);
  const balance = entries.reduce((s, e) => s + Number(e.amountMinor), 0);
  res.json({
    id: c.id,
    name: c.name,
    phone: c.phone,
    address: c.address,
    udhariLimitMinor: Number(c.udhariLimitMinor),
    notes: c.notes,
    balanceMinor: balance,
    lastActivityAt: entries[0]?.enteredAt ?? null,
    entries: entries.map((e) => ({
      id: e.id,
      customerId: e.customerId,
      saleId: e.saleId,
      amountMinor: Number(e.amountMinor),
      note: e.note,
      enteredAt: e.enteredAt,
    })),
  });
});

router.post("/customers/:id/udhari", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const b = req.body ?? {};
  if (typeof b.amountMinor !== "number") {
    res.status(400).json({ error: "amountMinor required" });
    return;
  }
  const [row] = await db
    .insert(udhariEntriesTable)
    .values({
      customerId: id,
      amountMinor: b.amountMinor,
      note: b.note ?? null,
    })
    .returning();
  res.status(201).json({ ...row, amountMinor: Number(row.amountMinor) });
});

export default router;
