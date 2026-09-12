import { z } from "zod";

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit verification code"),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendCodeSchema = z.object({
  email: z.string().email(),
});

export type ResendCodeInput = z.infer<typeof resendCodeSchema>;
