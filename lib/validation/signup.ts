import { z } from "zod";
import {
  FULL_NAME_MIN_LENGTH,
  FULL_NAME_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "@/lib/constants";

export const signupSchema = z
  .object({
    fullName: z.string().min(FULL_NAME_MIN_LENGTH).max(FULL_NAME_MAX_LENGTH),
    email: z.string().trim().toLowerCase().email().max(EMAIL_MAX_LENGTH),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH)
      .max(PASSWORD_MAX_LENGTH)
      .regex(/[a-zA-Z]/, "Password must contain at least one letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[#@>^]/, "Password must contain at least one special character (#@>^)"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
