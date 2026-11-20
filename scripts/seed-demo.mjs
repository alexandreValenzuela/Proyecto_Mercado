/**
 * Datos demo de GAO Store (AGENTS.md, sección 11).
 *
 * Re-runnable: primero borra todas las filas demo y luego inserta ids
 * deterministas. Argentina no usa horario de verano desde 2010, por eso las
 * fechas locales se convierten con offset fijo UTC-03:00.
 *
 * Uso: npm run db:seed:demo
 */
import { createHash } from "node:crypto";
import { cleanDemo, getSql, INITIAL_EXPENSE_CATEGORIES, runBatches } from "./db.mjs";

const DEMO_NAMESPACE = "gao-store-demo-v1";

function demoId(kind, index) {
  const hash = createHash("sha256")
    .update(`${DEMO_NAMESPACE}:${kind}:${index}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

// PRNG determinista: el mismo seed produce siempre el mismo dataset demo.
let randomState = 20261119;
function random() {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 2 ** 32;
}
function randomInt(min, maxInclusive) {
  return min + Math.floor(random() * (maxInclusive - min + 1));
}
function pick(list) {
  return list[randomInt(0, list.length - 1)];
}

const argentinaToday = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Buenos_Aires",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
  .formatToParts(new Date())
  .filter((part) => part.type !== "literal")
  .reduce((acc, part) => ({ ...acc, [part.type]: part.value }), {});

const argentinaMidnightUtc =
  Date.UTC(
    Number(argentinaToday.year),
    Number(argentinaToday.month) - 1,
    Number(argentinaToday.day),
  );

/** Devuelve un ISO string: día local (0 = hoy) y hora local de Argentina. */
function localDate(dayOffset, hour, minute = 0) {
  return new Date(
    argentinaMidnightUtc - dayOffset * 86_400_000 + (hour + 3) * 3_600_000 + minute * 60_000,
  ).toISOString();
}

const categoryDefs = [
  { name: "Indumentaria", slug: "indumentaria", position: 1 },
  { name: "Accesorios", slug: "accesorios", position: 2 },
  { name: "Hogar", slug: "hogar", position: 3 },
  { name: "Papelería", slug: "papeleria", position: 4 },
  { name: "Regalos", slug: "regalos", position: 5 },
];

const productDefs = [
  {
    name: "Camiseta básica de algodón",
    slug: "camiseta-basica-algodon",
    description: "Camiseta de algodón peinado, corte regular y cuello redondo.",
    category: 0,
    basePriceCents: 12500,
    costCents: 5200,
    variants: [
      { label: "Talle S / Blanco", attributes: { talle: "S", color: "Blanco" }, stock: 18 },
      { label: "Talle M / Blanco", attributes: { talle: "M", color: "Blanco" }, stock: 24 },
      { label: "Talle L / Negro", attributes: { talle: "L", color: "Negro" }, stock: 2 },
    ],
  },
  {
    name: "Remera estampada GAO",
    slug: "remera-estampada-gao",
    description: "Remera con estampado serie limitada del equipo GAO.",
    category: 0,
    basePriceCents: 14500,
    costCents: 6200,
    variants: [
      { label: "Talle S", attributes: { talle: "S" }, stock: 9 },
      { label: "Talle M", attributes: { talle: "M" }, stock: 15 },
      { label: "Talle L", attributes: { talle: "L" }, stock: 3 },
    ],
  },
  {
    name: "Hoodie unisex",
    slug: "hoodie-unisex",
    description: "Hoodie de frisa con capucha y bolsillo canguro.",
    category: 0,
    basePriceCents: 28900,
    costCents: 13500,
    variants: [
      { label: "Talle M / Gris", attributes: { talle: "M", color: "Gris" }, stock: 11 },
      { label: "Talle L / Verde", attributes: { talle: "L", color: "Verde" }, stock: 7 },
    ],
  },
  {
    name: "Pantalón de lino",
    slug: "pantalon-de-lino",
    description: "Pantalón de lino lavado, cómodo para el verano.",
    category: 0,
    basePriceCents: 21900,
    costCents: 10200,
    variants: [
      { label: "Talle 38 / Beige", attributes: { talle: "38", color: "Beige" }, stock: 6 },
      { label: "Talle 40 / Beige", attributes: { talle: "40", color: "Beige" }, stock: 1 },
    ],
  },
  {
    name: "Calcetines pack x3",
    slug: "calcetines-pack-x3",
    description: "Pack de tres pares de calcetines de algodón.",
    category: 1,
    basePriceCents: 6900,
    costCents: 2400,
    variants: [{ label: "Única", attributes: {}, stock: 42 }],
  },
  {
    name: "Gorro de lana",
    slug: "gorro-de-lana",
    description: "Gorro tejido a mano con lana suave.",
    category: 1,
    basePriceCents: 8900,
    costCents: 3400,
    variants: [
      { label: "Única / Crema", attributes: { color: "Crema" }, stock: 14 },
      { label: "Única / Terracota", attributes: { color: "Terracota" }, stock: 3 },
    ],
  },
  {
    name: "Cartera de tela",
    slug: "cartera-de-tela",
    description: "Cartera tipo tote de lona con cierre interior.",
    category: 1,
    basePriceCents: 16500,
    costCents: 7200,
    variants: [{ label: "Única / Natural", attributes: { color: "Natural" }, stock: 12 }],
  },
  {
    name: "Cinturón de cuero",
    slug: "cinturon-de-cuero",
    description: "Cinturón de cuero genuino con hebilla metalizada.",
    category: 1,
    basePriceCents: 19900,
    costCents: 8800,
    variants: [
      { label: "90 cm", attributes: { medida: "90 cm" }, stock: 5 },
      { label: "100 cm", attributes: { medida: "100 cm" }, stock: 2 },
    ],
  },
  {
    name: "Veladora aromática",
    slug: "veladora-aromatica",
    description: "Vela de cera de soja con esencia de lavanda.",
    category: 2,
    basePriceCents: 11900,
    costCents: 4500,
    variants: [
      { label: "Lavanda", attributes: { aroma: "Lavanda" }, stock: 22 },
      { label: "Cítricos", attributes: { aroma: "Cítricos" }, stock: 16 },
    ],
  },
  {
    name: "Set de tazas de cerámica",
    slug: "set-de-tazas-ceramica",
    description: "Set de dos tazas de cerámica artesanal.",
    category: 2,
    basePriceCents: 17900,
    costCents: 7800,
    variants: [{ label: "Set x2", attributes: {}, stock: 13 }],
  },
  {
    name: "Mantel de lino",
    slug: "mantel-de-lino",
    description: "Mantel de lino para cuatro personas.",
    category: 2,
    basePriceCents: 24500,
    costCents: 11000,
    variants: [{ label: "140 x 180 cm", attributes: {}, stock: 4 }],
  },
  {
    name: "Cuaderno A5 tapas duras",
    slug: "cuaderno-a5-tapas-duras",
    description: "Cuaderno de 120 hojas con tapas duras y elástico.",
    category: 3,
    basePriceCents: 7200,
    costCents: 2600,
    variants: [
      { label: "Puntos", attributes: { interior: "Puntos" }, stock: 30 },
      { label: "Rayado", attributes: { interior: "Rayado" }, stock: 26 },
    ],
  },
  {
    name: "Set de lapiceras",
    slug: "set-de-lapiceras",
    description: "Set de tres lapiceras de tinta negra.",
    category: 3,
    basePriceCents: 5400,
    costCents: 1800,
    variants: [{ label: "Única", attributes: {}, stock: 38 }],
  },
  {
    name: "Agenda 2027",
    slug: "agenda-2027",
    description: "Agenda anual con semana visible y notas.",
    category: 3,
    basePriceCents: 9900,
    costCents: 3900,
    variants: [
      { label: "Verde", attributes: { color: "Verde" }, stock: 19 },
      { label: "Arcilla", attributes: { color: "Arcilla" }, stock: 3 },
    ],
  },
  {
    name: "Caja de regalo personalizada",
    slug: "caja-de-regalo-personalizada",
    description: "Cja con mensaje personalizado, ideal para obsequios.",
    category: 4,
    basePriceCents: 21500,
    costCents: 9500,
    variants: [
      { label: "Chica", attributes: { tamaño: "Chica" }, stock: 8 },
      { label: "Grande", attributes: { tamaño: "Grande" }, stock: 2 },
    ],
  },
  {
    name: "Kit de cuidado personal",
    slug: "kit-de-cuidado-personal",
    description: "Kit con crema, jabón y aceite en una bolsa de tela.",
    category: 4,
    basePriceCents: 18900,
    costCents: 8200,
    variants: [{ label: "Única", attributes: {}, stock: 10 }],
  },
];

const customerDefs = [
  { province: "Buenos Aires", city: "La Plata", postalCode: "1900" },
  { province: "Ciudad Autónoma de Buenos Aires", city: "CABA", postalCode: "1425" },
  { province: "Córdoba", city: "Córdoba", postalCode: "5000" },
  { province: "Santa Fe", city: "Rosario", postalCode: "2000" },
  { province: "Mendoza", city: "Mendoza", postalCode: "5500" },
  { province: "Tucumán", city: "San Miguel de Tucumán", postalCode: "4000" },
  { province: "Salta", city: "Salta", postalCode: "4400" },
  { province: "Entre Ríos", city: "Paraná", postalCode: "3100" },
  { province: "Corrientes", city: "Corrientes", postalCode: "3400" },
  { province: "Chaco", city: "Resistencia", postalCode: "3500" },
  { province: "Formosa", city: "Formosa", postalCode: "3600" },
  { province: "Jujuy", city: "San Salvador de Jujuy", postalCode: "4600" },
  { province: "La Rioja", city: "La Rioja", postalCode: "5300" },
  { province: "Misiones", city: "Posadas", postalCode: "3300" },
  { province: "Neuquén", city: "Neuquén", postalCode: "8300" },
  { province: "Río Negro", city: "Viedma", postalCode: "8500" },
  { province: "San Juan", city: "San Juan", postalCode: "5400" },
  { province: "San Luis", city: "San Luis", postalCode: "5700" },
  { province: "Santa Cruz", city: "Río Gallegos", postalCode: "9400" },
  { province: "Tierra del Fuego", city: "Ushuaia", postalCode: "9410" },
];

// Buenos Aires y CABA aparecen más seguido para generar hallazgos de mercado.
const provinceWeights = [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const soldStatuses = new Set(["paid", "preparing", "shipped", "delivered"]);

function buildDataset(expenseCategoryIds) {
  const now = new Date().toISOString();
  const categories = categoryDefs.map((category, index) => ({
    ...category,
    id: demoId("category", index),
    is_demo: true,
  }));

  const variants = [];
  const products = productDefs.map((product, productIndex) => {
    const productId = demoId("product", productIndex);
    product.variants.forEach((variant, variantIndex) => {
      variants.push({
        ...variant,
        id: demoId("variant", variants.length),
        productId,
        sku: `DEMO-${String(productIndex + 1).padStart(3, "0")}-${variantIndex + 1}`,
        productName: product.name,
        basePriceCents: product.basePriceCents,
        costCents: product.costCents,
      });
    });

    return { ...product, id: productId, categoryId: categories[product.category].id };
  });

  const images = products.map((product, index) => ({
    id: demoId("image", index),
    productId: product.id,
    url: `https://placehold.co/600x600/F1E9DE/2B2A28/png?text=${encodeURIComponent(product.name)}`,
    publicId: `demo/product-${index + 1}`,
    position: 0,
  }));

  const users = customerDefs.map((customer, index) => ({
    id: demoId("user", index),
    name: `Cliente Demo ${String(index + 1).padStart(2, "0")}`,
    email: `demo.cliente${String(index + 1).padStart(2, "0")}@example.com`,
    phone: `+54911${String(50000000 + index)}`,
    ...customer,
  }));

  const addresses = users.map((user, index) => ({
    id: demoId("address", index),
    userId: user.id,
    recipientName: user.name,
    phone: user.phone,
    street: `Calle Demo ${index + 1}`,
    number: String(100 + index),
    city: user.city,
    province: user.province,
    postalCode: user.postalCode,
  }));

  const orders = [];
  const orderItems = [];
  const statusHistory = [];
  const paymentEvents = [];

  for (let orderIndex = 0; orderIndex < 180; orderIndex += 1) {
    const orderId = demoId("order", orderIndex);
    const createdAt = localDate(randomInt(0, 89), randomInt(8, 20), randomInt(0, 59));
    const statusRoll = random();
    const status =
      statusRoll < 0.08
        ? "pending_payment"
        : statusRoll < 0.15
          ? "cancelled"
          : statusRoll < 0.37
            ? "delivered"
            : statusRoll < 0.55
              ? "shipped"
              : statusRoll < 0.72
                ? "preparing"
                : "paid";
    const shippingMethod = random() < 0.75 ? "delivery" : "pickup";
    const user = users[randomInt(0, provinceWeights.length - 1)];
    const address = addresses[users.indexOf(user)];
    const itemCount = randomInt(1, 3);
    const selectedVariants = [];
    while (selectedVariants.length < itemCount) {
      const candidate = variants[randomInt(0, variants.length - 1)];
      if (!selectedVariants.includes(candidate)) selectedVariants.push(candidate);
    }

    let subtotalCents = 0;
    let costCents = 0;
    selectedVariants.forEach((variant, itemIndex) => {
      const quantity = randomInt(1, 3);
      const unitPriceCents = variant.priceCents ?? variant.basePriceCents;
      const unitCostCents = variant.costCents ?? 0;
      subtotalCents += unitPriceCents * quantity;
      costCents += unitCostCents * quantity;
      orderItems.push({
        id: demoId(`order_item_${orderIndex}`, itemIndex),
        orderId,
        variantId: variant.id,
        productName: variant.productName,
        variantLabel: variant.label,
        unitPriceCents,
        unitCostCents,
        quantity,
      });
    });

    const shippingCostCents = shippingMethod === "delivery" && subtotalCents < 25000 ? 1200 : 0;
    const paidAt = soldStatuses.has(status)
      ? new Date(new Date(createdAt).getTime() + randomInt(2, 240) * 60_000).toISOString()
      : null;
    const cancelledAt = status === "cancelled" ? localDate(Math.max(0, randomInt(0, 60)), 12) : null;
    const mpPaymentId = status === "pending_payment" ? null : String(1_000_000 + orderIndex);
    const externalId = `demo_mp_${orderIndex + 1}`;

    orders.push({
      id: orderId,
      userId: user.id,
      status,
      subtotalCents,
      shippingCostCents,
      totalCents: subtotalCents + shippingCostCents,
      shippingMethod,
      shippingAddress: {
        recipient_name: address.recipientName,
        phone: address.phone,
        street: address.street,
        number: address.number,
        floor_apt: null,
        city: address.city,
        province: address.province,
        postal_code: address.postalCode,
        notes: null,
      },
      paymentMethod:
        status === "pending_payment"
          ? null
          : pick(["credit_card", "debit_card", "account_money"]),
      mpPreferenceId: null,
      mpPaymentId,
      mpStatus:
        status === "pending_payment" ? "pending" : status === "cancelled" ? "cancelled" : "approved",
      paidAt,
      cancelledAt,
      createdAt,
      costCents,
    });

    statusHistory.push({
      id: demoId(`status_${orderIndex}`, 0),
      orderId,
      fromStatus: null,
      toStatus: "pending_payment",
      createdAt,
    });
    if (status !== "pending_payment") {
      statusHistory.push({
        id: demoId(`status_${orderIndex}`, 1),
        orderId,
        fromStatus: "pending_payment",
        toStatus: status,
        createdAt: paidAt ?? cancelledAt ?? createdAt,
      });
    }

    if (status !== "pending_payment") {
      paymentEvents.push({
        id: demoId(`payment_event_${orderIndex}`, 0),
        externalId,
        action: "payment.updated",
        payload: { id: mpPaymentId, status: status === "cancelled" ? "cancelled" : "approved" },
        receivedAt: createdAt,
        processedAt: paidAt ?? cancelledAt ?? createdAt,
      });
    }
  }

  const stockMovements = variants.map((variant, index) => ({
    id: demoId("stock_movement", index),
    variantId: variant.id,
    delta: variant.stock,
    reason: "restock",
    note: "Stock inicial demo",
    createdAt: localDate(95, 9),
  }));

  const productViews = [];
  let viewIndex = 0;
  products.forEach((product, productIndex) => {
    const viewCount = randomInt(4, 9);
    for (let index = 0; index < viewCount; index += 1) {
      productViews.push({
        id: demoId("product_view", viewIndex),
        productId: product.id,
        userId: index % 4 === 0 ? users[(productIndex + index) % users.length].id : null,
        sessionToken: `demo_view_session_${productIndex}_${index}`,
        createdAt: localDate(randomInt(0, 29), randomInt(8, 22), randomInt(0, 59)),
      });
      viewIndex += 1;
    }
  });

  const expenseDescriptions = [
    "Compra de mercadería mayorista",
    "Envío de pedidos",
    "Publicidad en redes sociales",
    "Servicio de diseño",
    "Impuesto municipal",
    "Papelería y suministros",
    "Mantenimiento del local",
    "Campaña de mailing",
  ];
  const expenses = Array.from({ length: 32 }, (_, index) => ({
    id: demoId("expense", index),
    categoryId: expenseCategoryIds[index % expenseCategoryIds.length],
    description: expenseDescriptions[index % expenseDescriptions.length],
    amountCents: randomInt(3500, 95000),
    expenseDate: localDate(randomInt(0, 89), 12).slice(0, 10),
    notes: null,
  }));

  return {
    now,
    categories,
    products,
    variants,
    images,
    users,
    addresses,
    orders,
    orderItems,
    statusHistory,
    paymentEvents,
    stockMovements,
    productViews,
    expenses,
  };
}

async function main() {
  // DRY_RUN=1 valida la generación de datos sin conectarse a la base.
  const dryRun = process.env.DRY_RUN === "1";
  const sql = dryRun ? null : getSql();
  if (!dryRun) await cleanDemo(sql);

  const categoryRows = dryRun
    ? INITIAL_EXPENSE_CATEGORIES.map((category, index) => ({ id: demoId("expense_category", index) }))
    : await sql`SELECT id, name FROM expense_categories`;
  const expenseCategoryIds = categoryRows.map((row) => row.id);
  if (expenseCategoryIds.length === 0) {
    throw new Error("No hay categorías de egreso. Ejecutá npm run db:seed:demo (incluye seed-settings).");
  }

  const data = buildDataset(expenseCategoryIds);

  if (dryRun) {
    const sold = data.orders.filter((order) => soldStatuses.has(order.status)).length;
    const negativeStock = data.variants.filter((variant) => variant.stock < 0).length;
    const missingUsers = data.orders.filter((order) => !order.userId).length;
    console.log(
      `[dry-run] categorías=${data.categories.length} productos=${data.products.length} ` +
        `variantes=${data.variants.length} clientes=${data.users.length} pedidos=${data.orders.length} ` +
        `vendidos=${sold} ítems=${data.orderItems.length} egresos=${data.expenses.length} ` +
        `visitas=${data.productViews.length} stock_negativo=${negativeStock} pedidos_sin_cliente=${missingUsers}`,
    );
    if (negativeStock > 0 || missingUsers > 0) throw new Error("Dataset demo inconsistente.");
    return;
  }

  const { now } = data;
  const builders = [];

  data.categories.forEach((category) =>
    builders.push((txn) => txn`
      INSERT INTO categories (id, name, slug, position, active, is_demo, created_at, updated_at)
      VALUES (${category.id}, ${category.name}, ${category.slug}, ${category.position}, true, true, ${now}::timestamptz, ${now}::timestamptz)
    `),
  );
  data.products.forEach((product) =>
    builders.push((txn) => txn`
      INSERT INTO products (id, name, slug, description, category_id, base_price_cents, cost_cents, active, is_demo, created_at, updated_at)
      VALUES (${product.id}, ${product.name}, ${product.slug}, ${product.description}, ${product.categoryId}, ${product.basePriceCents}, ${product.costCents}, true, true, ${now}::timestamptz, ${now}::timestamptz)
    `),
  );
  data.variants.forEach((variant) =>
    builders.push((txn) => txn`
      INSERT INTO product_variants (id, product_id, sku, label, attributes, price_cents, cost_cents, stock, low_stock_threshold, active, created_at, updated_at)
      VALUES (${variant.id}, ${variant.productId}, ${variant.sku}, ${variant.label}, ${JSON.stringify(variant.attributes)}::jsonb, ${variant.priceCents ?? null}, ${variant.costCents}, ${variant.stock}, 3, true, ${now}::timestamptz, ${now}::timestamptz)
    `),
  );
  data.images.forEach((image) =>
    builders.push((txn) => txn`
      INSERT INTO product_images (id, product_id, url, public_id, position)
      VALUES (${image.id}, ${image.productId}, ${image.url}, ${image.publicId}, ${image.position})
    `),
  );
  data.users.forEach((user) =>
    builders.push((txn) => txn`
      INSERT INTO users (id, name, email, email_verified, role, phone, is_demo, created_at, updated_at)
      VALUES (${user.id}, ${user.name}, ${user.email}, ${now}::timestamptz, 'customer', ${user.phone}, true, ${now}::timestamptz, ${now}::timestamptz)
    `),
  );
  data.addresses.forEach((address) =>
    builders.push((txn) => txn`
      INSERT INTO addresses (id, user_id, recipient_name, phone, street, number, floor_apt, city, province, postal_code, notes, is_default, created_at, updated_at)
      VALUES (${address.id}, ${address.userId}, ${address.recipientName}, ${address.phone}, ${address.street}, ${address.number}, null, ${address.city}, ${address.province}, ${address.postalCode}, null, true, ${now}::timestamptz, ${now}::timestamptz)
    `),
  );
  await runBatches(sql, builders);

  const orderBuilders = [];
  data.orders.forEach((order) =>
    orderBuilders.push((txn) => txn`
      INSERT INTO orders (id, user_id, status, subtotal_cents, shipping_cost_cents, total_cents, shipping_method, shipping_address, payment_method, mp_payment_id, mp_status, paid_at, cancelled_at, commission_rate_bps, commission_cents, is_demo, created_at, updated_at)
      VALUES (${order.id}, ${order.userId}, ${order.status}, ${order.subtotalCents}, ${order.shippingCostCents}, ${order.totalCents}, ${order.shippingMethod}, ${JSON.stringify(order.shippingAddress)}::jsonb, ${order.paymentMethod}, ${order.mpPaymentId}, ${order.mpStatus}, ${order.paidAt}::timestamptz, ${order.cancelledAt}::timestamptz, null, null, true, ${order.createdAt}::timestamptz, ${order.createdAt}::timestamptz)
    `),
  );
  data.orderItems.forEach((item) =>
    orderBuilders.push((txn) => txn`
      INSERT INTO order_items (id, order_id, variant_id, product_name, variant_label, unit_price_cents, unit_cost_cents, quantity)
      VALUES (${item.id}, ${item.orderId}, ${item.variantId}, ${item.productName}, ${item.variantLabel}, ${item.unitPriceCents}, ${item.unitCostCents}, ${item.quantity})
    `),
  );
  data.statusHistory.forEach((entry) =>
    orderBuilders.push((txn) => txn`
      INSERT INTO order_status_history (id, order_id, from_status, to_status, changed_by, created_at)
      VALUES (${entry.id}, ${entry.orderId}, ${entry.fromStatus}, ${entry.toStatus}, null, ${entry.createdAt}::timestamptz)
    `),
  );
  await runBatches(sql, orderBuilders);

  const remainingBuilders = [];
  data.paymentEvents.forEach((event) =>
    remainingBuilders.push((txn) => txn`
      INSERT INTO payment_events (id, provider, external_id, action, payload, received_at, processed_at)
      VALUES (${event.id}, 'mercadopago', ${event.externalId}, ${event.action}, ${JSON.stringify(event.payload)}::jsonb, ${event.receivedAt}::timestamptz, ${event.processedAt}::timestamptz)
    `),
  );
  data.stockMovements.forEach((movement) =>
    remainingBuilders.push((txn) => txn`
      INSERT INTO stock_movements (id, variant_id, delta, reason, order_id, note, created_by, created_at)
      VALUES (${movement.id}, ${movement.variantId}, ${movement.delta}, ${movement.reason}, null, ${movement.note}, null, ${movement.createdAt}::timestamptz)
    `),
  );
  data.productViews.forEach((view) =>
    remainingBuilders.push((txn) => txn`
      INSERT INTO product_views (id, product_id, user_id, session_token, created_at)
      VALUES (${view.id}, ${view.productId}, ${view.userId}, ${view.sessionToken}, ${view.createdAt}::timestamptz)
    `),
  );
  data.expenses.forEach((expense) =>
    remainingBuilders.push((txn) => txn`
      INSERT INTO expenses (id, category_id, description, amount_cents, expense_date, notes, created_by, is_demo, created_at, updated_at)
      VALUES (${expense.id}, ${expense.categoryId}, ${expense.description}, ${expense.amountCents}, ${expense.expenseDate}::date, null, null, true, ${now}::timestamptz, ${now}::timestamptz)
    `),
  );
  await runBatches(sql, remainingBuilders);

  console.log(
    `Datos demo cargados: ${data.categories.length} categorías, ${data.products.length} productos, ` +
      `${data.variants.length} variantes, ${data.users.length} clientes, ${data.orders.length} pedidos, ` +
      `${data.orderItems.length} ítems, ${data.expenses.length} egresos, ${data.productViews.length} visitas.`,
  );
}

main().catch((error) => {
  console.error(`No se pudo cargar los datos demo: ${error.message}`);
  process.exitCode = 1;
});
