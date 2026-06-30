// Comprime/convierte una imagen a WebP en el navegador antes de subirla.
// Reduce el peso (evita el límite de body de los Server Actions) y unifica el
// formato. Si algo falla, devuelve el archivo original (el server igual valida).

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    img.src = src;
  });
}

/**
 * Devuelve un File WebP redimensionado al lado máximo `maxSize` (px).
 * `quality` 0..1. No agranda imágenes más chicas que `maxSize`.
 */
export async function compressImageToWebp(
  file: File,
  maxSize = 1600,
  quality = 0.85,
): Promise<File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return file;
  }
  try {
    const img = await loadImage(await readAsDataURL(file));
    let { width, height } = img;
    if (width > maxSize || height > maxSize) {
      const r = Math.min(maxSize / width, maxSize / height);
      width = Math.round(width * r);
      height = Math.round(height * r);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/webp", quality),
    );
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "imagen";
    return new File([blob], `${name}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}
