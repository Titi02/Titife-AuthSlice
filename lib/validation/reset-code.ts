import { z } from "zod";

export const resetCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit reset code"),
});

export type ResetCodeInput = z.infer<typeof resetCodeSchema>;
