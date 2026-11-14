import { revalidatePath } from "next/cache";
import { apiOk, requireApiPerm, withApi } from "@/core/api/respond";
import { invalidInput } from "@/features/inventory/api-helpers";
import { FILAMENT_DIAMETERS } from "@/features/inventory/constants";
import {
  addBrand,
  addColor,
  addMaterial,
  listBrandCatalog,
  listColorCatalog,
  listMaterialCatalog,
  removeBrand,
  removeColor,
  removeMaterial,
} from "@/features/inventory/queries";
import { catalogItemSchema } from "@/features/inventory/schemas";

/**
 * /api/v1/admin/filaments/catalog — colores, marcas y materiales para los
 * selectores del formulario de filamentos (app móvil, 2026-10-31). Mismo
 * catálogo y mismos permisos que la web:
 *  - GET    → { colors:[{name,hex}], brands:[{name}], materials:[{name}],
 *               diameters }. Permiso filamentos/ver.
 *  - POST   → agrega uno ({ kind, name, hex? }). Permiso filamentos/crear.
 *  - DELETE → quita uno (?kind=color|brand|material&name=...). Permiso
 *             filamentos/eliminar. Los carretes ya cargados no se tocan.
 */
export const dynamic = "force-dynamic";

export const GET = withApi(
  "admin/filaments/catalog",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "filamentos", "ver");
    if ("response" in auth) return auth.response;

    const [colors, brands, materials] = await Promise.all([
      listColorCatalog(),
      listBrandCatalog(),
      listMaterialCatalog(),
    ]);
    return apiOk({
      colors: colors.map((c) => ({ name: c.name, hex: c.hex })),
      brands: brands.map((b) => ({ name: b.name })),
      materials: materials.map((m) => ({ name: m.name })),
      diameters: FILAMENT_DIAMETERS,
    });
  },
);

export const POST = withApi(
  "admin/filaments/catalog/add",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "filamentos", "crear");
    if ("response" in auth) return auth.response;

    const parsed = catalogItemSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInput(parsed.error);
    const { kind, name, hex } = parsed.data;

    if (kind === "color") await addColor({ name, hex });
    else if (kind === "brand") await addBrand({ name });
    else await addMaterial({ name });

    revalidatePath("/admin/filamentos");
    return apiOk({ ok: true }, { status: 201 });
  },
);

export const DELETE = withApi(
  "admin/filaments/catalog/remove",
  async (request: Request) => {
    const auth = await requireApiPerm(request, "filamentos", "eliminar");
    if ("response" in auth) return auth.response;

    const params = new URL(request.url).searchParams;
    const parsed = catalogItemSchema
      .pick({ kind: true, name: true })
      .safeParse({ kind: params.get("kind"), name: params.get("name") });
    if (!parsed.success) return invalidInput(parsed.error);
    const { kind, name } = parsed.data;

    if (kind === "color") await removeColor(name);
    else if (kind === "brand") await removeBrand(name);
    else await removeMaterial(name);

    revalidatePath("/admin/filamentos");
    return apiOk({ ok: true });
  },
);
