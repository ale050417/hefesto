import { describe, expect, it } from "vitest";
import {
  ancestorsOf,
  categoryPath,
  depthOf,
  descendantIds,
  flattenTree,
  isDescendantOf,
  rootsOf,
  subtreeIds,
  sumSubtree,
} from "./category-tree";

// El ejemplo de Ale: Figuras de colección › Funko Pop › Superhéroes.
const cats = [
  { id: "fig", name: "Figuras de colección", parentId: null, count: 1 },
  { id: "funko", name: "Funko Pop", parentId: "fig", count: 2 },
  { id: "heroes", name: "Superhéroes", parentId: "funko", count: 4 },
  { id: "anime", name: "Anime", parentId: "funko", count: 8 },
  { id: "deco", name: "Decoración", parentId: null, count: 16 },
  // Padre que no vino en la lista (la tienda filtra las vacías): cuenta raíz.
  { id: "suelta", name: "Suelta", parentId: "no-existe", count: 32 },
];

describe("category-tree (subcategorías sin límite de nivel)", () => {
  it("raíces: sin padre o con padre ausente", () => {
    expect(rootsOf(cats).map((c) => c.id)).toEqual(["fig", "deco", "suelta"]);
  });

  it("la descendencia baja todos los niveles", () => {
    expect(descendantIds(cats, "fig").sort()).toEqual([
      "anime",
      "funko",
      "heroes",
    ]);
    expect(descendantIds(cats, "funko").sort()).toEqual(["anime", "heroes"]);
    expect(descendantIds(cats, "heroes")).toEqual([]);
  });

  it("el subárbol incluye a la propia categoría (lo que cubre un filtro)", () => {
    expect(subtreeIds(cats, "funko").sort()).toEqual([
      "anime",
      "funko",
      "heroes",
    ]);
  });

  it("isDescendantOf mira cualquier profundidad", () => {
    expect(isDescendantOf(cats, "heroes", "fig")).toBe(true);
    expect(isDescendantOf(cats, "fig", "heroes")).toBe(false);
    expect(isDescendantOf(cats, "deco", "fig")).toBe(false);
  });

  it("antepasados de la raíz al padre, y la profundidad", () => {
    expect(ancestorsOf(cats, "heroes").map((c) => c.id)).toEqual([
      "fig",
      "funko",
    ]);
    expect(depthOf(cats, "heroes")).toBe(2);
    expect(depthOf(cats, "fig")).toBe(0);
    expect(depthOf(cats, "suelta")).toBe(0);
  });

  it("la ruta legible muestra toda la cadena", () => {
    expect(categoryPath(cats, "heroes")).toBe(
      "Figuras de colección › Funko Pop › Superhéroes",
    );
    expect(categoryPath(cats, "deco")).toBe("Decoración");
    expect(categoryPath(cats, "nada")).toBe("");
  });

  it("el árbol aplanado va en orden de lectura con su profundidad", () => {
    expect(flattenTree(cats).map((x) => `${x.depth}:${x.node.id}`)).toEqual([
      "0:fig",
      "1:funko",
      "2:heroes",
      "2:anime",
      "0:deco",
      "0:suelta",
    ]);
    // Solo lo que cuelga de una categoría.
    expect(flattenTree(cats, "funko").map((x) => x.node.id)).toEqual([
      "heroes",
      "anime",
    ]);
  });

  it("sumSubtree suma la categoría y toda su descendencia", () => {
    expect(sumSubtree(cats, "fig", (c) => c.count)).toBe(1 + 2 + 4 + 8);
    expect(sumSubtree(cats, "funko", (c) => c.count)).toBe(2 + 4 + 8);
    expect(sumSubtree(cats, "deco", (c) => c.count)).toBe(16);
  });

  it("un ciclo accidental no cuelga nada", () => {
    const loop = [
      { id: "a", name: "A", parentId: "b" },
      { id: "b", name: "B", parentId: "a" },
    ];
    expect(descendantIds(loop, "a")).toEqual(["b"]);
    expect(ancestorsOf(loop, "a").map((c) => c.id)).toEqual(["b"]);
    expect(flattenTree(loop).length).toBeLessThanOrEqual(2);
  });
});
