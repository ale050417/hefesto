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
  /**
   * Qué es la pieza (ver PIECE_TYPES). Sin esto vale "figura", que es el
   * prompt de siempre: quien no lo manda recibe exactamente lo mismo que antes.
   */
  pieceType?: PieceType | null;
};

/**
 * Tipo de pieza (pedido de Agustín, 2026-11-17): el prompt daba por sentado
 * una figura parada sobre una mesa, y por eso los llaveros salían mal (los
 * paraba como una estatua, les sacaba la argolla o los dejaba chiquitos en el
 * medio del cuadro). Cada tipo suma sus propias indicaciones de composición,
 * escala y apoyo; la escena (bar, plantas, escritorio…) se sigue eligiendo
 * aparte, como antes.
 */
export type PieceType =
  | "figura"
  | "llavero"
  | "chop"
  | "maceta"
  | "plana"
  | "otro";

type PieceTypeSpec = {
  id: PieceType;
  /** Texto del chip en el panel. */
  label: string;
  /** Ayuda que se muestra debajo de los chips. */
  hint: string;
  /** Indicaciones que se suman al prompt. `null`: el prompt de siempre. */
  instructions: string | null;
  /**
   * Reemplaza a las escenas que dicen "standing…" (la de fondo y la de
   * personajes): un llavero o un cartel no van parados sobre una mesa.
   */
  scene?: string;
  /** Reemplaza el encuadre general (pieza al 50–65 % del cuadro). */
  framing?: string;
};

/** En el orden en que se muestran los chips de "¿Qué es la pieza?". */
export const PIECE_TYPES: readonly PieceTypeSpec[] = [
  {
    id: "figura",
    label: "Figura",
    hint: "Figuras, personajes y muñecos: la pieza parada sobre una mesa.",
    instructions: null,
  },
  {
    id: "llavero",
    label: "Llavero",
    hint: "Pieza chica y plana con argolla: acostada o colgando, bien de cerca.",
    instructions:
      "Tipo de pieza: llavero. Es una pieza pequeña y plana, de pocos centímetros, con una argolla o cadena metálica. Fotografíala apoyada de plano sobre la superficie, vista desde arriba o con un ángulo leve, o bien colgando de su argolla. Conserva la argolla o cadena metálica completa, unida a la pieza y en el mismo lugar que en la referencia. Nunca la pongas de pie ni parada sobre su canto, no le agregues una base ni un pedestal y no la conviertas en una estatua, figura o escultura con volumen: sigue siendo un llavero plano, a su escala real (cabe en la palma de una mano). Estas indicaciones tienen prioridad sobre cualquier otra de composición.",
    scene: "lying flat on a dark wooden surface, macro close-up",
    framing:
      "toma macro en primer plano. El llavero completo, con su argolla, debe llenar el encuadre: aproximadamente entre el 75% y el 85% del área visible, centrado, sin recortar ninguna parte y con un margen fino alrededor.",
  },
  {
    id: "chop",
    label: "Chop / vaso",
    hint: "Chops, vasos, mates y tazas: de pie y con toda la altura a la vista.",
    instructions:
      "Tipo de pieza: chop o vaso (pieza para beber). Debe aparecer de pie, en posición vertical, apoyado sobre su base, con toda su altura visible, desde la base hasta la boca, sin recortes. No cambies el diseño impreso de la funda exterior (figuras, relieves, textos, logos): reprodúcelo exactamente, en la misma posición y con los mismos colores. No le agregues asa, tapa, sorbete ni ningún elemento que no esté en la referencia.",
  },
  {
    id: "maceta",
    label: "Maceta / decoración",
    hint: "Macetas y adornos para la casa, en un ambiente creíble.",
    instructions:
      "Tipo de pieza: maceta u objeto de decoración para el hogar. Muéstrala apoyada de forma estable en un ambiente de hogar creíble (un estante, una repisa, una mesa o el borde de una ventana), a su escala real respecto del entorno. No agregues ni quites plantas, tierra u objetos dentro de la pieza: debe verse como en la referencia.",
  },
  {
    id: "plana",
    label: "Pieza plana / cartel",
    hint: "Carteles, placas y logos: de frente, apenas en ángulo, en pared o escritorio.",
    instructions:
      "Tipo de pieza: pieza plana (cartel, placa o logo). Muéstrala en vista frontal, apenas en ángulo (unos 10 a 20 grados) para que se note el espesor y el relieve, colgada en una pared o apoyada sobre un escritorio. Todo el texto y el logo deben quedar completos y legibles, sin deformar, reescribir ni reordenar letras. No le des volumen ni la conviertas en una escultura: sigue siendo una pieza plana.",
    scene:
      "mounted on a clean wall or leaning upright on a desk, front view, slightly angled",
  },
  {
    id: "otro",
    label: "Otro",
    hint: "Cualquier otra cosa: foto de estudio neutra, sin cambiarle la forma.",
    instructions:
      "Tipo de pieza: otro. Conserva exactamente la forma y las proporciones de la pieza y no reinterpretes qué objeto es. Toma de estudio neutra, con la pieza apoyada de forma estable y natural.",
    scene: "on a dark wooden table against a dark studio background",
  },
];

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

/** Valida lo que llega del formulario: un tipo conocido o `null`. */
export function parsePieceType(value: unknown): PieceType | null {
  return PIECE_TYPES.find((t) => t.id === value)?.id ?? null;
}

/**
 * Palabras clave para preseleccionar el tipo. Se evalúan en orden: lo más
 * específico primero (un "llavero de Pikachu" es un llavero, no una figura) y
 * lo más vago al final ("decoración" suele ser la categoría de media tienda).
 */
const PIECE_TYPE_MATCHERS: Array<{ match: RegExp; type: PieceType }> = [
  { match: /\b(llavero|llaveros|keychain)\b/, type: "llavero" },
  {
    match:
      /\b(chop|chops|chopp|chopps|vaso|vasos|mate|mates|taza|tazas|jarra|jarras|copa|copas)\b/,
    type: "chop",
  },
  {
    match: /\b(maceta|macetas|macetero|maceteros|florero|floreros)\b/,
    type: "maceta",
  },
  {
    match:
      /\b(cartel|carteles|logo|logos|placa|placas|letrero|letreros|posavasos)\b/,
    type: "plana",
  },
  {
    match:
      /\b(pokemon|figura|figuras|personaje|personajes|anime|juguete|juguetes|miniatura|miniaturas|estatua|estatuas|busto|bustos|funko|funkos)\b/,
    type: "figura",
  },
  {
    match:
      /\b(decoracion|adorno|adornos|jarron|jarrones|portavelas|hogar|deco)\b/,
    type: "maceta",
  },
];

function matchPieceType(text: string): PieceType | null {
  const haystack = normalizeForMatch(text);
  return PIECE_TYPE_MATCHERS.find((m) => m.match.test(haystack))?.type ?? null;
}

/**
 * Tipo de pieza sugerido según el nombre, la categoría y la descripción; el
 * que carga lo puede cambiar. Nombre y categoría mandan: la descripción solo
 * se mira si ahí no hay pistas, porque un "acabado mate" en la descripción
 * no convierte la pieza en un mate. Sin pistas, "figura" (lo de siempre).
 */
export function detectPieceType(ctx: ProductImageContext): PieceType {
  return (
    matchPieceType(`${ctx.name} ${ctx.category ?? ""}`) ??
    matchPieceType(ctx.description ?? "") ??
    "figura"
  );
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
const SIZE_INSTRUCTION =
  "La imagen final debe tener un tamaño exacto de 1000 × 1000 píxeles (formato cuadrado).";
const AIR_INSTRUCTION =
  "El producto no debe ocupar todo el encuadre; debe aparecer ligeramente más pequeño, centrado y con suficiente espacio libre alrededor (aire visual) para lograr una composición publicitaria elegante, equilibrada y profesional.";
const FRAMING_INSTRUCTION =
  "Encuadre: el producto debe ser el protagonista, pero no debe llenar el lienzo. Debe ocupar aproximadamente entre el 50% y el 65% del área visible de la imagen, dejando márgenes amplios y una composición limpia, equilibrada y apta para e-commerce y publicidad premium.";

/**
 * `framing` reemplaza las dos indicaciones de encuadre (el "aire" y el
 * 50–65 %) para los tipos que piden otra cosa: dejarlas y sumar "llená el
 * cuadro" al lado sería darle al modelo dos órdenes opuestas.
 */
function baseInstructions(framing?: string): string {
  return [
    "Utiliza la imagen proporcionada únicamente como referencia del producto. Genera una fotografía publicitaria hiperrealista y de calidad comercial del mismo producto, manteniendo exactamente el 100% del diseño original. No modifiques, rediseñes, reemplaces, corrijas, simplifiques, estilices, agregues ni elimines ningún detalle del producto.",
    framing ? SIZE_INSTRUCTION : `${SIZE_INSTRUCTION} ${AIR_INSTRUCTION}`,
    ...BASE_BODY,
    framing ? `Encuadre: ${framing}` : FRAMING_INSTRUCTION,
    BASE_RESULT,
  ].join("\n\n");
}

const BASE_BODY = [
  "Respeta de forma absoluta: forma y proporciones; dimensiones y grosor; colores originales; tipografía; bordes y contornos; relieves, grabados y cortes; texturas reales del material (líneas de impresión 3D); acabado superficial; microdetalles visibles; identidad visual completa del producto.",
  "El producto debe ser una réplica exacta del original. La única mejora permitida es la calidad fotográfica y la presentación visual.",
  "Convierte el producto en una fotografía comercial de nivel premium con: calidad hiperrealista; resolución equivalente a 8K; nivel de detalle extremo; nitidez profesional de estudio; materiales físicamente correctos (PBR); texturas completamente fotorrealistas de líneas de impresión 3D; bordes perfectamente definidos; excelente rango dinámico (HDR); reflejos naturales y controlados; sombras suaves y realistas; iluminación profesional de estudio mediante softboxes; balance de blancos perfecto; colores fieles al producto original; profundidad de campo cinematográfica sin perder detalles importantes; calidad comparable a una fotografía realizada con una cámara de formato medio y un objetivo macro profesional.",
  "Fondo y composición: genera un fondo profesional, elegante y completamente relacionado con el producto, como si hubiera sido realizado para una campaña publicitaria de una marca reconocida. El escenario debe complementar el producto sin robar protagonismo y puede incluir superficies, texturas, elementos decorativos o ambientaciones acordes a su uso o categoría, siempre con un estilo premium y comercial. El fondo debe ser coherente con el tipo de producto, moderno y minimalista, elegante y limpio, visualmente atractivo, con iluminación integrada de forma natural, sin objetos innecesarios que distraigan, con profundidad y sensación tridimensional, con colores que resalten el producto sin alterar sus tonos reales, y con apariencia de una sesión fotográfica profesional para publicidad. El escenario puede recrear un ambiente realista de alta calidad (por ejemplo, una mesa de madera premium, una superficie de mármol, un escritorio moderno, un ambiente infantil, un taller, una cocina, una oficina, una sala de estar, una vitrina o cualquier contexto relacionado con el producto), siempre que sea coherente con su finalidad y aporte valor visual.",
];
const BASE_RESULT =
  "Resultado esperado: la imagen final debe parecer una fotografía tomada por un fotógrafo profesional especializado en publicidad y e-commerce de lujo. El producto debe conservar exactamente su diseño original. El fondo, la iluminación y la composición deben transmitir una sensación de calidad premium, confianza y alto valor comercial, dejando la imagen lista para utilizar en tiendas online, Mercado Libre, Amazon, Shopify, catálogos impresos, redes sociales y campañas publicitarias. No generes un render con apariencia artificial. El resultado debe ser indistinguible de una fotografía profesional real de estudio, manteniendo una fidelidad absoluta al producto original y modificando únicamente el entorno, la iluminación, el encuadre y la calidad visual.";

/** El prompt completo que se manda al modelo de imagen. */
export function buildProductImagePrompt(ctx: ProductImageContext): string {
  const name = ctx.name.replace(/\s+/g, " ").trim().slice(0, 120);
  const category = ctx.category?.replace(/\s+/g, " ").trim();
  const type =
    PIECE_TYPES.find((t) => t.id === ctx.pieceType) ?? PIECE_TYPES[0];
  let auto = pickScene(ctx);
  // Las escenas "standing…" son para figuras: un llavero o un cartel usan
  // la escena propia de su tipo.
  if (type?.scene && auto.startsWith("standing ")) auto = type.scene;
  const scene = cleanSceneHint(ctx.scene) ?? auto;
  // Pieza y escenario van PRIMERO: si el modelo corta un prompt largo, se
  // pierde el final de las instrucciones, no la pieza ni el escenario. El
  // tipo de pieza va enseguida después, por lo mismo.
  const product = `Producto: "${name}"${category ? ` (categoría: ${category})` : ""}. Escenario: ${scene}.`;
  const head = type?.instructions
    ? `${product}\n\n${type.instructions}`
    : product;

  return `${head}\n\n${baseInstructions(type?.framing)}`;
}
