import { getSupabaseAdmin } from "@/core/supabase/admin";

/** Redimensiona (máx `maxSize` px), reorienta y convierte a WebP. */
export async function optimizeImage(
  input: Buffer,
  maxSize = 1600,
  quality = 80,
): Promise<Buffer> {
  // Carga diferida: sharp (binario nativo) solo se necesita al optimizar
  // imágenes (admin). Así las páginas que no suben imágenes no lo cargan.
  // Si sharp no carga (p. ej. falta libvips en el runtime), no rompemos: el
  // cliente ya manda la imagen convertida a WebP y redimensionada, así que
  // subimos esos bytes tal cual.
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
