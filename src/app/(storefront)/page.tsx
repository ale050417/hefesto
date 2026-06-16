import { ProductGrid } from "@/features/products/components/product-grid";
import type { ProductView } from "@/features/products/types";

// Datos de ejemplo SOLO para previsualizar ProductCard/Grid.
// En el Paso 16 la Home trae los productos reales desde la base.
const demoProducts: ProductView[] = [
  {
    id: "1",
    name: "Maceta geométrica",
    slug: "maceta-geometrica",
    price: 4500,
    salePrice: 3800,
    effectivePrice: 3800,
    isOnSale: true,
    discountPercent: 16,
    hasVariants: false,
    isNew: true,
    isFeatured: true,
    material: "PLA",
    category: { name: "Hogar y Deco", slug: "hogar-y-deco" },
    primaryImage: {
      url: "https://picsum.photos/seed/maceta-geometrica/800/800",
      alt: "Maceta geométrica",
    },
  },
  {
    id: "2",
    name: "Lámpara lunar",
    slug: "lampara-lunar",
    price: 7800,
    salePrice: null,
    effectivePrice: 7800,
    isOnSale: false,
    discountPercent: null,
    hasVariants: true,
    isNew: false,
    isFeatured: true,
    material: "PLA",
    category: { name: "Hogar y Deco", slug: "hogar-y-deco" },
    primaryImage: {
      url: "https://picsum.photos/seed/lampara-lunar/800/800",
      alt: "Lámpara lunar",
    },
  },
  {
    id: "3",
    name: "Soporte para joystick",
    slug: "soporte-joystick",
    price: 3200,
    salePrice: null,
    effectivePrice: 3200,
    isOnSale: false,
    discountPercent: null,
    hasVariants: false,
    isNew: true,
    isFeatured: false,
    material: "PETG",
    category: { name: "Gaming", slug: "gaming" },
    primaryImage: {
      url: "https://picsum.photos/seed/soporte-joystick/800/800",
      alt: "Soporte para joystick",
    },
  },
  {
    id: "4",
    name: "Dragón articulado",
    slug: "dragon-articulado",
    price: 8500,
    salePrice: null,
    effectivePrice: 8500,
    isOnSale: false,
    discountPercent: null,
    hasVariants: true,
    isNew: true,
    isFeatured: true,
    material: "PLA",
    category: { name: "Figuras", slug: "figuras" },
    primaryImage: {
      url: "https://picsum.photos/seed/dragon-articulado/800/800",
      alt: "Dragón articulado",
    },
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="eyebrow">Fase 1 · vista previa</p>
      <h1 className="font-display text-fg mt-3 text-3xl">Productos</h1>
      <p className="text-dim mt-2 max-w-prose">
        Vista previa de las tarjetas de producto. En el próximo paso se conectan
        los datos reales desde la base.
      </p>
      <div className="mt-10">
        <ProductGrid products={demoProducts} />
      </div>
    </div>
  );
}
