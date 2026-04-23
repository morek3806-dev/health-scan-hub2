import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  numeric,
  boolean,
  date,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Suppliers ──────────────────────────────────────────────
export const suppliersTable = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  contactPhone: text("contact_phone"),
  gstin: text("gstin"),
  address: text("address"),
  creditDays: integer("credit_days").notNull().default(30),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  nameIdx: uniqueIndex("suppliers_name_idx").on(t.name),
}));

// ─── Medicines ──────────────────────────────────────────────
export const medicinesTable = pgTable("medicines", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  genericName: text("generic_name"),
  strength: text("strength"),
  form: text("form"),
  hsnCode: text("hsn_code"),
  gstPct: numeric("gst_pct", { precision: 5, scale: 2 }).notNull().default("12.00"),
  reorderLevel: integer("reorder_level").notNull().default(10),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  nameStrengthIdx: uniqueIndex("medicines_name_strength_idx").on(t.name, t.strength),
}));

// ─── Medicine batches (inventory + expiry) ──────────────────
export const medicineBatchesTable = pgTable("medicine_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  medicineId: uuid("medicine_id")
    .notNull()
    .references(() => medicinesTable.id, { onDelete: "restrict" }),
  batchNumber: text("batch_number").notNull(),
  expiryDate: date("expiry_date").notNull(),
  buyPriceMinor: bigint("buy_price_minor", { mode: "number" }).notNull(),
  sellPriceMinor: bigint("sell_price_minor", { mode: "number" }).notNull(),
  qtyReceived: integer("qty_received").notNull(),
  qtyOnHand: integer("qty_on_hand").notNull(),
  supplierId: uuid("supplier_id").references(() => suppliersTable.id),
  rawOcrText: text("raw_ocr_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  medBatchIdx: uniqueIndex("batch_med_num_idx").on(t.medicineId, t.batchNumber),
  expiryIdx: index("batch_expiry_idx").on(t.expiryDate),
}));

// ─── Customers ──────────────────────────────────────────────
export const customersTable = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  udhariLimitMinor: bigint("udhari_limit_minor", { mode: "number" }).notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  phoneIdx: index("customers_phone_idx").on(t.phone),
}));

// ─── Doctors ────────────────────────────────────────────────
export const doctorsTable = pgTable("doctors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  qualification: text("qualification"),
  clinic: text("clinic"),
  phone: text("phone"),
  registrationNo: text("registration_no"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Purchase orders ────────────────────────────────────────
export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  supplierId: uuid("supplier_id")
    .notNull()
    .references(() => suppliersTable.id, { onDelete: "restrict" }),
  invoiceNumber: text("invoice_number").notNull(),
  invoiceDate: date("invoice_date").notNull(),
  dueDate: date("due_date"),
  totalMinor: bigint("total_minor", { mode: "number" }).notNull().default(0),
  paidMinor: bigint("paid_minor", { mode: "number" }).notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  invIdx: uniqueIndex("po_supplier_inv_idx").on(t.supplierId, t.invoiceNumber),
}));

export const purchaseLinesTable = pgTable("purchase_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrdersTable.id, { onDelete: "cascade" }),
  medicineId: uuid("medicine_id").notNull().references(() => medicinesTable.id),
  batchId: uuid("batch_id").notNull().references(() => medicineBatchesTable.id),
  qty: integer("qty").notNull(),
  buyPriceMinor: bigint("buy_price_minor", { mode: "number" }).notNull(),
});

export const supplierPaymentsTable = pgTable("supplier_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  supplierId: uuid("supplier_id").notNull().references(() => suppliersTable.id),
  purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrdersTable.id),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  method: text("method").notNull(),
  reference: text("reference"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Sales (POS) ────────────────────────────────────────────
export const salesTable = pgTable("sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceNo: text("invoice_no").notNull().unique(),
  customerId: uuid("customer_id").references(() => customersTable.id),
  doctorId: uuid("doctor_id").references(() => doctorsTable.id),
  prescriptionNo: text("prescription_no"),
  subtotalMinor: bigint("subtotal_minor", { mode: "number" }).notNull().default(0),
  taxMinor: bigint("tax_minor", { mode: "number" }).notNull().default(0),
  discountMinor: bigint("discount_minor", { mode: "number" }).notNull().default(0),
  totalMinor: bigint("total_minor", { mode: "number" }).notNull().default(0),
  paidMinor: bigint("paid_minor", { mode: "number" }).notNull().default(0),
  costMinor: bigint("cost_minor", { mode: "number" }).notNull().default(0),
  paymentMethod: text("payment_method").notNull(),
  soldAt: timestamp("sold_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  soldAtIdx: index("sales_sold_at_idx").on(t.soldAt),
}));

export const saleLinesTable = pgTable("sale_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  saleId: uuid("sale_id").notNull().references(() => salesTable.id, { onDelete: "cascade" }),
  medicineId: uuid("medicine_id").notNull().references(() => medicinesTable.id),
  batchId: uuid("batch_id").notNull().references(() => medicineBatchesTable.id),
  qty: integer("qty").notNull(),
  sellPriceMinor: bigint("sell_price_minor", { mode: "number" }).notNull(),
  buyPriceMinor: bigint("buy_price_minor", { mode: "number" }).notNull(),
  discountMinor: bigint("discount_minor", { mode: "number" }).notNull().default(0),
  taxMinor: bigint("tax_minor", { mode: "number" }).notNull().default(0),
});

// ─── Udhari ─────────────────────────────────────────────────
export const udhariEntriesTable = pgTable("udhari_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customersTable.id, { onDelete: "restrict" }),
  saleId: uuid("sale_id").references(() => salesTable.id),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  note: text("note"),
  enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  customerIdx: index("udhari_customer_idx").on(t.customerId),
}));

// ─── Alerts ─────────────────────────────────────────────────
export const alertsTable = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  medicineId: uuid("medicine_id").references(() => medicinesTable.id),
  batchId: uuid("batch_id").references(() => medicineBatchesTable.id),
  purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrdersTable.id),
  acknowledged: boolean("acknowledged").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  openIdx: index("alerts_open_idx").on(t.acknowledged, t.createdAt),
}));
