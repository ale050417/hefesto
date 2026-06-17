"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { createCategoryAction, updateCategoryAction } from "../actions";

export type CategoryFormValues = {
  name: string;
  slug: string;
  icon: string;
  color: string;
  sortOrder: string;
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

export function CategoryForm({
  mode,
  categoryId,
  defaultValues,
}: {
  mode: "create" | "edit";
  categoryId?: string;
  defaultValues: CategoryFormValues;
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
  } = useForm<CategoryFormValues>({ defaultValues });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result =
      mode === "create"
        ? await createCategoryAction(values)
        : await updateCategoryAction(categoryId ?? "", values);

    if (!result.ok) {
      setFormError(result.error.message);
      const fields = result.error.fields;
      if (fields) {
        for (const [key, message] of Object.entries(fields)) {
          if (key in values) {
            setError(key as keyof CategoryFormValues, { message });
          }
        }
      }
      return;
    }
    router.push("/admin/categorias");
    router.refresh();
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

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor="icon">
            Ícono (opcional)
          </label>
          <input
            id="icon"
            placeholder="home"
            className={field}
            {...register("icon")}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="color">
            Color (#RRGGBB)
          </label>
          <input
            id="color"
            placeholder="#C9A84C"
            className={field}
            {...register("color")}
          />
          {errors.color ? (
            <p className="text-danger mt-1 text-xs">{errors.color.message}</p>
          ) : null}
        </div>
        <div>
          <label className={labelCls} htmlFor="sortOrder">
            Orden
          </label>
          <input
            id="sortOrder"
            type="number"
            className={field}
            {...register("sortOrder")}
          />
        </div>
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Guardando..."
            : mode === "create"
              ? "Crear categoría"
              : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
