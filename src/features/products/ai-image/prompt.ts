/**
 * Prompt para la foto de producto con IA (pedido de Ale, 2026-10-21).
 *
 * El empleado saca una foto de la pieza con el celular y la IA devuelve una
 * foto de catálogo: la MISMA pieza, en una escena acorde a lo que es (un vaso
 * en la barra de un bar, un Pokémon en un ambiente de ese mundo, una maceta
 * entre plantas), con el estilo de las fotos que ya tiene la tienda: fondo
 * oscuro con clima, luz de estudio, la pieza protagonista.
 *
 * Puro (sin red): la escena se elige acá por palabras clave del nombre, la
 * categoría y la descripción, y el que carga puede pisarla con una pista
 * ("en una barra de bar"). El prompt va en inglés porque el modelo de imagen
 * (FLUX.2 klein) lo sigue mucho mejor que en castellano.
 */

export type ProductImageContext = {
  name: string;
  category?: string | null;
  /**
   * Colores en que se vende. NO van al prompt: probado el 2026-10-21, el
   * modelo recoloreaba la pieza con ellos. La foto ya muestra el color real
   * y el prompt pide respetarlo. Se aceptan para no romper a quien los manda.
   */
  colors?: string[] | null;
  description?: string | null;
  /** Pista del que carga ("en una barra de bar"); pisa la escena automática. */
  scene?: string | null;
};

const DEFAULT_SCENE =
  "standing on a dark wooden table against a dark studio background";

/** Escenas por palabras clave. Se evalúan en orden: la primera que matchea gana. */
const SCENES: Array<{ match: RegExp; scene: string }> = [
  {
    match:
      /\b(vaso|vasos|taza|tazas|jarra|jarras|copa|copas|mate|mates|botella|botellas|shot|cerveza|vino|bar|posavasos|coctel|cocktail|whisky)\b/,
    scene:
      "on a wooden bar counter, with blurred bottles and warm lights in the background",
  },
  {
    match:
      /\b(maceta|macetas|planta|plantas|cactus|suculenta|suculentas|jardin|florero)\b/,
    scene:
      "on a bright wooden shelf next to green plants, with soft natural daylight",
  },
  {
    match:
      /\b(llavero|llaveros|pin|pins|iman|imanes|broche|broches|colgante|colgantes)\b/,
    scene: "close-up on a dark desk next to keys and a notebook",
  },
  {
    match: /\b(lampara|lamparas|velador|veladores|luz|luces|led)\b/,
    scene: "on a bedside table at night, glowing softly in a dim cozy room",
  },
  {
    match:
      /\b(halloween|calavera|calaveras|craneo|craneos|terror|zombie|zombies|fantasma|fantasmas|bruja|brujas|calabaza|calabazas)\b/,
    scene:
      "on a dark table with candles and mist, with a spooky orange glow in the background",
  },
  {
    match:
      /\b(trofeo|trofeos|medalla|medallas|premio|premios|premiacion|premiaciones|placa|placas)\b/,
    scene:
      "on a podium under a single spotlight, dark background, celebratory mood",
  },
  {
    match:
      /\b(soporte|soportes|celular|celulares|auricular|auriculares|tablet|teclado|mouse|pc|notebook|tecnologia|cable|cables|control|joystick|gamer|consola|organizador de cables)\b/,
    scene:
      "on a modern desk with a laptop and blurred RGB lights in the background",
  },
  {
    match:
      /\b(navidad|navideno|navidena|arbol de navidad|reno|renos|santa|papa noel|muneco de nieve)\b/,
    scene:
      "on a table with warm Christmas lights and pine branches blurred in the background",
  },
  {
    match:
      /\b(mundial|futbol|pelota|pelotas|camiseta|camisetas|cancha|estadio|messi|boca|river|seleccion)\b/,
    scene:
      "on a table with a football and blurred stadium lights in the background",
  },
  {
    match:
      /\b(juego|juegos|dados|dado|ajedrez|cartas|tablero|tableros|fichas|ficha|rol|miniaturas de juego)\b/,
    scene:
      "on a game table with dice and cards blurred in the background, warm light",
  },
  {
    match:
      /\b(pokemon|figura|figuras|personaje|personajes|anime|juguete|juguetes|miniatura|miniaturas|dragon|dragones|dinosaurio|dinosaurios|estatua|estatuas|busto|bustos|robot|robots|superheroe|superheroes|banda|bandas|musico|musicos)\b/,
    scene:
      "standing on a dark wooden table with soft colored ambient light that matches the character's world",
  },
  {
    match:
      /\b(decoracion|adorno|adornos|jarron|jarrones|organizador|organizadores|caja|cajas|bandeja|bandejas|portavelas|cuadro|cuadros|monumento|monumentos|arquitectura)\b/,
    scene:
      "on a living-room shelf with tasteful decor blurred in the background",
  },
];

/** Minúsculas y sin acentos, para que "Lámpara" y "lampara" matcheen igual. */
export function normalizeForMatch(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Escena automática según el contexto de la pieza (sin la pista del usuario). */
export function pickScene(ctx: ProductImageContext): string {
  const haystack = normalizeForMatch(
    [ctx.name, ctx.category ?? "", ctx.description ?? ""].join(" "),
  );
  for (const { match, scene } of SCENES) {
    if (match.test(haystack)) return scene;
  }
  return DEFAULT_SCENE;
}

/** Limpia la pista del usuario: una línea, sin comillas raras, tope de largo. */
export function cleanSceneHint(hint: string | null | undefined): string | null {
  const t = (hint ?? "")
    .replace(/\s+/g, " ")
    .replace(/["\n\r]/g, "")
    .trim();
  return t ? t.slice(0, 200) : null;
}

/** El prompt completo que se manda al modelo de imagen. */
export function buildProductImagePrompt(ctx: ProductImageContext): string {
  const name = ctx.name.replace(/\s+/g, " ").trim().slice(0, 120);
  const hint = cleanSceneHint(ctx.scene);
  const scene = hint ?? pickScene(ctx);
  const product = [
    `product: "${name}"`,
    ctx.category ? `category: ${ctx.category.trim()}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  return [
    `Professional square product photograph of the 3D-printed object shown in image 0 (${product}).`,
    "Keep the exact same object: same shape, proportions, details and the exact colors seen in the photo. Do not redesign or recolor it.",
    "Do not add text, logos, watermarks, people or hands.",
    "Premium catalog style: dramatic studio lighting, shallow depth of field, dark moody background, photorealistic, the object centered as the hero filling about 70% of the frame.",
    `Scene: ${scene}.`,
  ].join(" ");
}
