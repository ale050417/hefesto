// El tipo Profile vive en core/auth/profile (la sesión lo necesita y core no
// puede importar features). Acá se re-exporta para el uso interno del feature.
export type { Profile, UserRole } from "@/core/auth/profile";
