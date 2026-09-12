import { z } from "zod";
import { EMAIL_MAX_LENGTH } from "@/lib/constants";

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(EMAIL_MAX_LENGTH),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
