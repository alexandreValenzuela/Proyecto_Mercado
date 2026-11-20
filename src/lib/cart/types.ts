import type { StockState } from "@/lib/catalog/stock";

export type CartActionResult = {
  ok: boolean;
  status: "success" | "warning" | "error";
  message: string | null;
  itemCount: number;
  fieldErrors: Partial<Record<string, string>>;
};

export type CartSummaryItem = {
  id: string;
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantLabel: string;
  sku: string;
  imageUrl: string | null;
  unitPriceCents: number;
  addedPriceCents: number | null;
  quantity: number;
  lineTotalCents: number;
  stock: number;
  stockState: StockState;
  stockWarning: string | null;
  priceWarning: string | null;
  available: boolean;
};

export type CartSummary = {
  items: CartSummaryItem[];
  itemCount: number;
  subtotalCents: number;
  warnings: string[];
};

export const emptyCartSummary: CartSummary = {
  items: [],
  itemCount: 0,
  subtotalCents: 0,
  warnings: [],
};
