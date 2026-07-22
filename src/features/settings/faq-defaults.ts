export type FaqItem = { q: string; a: string };

/**
 * Preguntas frecuentes por defecto del home (si no se editó nada desde
 * Config → Tienda). Versión compacta: las 6 más importantes.
 */
export const DEFAULT_FAQ: FaqItem[] = [
  {
    q: "¿Cuánto tarda mi pedido?",
    a: "Todo se imprime a pedido, así que el tiempo depende de la pieza: el estimado figura en cada producto. Apenas confirmás el pedido, arrancamos.",
  },
  {
    q: "¿Hacen diseños personalizados?",
    a: "Claro. Contanos tu idea por WhatsApp y te pasamos un presupuesto sin compromiso. Para arrancar pedimos un adelanto (lo coordinamos según el proyecto) y el resto al entregar.",
  },
  {
    q: "¿Cómo son los envíos?",
    a: "Enviamos a todo el país. El costo del envío lo abona el cliente y lo coordinamos por WhatsApp al confirmar tu pedido.",
  },
  {
    q: "¿Puedo retirar en persona?",
    a: "Sí. Estamos en Iguazú y coordinamos el punto y el horario de entrega por WhatsApp.",
  },
  {
    q: "¿Qué medios de pago aceptan?",
    a: "MercadoPago, transferencia bancaria y efectivo al retirar.",
  },
  {
    q: "¿Y si algo sale mal?",
    a: "Si tu pieza llega con una falla de impresión, la rehacemos. Queremos que quede impecable.",
  },
];
