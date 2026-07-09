import { z } from "zod";
import {
  isAcceptablePassword,
  PASSWORD_POLICY_MESSAGE,
} from "./password-strength";

export const loginSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export const registerSchema = z
  .object({
    fullName: z.string().min(1, "Ingresá tu nombre").max(120),
    email: z.email("Email inválido"),
    password: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .refine(isAcceptablePassword, PASSWORD_POLICY_MESSAGE),
    confirmPassword: z.string().min(1, "Repetí la contraseña"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const resetRequestSchema = z.object({
  email: z.email("Email inválido"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;
