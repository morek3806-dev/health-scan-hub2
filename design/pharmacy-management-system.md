# Pharmacy Management System — Design Specification

A comprehensive, mobile-first system for an independent pharmacy owner. Seven integrated modules:

1. Inventory & Expiry
2. Sales & Billing (POS)
3. Supplier / Dealer Management
4. Financial Tracking (real-time profit)
5. Credit (Udhari) Ledger
6. Medical Records (Prescribed-by-Doctor on every transaction)
7. Stock Insights (fast / slow movers)

---

## 1. System Architecture

### 1.1 High-level diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                       MOBILE-RESPONSIVE PWA                       │
│  React + Vite + Tailwind + TanStack Query (installable on phone) │
└────────────────┬─────────────────────────────────────────────────┘
                 │  HTTPS  (JWT in HttpOnly cookie)
                 ▼
┌──────────────────────────────────────────────────────────────────┐
│            API GATEWAY  (Node + Express 5, OpenAPI-first)         │
│  Auth │ Rate limit │ Request logging │ Zod validation             │
├──────────────────────────────────────────────────────────────────┤
│  Modules                                                          │
│  ├─ inventory      ├─ sales        ├─ suppliers                   │
│  ├─ udhari         ├─ doctors      ├─ analytics                   │
│  └─ alerts (background worker: low-stock + near-expiry)           │
└────────────────┬─────────────────────────────────────────────────┘
                 ▼
┌──────────────────────────────────────────────────────────────────┐
│           PostgreSQL  (Drizzle ORM, multi-tenant by pharmacy_id)  │
│   ▸ Triggers maintain stock_on_hand on every sale / purchase      │
│   ▸ Materialized view: mv_stock_velocity (refreshed nightly)      │
│   ▸ Partial indexes: low-stock, near-expiry, unpaid invoices      │
└──────────────────────────────────────────────────────────────────┘

   Side channels:
   • Cron worker → push notification + SMS for alerts
   • Smart Scan OCR (existing module) → writes to medicine_batches
   • Daily backup → object storage
```

### 1.2 Tech stack

| Layer       | Choice                                           | Why |
|-------------|--------------------------------------------------|-----|
| Frontend    | React + Vite, Tailwind, shadcn/ui, TanStack Query, wouter | Already in this workspace; mobile-first, installable as PWA |
| State       | Zustand (client) + TanStack Query (server cache) | Tiny + great offline cache for shaky pharmacy Wi-Fi |
| API         | Express 5 + Zod (OpenAPI-generated types)        | Single source of truth via `lib/api-spec/openapi.yaml` |
| Database    | PostgreSQL 16 + Drizzle ORM                      | Triggers + materialized views + JSONB |
| Auth        | Clerk (owner + cashier roles)                    | Mobile-friendly, no password storage |
| Background  | `pg-boss` queue for nightly velocity refresh + alert cron | Same DB, no new infra |
| Notifications | Web Push (PWA) + optional SMS via Twilio       | Works on locked phone screen |
| Hosting     | Replit (Autoscale) for the API + static for the SPA | Already in use |

### 1.3 Module boundaries

```
┌──────────────────┐   sale_lines.batch_id   ┌──────────────────┐
│  Inventory       │◄───────────────────────►│  Sales / POS     │
│  medicines       │                         │  sales           │
│  medicine_batches│                         │  sale_lines      │
└────────┬─────────┘                         └─────────┬────────┘
         │ purchase_lines.batch_id                     │ sales.customer_id
         ▼                                              ▼
┌──────────────────┐                         ┌──────────────────┐
│  Suppliers       │                         │  Customers /     │
│  suppliers       │                         │  Udhari Ledger   │
│  purchase_orders │                         │  customers       │
│  purchase_lines  │                         │  udhari_entries  │
│  supplier_payments│                        └──────────────────┘
└──────────────────┘
         ▲                                   ┌──────────────────┐
         └────── doctors.id (referrals) ────►│  Doctors         │
                                             └──────────────────┘
                          │
                          ▼
                ┌──────────────────┐
                │  Analytics       │
                │  mv_stock_velocity│
                │  v_profit_today  │
                └──────────────────┘
```

---

## 2. Database Schema (PostgreSQL)

All tables are multi-tenant via `pharmacy_id`. All money is stored in **minor units (paise / cents)** as `BIGINT` to avoid float drift. All timestamps are `TIMESTAMPTZ`.

```sql
-- ─────────────────────────────────────────────────────────────
-- 0. TENANCY & USERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE pharmacies (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    phone         TEXT,
    address       TEXT,
    gstin         TEXT,
    currency      CHAR(3) NOT NULL DEFAULT 'INR',
    low_stock_threshold INT NOT NULL DEFAULT 10,
    near_expiry_days    INT NOT NULL DEFAULT 60,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id   UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    clerk_user_id TEXT UNIQUE NOT NULL,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('owner','cashier')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 1. INVENTORY
-- ─────────────────────────────────────────────────────────────
CREATE TABLE medicines (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id   UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    generic_name  TEXT,
    strength      TEXT,                       -- "500mg", "10ml"
    form          TEXT,                       -- tablet, syrup, inhaler
    schedule      TEXT,                       -- "H", "H1", "OTC"
    hsn_code      TEXT,                       -- for GST
    gst_pct       NUMERIC(4,2) DEFAULT 12.00,
    catalog_id    TEXT,                       -- RxNorm / local id
    reorder_level INT NOT NULL DEFAULT 10,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pharmacy_id, name, strength)
);

CREATE TABLE medicine_batches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id     UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    medicine_id     UUID NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    batch_number    TEXT NOT NULL,
    expiry_date     DATE NOT NULL,
    buy_price_minor  BIGINT NOT NULL,         -- cost from supplier (per unit)
    sell_price_minor BIGINT NOT NULL,         -- MRP / sell price
    qty_received    INT NOT NULL,
    qty_on_hand     INT NOT NULL,             -- maintained by triggers
    supplier_id     UUID REFERENCES suppliers(id),
    purchase_line_id UUID,                    -- soft FK, see triggers
    raw_ocr_text    TEXT,                     -- from Smart Scan
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pharmacy_id, medicine_id, batch_number)
);
CREATE INDEX idx_batch_expiry  ON medicine_batches (pharmacy_id, expiry_date);
CREATE INDEX idx_batch_low     ON medicine_batches (pharmacy_id)
                                  WHERE qty_on_hand <= 10;

-- ─────────────────────────────────────────────────────────────
-- 2. SUPPLIERS / DEALERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE suppliers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id   UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    contact_phone TEXT,
    gstin         TEXT,
    address       TEXT,
    credit_days   INT DEFAULT 30,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pharmacy_id, name)
);

CREATE TABLE purchase_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id     UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    supplier_id     UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    invoice_number  TEXT NOT NULL,
    invoice_date    DATE NOT NULL,
    due_date        DATE,
    subtotal_minor  BIGINT NOT NULL DEFAULT 0,
    tax_minor       BIGINT NOT NULL DEFAULT 0,
    total_minor     BIGINT NOT NULL DEFAULT 0,
    paid_minor      BIGINT NOT NULL DEFAULT 0,    -- maintained by trigger
    status          TEXT GENERATED ALWAYS AS (
                      CASE
                        WHEN paid_minor >= total_minor THEN 'paid'
                        WHEN paid_minor > 0           THEN 'partial'
                        ELSE 'pending'
                      END
                    ) STORED,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pharmacy_id, supplier_id, invoice_number)
);
CREATE INDEX idx_po_pending ON purchase_orders (pharmacy_id, due_date)
                              WHERE paid_minor < total_minor;

CREATE TABLE purchase_lines (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    medicine_id       UUID NOT NULL REFERENCES medicines(id),
    batch_id          UUID NOT NULL REFERENCES medicine_batches(id),
    qty               INT NOT NULL,
    buy_price_minor   BIGINT NOT NULL,
    line_total_minor  BIGINT GENERATED ALWAYS AS (qty * buy_price_minor) STORED
);

CREATE TABLE supplier_payments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id       UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    supplier_id       UUID NOT NULL REFERENCES suppliers(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),  -- NULL = on-account
    amount_minor      BIGINT NOT NULL CHECK (amount_minor > 0),
    method            TEXT NOT NULL CHECK (method IN ('cash','upi','bank','cheque')),
    reference         TEXT,
    paid_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────
-- 3. CUSTOMERS & UDHARI (CREDIT) LEDGER
-- ─────────────────────────────────────────────────────────────
CREATE TABLE customers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id   UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    phone         TEXT,
    address       TEXT,
    udhari_limit_minor BIGINT DEFAULT 0,         -- 0 = no credit allowed
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pharmacy_id, phone)
);

CREATE TABLE udhari_entries (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id   UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sale_id       UUID REFERENCES sales(id),    -- NULL = manual entry
    -- positive = customer owes, negative = customer paid
    amount_minor  BIGINT NOT NULL,
    note          TEXT,
    entered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    entered_by    UUID REFERENCES users(id)
);
CREATE INDEX idx_udhari_customer ON udhari_entries (customer_id, entered_at DESC);

-- Materialized as a view, not stored:
CREATE VIEW v_customer_balance AS
SELECT customer_id, SUM(amount_minor) AS balance_minor
FROM   udhari_entries
GROUP BY customer_id;

-- ─────────────────────────────────────────────────────────────
-- 4. DOCTORS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE doctors (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id   UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    qualification TEXT,                          -- "MBBS", "BDS"
    clinic        TEXT,
    phone         TEXT,
    registration_no TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pharmacy_id, name, registration_no)
);

-- ─────────────────────────────────────────────────────────────
-- 5. SALES / POS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE sales (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id     UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    invoice_no      TEXT NOT NULL,
    customer_id     UUID REFERENCES customers(id),     -- NULL = walk-in
    doctor_id       UUID REFERENCES doctors(id),       -- "Prescribed by"
    prescription_no TEXT,
    cashier_id      UUID NOT NULL REFERENCES users(id),
    subtotal_minor  BIGINT NOT NULL DEFAULT 0,
    tax_minor       BIGINT NOT NULL DEFAULT 0,
    discount_minor  BIGINT NOT NULL DEFAULT 0,
    total_minor     BIGINT NOT NULL DEFAULT 0,
    paid_minor      BIGINT NOT NULL DEFAULT 0,
    payment_method  TEXT CHECK (payment_method IN ('cash','upi','card','udhari','split')),
    -- snapshot of cost so analytics survive future price changes:
    cost_minor      BIGINT NOT NULL DEFAULT 0,
    profit_minor    BIGINT GENERATED ALWAYS AS (total_minor - cost_minor) STORED,
    sold_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pharmacy_id, invoice_no)
);
CREATE INDEX idx_sales_day    ON sales (pharmacy_id, (sold_at::date));
CREATE INDEX idx_sales_doctor ON sales (pharmacy_id, doctor_id);

CREATE TABLE sale_lines (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id           UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    medicine_id       UUID NOT NULL REFERENCES medicines(id),
    batch_id          UUID NOT NULL REFERENCES medicine_batches(id),  -- chosen by FEFO
    qty               INT NOT NULL CHECK (qty > 0),
    sell_price_minor  BIGINT NOT NULL,
    buy_price_minor   BIGINT NOT NULL,                 -- snapshot for profit
    discount_minor    BIGINT NOT NULL DEFAULT 0,
    tax_minor         BIGINT NOT NULL DEFAULT 0,
    line_total_minor  BIGINT GENERATED ALWAYS AS
        (qty * sell_price_minor - discount_minor + tax_minor) STORED
);
CREATE INDEX idx_saleline_med ON sale_lines (medicine_id);

-- ─────────────────────────────────────────────────────────────
-- 6. ALERTS QUEUE (low stock + near expiry)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE alerts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id   UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    kind          TEXT NOT NULL CHECK (kind IN ('low_stock','near_expiry','overdue_payment')),
    medicine_id   UUID REFERENCES medicines(id),
    batch_id      UUID REFERENCES medicine_batches(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    payload       JSONB NOT NULL,
    acknowledged  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_open ON alerts (pharmacy_id, created_at DESC) WHERE NOT acknowledged;

-- ─────────────────────────────────────────────────────────────
-- 7. STOCK INSIGHTS — fast vs slow movers
-- ─────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW mv_stock_velocity AS
WITH last_30d AS (
    SELECT sl.medicine_id,
           SUM(sl.qty)                          AS units_sold,
           SUM(sl.line_total_minor)             AS revenue_minor,
           SUM(sl.qty * sl.buy_price_minor)     AS cost_minor
    FROM   sale_lines sl
    JOIN   sales s ON s.id = sl.sale_id
    WHERE  s.sold_at >= now() - INTERVAL '30 days'
    GROUP  BY sl.medicine_id
),
stock AS (
    SELECT medicine_id, SUM(qty_on_hand) AS qty_on_hand
    FROM   medicine_batches
    GROUP  BY medicine_id
)
SELECT m.pharmacy_id,
       m.id                                  AS medicine_id,
       m.name,
       COALESCE(l.units_sold, 0)             AS units_sold_30d,
       COALESCE(l.revenue_minor, 0)          AS revenue_30d_minor,
       COALESCE(l.revenue_minor - l.cost_minor, 0) AS profit_30d_minor,
       COALESCE(s.qty_on_hand, 0)            AS qty_on_hand,
       CASE
         WHEN COALESCE(l.units_sold,0) >= 50 THEN 'fast'
         WHEN COALESCE(l.units_sold,0) >= 10 THEN 'normal'
         ELSE 'slow'
       END                                   AS velocity_band
FROM   medicines m
LEFT   JOIN last_30d l ON l.medicine_id = m.id
LEFT   JOIN stock    s ON s.medicine_id = m.id
WHERE  m.is_active;

CREATE UNIQUE INDEX ON mv_stock_velocity (medicine_id);
-- Refreshed nightly: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stock_velocity;
```

### 2.1 Triggers — keep stock and balances correct

```sql
-- (a) On INSERT into purchase_lines  → increment batch.qty_on_hand
CREATE OR REPLACE FUNCTION trg_purchase_line_stock() RETURNS TRIGGER AS $$
BEGIN
    UPDATE medicine_batches
       SET qty_on_hand = qty_on_hand + NEW.qty
     WHERE id = NEW.batch_id;
    RETURN NEW;
END$$ LANGUAGE plpgsql;
CREATE TRIGGER t_purchase_line_stock
AFTER INSERT ON purchase_lines
FOR EACH ROW EXECUTE FUNCTION trg_purchase_line_stock();

-- (b) On INSERT into sale_lines  → decrement batch.qty_on_hand and roll up sale totals
CREATE OR REPLACE FUNCTION trg_sale_line_stock() RETURNS TRIGGER AS $$
BEGIN
    UPDATE medicine_batches
       SET qty_on_hand = qty_on_hand - NEW.qty
     WHERE id = NEW.batch_id;

    UPDATE sales
       SET subtotal_minor = subtotal_minor + NEW.qty * NEW.sell_price_minor,
           tax_minor      = tax_minor      + NEW.tax_minor,
           discount_minor = discount_minor + NEW.discount_minor,
           cost_minor     = cost_minor     + NEW.qty * NEW.buy_price_minor,
           total_minor    = total_minor    + NEW.line_total_minor
     WHERE id = NEW.sale_id;
    RETURN NEW;
END$$ LANGUAGE plpgsql;
CREATE TRIGGER t_sale_line_stock
AFTER INSERT ON sale_lines
FOR EACH ROW EXECUTE FUNCTION trg_sale_line_stock();

-- (c) On INSERT into supplier_payments → roll up purchase_orders.paid_minor
CREATE OR REPLACE FUNCTION trg_supplier_payment() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.purchase_order_id IS NOT NULL THEN
       UPDATE purchase_orders
          SET paid_minor = paid_minor + NEW.amount_minor
        WHERE id = NEW.purchase_order_id;
    END IF;
    RETURN NEW;
END$$ LANGUAGE plpgsql;
CREATE TRIGGER t_supplier_payment
AFTER INSERT ON supplier_payments
FOR EACH ROW EXECUTE FUNCTION trg_supplier_payment();

-- (d) On a sale paid via 'udhari'  → write a +amount udhari_entry
CREATE OR REPLACE FUNCTION trg_sale_udhari() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.payment_method = 'udhari' AND NEW.customer_id IS NOT NULL THEN
       INSERT INTO udhari_entries (pharmacy_id, customer_id, sale_id, amount_minor, note)
       VALUES (NEW.pharmacy_id, NEW.customer_id, NEW.id,
               NEW.total_minor - NEW.paid_minor, 'Sale on credit');
    END IF;
    RETURN NEW;
END$$ LANGUAGE plpgsql;
CREATE TRIGGER t_sale_udhari
AFTER INSERT ON sales
FOR EACH ROW EXECUTE FUNCTION trg_sale_udhari();
```

### 2.2 Headline analytics queries

```sql
-- Today's profit (the number on the home screen)
SELECT COALESCE(SUM(profit_minor), 0) AS profit_today_minor
FROM   sales
WHERE  pharmacy_id = $1
  AND  sold_at::date = CURRENT_DATE;

-- Pending supplier payments
SELECT s.name, SUM(po.total_minor - po.paid_minor) AS due_minor,
       MIN(po.due_date)                            AS next_due
FROM   purchase_orders po
JOIN   suppliers s ON s.id = po.supplier_id
WHERE  po.pharmacy_id = $1 AND po.paid_minor < po.total_minor
GROUP  BY s.name
ORDER  BY next_due NULLS LAST;

-- Customers with open udhari
SELECT c.name, c.phone, vb.balance_minor
FROM   v_customer_balance vb
JOIN   customers c ON c.id = vb.customer_id
WHERE  c.pharmacy_id = $1 AND vb.balance_minor > 0
ORDER  BY vb.balance_minor DESC;

-- Top doctors by referral revenue (last 30d)
SELECT d.name, COUNT(*) AS scripts, SUM(s.total_minor) AS revenue_minor
FROM   sales s JOIN doctors d ON d.id = s.doctor_id
WHERE  s.pharmacy_id = $1 AND s.sold_at >= now() - INTERVAL '30 days'
GROUP  BY d.name
ORDER  BY revenue_minor DESC;

-- Fast vs slow movers
SELECT name, units_sold_30d, qty_on_hand, velocity_band
FROM   mv_stock_velocity
WHERE  pharmacy_id = $1
ORDER  BY units_sold_30d DESC;
```

---

## 3. REST API Surface (OpenAPI summary)

All paths are prefixed with `/api`. JSON in/out. Auth via `Authorization: Bearer` (Clerk JWT).

| Method & Path                                | Purpose                                  |
|----------------------------------------------|------------------------------------------|
| `GET    /dashboard/summary`                  | Profit today, low-stock count, near-expiry count, udhari outstanding, pending supplier dues |
| `GET    /medicines?search=&velocity=`        | List with filters                        |
| `POST   /medicines`                          | Create                                   |
| `GET    /batches?expiringWithinDays=`        | Inventory + expiry alerts                |
| `POST   /batches` / `PATCH /batches/:id`     | From Smart Scan or manual entry          |
| `GET    /suppliers` / `POST` / `:id`         | Supplier CRUD                            |
| `GET    /suppliers/:id/balance`              | Outstanding due                          |
| `POST   /purchase-orders`                    | Log purchase (creates batches in trigger) |
| `POST   /purchase-orders/:id/payments`       | Pay supplier                             |
| `GET    /customers` / `POST` / `:id`         | Customer CRUD                            |
| `GET    /customers/:id/udhari`               | Ledger entries + running balance         |
| `POST   /customers/:id/udhari`               | Manual debit/credit (positive owes, negative paid) |
| `GET    /doctors` / `POST` / `:id`           | Doctor CRUD                              |
| `POST   /sales`                              | Create POS sale (lines included)         |
| `GET    /sales?from=&to=&doctorId=`          | Sales history                            |
| `GET    /analytics/profit?range=today\|7d\|30d` | Profit chart                          |
| `GET    /analytics/velocity`                 | Fast vs slow movers                      |
| `GET    /alerts?status=open`                 | Notification feed                        |
| `POST   /alerts/:id/ack`                     | Acknowledge                              |

Background workers:
- Cron `0 1 * * *` → `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_stock_velocity`
- Cron `0 9 * * *` → scan inventory + supplier dues, insert into `alerts`, push notify

---

## 4. Mobile-First UI Wireframes

Designed for a 360 × 740 phone, single-thumb operation. Bottom navigation: **Home · POS · Stock · People · More**. The owner spends 90 % of the day on **Home** and **POS**.

### 4.1 Home / Owner Dashboard

```
┌───────────────────────────────┐
│ ☰  Sunrise Medical      🔔 3  │  ← header, bell shows alert count
├───────────────────────────────┤
│  Today's Profit               │
│  ₹ 4,820                ↑ 12% │  ← BIG, the headline number
│  Sales ₹18,400 · Cost ₹13,580 │
├───────────────────────────────┤
│ ┌───────────┐ ┌─────────────┐ │
│ │ Low stock │ │ Near expiry │ │
│ │     7     │ │    12       │ │  ← tappable summary tiles
│ └───────────┘ └─────────────┘ │
│ ┌───────────┐ ┌─────────────┐ │
│ │ Udhari due│ │ Pay suppliers│ │
│ │ ₹22,100   │ │ ₹84,500      │ │
│ └───────────┘ └─────────────┘ │
├───────────────────────────────┤
│ Profit · last 7 days          │
│  ▁▂▄▃▆▇█    (sparkline)       │
├───────────────────────────────┤
│ Top doctors this month        │
│ Dr. R Mehta     ₹42,300  · 38 │
│ Dr. S Khan      ₹31,900  · 27 │
├───────────────────────────────┤
│ [Home]  POS   Stock  People  •│  ← bottom nav, Home active
└───────────────────────────────┘
```

### 4.2 POS / New Sale

```
┌───────────────────────────────┐
│ ←  New sale  INV-001284   ✕   │
├───────────────────────────────┤
│ 🔍 Scan barcode / type med…   │  ← autocomplete with FEFO batch
├───────────────────────────────┤
│ Paracetamol 500mg             │
│ B: PCT-2027A · Exp 11/27      │
│ ₹45  ×  [-] 2 [+]      ₹90    │
│ ─────────────────────────────  │
│ Amoxicillin 500mg             │
│ B: AMX-998 · Exp 07/26        │
│ ₹120 × [-] 1 [+]      ₹120    │
├───────────────────────────────┤
│ Customer  ▾  Anita Sharma     │
│ Doctor    ▾  Dr. R Mehta      │
│ Rx no.       12-Apr-26 / 113  │
├───────────────────────────────┤
│ Subtotal           ₹210       │
│ GST (12%)           ₹25       │
│ Discount            ₹0        │
│ ─────────────                  │
│ Total              ₹235       │
├───────────────────────────────┤
│ Pay: [Cash] [UPI] [Card] [📒] │  ← 📒 = Udhari
│                                │
│        [   Charge ₹235   ]    │  ← full-width primary
└───────────────────────────────┘
```

### 4.3 Stock List (with filters)

```
┌───────────────────────────────┐
│ ←  Stock                  ⚙   │
│ [All] [Low] [Near expiry] [Fast]│ [Slow]  ← chip filters
│ 🔍 Search…                    │
├───────────────────────────────┤
│ Paracetamol 500mg     ● Fast  │
│ 124 in stock · ₹45            │
│ Nearest exp 11/27             │
│ ─────────────────────────────  │
│ Aspirin 75mg          ● Slow  │
│ 6 in stock · ₹25     ⚠ low    │
│ Nearest exp 04/26    ⚠ expired│
│ ─────────────────────────────  │
│ Amoxicillin 500mg     ● Norm  │
│ 38 in stock · ₹120            │
│ Nearest exp 07/26             │
├───────────────────────────────┤
│ [+ Scan bill]   [+ Add med]   │  ← FAB pair
└───────────────────────────────┘
```

### 4.4 Suppliers / Pending Payments

```
┌───────────────────────────────┐
│ ←  Suppliers              +   │
│ Outstanding total  ₹84,500    │
├───────────────────────────────┤
│ MediPlus Distributors         │
│ Due ₹32,000 · next 28-Apr     │
│ 4 invoices                    │
│ ─────────────────────────────  │
│ HealthMart Wholesale          │
│ Due ₹52,500 · next 02-May ⚠   │  ← red if past due
│ 6 invoices                    │
└───────────────────────────────┘

  → tap supplier
┌───────────────────────────────┐
│ ← MediPlus Distributors       │
│ Total purchased: ₹4,12,000    │
│ Paid: ₹3,80,000 · Due ₹32,000 │
├───────────────────────────────┤
│ Invoices                      │
│ INV-2287  ₹14,000  Pending    │
│ INV-2271  ₹18,000  Partial    │
│ INV-2245  ₹40,000  Paid ✓     │
├───────────────────────────────┤
│ [   Record payment   ]        │
└───────────────────────────────┘
```

### 4.5 Customer / Udhari Ledger

```
┌───────────────────────────────┐
│ ← Anita Sharma         ☎ 📍   │
│ Balance owed:  ₹2,340         │
│ Limit: ₹5,000                 │
├───────────────────────────────┤
│ 12-Apr  Sale INV-1284  +₹235  │
│ 09-Apr  Cash payment   -₹500  │
│ 02-Apr  Sale INV-1241  +₹860  │
│ 28-Mar  Sale INV-1198  +₹1,745│
├───────────────────────────────┤
│ [+ New udhari] [- Record paid]│
└───────────────────────────────┘
```

### 4.6 Stock Insights (Analytics)

```
┌───────────────────────────────┐
│ ←  Stock Insights       30d ▾ │
├───────────────────────────────┤
│  More — fastest movers        │
│ 1. Paracetamol 500mg   312 u  │
│ 2. Cetirizine 10mg     208 u  │
│ 3. Pantoprazole 40mg   174 u  │
├───────────────────────────────┤
│  Less — slow / dead stock     │
│ 1. Salbutamol inhaler   3 u   │
│ 2. Aspirin 75mg         6 u   │
│ 3. Losartan 50mg        9 u   │
├───────────────────────────────┤
│ Profit by category            │
│  ▇▇▇▇▇  Antibiotics  ₹38k    │
│  ▇▇▇    Painkillers  ₹22k    │
│  ▇▇     Diabetes     ₹14k    │
└───────────────────────────────┘
```

### 4.7 Alerts feed

```
┌───────────────────────────────┐
│ ←  Alerts                     │
├───────────────────────────────┤
│ ⚠ Aspirin 75mg expires in 4d  │
│   Batch ASP-OLD-4 · 6 units   │
│   [Mark seen] [Discount sale] │
│ ─────────────────────────────  │
│ ⚠ Amoxicillin low (3 left)    │
│   [Reorder MediPlus]          │
│ ─────────────────────────────  │
│ ⚠ HealthMart payment overdue  │
│   ₹52,500 · due 02-May        │
│   [Pay now]                   │
└───────────────────────────────┘
```

### 4.8 Component & interaction notes

- **Color**: teal primary (`#009688`), warm amber for "near expiry", coral for "overdue / expired", soft mint background. Same palette as the existing Smart Scan app so the new modules feel native.
- **Typography**: Inter, large numerics for money (28 px on Home).
- **Touch targets**: ≥ 44 px. Bottom sheet for editing batch / customer rows so the keyboard never covers the form.
- **Offline**: TanStack Query with `persistQueryClient` + IndexedDB. POS can complete sales offline and sync when back online (queued in `outbox` table client-side).
- **Smart Scan reuse**: the existing `/scan` flow becomes the "+ Scan bill" entry point on the Stock screen. Confirmed scans write a `purchase_order` + `purchase_lines` + `medicine_batches` rows.
- **Reports / export**: a "Share PDF" action on each invoice and on the daily profit summary, generated server-side.

---

## 5. Roll-out plan (suggested phasing)

1. **Phase 1 (1 week)** — Auth, Pharmacy/User tenancy, Medicines + Batches + Smart Scan integration. Owner can see Inventory + Near Expiry.
2. **Phase 2 (1 week)** — Suppliers, Purchase Orders, Supplier Payments, Stock triggers. "Pending payments" tile lights up.
3. **Phase 3 (1 week)** — Customers, Doctors, POS (Sales + Sale Lines + payment), Today's Profit tile, Udhari ledger.
4. **Phase 4 (3 days)** — Alerts worker (low stock, near expiry, overdue payments), push notifications, mobile PWA install.
5. **Phase 5 (3 days)** — Materialized view + Stock Insights screen, doctor-referral analytics, profit charts.

Each phase is shippable on its own.
