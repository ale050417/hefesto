// Datos de ejemplo del catálogo (solo desarrollo).
// Sin stock: productos a pedido. Variantes = tamaños. Imágenes placeholder.

export type SeedImage = {
  url: string;
  alt: string;
  isPrimary?: boolean;
};

export type SeedVariant = {
  label: string; // tamaño, ej. "Grande (18 cm)"
  priceOverride?: string; // numeric -> string
};

export type SeedProduct = {
  name: string;
  slug: string;
  description: string;
  categorySlug: string;
  price: string; // numeric -> string
  salePrice?: string;
  material?: string;
  printTimeMinutes?: number;
  weightGrams?: number;
  dimensions?: string;
  status: "draft" | "published" | "archived";
  isFeatured?: boolean;
  isNew?: boolean;
  images: SeedImage[];
  variants?: SeedVariant[];
  tags?: string[];
};

export const categoriesData = [
  {
    name: "Hogar y Deco",
    slug: "hogar-y-deco",
    icon: "home",
    color: "#C9A84C",
    sortOrder: 1,
  },
  {
    name: "Gaming",
    slug: "gaming",
    icon: "gamepad-2",
    color: "#5A9CD9",
    sortOrder: 2,
  },
  {
    name: "Organización",
    slug: "organizacion",
    icon: "package",
    color: "#4CB782",
    sortOrder: 3,
  },
  {
    name: "Figuras",
    slug: "figuras",
    icon: "sparkles",
    color: "#D96A5A",
    sortOrder: 4,
  },
];

const img = (slug: string, alt: string): SeedImage => ({
  url: `https://picsum.photos/seed/${slug}/800/800`,
  alt,
  isPrimary: true,
});

export const productsData: SeedProduct[] = [
  {
    name: "Maceta geométrica",
    slug: "maceta-geometrica",
    description: "Maceta de diseño facetado, ideal para suculentas.",
    categorySlug: "hogar-y-deco",
    price: "4500.00",
    salePrice: "3800.00",
    material: "PLA",
    printTimeMinutes: 180,
    weightGrams: 120,
    dimensions: "12x12x10 cm",
    status: "published",
    isFeatured: true,
    isNew: true,
    images: [img("maceta-geometrica", "Maceta geométrica")],
    tags: ["decoración", "minimalista"],
  },
  {
    name: "Lámpara lunar",
    slug: "lampara-lunar",
    description: "Lámpara con textura de luna, luz cálida regulable.",
    categorySlug: "hogar-y-deco",
    price: "7800.00",
    material: "PLA",
    printTimeMinutes: 420,
    weightGrams: 320,
    dimensions: "desde 12 cm Ø",
    status: "published",
    isFeatured: true,
    images: [img("lampara-lunar", "Lámpara lunar")],
    variants: [
      { label: "Chica (12 cm)", priceOverride: "7800.00" },
      { label: "Grande (18 cm)", priceOverride: "12500.00" },
    ],
    tags: ["decoración", "regalo"],
  },
  {
    name: "Soporte para joystick",
    slug: "soporte-joystick",
    description: "Soporte de escritorio para joystick o gamepad.",
    categorySlug: "gaming",
    price: "3200.00",
    material: "PETG",
    printTimeMinutes: 90,
    weightGrams: 75,
    dimensions: "10x8x6 cm",
    status: "published",
    isNew: true,
    images: [img("soporte-joystick", "Soporte para joystick")],
    tags: ["gamer"],
  },
  {
    name: "Organizador de escritorio",
    slug: "organizador-escritorio",
    description: "Organizador modular para lápices, notas y cables.",
    categorySlug: "organizacion",
    price: "5600.00",
    material: "PLA",
    printTimeMinutes: 240,
    weightGrams: 200,
    dimensions: "20x12x8 cm",
    status: "published",
    images: [img("organizador-escritorio", "Organizador de escritorio")],
    tags: ["minimalista", "oficina"],
  },
  {
    name: "Porta auriculares",
    slug: "porta-auriculares",
    description: "Soporte de escritorio para auriculares gamer.",
    categorySlug: "gaming",
    price: "4100.00",
    salePrice: "3500.00",
    material: "PETG",
    printTimeMinutes: 150,
    weightGrams: 110,
    dimensions: "14x10x12 cm",
    status: "published",
    images: [img("porta-auriculares", "Porta auriculares")],
    tags: ["gamer"],
  },
  {
    name: "Dragón articulado",
    slug: "dragon-articulado",
    description: "Figura articulada de dragón, flexible pieza a pieza.",
    categorySlug: "figuras",
    price: "8500.00",
    material: "PLA",
    printTimeMinutes: 600,
    weightGrams: 280,
    dimensions: "desde 15 cm",
    status: "published",
    isFeatured: true,
    isNew: true,
    images: [img("dragon-articulado", "Dragón articulado")],
    variants: [
      { label: "Chico (15 cm)", priceOverride: "8500.00" },
      { label: "Grande (25 cm)", priceOverride: "12500.00" },
    ],
    tags: ["regalo"],
  },
  {
    name: "Maceta autorregante",
    slug: "maceta-autorregante",
    description: "Maceta con depósito de agua para riego autónomo.",
    categorySlug: "hogar-y-deco",
    price: "6900.00",
    material: "PETG",
    printTimeMinutes: 300,
    weightGrams: 240,
    dimensions: "14x14x13 cm",
    status: "published",
    images: [img("maceta-autorregante", "Maceta autorregante")],
    tags: ["decoración"],
  },
  {
    name: "Soporte para celular",
    slug: "soporte-celular",
    description: "Soporte plegable para celular, ángulo ajustable.",
    categorySlug: "organizacion",
    price: "2800.00",
    material: "PLA",
    printTimeMinutes: 60,
    weightGrams: 45,
    dimensions: "9x7x10 cm",
    status: "published",
    isNew: true,
    images: [img("soporte-celular", "Soporte para celular")],
    tags: ["minimalista"],
  },
  {
    name: "Llavero personalizable",
    slug: "llavero-personalizable",
    description: "Llavero con nombre o texto a elección (borrador).",
    categorySlug: "figuras",
    price: "1500.00",
    material: "PLA",
    printTimeMinutes: 30,
    weightGrams: 12,
    dimensions: "5x3 cm",
    status: "draft",
    images: [img("llavero-personalizable", "Llavero personalizable")],
    tags: ["regalo"],
  },
];
