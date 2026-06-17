"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { createProductAction, updateProductAction } from "../actions";
import type { Category } from "../types";

export type ProductFormValues = {
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  price: string;
  salePrice: string;
  material: string;
  printTimeMinutes: string;
  weightGrams: string;
  dimensions: string;
  isFeatured: boolean;
  isNew: boolean;
};

const field =
  "w-full rounded-md border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-fg";
const labelCls = "mb-1 block text-xs font-medium text-dim";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function ProductForm({
  mode,
  productId,
  categories,
  defaultValues,
}: {
  mode: "create" | "edit";
  productId?: string;
  categories: Category[];
  defaultValues: ProductFormValues;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({ defaultValues });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result =
      mode === "create"
        ? await createProductAction(values)
        : await updateProductAction(productId ?? "", values);

    if (!result.ok) {
      setFormError(result.error.message);
      const fields = result.error.fields;
      if (fields) {
        for (const [key, message] of Object.entries(fields)) {
          if (key in values) {
            setError(key as keyof ProductFormValues, { message });
          }
        }
      }
      return;
    }
    if (mode === "create") {
      router.push(`/admin/productos/${result.data.id}/editar`);
    } else {
      router.refresh();
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {formError ? (
        <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">
          {formError}
        </p>
      ) : null}

      <div>
        <label className={labelCls} htmlFor="name">
          Nombre
        </label>
        <input id="name" className={field} {...register("name")} />
        {errors.name ? (
          <p className="text-danger mt-1 text-xs">{errors.name.message}</p>
        ) : null}
      </div>

      <div>
        <label className={labelCls} htmlFor="slug">
          Slug
        </label>
        <div className="flex gap-2">
          <input id="slug" className={field} {...register("slug")} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setValue("slug", slugify(getValues("name")))}
          >
            Generar
          </Button>
        </div>
        {errors.slug ? (
          <p className="text-danger mt-1 text-xs">{errors.slug.message}</p>
        ) : null}
      </div>

      <div>
        <label className={labelCls} htmlFor="description">
          Descripción
        </label>
        <textarea
          id="description"
          rows={4}
          className={field}
          {...register("description")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="categoryId">
            Categoría
          </label>
          <select id="categoryId" className={field} {...register("categoryId")}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="material">
            Material
          </label>
          <input id="material" className={field} {...register("material")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="price">
            Precio
          </label>
          <input
            id="price"
            type="number"
            step="0.01"
            className={field}
            {...register("price")}
          />
          {errors.price ? (
            <p className="text-danger mt-1 text-xs">{errors.price.message}</p>
          ) : null}
        </div>
        <div>
          <label className={labelCls} htmlFor="salePrice">
            Precio oferta (opcional)
          </label>
          <input
            id="salePrice"
            type="number"
            step="0.01"
            className={field}
            {...register("salePrice")}
          />
          {errors.salePrice ? (
            <p className="text-danger mt-1 text-xs">
              {errors.salePrice.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor="printTimeMinutes">
            Tiempo (min)
          </label>
          <input
            id="printTimeMinutes"
            type="number"
            className={field}
            {...register("printTimeMinutes")}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="weightGrams">
            Peso (g)
          </label>
          <input
            id="weightGrams"
            type="number"
            className={field}
            {...register("weightGrams")}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="dimensions">
            Dimensiones
          </label>
          <input
            id="dimensions"
            className={field}
            {...register("dimensions")}
          />
        </div>
      </div>

      <div className="flex gap-6">
        <label className="text-fg flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("isFeatured")} /> Destacado
        </label>
        <label className="text-fg flex items-center gap-2 text-sm">
          <input type="checkbox" {...register("isNew")} /> Nuevo
        </label>
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Guardando..."
            : mode === "create"
              ? "Crear producto"
              : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
