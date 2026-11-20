import { createHash } from "node:crypto";

export const CLOUDINARY_FOLDER = "gao-store/products";

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

/**
 * Las variables se validan en el punto de uso, nunca al importar: con las
 * credenciales vacías el build y el resto del sitio deben seguir funcionando.
 */
export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Faltan las credenciales de Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET). Configuralas en .env.local para poder subir imágenes.",
    );
  }

  return { cloudName, apiKey, apiSecret };
}

/** Firma SHA-1 de una subida directa: parámetros ordenados + API secret. */
export function createCloudinaryUploadSignature(input: {
  timestamp: number;
  folder: string;
  apiSecret: string;
}): string {
  const toSign = `folder=${input.folder}&timestamp=${input.timestamp}${input.apiSecret}`;
  return createHash("sha1").update(toSign).digest("hex");
}

/** Evita guardar una URL de otro proveedor como si fuera una imagen subida. */
export function isCloudinaryImageUrl(url: string, cloudName: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "res.cloudinary.com" &&
      parsed.pathname.startsWith(`/${cloudName}/image/upload/`)
    );
  } catch {
    return false;
  }
}
