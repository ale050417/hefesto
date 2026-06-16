import sharp from "sharp";
import { getSupabaseAdmin } from "@/core/supabase/admin";

/** Redimensiona (máx `maxSize` px), reorienta y convierte a WebP. */
export async function optimizeImage(
  input: Buffer,
  maxSize = 1600,
  quality = 80,
): Promise<Buffer> {
  return sharp(input)
    .rotate() // respeta la orientación EXIF
    .resize({
      width: maxSize,
      height: maxSize,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality })
    .toBuffer();
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
