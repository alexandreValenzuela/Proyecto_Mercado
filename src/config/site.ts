/** Fuente única de verdad de la marca y de las constantes regionales del proyecto. */
export const siteConfig = {
  name: "Nudo",
  locale: "es-AR",
  currency: "ARS",
  timeZone: "America/Argentina/Buenos_Aires",
  dateFormat: "dd/MM/yyyy",
} as const;

export const { name: siteName, locale, currency, timeZone, dateFormat } = siteConfig;
