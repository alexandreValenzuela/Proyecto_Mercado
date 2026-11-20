import { CredentialsSignin } from "next-auth";

/** Código opaco que el action de login traduce a un mensaje en español. */
export class LoginRateLimitError extends CredentialsSignin {
  code = "rate_limit";
}

type Attempt = { count: number; resetAt: number };

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP_AND_EMAIL = 8;
const MAX_PER_IP = 40;

const attemptsByPair = new Map<string, Attempt>();
const attemptsByIp = new Map<string, Attempt>();

/** Extrae la IP detrás de Railway/ngrok; en desarrollo puede no estar presente. */
export function getRequestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function recordAttempt(store: Map<string, Attempt>, key: string, max: number, now: number) {
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  current.count += 1;
  if (current.count > max) {
    throw new LoginRateLimitError();
  }
}

function pruneExpired(store: Map<string, Attempt>, now: number) {
  if (store.size < 1000) {
    return;
  }

  for (const [key, value] of store) {
    if (value.resetAt <= now) {
      store.delete(key);
    }
  }
}

/**
 * Limitador simple para el provider de Credentials, por IP + email y por IP.
 * En memoria y por proceso: varias instancias o workers no comparten contadores.
 * Para un despliegue multi-instancia habría que moverlo a Redis o a la BD.
 */
export function assertLoginAttemptAllowed(ip: string, email: string): void {
  const now = Date.now();
  const normalizedEmail = email.trim().toLowerCase();

  recordAttempt(attemptsByIp, ip, MAX_PER_IP, now);
  recordAttempt(attemptsByPair, `${ip}|${normalizedEmail}`, MAX_PER_IP_AND_EMAIL, now);

  pruneExpired(attemptsByIp, now);
  pruneExpired(attemptsByPair, now);
}

/** Solo se limpia la clave compuesta: un login correcto no borra el contador global de la IP. */
export function clearLoginAttempts(ip: string, email: string): void {
  attemptsByPair.delete(`${ip}|${email.trim().toLowerCase()}`);
}
