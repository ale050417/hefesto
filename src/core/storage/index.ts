import { getSupabaseAdmin } from "@/core/supabase/admin";

/** ¿El buffer ya es un WebP? (RIFF....WEBP en la cabecera) */
function isWebp(buf: Buffer): boolean {
  return (
    buf.length > 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  );
}

/** Redimensiona (máx `maxSize` px), reorienta y convierte a WebP. */
export async function optimizeImage(
  input: Buffer,
  maxSize = 1600,
  quality = 80,
): Promise<Buffer> {
  // El cliente ya convierte y redimensiona a WebP antes de subir. Si el buffer
  // ya es WebP, no necesitamos sharp: lo subimos tal cual (evita cargar el
  // binario nativo y el error de libvips en runtimes sin él).
  if (isWebp(input)) return input;
  // Carga diferida: sharp (binario nativo) solo se necesita al optimizar
  // imágenes (admin). Así las páginas que no suben imágenes no lo cargan.
  // Si sharp no carga (p. ej. falta libvips en el runtime), no rompemos:
  // subimos los bytes tal cual.
  try {
    const { default: sharp } = await import("sharp");
    return await sharp(input)
      .rotate() // respeta la orientación EXIF
      .resize({
        width: maxSize,
        height: maxSize,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer();
  } catch (err) {
    console.warn(
      "[storage] sharp no disponible; subo la imagen sin re-optimizar:",
      err,
    );
    return input;
  }
}

/**
 * Tipo real de una imagen por su cabecera. Hace falta porque `optimizeImage`
 * devuelve los bytes TAL CUAL cuando no hay sharp (Vercel): una foto JPEG que
 * manda la app del celular se guardaba como ".webp" con tipo image/webp, y hay
 * visores que no la abren (2026-11-17).
 */
export function imageFileInfo(bytes: Buffer): {
  ext: "webp" | "jpg" | "png";
  contentType: string;
} {
  if (isWebp(bytes)) return { ext: "webp", contentType: "image/webp" };
  if (bytes.length > 4 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { ext: "png", contentType: "image/png" };
  }
  return { ext: "jpg", contentType: "image/jpeg" };
}

/**
 * Optimiza y sube una imagen con la extensión y el tipo que le corresponden.
 * `basePath` va SIN extensión. Devuelve la URL pública.
 */
export async function storeImage(
  bucket: string,
  basePath: string,
  input: Buffer,
  maxSize = 1600,
): Promise<{ url: string; path: string }> {
  const bytes = await optimizeImage(input, maxSize);
  const info = imageFileInfo(bytes);
  const path = `${basePath}.${info.ext}`;
  const url = await uploadObject(bucket, path, bytes, info.contentType);
  return { url, path };
}

/** Sube bytes a un bucket y devuelve la URL pública. */
export async function uploadObject(
  bucket: string,
  path: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Borra un objeto de un bucket. */
export async function deleteObject(
  bucket: string,
  path: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}
