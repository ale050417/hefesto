import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { logoToPng, logoToPngWithoutSharp } from "./logo-png";

// Logo real del taller reducido a 64×64 (WebP con transparencia).
const webp = readFileSync(path.join(__dirname, "__fixtures__", "logo.webp"));
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

describe("logoToPngWithoutSharp (camino de Vercel, sin binarios nativos)", () => {
  it("convierte el WebP del logo a un PNG con su tamaño", async () => {
    const png = await logoToPngWithoutSharp(webp);
    expect(png).not.toBeNull();
    expect(png!.format).toBe("png");
    expect([png!.width, png!.height]).toEqual([64, 64]);
    expect([...png!.data.subarray(0, 4)]).toEqual(PNG_MAGIC);
  });

  it("un PNG pasa tal cual, solo le lee el tamaño", async () => {
    const first = await logoToPngWithoutSharp(webp);
    const again = await logoToPngWithoutSharp(first!.data);
    expect(again!.data).toBe(first!.data);
    expect([again!.width, again!.height]).toEqual([64, 64]);
  });

  it("otro formato da null (va la marca dibujada)", async () => {
    expect(await logoToPngWithoutSharp(Buffer.from("GIF89a hola"))).toBeNull();
  });
});

describe("logoToPng", () => {
  it("devuelve un PNG por el camino que haya disponible", async () => {
    const png = await logoToPng(webp);
    expect(png?.format).toBe("png");
    expect([png!.width, png!.height]).toEqual([64, 64]);
  });

  it("bytes rotos no tiran el PDF: null", async () => {
    expect(await logoToPng(Buffer.from("RIFF....WEBPbasura"))).toBeNull();
  });
});
