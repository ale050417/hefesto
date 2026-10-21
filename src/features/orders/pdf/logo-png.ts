/**
 * Logo del taller como PNG para el PDF del comprobante (react-pdf solo
 * entiende PNG/JPG, y el logo se sube en WebP, ver optimizeImage).
 *
 * Dos caminos (2026-10-21, bug de Ale: en producción el PDF salía con la
 * marca dibujada en vez del logo):
 *  1. sharp: rápido y entiende cualquier formato, pero es un binario nativo
 *     que en Vercel NO carga (falta libvips; ya pasaba al subir fotos, ver
 *     core/storage). Localmente anda.
 *  2. Sin sharp: WebP decodificado con libwebp compilado a WebAssembly
 *     (@cwasm/webp) y PNG armado con pngjs. Puro JS/wasm, corre en cualquier
 *     runtime. Un PNG se usa tal cual.
 * Si los dos fallan (formato raro, bytes rotos), null: el PDF lleva la marca
 * dibujada, como cuando no hay logo.
 */

export type LogoPng = {
  data: Buffer;
  format: "png";
  width: number;
  height: number;
};

/** Lado máximo del PNG: sobra para 60pt impresos y mantiene chico el PDF. */
const MAX_SIDE = 400;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function isPng(buf: Buffer): boolean {
  return buf.length > 8 && buf.subarray(0, 4).equals(PNG_MAGIC);
}

function isWebp(buf: Buffer): boolean {
  return (
    buf.length > 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  );
}

async function withSharp(input: Buffer): Promise<LogoPng> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(input)
    .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { data, format: "png", width: info.width, height: info.height };
}

/** Camino sin binarios nativos (exportado para testearlo directo). */
export async function logoToPngWithoutSharp(
  input: Buffer,
): Promise<LogoPng | null> {
  const { PNG } = await import("pngjs");
  if (isPng(input)) {
    // Solo hace falta el tamaño; los bytes van tal cual.
    const png = PNG.sync.read(input);
    return { data: input, format: "png", width: png.width, height: png.height };
  }
  if (isWebp(input)) {
    const { decode } = await import("@cwasm/webp");
    const rgba = decode(input);
    const png = new PNG({ width: rgba.width, height: rgba.height });
    png.data = Buffer.from(
      rgba.data.buffer,
      rgba.data.byteOffset,
      rgba.data.byteLength,
    );
    return {
      data: PNG.sync.write(png),
      format: "png",
      width: rgba.width,
      height: rgba.height,
    };
  }
  return null;
}

/** PNG del logo, o null si no se pudo convertir (va la marca dibujada). */
export async function logoToPng(input: Buffer): Promise<LogoPng | null> {
  try {
    return await withSharp(input);
  } catch (error) {
    console.warn(
      "[comprobante] sharp no disponible para el logo; uso el decodificador wasm:",
      error instanceof Error ? error.message : error,
    );
  }
  try {
    return await logoToPngWithoutSharp(input);
  } catch (error) {
    console.error("[comprobante] no se pudo convertir el logo a PNG:", error);
    return null;
  }
}
