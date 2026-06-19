// Errores de dominio centralizados (Cap. 12). Cada uno lleva un `code` estable
// que las Server Actions mapean a su respuesta { ok:false, error:{code,message} }.

export type ErrorCode =
  | "VALIDATION"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "INVALID_TRANSITION"
  | "PAYMENT_ERROR"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL"
  | (string & {}); // permite códigos específicos de un feature

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Datos inválidos.", fields?: Record<string, string>) {
    super("VALIDATION", message, fields);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "No encontrado.") {
    super("NOT_FOUND", message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "No autorizado.") {
    super("UNAUTHORIZED", message);
  }
}

export class InvalidTransitionError extends AppError {
  constructor(message = "Transición de estado inválida.") {
    super("INVALID_TRANSITION", message);
  }
}

export class PaymentError extends AppError {
  constructor(message = "Error al procesar el pago.") {
    super("PAYMENT_ERROR", message);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Demasiados intentos. Probá más tarde.") {
    super("RATE_LIMITED", message);
  }
}

// Resultado uniforme de las Server Actions (Cap. 12).
export type ActionResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | {
      ok: false;
      error: { code: string; message: string; fields?: Record<string, string> };
    };

/** Convierte un AppError en el `error` de un ActionResult. */
export function toActionError(error: unknown): {
  code: string;
  message: string;
  fields?: Record<string, string>;
} {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    };
  }
  console.error("[error] inesperado:", error);
  return { code: "INTERNAL", message: "Ocurrió un error. Probá de nuevo." };
}
