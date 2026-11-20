import { and, asc, desc, eq, gte, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  categories,
  productImages,
  productVariants,
  productViews,
  products,
  stockMovements,
  storeSettings,
  users,
} from "@/db/schema";
import type { AdminProductQuery, CatalogQuery } from "@/lib/validators/catalog";

export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  basePriceCents: number;
  costCents: number | null;
  effectivePriceCents: number;
  stockTotal: number;
  salesCount: number;
  imageUrl: string | null;
  active: boolean;
  createdAt: Date;
  total: number;
};

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  position: number;
  active: boolean;
  productCount: number;
};

type ListOptions = {
  q?: string;
  categorySlug?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: CatalogQuery["sort"];
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
  activeFilter?: AdminProductQuery["active"];
};

const effectivePrice = sql<number>`coalesce((
  select min(coalesce(${productVariants.priceCents}, ${products.basePriceCents}))
  from ${productVariants}
  where ${productVariants.productId} = ${products.id} and ${productVariants.active} = true
), ${products.basePriceCents})`.mapWith(Number);

const stockTotal = sql<number>`coalesce((
  select sum(${productVariants.stock})
  from ${productVariants}
  where ${productVariants.productId} = ${products.id} and ${productVariants.active} = true
), 0)`.mapWith(Number);

const salesCount = sql<number>`(
  select count(*)
  from "order_items" oi
  inner join "product_variants" sv on sv.id = oi.variant_id
  inner join "orders" o on o.id = oi.order_id
  where sv.product_id = ${products.id}
    and o.status in ('paid', 'preparing', 'shipped', 'delivered')
)`.mapWith(Number);

const firstImageUrl = sql<string | null>`(
  select pi.url
  from ${productImages} pi
  where pi.product_id = ${products.id}
  order by pi.position asc
  limit 1
)`;

function buildConditions(options: ListOptions): SQL[] {
  const conditions: SQL[] = [];

  if (!options.includeInactive) {
    conditions.push(eq(products.active, true));
  }

  if (options.activeFilter === "active") {
    conditions.push(eq(products.active, true));
  } else if (options.activeFilter === "inactive") {
    conditions.push(eq(products.active, false));
  }

  if (options.q) {
    const term = `%${options.q}%`;
    conditions.push(or(ilike(products.name, term), ilike(products.description, term))!);
  }

  if (options.categorySlug) {
    conditions.push(eq(categories.slug, options.categorySlug));
  }

  if (options.minPriceCents != null) {
    conditions.push(sql`${effectivePrice} >= ${options.minPriceCents}`);
  }

  if (options.maxPriceCents != null) {
    conditions.push(sql`${effectivePrice} <= ${options.maxPriceCents}`);
  }

  return conditions;
}

function orderFor(sort: CatalogQuery["sort"]): SQL[] {
  switch (sort) {
    case "price-asc":
      return [asc(effectivePrice), asc(products.name)];
    case "price-desc":
      return [desc(effectivePrice), asc(products.name)];
    case "newest":
      return [desc(products.createdAt), desc(products.name)];
    case "best-selling":
      return [desc(salesCount), desc(products.createdAt)];
    default:
      return [desc(salesCount), desc(products.createdAt), asc(products.name)];
  }
}

/** Catálogo público y listado admin comparten la misma consulta parametrizada. */
export async function listProducts(
  options: ListOptions = {},
): Promise<{ items: CatalogProduct[]; total: number }> {
  const db = getDb();
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, options.pageSize ?? 12));
  const conditions = buildConditions(options);

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      description: products.description,
      categoryId: products.categoryId,
      categoryName: categories.name,
      categorySlug: categories.slug,
      basePriceCents: products.basePriceCents,
      costCents: products.costCents,
      effectivePriceCents: effectivePrice,
      stockTotal,
      salesCount,
      imageUrl: firstImageUrl,
      active: products.active,
      createdAt: products.createdAt,
      total: sql<number>`count(*) over()`.mapWith(Number),
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(...orderFor(options.sort ?? "relevance"))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { items: rows, total: rows[0]?.total ?? 0 };
}

export async function listCategories(options: { includeInactive?: boolean } = {}) {
  const db = getDb();
  const conditions = options.includeInactive ? undefined : eq(categories.active, true);
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      parentId: categories.parentId,
      position: categories.position,
      active: categories.active,
      productCount: sql<number>`(
        select count(*) from ${products} p where p.category_id = ${categories.id}
      )`.mapWith(Number),
    })
    .from(categories)
    .where(conditions)
    .orderBy(asc(categories.position), asc(categories.name));

  return rows satisfies CatalogCategory[];
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>;

export async function getProductBySlug(slug: string) {
  const db = getDb();
  return db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.active, true)),
    with: {
      category: true,
      images: { orderBy: (image, { asc }) => asc(image.position) },
      variants: {
        where: eq(productVariants.active, true),
        orderBy: (variant, { asc }) => asc(variant.label),
      },
    },
  });
}

export async function getAdminProductById(id: string) {
  const db = getDb();
  return db.query.products.findFirst({
    where: eq(products.id, id),
    with: {
      category: true,
      images: { orderBy: (image, { asc }) => asc(image.position) },
      variants: { orderBy: (variant, { asc }) => asc(variant.sku) },
    },
  });
}

export async function getStoreSettings() {
  const db = getDb();
  const rows = await db.select().from(storeSettings).limit(1);
  return rows[0] ?? null;
}

export async function getVariantStockHistory(variantId: string, limit = 20) {
  const db = getDb();
  return db
    .select({
      id: stockMovements.id,
      delta: stockMovements.delta,
      reason: stockMovements.reason,
      note: stockMovements.note,
      createdAt: stockMovements.createdAt,
      createdByName: users.name,
    })
    .from(stockMovements)
    .leftJoin(users, eq(stockMovements.createdBy, users.id))
    .where(eq(stockMovements.variantId, variantId))
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);
}

export async function hasRecentProductView(input: {
  productId: string;
  sessionToken: string;
  since: Date;
}) {
  const db = getDb();
  const rows = await db
    .select({ id: productViews.id })
    .from(productViews)
    .where(
      and(
        eq(productViews.productId, input.productId),
        eq(productViews.sessionToken, input.sessionToken),
        gte(productViews.createdAt, input.since),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function insertProductView(input: {
  productId: string;
  sessionToken: string;
  userId: string | null;
}) {
  const db = getDb();
  await db.insert(productViews).values(input);
}

export async function productExists(productId: string) {
  const db = getDb();
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.active, true)))
    .limit(1);
  return rows.length > 0;
}

export async function categoryExists(categoryId: string) {
  const db = getDb();
  const rows = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).limit(1);
  return rows.length > 0;
}

export async function slugInUse(table: "products" | "categories", slug: string, excludeId?: string) {
  const db = getDb();
  const target = table === "products" ? products : categories;
  const conditions = [eq(target.slug, slug)];
  if (excludeId) {
    conditions.push(ne(target.id, excludeId));
  }
  const rows = await db.select({ id: target.id }).from(target).where(and(...conditions)).limit(1);
  return rows.length > 0;
}
