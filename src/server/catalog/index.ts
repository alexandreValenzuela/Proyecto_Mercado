import {
  getProductBySlug,
  getStoreSettings,
  listCategories,
  listProducts,
  type CatalogProduct,
} from "@/db/queries/catalog";
import type { CatalogResolvedQuery } from "@/lib/validators/catalog";

export const CATALOG_PAGE_SIZE = 12;

export async function getCatalogPage(query: CatalogResolvedQuery) {
  return listProducts({
    q: query.q || undefined,
    categorySlug: query.category || undefined,
    minPriceCents: query.min,
    maxPriceCents: query.max,
    sort: query.sort,
    page: query.page,
    pageSize: CATALOG_PAGE_SIZE,
  });
}

export async function getFeaturedProducts(limit = 4): Promise<CatalogProduct[]> {
  const { items } = await listProducts({ sort: "best-selling", page: 1, pageSize: limit });
  return items;
}

export async function getVisibleCategories() {
  return listCategories();
}

export async function getStorefrontSettings() {
  return getStoreSettings();
}

export async function getProductDetail(slug: string) {
  return getProductBySlug(slug);
}
