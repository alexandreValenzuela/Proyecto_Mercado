import { siteConfig } from "@/config/site";

const dateFormatter = new Intl.DateTimeFormat(siteConfig.locale, {
  timeZone: siteConfig.timeZone,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat(siteConfig.locale, {
  timeZone: siteConfig.timeZone,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Fecha en zona Argentina con el formato regional de `siteConfig`. */
export function formatDate(value: Date | string): string {
  return dateFormatter.format(value instanceof Date ? value : new Date(value));
}

export function formatDateTime(value: Date | string): string {
  return dateTimeFormatter.format(value instanceof Date ? value : new Date(value));
}
