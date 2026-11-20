/**
 * Esquema completo de Nudo (AGENTS.md, sección 5).
 *
 * Convenciones: tablas/columnas en snake_case, ids uuid con gen_random_uuid(),
 * dinero en centavos (integer) y timestamps con zona horaria.
 *
 * Auth.js: con sesión JWT y provider Credentials no se necesitan las tablas
 * `sessions` ni `verificationTokens` (la documentación oficial las marca como
 * opcionales: solo para database sessions y Magic Link respectivamente).
 * Se conserva `accounts` porque la espera @auth/drizzle-adapter. Los nombres de
 * propiedades de TypeScript de `users` y `accounts` coinciden con las claves
 * que espera el adaptador, mientras las columnas SQL son snake_case.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { ARGENTINE_PROVINCES, type ArgentineProvince } from "@/lib/provinces";

export { ARGENTINE_PROVINCES, type ArgentineProvince };

/** Copia congelada de la dirección dentro del pedido (para análisis de mercado). */
export type ShippingAddressSnapshot = {
  recipient_name: string;
  phone: string;
  street: string;
  number: string;
  floor_apt?: string | null;
  city: string;
  /** Vacía en pedidos con retiro en persona (no hay dirección de envío). */
  province: ArgentineProvince | "";
  postal_code: string;
  notes?: string | null;
};

export const userRoleEnum = pgEnum("user_role", ["customer", "admin"]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment",
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
]);

export const shippingMethodEnum = pgEnum("shipping_method", ["delivery", "pickup"]);

export const stockMovementReasonEnum = pgEnum("stock_movement_reason", [
  "sale",
  "restock",
  "adjustment",
  "cancellation",
]);

/** Numeración legible de pedidos (#0041 se.formatea en la UI con padStart). */
export const orderNumberSequence = pgSequence("order_number_sequence", {
  startWith: 1,
});

// ---------------------------------------------------------------------------
// Autenticación
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: timestamp("email_verified", { withTimezone: true }),
    image: text("image"),
    passwordHash: text("password_hash"),
    role: userRoleEnum("role").notNull().default("customer"),
    phone: text("phone"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    usersRoleIdx: index("users_role_idx").on(table.role),
    usersCreatedAtIdx: index("users_created_at_idx").on(table.createdAt),
  }),
);

/**
 * Forma actual del adaptador Drizzle de Auth.js. Las propiedades TS conservan
 * las claves que el adaptador escribe (`providerAccountId`, `expires_at`, ...).
 */
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => ({
    accountsPk: primaryKey({
      name: "accounts_provider_provider_account_id_pk",
      columns: [table.provider, table.providerAccountId],
    }),
    accountsUserIdIdx: index("accounts_user_id_idx").on(table.userId),
  }),
);

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    parentId: uuid("parent_id"),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    categoriesParentIdIdx: index("categories_parent_id_idx").on(table.parentId),
    categoriesSelfFk: foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "categories_parent_id_fk",
    }).onDelete("set null"),
  }),
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    basePriceCents: integer("base_price_cents").notNull(),
    costCents: integer("cost_cents"),
    active: boolean("active").notNull().default(true),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    productsCategoryIdIdx: index("products_category_id_idx").on(table.categoryId),
    productsActiveIdx: index("products_active_idx").on(table.active),
    productsCreatedAtIdx: index("products_created_at_idx").on(table.createdAt),
    productsPricesCheck: check(
      "products_prices_check",
      sql`${table.basePriceCents} >= 0 and (${table.costCents} is null or ${table.costCents} >= 0)`,
    ),
  }),
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull().unique(),
    label: text("label").notNull(),
    attributes: jsonb("attributes").$type<Record<string, string>>().notNull().default({}),
    priceCents: integer("price_cents"),
    costCents: integer("cost_cents"),
    stock: integer("stock").notNull().default(0),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(3),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    productVariantsProductIdIdx: index("product_variants_product_id_idx").on(table.productId),
    productVariantsActiveIdx: index("product_variants_active_idx").on(table.active),
    productVariantsStockCheck: check("product_variants_stock_check", sql`${table.stock} >= 0`),
    productVariantsPricesCheck: check(
      "product_variants_prices_check",
      sql`(${table.priceCents} is null or ${table.priceCents} >= 0) and (${table.costCents} is null or ${table.costCents} >= 0)`,
    ),
    productVariantsThresholdCheck: check(
      "product_variants_threshold_check",
      sql`${table.lowStockThreshold} >= 0`,
    ),
  }),
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    publicId: text("public_id"),
    position: integer("position").notNull().default(0),
  },
  (table) => ({
    productImagesProductIdIdx: index("product_images_product_id_idx").on(table.productId),
  }),
);

// ---------------------------------------------------------------------------
// Carrito
// ---------------------------------------------------------------------------

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    sessionToken: text("session_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    cartsUserIdIdx: uniqueIndex("carts_user_id_idx").on(table.userId),
    cartsSessionTokenIdx: uniqueIndex("carts_session_token_idx").on(table.sessionToken),
    cartsIdentifiableCheck: check(
      "carts_identifiable_check",
      sql`${table.userId} is not null or ${table.sessionToken} is not null`,
    ),
  }),
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    cartItemsCartVariantIdx: uniqueIndex("cart_items_cart_variant_idx").on(
      table.cartId,
      table.variantId,
    ),
    cartItemsVariantIdIdx: index("cart_items_variant_id_idx").on(table.variantId),
    cartItemsQuantityCheck: check("cart_items_quantity_check", sql`${table.quantity} >= 1`),
  }),
);

// ---------------------------------------------------------------------------
// Direcciones
// ---------------------------------------------------------------------------

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientName: text("recipient_name").notNull(),
    phone: text("phone").notNull(),
    street: text("street").notNull(),
    number: text("number").notNull(),
    floorApt: text("floor_apt"),
    city: text("city").notNull(),
    province: text("province", { enum: ARGENTINE_PROVINCES }).notNull(),
    postalCode: text("postal_code").notNull(),
    notes: text("notes"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    addressesUserIdIdx: index("addresses_user_id_idx").on(table.userId),
  }),
);

// ---------------------------------------------------------------------------
// Pedidos y pagos
// ---------------------------------------------------------------------------

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    number: integer("number")
      .notNull()
      .default(sql`nextval('order_number_sequence')`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: orderStatusEnum("status").notNull().default("pending_payment"),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCostCents: integer("shipping_cost_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    shippingMethod: shippingMethodEnum("shipping_method").notNull(),
    shippingAddress: jsonb("shipping_address").$type<ShippingAddressSnapshot>().notNull(),
    paymentMethod: text("payment_method"),
    mpPreferenceId: text("mp_preference_id"),
    mpPaymentId: text("mp_payment_id"),
    mpStatus: text("mp_status"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    // Preparados para el futuro: hoy siempre null, no se calcula comisión.
    commissionRateBps: integer("commission_rate_bps"),
    commissionCents: integer("commission_cents"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    ordersNumberIdx: uniqueIndex("orders_number_idx").on(table.number),
    ordersStatusIdx: index("orders_status_idx").on(table.status),
    ordersCreatedAtIdx: index("orders_created_at_idx").on(table.createdAt),
    ordersUserIdIdx: index("orders_user_id_idx").on(table.userId),
    ordersPaidAtIdx: index("orders_paid_at_idx").on(table.paidAt),
    ordersAmountsCheck: check(
      "orders_amounts_check",
      sql`${table.subtotalCents} >= 0 and ${table.shippingCostCents} >= 0 and ${table.totalCents} >= 0`,
    ),
    ordersCommissionCheck: check(
      "orders_commission_check",
      sql`${table.commissionRateBps} is null or (${table.commissionRateBps} between 0 and 10000)`,
    ),
  }),
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    productName: text("product_name").notNull(),
    variantLabel: text("variant_label").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    unitCostCents: integer("unit_cost_cents"),
    quantity: integer("quantity").notNull(),
  },
  (table) => ({
    orderItemsOrderIdIdx: index("order_items_order_id_idx").on(table.orderId),
    orderItemsVariantIdIdx: index("order_items_variant_id_idx").on(table.variantId),
    orderItemsQuantityCheck: check("order_items_quantity_check", sql`${table.quantity} >= 1`),
  }),
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatusEnum("from_status"),
    toStatus: orderStatusEnum("to_status").notNull(),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orderStatusHistoryOrderIdIdx: index("order_status_history_order_id_idx").on(table.orderId),
    orderStatusHistoryCreatedAtIdx: index("order_status_history_created_at_idx").on(
      table.createdAt,
    ),
  }),
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull().default("mercadopago"),
    externalId: text("external_id").notNull(),
    action: text("action").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => ({
    // Idempotencia del webhook: un mismo evento no se procesa dos veces.
    paymentEventsUniqueIdx: uniqueIndex("payment_events_provider_external_action_idx").on(
      table.provider,
      table.externalId,
      table.action,
    ),
    paymentEventsReceivedAtIdx: index("payment_events_received_at_idx").on(table.receivedAt),
  }),
);

// ---------------------------------------------------------------------------
// Inventario
// ---------------------------------------------------------------------------

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: stockMovementReasonEnum("reason").notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    stockMovementsVariantIdIdx: index("stock_movements_variant_id_idx").on(table.variantId),
    stockMovementsOrderIdIdx: index("stock_movements_order_id_idx").on(table.orderId),
    stockMovementsCreatedAtIdx: index("stock_movements_created_at_idx").on(table.createdAt),
    stockMovementsReasonIdx: index("stock_movements_reason_idx").on(table.reason),
    stockMovementsDeltaCheck: check("stock_movements_delta_check", sql`${table.delta} <> 0`),
  }),
);

// ---------------------------------------------------------------------------
// Contabilidad
// ---------------------------------------------------------------------------

export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().unique(),
    color: text("color"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => expenseCategories.id),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    expenseDate: date("expense_date", { mode: "string" }).notNull(),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    expensesCategoryIdIdx: index("expenses_category_id_idx").on(table.categoryId),
    expensesDateIdx: index("expenses_expense_date_idx").on(table.expenseDate),
    expensesCreatedByIdx: index("expenses_created_by_idx").on(table.createdBy),
    expensesAmountCheck: check("expenses_amount_check", sql`${table.amountCents} >= 0`),
  }),
);

// ---------------------------------------------------------------------------
// Analítica y configuración
// ---------------------------------------------------------------------------

export const productViews = pgTable(
  "product_views",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    sessionToken: text("session_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productViewsProductIdIdx: index("product_views_product_id_idx").on(table.productId),
    productViewsSessionIdx: index("product_views_product_session_created_idx").on(
      table.productId,
      table.sessionToken,
      table.createdAt,
    ),
    productViewsCreatedAtIdx: index("product_views_created_at_idx").on(table.createdAt),
  }),
);

export const storeSettings = pgTable(
  "store_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeName: text("store_name").notNull(),
    shippingFlatCents: integer("shipping_flat_cents").notNull().default(0),
    freeShippingThresholdCents: integer("free_shipping_threshold_cents"),
    pickupEnabled: boolean("pickup_enabled").notNull().default(true),
    deliveryEnabled: boolean("delivery_enabled").notNull().default(true),
    pickupInstructions: text("pickup_instructions"),
    contactEmail: text("contact_email"),
    contactWhatsapp: text("contact_whatsapp"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // Un único registro de configuración: el índice expresional lo garantiza.
    storeSettingsSingleRowIdx: uniqueIndex("store_settings_single_row_idx").on(sql`((true))`),
    storeSettingsShippingCheck: check(
      "store_settings_shipping_check",
      sql`${table.shippingFlatCents} >= 0 and (${table.freeShippingThresholdCents} is null or ${table.freeShippingThresholdCents} >= 0)`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Relaciones (declaradas después de todas las tablas para evitar TDZ)
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  addresses: many(addresses),
  carts: many(carts),
  orders: many(orders),
  changedStatuses: many(orderStatusHistory, { relationName: "status_changed_by" }),
  stockMovements: many(stockMovements, { relationName: "movement_created_by" }),
  expenses: many(expenses, { relationName: "expense_created_by" }),
  productViews: many(productViews),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "category_parent",
  }),
  children: many(categories, { relationName: "category_parent" }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  variants: many(productVariants),
  images: many(productImages),
  views: many(productViews),
}));

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  cartItems: many(cartItems),
  orderItems: many(orderItems),
  stockMovements: many(stockMovements),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, { fields: [carts.userId], references: [users.id] }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  variant: one(productVariants, {
    fields: [cartItems.variantId],
    references: [productVariants.id],
  }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  statusHistory: many(orderStatusHistory),
  stockMovements: many(stockMovements),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(orders, { fields: [orderStatusHistory.orderId], references: [orders.id] }),
  changedByUser: one(users, {
    fields: [orderStatusHistory.changedBy],
    references: [users.id],
    relationName: "status_changed_by",
  }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  variant: one(productVariants, {
    fields: [stockMovements.variantId],
    references: [productVariants.id],
  }),
  order: one(orders, { fields: [stockMovements.orderId], references: [orders.id] }),
  createdByUser: one(users, {
    fields: [stockMovements.createdBy],
    references: [users.id],
    relationName: "movement_created_by",
  }),
}));

export const expenseCategoriesRelations = relations(expenseCategories, ({ many }) => ({
  expenses: many(expenses),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  category: one(expenseCategories, {
    fields: [expenses.categoryId],
    references: [expenseCategories.id],
  }),
  createdByUser: one(users, {
    fields: [expenses.createdBy],
    references: [users.id],
    relationName: "expense_created_by",
  }),
}));

export const productViewsRelations = relations(productViews, ({ one }) => ({
  product: one(products, { fields: [productViews.productId], references: [products.id] }),
  user: one(users, { fields: [productViews.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
