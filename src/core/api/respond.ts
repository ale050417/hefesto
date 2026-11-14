import { NextResponse } from "next/server";
import { getApiUser, isApiStaff, type ApiUser } from "@/core/auth/api-auth";
import {
  canForUser,
  type PermAction,
  type PermModule,
} from "@/core/auth/permissions";

/**
 * Helpers de respuesta de la API móvil (`/api/v1/*`).
 *
 * Contrato de errores (lo consume la app Flutter):
 *   { "error": { "code": "unauthorized", "message": "..." } }
 * Los códigos son estables (la app decide qué mostrar según `code`); el
 * `message` es texto para el usuario, en castellano.
 */

export type ApiErrorCode =
  | "unauthorized" // sin sesión / token inválido
  | "forbidden" // sesión ok pero sin permiso
  | "not_found"
  | "invalid" // validación de entrada
  | "unavailable" // dependencia caída (DB, etc.)
  | "internal";

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid: 422,
  unavailable: 503,
  internal: 500,
};

export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status: STATUS[code] },
  );
}

export function apiOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

/** Cache público corto para el catálogo (la CDN lo comparte entre dispositivos). */
export const PUBLIC_CACHE = {
  headers: {
    "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
  },
};

/**
 * Envuelve un handler: nunca devuelve stack ni detalles internos al cliente
 * (se loguean en el servidor) y siempre responde con el contrato de errores.
 */
export function withApi<Args extends unknown[]>(
  label: string,
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error(`[api/v1/${label}]`, error);
      return apiError(
        "unavailable",
        "No pudimos completar la operación. Probá de nuevo en unos segundos.",
      );
    }
  };
}

/** Exige sesión. Devuelve el usuario o la respuesta de error lista para retornar. */
export async function requireApiUser(
  request: Request,
): Promise<{ user: ApiUser } | { response: NextResponse }> {
  const user = await getApiUser(request);
  if (!user) {
    return {
      response: apiError("unauthorized", "Tu sesión venció. Volvé a ingresar."),
    };
  }
  return { user };
}

/**
 * Exige staff CON el permiso fino del módulo (ver/crear/editar/eliminar), igual
 * que los guards del panel web. Es el guard que usan los endpoints del admin.
 */
export async function requireApiPerm(
  request: Request,
  module: PermModule,
  action: PermAction,
): Promise<{ user: ApiUser } | { response: NextResponse }> {
  const auth = await requireApiStaff(request);
  if ("response" in auth) return auth;
  const allowed = await canForUser(auth.user, module, action);
  if (!allowed) {
    return {
      response: apiError("forbidden", "No tenés permiso para hacer esto."),
    };
  }
  return auth;
}

/** Exige admin/operador (mismos permisos que el panel web). */
export async function requireApiStaff(
  request: Request,
): Promise<{ user: ApiUser } | { response: NextResponse }> {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth;
  if (auth.user.profileUnavailable) {
    return {
      response: apiError(
        "unavailable",
        "No pudimos verificar tu cuenta. Probá de nuevo en unos segundos.",
      ),
    };
  }
  if (!isApiStaff(auth.user)) {
    return {
      response: apiError("forbidden", "Esta cuenta no tiene acceso al panel."),
    };
  }
  return auth;
}
