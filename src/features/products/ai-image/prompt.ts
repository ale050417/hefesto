/**
 * Prompt para la foto de producto con IA (pedido de Ale, 2026-10-21; las
 * instrucciones base se reemplazaron el 2026-10-30 por el prompt que Ale
 * pidió textual).
 *
 * El empleado saca una foto de la pieza con el celular y la IA devuelve una
 * foto de catálogo: la MISMA pieza, en un escenario acorde a lo que es (un vaso
 * en la barra de un bar, un Pokémon en un ambiente de ese mundo, una maceta
 * entre plantas), con fondo premium y la pieza al 50–65 % del encuadre.
 *
 * Puro (sin red): el escenario se elige acá por palabras clave del nombre, la
 * categoría y la descripción, y el que carga puede pisarlo con una pista
 * ("en una barra de bar"). Las instrucciones base van en castellano, tal cual
 * las pidió Ale; las escenas siguen en inglés, como antes.
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

/**
 * Instrucciones base que pidió Ale (2026-10-30), tal cual: fidelidad absoluta
 * a la pieza, 1000 × 1000, producto al 50–65 % del encuadre y fondo premium.
 */
const BASE_INSTRUCTIONS = [
  "Utiliza la imagen proporcionada únicamente como referencia del producto. Genera una fotografía publicitaria hiperrealista y de calidad comercial del mismo producto, manteniendo exactamente el 100% del diseño original. No modifiques, rediseñes, reemplaces, corrijas, simplifiques, estilices, agregues ni elimines ningún detalle del producto.",
  "La imagen final debe tener un tamaño exacto de 1000 × 1000 píxeles (formato cuadrado). El producto no debe ocupar todo el encuadre; debe aparecer ligeramente más pequeño, centrado y con suficiente espacio libre alrededor (aire visual) para lograr una composición publicitaria elegante, equilibrada y profesional.",
  "Respeta de forma absoluta: forma y proporciones; dimensiones y grosor; colores originales; tipografía; bordes y contornos; relieves, grabados y cortes; texturas reales del material (líneas de impresión 3D); acabado superficial; microdetalles visibles; identidad visual completa del producto.",
  "El producto debe ser una réplica exacta del original. La única mejora permitida es la calidad fotográfica y la presentación visual.",
  "Convierte el producto en una fotografía comercial de nivel premium con: calidad hiperrealista; resolución equivalente a 8K; nivel de detalle extremo; nitidez profesional de estudio; materiales físicamente correctos (PBR); texturas completamente fotorrealistas de líneas de impresión 3D; bordes perfectamente definidos; excelente rango dinámico (HDR); reflejos naturales y controlados; sombras suaves y realistas; iluminación profesional de estudio mediante softboxes; balance de blancos perfecto; colores fieles al producto original; profundidad de campo cinematográfica sin perder detalles importantes; calidad comparable a una fotografía realizada con una cámara de formato medio y un objetivo macro profesional.",
  "Fondo y composición: genera un fondo profesional, elegante y completamente relacionado con el producto, como si hubiera sido realizado para una campaña publicitaria de una marca reconocida. El escenario debe complementar el producto sin robar protagonismo y puede incluir superficies, texturas, elementos decorativos o ambientaciones acordes a su uso o categoría, siempre con un estilo premium y comercial. El fondo debe ser coherente con el tipo de producto, moderno y minimalista, elegante y limpio, visualmente atractivo, con iluminación integrada de forma natural, sin objetos innecesarios que distraigan, con profundidad y sensación tridimensional, con colores que resalten el producto sin alterar sus tonos reales, y con apariencia de una sesión fotográfica profesional para publicidad. El escenario puede recrear un ambiente realista de alta calidad (por ejemplo, una mesa de madera premium, una superficie de mármol, un escritorio moderno, un ambiente infantil, un taller, una cocina, una oficina, una sala de estar, una vitrina o cualquier contexto relacionado con el producto), siempre que sea coherente con su finalidad y aporte valor visual.",
  "Encuadre: el producto debe ser el protagonista, pero no debe llenar el lienzo. Debe ocupar aproximadamente entre el 50% y el 65% del área visible de la imagen, dejando márgenes amplios y una composición limpia, equilibrada y apta para e-commerce y publicidad premium.",
  "Resultado esperado: la imagen final debe parecer una fotografía tomada por un fotógrafo profesional especializado en publicidad y e-commerce de lujo. El producto debe conservar exactamente su diseño original. El fondo, la iluminación y la composición deben transmitir una sensación de calidad premium, confianza y alto valor comercial, dejando la imagen lista para utilizar en tiendas online, Mercado Libre, Amazon, Shopify, catálogos impresos, redes sociales y campañas publicitarias. No generes un render con apariencia artificial. El resultado debe ser indistinguible de una fotografía profesional real de estudio, manteniendo una fidelidad absoluta al producto original y modificando únicamente el entorno, la iluminación, el encuadre y la calidad visual.",
].join("\n\n");

/** El prompt completo que se manda al modelo de imagen. */
export function buildProductImagePrompt(ctx: ProductImageContext): string {
  const name = ctx.name.replace(/\s+/g, " ").trim().slice(0, 120);
  const category = ctx.category?.replace(/\s+/g, " ").trim();
  const scene = cleanSceneHint(ctx.scene) ?? pickScene(ctx);
  // Pieza y escenario van PRIMERO: si el modelo corta un prompt largo, se
  // pierde el final de las instrucciones, no la pieza ni el escenario.
  const product = `Producto: "${name}"${category ? ` (categoría: ${category})` : ""}. Escenario: ${scene}.`;

  return `${product}\n\n${BASE_INSTRUCTIONS}`;
}
