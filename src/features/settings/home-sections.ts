// Secciones del home que se pueden mostrar/ocultar desde Apariencia.
export const HOME_SECTIONS: Array<{ id: string; label: string; icon: string }> =
  [
    { id: "trustBar", label: "Banda de confianza", icon: "shield" },
    { id: "categorias", label: "Categorías destacadas", icon: "grid" },
    { id: "nuevos", label: "Nuevos lanzamientos", icon: "sparkles" },
    { id: "stats", label: "Hefesto en números", icon: "chart" },
    { id: "ofertas", label: "Ofertas de la semana", icon: "zap" },
    { id: "materiales", label: "Materiales", icon: "layers" },
    { id: "masVendidos", label: "Más vendidos", icon: "star" },
    { id: "galeria", label: "Galería (hecho por Hefesto)", icon: "grid" },
    { id: "comoFunciona", label: "¿Cómo funciona?", icon: "printer" },
    { id: "testimonios", label: "Testimonios", icon: "heart" },
    { id: "faq", label: "Preguntas frecuentes", icon: "alert" },
    { id: "pedidoMedida", label: "Pedido a medida", icon: "palette" },
  ];

/** ¿Se muestra la sección? (default: sí, salvo que esté explícitamente en false) */
export function sectionOn(
  sections: Record<string, boolean> | null | undefined,
  id: string,
): boolean {
  return sections?.[id] !== false;
}
