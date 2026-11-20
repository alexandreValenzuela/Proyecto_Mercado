import { siteConfig } from "@/config/site";

const currencyFormatter = new Intl.NumberFormat(siteConfig.locale, {
  style: "currency",
  currency: siteConfig.currency,
});

/** Formatea centavos como pesos argentinos (ej.: 1250000 -> $ 12.500,00). */
export function formatMoney(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

/** Convierte un importe escrito en pesos a centavos. Devuelve null si no es válido. */
export function parsePriceToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [pesos, decimal = ""] = normalized.split(".");
  return Number(pesos) * 100 + Number(decimal.padEnd(2, "0"));
}

/** Importe en pesos listo para un input numérico (acepta un valor en centavos). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) {
    return "";
  }
  return (cents / 100).toFixed(2);
}
