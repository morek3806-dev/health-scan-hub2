import { Router, type IRouter } from "express";
import { db, doctorsTable, salesTable } from "@workspace/db";
import { and, asc, eq, gte, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/doctors", async (_req, res): Promise<void> => {
  const since = new Date(Date.now() - 30 * 86400000);
  const rows = await db
    .select({
      d: doctorsTable,
      scriptCount30d: sql<number>`COUNT(${salesTable.id})::int`,
      revenueMinor30d: sql<number>`COALESCE(SUM(${salesTable.totalMinor}), 0)::bigint`,
    })
    .from(doctorsTable)
    .leftJoin(
      salesTable,
      and(eq(salesTable.doctorId, doctorsTable.id), gte(salesTable.soldAt, since)),
    )
    .groupBy(doctorsTable.id)
    .orderBy(asc(doctorsTable.name));
  res.json(
    rows.map((r) => ({
      id: r.d.id,
      name: r.d.name,
      qualification: r.d.qualification,
      clinic: r.d.clinic,
      phone: r.d.phone,
      registrationNo: r.d.registrationNo,
      scriptCount30d: Number(r.scriptCount30d),
      revenueMinor30d: Number(r.revenueMinor30d),
    })),
  );
});

router.post("/doctors", async (req, res): Promise<void> => {
  const b = req.body ?? {};
  if (!b.name) {
    res.status(400).json({ error: "name required" });
    return;
  }
  const [row] = await db
    .insert(doctorsTable)
    .values({
      name: b.name,
      qualification: b.qualification ?? null,
      clinic: b.clinic ?? null,
      phone: b.phone ?? null,
      registrationNo: b.registrationNo ?? null,
    })
    .returning();
  res.status(201).json(row);
});

export default router;
