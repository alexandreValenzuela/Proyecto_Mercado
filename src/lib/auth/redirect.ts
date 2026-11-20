const DEFAULT_REDIRECT = "/cuenta/pedidos";

/**
 * Acepta solo rutas relativas del mismo origen. Bloquea `//host`, rutas con
 * contrabarra y caracteres de control, que algunos navegadores normalizan.
 */
export function safeNextPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  if (/[\u0000-\u001F\u007F]/.test(value)) {
    return fallback;
  }

  try {
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost") {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
