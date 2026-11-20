export type StockState = "out" | "low" | "available";

export function getStockState(stock: number, threshold = 3): StockState {
  if (stock <= 0) {
    return "out";
  }
  return stock <= threshold ? "low" : "available";
}

export const stockLabels: Record<StockState, string> = {
  out: "Sin stock",
  low: "Pocas unidades",
  available: "Disponible",
};
