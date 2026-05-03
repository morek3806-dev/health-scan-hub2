import { AutoRouter, cors } from 'itty-router';

export interface Env {
  DB: D1Database;
}

const { preflight, corsify } = cors({ origin: '*' });
const router = AutoRouter({ before: [preflight], finally: [corsify] });

function uuid(): string {
  return crypto.randomUUID();
}

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

// ─── Health ─────────────────────────────────────────────────
router.get('/api/health', () => Response.json({ status: 'ok' }));

// ─── Dashboard ──────────────────────────────────────────────
router.get('/api/dashboard', async (req, env: Env) => {
  const db = env.DB;
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysLater = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const [todaySales, inventory, expiring, expired, alerts] = await Promise.all([
    db.prepare(`SELECT COALESCE(SUM(total_minor),0) as total, COALESCE(SUM(cost_minor),0) as cost, COUNT(*) as count FROM sales WHERE date(sold_at)=?`).bind(today).first(),
    db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN qty_on_hand <= (SELECT reorder_level FROM medicines WHERE id=medicine_id) THEN 1 ELSE 0 END) as low FROM medicine_batches WHERE qty_on_hand > 0`).first(),
    db.prepare(`SELECT COUNT(*) as count FROM medicine_batches WHERE qty_on_hand > 0 AND expiry_date <= ? AND expiry_date > ?`).bind(thirtyDaysLater, today).first(),
    db.prepare(`SELECT COUNT(*) as count FROM medicine_batches WHERE qty_on_hand > 0 AND expiry_date <= ?`).bind(today).first(),
    db.prepare(`SELECT COUNT(*) as count FROM alerts WHERE acknowledged=0`).first(),
  ]);

  const revenue = Number((todaySales as any)?.total ?? 0);
  const cost = Number((todaySales as any)?.cost ?? 0);

  return Response.json({
    todayRevenue: revenue,
    todayProfit: revenue - cost,
    todaySalesCount: Number((todaySales as any)?.count ?? 0),
    totalBatches: Number((inventory as any)?.total ?? 0),
    lowStockCount: Number((inventory as any)?.low ?? 0),
    expiringCount: Number((expiring as any)?.count ?? 0),
    expiredCount: Number((expired as any)?.count ?? 0),
    openAlertsCount: Number((alerts as any)?.count ?? 0),
  });
});

router.get('/api/dashboard/profit-trend', async (req, env: Env) => {
  const rows = await env.DB.prepare(`
    SELECT date(sold_at) as day,
      SUM(total_minor) as revenue,
      SUM(cost_minor) as cost
    FROM sales
    WHERE sold_at >= datetime('now', '-7 days')
    GROUP BY day ORDER BY day
  `).all();
  return Response.json(rows.results);
});

// ─── Medicines ──────────────────────────────────────────────
router.get('/api/medicines', async (req, env: Env) => {
  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  const activeOnly = url.searchParams.get('activeOnly') !== 'false';
  let query = `SELECT * FROM medicines WHERE 1=1`;
  const params: any[] = [];
  if (search) { query += ` AND (name LIKE ? OR generic_name LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }
  if (activeOnly) { query += ` AND is_active=1`; }
  query += ` ORDER BY name`;
  const rows = await env.DB.prepare(query).bind(...params).all();
  return Response.json(rows.results);
});

router.get('/api/medicines/:id', async (req, env: Env) => {
  const row = await env.DB.prepare(`SELECT * FROM medicines WHERE id=?`).bind(req.params.id).first();
  if (!row) return jsonError('Not found', 404);
  return Response.json(row);
});

router.post('/api/medicines', async (req, env: Env) => {
  const body = await req.json() as any;
  if (!body.name) return jsonError('name required');
  const id = uuid();
  await env.DB.prepare(`INSERT INTO medicines (id,name,generic_name,strength,form,hsn_code,gst_pct,reorder_level,is_active) VALUES (?,?,?,?,?,?,?,?,1)`)
    .bind(id, body.name, body.genericName??null, body.strength??null, body.form??null, body.hsnCode??null, body.gstPct??'12.00', body.reorderLevel??10).run();
  const row = await env.DB.prepare(`SELECT * FROM medicines WHERE id=?`).bind(id).first();
  return Response.json(row, { status: 201 });
});

router.put('/api/medicines/:id', async (req, env: Env) => {
  const body = await req.json() as any;
  await env.DB.prepare(`UPDATE medicines SET name=?,generic_name=?,strength=?,form=?,hsn_code=?,gst_pct=?,reorder_level=?,is_active=? WHERE id=?`)
    .bind(body.name, body.genericName??null, body.strength??null, body.form??null, body.hsnCode??null, body.gstPct??'12.00', body.reorderLevel??10, body.isActive?1:0, req.params.id).run();
  const row = await env.DB.prepare(`SELECT * FROM medicines WHERE id=?`).bind(req.params.id).first();
  return Response.json(row);
});

router.delete('/api/medicines/:id', async (req, env: Env) => {
  await env.DB.prepare(`UPDATE medicines SET is_active=0 WHERE id=?`).bind(req.params.id).run();
  return Response.json({ success: true });
});

// ─── Batches ─────────────────────────────────────────────────
router.get('/api/batches', async (req, env: Env) => {
  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  const status = url.searchParams.get('status') ?? '';
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysLater = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  let query = `SELECT b.*, m.name as medicine_name, m.generic_name, m.reorder_level, s.name as supplier_name FROM medicine_batches b JOIN medicines m ON m.id=b.medicine_id LEFT JOIN suppliers s ON s.id=b.supplier_id WHERE 1=1`;
  const params: any[] = [];
  if (search) { query += ` AND (m.name LIKE ? OR b.batch_number LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }
  if (status === 'expired') { query += ` AND b.expiry_date <= ?`; params.push(today); }
  else if (status === 'expiring') { query += ` AND b.expiry_date > ? AND b.expiry_date <= ?`; params.push(today, thirtyDaysLater); }
  else if (status === 'low') { query += ` AND b.qty_on_hand <= m.reorder_level`; }
  query += ` ORDER BY b.expiry_date`;
  const rows = await env.DB.prepare(query).bind(...params).all();
  return Response.json(rows.results);
});

router.post('/api/batches', async (req, env: Env) => {
  const body = await req.json() as any;
  const id = uuid();
  await env.DB.prepare(`INSERT INTO medicine_batches (id,medicine_id,batch_number,expiry_date,buy_price_minor,sell_price_minor,qty_received,qty_on_hand,supplier_id,raw_ocr_text) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, body.medicineId, body.batchNumber, body.expiryDate, body.buyPriceMinor, body.sellPriceMinor, body.qtyReceived, body.qtyReceived, body.supplierId??null, body.rawOcrText??null).run();
  const row = await env.DB.prepare(`SELECT * FROM medicine_batches WHERE id=?`).bind(id).first();
  return Response.json(row, { status: 201 });
});

router.put('/api/batches/:id', async (req, env: Env) => {
  const body = await req.json() as any;
  await env.DB.prepare(`UPDATE medicine_batches SET batch_number=?,expiry_date=?,buy_price_minor=?,sell_price_minor=?,qty_on_hand=? WHERE id=?`)
    .bind(body.batchNumber, body.expiryDate, body.buyPriceMinor, body.sellPriceMinor, body.qtyOnHand, req.params.id).run();
  const row = await env.DB.prepare(`SELECT * FROM medicine_batches WHERE id=?`).bind(req.params.id).first();
  return Response.json(row);
});

router.delete('/api/batches/:id', async (req, env: Env) => {
  await env.DB.prepare(`DELETE FROM medicine_batches WHERE id=?`).bind(req.params.id).run();
  return Response.json({ success: true });
});

// ─── Suppliers ───────────────────────────────────────────────
router.get('/api/suppliers', async (req, env: Env) => {
  const rows = await env.DB.prepare(`SELECT * FROM suppliers ORDER BY name`).all();
  return Response.json(rows.results);
});

router.get('/api/suppliers/:id', async (req, env: Env) => {
  const row = await env.DB.prepare(`SELECT * FROM suppliers WHERE id=?`).bind(req.params.id).first();
  if (!row) return jsonError('Not found', 404);
  return Response.json(row);
});

router.post('/api/suppliers', async (req, env: Env) => {
  const body = await req.json() as any;
  if (!body.name) return jsonError('name required');
  const id = uuid();
  await env.DB.prepare(`INSERT INTO suppliers (id,name,contact_phone,gstin,address,credit_days) VALUES (?,?,?,?,?,?)`)
    .bind(id, body.name, body.contactPhone??null, body.gstin??null, body.address??null, body.creditDays??30).run();
  const row = await env.DB.prepare(`SELECT * FROM suppliers WHERE id=?`).bind(id).first();
  return Response.json(row, { status: 201 });
});

router.put('/api/suppliers/:id', async (req, env: Env) => {
  const body = await req.json() as any;
  await env.DB.prepare(`UPDATE suppliers SET name=?,contact_phone=?,gstin=?,address=?,credit_days=? WHERE id=?`)
    .bind(body.name, body.contactPhone??null, body.gstin??null, body.address??null, body.creditDays??30, req.params.id).run();
  const row = await env.DB.prepare(`SELECT * FROM suppliers WHERE id=?`).bind(req.params.id).first();
  return Response.json(row);
});

router.delete('/api/suppliers/:id', async (req, env: Env) => {
  await env.DB.prepare(`DELETE FROM suppliers WHERE id=?`).bind(req.params.id).run();
  return Response.json({ success: true });
});

// ─── Customers ───────────────────────────────────────────────
router.get('/api/customers', async (req, env: Env) => {
  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  let query = `SELECT * FROM customers WHERE 1=1`;
  const params: any[] = [];
  if (search) { query += ` AND (name LIKE ? OR phone LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }
  query += ` ORDER BY name`;
  const rows = await env.DB.prepare(query).bind(...params).all();
  return Response.json(rows.results);
});

router.get('/api/customers/:id', async (req, env: Env) => {
  const row = await env.DB.prepare(`SELECT * FROM customers WHERE id=?`).bind(req.params.id).first();
  if (!row) return jsonError('Not found', 404);
  return Response.json(row);
});

router.post('/api/customers', async (req, env: Env) => {
  const body = await req.json() as any;
  if (!body.name) return jsonError('name required');
  const id = uuid();
  await env.DB.prepare(`INSERT INTO customers (id,name,phone,address,udhari_limit_minor,notes) VALUES (?,?,?,?,?,?)`)
    .bind(id, body.name, body.phone??null, body.address??null, body.udhariLimitMinor??0, body.notes??null).run();
  const row = await env.DB.prepare(`SELECT * FROM customers WHERE id=?`).bind(id).first();
  return Response.json(row, { status: 201 });
});

router.put('/api/customers/:id', async (req, env: Env) => {
  const body = await req.json() as any;
  await env.DB.prepare(`UPDATE customers SET name=?,phone=?,address=?,udhari_limit_minor=?,notes=? WHERE id=?`)
    .bind(body.name, body.contactPhone??null, body.address??null, body.udhariLimitMinor??0, body.notes??null, req.params.id).run();
  const row = await env.DB.prepare(`SELECT * FROM customers WHERE id=?`).bind(req.params.id).first();
  return Response.json(row);
});

// ─── Doctors ─────────────────────────────────────────────────
router.get('/api/doctors', async (req, env: Env) => {
  const rows = await env.DB.prepare(`SELECT * FROM doctors ORDER BY name`).all();
  return Response.json(rows.results);
});

router.post('/api/doctors', async (req, env: Env) => {
  const body = await req.json() as any;
  if (!body.name) return jsonError('name required');
  const id = uuid();
  await env.DB.prepare(`INSERT INTO doctors (id,name,qualification,clinic,phone,registration_no) VALUES (?,?,?,?,?,?)`)
    .bind(id, body.name, body.qualification??null, body.clinic??null, body.phone??null, body.registrationNo??null).run();
  const row = await env.DB.prepare(`SELECT * FROM doctors WHERE id=?`).bind(id).first();
  return Response.json(row, { status: 201 });
});

router.put('/api/doctors/:id', async (req, env: Env) => {
  const body = await req.json() as any;
  await env.DB.prepare(`UPDATE doctors SET name=?,qualification=?,clinic=?,phone=?,registration_no=? WHERE id=?`)
    .bind(body.name, body.qualification??null, body.clinic??null, body.phone??null, body.registrationNo??null, req.params.id).run();
  const row = await env.DB.prepare(`SELECT * FROM doctors WHERE id=?`).bind(req.params.id).first();
  return Response.json(row);
});

router.delete('/api/doctors/:id', async (req, env: Env) => {
  await env.DB.prepare(`DELETE FROM doctors WHERE id=?`).bind(req.params.id).run();
  return Response.json({ success: true });
});

// ─── Sales ───────────────────────────────────────────────────
router.get('/api/sales', async (req, env: Env) => {
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') ?? 50);
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const rows = await env.DB.prepare(`
    SELECT s.*, c.name as customer_name, d.name as doctor_name
    FROM sales s
    LEFT JOIN customers c ON c.id=s.customer_id
    LEFT JOIN doctors d ON d.id=s.doctor_id
    ORDER BY s.sold_at DESC LIMIT ? OFFSET ?
  `).bind(limit, offset).all();
  return Response.json(rows.results);
});

router.get('/api/sales/:id', async (req, env: Env) => {
  const sale = await env.DB.prepare(`
    SELECT s.*, c.name as customer_name, d.name as doctor_name
    FROM sales s LEFT JOIN customers c ON c.id=s.customer_id LEFT JOIN doctors d ON d.id=s.doctor_id
    WHERE s.id=?
  `).bind(req.params.id).first();
  if (!sale) return jsonError('Not found', 404);
  const lines = await env.DB.prepare(`
    SELECT sl.*, m.name as medicine_name, b.batch_number, b.expiry_date
    FROM sale_lines sl JOIN medicines m ON m.id=sl.medicine_id JOIN medicine_batches b ON b.id=sl.batch_id
    WHERE sl.sale_id=?
  `).bind(req.params.id).all();
  return Response.json({ ...sale, lines: lines.results });
});

router.post('/api/sales', async (req, env: Env) => {
  const body = await req.json() as any;
  const id = uuid();
  const invoiceNo = `INV-${Date.now()}`;
  await env.DB.prepare(`INSERT INTO sales (id,invoice_no,customer_id,doctor_id,prescription_no,subtotal_minor,tax_minor,discount_minor,total_minor,paid_minor,cost_minor,payment_method,sold_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`)
    .bind(id, invoiceNo, body.customerId??null, body.doctorId??null, body.prescriptionNo??null, body.subtotalMinor??0, body.taxMinor??0, body.discountMinor??0, body.totalMinor??0, body.paidMinor??0, body.costMinor??0, body.paymentMethod??'cash').run();
  if (body.lines?.length) {
    for (const line of body.lines) {
      await env.DB.prepare(`INSERT INTO sale_lines (id,sale_id,medicine_id,batch_id,qty,sell_price_minor,buy_price_minor,discount_minor,tax_minor) VALUES (?,?,?,?,?,?,?,?,?)`)
        .bind(uuid(), id, line.medicineId, line.batchId, line.qty, line.sellPriceMinor, line.buyPriceMinor??0, line.discountMinor??0, line.taxMinor??0).run();
      await env.DB.prepare(`UPDATE medicine_batches SET qty_on_hand=qty_on_hand-? WHERE id=?`).bind(line.qty, line.batchId).run();
    }
  }
  const row = await env.DB.prepare(`SELECT * FROM sales WHERE id=?`).bind(id).first();
  return Response.json(row, { status: 201 });
});

// ─── Analytics ───────────────────────────────────────────────
router.get('/api/analytics/summary', async (req, env: Env) => {
  const url = new URL(req.url);
  const from = url.searchParams.get('from') ?? new Date(Date.now() - 30*86400000).toISOString().split('T')[0];
  const to = url.searchParams.get('to') ?? new Date().toISOString().split('T')[0];
  const row = await env.DB.prepare(`
    SELECT COUNT(*) as sales_count, COALESCE(SUM(total_minor),0) as revenue,
      COALESCE(SUM(cost_minor),0) as cost,
      COALESCE(SUM(total_minor)-SUM(cost_minor),0) as profit
    FROM sales WHERE date(sold_at) BETWEEN ? AND ?
  `).bind(from, to).first();
  return Response.json(row);
});

router.get('/api/analytics/top-medicines', async (req, env: Env) => {
  const rows = await env.DB.prepare(`
    SELECT m.name, SUM(sl.qty) as qty_sold, SUM(sl.sell_price_minor*sl.qty) as revenue
    FROM sale_lines sl JOIN medicines m ON m.id=sl.medicine_id
    JOIN sales s ON s.id=sl.sale_id
    WHERE s.sold_at >= datetime('now','-30 days')
    GROUP BY m.id ORDER BY qty_sold DESC LIMIT 10
  `).all();
  return Response.json(rows.results);
});

// ─── Alerts ──────────────────────────────────────────────────
router.get('/api/alerts', async (req, env: Env) => {
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get('unreadOnly') !== 'false';
  let query = `SELECT * FROM alerts`;
  if (unreadOnly) query += ` WHERE acknowledged=0`;
  query += ` ORDER BY created_at DESC LIMIT 50`;
  const rows = await env.DB.prepare(query).all();
  return Response.json(rows.results);
});

router.patch('/api/alerts/:id/acknowledge', async (req, env: Env) => {
  await env.DB.prepare(`UPDATE alerts SET acknowledged=1 WHERE id=?`).bind(req.params.id).run();
  return Response.json({ success: true });
});

router.patch('/api/alerts/acknowledge-all', async (req, env: Env) => {
  await env.DB.prepare(`UPDATE alerts SET acknowledged=1`).run();
  return Response.json({ success: true });
});

export default { fetch: router.fetch };
